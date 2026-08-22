'use client';

import { useState, useEffect } from 'react';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RiwayatPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/history')
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setHistory(data.history || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-400">
          <span className="spinner !border-gray-300 !border-t-indigo-500"></span>
          <span className="text-sm">Memuat riwayat dari database...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-sm text-red-600 font-medium">Gagal memuat riwayat</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
        <button
          onClick={() => { setLoading(true); setError(null); window.location.reload(); }}
          className="mt-3 text-xs font-medium text-red-600 underline hover:no-underline"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-gray-500">
          Menampilkan {history.length} riwayat pemrosesan terakhir dari database Neon.
        </p>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-gray-400">Belum ada riwayat pemrosesan</p>
          <p className="text-xs text-gray-300 mt-1">Riwayat akan muncul setelah Anda memproses file pertama kali</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Waktu</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stuffing File</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Inspection File</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Pack. Blc Updated</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">PO Passed</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">PO Rejected</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">SI Blc Updated</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-800 font-medium max-w-[200px] truncate">{row.stuffing_file_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate">{row.inspection_file_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-center font-mono">{row.pack_blc_updated ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-center">
                      <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-mono">
                        {row.po_passed ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-center">
                      <span className="inline-flex items-center px-2 py-0.5 bg-red-50 text-red-700 rounded-full font-mono">
                        {row.po_rejected ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-center font-mono">{row.si_blc_updated ?? 0}</td>
                    <td className="px-4 py-3 text-center">
                      {row.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                          Berhasil
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
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
