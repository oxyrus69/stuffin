'use client';

import { useState, useEffect } from 'react';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RiwayatPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/history')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setHistory(data.history || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-400">
          <span className="spinner-xs" />
          <span className="text-sm">Memuat riwayat dari database...</span>
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
            <span className="text-sm text-red-700 font-medium">Gagal memuat riwayat</span>
          </div>
          <p className="text-xs text-red-500">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              window.location.reload();
            }}
            className="text-xs font-medium text-red-600 underline hover:no-underline text-center"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-500">
          Menampilkan {history.length} riwayat pemrosesan terakhir dari database Neon.
        </p>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-16 card">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-gray-400">Belum ada riwayat pemrosesan</p>
          <p className="text-xs text-gray-300 mt-1">
            Riwayat akan muncul setelah Anda memproses file pertama kali.
          </p>
        </div>
      ) : (
        <div className="card">
          {/* Table header */}
          <div className="table-head px-5 py-3.5 flex items-center justify-between">
            <h3 className="card-title">Riwayat Pemrosesan</h3>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {history.length} record
            </span>
          </div>

          {/* Table body */}
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Waktu
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Stuffing File
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Pack. Blc <br className="hidden sm:block" />
                    <span className="text-[10px] font-normal text-gray-400">Updated</span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    PO Passed
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    PO Rejected
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    SI Blc <br className="hidden sm:block" />
                    <span className="text-[10px] font-normal text-gray-400">Updated</span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((row) => (
                  <tr key={row.id} className="table-row">
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap font-medium">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-800 font-medium truncate-200">
                      {row.stuffing_file_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-center font-mono text-gray-600">
                      {row.pack_blc_updated ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="badge badge-success">
                        <span className="badge-dot badge-dot-success" />
                        {row.po_passed ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="badge badge-error">
                        <span className="badge-dot badge-dot-error" />
                        {row.po_rejected ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-center font-mono text-gray-600">
                      {row.si_blc_updated ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.status === 'success' ? (
                        <span className="badge badge-success">
                          <span className="badge-dot badge-dot-success" />
                          Berhasil
                        </span>
                      ) : (
                        <span className="badge badge-error">
                          <span className="badge-dot badge-dot-error" />
                          Gagal
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
