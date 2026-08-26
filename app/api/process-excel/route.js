import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const maxDuration = 60;

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

function norm(s) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function isBlank(v) {
  return v === null || v === undefined || String(v).trim() === '';
}

/**
 * Parse uploaded workbook bytes into a SheetJS workbook.
 * Handles two kinds of ".xls" inputs:
 *   1. Real spreadsheets — zip (.xlsx, "PK") or OLE2 binary (.xls, d0cf11e0…)
 *   2. HTML-table exports from Chinese ERP systems, GBK/GB2312-encoded.
 *      Reading those as binary mangles Chinese text (mojibake like "ɫ"),
 *      so they are decoded as text with the correct charset first.
 * Returns { wb, textPeriod } — textPeriod is the "YYYY M" found in the
 * HTML <h6> banner (null for binary workbooks).
 */
function parseWorkbookBuffer(buf) {
  const head = buf.subarray(0, 8).toString('hex');
  const isBinary = head.startsWith('504b') /* PK  = xlsx */ ||
    head.startsWith('d0cf11e0') /* OLE2 = legacy xls */;
  if (isBinary) return { wb: XLSX.read(buf, { type: 'buffer' }), textPeriod: null };

  // Text/HTML export: pick charset from meta tag, else sniff
  const asciiHead = buf.subarray(0, 2048).toString('latin1');
  const charsetMatch = asciiHead.match(/charset=["']?([\w-]+)/i);
  let text;
  const declared = (charsetMatch?.[1] || '').toLowerCase();
  if (/^gb/i.test(declared)) {
    text = new TextDecoder('gbk').decode(buf);
  } else if (declared === 'utf-8' || declared === 'utf8') {
    text = buf.toString('utf8');
  } else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
      text = new TextDecoder('gbk').decode(buf); // Chinese default
    }
  }

  // Period banner, e.g. <h6 align=center> 2026 7</h6>
  const pm = text.match(/<h[1-6][^>]*>\s*(\d{4})\s+(\d{1,2})\s*</i);
  const textPeriod = pm ? `${pm[1]} ${Number(pm[2])}` : null;

  return { wb: XLSX.read(text, { type: 'string' }), textPeriod };
}

/** Find the header row containing ALL given keywords (e.g. ['ordno','styleno']). */
function findHeaderRow(aoa, keys) {
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const cells = (aoa[i] || []).map(norm);
    if (keys.every((k) => cells.some((c) => c.includes(k)))) return i;
  }
  return -1;
}

/**
 * Extract the data rows from one JIT workbook.
 * Handles repeated headers / title rows inside the sheet.
 * Returns { header, rows, sheetName, period } — period is a "YYYY M"
 * string found near the top of the source sheet (may be null).
 */
function extractJitRows(workbook) {
  const HEADER_KEYS = ['ordno', 'styleno'];
  for (const sn of workbook.SheetNames) {
    const ws = workbook.Sheets[sn];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    const hdrIdx = findHeaderRow(aoa, HEADER_KEYS);
    if (hdrIdx < 0) continue;

    // Detect period cell like "2026 7" ABOVE the header row
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
      // skip blank lines AND repeated headers/title rows inside the data
      if (row.every(isBlank)) continue;
      if (typeof row[0] === 'string' && /^ordno/i.test(norm(row[0]))) continue;
      rows.push(Array.from({ length: width }, (_, j) => row[j] ?? null));
    }
    if (rows.length > 0) return { header, rows, sheetName: sn, period };
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════════════════════ */
export async function POST(request) {
  try {
    const formData = await request.formData();

    /* ─── Validate input: multiple JIT files (+ optional stuffing) ─── */
    const jitEntries = formData.getAll('jit').filter((f) => f && f.size > 0);
    const stuffingEntry = formData.get('stuffing');
    const hasStuffing = stuffingEntry && stuffingEntry.size > 0;
    if (jitEntries.length === 0) {
      return NextResponse.json(
        { error: 'Minimal 1 file "Data JIT" wajib diunggah.' },
        { status: 400 }
      );
    }

    const warnings = [];

    /* ─── STEP 1+2: parse each JIT file, keep NB orders only ───
       An order is an NB order when its OrdNo contains "NB"
       (e.g. U07NB0001). Non-NB orders are discarded.
       Duplicate OrdNo across files: the EARLIER uploaded file
       wins (upload oldest/morning files first).                */
    let mergedHeader = null;
    const rows = [];
    const seenOrdNo = new Set(); // OrdNo -> first (earliest uploaded) occurrence wins
    const extractedPeriods = []; // per uploaded JIT file, in upload order

    for (const file of jitEntries) {
      let wb;
      let textPeriod = null;
      try {
        const parsed = parseWorkbookBuffer(Buffer.from(await file.arrayBuffer()));
        wb = parsed.wb;
        textPeriod = parsed.textPeriod;
      } catch (e) {
        warnings.push(`File "${file.name}" gagal dibaca (${e.message}) — dilewati.`);
        continue;
      }

      const extracted = extractJitRows(wb);
      if (!extracted) {
        warnings.push(`File "${file.name}": tabel produksi (header OrdNo/StyleNo) tidak ditemukan — dilewati.`);
        continue;
      }

      // Period priority: in-file "YYYY M" (cell or HTML banner) -> filename pattern
      let filePeriod = extracted.period || textPeriod;
      if (!filePeriod) {
        const fm = String(file.name || '').match(/(\d{2})(\d{2})\.(xlsx|xls)$/i);
        if (fm) {
          filePeriod = `${2000 + Number(fm[2])} ${Number(fm[1])}`;
          warnings.push(`"${file.name}": periode "${filePeriod}" diambil dari nama file.`);
        }
      }
      extractedPeriods.push(filePeriod);

      if (!mergedHeader) {
        mergedHeader = extracted.header.slice();
      }

      // Align columns by header name when structures differ between files
      let colMap = null;
      if (
        extracted.header.length !== mergedHeader.length ||
        extracted.header.some((h, i) => h !== mergedHeader[i])
      ) {
        colMap = extracted.header.map((h) => {
          const idx = mergedHeader.indexOf(h);
          if (idx >= 0) return idx;
          mergedHeader.push(h);
          return mergedHeader.length - 1;
        });
      }

      const ordColSrc = extracted.header.findIndex((h) => norm(h) === 'ordno');
      // Valid NB order: contains "NB" AND starts with "U" (e.g. U07NB0001).
      // Prefixed forms like PU07NB… are different product lines — discarded.
      const isNbOrder = (ordNo) => /^U\d{2}N/i.test(ordNo);
      let keptRows = 0;
      for (const srcRow of extracted.rows) {
        const ordNo = ordColSrc >= 0 ? String(srcRow[ordColSrc] ?? '').trim() : '';
        if (isNbOrder(ordNo)) {
          if (seenOrdNo.has(ordNo)) continue; // earlier file already has this order
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
      // Detect duplicates WITHIN a single file (kept: first occurrence)
      const ordSeenInFile = new Set();
      let inFileDupes = 0;
      for (const srcRow of extracted.rows) {
        const ordNo = ordColSrc >= 0 ? String(srcRow[ordColSrc] ?? '').trim() : '';
        if (isNbOrder(ordNo)) {
          if (ordSeenInFile.has(ordNo)) inFileDupes++;
          else ordSeenInFile.add(ordNo);
        }
      }
      if (inFileDupes > 0) {
        warnings.push(`"${file.name}": ${inFileDupes} order NB duplikat ditemukan di dalam file — kemunculan pertama yang dipakai.`);
      }
      if (extracted.period) {
        warnings.push(`"${file.name}": periode terdeteksi "${extracted.period}".`);
      }
      warnings.push(`"${file.name}" (${extracted.sheetName}): ${keptRows} baris NB diambil.`);
    }

    if (!mergedHeader || rows.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada baris order NB yang bisa diekstrak dari file JIT yang diunggah.' },
        { status: 400 }
      );
    }


  /* Sort: highest U-code first (U12 top ... U01 bottom), stable within groups. */
  const ordColMerged = mergedHeader.findIndex((h) => norm(h) === 'ordno');
  const codeOfRow = (row) => {
    if (ordColMerged < 0) return -1;
    const mm2 = String(row[ordColMerged] ?? '').trim().match(/^U(\d{2})/i);
    return mm2 ? parseInt(mm2[1], 10) : -1;
  };
  rows.map((row, i) => ({ row, i, code: codeOfRow(row) }))
    .sort((a, b) => (b.code - a.code) || (a.i - b.i))
    .forEach((e, idx) => { rows[idx] = e.row; });
    /* ─── STEP 3: build the final BLC sheet (formatted) ───
       Layout mirrors "BLC HDU 8.22 PAGI.xlsx":
         row1 title "Production Report By Order" — Calibri 24, merged across,
         row3 period "YYYY M" directly below the title (blue, bold, centered),
         row4 total row count (dataRows + 5 legacy convention),
         row5 header (bold, thin gray borders, centered),
         row6+ data with thin borders, auto-fitted column widths.
       Period follows the source JIT data ("2026 7" banner/cell/filename),
       falling back to the current month when none is found. */
    const now = new Date();
    const fallbackPeriod = `${now.getFullYear()} ${now.getMonth() + 1}`;
    let period =
      jitEntries.map((_, k) => extractedPeriods[k]).find(Boolean) || null;
    if (!period) {
      period = fallbackPeriod;
      warnings.push(`Periode tidak ditemukan di file JIT — memakai bulan berjalan "${fallbackPeriod}".`);
    }
    const totalRowCount = rows.length + 5; // title + blank + period + count + header + data

    /* Populate an ExcelJS worksheet with the formatted BLC table. */
    const THIN_GRAY = { style: 'thin', color: { argb: 'FF7F7F7F' } };
    const ALL_THIN = { top: THIN_GRAY, bottom: THIN_GRAY, left: THIN_GRAY, right: THIN_GRAY };
    const BLUE_BOLD = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1F4E79' } };

    function applyBlcContent(ws) {
      const lastCol = Math.max(mergedHeader.length, 1);

      // Row 1 — title, Calibri 24, merged & centered
      ws.mergeCells(1, 1, 1, lastCol);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = 'Production Report By Order';
      titleCell.font = { name: 'Calibri', size: 24 };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 34;

      // Row 3 — year & month right below the title
      ws.mergeCells(3, 1, 3, lastCol);
      const periodCell = ws.getCell(3, 1);
      periodCell.value = period;
      periodCell.font = BLUE_BOLD;
      periodCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Row 4 — legacy total row count
      const countCell = ws.getCell(4, 1);
      countCell.value = totalRowCount;
      countCell.font = BLUE_BOLD;
      countCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Row 5 — header row
      const headerRow = ws.getRow(5);
      mergedHeader.forEach((h, j) => {
        const c = headerRow.getCell(j + 1);
        c.value = h || null;
        c.font = { name: 'Calibri', size: 11, bold: true };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = ALL_THIN;
      });
      headerRow.height = 18;

      // Data rows
      rows.forEach((dataRow, i) => {
        const r = ws.getRow(i + 6);
        for (let j = 0; j < mergedHeader.length; j++) {
          const c = r.getCell(j + 1);
          c.value = dataRow[j] ?? null;
          c.border = ALL_THIN;
        }
      });

      // Auto-fit column widths (clamped)
      for (let j = 0; j < mergedHeader.length; j++) {
        let maxLen = String(mergedHeader[j] ?? '').length;
        for (const dataRow of rows) {
          const v = dataRow[j];
          if (v !== null && v !== undefined) {
            const l = typeof v === 'number' ? String(v).length : String(v).length;
            if (l > maxLen) maxLen = l;
          }
        }
        const col = ws.getColumn(j + 1);
        col.width = Math.min(Math.max(maxLen + 2, 8), 40);
      }
    }

    const ExcelJS = (await import('exceljs')).default;

    /* ─── STEP 4 (optional): inject into Stuffing List sheet 'Blc' ───
       Two-pass approach:
         Pass 1 (SheetJS): rewrite workbook structure — replace sheet 'Blc'
           content, keep every other sheet + their order intact.
         Pass 2 (ExcelJS): reopen the staged file and apply rich formatting
           (fonts, merges, borders, column widths) ONLY to sheet 'Blc'.
       Output = the updated Stuffing List. Without stuffing, the standalone
       BLC file is built directly with ExcelJS. */
    let outputBuffer;
    let outName;
    let outputMode;

    if (hasStuffing) {
      // ── Pass 1: structural edit with SheetJS (order-safe)
      let wbStuffing;
      try {
        wbStuffing = XLSX.read(Buffer.from(await stuffingEntry.arrayBuffer()), { type: 'buffer' });
      } catch (e) {
        const head = Buffer.from(await stuffingEntry.slice(0, 8).arrayBuffer()).toString('hex');
        if (/password/i.test(e.message) || head.startsWith('d0cf11e0')) {
          return NextResponse.json(
            { error: 'File Stuffing List TERENKRIPSI (Excel dengan password). Buka di Excel → Save As → .xlsx tanpa proteksi, lalu unggah ulang.' },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { error: `File Stuffing List gagal dibaca: ${e.message}` },
          { status: 400 }
        );
      }
      const blcTargetName =
        wbStuffing.SheetNames.find((n) => n.trim().toLowerCase() === 'blc') || 'Blc';
      const plainAoA = [
        ['Production Report By Order'],
        [],
        [period],
        [totalRowCount],
        mergedHeader,
        ...rows,
      ];
      const plainWs = XLSX.utils.aoa_to_sheet(plainAoA);
      plainWs['!ref'] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: plainAoA.length - 1, c: Math.max(mergedHeader.length - 1, 0) },
      });
      if (wbStuffing.Sheets[blcTargetName]) {
        delete wbStuffing.Sheets[blcTargetName];
        wbStuffing.SheetNames = wbStuffing.SheetNames.filter((n) => n !== blcTargetName);
      }
      wbStuffing.Sheets[blcTargetName] = plainWs;
      const nbIdx = wbStuffing.SheetNames.indexOf('NB ORDER');
      wbStuffing.SheetNames.splice(nbIdx + 1 || wbStuffing.SheetNames.length, 0, blcTargetName);

      const staged = XLSX.write(wbStuffing, { type: 'buffer', bookType: 'xlsx' });

      // ── Pass 2: styling pass with ExcelJS
      const wbStyled = new ExcelJS.Workbook();
      await wbStyled.xlsx.load(staged);
      const blcWs = wbStyled.getWorksheet(blcTargetName);
      if (!blcWs) {
        return NextResponse.json({ error: 'Sheet "Blc" hilang setelah penyusunan ulang.' }, { status: 500 });
      }
      applyBlcContent(blcWs);

      outputBuffer = Buffer.from(await wbStyled.xlsx.writeBuffer());
      outName = 'Stuffing_Terupdate.xlsx';
      outputMode = 'stuffing';
      warnings.push(`Sheet "${blcTargetName}" pada Stuffing List ditimpa (${rows.length} baris NB, berformat).`);
    } else {
      const wbOut = new ExcelJS.Workbook();
      const blcWs = wbOut.addWorksheet(
        `BLC HDU ${now.getMonth() + 1}.${String(now.getDate()).padStart(2, '0')} PAGI`.slice(0, 31)
      );
      applyBlcContent(blcWs);
      outputBuffer = Buffer.from(await wbOut.xlsx.writeBuffer());
      outName = `BLC HDU ${now.getMonth() + 1}.${String(now.getDate()).padStart(2, '0')}.xlsx`;
      outputMode = 'blc';
    }

    /* ─── Output as direct download ─── */
    return new Response(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${outName}"`,
        'Cache-Control': 'no-store',
        'X-Process-Report': encodeURIComponent(
          JSON.stringify({
            jitFiles: jitEntries.length,
            nbOrders: rows.length,
            period,
            mode: outputMode,
            stuffingName: hasStuffing ? stuffingEntry.name : null,
          })
        ),
      },
    });
  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json({ error: `Kesalahan pemrosesan: ${error.message}` }, { status: 500 });
  }
}
