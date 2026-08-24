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
      try {
        wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
      } catch (e) {
        warnings.push(`File "${file.name}" gagal dibaca (${e.message}) — dilewati.`);
        continue;
      }

      const extracted = extractJitRows(wb);
      if (!extracted) {
        warnings.push(`File "${file.name}": tabel produksi (header OrdNo/StyleNo) tidak ditemukan — dilewati.`);
        continue;
      }

      // Period priority: in-file "YYYY M" cell -> filename pattern (e.g. 0726.XLS = Jul 2026)
      let filePeriod = extracted.period;
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
      let keptRows = 0;
      for (const srcRow of extracted.rows) {
        const ordNo = ordColSrc >= 0 ? String(srcRow[ordColSrc] ?? '').trim() : '';
        if (/NB/i.test(ordNo)) {
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
        if (/NB/i.test(ordNo)) {
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

    /* ─── STEP 3: build the final BLC sheet ───
       Same structure as "BLC HDU 8.22 PAGI.xlsx":
       row0 title · row2 period "YYYY M" · row3 total rows · row4 header · data.
       Period follows the source JIT data's own period cell ("2026 7"),
       falling back to the current month when none is found.
       Row-count cell follows the legacy convention: TOTAL physical rows
       of the sheet (e.g. reference writes 1298 for ±1293 data rows,
       i.e. dataRows + 5). */
    const now = new Date();
    const fallbackPeriod = `${now.getFullYear()} ${now.getMonth() + 1}`;
    let period =
      jitEntries.map((_, k) => extractedPeriods[k]).find(Boolean) || null;
    if (!period) {
      period = fallbackPeriod;
      warnings.push(`Periode tidak ditemukan di file JIT — memakai bulan berjalan "${fallbackPeriod}".`);
    }
    const totalRowCount = rows.length + 5; // title + blank + period + count + header + data
    const aoa = [
      ['Production Report By Order'],
      [],
      [period],
      [totalRowCount],
      mergedHeader,
      ...rows,
    ];
    const blcWs = XLSX.utils.aoa_to_sheet(aoa);
    blcWs['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: aoa.length - 1, c: Math.max(mergedHeader.length - 1, 0) },
    });

    /* ─── STEP 4 (optional): inject into Stuffing List sheet 'Blc' ───
       When a Stuffing List is uploaded, the merged BLC table REPLACES
       the sheet named 'Blc' in that workbook; all other sheets and the
       rest of the workbook are preserved untouched. Output = the
       updated Stuffing List. Otherwise output = standalone BLC file. */
    let wbOut;
    let outName;
    let outputMode;

    if (hasStuffing) {
      let wbStuffing;
      try {
        wbStuffing = XLSX.read(Buffer.from(await stuffingEntry.arrayBuffer()), { type: 'buffer' });
      } catch (e) {
        return NextResponse.json(
          { error: `File Stuffing List gagal dibaca: ${e.message}` },
          { status: 400 }
        );
      }
      const blcTargetName =
        wbStuffing.SheetNames.find((n) => n.trim().toLowerCase() === 'blc') || 'Blc';
      if (wbStuffing.Sheets[blcTargetName]) {
        delete wbStuffing.Sheets[blcTargetName];
        wbStuffing.SheetNames = wbStuffing.SheetNames.filter((n) => n !== blcTargetName);
      }
      wbStuffing.Sheets[blcTargetName] = blcWs;
      const nbIdx = wbStuffing.SheetNames.indexOf('NB ORDER');
      wbStuffing.SheetNames.splice(nbIdx + 1 || wbStuffing.SheetNames.length, 0, blcTargetName);

      wbOut = wbStuffing;
      outName = 'Stuffing_Terupdate.xlsx';
      outputMode = 'stuffing';
      warnings.push(`Sheet "${blcTargetName}" pada Stuffing List ditimpa (${rows.length} baris NB).`);
    } else {
      wbOut = XLSX.utils.book_new();
      const sheetName = `BLC HDU ${now.getMonth() + 1}.${String(now.getDate()).padStart(2, '0')} PAGI`;
      XLSX.utils.book_append_sheet(wbOut, blcWs, sheetName.slice(0, 31));
      outName = `BLC HDU ${now.getMonth() + 1}.${String(now.getDate()).padStart(2, '0')}.xlsx`;
      outputMode = 'blc';
    }

    const outputBuffer = XLSX.write(wbOut, { type: 'buffer', bookType: 'xlsx' });

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
