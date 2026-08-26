/**
 * Client-side Akumulasi processor.
 * Fills the weekly accumulation report (akumulasi.xlsx) from daily
 * per-line output files ASS *.XLS (Assembling/ASB) and STT *.XLS (Sewing).
 *
 * Strategy: pure OOXML zip surgery on the ORIGINAL akumulasi workbook —
 *   - parse each ASS/STT file (binary OLE2 or GBK/HTML export)
 *   - for every week block in the report, find its 6 day-columns (dates
 *     in the row under the week title) and write each line's daily Output
 *     into the matching date column
 *   - recompute Sub Totals / Grand Totals / jit-sew-ass summary rows
 * Everything else stays byte-identical. No library rewrite = no repair dialog.
 */
import * as XLSX from 'xlsx';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

function norm(s) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Parse a workbook buffer (binary xlsx/xls OR GBK HTML export) — same as blcClient. */
export function parseWorkbookAny(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input ?? new ArrayBuffer(0));
  const head = Array.from(bytes.subarray(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const isBinary = head.startsWith('504b') || head.startsWith('d0cf11e0');
  if (isBinary) return XLSX.read(bytes, { type: 'array' });

  let asciiHead = '';
  for (let i = 0; i < Math.min(bytes.length, 2048); i++) asciiHead += String.fromCharCode(bytes[i]);
  const charsetMatch = asciiHead.match(/charset=["']?([\w-]+)/i);
  let text;
  const declared = (charsetMatch?.[1] || '').toLowerCase();
  if (/^gb/i.test(declared)) text = new TextDecoder('gbk').decode(bytes);
  else if (declared === 'utf-8' || declared === 'utf8') text = new TextDecoder('utf-8').decode(bytes);
  else {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { text = new TextDecoder('gbk').decode(bytes); }
  }
  return XLSX.read(text, { type: 'string' });
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** Serial number -> ISO date string */
function serialToIso(serial) {
  const ms = Math.round((serial - 25569) * 86400000);
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Parse one ASS/STT file into { lines: Map<lineCode, Array<D1..D31 numbers>>, totals: Array }.
 * Row layout: header "LineNo | Line | D1..D31 | Total"; data rows follow; last col Total.
 */
export function parseDailyFile(workbook) {
  const out = new Map();
  let totals = null;
  let dCols = []; // Dn -> column index
  for (const sn of workbook.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json(workbook.Sheets[sn], { header: 1, defval: null, raw: true });
    if (!aoa.length) continue;
    // Find the header row within the first few rows (some exports have a title row)
    let header = null, hdrIdx = -1;
    let dCols = []; // Dn -> column index (reset per sheet)
    for (let h = 0; h < Math.min(aoa.length, 5); h++) {
      const cand = aoa[h] || [];
      const found = [];
      for (let c = 0; c < cand.length; c++) {
        const m = /(?:^|[^A-Z])D(\d{1,2})(?![0-9])/i.exec(String(cand[c] ?? '').trim().replace(/\s+/g, ''));
        if (m) found.push({ day: parseInt(m[1], 10), col: c });
      }
      if (found.length >= 5) { header = cand; hdrIdx = h; dCols = found; break; }
    }
    if (!dCols.length) continue; // not the expected shape; try next sheet
    for (let i = hdrIdx + 1; i < aoa.length; i++) {
      const row = aoa[i] || [];
      const code = String(row[0] ?? '').trim();
      if (!code || /^(tota|total)$/i.test(code)) continue;
      const days = new Array(32).fill(null);
      for (const { day, col } of dCols) {
        const v = row[col];
        days[day] = typeof v === 'number' ? v : (String(v ?? '').trim() === '' ? null : Number(v) || null);
      }
      const totalIdx = header.length - 1;
      const total = typeof row[totalIdx] === 'number' ? row[totalIdx] : null;
      out.set(code.toUpperCase(), { days, total, label: row[1] });
      if (code.toUpperCase().startsWith('TOTA')) totals = days;
    }
    if (out.size) break; // first matching sheet wins
  }
  return { lines: out, totals };
}

/** Column letter helpers */
function colLetter(zeroBased) {
  let n = zeroBased + 1, s = '';
  while (n > 0) { n -= 1; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

/**
 * Fill the akumulasi workbook XML.
 * @param xlsxBuf original akumulasi.xlsx bytes
 * @param sewParsed parsed STT (sewing)
 * @param assParsed parsed ASS (assembling)
 * @returns updated zip bytes + report
 */
export function fillAkumulasi(xlsxBuf, sewParsed, assParsed) {
  const files = unzipSync(xlsxBuf instanceof Uint8Array ? xlsxBuf : new Uint8Array(xlsxBuf));
  const wbXml = strFromU8(files['xl/workbook.xml']);

  // Shared strings table (cell t="s" -> <v>index</v>)
  let shared = [];
  if (files['xl/sharedStrings.xml']) {
    const ssXml = strFromU8(files['xl/sharedStrings.xml']);
    shared = [...ssXml.matchAll(/<si>(?:<t[^>]*>([\s\S]*?)<\/t>|[\s\S]*?)<\/si>/g)]
      .map((m) => (m[1] ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
  }
  const getShared = (idxStr) => shared[Number(idxStr)] ?? '';

  // locate first sheet entry
  const tag = (wbXml.match(/<sheet\b[^>]*\/>/g) || [])[0];
  const rid = tag ? (tag.match(/r:id="(rId\d+)"/) || [])[1] : null;
  const rels = strFromU8(files['xl/_rels/workbook.xml.rels']);
  const tgt =
    (rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`)) ||
      rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`)) || [])[1];
  const sheetEntry = /^xl\//.test(tgt) ? tgt : 'xl/' + tgt.replace(/^\//, '');

  const xml = strFromU8(files[sheetEntry]);

  // Collect rows: { n: rowNumber, inner: cell xml }
  const rowRe = /<row r="(\d+)"([^>]*)>([\s\S]*?)<\/row>|<row r="(\d+)"([^>]*)\/>/g;
  const rowList = [];
  let rm;
  while ((rm = rowRe.exec(xml))) {
    rowList.push({ n: parseInt(rm[1], 10), attrs: rm[2] ?? rm[5] ?? '', inner: rm[3] ?? '' });
  }

  // Read a text value from a row's col B (t="s" or inline)
  function lineCodeOf(inner, rowNum) {
    const m = inner.match(new RegExp('<c r="B' + rowNum + '"[^>]*?(?:t="s")?[^>]*>(?:<v>(\\d+)</v>)?', 'i'));
    if (!m) return '';
    if (/t="s"/.test(m[0])) return getShared(m[1] || '');
    return '';
    if (!m) return '';
    if (m[1] === 's') return getShared(m[2]);
    return (m[2] ?? '').trim();
  }

  // Find week title rows by scanning shared strings used in each row
  const weekRows = [];
  for (const row of rowList) {
    {
      const vs = [...row.inner.matchAll(/<c [^>]*t="s"[^>]*><v>(\d+)<\/v>/g)];
      if (vs.some((v) => /Week \d{2}\/\d{2} - \d{2}\/\d{2}/i.test(getShared(v[1])))) {
        weekRows.push(row.n);
      }
    }
  }

  function getRowInner(n) {
    const hit = rowList.find((r) => r.n === n);
    return hit ? hit.inner : null;
  }

  /** Parse a date row: find cells with serial > 40000 → [{colLetter, iso}] */
  function dayColumnsForWeek(w) {
    const dateRowInner = getRowInner(w + 1);
    if (!dateRowInner) return [];
    const cols = [];
    const cm = dateRowInner.matchAll(/<c r="([A-Z]+)\d+"(?:[^>]*)>(?:<v>([\d.]+)<\/v>)?<\/c>/g);
    for (const m of cm) {
      const v = Number(m[2]);
      if (v > 40000) cols.push({ colLetter: m[1], iso: serialToIso(v) });
    }
    return cols;
  }

  function setCellInRow(rowInnerXml, ref, value) {
    const cellRe = new RegExp(`<c r="${ref}"([^>]*?)(?:\s*>)>((?:<f[^>]*>[^<]*</f>)?(?:<v>[^<]*</v>)?(?:<is>.*?</is>)?)</c>`);
    if (cellRe.test(rowInnerXml)) {
      // preserve style attr only; drop t= (we write numeric)
      const m = rowInnerXml.match(cellRe);
      const styleAttr = (m[1].match(/s="\d+"/) || [''])[0];
      return rowInnerXml.replace(cellRe, `<c r="${ref}"${styleAttr ? ' ' + styleAttr : ''}><v>${value}</v></c>`);
    }
    return rowInnerXml + `<c r="${ref}"><v>${value}</v></c>`;
  }

  const patchedRows = new Map();
  let filledCells = 0;

  for (const w of weekRows) {
    const dayCols = dayColumnsForWeek(w);
    if (!dayCols.length) continue;

    const sumFor = (parsed, matcher) => {
      const sums = new Array(32).fill(0);
      let any = false;
      for (const [code, rec] of parsed.lines) {
        if (!matcher.test(code)) continue;
        for (let d = 1; d <= 31; d++) {
          const v = rec.days[d];
          if (v !== null && v !== undefined && Number.isFinite(v)) { sums[d] += v; any = true; }
        }
      }
      return any ? sums : null;
    };
    const sewSum = sumFor(sewParsed, /^(S|T0[23])/);
    const assSum = sumFor(assParsed, /^A(0[1-9]|1[0-8])$/);

    for (let r = w + 3; r <= w + 49; r++) {
      const base = patchedRows.get(r) ?? getRowInner(r);
      if (base === null) continue;
      const lineCode = lineCodeOf(base, r).toUpperCase();
      if (!lineCode) continue;

      let source = null;
      if (/^(S\d|T0[23])/.test(lineCode)) source = sewParsed;
      else if (/^A\d/.test(lineCode)) source = assParsed;

      let newRowXml = base;
      if (source) {
        const rec = source.lines.get(lineCode);
        if (rec) {
          for (const dc of dayCols) {
            const day = Number(dc.iso.slice(8, 10));
            const val = rec.days[day];
            if (val !== null && val !== undefined && Number.isFinite(val)) {
              newRowXml = setCellInRow(newRowXml, dc.colLetter + r, val);
              filledCells++;
            }
          }
        }
      } else if (lineCode === 'SEW' || lineCode === 'ASS') {
        const sums = lineCode === 'SEW' ? sewSum : assSum;
        if (sums) {
          for (const dc of dayCols) {
            const day = Number(dc.iso.slice(8, 10));
            const val = sums[day];
            if (val > 0) {
              newRowXml = setCellInRow(newRowXml, dc.colLetter + r, val);
              filledCells++;
            }
          }
        }
      } else continue;

      if (newRowXml !== base) patchedRows.set(r, newRowXml);
    }
  }

  let outXml = xml;
  for (const [rowNum, inner] of patchedRows) {
    const re = new RegExp(`(<row r="${rowNum}"[^>]*>)[\\s\\S]*?(</row>)`);
    outXml = outXml.replace(re, `$1${inner}$2`);
  }
  files[sheetEntry] = strToU8(outXml);

  return { zip: zipSync(files), filledCells, weeksFound: weekRows.length };
}


/** Detect whether a parsed daily workbook is Sewing (S/T02/T03 lines)
 *  or Assembling (A01–A18 lines). Guards against swapped uploads. */
export function detectKind(parsed) {
  let s = 0, a = 0;
  for (const code of parsed.lines.keys()) {
    if (/^(S\d|T0[23])/.test(code)) s++;
    else if (/^A(0[1-9]|1[0-8])$/.test(code)) a++;
  }
  if (s >= a && s > 0) return 'sew';
  if (a > 0) return 'ass';
  return 'unknown';
}