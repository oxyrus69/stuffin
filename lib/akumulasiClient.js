/**
 * Client-side Akumulasi processor.
 * Fills the weekly accumulation report (akumulasi.xlsx) from daily
 * per-line output files ASS *.XLS (Assembling) and STT *.XLS (Sewing).
 *
 * IMPORTANT: ASS/STT exports are HTML tables (GBK/gb2312) saved with a .XLS
 * extension, but some exports are saved as "Web Page, Complete" (frameset
 * + sheet001.htm) or later re-saved as real .xlsx. We support ALL variants:
 *  - Single-file HTML (STT 24.XLS)
 *  - Frameset HTML (ASS 24.XLS -> needs sheet001.htm, we detect and guide user)
 *  - Real XLSX (ass1.xlsx / stt.xlsx)
 * We parse via HTML table DIRECTLY and via SheetJS (XLSX) as fallback,
 * choosing whichever yields the daily table.
 */

import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import * as XLSX from 'xlsx';

/**
 * Auto-convert any uploaded XLS (HTML single-file or legacy OLE) to a real XLSX buffer.
 * Uses SheetJS to read and re-write. Returns Uint8Array of .xlsx or null if conversion failed
 * (e.g. frameset file where data is in external sheet001.htm).
 * This makes the workflow "all in one place" — users can upload .XLS directly.
 */
export function convertXlsToXlsx(bytes) {
  const b = toBytes(bytes);
  if (!b.length) return null;
  const headHex = Array.from(b.subarray(0, 8)).map((x) => x.toString(16).padStart(2, '0')).join('');
  const isZip = headHex.startsWith('504b');
  if (isZip) return b; // already xlsx
  const text = decodeText(b);
  const isFrameset = /<frameset/i.test(text) && /sheet001\.htm/i.test(text);
  if (isFrameset) return null; // cannot auto-convert, data is external
  try {
    // Try reading as array (covers OLE and HTML)
    let wb;
    try {
      wb = XLSX.read(b, { type: 'array' });
    } catch {
      wb = XLSX.read(text, { type: 'string' });
    }
    if (!wb || !wb.SheetNames?.length) return null;
    // Quick sanity: at least one sheet has a D-column or LineNo header
    let hasData = false;
    for (const sn of wb.SheetNames) {
      const ws = wb.Sheets[sn];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      if (countDColsInAoa(aoa) >= 5) { hasData = true; break; }
      // also check for any non-empty
      if (aoa.length > 5) hasData = true;
    }
    if (!hasData) return null;
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return new Uint8Array(out);
  } catch {
    return null;
  }
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** Serial number -> ISO date string (YYYY-MM-DD) */
function serialToIso(serial) {
  const ms = Math.round((serial - 25569) * 86400000);
  return new Date(ms).toISOString().slice(0, 10);
}

/** Decode HTML entities to a plain string. */
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/** Strip all HTML tags, returning inner text. */
function cellText(html) {
  let t = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ');
  t = t.replace(/<[^>]+>/g, ' ');
  t = decodeEntities(t);
  return t.replace(/\s+/g, ' ').trim();
}

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (input == null) return new Uint8Array(0);
  // Promise guard: if someone forgot await, return empty and let caller diagnose
  if (typeof input === 'object' && typeof input.then === 'function') return new Uint8Array(0);
  try { return new Uint8Array(input); } catch { return new Uint8Array(0); }
}

function decodeText(bytes) {
  if (!bytes || bytes.length === 0) return '';
  let asciiHead = '';
  for (let i = 0; i < Math.min(bytes.length, 2048); i++) asciiHead += String.fromCharCode(bytes[i]);
  const charsetMatch = asciiHead.match(/charset=["']?([\w-]+)/i);
  const declared = (charsetMatch?.[1] || '').toLowerCase();
  const tryDecode = (label) => {
    try { return new TextDecoder(label).decode(bytes); } catch { return null; }
  };
  if (/^gb/i.test(declared)) return tryDecode('gbk') ?? tryDecode('utf-8') ?? '';
  if (declared === 'utf-8' || declared === 'utf8') return tryDecode('utf-8') ?? '';
  // sniff: try utf-8 strict first, else gbk
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return tryDecode('gbk') ?? tryDecode('utf-8') ?? ''; }
}

/**
 * Turn raw bytes of an ASS/STT export into decoded text.
 * They are HTML exports (GBK/gb2312) with a .XLS extension.
 * Kept for backwards compatibility and diagnose.
 */
export function parseWorkbookAny(input) {
  const bytes = toBytes(input);
  if (!bytes.length) return '';
  // If it's a real zip (xlsx), return a marker string that SheetJS can handle
  const headHex = Array.from(bytes.subarray(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('');
  if (headHex.startsWith('504b')) {
    // For binary xlsx we return decoded text via SheetJS later; here return empty to force binary path
    // But keep returning decoded for diagnose compatibility
    return decodeText(bytes);
  }
  return decodeText(bytes);
}

/** Parse an HTML table into an array of rows of cell strings. */
function parseHtmlTable(text) {
  if (!text || typeof text !== 'string') return [];
  const aoa = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  const tables = text.match(tableRe);
  const tbl = tables ? tables.sort((a, b) => b.length - a.length)[0] : text;
  const rowRe = /<tr[\s\S]*?<\/tr>/gi;
  let rowM;
  while ((rowM = rowRe.exec(tbl))) {
    const rowHtml = rowM[0];
    const cells = [];
    const cellRe = /<t[dh][\s\S]*?<\/t[dh]>/gi;
    let cm;
    while ((cm = cellRe.exec(rowHtml))) cells.push(cellText(cm[0]));
    const selfRe = /<t[dh][^>]*\/>/gi;
    let sm;
    while ((sm = selfRe.exec(rowHtml))) cells.push('');
    if (cells.length) aoa.push(cells);
  }
  return aoa;
}

function countDColsInAoa(aoa) {
  if (!aoa || !aoa.length) return 0;
  let best = 0;
  for (let r = 0; r < Math.min(aoa.length, 6); r++) {
    let c = 0;
    for (const cell of aoa[r] || []) {
      if (/(?:^|[^A-Za-z])D(\d{1,2})(?![0-9])/.test(String(cell ?? '').trim())) c++;
    }
    if (c > best) best = c;
  }
  return best;
}

function bytesToAoa(bytes) {
  if (!bytes || bytes.length === 0) return [];
  const headHex = Array.from(bytes.subarray(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
  const isBinary = headHex.startsWith('504b') || headHex.startsWith('d0cf11e0');
  if (isBinary) {
    try {
      const wb = XLSX.read(bytes, { type: 'array', raw: true, cellDates: false });
      // Pick sheet with most D-columns
      let bestAoa = null;
      let bestScore = -1;
      for (const sn of wb.SheetNames) {
        const ws = wb.Sheets[sn];
        if (!ws) continue;
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
        const score = countDColsInAoa(aoa);
        if (score > bestScore) { bestScore = score; bestAoa = aoa; }
      }
      if (bestAoa && bestScore >= 5) return bestAoa;
      if (bestAoa) return bestAoa;
      // fallback to first sheet
      const ws0 = wb.Sheets[wb.SheetNames[0]];
      if (ws0) return XLSX.utils.sheet_to_json(ws0, { header: 1, defval: null, raw: true });
    } catch {}
    return [];
  }
  // Text / HTML path
  const text = decodeText(bytes);
  if (!text) return [];
  // Fast path: HTML table with D-columns
  const aoaHtml = parseHtmlTable(text);
  const htmlScore = countDColsInAoa(aoaHtml);
  if (htmlScore >= 5) return aoaHtml;

  // Try SheetJS on the HTML string (SheetJS can parse HTML workbooks)
  try {
    const wb = XLSX.read(text, { type: 'string', raw: true });
    let bestAoa = null;
    let bestScore = -1;
    for (const sn of wb.SheetNames) {
      const ws = wb.Sheets[sn];
      if (!ws) continue;
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
      const score = countDColsInAoa(aoa);
      if (score > bestScore) { bestScore = score; bestAoa = aoa; }
    }
    if (bestAoa && bestScore >= 5) return bestAoa;
    if (bestAoa && bestAoa.length) return bestAoa;
  } catch {}

  return aoaHtml;
}

/**
 * Parse one ASS/STT file (HTML export or XLSX) into { lines: Map<lineCode, {days, total, label}>, totals }.
 * Accepts Uint8Array, ArrayBuffer, or string (HTML). Deterministic & browser-safe.
 */
export function parseDailyFile(input) {
  let aoa = [];
  if (input instanceof Uint8Array || input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
    aoa = bytesToAoa(toBytes(input));
  } else if (typeof input === 'string') {
    // If string looks like binary zip header decoded, try HTML first then XLSX
    aoa = parseHtmlTable(input);
    if (countDColsInAoa(aoa) < 5) {
      try {
        const wb = XLSX.read(input, { type: 'string', raw: true });
        let best = null, bestScore = -1;
        for (const sn of wb.SheetNames) {
          const ws = wb.Sheets[sn];
          const cand = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
          const s = countDColsInAoa(cand);
          if (s > bestScore) { bestScore = s; best = cand; }
        }
        if (best && bestScore >= 0) aoa = best;
      } catch {}
    }
  } else if (Array.isArray(input)) {
    aoa = input;
  } else if (input && typeof input === 'object' && typeof input.then === 'function') {
    // Received a Promise (forgot await) — return empty so diagnose shows bytesLen 0 cause
    aoa = [];
  }

  const out = new Map();
  let totals = null;
  if (!aoa.length) return { lines: out, totals };

  // Find the header row (first row with >=5 D-columns), search up to 10 rows for xlsx with title rows
  let header = null;
  let hdrIdx = -1;
  let dCols = [];
  for (let h = 0; h < Math.min(aoa.length, 10); h++) {
    const cand = aoa[h] || [];
    const found = [];
    for (let c = 0; c < cand.length; c++) {
      const m = /(?:^|[^A-Za-z])D(\d{1,2})(?![0-9])/.exec(String(cand[c] ?? '').trim());
      if (m) found.push({ day: parseInt(m[1], 10), col: c });
    }
    if (found.length >= 5) {
      header = cand;
      hdrIdx = h;
      dCols = found;
      break;
    }
  }
  if (!dCols.length) return { lines: out, totals };

  for (let i = hdrIdx + 1; i < aoa.length; i++) {
    const row = aoa[i] || [];
    const rawCode = String(row[0] ?? '').trim();
    if (!rawCode) continue;
    // Skip repeated header rows
    if (/^LineNo$/i.test(rawCode)) continue;
    const upper = rawCode.toUpperCase();
    const isTotal = /^(TOTA|TOTAL)$/i.test(upper) || upper === 'TOTAL' || upper.startsWith('TOTAL');
    // Total row: capture totals but don't add as line
    if (isTotal) {
      const days = new Array(32).fill(null);
      for (const { day, col } of dCols) {
        const raw = String(row[col] ?? '').trim();
        if (raw === '') continue;
        const n = Number(raw.replace(/,/g, ''));
        days[day] = Number.isFinite(n) ? n : null;
      }
      totals = days;
      continue;
    }
    // Accept any non-empty line code, but normalize
    const code = upper;
    // Filter to plausible line codes: allow Axx, Sxx, Txx, IPxx, MESIN, etc? Keep all, detectKind will filter later
    // However skip rows where code is numeric only
    if (/^\d+$/.test(code)) continue;
    const days = new Array(32).fill(null);
    for (const { day, col } of dCols) {
      const raw = String(row[col] ?? '').trim();
      if (raw === '') continue;
      // Handle "0.00" and comma separators
      const n = Number(raw.replace(/,/g, ''));
      days[day] = Number.isFinite(n) ? n : null;
    }
    const totalIdx = header.length - 1;
    const rawTotal = String(row[totalIdx] ?? '').trim();
    const total = rawTotal === '' ? null : Number(String(rawTotal).replace(/,/g, '')) || null;
    out.set(code, { days, total, label: String(row[1] ?? '').trim() });
  }
  return { lines: out, totals };
}

/** Detect whether a parsed daily file is Sewing (S/T02/T03) or Assembling (A01–A18). */


/** Rich diagnostics for a single file — used to explain parsing failures to the user. */
export function diagnoseFile(input) {
  const bytes = toBytes(input);
  const facts = { bytesLen: bytes.length };
  let asciiHead = '';
  for (let i = 0; i < Math.min(bytes.length, 2048); i++) asciiHead += String.fromCharCode(bytes[i]);
  facts.charsetMeta = (asciiHead.match(/charset=["']?([\w-]+)/i) || [])[1] || null;
  facts.magicHex = Array.from(bytes.subarray(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join('');
  facts.isZip = facts.magicHex.startsWith('504b');
  facts.isOle = facts.magicHex.startsWith('d0cf11e0');
  const text = bytes.length ? decodeText(bytes) : '';
  facts.hasTable = /<table/i.test(text);
  facts.isFrameset = /<frameset/i.test(text);
  facts.hasSheet001Ref = /sheet001\.htm/i.test(text);
  facts.trCount = (text.match(/<tr[\s\S]*?<\/tr>/gi) || []).length;
  facts.tdCount = (text.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).length;
  // Try both HTML and XLSX aoa
  const aoaHtml = parseHtmlTable(text);
  facts.htmlRowCount = aoaHtml.length;
  facts.htmlDCols = countDColsInAoa(aoaHtml);
  const aoa = bytesToAoa(bytes);
  facts.rowCount = aoa.length;
  facts.dColsInBest = countDColsInAoa(aoa);
  facts.firstRowSample = aoa[0] ? aoa[0].slice(0, 5).map(v => String(v ?? '').slice(0, 50)) : [];
  // SheetJS sheet names if binary or HTML workbook
  try {
    if (bytes.length) {
      if (facts.isZip || facts.isOle) {
        const wb = XLSX.read(bytes, { type: 'array' });
        facts.wbSheets = wb.SheetNames;
        facts.wbSheetRows = wb.SheetNames.map(sn => {
          const ws = wb.Sheets[sn];
          try { return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }).length; } catch { return 0; }
        });
      } else if (text) {
        const wb2 = XLSX.read(text, { type: 'string' });
        if (wb2 && wb2.SheetNames) {
          facts.wbSheetsViaString = wb2.SheetNames;
        }
      }
    }
  } catch (e) {
    facts.wbError = String(e.message).slice(0, 200);
  }
  try {
    const parsed = parseDailyFile(bytes.length ? bytes : text);
    facts.linesRecognized = parsed.lines.size;
    facts.sampleLines = [...parsed.lines.keys()].slice(0, 8);
    if (facts.isFrameset && facts.hasSheet001Ref) {
      facts.hint = 'File ini adalah FRAMESET (Excel disimpan sebagai \"Web Page Complete\"), data tabel berada di folder *_files/sheet001.htm yang tidak terunggah. Buka file di Excel lalu Save As -> Excel Workbook (*.xlsx) dan unggah file .xlsx tersebut.';
    }
  } catch (e) {
    facts.parseError = String(e.message).slice(0, 300);
    facts.linesRecognized = 0;
    facts.sampleLines = [];
  }
  return facts;
}
export function detectKind(parsed) {
  let s = 0;
  let a = 0;
  let ip = 0;
  for (const code of parsed.lines.keys()) {
    if (/^(S\d|T0[23])/i.test(code)) s++;
    else if (/^A(0[1-9]|1[0-8])$/i.test(code)) a++;
    else if (/^IP\d+/i.test(code)) ip++;
  }
  // STT file in references uses IP1..IP10 etc (treated as Sewing)
  // If IP lines dominate, treat as sew as well
  if (s >= a && s > 0) return 'sew';
  if (a > 0) return 'ass';
  if (ip > 0 && s === 0 && a === 0) return 'sew';
  if (ip > s && ip > a) return 'sew';
  if (s > 0 || ip > 0) return 'sew';
  return 'unknown';
}

/**
 * Fill the accumulation report.
 * Pure OOXML zip surgery on the ORIGINAL akumulasi workbook — only the Output cells of
 * the per-line rows in each week block are overwritten; everything else (styles, formulas,
 * merges, shared strings) stays byte-identical. No library rewrite = no repair dialog.
 */
export function fillAkumulasi(xlsxBuf, sewParsed, assParsed) {
  const files = unzipSync(xlsxBuf instanceof Uint8Array ? xlsxBuf : new Uint8Array(xlsxBuf));

  // Shared strings table (cell t="s" -> <v>index</v>)
  let shared = [];
  if (files['xl/sharedStrings.xml']) {
    const ssXml = strFromU8(files['xl/sharedStrings.xml']);
    shared = [...ssXml.matchAll(/<si>(?:<t[^>]*>([\s\S]*?)<\/t>|[\s\S]*?)<\/si>/g)].map(
      (m) => (m[1] ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    );
  }
  const getShared = (idxStr) => shared[Number(idxStr)] ?? '';

  // Locate first sheet entry
  const wbXml = strFromU8(files['xl/workbook.xml']);
  const tag = (wbXml.match(/<sheet\b[^>]*\/>/g) || [])[0];
  const rid = tag ? (tag.match(/r:id="(rId\d+)"/) || [])[1] : null;
  const rels = strFromU8(files['xl/_rels/workbook.xml.rels']);
  const tgt =
    (rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`)) ||
      rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`)) ||
      [])[1];
  const sheetEntry = /^xl\//.test(tgt) ? tgt : 'xl/' + tgt.replace(/^\//, '');
  const xml = strFromU8(files[sheetEntry]);

  // Collect rows
  const rowRe = /<row r="(\d+)"([^>]*)>([\s\S]*?)<\/row>|<row r="(\d+)"([^>]*)\/>/g;
  const rowList = [];
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const rNum = parseInt(rm[1] ?? rm[4], 10);
    if (!Number.isFinite(rNum)) continue;
    rowList.push({ n: rNum, attrs: rm[2] ?? rm[5] ?? '', inner: rm[3] ?? '' });
  }

  // Find week-title rows via shared strings
  const weekRows = [];
  for (const row of rowList) {
    const vs = [...row.inner.matchAll(/<c [^>]*t="s"[^>]*><v>(\d+)<\/v>/g)];
    if (vs.some((v) => /Week \d{2}\/\d{2} - \d{2}\/\d{2}/i.test(getShared(v[1])))) {
      weekRows.push(row.n);
    }
  }

  const getRowInner = (n) => {
    const hit = rowList.find((r) => r.n === n);
    return hit ? hit.inner : null;
  };

  const lineCodeOf = (inner, rowNum) => {
    const m = inner.match(new RegExp('<c r="B' + rowNum + '"[^>]*?(?:t="s")?[^>]*>(?:<v>(\\d+)<\\/v>)?', 'i'));
    if (!m) return '';
    if (/t="s"/.test(m[0])) return getShared(m[1] || '');
    return '';
  };

  const dayColumnsForWeek = (w) => {
    const dateRowInner = getRowInner(w + 1);
    if (!dateRowInner) return [];
    const cols = [];
    const cm = dateRowInner.matchAll(/<c r="([A-Z]+)\d+"([^>]*)>(?:<v>([\d.]+)<\/v>)?<\/c>/g);
    for (const m of cm) {
      const v = Number(m[3]);
      if (v > 40000) cols.push({ colLetter: m[1], iso: serialToIso(v) });
    }
    return cols;
  };

  // Find Total Output column (AB) for a week via header row w+2
  const totalOutputColForWeek = (w) => {
    const hdrInner = getRowInner(w + 2);
    if (!hdrInner) return null;
    // header row uses shared strings: look for "Total Output"
    const cells = [...hdrInner.matchAll(/<c r="([A-Z]+)\d+"[^>]*t="s"[^>]*><v>(\d+)<\/v>/g)];
    for (const m of cells) {
      const col = m[1];
      const idx = Number(m[2]);
      const txt = getShared(String(idx));
      if (txt && txt.trim().toLowerCase() === 'total output') return col;
    }
    // fallback: AB is standard for this template
    return 'AB';
  };

  const setCellInRow = (rowInnerXml, ref, value) => {
    const escRef = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Try self-closing first: <c r="REF" .../>
    const selfRe = new RegExp(`<c r="${escRef}"([^>]*)\\/\\s*>`);
    let m = rowInnerXml.match(selfRe);
    if (m) {
      const sAttr = (m[1].match(/s="\d+"/) || [''])[0];
      const sPart = sAttr ? ` ${sAttr}` : '';
      return rowInnerXml.replace(selfRe, `<c r="${ref}"${sPart}><v>${value}</v></c>`);
    }
    // Normal cell: <c r="REF" ...>...</c>
    const normalRe = new RegExp(`<c r="${escRef}"([^>]*)>([\\s\\S]*?)<\\/c>`);
    m = rowInnerXml.match(normalRe);
    if (m) {
      const sAttr = (m[1].match(/s="\d+"/) || [''])[0];
      const sPart = sAttr ? ` ${sAttr}` : '';
      return rowInnerXml.replace(normalRe, `<c r="${ref}"${sPart}><v>${value}</v></c>`);
    }
    // Not found: insert in correct column order to keep Excel happy
    const colLetters = ref.replace(/\d+$/, '');
    function colNum(col) {
      let n = 0;
      for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
      return n;
    }
    const targetNum = colNum(colLetters);
    const cellTagRe = /<c r="([A-Z]+)\d+"[^>]*\/?>(?:[\s\S]*?<\/c>)?/g;
    let lastIdx = 0;
    let insertAt = -1;
    let match;
    while ((match = cellTagRe.exec(rowInnerXml))) {
      const col = match[1];
      const num = colNum(col);
      if (num > targetNum && insertAt === -1) {
        insertAt = match.index;
        break;
      }
      lastIdx = match.index + match[0].length;
    }
    const newCell = `<c r="${ref}"><v>${value}</v></c>`;
    if (insertAt >= 0) return rowInnerXml.slice(0, insertAt) + newCell + rowInnerXml.slice(insertAt);
    // Append at end but before any trailing whitespace
    return rowInnerXml + newCell;
  };

  const patchedRows = new Map();
  let filledCells = 0;

  for (const w of weekRows) {
    const dayCols = dayColumnsForWeek(w);
    if (!dayCols.length) continue;
    const totalCol = totalOutputColForWeek(w);

    const sumFor = (parsed, matcher) => {
      const sums = new Array(32).fill(0);
      let any = false;
      for (const [code, rec] of parsed.lines) {
        if (!matcher.test(code)) continue;
        for (let d = 1; d <= 31; d++) {
          const v = rec.days[d];
          if (v !== null && v !== undefined && Number.isFinite(v)) {
            sums[d] += v;
            any = true;
          }
        }
      }
      return any ? sums : null;
    };

    const sewSum = sumFor(sewParsed, /^(S|T0[23]|IP)/i);
    const assSum = sumFor(assParsed, /^A(0[1-9]|1[0-8])$/i);

    let sectionSum = 0;
    let hasSectionData = false;
    for (let r = w + 3; r <= w + 49; r++) {
      const base = patchedRows.get(r) ?? getRowInner(r);
      if (base === null) continue;
      const lineCodeRaw = lineCodeOf(base, r);
      const lineCode = lineCodeRaw.toUpperCase().trim();
      if (!lineCode) {
        // Row without line code (e.g. Grand Total) - reset section on empty?
        continue;
      }

      let source = null;
      if (/^(S\d|T0[23]|IP\d)/i.test(lineCode)) source = sewParsed;
      else if (/^A\d/i.test(lineCode)) source = assParsed;

      let newRowXml = base;
      let wroteAnyOutput = false;
      let rowTotal = 0;
      let hasRowTotal = false;
      if (source) {
        const rec = source.lines.get(lineCode);
        if (rec) {
          for (const dc of dayCols) {
            const day = Number(dc.iso.slice(8, 10));
            const val = rec.days[day];
            if (val !== null && val !== undefined && Number.isFinite(val)) {
              newRowXml = setCellInRow(newRowXml, dc.colLetter + r, val);
              filledCells++;
              wroteAnyOutput = true;
              rowTotal += val;
              hasRowTotal = true;
            }
          }
          // Penjumlahan per-hari dari total outputnya: Total Output = sum Output harian dalam minggu itu
          if (hasRowTotal && totalCol) {
            newRowXml = setCellInRow(newRowXml, totalCol + r, rowTotal);
            sectionSum += rowTotal;
            hasSectionData = true;
          } else if (hasRowTotal) {
            sectionSum += rowTotal;
            hasSectionData = true;
          }
        }
      } else if (lineCode === 'SEW' || lineCode === 'ASS') {
        const sums = lineCode === 'SEW' ? sewSum : assSum;
        if (sums) {
          let total = 0;
          for (const dc of dayCols) {
            const day = Number(dc.iso.slice(8, 10));
            const val = sums[day];
            if (val > 0) {
              newRowXml = setCellInRow(newRowXml, dc.colLetter + r, val);
              filledCells++;
              wroteAnyOutput = true;
              total += val;
            }
          }
          if (wroteAnyOutput && totalCol) {
            newRowXml = setCellInRow(newRowXml, totalCol + r, total);
            sectionSum += total;
            hasSectionData = true;
          }
        }
      } else if (lineCode.includes('SUB TOTAL')) {
        // Sub Total = sum of section's Total Outputs
        if (hasSectionData && totalCol) {
          newRowXml = setCellInRow(newRowXml, totalCol + r, sectionSum);
          // Also update C (Output) column for Sub Total if needed? Keep formula, but update Total
        }
        // Reset for next section
        sectionSum = 0;
        hasSectionData = false;
      } else if (lineCode.includes('GRAND TOTAL')) {
        // Grand Total will be recalc via fullCalcOnLoad; skip manual
        sectionSum = 0;
        hasSectionData = false;
        continue;
      } else {
        // Unknown line (e.g. jit, selisih) - reset section?
        // Keep sectionSum for Sub Total grouping
        continue;
      }

      if (newRowXml !== base) patchedRows.set(r, newRowXml);
    }
  }

  let outXml = xml;
  for (const [rowNum, inner] of patchedRows) {
    const re = new RegExp(`(<row r="${rowNum}"[^>]*>)[\\s\\S]*?(</row>)`);
    outXml = outXml.replace(re, `$1${inner}$2`);
  }
  files[sheetEntry] = strToU8(outXml);

  // Force Excel to recalc all formulas on open (so Total Output etc. tidak 0)
  try {
    const wbKey = 'xl/workbook.xml';
    if (files[wbKey]) {
      let wbXml2 = strFromU8(files[wbKey]);
      if (!/fullCalcOnLoad/i.test(wbXml2)) {
        if (/<calcPr/i.test(wbXml2)) {
          wbXml2 = wbXml2.replace(/<calcPr[^>]*\/?>/, '<calcPr calcMode="auto" fullCalcOnLoad="1"/>');
        } else if (/<workbookPr/i.test(wbXml2)) {
          wbXml2 = wbXml2.replace(/(<workbookPr[^>]*\/?>)/, '$1<calcPr calcMode="auto" fullCalcOnLoad="1"/>');
        } else if (/<bookViews/i.test(wbXml2)) {
          wbXml2 = wbXml2.replace(/(<bookViews[\s\S]*?<\/bookViews>)/, '$1<calcPr calcMode="auto" fullCalcOnLoad="1"/>');
        }
        files[wbKey] = strToU8(wbXml2);
      }
    }
  } catch {}

  return { zip: zipSync(files), filledCells, weeksFound: weekRows.length };
}
