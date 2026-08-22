/**
 * Client-side Excel processor.
 * Runs entirely in the browser using the xlsx library — no file upload needed.
 * This avoids Vercel's ~4.5MB body size limit since files never leave the client.
 */
import * as XLSX from 'xlsx';

/**
 * Set a cell value directly on the worksheet object (in-place).
 * Preserves named ranges, merged cells, formatting, etc.
 */
function setCellValue(sheet, rowIdx, colIdx, value) {
  const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
  const cell = sheet[addr];
  if (cell) {
    cell.v = value;
    cell.t = typeof value === 'number' ? 'n' : 's';
  } else {
    sheet[addr] = {
      v: value,
      t: typeof value === 'number' ? 'n' : 's',
    };
  }
}

/**
 * Process all three Excel files and return { outputBuffer, report }.
 *
 * @param {File} blcFile        - BLC file (optional)
 * @param {File} stuffingFile   - Stuffing List file (required)
 * @param {File} inspectionFile - Daily Inspection file (required)
 * @returns {Promise<{ outputBuffer: ArrayBuffer, report: object }>}
 */
export async function processExcel(blcFile, stuffingFile, inspectionFile) {
  const report = { steps: [], warnings: [], summary: {} };

  // ─── Read files as ArrayBuffer ────────────────
  const stuffingBuffer = await stuffingFile.arrayBuffer();
  const inspectionBuffer = await inspectionFile.arrayBuffer();
  let blcBuffer = null;
  if (blcFile && blcFile.size > 0) {
    blcBuffer = await blcFile.arrayBuffer();
  }

  // ─── Parse workbooks ──────────────────────────
  let wbStuffing, wbInspection, wbBlc;
  try {
    wbStuffing = XLSX.read(stuffingBuffer, { type: 'array' });
  } catch (e) {
    if (e.message && e.message.toLowerCase().includes('password')) {
      throw new Error('File Stuffing List terenkripsi (password-protected). Silakan buka file di Excel → tab File → Info → Protect Workbook → Remove Password, lalu upload ulang.');
    }
    throw new Error(`Gagal membaca file Stuffing List: ${e.message}`);
  }
  try {
    wbInspection = XLSX.read(inspectionBuffer, { type: 'array' });
  } catch (e) {
    if (e.message && e.message.toLowerCase().includes('password')) {
      throw new Error('File Daily Inspection terenkripsi (password-protected). Silakan buka file di Excel → tab File → Info → Protect Workbook → Remove Password, lalu upload ulang.');
    }
    throw new Error(`Gagal membaca file Daily Inspection: ${e.message}`);
  }
  if (blcBuffer) {
    try {
      wbBlc = XLSX.read(blcBuffer, { type: 'array' });
    } catch (e) {
      if (e.message && e.message.toLowerCase().includes('password')) {
        report.warnings.push('File BLC terenkripsi (password-protected). Silakan buka file di Excel → tab File → Info → Protect Workbook → Remove Password, lalu upload ulang. Melanjutkan tanpa BLC.');
      } else {
        report.warnings.push(`Gagal membaca file BLC: ${e.message}. Melanjutkan tanpa BLC.`);
      }
    }
  }

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
    throw new Error(step1.message);
  }

  const nbOrderData = XLSX.utils.sheet_to_json(nbOrderSheet, { header: 1, defval: '' });
  if (nbOrderData.length < 1) {
    step1.status = 'error';
    step1.message = 'Sheet "NB ORDER" kosong.';
    report.steps.push(step1);
    throw new Error(step1.message);
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
    step1.message = 'Kolom "Pack. Blc" tidak ditemukan di sheet "NB ORDER".';
    report.steps.push(step1);
    throw new Error(step1.message);
  }
  if (poColIndex < 0) {
    step1.status = 'error';
    step1.message = 'Kolom "MAN.PO#" tidak ditemukan di sheet "NB ORDER".';
    report.steps.push(step1);
    throw new Error(step1.message);
  }
  if (siBlcColIndex < 0) {
    step1.status = 'error';
    step1.message = 'Kolom "SI Blc" tidak ditemukan di sheet "NB ORDER".';
    report.steps.push(step1);
    throw new Error(step1.message);
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  let packBlcUpdated = 0;
  let packBlcSkipped = 0;
  const dataStartRow = headerRowIndex + 1;
  const totalDataRows = nbOrderData.length - dataStartRow;

  for (let i = dataStartRow; i < nbOrderData.length; i++) {
    const row = nbOrderData[i];
    if (!row || row.length === 0) continue;
    const packVal = row[packBlcColIndex];
    if (packVal === 0 || packVal === '0' || packVal === 0.0) {
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

  // ─── LOGIC 2: Daily Inspection → extract clean PO# list ────
  // Dynamically find the inspection sheet that contains a 'PO#' column
  const step2 = { name: 'Ekstrak PO# lolos inspeksi dari Daily Inspection', status: 'success', details: {} };

  let inspectionSheetName = null;
  let inspectionData = null;
  let aprPoColIndex = -1;

  // Priority: month name sheets first (Apr, May, Jun, Jul, Aug, etc.), then any sheet
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sortedSheetNames = [...wbInspection.SheetNames].sort((a, b) => {
    const aIdx = monthNames.indexOf(a);
    const bIdx = monthNames.indexOf(b);
    if (aIdx >= 0 && bIdx >= 0) return bIdx - aIdx; // newest month first
    if (aIdx >= 0) return -1;
    if (bIdx >= 0) return 1;
    return 0;
  });

  for (const sheetName of sortedSheetNames) {
    const sheet = wbInspection.Sheets[sheetName];
    if (!sheet) continue;
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (data.length < 2) continue;

    // Search for PO# column in the first 5 rows
    let poCol = -1;
    for (let i = 0; i < Math.min(data.length, 5); i++) {
      const row = data[i];
      for (let j = 0; j < (row ? row.length : 0); j++) {
        const cell = String(row[j] || '').trim();
        if (cell === 'PO#' || cell === 'PO# ' || cell === 'PO' || cell === 'MAN.PO#') {
          poCol = j;
          break;
        }
      }
      if (poCol >= 0) break;
    }

    if (poCol >= 0) {
      inspectionSheetName = sheetName;
      inspectionData = data;
      aprPoColIndex = poCol;
      break;
    }
  }

  if (!inspectionSheetName) {
    step2.status = 'error';
    step2.message = `Kolom "PO#" tidak ditemukan di semua sheet. Sheet yang tersedia: ${wbInspection.SheetNames.join(', ')}`;
    report.steps.push(step2);
    throw new Error(step2.message);
  }

  const aprData = inspectionData;

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
    sheet: inspectionSheetName,
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

  // ─── Write output workbook to ArrayBuffer ──────
  const outputBuffer = XLSX.write(wbStuffing, {
    type: 'array',
    bookType: 'xlsx',
  });

  const outputSizeKB = (outputBuffer.byteLength / 1024).toFixed(1);

  report.summary = {
    ...report.summary,
    todayDate: todayStr,
    outputFile: 'Hasil_Stuffing_Otomatis.xlsx',
    outputSizeKB,
    blcFileName: blcFile?.name || '',
    stuffingFileName: stuffingFile.name,
    inspectionFileName: inspectionFile.name,
    packBlcUpdated,
    poPassed: passedPOs.size,
    poRejected: rejectedPOs.size,
    siBlcUpdated,
  };

  return { outputBuffer, report };
}
