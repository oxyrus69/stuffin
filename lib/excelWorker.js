/**
 * Web Worker for Excel processing.
 * Runs entirely off the main thread to prevent "Page Unresponsive" dialogs.
 * 
 * Communication via postMessage:
 *   Input:  { blcBuffer, stuffingBuffer, inspectionBuffer, blcName, stuffingName, inspectionName }
 *   Output: { outputBuffer, report } or { error: string }
 */
import * as XLSX from 'xlsx';

/**
 * Set a cell value directly on the worksheet object (in-place).
 */
function setCellValue(sheet, rowIdx, colIdx, value) {
  const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
  const cell = sheet[addr];
  if (cell) {
    cell.v = value;
    cell.t = typeof value === 'number' ? 'n' : 's';
  } else {
    sheet[addr] = { v: value, t: typeof value === 'number' ? 'n' : 's' };
  }
}

self.onmessage = function (e) {
  const { blcBuffer, stuffingBuffer, inspectionBuffer, blcName, stuffingName, inspectionName } = e.data;

  try {
    const report = { steps: [], warnings: [], summary: {} };

    // ─── Parse workbooks ──────────────────────────
    let wbStuffing, wbInspection, wbBlc;
    try {
      wbStuffing = XLSX.read(stuffingBuffer, { type: 'array' });
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('password')) {
        throw new Error('File Stuffing List terenkripsi (password-protected). Silakan buka file di Excel → tab File → Info → Protect Workbook → Remove Password, lalu upload ulang.');
      }
      throw new Error(`Gagal membaca file Stuffing List: ${err.message}`);
    }
    try {
      wbInspection = XLSX.read(inspectionBuffer, { type: 'array' });
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('password')) {
        throw new Error('File Daily Inspection terenkripsi (password-protected). Silakan buka file di Excel → tab File → Info → Protect Workbook → Remove Password, lalu upload ulang.');
      }
      throw new Error(`Gagal membaca file Daily Inspection: ${err.message}`);
    }
    if (blcBuffer) {
      try {
        wbBlc = XLSX.read(blcBuffer, { type: 'array' });
      } catch (err) {
        if (err.message && err.message.toLowerCase().includes('password')) {
          report.warnings.push('File BLC terenkripsi (password-protected). Melanjutkan tanpa BLC.');
        } else {
          report.warnings.push(`Gagal membaca file BLC: ${err.message}. Melanjutkan tanpa BLC.`);
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
      throw new Error(`Sheet "NB ORDER" tidak ditemukan. Sheet yang tersedia: ${wbStuffing.SheetNames.join(', ')}`);
    }

    const nbOrderData = XLSX.utils.sheet_to_json(nbOrderSheet, { header: 1, defval: '' });
    if (nbOrderData.length < 1) throw new Error('Sheet "NB ORDER" kosong.');

    // Find header row and columns
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

    if (headerRowIndex < 0 || packBlcColIndex < 0) throw new Error('Kolom "Pack. Blc" tidak ditemukan di sheet "NB ORDER".');
    if (poColIndex < 0) throw new Error('Kolom "MAN.PO#" tidak ditemukan di sheet "NB ORDER".');
    if (siBlcColIndex < 0) throw new Error('Kolom "SI Blc" tidak ditemukan di sheet "NB ORDER".');

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let packBlcUpdated = 0, packBlcSkipped = 0;
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

    step1.details = { sheet: 'NB ORDER', totalRows: totalDataRows, headerRow: headerRowIndex + 1, dataStartRow: dataStartRow + 1, todayDate: todayStr, updated: packBlcUpdated, skipped: packBlcSkipped };
    report.steps.push(step1);

    // ─── LOGIC 2: Daily Inspection → extract clean PO# list (dynamic sheet) ────
    const step2 = { name: 'Ekstrak PO# lolos inspeksi dari Daily Inspection', status: 'success', details: {} };

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const sortedSheetNames = [...wbInspection.SheetNames].sort((a, b) => {
      const aIdx = monthNames.indexOf(a), bIdx = monthNames.indexOf(b);
      if (aIdx >= 0 && bIdx >= 0) return bIdx - aIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;
      return 0;
    });

    let inspectionSheetName = null, inspectionData = null, aprPoColIndex = -1;
    for (const sheetName of sortedSheetNames) {
      const sheet = wbInspection.Sheets[sheetName];
      if (!sheet) continue;
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (data.length < 2) continue;
      let poCol = -1;
      for (let i = 0; i < Math.min(data.length, 5); i++) {
        const row = data[i];
        for (let j = 0; j < (row ? row.length : 0); j++) {
          const cell = String(row[j] || '').trim();
          if (cell === 'PO#' || cell === 'PO# ' || cell === 'PO' || cell === 'MAN.PO#') { poCol = j; break; }
        }
        if (poCol >= 0) break;
      }
      if (poCol >= 0) { inspectionSheetName = sheetName; inspectionData = data; aprPoColIndex = poCol; break; }
    }

    if (!inspectionSheetName) throw new Error(`Kolom "PO#" tidak ditemukan. Sheet: ${wbInspection.SheetNames.join(', ')}`);

    const aprData = inspectionData;
    let aprDataStartRow = 3;
    for (let i = 0; i < Math.min(aprData.length, 10); i++) {
      const row = aprData[i];
      if (row && row[0] !== undefined && row[0] !== '' && !isNaN(Number(row[0])) && Number(row[0]) >= 1) { aprDataStartRow = i; break; }
    }

    const passedPOs = new Set(), rejectedPOs = new Set(), rejectedDetails = [];
    let totalRows = 0;
    for (let i = aprDataStartRow; i < aprData.length; i++) {
      const row = aprData[i];
      if (!row || row.length === 0) continue;
      const poNumber = row[aprPoColIndex];
      if (poNumber === '' || poNumber === null || poNumber === undefined) continue;
      totalRows++;
      const hasReject = row.some(cell => cell !== '' && cell !== null && cell !== undefined && String(cell).toUpperCase().includes('REJECT'));
      const poStr = String(poNumber).trim();
      if (hasReject) { rejectedPOs.add(poStr); if (rejectedDetails.length < 10) rejectedDetails.push(poStr); }
      else { passedPOs.add(poStr); }
    }

    step2.details = { sheet: inspectionSheetName, totalRows, passedCount: passedPOs.size, rejectedCount: rejectedPOs.size, sampleRejected: rejectedDetails };
    report.steps.push(step2);

    // ─── LOGIC 3: Match PO# → set SI Blc to 0 ──────
    const step3 = { name: 'Cocokkan PO# → set SI Blc = 0', status: 'success', details: {} };
    let siBlcUpdated = 0, siBlcSkipped = 0;
    const matchedPOs = [];
    for (let i = dataStartRow; i < nbOrderData.length; i++) {
      const row = nbOrderData[i];
      if (!row || row.length === 0) continue;
      const poVal = String(row[poColIndex] || '').trim();
      if (poVal === '' || poVal === 'undefined' || poVal === 'null') { siBlcSkipped++; continue; }
      if (passedPOs.has(poVal)) { setCellValue(nbOrderSheet, i, siBlcColIndex, 0); siBlcUpdated++; if (matchedPOs.length < 10) matchedPOs.push(poVal); }
      else { siBlcSkipped++; }
    }

    step3.details = { sheet: 'NB ORDER', matchedCount: siBlcUpdated, unmatchedCount: siBlcSkipped, sampleMatched: matchedPOs };
    report.steps.push(step3);

    // ─── Write output workbook ──────
    const outputBuffer = XLSX.write(wbStuffing, { type: 'array', bookType: 'xlsx' });
    const outputSizeKB = (outputBuffer.byteLength / 1024).toFixed(1);

    report.summary = {
      ...report.summary,
      todayDate: todayStr,
      outputFile: 'Hasil_Stuffing_Otomatis.xlsx',
      outputSizeKB,
      blcFileName: blcName || '',
      stuffingFileName: stuffingName || '',
      inspectionFileName: inspectionName || '',
      packBlcUpdated,
      poPassed: passedPOs.size,
      poRejected: rejectedPOs.size,
      siBlcUpdated,
    };

    // Send result back — transfer the output buffer for zero-copy
    self.postMessage({ outputBuffer, report }, [outputBuffer]);

  } catch (error) {
    self.postMessage({ error: error.message || 'Terjadi kesalahan saat memproses file.' });
  }
};
