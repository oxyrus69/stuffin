'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import FilePreview from '../components/FilePreview';
import ProcessingReport from '../components/ProcessingReport';
import Sidebar from '../components/Sidebar';
import DashboardHeader from '../components/DashboardHeader';
import RiwayatPage from '../components/RiwayatPage';
import ReferensiPage from '../components/ReferensiPage';
import { saveFile, restoreAllFiles, clearAllFiles } from '../../lib/fileStorage';

/* ────────────────────────────────────────────
   File Drop Zone Component
   ──────────────────────────────────────────── */
function FileDropZone({ label, description, file, onFile, accept, validation }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFile(e.dataTransfer.files[0]);
    }
  }, [onFile]);

  const handleClick = () => inputRef.current?.click();
  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFile(e.target.files[0]);
    }
  };

  const zoneClass = [
    'file-drop-zone',
    isDragging && 'active',
    file && 'has-file',
    validation && 'border-red-300',
  ].filter(Boolean).join(' ');

  return (
    <div>
      <div
        className={zoneClass}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept || '.xlsx,.xls'}
          className="hidden"
          onChange={handleChange}
        />

        {file ? (
          <>
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold text-gray-800 truncate max-w-[200px]">
                {file.name}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {(file.size / 1024).toFixed(1)} KB &middot; Klik untuk mengganti
            </p>
          </>
        ) : (
          <>
            <svg className="w-10 h-10 mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
            <p className="font-medium text-gray-700 mb-1">{label}</p>
            <p className="text-sm text-gray-500">{description}</p>
            <p className="text-xs text-gray-400 mt-2">Drag &amp; drop atau klik untuk memilih</p>
          </>
        )}
      </div>
      {validation && (
        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {validation}
        </p>
      )}
      <FilePreview file={file} label={label} sheetName={label.includes('Stuffing') ? 'NB ORDER' : label.includes('Inspection') ? 'Apr' : null} />
    </div>
  );
}

/* ────────────────────────────────────────────
   Client-side file validation
   ──────────────────────────────────────────── */
function validateFileClient(file, required = true) {
  if (!file || file.size === 0) {
    if (required) return 'File wajib diunggah.';
    return null;
  }
  const ext = file.name?.split('.').pop()?.toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls') {
    return 'Format harus .xlsx atau .xls.';
  }
  if (file.size > 50 * 1024 * 1024) {
    return 'Ukuran file maks 50 MB.';
  }
  return null;
}

/* ────────────────────────────────────────────
   Main Page
   ──────────────────────────────────────────── */
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

  // Auth check on mount + restore files from IndexedDB
  useEffect(() => {
    // Check auth cookie
    const authCookie = document.cookie.split('; ').find(c => c.startsWith('app_auth='));
    if (authCookie && authCookie.includes('logged_out')) {
      window.location.href = '/login';
      return;
    }
    // Restore files
    restoreAllFiles().then(restored => {
      if (restored.blc) setBlcFile(restored.blc);
      if (restored.stuffing) setStuffingFile(restored.stuffing);
      if (restored.inspection) setInspectionFile(restored.inspection);
      setFilesRestored(true);
    }).catch(() => setFilesRestored(true));
  }, []);

  // Client-side validation + save to IndexedDB on file selection
  const handleBlcFile = async (file) => {
    const err = validateFileClient(file, false);
    setClientErrors(prev => ({ ...prev, blc: err }));
    if (!err) {
      setBlcFile(file);
      await saveFile('blc', file).catch(() => {});
    }
  };

  const handleStuffingFile = async (file) => {
    const err = validateFileClient(file, true);
    setClientErrors(prev => ({ ...prev, stuffing: err }));
    if (!err) {
      setStuffingFile(file);
      await saveFile('stuffing', file).catch(() => {});
    }
  };

  const handleInspectionFile = async (file) => {
    const err = validateFileClient(file, true);
    setClientErrors(prev => ({ ...prev, inspection: err }));
    if (!err) {
      setInspectionFile(file);
      await saveFile('inspection', file).catch(() => {});
    }
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
    setMessage('Mengunggah dan memproses file...');
    setReport(null);
    setWarnings([]);

    try {
      const formData = new FormData();
      formData.append('blc', blcFile);
      formData.append('stuffing', stuffingFile);
      formData.append('inspection', inspectionFile);

      const response = await fetch('/api/process-excel', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      setReport(data.report || null);
      setWarnings(data.warnings || []);

      if (data.fileBase64) {
        const byteCharacters = atob(data.fileBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.fileName || 'Hasil_Stuffing_Otomatis.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }

      setStatus('success');
      setMessage('File berhasil diproses dan diunduh!');
    } catch (err) {
      console.error('Processing error:', err);
      setStatus('error');
      setMessage(err.message || 'Terjadi kesalahan saat memproses file.');
    }
  };

  const handleReset = async () => {
    setBlcFile(null);
    setStuffingFile(null);
    setInspectionFile(null);
    setStatus('idle');
    setMessage('');
    setReport(null);
    setWarnings([]);
    setClientErrors({});
    await clearAllFiles().catch(() => {});
  };

  const handleLogout = async () => {
    await clearAllFiles().catch(() => {});
    document.cookie = 'app_auth=logged_out; path=/; max-age=31536000';
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onLogout={handleLogout}
      />

      {/* Main area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300
                       ${sidebarCollapsed ? 'ml-[68px]' : 'ml-64'}`}>
        {/* Header */}
        <DashboardHeader activePage={activePage} status={status} />

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-6xl">

          {activePage === 'riwayat' ? (
            <RiwayatPage />
          ) : activePage === 'referensi' ? (
            <ReferensiPage />
          ) : (
            <>

            {/* Process Flow Info */}
            <div className="mb-6 p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl">
              <h2 className="text-sm font-semibold text-indigo-800 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                Alur Pemrosesan
              </h2>
              <ol className="text-sm text-indigo-700 space-y-1 list-decimal list-inside">
                <li>Membaca sheet <strong>&apos;NB ORDER&apos;</strong> &mdash; mengisi tanggal hari ini pada kolom <strong>Pack. Blc</strong> yang bernilai 0.</li>
                <li>Membaca sheet <strong>&apos;Apr&apos;</strong> &mdash; mengumpulkan nomor PO yang tidak mengandung status REJECT.</li>
                <li>Mencocokkan nomor PO lolos inspeksi ke sheet <strong>&apos;NB ORDER&apos;</strong> &mdash; mengatur kolom <strong>SI Blc</strong> menjadi 0.</li>
              </ol>
            </div>

            {/* Restore indicator */}
            {!filesRestored && (
              <div className="mb-4 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center gap-2">
                <span className="spinner !w-4 !h-4 !border-[1.5px] !border-indigo-300 !border-t-indigo-600"></span>
                <span className="text-xs text-indigo-600 font-medium">Memulihkan file yang tersimpan...</span>
              </div>
            )}

            {/* File Upload Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
              <FileDropZone
                label="File BLC"
                description="Data sinkronisasi produksi"
                file={blcFile}
                onFile={handleBlcFile}
                validation={clientErrors.blc}
              />
              <FileDropZone
                label="File Stuffing List"
                description="Data utama yang akan diubah"
                file={stuffingFile}
                onFile={handleStuffingFile}
                validation={clientErrors.stuffing}
              />
              <FileDropZone
                label="File Daily Inspection"
                description="Data referensi inspeksi"
                file={inspectionFile}
                onFile={handleInspectionFile}
                validation={clientErrors.inspection}
              />
            </div>

            {/* Status Message */}
            {message && (
              <div className={`mb-5 p-4 rounded-xl text-sm font-medium ${
                status === 'processing' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                'bg-red-50 text-red-700 border border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {status === 'processing' && <span className="spinner !border-amber-300 !border-t-amber-600"></span>}
                  {message}
                </div>
              </div>
            )}

            {/* Processing Report */}
            {report && <ProcessingReport report={report} warnings={warnings} />}

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={handleProcess}
                disabled={!allFilesSelected || status === 'processing' || hasClientErrors}
                className="btn-process"
              >
                {status === 'processing' ? (
                  <>
                    <span className="spinner"></span>
                    Memproses...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                    </svg>
                    Proses Sinkronisasi Data
                  </>
                )}
              </button>

              {status !== 'idle' && status !== 'processing' && (
                <button
                  onClick={handleReset}
                  className="px-6 py-3.5 font-medium text-gray-600 bg-gray-100 rounded-xl
                             hover:bg-gray-200 transition-all duration-200 active:scale-[0.98]"
                >
                  Reset
                </button>
              )}
            </div>

            {/* File Summary */}
            <div className="mt-8 p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ringkasan File</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-2.5 h-2.5 rounded-full ${blcFile ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                  <div>
                    <p className="font-medium text-gray-700">BLC</p>
                    <p className="text-gray-500 text-xs truncate max-w-[150px]">{blcFile?.name || 'Belum dipilih'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-2.5 h-2.5 rounded-full ${stuffingFile ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                  <div>
                    <p className="font-medium text-gray-700">Stuffing List</p>
                    <p className="text-gray-500 text-xs truncate max-w-[150px]">{stuffingFile?.name || 'Belum dipilih'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-2.5 h-2.5 rounded-full ${inspectionFile ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                  <div>
                    <p className="font-medium text-gray-700">Daily Inspection</p>
                    <p className="text-gray-500 text-xs truncate max-w-[150px]">{inspectionFile?.name || 'Belum dipilih'}</p>
                  </div>
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
