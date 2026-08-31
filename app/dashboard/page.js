'use client';

import { useState, useEffect, useRef } from 'react';
import { processBlc, stageJitFiles, assembleFromSelection } from '../../lib/blcClient';
import { fillAkumulasi, parseDailyFile, parseWorkbookAny, detectKind, diagnoseFile } from '../../lib/akumulasiClient';

/* ── Lucide-style icons (1.5 stroke, 16-18px) ── */
const Icon = ({ d, className = 'h-[18px] w-[18px]' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const VercelMark = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="currentColor" />
  </svg>
);
const CollapseIcon = ({ collapsed }) => (
  <svg
    width="1.5em" height="1.5em" viewBox="0 0 24 24" fill="none" strokeWidth={1.5}
    xmlns="http://www.w3.org/2000/svg" color="currentColor"
    className={`h-5 w-5 transition-transform ${collapsed ? 'rotate-180' : ''}`}
  >
    <path d="M19 21L5 21C3.89543 21 3 20.1046 3 19L3 5C3 3.89543 3.89543 3 5 3L21 3C20.1046 3 21 3.89543 21 5L21 19C21 20.1046 20.1046 21 19 21Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.5 21V3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.5 10L7.25 12L5.5 14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ICONS = {
  home: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75',
  bolt: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  doc: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  book: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  cog: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.332.183-.582.495-.644.869l-.214 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  chart: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0v11.25A2.25 2.25 0 006 16.5h13.5M3.75 3h13.5m0 0v11.25c0 .621-.504 1.125-1.125 1.125H6A2.25 2.25 0 013.75 13.5V3z M12 10.5a2.25 2.25 0 00-2.25 2.25v3m2.25-3h2.25m-2.25 0v3m0-3l2.25-2.25',
  menu: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  upload: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5',
  check: 'M4.5 12.75l6 6 9-13.5',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  dot: 'M12 12.75a.75.75 0 100-1.5.75.75 0 000 1.5z',
};

const NAV_ITEMS = [
  { id: 'beranda', label: 'Beranda', title: 'Overview', icon: ICONS.home },
  { id: 'proses', label: 'Proses BLC', title: 'Proses BLC', icon: ICONS.bolt },
  { id: 'akumulasi', label: 'Akumulasi', title: 'Akumulasi Produksi', icon: ICONS.chart },
  { id: 'riwayat', label: 'Riwayat', title: 'Riwayat Proses', icon: ICONS.clock },
  { id: 'referensi', label: 'Referensi', title: 'Referensi Format', icon: ICONS.doc },
  { id: 'panduan', label: 'Panduan', title: 'Panduan', icon: ICONS.book },
  { id: 'pengaturan', label: 'Pengaturan', title: 'Pengaturan', icon: ICONS.cog },
];

const JIT_COLUMNS = ['OrdNo','StyleNo','OrdPairs','StitProd','StitBal','RBProd','RBBal','InsoleProd','InsoleBal','BottProd','BottBal','StockInStk','Balance','AssProd','AssBal','PackProd','PackBal','FinProd','FinBal','StyleName','color','Type'];

/* ── kecil: toggle + checkbox tinjau ── */
function MiniToggle({ on, onChange }) {
  const thumbClass = on ? 'translate-x-4 bg-[var(--primary-foreground)]' : 'translate-x-0.5 bg-[var(--muted)]';
  const trackClass = on ? 'on' : 'off';
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
      style={{ background: on ? 'var(--primary)' : 'var(--secondary)', borderColor: on ? 'var(--primary)' : 'var(--border)' }}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${thumbClass}`} />
    </button>
  );
}
function ReviewCheck({ checked, onToggle }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onToggle}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${checked ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]' : 'border-[var(--border)] bg-[var(--card)] text-transparent hover:border-white'}`}>
      {checked && <Icon d={ICONS.check} className="h-3 w-3" />}
    </button>
  );
}
function BadgeSoon() {
  return <span className="s-badge s-badge-amber">Soon</span>;
}
function StepNumber({ n }) {
  return <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--foreground)]">{n}</span>;
}
function VercelButton({ variant = 'primary', children, className = '', ...props }) {
  const base = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3.5 text-sm font-medium tracking-[-0.01em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const styles = {
    primary: 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 border border-[var(--primary)]',
    secondary: 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:border-white hover:bg-[var(--secondary)]',
    ghost: 'bg-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] border border-transparent',
  };
  return <button className={`${base} ${styles[variant]} ${className}`} {...props}>{children}</button>;
}

/* ── Proses BLC ── */
function ProsesPage({ summary, setSummary }) {
  const [jitFiles, setJitFiles] = useState([]);
  const [stuffingFile, setStuffingFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragOverStuffing, setDragOverStuffing] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [staged, setStaged] = useState(null);
  const [reviewFilter, setReviewFilter] = useState('all');

  const validateFile = (file) => {
    const ext = file.name?.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') return 'Format harus .xlsx atau .xls.';
    if (file.size > 50 * 1024 * 1024) return `"${file.name}" melebihi 50 MB.`;
    return null;
  };
  const addFiles = (files) => {
    let err = null;
    for (const f of files) { err = validateFile(f); if (err) break; }
    setError(err);
    if (!err && files.length > 0) {
      setJitFiles((prev) => {
        const map = new Map(prev.map((f) => [`${f.name}:${f.size}`, f]));
        for (const f of files) map.set(`${f.name}:${f.size}`, f);
        return Array.from(map.values());
      });
      setStaged(null); setReviewFilter('all');
    }
  };
  const removeFile = (name) => { setJitFiles((prev) => prev.filter((f) => f.name !== name)); setStaged(null); };
  const resetAll = () => { setJitFiles([]); setStuffingFile(null); setStaged(null); setReviewFilter('all'); setStatus('idle'); setMessage(''); setError(null); setSummary(null); };
  const toggleReviewMode = (v) => { setReviewMode(v); setStaged(null); setReviewFilter('all'); setStatus('idle'); setMessage(''); };

  const handleProcess = async () => {
    setStaged(null); setStatus('processing'); setSummary(null); setMessage(stuffingFile ? 'Menyusun sheet Blc…' : 'Menggabungkan file JIT…');
    try {
      const { data, filename, report, warnings } = await processBlc({
        jitFiles: await Promise.all(jitFiles.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))),
        stuffingFile: stuffingFile ? { name: stuffingFile.name, bytes: new Uint8Array(await stuffingFile.arrayBuffer()) } : null,
        onProgress: (msg) => setMessage(msg),
      });
      setSummary(report);
      if (warnings?.length) console.info('[BLC]', warnings);
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
      setStatus('success'); setMessage(stuffingFile ? `Selesai — Blc ditimpa (${report.nbOrders} order) → ${filename}` : `Selesai — ${jitFiles.length} file → ${report.nbOrders} order → ${filename}`);
    } catch (err) { console.error(err); setStatus('error'); setMessage(err.message || 'Gagal memproses.'); }
  };
  const handleStage = async () => {
    setStatus('processing'); setSummary(null); setStaged(null); setMessage('Membaca & memilah file JIT…'); setReviewFilter('all');
    try {
      const bytes = await Promise.all(jitFiles.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
      const result = await stageJitFiles({ jitFiles: bytes, onProgress: (m) => setMessage(m) });
      setStaged(result); setStatus('idle'); setMessage('');
      if (result.warnings?.length) console.info('[BLC stage]', result.warnings);
    } catch (err) { console.error(err); setStatus('error'); setMessage(err.message || 'Gagal meninjau data.'); }
  };
  const handleDownloadSelection = async () => {
    const n = staged ? staged.files.reduce((c, f) => c + f.rows.filter((r) => r.included).length, 0) : 0;
    if (!staged || n === 0) return;
    setStatus('processing'); setSummary(null); setMessage(stuffingFile ? 'Menyusun sheet Blc…' : 'Memformat file BLC…');
    try {
      const stuff = stuffingFile ? { name: stuffingFile.name, bytes: new Uint8Array(await stuffingFile.arrayBuffer()) } : null;
      const { data, filename, report, warnings } = await assembleFromSelection({ staged, stuffingFile: stuff, onProgress: (m) => setMessage(m) });
      setSummary(report);
      if (warnings?.length) console.info('[BLC tinjau]', warnings);
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
      setStatus('success'); setMessage(`Selesai — ${n} order terpilih → ${filename}`);
    } catch (err) { console.error(err); setStatus('error'); setMessage(err.message || 'Gagal memproses pilihan.'); }
  };
  const toggleRow = (fileIdx, rowI) => {
    setStaged((prev) => {
      if (!prev) return prev;
      const next = { ...prev, files: prev.files.map((f, fi) => fi !== fileIdx ? f : { ...f, rows: f.rows.map((r) => r.i === rowI ? { ...r, included: !r.included } : r) }) };
      return next;
    });
  };
  const setFileRows = (fileIdx, updater) => {
    setStaged((prev) => {
      if (!prev) return prev;
      return { ...prev, files: prev.files.map((f, fi) => fi !== fileIdx ? f : { ...f, rows: f.rows.map(updater) }) };
    });
  };
  const selectNbInFile = (fileIdx) => setFileRows(fileIdx, (r) => r.isNb ? { ...r, included: true } : r);
  const clearFile = (fileIdx) => setFileRows(fileIdx, (r) => ({ ...r, included: false }));
  const stagedCounts = staged ? staged.files.reduce((a, f) => ({ total: a.total + f.rows.length, masuk: a.masuk + f.rows.filter((r) => r.included).length }), { total: 0, masuk: 0 }) : null;
  const selectedCount = stagedCounts ? stagedCounts.masuk : 0;

  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { n: '1', t: 'Upload JIT', d: 'Pilih semua laporan sekaligus. Urutkan dari lama ke baru.' },
          { n: '2', t: 'Filter NB', d: 'Hanya U**N* (U07NB) dipakai; BC/PU/UV dibuang.' },
          { n: '3', t: 'Gabungkan', d: 'Duplikat: file pertama menang. Hasil jadi sheet Blc.' },
          { n: '4', t: 'Timpa Blc (opsional)', d: 'Jika Stuffing List ada, langsung timpa sheet Blc di dalamnya.' },
        ].map((s) => (
          <div key={s.n} className="s-card p-4">
            <StepNumber n={s.n} />
            <p className="mt-3 text-sm font-medium tracking-[-0.01em] text-[var(--foreground)]">{s.t}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{s.d}</p>
          </div>
        ))}
      </ol>

      <div role="button" tabIndex={0}
        onClick={() => document.getElementById('jit-input')?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && document.getElementById('jit-input')?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files)); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-[var(--card)] px-6 py-10 text-center transition-colors ${error ? 'border-red-900 bg-red-950/20' : dragOver ? 'border-white bg-[var(--secondary)]' : 'border-[var(--border)] hover:border-white hover:bg-[var(--secondary)]'}`}>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)]">
          <Icon d={ICONS.upload} className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-medium tracking-[-0.01em] text-[var(--foreground)]">Klik atau seret file Data JIT ke sini</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">.xlsx / .xls · bisa banyak file sekaligus</p>
        </div>
        <input id="jit-input" type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) addFiles(Array.from(e.target.files)); e.target.value=''; }} />
      </div>

      <div role="button" tabIndex={0}
        onClick={() => document.getElementById('stuffing-input')?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && document.getElementById('stuffing-input')?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOverStuffing(true); }}
        onDragLeave={() => setDragOverStuffing(false)}
        onDrop={(e) => { e.preventDefault(); setDragOverStuffing(false); const f=e.dataTransfer.files?.[0]; if(!f) return; const err=validateFile(f); setError(err); if(!err) setStuffingFile(f); }}
        className={`flex cursor-pointer items-center gap-3 rounded-lg border bg-[var(--card)] px-4 py-3.5 transition-colors ${stuffingFile ? 'border-white bg-[var(--secondary)]' : dragOverStuffing ? 'border-white bg-[var(--secondary)]' : 'border-[var(--border)] hover:border-white'}`}>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-sm ${stuffingFile ? 'border-white bg-white text-[var(--primary-foreground)]' : 'border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)]'}`}>{stuffingFile ? '✓' : '+'}</span>
        <div className="min-w-0 flex-1 text-left">
          <p className="flex items-center gap-2 text-sm font-medium tracking-[-0.01em] text-[var(--foreground)]">Stuffing List <span className="s-badge">Opsional</span></p>
          <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">{stuffingFile ? `${stuffingFile.name} · Blc akan ditimpa` : 'Upload untuk langsung timpa sheet Blc — output jadi Stuffing List terupdate'}</p>
        </div>
        {stuffingFile && <button type="button" onClick={(e)=>{e.stopPropagation(); setStuffingFile(null);}} className="rounded-md p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] border border-transparent hover:border-[var(--border)]"><Icon d="M6 18L18 6M6 6l12 12" className="h-4 w-4" /></button>}
        <input id="stuffing-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={(e)=>{const f=e.target.files?.[0]; if(f){const err=validateFile(f); setError(err); if(!err) setStuffingFile(f);} e.target.value='';}} />
      </div>

      {error && <div className="flex items-center gap-2 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs leading-4 text-red-400"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />{error}</div>}

      {jitFiles.length > 0 && (
        <div className="s-card overflow-hidden">
          <div className="border-b border-[var(--border)] bg-[var(--secondary)] px-3 py-2 flex items-center justify-between">
            <p className="text-xs font-medium tracking-[-0.01em] text-[var(--muted-foreground)]">{jitFiles.length} file terpilih</p>
            <span className="text-xs text-[var(--muted)]">Urutan = prioritas</span>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {jitFiles.map((f,i)=>(
              <li key={f.name+f.size} className="flex items-center gap-3 px-3 py-2.5">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--primary)] text-xs font-medium text-[var(--primary-foreground)]">{i+1}</span>
                <span className="min-w-0 flex-1 truncate text-sm tracking-[-0.01em] text-[var(--foreground)]">{f.name}</span>
                <span className="shrink-0 font-mono text-xs text-[var(--muted-foreground)]">{(f.size/1024).toFixed(0)} KB</span>
                <button onClick={()=>removeFile(f.name)} className="rounded-md border border-transparent p-1 text-[var(--muted)] hover:border-[var(--border)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"><Icon d="M6 18L18 6M6 6l12 12" className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {staged && (
        <div className="s-card overflow-hidden">
          <div className="border-b border-[var(--border)] px-3 py-3.5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Tinjau Data</h3>
              <p className="mt-0.5 text-xs leading-4 text-[var(--muted-foreground)]">{stagedCounts.masuk} order akan diproses · {stagedCounts.total - stagedCounts.masuk} dibuang — centang untuk memasukkan</p>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--secondary)] p-0.5">
              {[
                ['all', `Semua ${stagedCounts.total}`],
                ['masuk', `Masuk ${stagedCounts.masuk}`],
                ['buang', `Dibuang ${stagedCounts.total - stagedCounts.masuk}`],
              ].map(([k, label])=>(
                <button key={k} onClick={()=>setReviewFilter(k)} className={`rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[-0.01em] transition-colors ${reviewFilter===k ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="space-y-3 p-3">
            {staged.files.map((file, fileIdx) => {
              const masuk = file.rows.filter((r) => r.included).length;
              const buang = file.rows.length - masuk;
              const visible = file.rows.filter((r) => reviewFilter==='all' ? true : reviewFilter==='masuk' ? r.included : !r.included);
              return (
                <div key={file.name} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--secondary)] px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-medium text-[var(--foreground)]">{file.name}</p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--muted)]">{file.sheetName} · {file.period || 'tanpa periode'} · {file.rows.length} baris terdeteksi</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden font-mono text-[11px] text-[var(--muted-foreground)] sm:inline">{masuk} masuk · {buang} dibuang</span>
                      <button onClick={()=>selectNbInFile(fileIdx)} className="rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1 text-xs font-medium tracking-[-0.01em] text-[var(--foreground)] hover:border-white hover:bg-[var(--secondary)]">Pilih NB</button>
                      <button onClick={()=>clearFile(fileIdx)} className="rounded-md border border-transparent px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]">Kosongkan</button>
                    </div>
                  </div>
                  {visible.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-[var(--muted)]">Tidak ada baris pada filter ini.</p>
                  ) : (
                    <div className="max-h-[340px] overflow-auto">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 z-[1] border-b border-[var(--border)] bg-[var(--secondary)]">
                          <tr>
                            <th className="w-9 px-3 py-2"><span className="sr-only">Pilih</span></th>
                            <th className="px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">OrdNo</th>
                            <th className="hidden px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--muted-foreground)] sm:table-cell">StyleNo</th>
                            <th className="px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {visible.map((r) => (
                            <tr key={`${fileIdx}-${r.i}`} className={`group ${r.included ? 'bg-[var(--card)]' : 'bg-[var(--secondary)]'}`}>
                              <td className="px-3 py-2"><ReviewCheck checked={r.included} onToggle={()=>toggleRow(fileIdx, r.i)} /></td>
                              <td className={`max-w-[170px] truncate px-2 py-2 font-mono text-xs tracking-tight ${r.included ? 'font-medium text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>{r.ordNo}</td>
                              <td className="hidden max-w-[120px] truncate px-2 py-2 font-mono text-xs text-[var(--muted-foreground)] sm:table-cell">{r.styleNo || '—'}</td>
                              <td className="px-2 py-2">
                                {r.included ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs text-[#4ade80]"><span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" /> Masuk</span>
                                ) : (
                                  <span className="line-clamp-2 text-xs leading-4 text-red-400">{r.reason}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="border-t border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 font-mono text-[11px] text-[var(--muted)]">Urutan akhir mengikuti U07→U08→U09→U10→U11→U12→U01…U06 · duplikasi dibiarkan sesuai pilihan (dengan peringatan).</p>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--secondary)] px-3 py-2">
            <span className="font-mono text-[11px] text-[var(--muted-foreground)]">{selectedCount} order terpilih</span>
            <button onClick={()=>setStaged(null)} className="text-xs tracking-[-0.01em] text-[var(--muted)] hover:text-[var(--foreground)]">Tutup tinjau</button>
          </div>
        </div>
      )}

      {message && (
        <div className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm ${status==='success'?'border-[#1a3a1a] bg-[#0a1a0a] text-[#4ade80]': status==='error'?'border-[#3a1a1a] bg-[#1a0a0a] text-[#f87171]':'border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)]'}`}>
          {status==='processing' && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--border)] border-t-white" />}
          {status!=='processing' && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status==='success'?'bg-[#4ade80]':'bg-red-400'}`} />}
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm tracking-[-0.01em]">{message}</span>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['File JIT', summary.jitFiles],
            ['Order NB', summary.nbOrders],
            ['Periode', summary.period],
            ['Mode', summary.mode==='stuffing'?'Stuffing List':'File BLC'],
          ].map(([k,v])=>(
            <div key={k} className="s-card px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">{k}</p>
              <p className="mt-1 text-sm font-semibold tracking-[-0.01em] text-[var(--foreground)]">{v ?? '-'}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <MiniToggle on={reviewMode} onChange={toggleReviewMode} />
          <span className="text-xs tracking-[-0.01em] text-[var(--muted-foreground)]">Tinjau dulu</span>
          {reviewMode && staged && <span className="hidden font-mono text-[11px] text-[var(--muted)] sm:inline">· {selectedCount} terpilih</span>}
        </div>
        <div className="flex items-center gap-2">
          {jitFiles.length>0 && <VercelButton variant="secondary" onClick={resetAll}>Reset</VercelButton>}
          {!reviewMode ? (
            <VercelButton variant="primary" onClick={handleProcess} disabled={jitFiles.length===0 || status==='processing' || !!error}>
              {status==='processing' ? 'Memproses…' : stuffingFile ? 'Timpa Blc & Unduh' : 'Gabungkan & Unduh'}
            </VercelButton>
          ) : !staged ? (
            <VercelButton variant="primary" onClick={handleStage} disabled={jitFiles.length===0 || status==='processing' || !!error}>
              {status==='processing' ? 'Membaca…' : 'Tinjau Data'}
            </VercelButton>
          ) : (
            <VercelButton variant="primary" onClick={handleDownloadSelection} disabled={selectedCount===0 || status==='processing'}>
              {status==='processing' ? 'Memproses…' : `Unduh ${selectedCount} order terpilih`}
            </VercelButton>
          )}
        </div>
      </div>
      {jitFiles.length===0 && <p className="text-right font-mono text-xs text-[var(--muted)]">Pilih minimal 1 file JIT.</p>}
      {reviewMode && staged && selectedCount===0 && <p className="text-right font-mono text-xs text-red-400">Centang minimal 1 order untuk mengunduh.</p>}
    </div>
  );
}

/* ── Beranda — tombol ergonomis ── */
function BerandaPage({ onNavigate }) {
  const menuDesc = {
    beranda: 'Ringkasan & akses cepat ke semua fitur',
    proses: 'Gabungkan banyak file JIT → sheet Blc',
    akumulasi: 'Isi template mingguan dari ASS & STT',
    riwayat: 'Lihat arsip proses sebelumnya',
    referensi: 'Daftar kolom & contoh file',
    panduan: 'Langkah lengkap penggunaan',
    pengaturan: 'Kelola preferensi aplikasi',
  };
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[13px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">Navigasi Cepat</h2>
        <p className="mt-1 text-sm leading-5 text-[var(--muted-foreground)]">Pilih menu dengan klik tombol dibawah ya.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_ITEMS.filter((item) => item.id !== 'beranda').map((item) => (
          <button key={item.id} onClick={() => onNavigate(item.id)}
            className="group flex min-h-[96px] items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 text-left transition-colors hover:border-white hover:bg-[var(--secondary)]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)] group-hover:border-white group-hover:bg-white group-hover:text-black transition-colors">
              <Icon d={item.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold tracking-[-0.01em] text-[var(--foreground)]">{item.label}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-[var(--muted-foreground)]">{menuDesc[item.id]}</span>
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--secondary)] text-[var(--muted)] group-hover:border-white group-hover:bg-white group-hover:text-black transition-colors">
              <Icon d="M8.25 4.5l7.5 7.5-7.5 7.5" className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Riwayat ── */
function RiwayatPage() {
  const cols=['Tanggal','File JIT','Order NB','Output','Status'];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><BadgeSoon /><span className="text-xs text-[var(--muted-foreground)]">Fitur segera hadir</span></div>
      <div className="s-card">
        <div className="s-card-header">
          <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Riwayat Pemrosesan</h3>
          <p className="mt-0.5 text-xs leading-4 text-[var(--muted-foreground)]">Arsip hasil penggabungan per hari</p>
        </div>
        <div className="overflow-hidden">
          <table className="s-table">
            <thead><tr className="border-b border-[var(--border)] bg-[var(--secondary)]">{cols.map(c=> <th key={c} className="px-4 py-2.5 font-mono text-xs font-medium tracking-widest text-[var(--muted-foreground)]">{c.toUpperCase()}</th>)}</tr></thead>
            <tbody><tr><td colSpan={cols.length} className="px-4 py-12 text-center text-sm text-[var(--muted)]">Belum ada riwayat. Proses yang berhasil akan tercatat di sini.</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Referensi ── */
function ReferensiPage() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="s-card">
        <div className="s-card-header">
          <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Format Input — Data JIT</h3>
          <p className="mt-0.5 text-xs leading-4 text-[var(--muted-foreground)]">Kolom yang dikenali sistem</p>
        </div>
        <div className="s-card-body">
          <p className="text-sm leading-6 tracking-[-0.01em] text-[var(--muted-foreground)]">Sistem mencari header <code className="rounded border border-[var(--border)] bg-[var(--secondary)] px-1 py-0.5 font-mono text-xs">OrdNo</code> + <code className="rounded border border-[var(--border)] bg-[var(--secondary)] px-1 py-0.5 font-mono text-xs">StyleNo</code> di sheet manapun, lalu simpan OrdNo pola <span className="font-mono text-xs font-medium text-[var(--foreground)]">U**N*</span>.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{JIT_COLUMNS.map(c=> <code key={c} className="rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 font-mono text-xs text-[var(--foreground)]">{c}</code>)}</div>
        </div>
      </div>
      <div className="s-card">
        <div className="s-card-header">
          <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Format Output — BLC</h3>
          <p className="mt-0.5 text-xs leading-4 text-[var(--muted-foreground)]">Acuan: BLC HDU 8.22 PAGI.xlsx</p>
        </div>
        <div className="s-card-body">
          <pre className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--card)] p-4 font-mono text-xs leading-6 text-[var(--foreground)]">{`Baris 1  : Production Report By Order
Baris 2  : (kosong)
Baris 3  : <tahun> <bulan>        2026 8
Baris 4  : jumlah baris data
Baris 5  : header kolom (OrdNo …)
Baris 6+ : data order NB gabungan

Sheet    : BLC HDU <bulan>.<tanggal> PAGI
File     : BLC HDU <bulan>.<tanggal>.xlsx`}</pre>
          <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">Duplikasi: file pertama menang (urut unggah).</p>
        </div>
      </div>
    </div>
  );
}

/* ── Panduan ── */
function PanduanPage() {
  const steps=[
    { t:'Siapkan file JIT', d:'Kumpulkan laporan .xlsx, urutkan dari lama (pagi) ke terbaru.' },
    { t:'Buka Proses BLC', d:'Seret/klik area unggah, pilih beberapa file. Nomor = prioritas.' },
    { t:'Gabungkan & Unduh', d:'Sistem pilah NB, hapus duplikat, susun file BLC baru.' },
    { t:'Periksa hasil', d:'Cek baris 4 sheet BLC (jumlah data) vs ringkasan Order NB.' },
  ];
  return (
    <div className="s-card">
      <div className="s-card-header">
        <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Panduan Penggunaan</h3>
        <p className="mt-0.5 text-xs leading-4 text-[var(--muted-foreground)]">Alur unggah → BLC</p>
      </div>
      <div className="s-card-body">
        <ol className="relative space-y-5 border-l border-[var(--border)] pl-6">
          {steps.map((s,i)=>(
            <li key={s.t} className="relative">
              <span className="absolute -left-[36px] flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-medium text-black">{i+1}</span>
              <p className="text-sm font-medium tracking-[-0.01em] text-[var(--foreground)]">{s.t}</p>
              <p className="mt-1 text-sm leading-6 tracking-[-0.01em] text-[var(--muted-foreground)]">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-md border border-amber-500/20 bg-amber-950/20 px-3 py-2.5 text-xs leading-5 text-amber-400">Jika header JIT berbeda dan gagal terbaca, kirim contoh file agar deteksi disesuaikan.</div>
      </div>
    </div>
  );
}

/* ── Pengaturan ── */
function PengaturanPage() {
  const items=[
    { t:'Unduh otomatis', d:'File BLC langsung terunduh setelah proses.', on:true },
    { t:'Nama sheet kustom', d:'Ganti pola “BLC HDU <tgl> PAGI”.', on:false },
    { t:'Simpan riwayat', d:'Catat statistik ke database.', on:false },
    { t:'Mode gelap', d:'Force dark — aktif', on:true },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><BadgeSoon /><span className="text-xs text-[var(--muted-foreground)]">Pratinjau</span></div>
      <div className="s-card">
        <div className="s-card-header">
          <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Preferensi</h3>
          <p className="mt-0.5 text-xs leading-4 text-[var(--muted-foreground)]">Opsi pratinjau</p>
        </div>
        <ul className="divide-y divide-[var(--border)] px-4">
          {items.map(s=>(
            <li key={s.t} className="flex items-center justify-between gap-4 py-4">
              <div><p className="text-sm font-medium tracking-[-0.01em] text-[var(--foreground)]">{s.t}</p><p className="mt-0.5 text-xs leading-4 text-[var(--muted-foreground)]">{s.d}</p></div>
              <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border ${s.on?'bg-white border-white':'bg-[var(--secondary)] border-[var(--border)]'}`}><span className={`h-3.5 w-3.5 rounded-full shadow-sm transition-transform ${s.on?'translate-x-4 bg-black':'translate-x-0.5 bg-[var(--muted)]'}`} /></span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── Akumulasi ── */
function AkumulasiPage() {
  const [files, setFiles] = useState({ ass: null, stt: null });
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [errorHelp, setErrorHelp] = useState(null);
  const [showTip, setShowTip] = useState(false);
  const [summary, setSummary] = useState(null);

  const pick = (key) => async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['xlsx','xls','htm','html'].includes(ext)) {
      setStatus('error'); setMessage('Format tidak didukung.'); setErrorHelp({ title: 'Format file', steps: ['Gunakan .XLS / .XLSX hasil export.', 'Jika .XLS gagal, buka di Excel → Save As → Excel Workbook (*.xlsx).'] }); e.target.value=''; return;
    }
    setFiles((p) => ({ ...p, [key]: f })); setStatus('idle'); setMessage(''); setErrorHelp(null); setShowTip(false); e.target.value='';
  };
  const ready = files.ass && files.stt;
  const handleProcess = async () => {
    if (!ready) return;
    setStatus('processing'); setErrorHelp(null); setShowTip(false); setMessage('Memproses akumulasi…');
    try {
      const read = async (f) => new Uint8Array(await f.arrayBuffer());
      let sewParsed, assParsed;
      try {
        const [sttBytes, assBytes] = await Promise.all([read(files.stt), read(files.ass)]);
        sewParsed = parseDailyFile(sttBytes); assParsed = parseDailyFile(assBytes);
        if (sewParsed.lines.size===0) { const alt=parseDailyFile(parseWorkbookAny(sttBytes)); if(alt.lines.size>0) sewParsed=alt; }
        if (assParsed.lines.size===0) { const alt=parseDailyFile(parseWorkbookAny(assBytes)); if(alt.lines.size>0) assParsed=alt; }
      } catch (e) { throw new Error(`Gagal membaca file: ${e.message}`); }
      if (sewParsed.lines.size===0 || assParsed.lines.size===0) {
        let isFrameset=false, rawDetail='';
        try {
          const [sttBytes2, assBytes2] = await Promise.all([read(files.stt), read(files.ass)]);
          const dStt=diagnoseFile(sttBytes2), dAss=diagnoseFile(assBytes2);
          rawDetail=JSON.stringify({stt:dStt,ass:dAss});
          const frameHint=(d)=>d.isFrameset&&d.hasSheet001Ref;
          isFrameset=frameHint(dStt)||frameHint(dAss);
          console.warn('[Akumulasi diagnose]',{stt:dStt,ass:dAss});
        } catch(e){ rawDetail=e.message; }
        if(isFrameset){
          const err=new Error('File .XLS tidak bisa dibaca langsung.');
          err.help={ title:'File tersimpan sebagai “Web Page”', steps:['Buka file .XLS di Excel','File → Save As','Ganti type ke Excel Workbook (*.xlsx)','Simpan & upload .xlsx baru'], note:'Atau upload sheet001.htm dari folder *_files.' };
          err.rawDetail=rawDetail; throw err;
        }
        const err2=new Error('Format tabel tidak dikenali.');
        err2.help={ title:'Pastikan format ASS/STT', steps:['Tabel harus punya LineNo | Line | D1…D31 + Total','Jangan ubah header','Coba Save As → .xlsx lalu upload ulang'] };
        err2.rawDetail=rawDetail; throw err2;
      }
      const k1=detectKind(sewParsed), k2=detectKind(assParsed);
      if(k1==='ass'&&k2==='sew') [sewParsed,assParsed]=[assParsed,sewParsed];
      else if(k1!=='sew'||k2!=='ass'){ const err=new Error('Jenis file tidak sesuai.'); err.help={title:'Butuh 1 Sewing + 1 Assembling', steps:['Sewing: S01–S18 / T02/T03 / IP','Assembling: A01–A18','Tukar posisi upload atau cek di Excel']}; throw err; }
      setMessage('Mengunduh template…');
      const tplRes=await fetch('/akumulasi-template.xlsx'); if(!tplRes.ok) throw new Error('Template tidak tersedia.');
      const out=fillAkumulasi(new Uint8Array(await tplRes.arrayBuffer()), sewParsed, assParsed);
      setSummary({ cells: out.filledCells, weeks: out.weeksFound });
      const blob=new Blob([out.zip],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const url=window.URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='akumulasi.xlsx'; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
      setStatus('success'); setErrorHelp(null); setShowTip(false); setMessage(`Selesai — ${out.filledCells} sel terisi di ${out.weeksFound} minggu → akumulasi.xlsx`);
    } catch (err) {
      console.error(err); if(err.rawDetail) console.warn(err.rawDetail);
      setStatus('error'); setMessage(err.message||'Gagal memproses.'); if(err.help) setErrorHelp(err.help); else setErrorHelp({title:'Cek file', steps:['Pastikan file tidak rusak','Buka di Excel → Save As → .xlsx']});
    }
  };

  const slots=[{key:'stt',label:'File STT',desc:'Output Sewing — STT *.XLS'},{key:'ass',label:'File ASS',desc:'Input Assembling — ASS *.XLS'}];
  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          {n:'1',t:'Upload ASS & STT',d:'Laporan harian per line dari sistem.'},
          {n:'2',t:'Template Otomatis',d:'Template bulan berjalan diambil dari server.'},
          {n:'3',t:'Isi & Unduh',d:'Kolom Output per minggu diisi otomatis; Total dihitung ulang.'},
        ].map(s=>(
          <div key={s.n} className="s-card p-4"><StepNumber n={s.n} /><p className="mt-3 text-sm font-medium tracking-[-0.01em] text-[var(--foreground)]">{s.t}</p><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{s.d}</p></div>
        ))}
      </ol>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {slots.map(s=>(
          <label key={s.key} className={`group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border bg-[var(--card)] px-6 py-8 text-center transition-colors ${files[s.key] ? 'border-white bg-[var(--secondary)]' : 'border-[var(--border)] hover:border-white hover:bg-[var(--secondary)]'}`}>
            <span className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm ${files[s.key] ? 'border-white bg-white text-black' : 'border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] group-hover:border-white group-hover:text-white'}`}>{files[s.key] ? '✓' : '+'}</span>
            <p className="text-sm font-medium tracking-[-0.01em] text-[var(--foreground)]">{s.label}</p>
            <p className="max-w-[90%] truncate font-mono text-xs text-[var(--muted-foreground)]">{files[s.key]?.name || s.desc}</p>
            <input type="file" accept=".xlsx,.xls,.htm,.html" className="hidden" onChange={pick(s.key)} />
          </label>
        ))}
      </div>

      {message && (
        <div className={`flex gap-2.5 rounded-md border px-3 py-2.5 text-sm ${status==='success'?'border-[#1a3a1a] bg-[#0a1a0a] text-[#4ade80]':status==='error'?'border-[#3a1a1a] bg-[#1a0a0a] text-[#f87171]':'border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)]'}`}>
          {status==='processing' && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--border)] border-t-white" />}
          {status!=='processing' && <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${status==='success'?'bg-[#4ade80]':'bg-red-400'}`} />}
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm tracking-[-0.01em]">{message}</span>
          {status==='error' && errorHelp && (
            <div className="relative ml-auto shrink-0">
              <button type="button" onMouseEnter={()=>setShowTip(true)} onMouseLeave={()=>setShowTip(false)} onClick={()=>setShowTip(v=>!v)} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-900/50 bg-[var(--card)] text-xs font-medium text-red-400 hover:bg-[var(--secondary)]">?</button>
              {showTip && <div className="absolute right-0 top-8 z-10 w-72 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.5)]"><p className="text-xs font-semibold tracking-[-0.01em] text-[var(--foreground)]">{errorHelp.title}</p><ol className="mt-1.5 list-decimal list-inside space-y-0.5 text-xs leading-5 text-[var(--muted-foreground)]">{errorHelp.steps.map((x,i)=><li key={i}>{x}</li>)}</ol>{errorHelp.note && <p className="mt-2 text-xs italic text-[var(--muted)]">{errorHelp.note}</p>}</div>}
            </div>
          )}
        </div>
      )}
      {status==='error' && errorHelp && (
        <div className="s-card border-amber-500/20 bg-amber-950/10">
          <div className="flex gap-3 p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-amber-500/20 bg-[var(--secondary)] text-sm">💡</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium tracking-[-0.01em] text-amber-400">{errorHelp.title}</p>
              <ol className="mt-2 list-decimal list-inside space-y-1 text-sm leading-6 tracking-[-0.01em] text-amber-400/90">{errorHelp.steps.map((x,i)=><li key={i}>{x}</li>)}</ol>
              {errorHelp.note && <p className="mt-2 text-xs italic leading-4 text-amber-400/70">{errorHelp.note}</p>}
              <p className="mt-2 font-mono text-[11px] text-amber-400/60">Detail teknis di Console (F12).</p>
            </div>
          </div>
        </div>
      )}
      {summary && <div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Sel Terisi</p><p className="mt-1 text-sm font-semibold tracking-[-0.02em] text-[var(--foreground)]">{summary.cells}</p></div><div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Blok Minggu</p><p className="mt-1 text-sm font-semibold tracking-[-0.02em] text-[var(--foreground)]">{summary.weeks}</p></div></div>}

      <div className="flex items-center justify-end gap-2">
        {ready && <VercelButton variant="secondary" onClick={()=>{setFiles({ass:null,stt:null}); setStatus('idle'); setMessage(''); setErrorHelp(null); setShowTip(false); setSummary(null);}}>Reset</VercelButton>}
        <VercelButton variant="primary" disabled={!ready || status==='processing'} onClick={handleProcess}>{status==='processing' ? 'Memproses…' : 'Isi Akumulasi & Unduh'}</VercelButton>
      </div>
    </div>
  );
}

/* ── Shell — shadcn-admin pattern: Sidebar + SidebarInset + Header + Footer ── */
export default function Dashboard() {
  const [activePage, setActivePage] = useState('beranda');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const navigate = (page) => { setActivePage(page); setMobileOpen(false); };
  const active = NAV_ITEMS.find((n) => n.id === activePage);
  const [today, setToday] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  useEffect(() => { setToday(new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())); }, []);
  useEffect(() => {
    const onClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    if (profileOpen) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [profileOpen]);
  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)] selection:bg-white selection:text-black" style={{ fontFamily: 'Inter, "Geist Sans", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif', fontFeatureSettings: '"ss01","ss02"' }}>
      <style>{`html{color-scheme:dark} ::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:#262626;border-radius:999px;border:2px solid #000}::-webkit-scrollbar-thumb:hover{background:#333} *{scrollbar-width:thin; scrollbar-color:#262626 #000} input::placeholder{color:#666} @keyframes hope-glow{0%,100%{text-shadow:0 0 4px rgba(255,255,255,0.1),0 0 8px rgba(255,255,255,0.05)}50%{text-shadow:0 0 8px rgba(255,255,255,0.4),0 0 20px rgba(255,255,255,0.15),0 0 40px rgba(255,255,255,0.05)}} .hope-glow{animation:hope-glow 3s ease-in-out infinite}`}</style>

      {/* Sidebar — fixed, shadcn-admin pattern */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-[var(--border)] bg-[var(--background)] transition-all duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 ${collapsed ? 'md:w-[56px]' : 'md:w-[220px]'} w-[220px]`}>
        <div className={`flex h-[64px] shrink-0 items-center border-b border-[var(--border)] ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-3'}`}>
          {!collapsed ? (
            <>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)]"><VercelMark className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold tracking-[-0.02em] text-[var(--foreground)]">HOPE</p></div>
              <button onClick={() => setCollapsed(!collapsed)} aria-label="Ciutkan sidebar" title="Ciutkan" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] hover:border-[var(--border)]">
                <CollapseIcon collapsed={false} />
              </button>
            </>
          ) : (
            <button onClick={() => setCollapsed(!collapsed)} aria-label="Buka sidebar" title="Buka" className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] hover:border-[var(--border)]">
              <CollapseIcon collapsed={true} />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          <p className={`px-2 pb-1 pt-2 font-mono text-[11px] font-medium tracking-widest ${collapsed ? 'hidden' : 'block'}`} style={{ color: 'var(--muted)' }}>MENU</p>
          {NAV_ITEMS.map((item) => (
            <button key={item.id} onClick={() => navigate(item.id)} title={collapsed ? item.label : undefined}
              className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm tracking-[-0.01em] transition-colors ${activePage === item.id ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]'}`}>
              <Icon d={item.icon} className={`h-[18px] w-[18px] shrink-0 ${activePage === item.id ? 'text-[var(--primary-foreground)]' : 'text-[var(--muted)] group-hover:text-[var(--foreground)]'}`} />
              {!collapsed && <span className="flex-1 truncate font-medium">{item.label}</span>}
              {!collapsed && !['beranda','proses','akumulasi'].includes(item.id) && <BadgeSoon />}
            </button>
          ))}
        </nav>

        <div className="shrink-0 p-2 border-t border-[var(--border)]">
          <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm tracking-[-0.01em] text-[var(--muted-foreground)] hover:text-red-400 hover:bg-red-950/20 transition-colors">
            <Icon d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* SidebarInset: main content area */}
      <div className="sidebar-inset">
        <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-md border border-[var(--border)] bg-[var(--card)] p-2 text-[var(--muted)] hover:border-white hover:text-[var(--foreground)] md:hidden" onClick={() => setMobileOpen(true)} aria-label="Buka menu"><Icon d={ICONS.menu} className="h-4 w-4" /></button>
            <div className="hidden h-6 w-px bg-[var(--border)] md:block" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-[-0.02em] text-[var(--foreground)]">{active?.title}</h1>
                <span className="hidden rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide text-[var(--muted-foreground)] md:inline-flex">{activePage.toUpperCase()}</span>
              </div>
              <p className="hidden text-xs tracking-[-0.01em] text-[var(--muted-foreground)] md:block">HOPE · Otomatisasi BLC & Akumulasi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden font-mono text-xs tracking-[-0.01em] text-[var(--muted)] lg:block">{today}</span>
            <div className="relative" ref={profileRef}>
              <button onClick={() => setProfileOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-medium text-[var(--primary-foreground)] ring-2 ring-transparent hover:ring-[var(--border)] transition"
                aria-haspopup="menu" aria-expanded={profileOpen} title="Menu akun">
                OP
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-10 z-40 w-56 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
                  <div className="border-b border-[var(--border)] p-3">
                    <p className="text-sm font-semibold tracking-[-0.01em] text-[var(--foreground)]">Operator</p>
                    <p className="mt-0.5 font-mono text-xs tracking-[-0.01em] text-[var(--muted-foreground)]">HOPE · authenticated</p>
                  </div>
                  <div className="p-1.5">
                    <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm tracking-[-0.01em] text-[var(--foreground)] hover:bg-[var(--secondary)]">
                      <Icon d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" className="h-4 w-4" />
                      Keluar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[var(--background)]">
          <div className="mx-auto max-w-[1160px] p-4 md:p-6">
            <div className="mb-4 flex items-center gap-1.5 font-mono text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5 text-[var(--muted-foreground)]"><VercelMark className="h-3 w-3" /> HOPE</span>
              <span className="text-[var(--border)]">/</span>
              <span className="font-medium tracking-[-0.01em] text-[var(--foreground)]">{active?.title}</span>
            </div>

            {activePage === 'beranda' && <BerandaPage lastResult={lastResult} onNavigate={navigate} />}
            {activePage === 'proses' && <ProsesPage summary={lastResult} setSummary={setLastResult} />}
            {activePage === 'akumulasi' && <AkumulasiPage />}
            {activePage === 'riwayat' && <RiwayatPage />}
            {activePage === 'referensi' && <ReferensiPage />}
            {activePage === 'panduan' && <PanduanPage />}
            {activePage === 'pengaturan' && <PengaturanPage />}

            <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] py-4 font-mono text-xs tracking-[-0.01em] text-[var(--muted)]">
              <span>© 2026 HOPE · <span className="hope-glow" style={{ color: 'var(--muted-foreground)' }}>Help Out Purest Entity</span></span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}