'use client';

import { useState, useEffect } from 'react';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

const FILE_ICONS = {
  blc: { color: 'text-blue-500', bg: 'bg-blue-50', label: 'BLC' },
  inspection: { color: 'text-amber-500', bg: 'bg-amber-50', label: 'Inspection' },
  stuffing: { color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Stuffing' },
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
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setFiles(data.files || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-400">
          <span className="spinner !border-gray-300 !border-t-indigo-500"></span>
          <span className="text-sm">Memuat daftar file referensi...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-sm text-red-600 font-medium">Gagal memuat file referensi</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-gray-500">
          File Excel referensi yang digunakan sebagai template dan acuan untuk pemrosesan data.
        </p>
      </div>

      {files.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
          </svg>
          <p className="text-sm text-gray-400">Tidak ada file referensi</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => {
            const type = getFileType(file.name);
            const icon = type ? FILE_ICONS[type] : { color: 'text-gray-400', bg: 'bg-gray-50', label: 'File' };

            return (
              <div
                key={file.name}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 ${icon.bg} rounded-lg flex items-center justify-center shrink-0`}>
                    <svg className={`w-5 h-5 ${icon.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate" title={file.name}>{file.name}</p>
                    <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${icon.bg} ${icon.color}`}>
                      {icon.label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-100 pt-3">
                  <span>{file.sizeKB} KB</span>
                  <span>{formatDate(file.modified)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
