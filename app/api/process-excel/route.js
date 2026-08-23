import { NextResponse } from 'next/server';

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
 * Returns { header, rows } or null when no production-report table is found.
 */
function extractJitRows(workbook) {
  const HEADER_KEYS = ['ordno', 'styleno'];
  for (const sn of workbook.SheetNames) {
    const ws = workbook.Sheets[sn];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    const hdrIdx = findHeaderRow(aoa, HEADER_KEYS);
    if (hdrIdx < 0) continue;

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
    if (rows.length > 0) return { header, rows, sheetName: sn };
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════════════════════ */
export async function POST(request) {
  try {
    const XLSX = await import('xlsx');
    const formData = await request.formData();

    /* ─── Validate input: multiple JIT files ─── */
    const jitEntries = formData.getAll('jit').filter((f) => f && f.size > 0);
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
       row0 title · row2 period "YYYY M" · row3 total rows · row4 header · data */
    const now = new Date();
    const period = `${now.getFullYear()} ${now.getMonth() + 1}`;
    const aoa = [
      ['Production Report By Order'],
      [],
      [period],
      [rows.length],
      mergedHeader,
      ...rows,
    ];
    const blcWs = XLSX.utils.aoa_to_sheet(aoa);
    blcWs['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: aoa.length - 1, c: Math.max(mergedHeader.length - 1, 0) },
    });

    const wbOut = XLSX.utils.book_new();
    const sheetName = `BLC HDU ${now.getMonth() + 1}.${String(now.getDate()).padStart(2, '0')} PAGI`;
    XLSX.utils.book_append_sheet(wbOut, blcWs, sheetName.slice(0, 31));

    const outputBuffer = XLSX.write(wbOut, { type: 'buffer', bookType: 'xlsx' });

    /* ─── Output as direct download ─── */
    const outName = `BLC HDU ${now.getMonth() + 1}.${String(now.getDate()).padStart(2, '0')}.xlsx`;
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
          })
        ),
      },
    });
  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json({ error: `Kesalahan pemrosesan: ${error.message}` }, { status: 500 });
  }
}
