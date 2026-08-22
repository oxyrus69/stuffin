import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/process-excel
 * 
 * Two modes:
 * 1. Legacy FormData mode: process files server-side (kept for compatibility)
 * 2. Report-only mode (primary): receive processing report JSON for DB storage.
 *    All Excel processing happens client-side to avoid Vercel's body size limit.
 */
export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // ─── MODE 1: Report-only JSON (primary path) ────────────
    // Client processes Excel locally, sends only the small report for DB storage.
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { report, stuffingFileName, inspectionFileName, blcFileName } = body;

      if (!report) {
        return NextResponse.json({ error: 'Report tidak ditemukan.' }, { status: 400 });
      }

      // Extract stats from report
      const summary = report.summary || {};
      const packBlcUpdated = summary.packBlcUpdated || 0;
      const poPassed = summary.poPassed || 0;
      const poRejected = summary.poRejected || 0;
      const siBlcUpdated = summary.siBlcUpdated || 0;
      const outputSizeKB = summary.outputSizeKB || 0;

      // Save to database
      try {
        await sql`
          INSERT INTO processing_history (
            stuffing_file_name, inspection_file_name, blc_file_name,
            pack_blc_updated, po_passed, po_rejected, si_blc_updated,
            output_size_kb, status
          ) VALUES (
            ${stuffingFileName || ''}, ${inspectionFileName || ''}, ${blcFileName || ''},
            ${packBlcUpdated}, ${poPassed}, ${poRejected}, ${siBlcUpdated},
            ${outputSizeKB}, 'success'
          )
        `;
      } catch (dbErr) {
        console.warn('DB save failed (non-critical):', dbErr.message);
        return NextResponse.json({
          success: true,
          warning: `Gagal menyimpan riwayat: ${dbErr.message}`,
        });
      }

      return NextResponse.json({ success: true });
    }

    // ─── MODE 2: Legacy FormData (files uploaded for server-side processing) ──
    // Kept as fallback; subject to Vercel's ~4.5MB body size limit.
    const { default: XLSX } = await import('xlsx');

    const formData = await request.formData();
    const blcFile = formData.get('blc');
    const stuffingFile = formData.get('stuffing');
    const inspectionFile = formData.get('inspection');

    if (!stuffingFile || stuffingFile.size === 0) {
      return NextResponse.json({ error: 'File Stuffing List wajib diunggah.' }, { status: 400 });
    }
    if (!inspectionFile || inspectionFile.size === 0) {
      return NextResponse.json({ error: 'File Daily Inspection wajib diunggah.' }, { status: 400 });
    }

    const report = { steps: [], warnings: [], summary: {} };

    const stuffingBuffer = Buffer.from(await stuffingFile.arrayBuffer());
    const inspectionBuffer = Buffer.from(await inspectionFile.arrayBuffer());
    let blcBuffer = null;
    if (blcFile && blcFile.size > 0) {
      blcBuffer = Buffer.from(await blcFile.arrayBuffer());
    }

    let wbStuffing = XLSX.read(stuffingBuffer, { type: 'buffer' });
    let wbInspection = XLSX.read(inspectionBuffer, { type: 'buffer' });
    let wbBlc = blcBuffer ? XLSX.read(blcBuffer, { type: 'buffer' }) : null;

    // ... (same logic as before, abbreviated for space) ...
    // This legacy path still works for small files under the body size limit.

    const nbOrderSheet = wbStuffing.Sheets['NB ORDER'];
    if (!nbOrderSheet) {
      return NextResponse.json({ error: `Sheet "NB ORDER" tidak ditemukan. Sheet: ${wbStuffing.SheetNames.join(', ')}` }, { status: 400 });
    }

    const nbOrderData = XLSX.utils.sheet_to_json(nbOrderSheet, { header: 1, defval: '' });

    let headerRowIndex = -1, packBlcColIndex = -1, poColIndex = -1, siBlcColIndex = -1;
    for (let i = 0; i < Math.min(nbOrderData.length, 10); i++) {
      const row = nbOrderData[i];
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').trim();
        if (cell === 'Pack. Blc' || cell === 'Pack. Blc ') { headerRowIndex = i; packBlcColIndex = j; }
        if (cell === 'MAN.PO#' || cell === 'MAN.PO# ' || cell === 'PO#' || cell === 'MAN.PO') poColIndex = j;
        if (cell === 'SI Blc' || cell === 'SI Blc ') siBlcColIndex = j;
      }
      if (headerRowIndex >= 0) break;
    }

    if (headerRowIndex < 0 || packBlcColIndex < 0 || poColIndex < 0 || siBlcColIndex < 0) {
      return NextResponse.json({ error: 'Kolom yang diperlukan tidak ditemukan di sheet "NB ORDER".' }, { status: 400 });
    }

    function setCellValueLocal(sheet, r, c, v) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      if (cell) { cell.v = v; cell.t = typeof v === 'number' ? 'n' : 's'; }
      else { sheet[addr] = { v, t: typeof v === 'number' ? 'n' : 's' }; }
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let packBlcUpdated = 0, siBlcUpdated = 0;
    const dataStartRow = headerRowIndex + 1;

    for (let i = dataStartRow; i < nbOrderData.length; i++) {
      const row = nbOrderData[i];
      if (!row || row.length === 0) continue;
      const packVal = row[packBlcColIndex];
      if (packVal === 0 || packVal === '0' || packVal === 0.0) {
        setCellValueLocal(nbOrderSheet, i, packBlcColIndex, todayStr);
        packBlcUpdated++;
      }
    }

    // Logic 2 - Dynamic sheet detection (find any sheet with PO# column)
    let inspectionSheetName2 = null;
    let aprData = null;
    let aprPoColIndex = -1;
    const monthNames2 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const sortedSheets2 = [...wbInspection.SheetNames].sort((a,b) => {
      const ai = monthNames2.indexOf(a), bi = monthNames2.indexOf(b);
      if (ai >= 0 && bi >= 0) return bi - ai;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return 0;
    });
    for (const sn of sortedSheets2) {
      const sh = wbInspection.Sheets[sn];
      if (!sh) continue;
      const d = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' });
      if (d.length < 2) continue;
      let pc = -1;
      for (let i = 0; i < Math.min(d.length, 5); i++) {
        const row = d[i];
        for (let j = 0; j < (row ? row.length : 0); j++) {
          const c = String(row[j] || '').trim();
          if (c === 'PO#' || c === 'PO# ' || c === 'PO' || c === 'MAN.PO#') { pc = j; break; }
        }
        if (pc >= 0) break;
      }
      if (pc >= 0) { inspectionSheetName2 = sn; aprData = d; aprPoColIndex = pc; break; }
    }
    if (!inspectionSheetName2) return NextResponse.json({ error: `Kolom "PO#" tidak ditemukan. Sheet: ${wbInspection.SheetNames.join(', ')}` }, { status: 400 });

    let aprDataStartRow = 3;
    for (let i = 0; i < Math.min(aprData.length, 10); i++) {
      const row = aprData[i];
      if (row && row[0] !== undefined && row[0] !== '' && !isNaN(Number(row[0])) && Number(row[0]) >= 1) { aprDataStartRow = i; break; }
    }

    const passedPOs = new Set();
    let rejectedCount = 0;
    for (let i = aprDataStartRow; i < aprData.length; i++) {
      const row = aprData[i];
      if (!row || row.length === 0) continue;
      const poNumber = row[aprPoColIndex];
      if (poNumber === '' || poNumber === null || poNumber === undefined) continue;
      const hasReject = row.some(cell => cell !== '' && cell !== null && cell !== undefined && String(cell).toUpperCase().includes('REJECT'));
      if (!hasReject) passedPOs.add(String(poNumber).trim()); else rejectedCount++;
    }

    // Logic 3
    for (let i = dataStartRow; i < nbOrderData.length; i++) {
      const row = nbOrderData[i];
      if (!row || row.length === 0) continue;
      const poVal = String(row[poColIndex] || '').trim();
      if (poVal && passedPOs.has(poVal)) { setCellValueLocal(nbOrderSheet, i, siBlcColIndex, 0); siBlcUpdated++; }
    }

    const outputBuffer = XLSX.write(wbStuffing, { type: 'buffer', bookType: 'xlsx' });

    try {
      await sql`
        INSERT INTO processing_history (
          stuffing_file_name, inspection_file_name, blc_file_name,
          pack_blc_updated, po_passed, po_rejected, si_blc_updated,
          output_size_kb, status
        ) VALUES (
          ${stuffingFile.name}, ${inspectionFile.name}, ${blcFile?.name || ''},
          ${packBlcUpdated}, ${passedPOs.size}, ${rejectedCount}, ${siBlcUpdated},
          ${(outputBuffer.length / 1024).toFixed(1)}, 'success'
        )
      `;
    } catch (dbErr) {
      console.warn('DB save failed (non-critical):', dbErr.message);
    }

    return new Response(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Hasil_Stuffing_Otomatis.xlsx"',
      },
    });

  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json({ error: `Kesalahan pemrosesan: ${error.message}` }, { status: 500 });
  }
}
