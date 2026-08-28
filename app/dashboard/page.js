'use client';

import { useState, useEffect } from 'react';
import { processBlc } from '../../lib/blcClient';
import { fillAkumulasi, parseDailyFile, parseWorkbookAny, detectKind, diagnoseFile } from '../../lib/akumulasiClient';

/* ── Vercel Geist — icons (1.5 stroke, 16-18px) ── */
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
    width="1.5em"
    height="1.5em"
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.5}
    xmlns="http://www.w3.org/2000/svg"
    color="currentColor"
    className={`h-5 w-5 transition-transform ${collapsed ? 'rotate-180' : ''}`}
  >
    <path d="M19 21L5 21C3.89543 21 3 20.1046 3 19L3 5C3 3.89543 3.89543 3 5 3L19 3C20.1046 3 21 3.89543 21 5L21 19C21 20.1046 20.1046 21 19 21Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
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
  cog: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
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

/* ── Vercel dark primitives (force dark) ── */
function Card({ children, className = '' }) {
  return <div className={`rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] ${className}`}>{children}</div>;
}
function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#1f1f1f] px-4 py-3.5">
      <div>
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs leading-4 text-[#888]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function StatCard({ label, value, hint }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium tracking-[-0.01em] text-[#888]">{label}</p>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-[#1f1f1f] bg-black text-[#888]">
          <Icon d={ICONS.chart} className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-[#888]">{hint}</p>}
    </Card>
  );
}
function BadgeSoon() {
  return <span className="rounded-full border border-[#232323] bg-[#111] px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-[#888]">Soon</span>;
}
function VercelButton({ variant = 'primary', children, className = '', ...props }) {
  const base = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3.5 text-sm font-medium tracking-[-0.01em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const styles = {
    primary: 'bg-white text-black hover:bg-[#ededed] border border-white',
    secondary: 'bg-[#0a0a0a] text-[#ededed] border border-[#262626] hover:border-white hover:bg-[#1a1a1a]',
    ghost: 'bg-transparent text-[#888] hover:text-white hover:bg-[#1a1a1a] border border-transparent',
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
function StepNumber({ n }) {
  return <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#262626] bg-[#111] text-xs font-medium text-white">{n}</span>;
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
    }
  };
  const removeFile = (name) => setJitFiles((prev) => prev.filter((f) => f.name !== name));
  const resetAll = () => { setJitFiles([]); setStuffingFile(null); setStatus('idle'); setMessage(''); setError(null); setSummary(null); };

  const handleProcess = async () => {
    setStatus('processing');
    setSummary(null);
    setMessage(stuffingFile ? 'Menyusun sheet Blc…' : 'Menggabungkan file JIT…');
    try {
      const { data, filename, report, warnings } = await processBlc({
        jitFiles: await Promise.all(jitFiles.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))),
        stuffingFile: stuffingFile ? { name: stuffingFile.name, bytes: new Uint8Array(await stuffingFile.arrayBuffer()) } : null,
        onProgress: (msg) => setMessage(msg),
      });
      setSummary(report);
      if (warnings?.length) console.info('[BLC]', warnings);
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
      setStatus('success');
      setMessage(stuffingFile ? `Selesai — Blc ditimpa (${report.nbOrders} order) → ${filename}` : `Selesai — ${jitFiles.length} file → ${report.nbOrders} order → ${filename}`);
    } catch (err) { console.error(err); setStatus('error'); setMessage(err.message || 'Gagal memproses.'); }
  };

  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { n: '1', t: 'Upload JIT', d: 'Pilih semua laporan sekaligus. Urutkan dari lama ke baru.' },
          { n: '2', t: 'Filter NB', d: 'Hanya U**N* (U07NB) dipakai; BC/PU/UV dibuang.' },
          { n: '3', t: 'Gabungkan', d: 'Duplikat: file pertama menang. Hasil jadi sheet Blc.' },
          { n: '4', t: 'Timpa Blc (opsional)', d: 'Jika Stuffing List ada, langsung timpa sheet Blc di dalamnya.' },
        ].map((s) => (
          <Card key={s.n} className="p-4">
            <StepNumber n={s.n} />
            <p className="mt-3 text-sm font-medium tracking-[-0.01em] text-white">{s.t}</p>
            <p className="mt-1 text-xs leading-5 text-[#888]">{s.d}</p>
          </Card>
        ))}
      </ol>

      <div
        role="button" tabIndex={0}
        onClick={() => document.getElementById('jit-input')?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && document.getElementById('jit-input')?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files)); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-[#0a0a0a] px-6 py-10 text-center transition-colors ${error ? 'border-red-900 bg-red-950/20' : dragOver ? 'border-white bg-[#111]' : 'border-[#262626] hover:border-white hover:bg-[#111]'}`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#262626] bg-black text-[#888]">
          <Icon d={ICONS.upload} className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-medium tracking-[-0.01em] text-white">Klik atau seret file Data JIT ke sini</p>
          <p className="mt-1 text-xs text-[#888]">.xlsx / .xls · bisa banyak file sekaligus</p>
        </div>
        <input id="jit-input" type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) addFiles(Array.from(e.target.files)); e.target.value=''; }} />
      </div>

      <div
        role="button" tabIndex={0}
        onClick={() => document.getElementById('stuffing-input')?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && document.getElementById('stuffing-input')?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOverStuffing(true); }}
        onDragLeave={() => setDragOverStuffing(false)}
        onDrop={(e) => { e.preventDefault(); setDragOverStuffing(false); const f=e.dataTransfer.files?.[0]; if(!f) return; const err=validateFile(f); setError(err); if(!err) setStuffingFile(f); }}
        className={`flex cursor-pointer items-center gap-3 rounded-lg border bg-[#0a0a0a] px-4 py-3.5 transition-colors ${stuffingFile ? 'border-white bg-[#111]' : dragOverStuffing ? 'border-white bg-[#111]' : 'border-[#262626] hover:border-white'}`}
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-sm ${stuffingFile ? 'border-white bg-white text-black' : 'border-[#262626] bg-black text-[#888]'}`}>{stuffingFile ? '✓' : '+'}</span>
        <div className="min-w-0 flex-1 text-left">
          <p className="flex items-center gap-2 text-sm font-medium tracking-[-0.01em] text-white">Stuffing List <span className="rounded-full bg-[#111] border border-[#262626] px-2 py-0.5 text-[10px] font-medium tracking-wide text-[#888]">Opsional</span></p>
          <p className="mt-0.5 truncate text-xs text-[#888]">{stuffingFile ? `${stuffingFile.name} · Blc akan ditimpa` : 'Upload untuk langsung timpa sheet Blc — output jadi Stuffing List terupdate'}</p>
        </div>
        {stuffingFile && <button type="button" onClick={(e)=>{e.stopPropagation(); setStuffingFile(null);}} className="rounded-md p-1.5 text-[#666] hover:bg-black hover:text-white border border-transparent hover:border-[#262626]"><Icon d="M6 18L18 6M6 6l12 12" className="h-4 w-4" /></button>}
        <input id="stuffing-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={(e)=>{const f=e.target.files?.[0]; if(f){const err=validateFile(f); setError(err); if(!err) setStuffingFile(f);} e.target.value='';}} />
      </div>

      {error && <div className="flex items-center gap-2 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs leading-4 text-red-400"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />{error}</div>}

      {jitFiles.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-[#1f1f1f] bg-[#111] px-3 py-2 flex items-center justify-between">
            <p className="text-xs font-medium tracking-[-0.01em] text-[#888]">{jitFiles.length} file terpilih</p>
            <span className="text-xs text-[#666]">Urutan = prioritas</span>
          </div>
          <ul className="divide-y divide-[#1f1f1f]">
            {jitFiles.map((f,i)=>(
              <li key={f.name+f.size} className="flex items-center gap-3 px-3 py-2.5">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-xs font-medium text-black">{i+1}</span>
                <span className="min-w-0 flex-1 truncate text-sm tracking-[-0.01em] text-white">{f.name}</span>
                <span className="shrink-0 font-mono text-xs text-[#888]">{(f.size/1024).toFixed(0)} KB</span>
                <button onClick={()=>removeFile(f.name)} className="rounded-md border border-transparent p-1 text-[#666] hover:border-[#262626] hover:bg-[#111] hover:text-white"><Icon d="M6 18L18 6M6 6l12 12" className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {message && (
        <div className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm ${status==='success'?'border-[#1a3a1a] bg-[#0a1a0a] text-[#4ade80]': status==='error'?'border-[#3a1a1a] bg-[#1a0a0a] text-[#f87171]':'border-[#262626] bg-[#111] text-[#ededed]'}`}>
          {status==='processing' && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#262626] border-t-white" />}
          {status!=='processing' && <span className={`h-1.5 w-1.5 rounded-full ${status==='success'?'bg-[#4ade80]':'bg-[#f87171]'}`} />}
          <span className="text-sm tracking-[-0.01em]">{message}</span>
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
            <Card key={k} className="px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#888]">{k}</p>
              <p className="mt-1 text-sm font-semibold tracking-[-0.01em] text-white">{v ?? '-'}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {jitFiles.length>0 && <VercelButton variant="secondary" onClick={resetAll}>Reset</VercelButton>}
        <VercelButton variant="primary" onClick={handleProcess} disabled={jitFiles.length===0 || status==='processing' || !!error}>
          {status==='processing' ? 'Memproses…' : stuffingFile ? 'Timpa Blc & Unduh' : 'Gabungkan & Unduh'}
        </VercelButton>
      </div>
      {jitFiles.length===0 && <p className="text-right font-mono text-xs text-[#666]">Pilih minimal 1 file JIT.</p>}
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
        <h2 className="text-[13px] font-semibold tracking-[-0.02em] text-white">Navigasi Cepat</h2>
        <p className="mt-1 text-sm leading-5 text-[#888]">Pilih menu — tombol besar, nyaman di klik, langsung masuk ke fitur.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="group flex min-h-[96px] items-center gap-4 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-5 text-left transition-colors hover:border-white hover:bg-[#111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#232323] bg-black text-white group-hover:border-white group-hover:bg-white group-hover:text-black transition-colors">
              <Icon d={item.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold tracking-[-0.01em] text-white group-hover:text-white">{item.label}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-[#888]">{menuDesc[item.id]}</span>
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#232323] bg-black text-[#666] group-hover:border-white group-hover:bg-white group-hover:text-black transition-colors">
              <Icon d="M8.25 4.5l7.5 7.5-7.5 7.5" className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
      <p className="font-mono text-xs text-[#666]">Tips: gunakan tombol di atas — setara dengan klik menu di sidebar, tapi lebih ergonomis di dashboard.</p>
    </div>
  );
}

/* ── Riwayat ── */
function RiwayatPage() {
  const cols=['Tanggal','File JIT','Order NB','Output','Status'];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><BadgeSoon /><span className="text-xs text-[#888]">Fitur segera hadir</span></div>
      <Card>
        <CardHeader title="Riwayat Pemrosesan" subtitle="Arsip hasil penggabungan per hari" />
        <div className="overflow-hidden">
          <table className="w-full text-left">
            <thead><tr className="border-b border-[#1f1f1f] bg-[#111]">{cols.map(c=> <th key={c} className="px-4 py-2.5 font-mono text-xs font-medium tracking-widest text-[#888]">{c.toUpperCase()}</th>)}</tr></thead>
            <tbody><tr><td colSpan={cols.length} className="px-4 py-12 text-center text-sm text-[#666]">Belum ada riwayat. Proses yang berhasil akan tercatat di sini.</td></tr></tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── Referensi ── */
function ReferensiPage() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader title="Format Input — Data JIT" subtitle="Kolom yang dikenali sistem" />
        <div className="p-4">
          <p className="text-sm leading-6 tracking-[-0.01em] text-[#888]">Sistem mencari header <code className="rounded border border-[#262626] bg-[#111] px-1 py-0.5 font-mono text-xs">OrdNo</code> + <code className="rounded border border-[#262626] bg-[#111] px-1 py-0.5 font-mono text-xs">StyleNo</code> di sheet manapun, lalu simpan OrdNo pola <span className="font-mono text-xs font-medium text-white">U**N*</span>.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{JIT_COLUMNS.map(c=> <code key={c} className="rounded-md border border-[#262626] bg-[#111] px-2 py-1 font-mono text-xs text-[#ededed]">{c}</code>)}</div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Format Output — BLC" subtitle="Acuan: BLC HDU 8.22 PAGI.xlsx" />
        <div className="p-4">
          <pre className="overflow-x-auto rounded-md border border-[#1f1f1f] bg-black p-4 font-mono text-xs leading-6 text-[#ededed]">{`Baris 1  : Production Report By Order
Baris 2  : (kosong)
Baris 3  : <tahun> <bulan>        2026 8
Baris 4  : jumlah baris data
Baris 5  : header kolom (OrdNo …)
Baris 6+ : data order NB gabungan

Sheet    : BLC HDU <bulan>.<tanggal> PAGI
File     : BLC HDU <bulan>.<tanggal>.xlsx`}</pre>
          <p className="mt-3 text-xs leading-5 text-[#888]">Duplikasi: file pertama menang (urut unggah).</p>
        </div>
      </Card>
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
    <Card>
      <CardHeader title="Panduan Penggunaan" subtitle="Alur unggah → BLC" />
      <div className="p-4">
        <ol className="relative space-y-5 border-l border-[#262626] pl-6">
          {steps.map((s,i)=>(
            <li key={s.t} className="relative">
              <span className="absolute -left-[25px] flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-medium text-black">{i+1}</span>
              <p className="text-sm font-medium tracking-[-0.01em] text-white">{s.t}</p>
              <p className="mt-1 text-sm leading-6 tracking-[-0.01em] text-[#888]">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-md border border-[#facc15]/20 bg-[#1a1a0a] px-3 py-2.5 text-xs leading-5 text-[#facc15]">Jika header JIT berbeda dan gagal terbaca, kirim contoh file agar deteksi disesuaikan.</div>
      </div>
    </Card>
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
      <div className="flex items-center gap-2"><BadgeSoon /><span className="text-xs text-[#888]">Pratinjau</span></div>
      <Card>
        <CardHeader title="Preferensi" subtitle="Opsi pratinjau" />
        <ul className="divide-y divide-[#1f1f1f] px-4">
          {items.map(s=>(
            <li key={s.t} className="flex items-center justify-between gap-4 py-4">
              <div><p className="text-sm font-medium tracking-[-0.01em] text-white">{s.t}</p><p className="mt-0.5 text-xs leading-4 text-[#888]">{s.d}</p></div>
              <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border ${s.on?'bg-white border-white':'bg-black border-[#262626]'}`}><span className={`h-3.5 w-3.5 rounded-full shadow-sm transition-transform ${s.on?'translate-x-4 bg-black':'translate-x-0.5 bg-[#333]'}`} /></span>
            </li>
          ))}
        </ul>
      </Card>
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
          <Card key={s.n} className="p-4"><StepNumber n={s.n} /><p className="mt-3 text-sm font-medium tracking-[-0.01em] text-white">{s.t}</p><p className="mt-1 text-xs leading-5 text-[#888]">{s.d}</p></Card>
        ))}
      </ol>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {slots.map(s=>(
          <label key={s.key} className={`group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border bg-[#0a0a0a] px-6 py-8 text-center transition-colors ${files[s.key] ? 'border-white bg-[#111]' : 'border-[#262626] hover:border-white hover:bg-[#111]'}`}>
            <span className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm ${files[s.key] ? 'border-white bg-white text-black' : 'border-[#262626] bg-black text-[#888] group-hover:border-white group-hover:text-white'}`}>{files[s.key] ? '✓' : '+'}</span>
            <p className="text-sm font-medium tracking-[-0.01em] text-white">{s.label}</p>
            <p className="max-w-[90%] truncate font-mono text-xs text-[#888]">{files[s.key]?.name || s.desc}</p>
            <input type="file" accept=".xlsx,.xls,.htm,.html" className="hidden" onChange={pick(s.key)} />
          </label>
        ))}
      </div>

      {message && (
        <div className={`flex gap-2.5 rounded-md border px-3 py-2.5 text-sm ${status==='success'?'border-[#1a3a1a] bg-[#0a1a0a] text-[#4ade80]':status==='error'?'border-[#3a1a1a] bg-[#1a0a0a] text-[#f87171]':'border-[#262626] bg-[#111] text-[#ededed]'}`}>
          {status==='processing' && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#262626] border-t-white" />}
          {status!=='processing' && <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${status==='success'?'bg-[#4ade80]':'bg-[#f87171]'}`} />}
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm tracking-[-0.01em]">{message}</span>
          {status==='error' && errorHelp && (
            <div className="relative ml-auto shrink-0">
              <button type="button" onMouseEnter={()=>setShowTip(true)} onMouseLeave={()=>setShowTip(false)} onClick={()=>setShowTip(v=>!v)} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#3a1a1a] bg-black text-xs font-medium text-[#f87171] hover:bg-[#1a0a0a]">?</button>
              {showTip && <div className="absolute right-0 top-8 z-10 w-72 rounded-lg border border-[#232323] bg-[#1a1a1a] p-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.5)]"><p className="text-xs font-semibold tracking-[-0.01em] text-white">{errorHelp.title}</p><ol className="mt-1.5 list-decimal list-inside space-y-0.5 text-xs leading-5 text-[#888]">{errorHelp.steps.map((x,i)=><li key={i}>{x}</li>)}</ol>{errorHelp.note && <p className="mt-2 text-xs italic text-[#666]">{errorHelp.note}</p>}</div>}
            </div>
          )}
        </div>
      )}
      {status==='error' && errorHelp && (
        <Card className="border-[#facc15]/20 bg-[#1a1a0a]">
          <div className="flex gap-3 p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#facc15]/20 bg-black text-sm">💡</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium tracking-[-0.01em] text-[#facc15]">{errorHelp.title}</p>
              <ol className="mt-2 list-decimal list-inside space-y-1 text-sm leading-6 tracking-[-0.01em] text-[#facc15]/90">{errorHelp.steps.map((x,i)=><li key={i}>{x}</li>)}</ol>
              {errorHelp.note && <p className="mt-2 text-xs italic leading-4 text-[#facc15]/70">{errorHelp.note}</p>}
              <p className="mt-2 font-mono text-[11px] text-[#facc15]/60">Detail teknis di Console (F12).</p>
            </div>
          </div>
        </Card>
      )}
      {summary && <div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-3 text-center"><p className="font-mono text-[10px] uppercase tracking-widest text-[#888]">Sel Terisi</p><p className="mt-1 text-sm font-semibold tracking-[-0.02em] text-white">{summary.cells}</p></div><div className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-3 text-center"><p className="font-mono text-[10px] uppercase tracking-widest text-[#888]">Blok Minggu</p><p className="mt-1 text-sm font-semibold tracking-[-0.02em] text-white">{summary.weeks}</p></div></div>}

      <div className="flex items-center justify-end gap-2">
        {ready && <VercelButton variant="secondary" onClick={()=>{setFiles({ass:null,stt:null}); setStatus('idle'); setMessage(''); setErrorHelp(null); setShowTip(false); setSummary(null);}}>Reset</VercelButton>}
        <VercelButton variant="primary" disabled={!ready || status==='processing'} onClick={handleProcess}>{status==='processing' ? 'Memproses…' : 'Isi Akumulasi & Unduh'}</VercelButton>
      </div>
    </div>
  );
}

/* ── Shell — Vercel dark (force) ── */
export default function Dashboard() {
  const [activePage, setActivePage] = useState('beranda');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const navigate = (page) => { setActivePage(page); setMobileOpen(false); };
  const active = NAV_ITEMS.find((n) => n.id === activePage);
  const [today, setToday] = useState('');
  useEffect(() => { setToday(new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())); }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-black text-[#ededed] selection:bg-white selection:text-black" style={{ fontFamily: 'Inter, "Geist Sans", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif', fontFeatureSettings: '"ss01","ss02"' }}>
      <style>{`html{color-scheme:dark} ::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:#262626;border-radius:999px;border:2px solid #000}::-webkit-scrollbar-thumb:hover{background:#333} *{scrollbar-width:thin; scrollbar-color:#262626 #000} input::placeholder{color:#666}`}</style>

      {/* Sidebar — force dark */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-[#1f1f1f] bg-black transition-all duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 ${collapsed ? 'md:w-[56px]' : 'md:w-[220px]'} w-[220px]`}>
        <div className={`flex h-[64px] shrink-0 items-center border-b border-[#1f1f1f] ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-3'}`}>
          {!collapsed ? (
            <>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-black"><VercelMark className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold tracking-[-0.02em] text-white">BLC Processor</p><p className="truncate font-mono text-[10px] tracking-wide text-[#888]">STUFFING SUITE</p></div>
              <button
                onClick={() => setCollapsed(!collapsed)}
                aria-label="Ciutkan sidebar"
                title="Ciutkan"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-[#666] hover:bg-[#111] hover:text-white hover:border-[#232323]"
              >
                <CollapseIcon collapsed={false} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label="Buka sidebar"
              title="Buka"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#1f1f1f] bg-[#0a0a0a] text-[#888] hover:bg-[#111] hover:text-white hover:border-[#333]"
            >
              <CollapseIcon collapsed={true} />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          <p className={`px-2 pb-1 pt-2 font-mono text-[11px] font-medium tracking-widest text-[#666] ${collapsed ? 'hidden' : 'block'}`}>MENU</p>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm tracking-[-0.01em] transition-colors ${activePage === item.id ? 'bg-white text-black' : 'text-[#888] hover:bg-[#111] hover:text-white'}`}
            >
              <Icon d={item.icon} className={`h-[18px] w-[18px] shrink-0 ${activePage === item.id ? 'text-black' : 'text-[#666] group-hover:text-white'}`} />
              {!collapsed && <span className="flex-1 truncate font-medium">{item.label}</span>}
              {!collapsed && !['beranda','proses','akumulasi'].includes(item.id) && <BadgeSoon />}
            </button>
          ))}
        </nav>


      </aside>

      {mobileOpen && <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col bg-black">
        <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-[#1f1f1f] bg-black px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-md border border-[#232323] bg-[#0a0a0a] p-2 text-[#888] hover:border-white hover:text-white md:hidden" onClick={() => setMobileOpen(true)} aria-label="Buka menu"><Icon d={ICONS.menu} className="h-4 w-4" /></button>
            <div className="hidden h-6 w-px bg-[#1f1f1f] md:block" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-[-0.02em] text-white">{active?.title}</h1>
                <span className="hidden rounded-full border border-[#232323] bg-[#0a0a0a] px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide text-[#888] md:inline-flex">{activePage.toUpperCase()}</span>
              </div>
              <p className="hidden text-xs tracking-[-0.01em] text-[#888] md:block">Stuffing Processor · Otomatisasi BLC & Akumulasi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden font-mono text-xs tracking-[-0.01em] text-[#666] lg:block">{today}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-medium text-black">OP</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-black">
          <div className="mx-auto max-w-[1160px] p-4 md:p-6">
            <div className="mb-4 flex items-center gap-1.5 font-mono text-xs text-[#666]">
              <span className="inline-flex items-center gap-1.5 text-[#888]"><VercelMark className="h-3 w-3 text-white" /> stuffing</span>
              <span className="text-[#232323]">/</span>
              <span className="font-medium tracking-[-0.01em] text-white">{active?.title}</span>
            </div>

            {activePage === 'beranda' && <BerandaPage lastResult={lastResult} onNavigate={navigate} />}
            {activePage === 'proses' && <ProsesPage summary={lastResult} setSummary={setLastResult} />}
            {activePage === 'akumulasi' && <AkumulasiPage />}
            {activePage === 'riwayat' && <RiwayatPage />}
            {activePage === 'referensi' && <ReferensiPage />}
            {activePage === 'panduan' && <PanduanPage />}
            {activePage === 'pengaturan' && <PengaturanPage />}

            <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#1f1f1f] py-4 font-mono text-xs tracking-[-0.01em] text-[#666]">
              <span>© 2026 BLC Processor · Built with Vercel Geist · Force Dark</span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
