/**
 * Client-side BLC processor.
 * Runs entirely in the browser — files never leave the user's device,
 * so Vercel's request body limit (413 on uploads > ±4.5MB) does not apply.
 *
 * Logic mirrors the original server route:
 *   1. Parse every JIT workbook (real xlsx/xls OR GBK-encoded HTML export).
 *   2. Keep orders whose OrdNo contains "NB" AND starts with "U"
 *      (e.g. U07NB0001). PU…/other prefixes are discarded.
 *      Duplicate OrdNo across files: earliest-uploaded file wins;
 *      duplicates within one file also collapse to their first row.
 *   3. Period priority: sheet cell "YYYY M" -> HTML banner -> filename
 *      MMYY.XLS -> current month.
 *   4. Output layout mirrors "BLC HDU 8.22 PAGI.xlsx":
 *      row1 title · row3 period below the title · row4 count (data+5)
 *      row5 header · row6+ data — with fonts, borders, merges and
 *      column widths.
 *
 * CORRUPTION NOTE: rich formatting is applied via surgical OOXML edits
 * (replace only the Blc worksheet part + append style records). We
 * deliberately do NOT round-trip the whole Stuffing workbook through a
 * second library (e.g. ExcelJS): that rewrote defined names and
 * formulas of untouched sheets and made Excel show the repair dialog.
 */
import * as XLSX from 'xlsx';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

/* ─── generic helpers ─── */

function norm(s) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function isBlank(v) {
  return v === null || v === undefined || String(v).trim() === '';
}

function findHeaderRow(aoa, keys) {
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const cells = (aoa[i] || []).map(norm);
    if (keys.every((k) => cells.some((c) => c.includes(k)))) return i;
  }
  return -1;
}

/** Parse workbook bytes; handles binary spreadsheets and GBK/HTML exports. */
export function parseWorkbookBuffer(input) {
  const bytes =
    input instanceof Uint8Array ? input : new Uint8Array(input ?? new ArrayBuffer(0));

  const head = Array.from(bytes.subarray(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const isBinary = head.startsWith('504b') /* PK   = xlsx */ ||
    head.startsWith('d0cf11e0') /* OLE2 = legacy xls */;
  if (isBinary) return { wb: XLSX.read(bytes, { type: 'array' }), textPeriod: null };

  // Text/HTML export: pick charset from meta tag, else sniff
  let asciiHead = '';
  for (let i = 0; i < Math.min(bytes.length, 2048); i++) asciiHead += String.fromCharCode(bytes[i]);
  const charsetMatch = asciiHead.match(/charset=["']?([\w-]+)/i);
  let text;
  const declared = (charsetMatch?.[1] || '').toLowerCase();
  if (/^gb/i.test(declared)) {
    text = new TextDecoder('gbk').decode(bytes);
  } else if (declared === 'utf-8' || declared === 'utf8') {
    text = new TextDecoder('utf-8').decode(bytes);
  } else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder('gbk').decode(bytes); // Chinese default
    }
  }

  // Period banner, e.g. <h6 align=center> 2026 7</h6>
  const pm = text.match(/<h[1-6][^>]*>\s*(\d{4})\s+(\d{1,2})\s*</i);
  const textPeriod = pm ? `${pm[1]} ${Number(pm[2])}` : null;

  return { wb: XLSX.read(text, { type: 'string' }), textPeriod };
}

/** Extract data rows from one JIT workbook. Returns {header, rows, sheetName, period} or null. */
function extractJitRows(workbook) {
  for (const sn of workbook.SheetNames) {
    const ws = workbook.Sheets[sn];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    const hdrIdx = findHeaderRow(aoa, ['ordno', 'styleno']);
    if (hdrIdx < 0) continue;

    // In-file period cell like "2026 7" above the header
    let period = null;
    for (let i = 0; i < hdrIdx && !period; i++) {
      for (const cell of aoa[i] || []) {
        const m = String(cell ?? '').trim().match(/^(\d{4})\s+(\d{1,2})$/);
        if (m) { period = `${m[1]} ${Number(m[2])}`; break; }
      }
    }

    const header = aoa[hdrIdx].map((h) => (isBlank(h) ? '' : String(h).trim()));
    const width = Math.max(header.length, ...aoa.slice(hdrIdx + 1).map((r) => (r ? r.length : 0)));
    const rows = [];
    for (let i = hdrIdx + 1; i < aoa.length; i++) {
      const row = aoa[i] || [];
      if (row.every(isBlank)) continue;
      if (typeof row[0] === 'string' && /^ordno/i.test(norm(row[0]))) continue;
      rows.push(Array.from({ length: width }, (_, j) => row[j] ?? null));
    }
    if (rows.length > 0) return { header, rows, sheetName: sn, period };
  }
  return null;
}

/* ─── OOXML surgery helpers ─── */

function colLetter(zeroBased) {
  let n = zeroBased + 1;
  let s = '';
  while (n > 0) {
    n -= 1;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

function escXml(s) {
  return String(s)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Build the fully-styled worksheet XML for the BLC table (inline strings, own style ids). */
function buildBlcSheetXml({ header, rows, period, totalRowCount, widths, styleBase }) {
  const lastCol = Math.max(header.length, 1);
  const lastRow = 5 + rows.length;
  const lastColL = colLetter(lastCol - 1);

  const sTitle = styleBase;
  const sPeriod = styleBase + 1;
  const sHeader = styleBase + 2;
  const sData = styleBase + 3;

  const cellXml = (v, r, c, si) => {
    const ref = `${colLetter(c)}${r}`;
    if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${si}"/>`;
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${si}"><v>${v}</v></c>`;
    if (typeof v === 'boolean') return `<c r="${ref}" s="${si}" t="b"><v>${v ? 1 : 0}</v></c>`;
    return `<c r="${ref}" s="${si}" t="inlineStr"><is><t xml:space="preserve">${escXml(v)}</t></is></c>`;
  };

  const parts = [];
  parts.push(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`,
    `<dimension ref="A1:${lastColL}${lastRow}"/>`,
    `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`,
    `<sheetFormatPr defaultRowHeight="15"/>`
  );

  parts.push('<cols>');
  widths.forEach((w, j) => {
    parts.push(`<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`);
  });
  parts.push('</cols>');

  parts.push('<sheetData>');

  // Row 1 — title
  parts.push(`<row r="1" ht="34" customHeight="1">`);
  for (let c = 0; c < lastCol; c++) parts.push(cellXml(c === 0 ? 'Production Report By Order' : null, 1, c, sTitle));
  parts.push('</row>');
  // Row 2 — intentionally blank spacer (keep grid consistent)
  parts.push(`<row r="2"/>`);
  // Row 3 — year & month right below the title
  parts.push(`<row r="3">`);
  for (let c = 0; c < lastCol; c++) parts.push(cellXml(c === 0 ? period : null, 3, c, sPeriod));
  parts.push('</row>');
  // Row 4 — legacy total row count (data + 5)
  parts.push(`<row r="4">`);
  for (let c = 0; c < lastCol; c++) parts.push(cellXml(c === 0 ? totalRowCount : null, 4, c, sPeriod));
  parts.push('</row>');
  // Row 5 — header
  parts.push(`<row r="5" ht="18" customHeight="1">`);
  header.forEach((h, c) => parts.push(cellXml(isBlank(h) ? null : String(h), 5, c, sHeader)));
  parts.push('</row>');
  // Data rows
  rows.forEach((dataRow, i) => {
    const r = i + 6;
    parts.push(`<row r="${r}">`);
    for (let c = 0; c < lastCol; c++) parts.push(cellXml(dataRow[c] ?? null, r, c, sData));
    parts.push('</row>');
  });

  parts.push('</sheetData>');

  if (lastCol > 1) {
    parts.push(
      `<mergeCells count="2">`,
      `<mergeCell ref="A1:${lastColL}1"/>`,
      `<mergeCell ref="A3:${lastColL}3"/>`,
      `</mergeCells>`
    );
  }

  parts.push('</worksheet>');
  return parts.join('');
}

/** Append our font/border/cellXfs records to a styles.xml; returns {xml, baseXf}. */
function patchStylesXml(xml) {
  const fontsAdd =
    `<font><sz val="24"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>` +
    `<font><b/><sz val="12"/><color rgb="FF1F4E79"/><name val="Calibri"/><family val="2"/></font>` +
    `<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>`;
  const borderAdd =
    `<border>` +
    `<left style="thin"><color rgb="FF7F7F7F"/></left>` +
    `<right style="thin"><color rgb="FF7F7F7F"/></right>` +
    `<top style="thin"><color rgb="FF7F7F7F"/></top>` +
    `<bottom style="thin"><color rgb="FF7F7F7F"/></bottom>` +
    `<diagonal/></border>`;

  let xmlOut = xml;
  const fontCount = Number((xml.match(/<fonts count="(\d+)"/) || [])[1] ?? 0);
  const borderCount = Number((xml.match(/<borders count="(\d+)"/) || [])[1] ?? 0);
  const xfCount = Number((xml.match(/<cellXfs count="(\d+)"/) || [])[1] ?? 0);

  xmlOut = xmlOut.replace(/<fonts count="\d+"/, `<fonts count="${fontCount + 3}"`);
  xmlOut = xmlOut.replace('</fonts>', fontsAdd + '</fonts>');
  xmlOut = xmlOut.replace(/<borders count="\d+"/, `<borders count="${borderCount + 1}"`);
  xmlOut = xmlOut.replace('</borders>', borderAdd + '</borders>');

  const fTitle = fontCount;
  const fBlue = fontCount + 1;
  const fBold = fontCount + 2;
  const bThin = borderCount;
  const xfsAdd =
    `<xf numFmtId="0" fontId="${fTitle}" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
    `<xf numFmtId="0" fontId="${fBlue}" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
    `<xf numFmtId="0" fontId="${fBold}" fillId="0" borderId="${bThin}" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="${bThin}" xfId="0" applyBorder="1"/>`;

  xmlOut = xmlOut.replace(/<cellXfs count="\d+"/, `<cellXfs count="${xfCount + 4}"`);
  xmlOut = xmlOut.replace('</cellXfs>', xfsAdd + '</cellXfs>');

  return { xml: xmlOut, baseXf: xfCount };
}

/** Resolve the zip entry name of a worksheet, given the workbook's sheet name. */
function findSheetEntry(files, sheetName) {
  const wbXml = strFromU8(files['xl/workbook.xml']);
  const m = wbXml.match(new RegExp(`<sheet[^>]*name="${sheetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*r:id="(rid\\d+)"`, 'i')) ||
    wbXml.match(new RegExp(`<sheet[^>]*r:id="(rid\\d+)"[^>]*name="${sheetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i'));
  if (!m) throw new Error(`Sheet "${sheetName}" tidak ditemukan di workbook.`);
  const rid = m[1];
  const relsXml = strFromU8(files['xl/_rels/workbook.xml.rels']);
  const rm = relsXml.match(new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"`, 'i')) ||
    relsXml.match(new RegExp(`<Relationship[^>]*Target="([^"]+)"[^>]*Id="${rid}"`, 'i'));
  if (!rm) throw new Error(`Relationship untuk sheet "${sheetName}" tidak ditemukan.`);
  let target = rm[1].replace(/^\//, '');
  if (!target.startsWith('xl/')) target = 'xl/' + target;
  return target;
}

/** Unescape an XML-encoded sheet reference prefix (e.g. &apos;NB (2)&apos;). */
function unescapeSheetRef(s) {
  return String(s ?? '')
    .trim()
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/^'/, '')
    .replace(/'$/, '');
}

/** Normalize the _FilterDatabase defined names after sheet reordering:
 *  SheetJS may leave BOTH stale entries (old localSheetId) and rewritten
 *  ones, producing duplicate built-in names that make Excel repair the
 *  file. We keep exactly one entry per existing sheet, with the
 *  localSheetId matching the sheet's position in the new order. */
function normalizeFilterDatabase(wbXml, orderedSheetNames) {
  const dnMatch = wbXml.match(/<definedNames>([\s\S]*?)<\/definedNames>/);
  if (!dnMatch) return wbXml;

  const unescapeXml = (s) =>
    s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  const items = [...dnMatch[1].matchAll(/<definedName[^>]*name="_xlnm\._FilterDatabase"[^>]*>[^<]*<\/definedName>/g)].map((m) => m[0]);
  const others = dnMatch[1].replace(
    /<definedName[^>]*name="_xlnm\._FilterDatabase"[^>]*>[^<]*<\/definedName>/g,
    ''
  );

  // Target sheet = prefix before the first "!" of the formula text
  const bySheet = new Map();
  for (const item of items) {
    const body = item.replace(/^<definedName[^>]*>/, '').replace(/<\/definedName>$/, '');
    const sheetRef = unescapeXml(body).split('!')[0].replace(/^'/, '').replace(/'$/, '').trim();
    const key = sheetRef.toLowerCase();
    if (!bySheet.has(key)) bySheet.set(key, body); // first wins
  }

  // Rebuild: one entry per sheet that still exists, in new sheet order
  const rebuilt = [];
  orderedSheetNames.forEach((name, idx) => {
    const key = name.toLowerCase();
    if (bySheet.has(key)) {
      const safe = name.includes(' ') || /[-()]/.test(name) ? `'${name}'` : name;
      const bodyEsc = `${safe}!${unescapeXml(bySheet.get(key)).split('!').slice(1).join('!')}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      rebuilt.push(`<definedName name="_xlnm._FilterDatabase" localSheetId="${idx}" hidden="1">${bodyEsc}</definedName>`);
    }
  });

  const newBlock = rebuilt.length
    ? `<definedNames>${others}${rebuilt.join('')}</definedNames>`
    : others.trim()
      ? `<definedNames>${others}</definedNames>`
      : '';
  return wbXml.replace(/<definedNames>[\s\S]*?<\/definedNames>/, newBlock);
}

/** Locate a <sheet> tag by name (case-insensitive) in workbook XML. */
function refindSheetTag(wbXml, sheetNameLower) {
  return (wbXml.match(/<sheet\b[^>]*\/>/g) || []).find(
    (t) => new RegExp(`name="${sheetNameLower}"`, 'i').test(t)
  );
}

/** Final fix-ups on workbook.xml after Blc replacement + reordering:
 *  - point the _FilterDatabase entry for Blc at its new range
 *  - re-map localSheetId of every sheet-scoped defined name to the
 *    position of the sheet it references in the NEW order
 *  (formula-valued names like Final = IF(...) are left untouched). */
function finalizeWorkbookXml(wbXml, mergedHeader, rows) {
  const lastColL = colLetter(Math.max(mergedHeader.length, 1) - 1);
  const lastRow = 5 + rows.length;

  // Refresh the Blc filter database range if present
  wbXml = wbXml.replace(
    /(<definedName[^>]*name="_xlnm\._FilterDatabase"[^>]*localSheetId="\d+"[^>]*>)[^<]*Blc![^<]*(<\/definedName>)/i,
    (m, p1, p2) => `${p1}Blc!$A$5:$${lastColL}$${lastRow}${p2}`
  );

  // Sheet order as written in the manifest
  const orderedNames = (wbXml.match(/<sheet\b[^>]*\/>/g) || []).map((t) => {
    const m = t.match(/name="([^"]+)"/);
    return m ? m[1].replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '';
  });
  const pos = new Map(orderedNames.map((n, i) => [n.toLowerCase(), i]));

  // Re-map every sheet-scoped defined name whose body is a sheet reference
  wbXml = wbXml.replace(
    /(<definedName name="[^"]+" localSheetId=")(\d+)("[^>]*>)([^<]*)(<\/definedName>)/g,
    (full, pre, idStr, mid, body, post) => {
      if (!/^[&']?[A-Za-z_\u0080-\uffff]/.test(body) || /^[A-Za-z_]+\(/.test(body)) return full;
      if (!body.includes('!')) return full;
      const target = unescapeSheetRef(body.split('!')[0]);
      const p = pos.get(target.toLowerCase());
      if (p === undefined || String(p) === idStr) return full;
      return `${pre}${p}${mid}${body}${post}`;
    }
  );

  return wbXml;
}


/** Build a complete single-sheet xlsx zip from scratch (fflate only).
 *  We avoid XLSX.write here: in webpack production bundles SheetJS's
 *  write path can crash ("null.indexOf") due to a module-init guard
 *  (var sY = 438==r.j ? [...] : null). Our own zip is tiny and safe. */
function buildStandaloneBlcZip({ sheetName, header, rows, period, totalRowCount }) {
  const widths = header.map((h, j) => {
    let maxLen = String(h ?? '').length;
    for (const row of rows) {
      const v = row[j];
      if (v !== null && v !== undefined && String(v).length > maxLen) maxLen = String(v).length;
    }
    return Math.min(Math.max(maxLen + 2, 8), 40);
  });

  const patched = patchStylesXml(BASE_STYLES_XML);
  const sheetXml = buildBlcSheetXml({
    header, rows, period, totalRowCount, widths, styleBase: patched.baseXf,
  });

  const lastColL = colLetter(Math.max(header.length, 1) - 1);
  const safeName = sheetName.replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31);

  const files = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `</Types>`
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets><sheet name="${escXml(safeName)}" sheetId="1" r:id="rId1"/></sheets>` +
      `</workbook>`
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`
    ),
    'xl/styles.xml': strToU8(patched.xml),
    'xl/worksheets/sheet1.xml': strToU8(sheetXml),
  };
  return { zip: zipSync(files), lastColL, lastRow: 5 + rows.length };
}

/** Minimal valid styles.xml used as the base for standalone BLC files. */
const BASE_STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/**
 * Apply rich BLC formatting inside an xlsx zip WITHOUT rewriting any
 * other part: replaces only the target sheet's XML and appends style
 * records. Everything else (formulas, defined names, other sheets)
 * stays exactly as written by the first pass.
 */
function styleSheetInZip(xlsxBuf, { sheetName, header, rows, period, totalRowCount }) {
  const files = unzipSync(
    xlsxBuf instanceof Uint8Array ? xlsxBuf : new Uint8Array(xlsxBuf)
  );

  // Auto-fit column widths (clamped)
  const widths = header.map((h, j) => {
    let maxLen = String(h ?? '').length;
    for (const row of rows) {
      const v = row[j];
      if (v !== null && v !== undefined) {
        const l = String(v).length;
        if (l > maxLen) maxLen = l;
      }
    }
    return Math.min(Math.max(maxLen + 2, 8), 40);
  });

  // 1) patch styles first to learn our base xf index
  const stylesKey = 'xl/styles.xml';
  if (!files[stylesKey]) throw new Error('styles.xml tidak ditemukan.');
  const patched = patchStylesXml(strFromU8(files[stylesKey]));
  files[stylesKey] = strToU8(patched.xml);

  // 2) replace only the target worksheet part
  const entry = findSheetEntry(files, sheetName);
  const lastColL = colLetter(Math.max(header.length, 1) - 1);
  const sheetXml = buildBlcSheetXml({
    header, rows, period, totalRowCount, widths, styleBase: patched.baseXf,
  });
  files[entry] = strToU8(sheetXml);

  // 3) normalize _FilterDatabase defined names (dedupe + fix localSheetId
  //    after sheet reordering) so Excel doesn't flag the workbook
  const wbKey = 'xl/workbook.xml';
  let wbXml = strFromU8(files[wbKey]);
  const lastRow = 5 + rows.length;
  wbXml = wbXml.replace(
    /(<definedName[^>]*>)[^<]*Blc!\$A\$5:\$[A-Z]+\$?\d*(<\/definedName>)/,
    (m, p1, p2) => `${p1}Blc!$A$5:$${lastColL}$${lastRow}${p2}`
  );
  const orderMatch = wbXml.match(/<sheet [^>]*name="([^"]+)"[^>]*\/>/g) || [];
  const orderedNames = orderMatch.map((s) => {
    const m = s.match(/name="([^"]+)"/);
    return m ? m[1].replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '';
  });
  wbXml = normalizeFilterDatabase(wbXml, orderedNames);
  // Re-point EVERY sheet-scoped defined name (Print_Area etc.) at the
  // position its target sheet now occupies — SheetJS only fixed some of
  // them after reordering, and stale localSheetIds trigger Excel repair.
  const pos = new Map(orderedNames.map((n, i) => [n.toLowerCase(), i]));
  wbXml = wbXml.replace(
    /(<definedName name="[^"]+" localSheetId=")(\d+)("[^>]*>)([^<]*)(<\/definedName>)/g,
    (full, pre, idStr, mid, body, post) => {
      // Only rewrite when the body actually starts with a sheet reference
      // (skip formula names like Final = IF(ChosenSzRng=..., ...))
      if (!/^[&']?[A-Za-z_\x80-\uffff]/.test(body) || /^[A-Za-z_]+\(/.test(body)) return full;
      const target = unescapeSheetRef(body.split('!')[0]);
      if (!target || !/[!]/.test(body)) return full;
      const p = pos.get(target.toLowerCase());
      if (p === undefined || String(p) === idStr) return full;
      return `${pre}${p}${mid}${body}${post}`;
    }
  );
  files[wbKey] = strToU8(wbXml);

  return zipSync(files);
}

/* ─── main entry ───
   jitFiles / stuffingFile: { name, bytes: Uint8Array }
   Returns { data: ArrayBuffer, filename, report }. */
export async function processBlc({ jitFiles = [], stuffingFile = null, onProgress = () => {} }) {
  const warnings = [];

  if (jitFiles.length === 0) throw new Error('Minimal 1 file "Data JIT" wajib diunggah.');

  onProgress('Membaca file JIT...');
  let mergedHeader = null;
  const rows = [];
  const seenOrdNo = new Set();
  const extractedPeriods = [];

  for (const file of jitFiles) {
    let wb;
    let textPeriod = null;
    try {
      const parsed = parseWorkbookBuffer(file.bytes);
      wb = parsed.wb;
      textPeriod = parsed.textPeriod;
    } catch (e) {
      const msg = /password/i.test(e.message)
        ? `File "${file.name}" TERENKRIPSI (dilindungi password Excel). Buka di Excel → Save As → .xlsx tanpa proteksi, lalu unggah ulang.`
        : `File "${file.name}" gagal dibaca (${e.message}) — dilewati.`;
      warnings.push(msg);
      continue;
    }

    let extracted;
    try {
      extracted = extractJitRows(wb);
    } catch (e) {
      warnings.push(`File "${file.name}" gagal dipilah (${e.message}) — dilewati.`);
      continue;
    }
    if (!extracted) {
      warnings.push(`File "${file.name}": tabel produksi (header OrdNo/StyleNo) tidak ditemukan — dilewati.`);
      continue;
    }
    if (!Array.isArray(extracted.header) || extracted.header.length === 0) {
      warnings.push(`File "${file.name}": header kolom kosong — dilewati.`);
      continue;
    }

    // Period priority: sheet cell -> HTML banner -> filename MMYY.XLS
    let filePeriod = extracted.period || textPeriod;
    if (!filePeriod) {
      const fm = String(file.name || '').match(/(\d{2})(\d{2})\.(xlsx|xls)$/i);
      if (fm) {
        filePeriod = `${2000 + Number(fm[2])} ${Number(fm[1])}`;
        warnings.push(`"${file.name}": periode "${filePeriod}" diambil dari nama file.`);
      }
    }
    extractedPeriods.push(filePeriod);

    if (!mergedHeader) mergedHeader = extracted.header.slice();

    // Align columns by header name across differently-structured files
    let colMap = null;
    if (
      !mergedHeader ||
      extracted.header.length !== mergedHeader.length ||
      extracted.header.some((h, i) => h !== mergedHeader[i])
    ) {
      if (!mergedHeader) mergedHeader = extracted.header.slice();
      colMap = extracted.header.map((h) => {
        const idx = mergedHeader.indexOf(h);
        if (idx >= 0) return idx;
        mergedHeader.push(h);
        return mergedHeader.length - 1;
      });
    }

    const ordColSrc = extracted.header.findIndex((h) => norm(h) === 'ordno');
    // Keep orders matching the NB factory scheme: "U" + 2-digit code + "N"
    // (U07NB0001, U07N2052, U08NB…, U09NB…). BC line (U07BC2171) and other
    // product lines (PU07…, PDU07…, UV07CR…) are discarded.
    const isNbOrder = (ordNo) => /^U\d{2}N/i.test(ordNo);
    let keptRows = 0;
    for (const srcRow of extracted.rows) {
      const ordNo = ordColSrc >= 0 ? String(srcRow[ordColSrc] ?? '').trim() : '';
      if (isNbOrder(ordNo)) {
        if (seenOrdNo.has(ordNo)) continue;
        const aligned = new Array(mergedHeader.length).fill(null);
        if (colMap) {
          srcRow.forEach((v, i) => { if (colMap[i] >= 0) aligned[colMap[i]] = v; });
        } else {
          for (let j = 0; j < srcRow.length && j < aligned.length; j++) aligned[j] = srcRow[j];
        }
        seenOrdNo.add(ordNo);
        rows.push(aligned);
        keptRows++;
      }
    }
    warnings.push(`"${file.name}" (${extracted.sheetName}): ${keptRows} baris NB diambil.`);
  }

  if (!mergedHeader || rows.length === 0) {
    throw new Error(
      'Tidak ada baris order NB yang bisa diekstrak. Pastikan file JIT berisi laporan produksi ' +
      'dengan kolom OrdNo & StyleNo, dan OrdNo order NB diawali huruf "U" (contoh U07NB0001). ' +
      (warnings.length ? `Detail: ${warnings.join(' | ')}` : '')
    );
  }

  /* Sort: U07 → U08 → U09 → U10 → U11 → U12 → U01 → U02 → U03 → U04 → U05 → U06.
     Start at U07 as requested; stable sort keeps original JIT order within each group. */
  const ordColMerged = mergedHeader.findIndex((h) => norm(h) === 'ordno');
  const CODE_ORDER = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
  const CODE_RANK = new Map(CODE_ORDER.map((c, idx) => [c, idx]));
  const rankOf = (code) => (CODE_RANK.has(code) ? CODE_RANK.get(code) : 100 + code);
  const codeOf = (row) => {
    if (ordColMerged < 0) return -1;
    const mm = String(row[ordColMerged] ?? '').trim().match(/^U(\d{2})/i);
    return mm ? parseInt(mm[1], 10) : -1;
  };
  rows.map((row, i) => ({ row, i, rank: rankOf(codeOf(row)) }))
    .sort((a, b) => (a.rank - b.rank) || (a.i - b.i))
    .forEach((e, idx) => { rows[idx] = e.row; });

  const now = new Date();
  const fallbackPeriod = `${now.getFullYear()} ${now.getMonth() + 1}`;
  let period = extractedPeriods.find(Boolean) || null;
  if (!period) {
    period = fallbackPeriod;
    warnings.push(`Periode tidak ditemukan di file JIT — memakai bulan berjalan "${fallbackPeriod}".`);
  }
  const totalRowCount = rows.length + 5;
  const styleMeta = { header: mergedHeader, rows, period, totalRowCount };

  /* ─── STEP 4: assemble output ───
     Stuffing mode: work DIRECTLY on the original zip. Only the Blc
     worksheet part is replaced (formatted XML), style records are
     appended, and the <sheets> manifest is reordered. External links,
     calc chain, shared strings, drawings, printer settings and every
     other sheet stay byte-identical — Excel has nothing to repair.
     (Rewriting the workbook through SheetJS dropped externalLink parts
     while keeping [1]-style references to them, which triggered the
     "Removed Records: Named range / Formula" repair dialog.) */
  onProgress(stuffingFile ? 'Menyusun sheet Blc...' : 'Memformat file BLC...');
  let stagedBuf;
  let sheetName;
  let filename;
  let mode;

  if (stuffingFile) {
    let origFiles;
    try {
      origFiles = unzipSync(
        stuffingFile.bytes instanceof Uint8Array
          ? stuffingFile.bytes
          : new Uint8Array(stuffingFile.bytes)
      );
    } catch (e) {
      const head = Array.from(
        (stuffingFile.bytes instanceof Uint8Array ? stuffingFile.bytes : new Uint8Array(stuffingFile.bytes)).subarray(0, 8)
      ).map((b) => b.toString(16).padStart(2, '0')).join('');
      if (head.startsWith('d0cf11e0')) {
        throw new Error(
          'File Stuffing List ini tersimpan dalam format TERENKRIPSI (Excel dengan password). ' +
          'Buka file di Excel, lalu Save As kembali ke .xlsx tanpa proteksi password, dan unggah ulang.'
        );
      }
      throw new Error(`File Stuffing List bukan .xlsx yang valid (${e.message}).`);
    }
    const wbXml0 = strFromU8(origFiles['xl/workbook.xml']);
    const relsXml0 = strFromU8(origFiles['xl/_rels/workbook.xml.rels']);

    let blcTag = wbXml0.match(/<sheet\b[^>]*name="Blc"[^>]*\/>/i);
    if (blcTag) blcTag = blcTag[0];
    if (!blcTag) {
      blcTag = (wbXml0.match(/<sheet\b[^>]*\/>/g) || []).find((t) => /name="Blc"/i.test(t));
    }
    const rid = blcTag ? (blcTag.match(/r:id="(rId\d+)"/) || [])[1] : null;
    if (!rid) throw new Error('Sheet "Blc" tidak ditemukan di Stuffing List.');
    const tgt =
      (relsXml0.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`)) ||
        relsXml0.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`)) || [])[1];
    if (!tgt) throw new Error('Relationship sheet "Blc" tidak ditemukan.');
    const blcEntry = /^xl\//.test(tgt) ? tgt : 'xl/' + tgt.replace(/^\//, '');

    // 1) styles: append our records (baseXf = count before append)
    const patched = patchStylesXml(strFromU8(origFiles['xl/styles.xml']));
    origFiles['xl/styles.xml'] = strToU8(patched.xml);

    // 2) replace ONLY the Blc worksheet part with formatted XML
    const widths = mergedHeader.map((h, j) => {
      let maxLen = String(h ?? '').length;
      for (const row of rows) {
        const v = row[j];
        if (v !== null && v !== undefined && String(v).length > maxLen) maxLen = String(v).length;
      }
      return Math.min(Math.max(maxLen + 2, 8), 40);
    });
    origFiles[blcEntry] = strToU8(
      buildBlcSheetXml({ header: mergedHeader, rows, period, totalRowCount, widths, styleBase: patched.baseXf })
    );

    // 3) reorder the <sheets> manifest: Blc moves right after 'NB ORDER'
    let wbXml = wbXml0;
    const sheetTags = wbXml.match(/<sheet\b[^>]*\/>/g) || [];
    const blcIdx = sheetTags.findIndex((t) => /name="Blc"/i.test(t));
    const nbIdx = sheetTags.findIndex((t) => /name="NB ORDER"/i.test(t));
    if (blcIdx >= 0 && nbIdx >= 0) {
      const [moved] = sheetTags.splice(blcIdx, 1);
      const nbPos = sheetTags.findIndex((t) => /name="NB ORDER"/i.test(t));
      sheetTags.splice(nbPos + 1, 0, moved);
      wbXml = wbXml.replace(/<sheets>[\s\S]*?<\/sheets>/, `<sheets>${sheetTags.join('')}</sheets>`);
    }

    // 4) fix defined-name sheet indexes + Blc filter range for the new order
    wbXml = finalizeWorkbookXml(wbXml, mergedHeader, rows);
    // Ensure calc will recalc on open after Blc replacement
    if (!/fullCalcOnLoad/i.test(wbXml)) {
      if (/<calcPr/i.test(wbXml)) {
        wbXml = wbXml.replace(/<calcPr[^>]*\/?>/, '<calcPr calcMode="auto" fullCalcOnLoad="1"/>');
      } else if (/<workbookPr/i.test(wbXml)) {
        wbXml = wbXml.replace(/(<workbookPr[^>]*\/?>)/, '$1<calcPr calcMode="auto" fullCalcOnLoad="1"/>');
      }
    }
    origFiles['xl/workbook.xml'] = strToU8(wbXml);

    // 5) hapus calcChain usang (referensi ke sel Blc lama) agar tidak corrupt
    if (origFiles['xl/calcChain.xml']) {
      delete origFiles['xl/calcChain.xml'];
      if (origFiles['[Content_Types].xml']) {
        let ct = strFromU8(origFiles['[Content_Types].xml']);
        ct = ct.replace(/<Override[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>\s*/g, '');
        ct = ct.replace(/<Override[^>]*calcChain\.xml[^>]*\/>\s*/g, '');
        origFiles['[Content_Types].xml'] = strToU8(ct);
      }
      if (origFiles['xl/_rels/workbook.xml.rels']) {
        let rels = strFromU8(origFiles['xl/_rels/workbook.xml.rels']);
        rels = rels.replace(/<Relationship[^>]*calcChain[^>]*\/>\s*/g, '');
        origFiles['xl/_rels/workbook.xml.rels'] = strToU8(rels);
      }
    }

    stagedBuf = zipSync(origFiles);
    sheetName = 'Blc';
    filename = 'Stuffing_Terupdate.xlsx';
    mode = 'stuffing';
    warnings.push(`Sheet "Blc" pada Stuffing List ditimpa (${rows.length} baris NB, berformat).`);
  } else {
    sheetName = `BLC HDU ${now.getMonth() + 1}.${String(now.getDate()).padStart(2, '0')} PAGI`;
    const built = buildStandaloneBlcZip({ sheetName, ...styleMeta });
    stagedBuf = built.zip;
    filename = `BLC HDU ${now.getMonth() + 1}.${String(now.getDate()).padStart(2, '0')}.xlsx`;
    mode = 'blc';
  }

  onProgress('Memformat...');
  const data = stagedBuf;

  return {
    data,
    filename,
    report: {
      jitFiles: jitFiles.length,
      nbOrders: rows.length,
      period,
      mode,
      stuffingName: stuffingFile ? stuffingFile.name : null,
    },
    warnings,
  };
}
