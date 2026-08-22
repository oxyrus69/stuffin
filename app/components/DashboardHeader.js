'use client';

const PAGE_TITLES = {
  proses: { title: 'Proses Sinkronisasi', subtitle: 'Upload dan proses file Excel' },
  riwayat: { title: 'Riwayat Proses', subtitle: 'Log pemrosesan sebelumnya' },
  referensi: { title: 'File Referensi', subtitle: 'Template dan dokumen acuan' },
};

export default function DashboardHeader({ activePage, status, onLogout }) {
  const page = PAGE_TITLES[activePage] || PAGE_TITLES.proses;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      {/* Left: Breadcrumb + Title */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-0.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span>Dashboard</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-gray-600 font-medium">{page.title}</span>
          </div>
          <h1 className="text-base font-bold text-gray-900">{page.title}</h1>
        </div>
      </div>

      {/* Right: Status + Actions */}
      <div className="flex items-center gap-3">
        {/* Status indicator */}
        {status === 'processing' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
            <span className="spinner !w-3.5 !h-3.5 !border-[1.5px] !border-amber-300 !border-t-amber-600"></span>
            <span className="text-xs font-medium text-amber-700">Memproses...</span>
          </div>
        )}
        {status === 'success' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className="text-xs font-medium text-emerald-700">Selesai</span>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
            <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            <span className="text-xs font-medium text-red-700">Gagal</span>
          </div>
        )}

        {/* Separator */}
        <div className="w-px h-7 bg-gray-200"></div>

        {/* User badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-gray-700">Operator</p>
            <p className="text-[10px] text-gray-400">Internal</p>
          </div>
        </div>
      </div>
    </header>
  );
}
