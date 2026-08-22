'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';

const INITIAL_ROWS = 50;
const BATCH_SIZE = 50;

function colLetter(idx) {
  let s = '';
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/* ────────────────────────────────────────────
   Pure Spreadsheet Table — no toolbar, no logic
   ──────────────────────────────────────────── */
function SpreadsheetTable({ headers, rows, colWidths, setColWidths, selectedCell, setSelectedCell, isModal }) {
  const scrollRef = useRef(null);

  const handleColResize = (colIdx) => {
    let maxLen = String(headers[colIdx] || '').length;
    for (let ri = 0; ri < Math.min(rows.length, 200); ri++) {
      const cellLen = String(rows[ri]?.[colIdx] || '').length;
      if (cellLen > maxLen) maxLen = cellLen;
    }
    setColWidths(w => ({ ...w, [colIdx]: Math.min(400, Math.max(50, maxLen * 8 + 24)) }));
  };

  return (
    <div ref={scrollRef} className="overflow-auto bg-white flex-1 min-h-0">
      <table className="border-collapse min-w-max" style={{ tableLayout: 'fixed' }}>
        <thead className="sticky top-0 z-10">
          {/* Column letter row */}
          <tr className="bg-gray-200/80">
            <th className="w-[50px] min-w-[50px] px-1 py-1 text-[10px] font-bold text-gray-500 text-center
                           border border-gray-300 bg-gray-200/80 sticky left-0 z-20">#</th>
            {headers.map((_, i) => (
              <th
                key={i}
                className="px-2 py-1 text-[10px] font-bold text-gray-500 text-center
                           border border-gray-300 bg-gray-200/80 whitespace-nowrap select-none"
                style={{ width: colWidths[i] || 120 }}
                onDoubleClick={() => handleColResize(i)}
                title="Double-click untuk auto-fit lebar kolom"
              >
                {colLetter(i)}
              </th>
            ))}
          </tr>
          {/* Header name row */}
          <tr className="bg-gray-100">
            <th className="w-[50px] min-w-[50px] px-1 py-1.5 text-[10px] font-bold text-gray-400 text-center
                           border border-gray-300 bg-gray-100 sticky left-0 z-20">&nbsp;</th>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 text-left
                           border border-gray-300 bg-gray-100 whitespace-nowrap overflow-hidden text-ellipsis"
                style={{ width: colWidths[i] || 120 }}
                title={h || ''}
              >
                {h || <span className="text-gray-300 italic">—</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="group">
              <td className="px-1 py-1 text-[10px] font-mono text-gray-400 text-center
                             border border-gray-200 bg-gray-50 sticky left-0 z-10
                             group-hover:bg-indigo-50 group-hover:text-indigo-600">
                {ri + 2}
              </td>
              {headers.map((_, ci) => {
                const val = row[ci];
                const isSelected = selectedCell?.row === ri && selectedCell?.col === ci;
                const display = val !== undefined && val !== '' ? String(val) : '';
                return (
                  <td
                    key={ci}
                    onClick={() => setSelectedCell({ row: ri, col: ci })}
                    className={`px-2.5 py-1.5 text-xs border border-gray-200 whitespace-nowrap
                               cursor-default transition-colors
                               ${isSelected
                                 ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400 font-medium text-indigo-900'
                                 : 'hover:bg-gray-50 text-gray-700'
                               }`}
                    style={{ width: colWidths[ci] || 120 }}
                    title={display}
                  >
                    {display || <span className="text-gray-300">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length + 1} className="px-3 py-8 text-center text-gray-400 text-sm">
                {isModal ? 'Tidak ada data yang cocok dengan filter.' : 'Tidak ada data pada sheet ini.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────── */
export default function FilePreview({ file, label, sheetName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS);
  const [totalRows, setTotalRows] = useState(0);
  const [parsed, setParsed] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [colWidths, setColWidths] = useState({});

  // Modal-specific state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCol, setFilterCol] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const parseFile = useCallback(async () => {
    if (!file || parsed) return;
    setLoading(true);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      setSheets(workbook.SheetNames);
      const target = sheetName
        ? workbook.SheetNames.find(s => s.toUpperCase() === sheetName.toUpperCase()) || workbook.SheetNames[0]
        : workbook.SheetNames[0];
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
    setVisibleCount(INITIAL_ROWS);
    setSearchQuery('');
    setFilterCol('');
    setSortBy('');
    setSelectedCell(null);

    if (data.length === 0) {
      setHeaders([]);
      setAllRows([]);
      setColWidths({});
      return;
    }

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
    const dataRows = data.slice(headerIdx + 1);
    setAllRows(dataRows);

    const widths = {};
    for (let ci = 0; ci < hdrs.length; ci++) {
      const headerLen = String(hdrs[ci] || '').length;
      let maxLen = headerLen;
      for (let ri = 0; ri < Math.min(dataRows.length, 100); ri++) {
        const cellLen = String(dataRows[ri]?.[ci] || '').length;
        if (cellLen > maxLen) maxLen = cellLen;
      }
      widths[ci] = Math.min(280, Math.max(60, maxLen * 8 + 24));
    }
    setColWidths(widths);
  };

  const handleSheetChange = (e) => {
    const name = e.target.value;
    setActiveSheet(name);
    if (file) {
      file.arrayBuffer().then(ab => {
        const wb = XLSX.read(ab, { type: 'array' });
        loadSheet(wb, name);
      });
    }
  };

  // Filtered + searched + sorted rows for modal
  const filteredRows = useMemo(() => {
    let rows = allRows;

    // Global search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(row =>
        row.some(cell => cell !== undefined && cell !== null && String(cell).toLowerCase().includes(q))
      );
    }

    // Column-specific filter
    if (filterCol !== '' && searchQuery) {
      const ci = parseInt(filterCol);
      const q = searchQuery.toLowerCase();
      rows = allRows.filter(row =>
        row[ci] !== undefined && row[ci] !== null && String(row[ci]).toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy !== '') {
      const ci = parseInt(sortBy);
      rows = [...rows].sort((a, b) => {
        const va = a[ci] ?? '';
        const vb = b[ci] ?? '';
        const na = Number(va);
        const nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) {
          return sortDir === 'asc' ? na - nb : nb - na;
        }
        const cmp = String(va).localeCompare(String(vb), 'id');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  }, [allRows, searchQuery, filterCol, sortBy, sortDir]);

  // Inline visible rows (no filter in inline)
  const inlineVisibleRows = allRows.slice(0, visibleCount);

  // Load more for inline
  const handleInlineScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 200 && visibleCount < allRows.length) {
      setVisibleCount(prev => Math.min(prev + BATCH_SIZE, allRows.length));
    }
  };

  // Modal visible rows (with filter)
  const [modalVisibleCount, setModalVisibleCount] = useState(INITIAL_ROWS);
  const modalVisibleRows = filteredRows.slice(0, modalVisibleCount);

  const handleModalScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 200 && modalVisibleCount < filteredRows.length) {
      setModalVisibleCount(prev => Math.min(prev + BATCH_SIZE, filteredRows.length));
    }
  };

  useEffect(() => {
    if (isOpen && !parsed && !loading) parseFile();
  }, [isOpen, parsed, loading, parseFile]);

  // Reset modal state when opening
  useEffect(() => {
    if (isModalOpen) {
      setModalVisibleCount(INITIAL_ROWS);
      setSearchQuery('');
      setFilterCol('');
      setSortBy('');
      setSortDir('');
    }
  }, [isModalOpen]);

  // ESC to close modal
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') setIsModalOpen(false); };
    if (isModalOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  if (!file) return null;

  const activeColIdx = filterCol !== '' ? parseInt(filterCol) : -1;

  return (
    <>
      {/* ═══ Inline Preview ═══ */}
      <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125" />
            </svg>
            Preview: {label}
          </span>
          <span className="text-xs text-gray-400">{file.name}</span>
        </button>

        {isOpen && (
          <div className="border-t border-gray-100">
            {loading && (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-gray-500">
                <span className="spinner !w-4 !h-4 !border-[1.5px] !border-gray-300 !border-t-indigo-500"></span>
                Membaca file...
              </div>
            )}
            {error && <div className="p-4 text-sm text-red-600 bg-red-50">{error}</div>}

            {!loading && !error && parsed && (
              <div className="flex flex-col" style={{ height: '350px' }}>
                {/* Inline toolbar — sheet selector + info + expand button */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
                  <div className="flex items-center gap-3">
                    {sheets.length > 1 ? (
                      <select value={activeSheet || ''} onChange={handleSheetChange}
                        className="text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer">
                        {sheets.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : activeSheet ? (
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{activeSheet}</span>
                    ) : null}
                    {selectedCell && (
                      <span className="text-xs font-mono text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                        {colLetter(selectedCell.col)}{selectedCell.row + 2}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-400">
                      {allRows.length} baris × {headers.length} kolom
                    </span>
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white
                                 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-sm
                                 hover:from-indigo-700 hover:to-purple-700 hover:shadow-md transition-all active:scale-95"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                      </svg>
                      Perluas
                    </button>
                  </div>
                </div>

                {/* Inline table (no filter, simple scroll) */}
                <div className="overflow-auto flex-1 min-h-0" onScroll={handleInlineScroll}>
                  <SpreadsheetTable
                    headers={headers}
                    rows={inlineVisibleRows}
                    colWidths={colWidths}
                    setColWidths={setColWidths}
                    selectedCell={selectedCell}
                    setSelectedCell={setSelectedCell}
                  />
                </div>

                {visibleCount < allRows.length && (
                  <div className="shrink-0 bg-gradient-to-t from-gray-100 to-transparent py-2 text-center border-t border-gray-100">
                    <button
                      onClick={() => setVisibleCount(prev => Math.min(prev + BATCH_SIZE * 2, allRows.length))}
                      className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 bg-white px-3 py-1 rounded-full border border-indigo-200"
                    >
                      Muat lebih ({visibleCount}/{allRows.length})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Fullscreen Modal ═══ */}
      {isModalOpen && parsed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[98vw] h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-800">{label}</h2>
                  <p className="text-xs text-gray-400">
                    {file.name} &middot; {filteredRows.length}
                    {searchQuery || filterCol !== '' ? ` dari ${allRows.length}` : ''} baris × {headers.length} kolom
                  </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Tutup (Esc)">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Toolbar — Search, Filter, Sort, Sheet */}
            <div className="flex items-center gap-3 px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setModalVisibleCount(INITIAL_ROWS); }}
                  placeholder="Cari data..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setFilterCol(''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Filter by column */}
              {searchQuery && (
                <select
                  value={filterCol}
                  onChange={(e) => { setFilterCol(e.target.value); setModalVisibleCount(INITIAL_ROWS); }}
                  className="text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1.5
                             focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
                >
                  <option value="">Semua kolom</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>{colLetter(i)} — {h || 'Kolom ' + (i+1)}</option>
                  ))}
                </select>
              )}

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setSortDir('asc'); }}
                className="text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1.5
                           focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
              >
                <option value="">Urutkan...</option>
                {headers.map((h, i) => (
                  <option key={i} value={i}>{colLetter(i)} — {h || 'Kolom ' + (i+1)}</option>
                ))}
              </select>
              {sortBy !== '' && (
                <button
                  onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-600
                             bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  title={sortDir === 'asc' ? 'Ascend → Descend' : 'Descend → Ascend'}
                >
                  {sortDir === 'asc' ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13-6L16.5 19m0 0L12 14.5m4.5 4.5V7.5" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13-6L16.5 19m0 0L12 14.5m4.5 4.5V7.5" />
                    </svg>
                  )}
                  {sortDir === 'asc' ? ' A→Z' : ' Z→A'}
                </button>
              )}

              {/* Sheet selector (only in modal if multiple sheets) */}
              {sheets.length > 1 && (
                <>
                  <div className="w-px h-5 bg-gray-200"></div>
                  <select value={activeSheet || ''} onChange={handleSheetChange}
                    className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1.5
                               focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer">
                    {sheets.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </>
              )}

              {/* Cell address */}
              {selectedCell && (
                <span className="text-xs font-mono text-gray-500 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200">
                  {colLetter(selectedCell.col)}{selectedCell.row + 2}
                </span>
              )}

              {/* Reset filters */}
              {(searchQuery || filterCol !== '' || sortBy !== '') && (
                <button
                  onClick={() => { setSearchQuery(''); setFilterCol(''); setSortBy(''); setSortDir('asc'); setModalVisibleCount(INITIAL_ROWS); }}
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600
                             bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reset
                </button>
              )}
            </div>

            {/* Modal Body — Table */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="flex-1 min-h-0 overflow-auto" onScroll={handleModalScroll}>
                <SpreadsheetTable
                  headers={headers}
                  rows={modalVisibleRows}
                  colWidths={colWidths}
                  setColWidths={setColWidths}
                  selectedCell={selectedCell}
                  setSelectedCell={setSelectedCell}
                  isModal
                />
              </div>

              {/* Load more in modal */}
              {modalVisibleCount < filteredRows.length && (
                <div className="shrink-0 bg-gradient-to-t from-gray-100 to-transparent py-2 text-center border-t border-gray-100">
                  <button
                    onClick={() => setModalVisibleCount(prev => Math.min(prev + BATCH_SIZE * 3, filteredRows.length))}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-white px-4 py-1.5 rounded-full border border-indigo-200 shadow-sm"
                  >
                    Muat lebih banyak ({modalVisibleCount} / {filteredRows.length})
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-2xl shrink-0">
              <span className="text-xs text-gray-400">
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">Esc</kbd> tutup
                &middot; Double-click huruf kolom untuk auto-fit
                &middot; Klik sel untuk select
              </span>
              <button onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
