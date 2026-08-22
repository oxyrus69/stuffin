'use client';

import { useState, useEffect } from 'react';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const FILE_TYPES = {
  blc: {
    label: 'BLC',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    badgeStyle: 'badge-indigo',
    dotColor: 'bg-blue-500',
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-50',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
        <path d="M3 9.5h18M3 15.5h18M9 3v18M6 12h-1.5M18 12h1.5" strokeWidth={1.8} />
      </svg>
    ),
    description: 'Data sinkronisasi produksi',
  },
  inspection: {
    label: 'Inspection',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    badgeStyle: 'badge-amber',
    dotColor: 'bg-amber-500',
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-50',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
        <path d="M3 9.5h18M3 15.5h18M9 3v18M6 12h-1.5M18 12h1.5" strokeWidth={1.8} />
      </svg>
    ),
    description: 'Data referensi inspeksi',
  },
  stuffing: {
    label: 'Stuffing',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    badgeStyle: 'badge-success',
    dotColor: 'bg-emerald-500',
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-50',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125" />
      </svg>
    ),
    description: 'Data utama yang akan diubah',
  },
};

function getFileType(name) {
  const n = name.toLowerCase();
  if (n.includes('blc')) return 'blc';
  if (n.includes('inspection') || n.includes('daily')) return 'inspection';
  if (n.includes('stuffing')) return 'stuffing';
  return null;
}

export default function ReferensiPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/references')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setFiles(data.files || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-400">
          <span className="spinner-xs" />
          <span className="text-sm">Memuat daftar file referensi...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-red-200 bg-red-50/40">
        <div className="card-body flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span className="text-sm text-red-700 font-medium">Gagal memuat file referensi</span>
          </div>
          <p className="text-xs text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-500">
          File Excel referensi yang digunakan sebagai template dan acuan untuk pemrosesan data.
        </p>
      </div>

      {files.length === 0 ? (
        <div className="text-center py-16 card">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
          </svg>
          <p className="text-sm text-gray-400">Tidak ada file referensi</p>
          <p className="text-xs text-gray-300 mt-1">
            File Excel akan muncul setelah Anda mengunggah ke halaman Proses Data.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => {
            const type = getFileType(file.name);
            const info = type ? FILE_TYPES[type] : {
              label: 'File',
              color: 'text-gray-500',
              bg: 'bg-gray-50',
              badgeStyle: 'badge-neutral',
              dotColor: 'bg-gray-400',
              iconColor: 'text-gray-400',
              iconBg: 'bg-gray-100',
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v-4.5m3 0V4.5A2.25 2.25 0 009 2.25h1.5a2.25 2.25 0 002.25-2.25V2.25a2.25 2.25 0 00-2.25-2.25H9a2.25 2.25 0 00-2.25 2.25v10.5a2.25 2.25 0 002.25 2.25z" />
                </svg>
              ),
              description: 'File umum',
            };

            return (
              <div
                key={file.name}
                className="card-hover relative"
              >
                {/* Type indicator strip at top-left */}
                <div
                  className="absolute top-0 right-0 w-0 h-0"
                  style={{
                    borderTop: '16px solid transparent',
                    borderBottom: '16px solid transparent',
                    borderRight: `16px solid ${type ? (FILE_TYPES[type]?.dotColor || 'transparent') : 'transparent'}`,
                    opacity: 0.6,
                  }}
                />

                <div className="pb-4">
                  {/* Icon + label */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-11 h-11 ${info.iconBg} rounded-xl flex items-center justify-center shrink-0 border border-white/60 shadow-sm`}>
                      {info.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate-200 leading-tight" title={file.name}>
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`badge ${info.badgeStyle}`}>
                          <span className="badge-dot" style={{ background: info.dotColor }} />
                          {info.label}
                        </span>
                        <span className="text-[10px] text-gray-400">{info.description}</span>
                      </div>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-100 pt-3 mt-2">
                    <span>
                      <svg className="w-3.5 h-3.5 text-gray-300 mr-1 vertical-middle" style={{ verticalAlign: 'middle' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5V16.5a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 16.5V7.5A2.25 2.25 0 0018.75 5.25H5.25A2.25 2.25 0 003 7.5z" />
                      </svg>
                      {file.sizeKB} KB
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Diubah {formatDate(file.modified)}
                    </span>
                  </div>

                  {/* Optional: small preview of file type icon in bottom-right */}
                  <div className="absolute bottom-3 right-3 opacity-20 hover:opacity-40 transition-opacity">
                    {info.icon}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
