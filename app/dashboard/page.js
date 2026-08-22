'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import FilePreview from '../components/FilePreview';
import ProcessingReport from '../components/ProcessingReport';
import Sidebar from '../components/Sidebar';
import DashboardHeader from '../components/DashboardHeader';
import RiwayatPage from '../components/RiwayatPage';
import ReferensiPage from '../components/ReferensiPage';
import { saveFile, restoreAllFiles, clearAllFiles } from '../../lib/fileStorage';

/* ─── File Card ─── */
function FileCard({ label, description, file, onFile, accept, validation }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = useCallback((e) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragIn = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragOut = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files?.[0]) onFile(e.dataTransfer.files[0]);
  }, [onFile]);

  const handleClick = () => inputRef.current?.click();
  const handleChange = (e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); };

  const hasFile = !!file && file.size > 0;
  const isReady = hasFile && !validation;

  let cardClass = 'file-card';
  if (validation) cardClass += ' file-card-error';
  else if (isReady) cardClass += ' file-card-ready';
  else if (isDragging) cardClass += ' file-card-active';

  const dotClass = validation ? 'file-card-status-dot-error'
    : isReady ? 'file-card-status-dot-ready'
    : isDragging ? 'file-card-status-dot-active'
    : 'file-card-status-dot-empty';

  return (
    <div>
      <div
        className={cardClass}
        onDragEnter={handleDragIn} onDragLeave={handleDragOut}
        onDragOver={handleDrag} onDrop={handleDrop}
        onClick={handleClick} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      >
        <div className="file-card-status">
          <span className={`file-card-status-dot ${dotClass}`} />
          {validation && (
            <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1 py-0.5 rounded">!</span>
          )}
        </div>

        <div className={`file-card-icon ${isReady ? '' : 'file-card-icon-empty'}`}>
          {isReady ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          )}
        </div>

        <p className="file-card-label">{label}</p>
        <p className="file-card-desc">{description}</p>

        {hasFile && (
          <div className="mt-2 text-center">
            <p className="file-card-name">{file.name}</p>
            <p className="file-card-size">{(file.size / 1024).toFixed(1)} KB · Klik untuk ganti</p>
          </div>
        )}

        <input ref={inputRef} type="file" accept={accept || '.xlsx,.xls'} className="hidden" onChange={handleChange} />
      </div>

      {validation && (
        <p className="mt-1.5 text-[11px] text-red-500 flex items-center gap-1.5 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {validation}
        </p>
      )}

      {hasFile && (
        <FilePreview file={file} label={label} sheetName={label.includes('Stuffing') ? 'NB ORDER' : null} />
      )}
    </div>
  );
}

/* ─── Validation ─── */
function validateFileClient(file, required = true) {
  if (!file || file.size === 0) {
    if (required) return 'File wajib diunggah.';
    return null;
  }
  const ext = file.name?.split('.').pop()?.toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls') return 'Format harus .xlsx atau .xls.';
  if (file.size > 50 * 1024 * 1024) return 'Ukuran file maks 50 MB.';
  return null;
}

/* ─── Flow Steps ─── */
const FLOW_STEPS = [
  { num: '1', title: 'Membaca sheet NB ORDER', desc: 'Mengisi tanggal hari ini pada kolom Pack. Blc yang bernilai 0.' },
  { num: '2', title: 'Membaca sheet Apr', desc: 'Mengumpulkan nomor PO yang tidak mengandung status REJECT.' },
  { num: '3', title: 'Mencocokkan PO ke NB ORDER', desc: 'Menyetel kolom SI Blc menjadi 0 untuk PO yang lolos inspeksi.' },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const [blcFile, setBlcFile] = useState(null);
  const [stuffingFile, setStuffingFile] = useState(null);
  const [inspectionFile, setInspectionFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [report, setReport] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [clientErrors, setClientErrors] = useState({});
  const [filesRestored, setFilesRestored] = useState(false);
  const [activePage, setActivePage] = useState('proses');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const authCookie = document.cookie.split('; ').find(c => c.startsWith('app_auth='));
    if (authCookie?.includes('logged_out')) {
      window.location.href = '/login';
      return;
    }
    restoreAllFiles().then((restored) => {
      if (restored.blc) setBlcFile(restored.blc);
      if (restored.stuffing) setStuffingFile(restored.stuffing);
      if (restored.inspection) setInspectionFile(restored.inspection);
      setFilesRestored(true);
    }).catch(() => setFilesRestored(true));
  }, []);

  const handleBlcFile = async (file) => {
    const err = validateFileClient(file, false);
    setClientErrors(prev => ({ ...prev, blc: err }));
    if (!err) { setBlcFile(file); await saveFile('blc', file).catch(() => {}); }
  };
  const handleStuffingFile = async (file) => {
    const err = validateFileClient(file, true);
    setClientErrors(prev => ({ ...prev, stuffing: err }));
    if (!err) { setStuffingFile(file); await saveFile('stuffing', file).catch(() => {}); }
  };
  const handleInspectionFile = async (file) => {
    const err = validateFileClient(file, true);
    setClientErrors(prev => ({ ...prev, inspection: err }));
    if (!err) { setInspectionFile(file); await saveFile('inspection', file).catch(() => {}); }
  };

  const allFilesSelected = blcFile && stuffingFile && inspectionFile;
  const hasClientErrors = Object.values(clientErrors).some(Boolean);

  const handleProcess = async () => {
    if (!allFilesSelected || hasClientErrors) return;

    const preErrors = {};
    const errS = validateFileClient(stuffingFile, true);
    const errI = validateFileClient(inspectionFile, true);
    if (errS) preErrors.stuffing = errS;
    if (errI) preErrors.inspection = errI;
    if (Object.keys(preErrors).length > 0) {
      setClientErrors(preErrors);
      setStatus('error');
      setMessage('Periksa file yang diunggah — ada file yang tidak valid.');
      return;
    }

    setStatus('processing');
    setMessage('Memproses file di Web Worker...');
    setReport(null);
    setWarnings([]);

    try {
      // ── Read files into ArrayBuffers for the worker ──
      setMessage('Membaca file...');
      const blcArrBuf = blcFile ? await blcFile.arrayBuffer() : null;
      const stuffingArrBuf = await stuffingFile.arrayBuffer();
      const inspectionArrBuf = await inspectionFile.arrayBuffer();

      // ── Create Web Worker and process off main thread ──
      setMessage('Memproses Excel di background (UI tetap responsif)...');
      const { outputBuffer, report: processingReport } = await new Promise((resolve, reject) => {
        const worker = new Worker(
          new URL('../../lib/excelWorker.js', import.meta.url),
          { type: 'module' }
        );
        worker.onmessage = (ev) => {
          worker.terminate();
          if (ev.data.error) reject(new Error(ev.data.error));
          else resolve(ev.data);
        };
        worker.onerror = (ev) => {
          worker.terminate();
          reject(new Error(ev.message || 'Web Worker error'));
        };
        worker.postMessage({
          blcBuffer: blcArrBuf,
          stuffingBuffer: stuffingArrBuf,
          inspectionBuffer: inspectionArrBuf,
          blcName: blcFile?.name || '',
          stuffingName: stuffingFile?.name || '',
          inspectionName: inspectionFile?.name || '',
        });
      });

      setReport(processingReport);
      setWarnings(processingReport.warnings || []);

      // ── Download the output file directly from browser ──
      const blob = new Blob([outputBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Hasil_Stuffing_Otomatis.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // ── Save report to DB in background (non-blocking) ──
      setMessage('Menyimpan riwayat...');
      fetch('/api/process-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report: processingReport,
          stuffingFileName: stuffingFile?.name || '',
          inspectionFileName: inspectionFile?.name || '',
          blcFileName: blcFile?.name || '',
        }),
      }).catch(() => {});

      setStatus('success');
      setMessage('File berhasil diproses dan diunduh!');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Terjadi kesalahan saat memproses file.');
    }
  };

  const handleReset = async () => {
    setBlcFile(null); setStuffingFile(null); setInspectionFile(null);
    setStatus('idle'); setMessage(''); setReport(null); setWarnings([]); setClientErrors({});
    await clearAllFiles().catch(() => {});
  };

  const handleLogout = async () => {
    await clearAllFiles().catch(() => {});
    document.cookie = 'app_auth=logged_out; path=/; max-age=31536000';
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 transition-all duration-280"
           style={{ marginLeft: sidebarCollapsed ? 68 : 260 }}>
        <DashboardHeader activePage={activePage} status={status} />

        <main className="flex-1 overflow-y-auto">
          <div className="p-5 max-w-[1200px]">

            {activePage === 'riwayat' ? (
              <RiwayatPage />
            ) : activePage === 'referensi' ? (
              <ReferensiPage />
            ) : (
              <>
                {/* Flow */}
                <div className="flow-card animate-fade-up">
                  <h2 className="flow-card-title">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                    </svg>
                    Alur Pemrosesan
                  </h2>
                  <ol className="space-y-0">
                    {FLOW_STEPS.map((s, i) => (
                      <li key={i} className="flow-step">
                        <span className="flow-step-num">{s.num}</span>
                        <span className="text-gray-700">
                          <strong>{s.title}</strong> — {s.desc}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Restore indicator */}
                {!filesRestored && (
                  <div className="mb-3 p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center gap-2 animate-fade-down">
                    <span className="spinner-xs" />
                    <span className="text-[11px] text-indigo-600 font-medium">Memulihkan file yang tersimpan...</span>
                  </div>
                )}

                {/* File Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                  <FileCard label="File BLC" description="Data sinkronisasi produksi" file={blcFile} onFile={handleBlcFile} validation={clientErrors.blc} />
                  <FileCard label="File Stuffing List" description="Data utama yang akan diubah" file={stuffingFile} onFile={handleStuffingFile} validation={clientErrors.stuffing} />
                  <FileCard label="File Daily Inspection" description="Data referensi inspeksi" file={inspectionFile} onFile={handleInspectionFile} validation={clientErrors.inspection} />
                </div>

                {/* Status Message */}
                {message && (
                  <div className={`status-message ${status === 'processing' ? 'status-message-warning' : status === 'success' ? 'status-message-success' : 'status-message-error'}`}>
                    <div className="flex items-center gap-2">
                      {status === 'processing' && <span className="spinner-xs" />}
                      {status === 'success' && (
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                      {status === 'error' && (
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                      )}
                      <span>{message}</span>
                    </div>
                  </div>
                )}

                {/* Report */}
                {report && <ProcessingReport report={report} warnings={warnings} />}

                {/* Actions */}
                <div className="flex items-center justify-center gap-3 mt-5">
                  <button
                    onClick={handleProcess}
                    disabled={!allFilesSelected || status === 'processing' || hasClientErrors}
                    className="btn-primary"
                  >
                    {status === 'processing' ? (
                      <><span className="spinner" /> Memproses...</>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                        </svg>
                        Proses Sinkronisasi Data
                      </>
                    )}
                  </button>

                  {status !== 'idle' && status !== 'processing' && (
                    <button onClick={handleReset} className="btn-ghost">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                      </svg>
                      Reset
                    </button>
                  )}
                </div>

                {/* File Summary */}
                <div className="mt-6 card">
                  <div className="card-header">
                    <h3 className="card-title">Ringkasan File</h3>
                    <span className="text-[10px] text-gray-400">Tiga file yang diunggah</span>
                  </div>
                  <div className="card-body">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { key: 'blc', label: 'BLC', file: blcFile },
                        { key: 'stuffing', label: 'Stuffing List', file: stuffingFile },
                        { key: 'inspection', label: 'Daily Inspection', file: inspectionFile },
                      ].map(({ key, label, file }) => (
                        <div key={key} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${file?.size ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-700 text-[12px]">{label}</p>
                            <p className="text-gray-400 text-[11px] truncate-150">{file?.name || 'Belum dipilih'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
