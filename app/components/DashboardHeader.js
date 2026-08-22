'use client';

const PAGE_TITLES = {
  proses: {
    title: 'Proses Sinkronisasi',
    subtitle: 'Upload & proses file Excel',
    breadcrumb: ['Dashboard'],
  },
  riwayat: {
    title: 'Riwayat Proses',
    subtitle: 'Log pemrosesan sebelumnya',
    breadcrumb: ['Dashboard', 'Riwayat'],
  },
  referensi: {
    title: 'File Referensi',
    subtitle: 'Template & dokumen acuan',
    breadcrumb: ['Dashboard', 'Referensi'],
  },
};

export default function DashboardHeader({ activePage, status }) {
  const page = PAGE_TITLES[activePage] || PAGE_TITLES.proses;

  return (
    <header className="page-header">
      {/* Left: breadcrumb + title */}
      <div className="flex items-center gap-3 min-w-0">
        <nav className="breadcrumb" aria-label="breadcrumb">
          {page.breadcrumb.map((item, idx) => {
            const isLast = idx === page.breadcrumb.length - 1;
            const label = idx === 0 ? 'Beranda' : item;
            return (
              <span key={idx} className="flex items-center gap-1.5">
                <span className="breadcrumb-item">
                  {idx === 0 && (
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                    </svg>
                  )}
                  {isLast ? (
                    <span className="breadcrumb-current">{label}</span>
                  ) : (
                    <span className="text-indigo-500 font-medium">{label}</span>
                  )}
                </span>
                {!isLast && (
                  <svg className="breadcrumb-sep w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                )}
              </span>
            );
          })}
        </nav>

        <div className="w-px h-5 bg-gray-200 shrink-0 hidden sm:block" />

        <div className="min-w-0 hidden sm:block">
          <h1 className="header-title">{page.title}</h1>
          <p className="header-subtitle">{page.subtitle}</p>
        </div>
      </div>

      {/* Right: status + user */}
      <div className="flex items-center gap-3 shrink-0">
        {status === 'processing' && (
          <div className="status-badge status-badge-processing">
            <span className="spinner-sm" />
            <span className="hidden sm:inline">Memproses...</span>
          </div>
        )}
        {status === 'success' && (
          <div className="status-badge status-badge-success">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span>Selesai</span>
          </div>
        )}
        {status === 'error' && (
          <div className="status-badge status-badge-error">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            <span>Gagal</span>
          </div>
        )}

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center border border-indigo-100">
            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div className="hidden sm:block">
            <p className="text-[11px] font-semibold text-gray-700 leading-tight">Operator</p>
            <p className="text-[10px] text-gray-400 leading-tight">Internal</p>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 hidden sm:block" style={{ boxShadow: '0 0 0 2px rgba(16,185,129,0.2)' }} />
        </div>
      </div>
    </header>
  );
}
