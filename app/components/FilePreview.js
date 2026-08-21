'use client';

import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';

const MAX_PREVIEW_ROWS = 20;

/**
 * Collapsible Excel file preview — parses .xlsx client-side and shows a table.
 */
export default function FilePreview({ file, label, sheetName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [parsed, setParsed] = useState(false);

  const parseFile = useCallback(async () => {
    if (!file || parsed) return;
    setLoading(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetNames = workbook.SheetNames;
      setSheets(sheetNames);

      // Choose which sheet to show
      const target = sheetName
        ? sheetNames.find(s => s.toUpperCase() === sheetName.toUpperCase()) || sheetNames[0]
        : sheetNames[0];

      setActiveSheet(target);
      loadSheet(workbook, target);
      setParsed(true);
    } catch (err) {
      setError(`Gagal membaca file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [file, sheetName, parsed]);

  const loadSheet = (workbook, name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) return;
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    setTotalRows(data.length);

    if (data.length === 0) {
      setHeaders([]);
      setRows([]);
      return;
    }

    // First non-empty row as headers
    let headerIdx = 0;
    for (let i = 0; i < Math.min(data.length, 5); i++) {
      const row = data[i];
      if (row && row.some(c => c !== '' && c !== null && c !== undefined)) {
        headerIdx = i;
        break;
      }
    }

    const hdrs = (data[headerIdx] || []).map(String);
    setHeaders(hdrs);

    const dataRows = data.slice(headerIdx + 1, headerIdx + 1 + MAX_PREVIEW_ROWS);
    setRows(dataRows);
  };

  const handleSheetChange = (e) => {
    const name = e.target.value;
    setActiveSheet(name);
    // Re-parse for the new sheet
    if (file) {
      file.arrayBuffer().then(ab => {
        const wb = XLSX.read(ab, { type: 'array' });
        loadSheet(wb, name);
      });
    }
  };

  // Auto-parse when expanded for the first time
  useEffect(() => {
    if (isOpen && !parsed && !loading) {
      parseFile();
    }
  }, [isOpen, parsed, loading, parseFile]);

  if (!file) return null;

  return (
    <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700
                   hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          Preview: {label}
        </span>
        <span className="text-xs text-gray-400">{file.name}</span>
      </button>

      {/* Content */}
      {isOpen && (
        <div className="border-t border-gray-100">
          {loading && (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-gray-500">
              <span className="spinner !w-4 !h-4 !border-[1.5px] !border-gray-300 !border-t-indigo-500"></span>
              Membaca file...
            </div>
          )}

          {error && (
            <div className="p-4 text-sm text-red-600 bg-red-50">
              {error}
            </div>
          )}

          {!loading && !error && parsed && (
            <div className="overflow-hidden">
              {/* Sheet selector & meta */}
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {sheets.length > 1 && (
                    <select
                      value={activeSheet || ''}
                      onChange={handleSheetChange}
                      className="text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                      {sheets.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                  {sheets.length <= 1 && activeSheet && (
                    <span className="text-xs font-medium text-gray-600">Sheet: {activeSheet}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {totalRows} baris {headers.length > 0 ? `× ${headers.length} kolom` : ''}
                  {totalRows > MAX_PREVIEW_ROWS && ` (menampilkan ${MAX_PREVIEW_ROWS} pertama)`}
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="bg-gray-100">
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-8">#</th>
                      {headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap">
                          {h || <span className="text-gray-300">—</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} className="hover:bg-gray-50/50">
                        <td className="px-3 py-1.5 text-gray-400 border-b border-gray-100">{ri + 1}</td>
                        {headers.map((_, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-gray-700 border-b border-gray-100 whitespace-nowrap max-w-[200px] truncate">
                            {row[ci] !== undefined && row[ci] !== '' ? String(row[ci]) : <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={headers.length + 1} className="px-3 py-6 text-center text-gray-400">
                          Tidak ada data pada sheet ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
