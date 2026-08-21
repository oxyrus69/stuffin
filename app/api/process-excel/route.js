import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import sql from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Helper: set a cell value directly on the worksheet object.
 * This preserves named ranges, merged cells, formatting, etc.
 */
function setCellValue(sheet, rowIdx, colIdx, value) {
  const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
  const cell = sheet[addr];
  if (cell) {
    cell.v = value;
    // Update type: number for 0, string for date text
    if (typeof value === 'number') {
      cell.t = 'n';
    } else {
      cell.t = 's';
    }
  } else {
    // Cell doesn't exist yet — create it
    sheet[addr] = {
      v: value,
      t: typeof value === 'number' ? 'n' : 's',
    };
  }
}

function validateFile(file, name, required = true) {
  if (!file || file.size === 0) {
    if (required) return `File "${name}" wajib diunggah.`;
    return null;
  }
  if (file.size > 50 * 1024 * 1024) {
    return `File "${name}" terlalu besar (maks 50 MB).`;
  }
  const ext = file.name?.split('.').pop()?.toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls') {
    return `File "${name}" harus berformat .xlsx atau .xls.`;
  }
  return null;
}

export async function POST(request) {
  const report = {
    steps: [],
    warnings: [],
    summary: {},
  };

  try {
    const formData = await request.formData();

    const blcFile = formData.get('blc');
    const stuffingFile = formData.get('stuffing');
    const inspectionFile = formData.get('inspection');

    // ─── VALIDATION ──────────────────────────────────────
    const validationErrors = [];

    const errStuffing = validateFile(stuffingFile, 'Stuffing List');
    if (errStuffing) validationErrors.push(errStuffing);

    const errInspection = validateFile(inspectionFile, 'Daily Inspection');
    if (errInspection) validationErrors.push(errInspection);

    if (blcFile && blcFile.size > 0) {
      const errBlc = validateFile(blcFile, 'BLC');
      if (errBlc) validationErrors.push(errBlc);
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors.join(' '), warnings: report.warnings },
        { status: 400 }
      );
    }

    if (!blcFile || blcFile.size === 0) {
      report.warnings.push('File BLC tidak diunggah — langkah sinkronisasi BLC dilewati.');
    }

    // ─── Read file buffers ───────────────────────────────
    const stuffingBuffer = Buffer.from(await stuffingFile.arrayBuffer());
    const inspectionBuffer = Buffer.from(await inspectionFile.arrayBuffer());

    let blcBuffer = null;
    if (blcFile && blcFile.size > 0) {
      blcBuffer = Buffer.from(await blcFile.arrayBuffer());
    }

    // Parse Excel workbooks
    let wbStuffing, wbInspection, wbBlc;
    try {
      wbStuffing = XLSX.read(stuffingBuffer, { type: 'buffer' });
    } catch (e) {
      return NextResponse.json(
        { error: `Gagal membaca file Stuffing List: ${e.message}` },
        { status: 400 }
      );
    }

    try {
      wbInspection = XLSX.read(inspectionBuffer, { type: 'buffer' });
    } catch (e) {
      return NextResponse.json(
        { error: `Gagal membaca file Daily Inspection: ${e.message}` },
        { status: 400 }
      );
    }

    if (blcBuffer) {
      try {
        wbBlc = XLSX.read(blcBuffer, { type: 'buffer' });
      } catch (e) {
        report.warnings.push(`Gagal membaca file BLC: ${e.message}. Melanjutkan tanpa BLC.`);
      }
    }

    // Store sheet names for report
    report.summary.stuffingSheets = wbStuffing.SheetNames;
    report.summary.inspectionSheets = wbInspection.SheetNames;
    if (wbBlc) report.summary.blcSheets = wbBlc.SheetNames;

    // ─── LOGIC 1: Pack. Blc → today's date when value is 0 ──────
    const step1 = { name: 'Isi tanggal pada kolom Pack. Blc', status: 'success', details: {} };

    const nbOrderSheet = wbStuffing.Sheets['NB ORDER'];
    if (!nbOrderSheet) {
      step1.status = 'error';
      step1.message = `Sheet "NB ORDER" tidak ditemukan. Sheet yang tersedia: ${wbStuffing.SheetNames.join(', ')}`;
      report.steps.push(step1);
      return NextResponse.json(
        { error: step1.message, report, warnings: report.warnings },
        { status: 400 }
      );
    }

    const nbOrderData = XLSX.utils.sheet_to_json(nbOrderSheet, { header: 1, defval: '' });
    if (nbOrderData.length < 1) {
      step1.status = 'error';
      step1.message = 'Sheet "NB ORDER" kosong.';
      report.steps.push(step1);
      return NextResponse.json(
        { error: step1.message, report, warnings: report.warnings },
        { status: 400 }
      );
    }

    // Find header row and relevant columns
    let headerRowIndex = -1;
    let packBlcColIndex = -1;
    let poColIndex = -1;
    let siBlcColIndex = -1;

    for (let i = 0; i < Math.min(nbOrderData.length, 10); i++) {
      const row = nbOrderData[i];
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').trim();
        if (cell === 'Pack. Blc' || cell === 'Pack. Blc ') {
          headerRowIndex = i;
          packBlcColIndex = j;
        }
        if (cell === 'MAN.PO#' || cell === 'MAN.PO# ' || cell === 'PO#' || cell === 'MAN.PO') {
          poColIndex = j;
        }
        if (cell === 'SI Blc' || cell === 'SI Blc ') {
          siBlcColIndex = j;
        }
      }
      if (headerRowIndex >= 0) break;
    }

    if (headerRowIndex < 0 || packBlcColIndex < 0) {
      step1.status = 'error';
      step1.message = 'Kolom "Pack. Blc" tidak ditemukan di sheet "NB ORDER". Periksa header kolom.';
      report.steps.push(step1);
      return NextResponse.json(
        { error: step1.message, report, warnings: report.warnings },
        { status: 400 }
      );
    }

    if (poColIndex < 0) {
      step1.status = 'error';
      step1.message = 'Kolom "MAN.PO#" tidak ditemukan di sheet "NB ORDER". Periksa header kolom.';
      report.steps.push(step1);
      return NextResponse.json(
        { error: step1.message, report, warnings: report.warnings },
        { status: 400 }
      );
    }

    if (siBlcColIndex < 0) {
      step1.status = 'error';
      step1.message = 'Kolom "SI Blc" tidak ditemukan di sheet "NB ORDER". Periksa header kolom.';
      report.steps.push(step1);
      return NextResponse.json(
        { error: step1.message, report, warnings: report.warnings },
        { status: 400 }
      );
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let packBlcUpdated = 0;
    let packBlcSkipped = 0;
    const dataStartRow = headerRowIndex + 1;
    const totalDataRows = nbOrderData.length - dataStartRow;

    // Logic 1: If Pack. Blc == 0 → set to today (modify in-place on the original sheet)
    for (let i = dataStartRow; i < nbOrderData.length; i++) {
      const row = nbOrderData[i];
      if (!row || row.length === 0) continue;
      const packVal = row[packBlcColIndex];
      if (packVal === 0 || packVal === '0' || packVal === 0.0) {
        // Modify the original worksheet cell directly to preserve named ranges
        setCellValue(nbOrderSheet, i, packBlcColIndex, todayStr);
        packBlcUpdated++;
      } else {
        packBlcSkipped++;
      }
    }

    step1.details = {
      sheet: 'NB ORDER',
      totalRows: totalDataRows,
      headerRow: headerRowIndex + 1,
      dataStartRow: dataStartRow + 1,
      todayDate: todayStr,
      updated: packBlcUpdated,
      skipped: packBlcSkipped,
    };
    report.steps.push(step1);

    // ─── LOGIC 2: Daily Inspection 'Apr' → extract clean PO# list ────
    const step2 = { name: 'Ekstrak PO# lolos inspeksi dari Daily Inspection', status: 'success', details: {} };

    const aprSheet = wbInspection.Sheets['Apr'];
    if (!aprSheet) {
      step2.status = 'error';
      step2.message = `Sheet "Apr" tidak ditemukan. Sheet yang tersedia: ${wbInspection.SheetNames.join(', ')}`;
      report.steps.push(step2);
      return NextResponse.json(
        { error: step2.message, report, warnings: report.warnings },
        { status: 400 }
      );
    }

    const aprData = XLSX.utils.sheet_to_json(aprSheet, { header: 1, defval: '' });
    if (aprData.length < 2) {
      step2.status = 'error';
      step2.message = 'Sheet "Apr" kosong atau tidak memiliki data yang cukup.';
      report.steps.push(step2);
      return NextResponse.json(
        { error: step2.message, report, warnings: report.warnings },
        { status: 400 }
      );
    }

    // Find PO# column
    let aprPoColIndex = -1;
    for (let i = 0; i < Math.min(aprData.length, 5); i++) {
      const row = aprData[i];
      for (let j = 0; j < (row ? row.length : 0); j++) {
        const cell = String(row[j] || '').trim();
        if (cell === 'PO#' || cell === 'PO# ' || cell === 'PO') {
          aprPoColIndex = j;
          break;
        }
      }
      if (aprPoColIndex >= 0) break;
    }

    if (aprPoColIndex < 0) {
      step2.status = 'error';
      step2.message = 'Kolom "PO#" tidak ditemukan di sheet "Apr". Periksa header kolom.';
      report.steps.push(step2);
      return NextResponse.json(
        { error: step2.message, report, warnings: report.warnings },
        { status: 400 }
      );
    }

    // Find data start
    let aprDataStartRow = 3;
    for (let i = 0; i < Math.min(aprData.length, 10); i++) {
      const row = aprData[i];
      if (row && row[0] !== undefined && row[0] !== '' && !isNaN(Number(row[0])) && Number(row[0]) >= 1) {
        aprDataStartRow = i;
        break;
      }
    }

    const passedPOs = new Set();
    const rejectedPOs = new Set();
    const rejectedDetails = [];
    let totalRows = 0;

    for (let i = aprDataStartRow; i < aprData.length; i++) {
      const row = aprData[i];
      if (!row || row.length === 0) continue;

      const poNumber = row[aprPoColIndex];
      if (poNumber === '' || poNumber === null || poNumber === undefined) continue;

      totalRows++;

      const hasReject = row.some(cell => {
        if (cell === '' || cell === null || cell === undefined) return false;
        return String(cell).toUpperCase().includes('REJECT');
      });

      const poStr = String(poNumber).trim();
      if (hasReject) {
        rejectedPOs.add(poStr);
        if (rejectedDetails.length < 10) {
          rejectedDetails.push(poStr);
        }
      } else {
        passedPOs.add(poStr);
      }
    }

    step2.details = {
      sheet: 'Apr',
      totalRows,
      passedCount: passedPOs.size,
      rejectedCount: rejectedPOs.size,
      sampleRejected: rejectedDetails,
    };
    report.steps.push(step2);

    // ─── LOGIC 3: Match PO# → set SI Blc to 0 (modify in-place) ──────
    const step3 = { name: 'Cocokkan PO# → set SI Blc = 0', status: 'success', details: {} };

    let siBlcUpdated = 0;
    let siBlcSkipped = 0;
    const matchedPOs = [];

    for (let i = dataStartRow; i < nbOrderData.length; i++) {
      const row = nbOrderData[i];
      if (!row || row.length === 0) continue;
      const poVal = String(row[poColIndex] || '').trim();
      if (poVal === '' || poVal === 'undefined' || poVal === 'null') {
        siBlcSkipped++;
        continue;
      }
      if (passedPOs.has(poVal)) {
        // Modify the original worksheet cell directly to preserve named ranges
        setCellValue(nbOrderSheet, i, siBlcColIndex, 0);
        siBlcUpdated++;
        if (matchedPOs.length < 10) matchedPOs.push(poVal);
      } else {
        siBlcSkipped++;
      }
    }

    step3.details = {
      sheet: 'NB ORDER',
      matchedCount: siBlcUpdated,
      unmatchedCount: siBlcSkipped,
      sampleMatched: matchedPOs,
    };
    report.steps.push(step3);

    // ─── Write workbook to buffer ──────────────
    // No need to recreate the sheet — we modified nbOrderSheet in-place,
    // which preserves named ranges, merged cells, formatting, etc.
    const outputBuffer = XLSX.write(wbStuffing, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    // Convert to base64 for JSON response
    const fileBase64 = outputBuffer.toString('base64');

    const outputSizeKB = (outputBuffer.length / 1024).toFixed(1);

    report.summary = {
      ...report.summary,
      todayDate: todayStr,
      outputFile: 'Hasil_Stuffing_Otomatis.xlsx',
      outputSizeKB,
    };

    // ─── Save to database ─────────────────────────────────
    try {
      await sql`
        INSERT INTO processing_history (
          stuffing_file_name, inspection_file_name, blc_file_name,
          pack_blc_updated, po_passed, po_rejected, si_blc_updated,
          output_size_kb, status
        ) VALUES (
          ${stuffingFile.name}, ${inspectionFile.name}, ${blcFile?.name || ''},
          ${packBlcUpdated}, ${passedPOs.size}, ${rejectedPOs.size}, ${siBlcUpdated},
          ${outputSizeKB}, 'success'
        )
      `;
    } catch (dbErr) {
      console.warn('DB save failed (non-critical):', dbErr.message);
      report.warnings.push(`Gagal menyimpan riwayat ke database: ${dbErr.message}`);
    }

    return NextResponse.json({
      report,
      fileBase64,
      fileName: 'Hasil_Stuffing_Otomatis.xlsx',
    });

  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json(
      { error: `Kesalahan pemrosesan: ${error.message}`, report, warnings: report.warnings },
      { status: 500 }
    );
  }
}
