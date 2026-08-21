'use client';

import { useState, useCallback, useRef } from 'react';
import FilePreview from './components/FilePreview';
import ProcessingReport from './components/ProcessingReport';

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
   Status Badge Component
   ──────────────────────────────────────────── */
function StatusBadge({ status }) {
  const styles = {
    idle: 'bg-gray-100 text-gray-600',
    processing: 'bg-amber-100 text-amber-700',
    success: 'bg-emerald-100 text-emerald-700',
    error: 'bg-red-100 text-red-700',
  };

  const labels = {
    idle: 'Siap',
    processing: 'Memproses...',
    success: 'Selesai',
    error: 'Gagal',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
      {status === 'processing' && <span className="spinner !w-3.5 !h-3.5 !border-[1.5px]"></span>}
      {status === 'success' && (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      )}
      {status === 'error' && (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {labels[status]}
    </span>
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
  const [status, setStatus] = useState('idle'); // idle | processing | success | error
  const [message, setMessage] = useState('');
  const [report, setReport] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [clientErrors, setClientErrors] = useState({});

  // Client-side validation on file selection
  const handleBlcFile = (file) => {
    const err = validateFileClient(file, false);
    setClientErrors(prev => ({ ...prev, blc: err }));
    if (!err) setBlcFile(file);
  };

  const handleStuffingFile = (file) => {
    const err = validateFileClient(file, true);
    setClientErrors(prev => ({ ...prev, stuffing: err }));
    if (!err) setStuffingFile(file);
  };

  const handleInspectionFile = (file) => {
    const err = validateFileClient(file, true);
    setClientErrors(prev => ({ ...prev, inspection: err }));
    if (!err) setInspectionFile(file);
  };

  const allFilesSelected = blcFile && stuffingFile && inspectionFile;
  const hasClientErrors = Object.values(clientErrors).some(Boolean);

  const handleProcess = async () => {
    if (!allFilesSelected || hasClientErrors) return;

    // Pre-flight validation
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

      // Store report & warnings
      setReport(data.report || null);
      setWarnings(data.warnings || []);

      // Download the resulting file from base64
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

  const handleReset = () => {
    setBlcFile(null);
    setStuffingFile(null);
    setInspectionFile(null);
    setStatus('idle');
    setMessage('');
    setReport(null);
    setWarnings([]);
    setClientErrors({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/70 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125-.504-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125m1.5 3.75c-.621 0-1.125-.504-1.125-1.125" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Stuffing Data Processor</h1>
                <p className="text-sm text-gray-500">Otomatisasi Sinkronisasi Data Excel</p>
              </div>
            </div>
            <StatusBadge status={status} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Process Flow Info */}
        <div className="mb-8 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
          <h2 className="text-sm font-semibold text-indigo-800 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            Alur Pemrosesan
          </h2>
          <ol className="text-sm text-indigo-700 space-y-1 list-decimal list-inside">
            <li>Membaca sheet <strong>&apos;NB ORDER&apos;</strong> dari Stuffing List &mdash; mengisi tanggal hari ini pada kolom <strong>Pack. Blc</strong> yang bernilai 0.</li>
            <li>Membaca sheet <strong>&apos;Apr&apos;</strong> dari Daily Inspection &mdash; mengumpulkan nomor PO yang tidak mengandung status REJECT.</li>
            <li>Mencocokkan nomor PO lulus inspeksi ke sheet <strong>&apos;NB ORDER&apos;</strong> &mdash; mengatur kolom <strong>SI Blc</strong> menjadi 0.</li>
          </ol>
        </div>

        {/* File Upload Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
          <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${
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
        <div className="mt-10 p-5 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Ringkasan File</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
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
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-xs text-gray-400 text-center">
            Stuffing Data Processor &middot; Aplikasi Internal Pemrosesan Data Excel
          </p>
        </div>
      </footer>
    </div>
  );
}
