'use client';

import { useState, useEffect, useRef } from 'react';

const DEV_TOKEN = 'itsendri666';

/* ── Icons ── */
function Icon({ d, className = 'h-[18px] w-[18px]' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}
function VercelMark({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="currentColor" />
    </svg>
  );
}
function CollapseIcon({ collapsed }) {
  return (
    <svg width="1.5em" height="1.5em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      xmlns="http://www.w3.org/2000/svg"
      className={`h-5 w-5 transition-transform ${collapsed ? 'rotate-180' : ''}`}>
      <path d="M19 21L5 21C3.89543 21 3 20.1046 3 19L3 5C3 3.89543 3.89543 3 5 3L19 3C20.1046 3 21 3.89543 21 5L21 19C21 20.1046 20.1046 21 19 21Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 21V3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 10L7.25 12L5.5 14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
const CHECK_ICON = 'M4.5 12.75l6 6 9-13.5';
const COPY_ICON = 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5';
const DOWNLOAD_ICON = 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5';
const TRASH_ICON = 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.166m0 0a48.11 48.11 0 013.478-.397m6.5 0a48.11 48.11 0 013.478-.397';
const REPROCESS_ICON = 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182';
const SEARCH_ICON = 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z';
const SWEEP_ICON = 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.166m0 0a48.11 48.11 0 013.478-.397m6.5 0a48.11 48.11 0 013.478-.397';
const MENU_ICON = 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5';
const BOLT_ICON = 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z';
const LOGOUT_ICON = 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9';

const ARCHIVE_COLS = ['No','File Name','Size','Page','Group','Error Message','Actions'];

export default function DevPage() {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [archives, setArchives] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [reprocessing, setReprocessing] = useState(null);
  const [reprocessResult, setReprocessResult] = useState(null);

  // Sidebar
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Search / filter
  const [searchText, setSearchText] = useState('');
  const [filterPage, setFilterPage] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Cleanup
  const [showCleanup, setShowCleanup] = useState(false);
  const [cleanupDays, setCleanupDays] = useState('30');
  const [cleanupPreview, setCleanupPreview] = useState(null);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  useEffect(() => {
    fetch('/api/dev/auth/login', { method: 'GET' })
      .then((r) => r.json())
      .then((d) => { if (d.authenticated) setAuthed(true); })
      .catch(() => {});
  }, []);

  const handleLogin = async () => {
    setLoading(true); setAuthError('');
    try {
      const res = await fetch('/api/dev/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) { setAuthed(true); }
      else { setAuthError(data.error || 'Token tidak valid'); }
    } catch (e) { setAuthError('Gagal menghubungi server'); }
    setLoading(false);
  };

  const handleLogout = async () => {
    await fetch('/api/dev/auth/logout', { method: 'POST' }).catch(() => {});
    document.cookie = 'dev_auth=; max-age=0; path=/';
    setAuthed(false); setArchives([]); setExpandedGroup(null);
  };

  const fetchArchives = async () => {
    setFetching(true);
    try {
      const params = new URLSearchParams();
      if (searchText) params.set('search', searchText);
      if (filterPage) params.set('page', filterPage);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      const qs = params.toString();
      const res = await fetch(`/api/dev-archive${qs ? `?${qs}` : ''}`);
      const data = await res.json();
      if (data.archives) setArchives(data.archives);
    } catch (e) { console.error(e); }
    setFetching(false);
  };

  useEffect(() => { if (authed) fetchArchives(); }, [authed]);

  const debounceRef = useRef(null);
  useEffect(() => {
    if (!authed) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchArchives(), 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchText, filterPage, filterFrom, filterTo]);

  const handleDownload = async (id, fileName) => {
    setDownloadingId(id);
    try {
      const res = await fetch(`/api/dev-archive/${id}`);
      if (!res.ok) throw new Error('Gagal');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch (e) { alert('Gagal mengunduh'); }
    setDownloadingId(null);
  };

  const handleCopyLog = async (archive) => {
    const text = [`Group: ${archive.archive_group}`, `Page: ${archive.page}`, `Waktu: ${new Date(archive.created_at).toLocaleString('id-ID')}`, `File: ${archive.files.map((f) => f.file_name).join(', ')}`, '', `ERROR MESSAGE:`, archive.error_message || '(tidak ada)', '', `ERROR STACK:`, archive.error_stack || '(tidak ada)'].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(archive.archive_group);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { alert('Gagal salin ke clipboard'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus arsip ini?')) return;
    try {
      await fetch(`/api/dev-archive/${id}`, { method: 'DELETE' });
      fetchArchives();
    } catch (e) { alert('Gagal menghapus'); }
  };

  const handleReprocess = async (archive) => {
    setReprocessing(archive.archive_group);
    setReprocessResult(null);
    try {
      const res = await fetch('/api/dev-archive/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive_group: archive.archive_group }),
      });
      if (archive.page === 'akumulasi') {
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        for (const f of data.files) {
          const binaryStr = atob(f.file_data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'application/octet-stream' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = f.file_name;
          document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
        }
        setReprocessResult({ ok: true, message: `${data.files.length} file diunduh — unggah ulang di dashboard Akumulasi.` });
      } else {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Gagal' }));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = res.headers.get('content-disposition')?.match(/filename="?(.+?)"?$/)?.[1] || 'reprocess.xlsx';
        document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
        setReprocessResult({ ok: true, message: 'File BLC berhasil diproses ulang dan diunduh.' });
      }
    } catch (e) {
      setReprocessResult({ ok: false, message: e.message || 'Gagal memproses ulang' });
    }
    setReprocessing(null);
    setTimeout(() => setReprocessResult(null), 5000);
  };

  const fetchCleanupPreview = async () => {
    try {
      const res = await fetch(`/api/dev-archive/cleanup?days=${cleanupDays}`);
      const data = await res.json();
      setCleanupPreview(data);
    } catch (e) { console.error(e); }
  };

  const handleCleanup = async () => {
    if (!confirm(`Hapus semua arsip lebih tua dari ${cleanupDays} hari?`)) return;
    setCleanupRunning(true); setCleanupResult(null);
    try {
      const res = await fetch(`/api/dev-archive/cleanup?days=${cleanupDays}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCleanupResult(data);
      fetchArchives();
      fetchCleanupPreview();
    } catch (e) { setCleanupResult({ error: e.message }); }
    setCleanupRunning(false);
  };

  const clearFilters = () => { setSearchText(''); setFilterPage(''); setFilterFrom(''); setFilterTo(''); };
  const hasFilters = searchText || filterPage || filterFrom || filterTo;

  /* ── Login Screen ── */
  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-[#ededed] font-['Inter']">
        <div className="w-full max-w-md p-6">
          <div className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a]">
            <div className="border-b border-[#1f1f1f] px-4 py-3.5">
              <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-white">Mode Pengembangan</h2>
              <p className="mt-0.5 text-xs leading-4 text-[#888]">Akses diagnosa file arsip error</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#888] mb-1">Token Pengembang</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="Masukkan token dev..."
                  className="w-full rounded-md border border-[#262626] bg-[#111] px-3 py-2 text-sm text-[#ededed] placeholder-[#555] focus:border-white focus:outline-none"
                />
              </div>
              {authError && <p className="text-xs text-red-400">{authError}</p>}
              <button onClick={handleLogin} disabled={loading || !token}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3.5 text-sm font-medium tracking-[-0.01em] bg-white text-black hover:bg-[#ededed] border border-white disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center">
                {loading ? 'Memverifikasi…' : 'Masuk'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main App ── */
  return (
    <div className="flex h-screen overflow-hidden bg-black text-[#ededed] font-['Inter']" style={{ fontFamily: 'Inter, "Geist Sans", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}>
      <style>{`html{color-scheme:dark} ::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:#262626;border-radius:999px;border:2px solid #000}::-webkit-scrollbar-thumb:hover{background:#333} *{scrollbar-width:thin; scrollbar-color:#262626 #000} input::placeholder{color:#666}`}</style>

      {/* ── Sidebar ── */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-[#1f1f1f] bg-black transition-all duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 ${collapsed ? 'md:w-[56px]' : 'md:w-[220px]'} w-[220px]`}>
        <div className={`flex h-[64px] shrink-0 items-center border-b border-[#1f1f1f] ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-3'}`}>
          {!collapsed ? (
            <>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-black"><VercelMark className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold tracking-[-0.02em] text-white">HOPE</p></div>
              <button onClick={() => setCollapsed(!collapsed)} title="Ciutkan"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-[#666] hover:bg-[#111] hover:text-white hover:border-[#232323]">
                <CollapseIcon collapsed={false} />
              </button>
            </>
          ) : (
            <button onClick={() => setCollapsed(!collapsed)} title="Buka"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#1f1f1f] bg-[#0a0a0a] text-[#888] hover:bg-[#111] hover:text-white hover:border-[#333]">
              <CollapseIcon collapsed={true} />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          <p className={`px-2 pb-1 pt-2 font-mono text-[11px] font-medium tracking-widest text-[#666] ${collapsed ? 'hidden' : 'block'}`}>MENU</p>
          <button className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm tracking-[-0.01em] bg-white text-black" title={collapsed ? 'Dev Mode' : undefined}>
            <Icon d={BOLT_ICON} className={`h-[18px] w-[18px] shrink-0 text-black`} />
            {!collapsed && <span className="flex-1 truncate font-medium">Dev Mode</span>}
          </button>
        </nav>

        <div className="shrink-0 p-2 border-t border-[#1f1f1f]">
          <button onClick={handleLogout} title={collapsed ? 'Keluar' : undefined}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm tracking-[-0.01em] text-[#64748b] hover:text-red-400 hover:bg-red-950/20 transition-colors">
            <Icon d={LOGOUT_ICON} className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* ── Content ── */}
      <div className="flex min-w-0 flex-1 flex-col bg-black">
        {/* Header */}
        <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-[#1f1f1f] bg-black px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-md border border-[#232323] bg-[#0a0a0a] p-2 text-[#888] hover:border-white hover:text-white md:hidden" onClick={() => setMobileOpen(true)} aria-label="Buka menu">
              <Icon d={MENU_ICON} className="h-4 w-4" />
            </button>
            <div className="hidden h-6 w-px bg-[#1f1f1f] md:block" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-[-0.02em] text-white">Mode Pengembangan</h1>
                <span className="hidden rounded-full border border-[#232323] bg-[#0a0a0a] px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide text-[#888] md:inline-flex">DEV</span>
              </div>
              <p className="hidden text-xs tracking-[-0.01em] text-[#888] md:block">Diagnosa & Perbaikan File Error</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden font-mono text-xs tracking-[-0.01em] text-[#666] lg:block">Dev Mode</span>
          </div>
        </header>

        {/* Main scrollable area */}
        <main className="flex-1 overflow-y-auto bg-black">
          <div className="mx-auto max-w-[1160px] p-4 md:p-6">
            {/* Breadcrumb */}
            <div className="mb-4 flex items-center gap-1.5 font-mono text-xs text-[#666]">
              <span className="inline-flex items-center gap-1.5 text-[#888]">
                <Icon d={BOLT_ICON} className="h-3 w-3" /> HOPE
              </span>
              <span className="text-[#1f1f1f]">/</span>
              <span className="font-medium tracking-[-0.01em] text-white">Mode Pengembangan</span>
            </div>

            {/* ── Search & Filter ── */}
            <div className="mb-4 rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Icon d={SEARCH_ICON} className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#555]" />
                  <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Cari nama file, pesan error, stack…"
                    className="w-full rounded-md border border-[#262626] bg-[#111] pl-8 pr-3 py-1.5 text-xs text-[#ededed] placeholder-[#555] focus:border-white focus:outline-none" />
                </div>
                <select value={filterPage} onChange={(e) => setFilterPage(e.target.value)}
                  className="rounded-md border border-[#262626] bg-[#111] px-2.5 py-1.5 text-xs text-[#ededed] focus:border-white focus:outline-none">
                  <option value="">Semua Tipe</option>
                  <option value="proses">Proses BLC</option>
                  <option value="akumulasi">Akumulasi</option>
                </select>
                <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
                  className="rounded-md border border-[#262626] bg-[#111] px-2.5 py-1.5 text-xs text-[#888] focus:border-white focus:outline-none" title="Dari tanggal" />
                <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
                  className="rounded-md border border-[#262626] bg-[#111] px-2.5 py-1.5 text-xs text-[#888] focus:border-white focus:outline-none" title="Sampai tanggal" />
                {hasFilters && (
                  <button onClick={clearFilters}
                    className="inline-flex items-center gap-1 rounded-md border border-[#262626] bg-[#111] px-2 py-1.5 text-xs font-medium text-[#888] hover:border-white hover:text-white">
                    <Icon d="M6 18L18 6M6 6l12 12" className="h-3 w-3" /> Reset
                  </button>
                )}
              </div>
            </div>

            {/* ── Action Bar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-xs text-[#888]">{archives.length} arsip error{hasFilters ? ' (filtered)' : ''}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowCleanup(!showCleanup); if (!showCleanup) fetchCleanupPreview(); }}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3.5 text-sm font-medium tracking-[-0.01em] bg-[#0a0a0a] text-[#ededed] border border-[#262626] hover:border-white hover:bg-[#1a1a1a]">
                  <Icon d={SWEEP_ICON} className="h-3.5 w-3.5" /> Cleanup
                </button>
                <button onClick={fetchArchives} disabled={fetching}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3.5 text-sm font-medium tracking-[-0.01em] bg-[#0a0a0a] text-[#ededed] border border-[#262626] hover:border-white hover:bg-[#1a1a1a] disabled:opacity-50">
                  {fetching ? 'Memuat…' : 'Segarkan'}
                </button>
              </div>
            </div>

            {/* ── Cleanup Panel ── */}
            {showCleanup && (
              <div className="mb-4 rounded-lg border border-[#262626] bg-[#0a0a0a] p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-medium text-[#888]">Hapus arsip lebih tua dari:</span>
                  <input type="number" value={cleanupDays} onChange={(e) => setCleanupDays(e.target.value)} min="1"
                    className="w-20 rounded-md border border-[#262626] bg-[#111] px-2.5 py-1.5 text-xs text-[#ededed] focus:border-white focus:outline-none" />
                  <span className="text-xs text-[#666]">hari</span>
                  <button onClick={fetchCleanupPreview}
                    className="inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium border border-[#262626] bg-[#111] text-[#888] hover:border-white hover:text-white">
                    Cek
                  </button>
                  {cleanupPreview && (
                    <span className="text-xs text-[#888]">
                      {cleanupPreview.filesAtRisk} file di {cleanupPreview.groupsAtRisk} grup akan dihapus
                    </span>
                  )}
                  <button onClick={handleCleanup}
                    disabled={cleanupRunning || !cleanupPreview || cleanupPreview.filesAtRisk === 0}
                    className="inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium border border-[#3a1a1a] bg-[#1a0a0a] text-red-400 hover:bg-red-950/50 hover:text-red-300 disabled:opacity-40">
                    {cleanupRunning ? 'Menghapus…' : 'Hapus Sekarang'}
                  </button>
                </div>
                {cleanupResult && !cleanupResult.error && <p className="mt-2 text-xs text-[#4ade80]">{cleanupResult.message}</p>}
                {cleanupResult?.error && <p className="mt-2 text-xs text-red-400">{cleanupResult.error}</p>}
              </div>
            )}

            {/* ── Reprocess toast ── */}
            {reprocessResult && (
              <div className={`mb-4 rounded-md border px-3 py-2.5 text-xs ${reprocessResult.ok ? 'border-[#1a3a1a] bg-[#0a1a0a] text-[#4ade80]' : 'border-[#3a1a1a] bg-[#1a0a0a] text-[#f87171]'}`}>
                {reprocessResult.message}
              </div>
            )}

            {/* ── Empty state ── */}
            {archives.length === 0 && !fetching && (
              <div className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a]">
                <div className="text-center py-12 px-4">
                  <p className="text-sm text-[#888]">
                    {hasFilters ? 'Tidak ada arsip yang cocok dengan filter.' : 'Belum ada arsip error. Upload file dan coba proses untuk melihat error di sini.'}
                  </p>
                </div>
              </div>
            )}

            {/* ── Archive list ── */}
            <div className="space-y-4">
              {archives.map((archive, idx) => (
                <div key={archive.archive_group} className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] overflow-hidden">
                  {/* Group header */}
                  <div className="border-b border-[#1f1f1f] bg-[#0a0a0a] px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-medium text-white">{idx + 1}</span>
                        <span className="inline-flex items-center rounded-full border border-[#262626] bg-[#111] px-2 py-0.5 font-mono text-[10px] font-medium text-[#888]">
                          {archive.page === 'proses' ? 'Proses BLC' : 'Akumulasi'}
                        </span>
                        <span className="font-mono text-[10px] text-[#666]">{new Date(archive.created_at).toLocaleString('id-ID')}</span>
                        <span className="font-mono text-[10px] text-[#555] truncate max-w-[200px]">{archive.archive_group}</span>
                      </div>
                      <p className="mt-1 truncate font-mono text-[11px] text-[#888]">{archive.files.map((f) => f.file_name).join(', ')}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 flex-wrap">
                      <button onClick={() => handleReprocess(archive)} disabled={reprocessing === archive.archive_group}
                        className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-[#1a3a1a] bg-[#0a1a0a] px-2 text-xs font-medium text-[#4ade80] hover:border-[#4ade80] hover:bg-[#0a2a0a] disabled:opacity-50"
                        title="Proses ulang file ini">
                        {reprocessing === archive.archive_group ? '…' : <><Icon d={REPROCESS_ICON} className="h-3 w-3" /> <span className="hidden sm:inline">Proses Ulang</span></>}
                      </button>
                      <button onClick={() => handleCopyLog(archive)}
                        className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-[#262626] bg-[#111] px-2 text-xs font-medium text-[#888] hover:border-white hover:text-white"
                        title="Salin log error">
                        {copiedId === archive.archive_group ? <><Icon d={CHECK_ICON} className="h-3 w-3" /> Tersalin</> : <><Icon d={COPY_ICON} className="h-3 w-3" /> <span className="hidden sm:inline">Salin Log</span></>}
                      </button>
                      <button onClick={() => setExpandedGroup(expandedGroup === archive.archive_group ? null : archive.archive_group)}
                        className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-[#262626] bg-[#111] px-2 text-xs font-medium text-[#888] hover:border-white hover:text-white">
                        {expandedGroup === archive.archive_group ? 'Sembunyikan' : 'Detail'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedGroup === archive.archive_group && (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead><tr className="border-b border-[#1f1f1f] bg-[#111]">
                            {ARCHIVE_COLS.map((c, i) => <th key={i} className="px-3 py-2 text-left font-mono text-[10px] font-medium tracking-widest text-[#888]">{c}</th>)}
                          </tr></thead>
                          <tbody className="divide-y divide-[#1f1f1f]">
                            {archive.files.map((f) => (
                              <tr key={f.id} className="hover:bg-[#111] transition-colors">
                                <td className="px-3 py-2 font-mono text-xs text-[#888]">{f.id}</td>
                                <td className="px-3 py-2 font-mono text-xs text-[#ededed]">{f.file_name}</td>
                                <td className="px-3 py-2 font-mono text-xs text-[#888]">{f.file_size ? `${(f.file_size / 1024).toFixed(1)} KB` : '-'}</td>
                                <td className="px-3 py-2 font-mono text-xs text-[#888]">{archive.page}</td>
                                <td className="px-3 py-2 font-mono text-[10px] text-[#555] truncate max-w-[180px]">{archive.archive_group}</td>
                                <td className="px-3 py-2 text-xs text-red-400 max-w-[300px] truncate" title={archive.error_message || ''}>{archive.error_message || '-'}</td>
                                <td className="px-3 py-2">
                                  <button onClick={() => handleDownload(f.id, f.file_name)} disabled={downloadingId === f.id}
                                    className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-[#262626] bg-[#111] px-2 text-xs font-medium text-[#888] hover:border-white hover:text-white disabled:opacity-50">
                                    {downloadingId === f.id ? '…' : <><Icon d={DOWNLOAD_ICON} className="h-3 w-3" /> Unduh</>}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Error detail footer */}
                      <div className="border-t border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                          {archive.error_message && <p className="font-mono text-[11px] text-red-400 truncate">Error: {archive.error_message}</p>}
                          {archive.error_stack && <p className="font-mono text-[10px] text-[#555] truncate">{archive.error_stack}</p>}
                        </div>
                        <button onClick={() => handleDelete(archive.files[0]?.id)}
                          className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-[#3a1a1a] bg-[#1a0a0a] px-2 text-xs font-medium text-red-400 hover:bg-red-950/50 hover:text-red-300">
                          <Icon d={TRASH_ICON} className="h-3 w-3" /> Hapus
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
