'use client';

import { useState, useEffect } from 'react';
import { processBlc } from '../../lib/blcClient';
import { fillAkumulasi, parseDailyFile, parseWorkbookAny, detectKind, diagnoseFile } from '../../lib/akumulasiClient';

/* ══════════════════════════════════════════════════════════════
   Icons (inline, heroicons outline)
   ══════════════════════════════════════════════════════════════ */
const Icon = ({ d, className = 'h-5 w-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const ICONS = {
  home: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75',
  bolt: 'M13 10V3L4 14h7v7l9-11h-7z',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  doc: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  book: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  cog: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  chart: 'M3 3v18h18M7 16l4-8 4 4 5-9',
  chevron: 'M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5',
  menu: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
};

/* ══════════════════════════════════════════════════════════════
   Nav config
   ══════════════════════════════════════════════════════════════ */
const NAV_ITEMS = [
  { id: 'beranda', label: 'Beranda', title: 'Beranda', icon: ICONS.home },
  { id: 'proses', label: 'Proses BLC', title: 'Proses BLC', icon: ICONS.bolt },
  { id: 'akumulasi', label: 'Akumulasi', title: 'Akumulasi Produksi', icon: ICONS.chart },
  { id: 'riwayat', label: 'Riwayat Proses', title: 'Riwayat Proses', icon: ICONS.clock },
  { id: 'referensi', label: 'Referensi Format', title: 'Referensi Format File', icon: ICONS.doc },
  { id: 'panduan', label: 'Panduan', title: 'Panduan Penggunaan', icon: ICONS.book },
  { id: 'pengaturan', label: 'Pengaturan', title: 'Pengaturan', icon: ICONS.cog },
];

const JIT_COLUMNS = ['OrdNo','StyleNo','OrdPairs','StitProd','StitBal','RBProd','RBBal','InsoleProd','InsoleBal','BottProd','BottBal','StockInStk','Balance','AssProd','AssBal','PackProd','PackBal','FinProd','FinBal','StyleName','color','Type'];

/* ══════════════════════════════════════════════════════════════
   Small building blocks
   ══════════════════════════════════════════════════════════════ */
function StatCard({ label, value, hint, accent = 'indigo' }) {
  const accents = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${accents[accent]}`}>
        <Icon d={ICONS.bolt} className="h-4 w-4" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-gray-500">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function PlaceholderBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 ring-1 ring-amber-200">
      Segera Hadir
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE — Proses BLC (upload + merge)
   ══════════════════════════════════════════════════════════════ */
function ProsesPage({ summary, setSummary }) {
  const [jitFiles, setJitFiles] = useState([]);
  const [stuffingFile, setStuffingFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(null);
  const [isDraggingStuffing, setIsDraggingStuffing] = useState(false);

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
  const resetAll = () => {
    setJitFiles([]); setStuffingFile(null);
    setStatus('idle'); setMessage(''); setError(null); setSummary(null);
  };

  const handleProcess = async () => {
    setStatus('processing');
    setSummary(null);
    setMessage(stuffingFile
      ? 'Memproses di browser: menyusun & memformat sheet Blc...'
      : 'Memproses di browser: menggabungkan file JIT...');

    try {
      const { data, filename, report, warnings } = await processBlc({
        jitFiles: await Promise.all(jitFiles.map(async (f) => ({
          name: f.name,
          bytes: new Uint8Array(await f.arrayBuffer()),
        }))),
        stuffingFile: stuffingFile
          ? { name: stuffingFile.name, bytes: new Uint8Array(await stuffingFile.arrayBuffer()) }
          : null,
        onProgress: (msg) => setMessage(msg),
      });

      setSummary(report);
      if (warnings?.length) console.info('[BLC Processor]', warnings);

      const blob = new Blob([data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);

      setStatus('success');
      setMessage(stuffingFile
        ? `Selesai! Sheet "Blc" pada Stuffing List ditimpa (${report.nbOrders} order NB) — ${filename} terunduh.`
        : `Selesai! ${jitFiles.length} file JIT digabung menjadi ${report.nbOrders} order NB — ${filename} terunduh.`);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(err.message || 'Terjadi kesalahan saat memproses file.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Steps */}
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {[
          { num: '1', title: 'Upload Multi File JIT', desc: 'Pilih semua laporan JIT sekaligus. Urutkan dari data paling lama (pagi) ke terbaru.' },
          { num: '2', title: 'Filter Order NB', desc: 'Order dengan pola "U" + 2 digit + "N" (U07NB…, U07N…) dipakai; lini BC (U07BC…) dan PU/UV/PDU dibuang.' },
          { num: '3', title: 'Gabungkan → BLC', desc: 'Order duplikat antar-file diambil dari file yang diunggah lebih dulu, lalu disusun jadi BLC.' },
          { num: '4', title: 'Opsional: Timpa Sheet Blc', desc: 'Jika Stuffing List diunggah, hasil BLC menimpa sheet "Blc" di dalamnya — output jadi Stuffing List terupdate.' },
        ].map((s) => (
          <li key={s.num} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{s.num}</span>
            <p className="text-sm font-semibold text-gray-800">{s.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">{s.desc}</p>
          </li>
        ))}
      </ol>

      {/* Dropzone */}
      <div
        role="button" tabIndex={0}
        onClick={() => document.getElementById('jit-input')?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && document.getElementById('jit-input')?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files)); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors
          ${error ? 'border-red-300 bg-red-50/60'
            : isDragging ? 'border-indigo-400 bg-indigo-50'
            : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40'}`}
      >
        <Icon d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" className="h-10 w-10 text-gray-400" />
        <div>
          <p className="text-sm font-semibold text-gray-800">Klik atau seret file Data JIT ke sini</p>
          <p className="mt-1 text-xs text-gray-500">Format .xlsx / .xls · bisa banyak file sekaligus</p>
        </div>
        <input id="jit-input" type="file" accept=".xlsx,.xls" multiple className="hidden"
               onChange={(e) => { if (e.target.files?.length) addFiles(Array.from(e.target.files)); e.target.value = ''; }} />
      </div>

      {/* Optional: Stuffing List upload */}
      <div
        role="button" tabIndex={0}
        onClick={() => document.getElementById('stuffing-input')?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && document.getElementById('stuffing-input')?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDraggingStuffing(true); }}
        onDragLeave={() => setIsDraggingStuffing(false)}
        onDrop={(e) => {
          e.preventDefault(); setIsDraggingStuffing(false);
          const f = e.dataTransfer.files?.[0];
          if (!f) return;
          const err = validateFile(f);
          setError(err);
          if (!err) setStuffingFile(f);
        }}
        className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed px-5 py-4 transition-colors
          ${error ? 'border-red-300 bg-red-50/60'
            : isDraggingStuffing ? 'border-indigo-400 bg-indigo-50'
            : stuffingFile ? 'border-emerald-300 bg-emerald-50/50'
            : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40'}`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stuffingFile ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
          {stuffingFile ? '✓' : '+'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800">
            Stuffing List <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Opsional</span>
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {stuffingFile
              ? `${stuffingFile.name} · sheet "Blc" akan ditimpa hasil BLC`
              : 'Isi jika ingin langsung menimpa sheet "Blc" di file Stuffing List — output menjadi file tersebut'}
          </p>
        </div>
        {stuffingFile && (
          <button type="button" onClick={(e) => { e.stopPropagation(); setStuffingFile(null); }} aria-label="Hapus Stuffing List"
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600">✕</button>
        )}
        <input id="stuffing-input" type="file" accept=".xlsx,.xls" className="hidden"
               onChange={(e) => {
                 const f = e.target.files?.[0];
                 if (f) { const err = validateFile(f); setError(err); if (!err) setStuffingFile(f); }
                 e.target.value = '';
               }} />
      </div>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">⚠️ {error}</p>
      )}

      {/* Selected files */}
      {jitFiles.length > 0 && (
        <ul className="space-y-1.5">
          {jitFiles.map((f, i) => (
            <li key={f.name + f.size} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{f.name}</span>
              <span className="shrink-0 text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => removeFile(f.name)} aria-label={`Hapus ${f.name}`}
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600">✕</button>
            </li>
          ))}
        </ul>
      )}

      {/* Status */}
      {message && (
        <div role="alert" className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${
          status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : status === 'error' ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-indigo-200 bg-indigo-50 text-indigo-800'}`}>
          {status === 'processing' && (
            <svg className="h-4 w-4 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
          {(status === 'success' || status === 'error') && <span>{status === 'success' ? '✅' : '⚠️'}</span>}
          <span>{message}</span>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['File JIT', summary.jitFiles],
            ['Order NB', summary.nbOrders],
            ['Periode', summary.period],
            ['Mode Output', summary.mode === 'stuffing' ? 'Stuffing List' : 'File BLC'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-center shadow-sm">
              <dt className="text-[10px] uppercase tracking-wide text-gray-400">{label}</dt>
              <dd className="text-lg font-bold text-gray-800">{value ?? '-'}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {jitFiles.length > 0 && (
          <button onClick={resetAll}
                  className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Reset
          </button>
        )}
        <button onClick={handleProcess}
                disabled={jitFiles.length === 0 || status === 'processing' || !!error}
                className={`inline-flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-md transition-all
                  ${jitFiles.length > 0 && !error && status !== 'processing'
                    ? 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-[0.98]'
                    : 'cursor-not-allowed bg-gray-300 shadow-none'}`}>
          {status === 'processing' ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Memproses...
            </>
          ) : (
            <>
              <Icon d={ICONS.bolt} className="h-4 w-4" />
              {stuffingFile ? 'Timpa Sheet Blc & Unduh Stuffing' : 'Gabungkan & Unduh BLC'}
            </>
          )}
        </button>
      </div>

      {jitFiles.length === 0 && (
        <p className="text-right text-xs text-gray-400">Pilih minimal satu file JIT untuk mengaktifkan tombol.</p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE — Beranda
   ══════════════════════════════════════════════════════════════ */
function BerandaPage({ lastResult, onNavigate }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="File JIT Terakhir" value={lastResult ? lastResult.jitFiles : '—'} hint={lastResult ? 'Hasil proses terakhir' : 'Belum ada pemrosesan'} />
        <StatCard label="Order NB Tergabung" value={lastResult ? lastResult.nbOrders : '—'} hint={lastResult ? `Periode ${lastResult.period}` : 'Belum ada pemrosesan'} accent="emerald" />
        <StatCard label="Status Sistem" value="Siap" hint="Mesin penggabungan aktif" accent="amber" />
      </div>

      <SectionCard title="Mulai Cepat" subtitle="Tiga langkah menghasilkan file BLC">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <ol className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {['Upload JIT', 'Filter order NB', 'Gabung & unduh'].map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">{i + 1}</span>
                {s}
                {i < 2 && <span className="text-gray-300">→</span>}
              </li>
            ))}
          </ol>
          <button onClick={() => onNavigate('proses')}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700">
            <Icon d={ICONS.bolt} className="h-3.5 w-3.5" /> Mulai Proses
          </button>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Aktivitas Terkini" subtitle="Log pemrosesan tersimpan di menu Riwayat">
          <div className="flex flex-col items-center py-8 text-center text-gray-400">
            <Icon d={ICONS.clock} className="h-8 w-8" />
            <p className="mt-2 text-xs">Belum ada aktivitas pada sesi ini.</p>
            <button onClick={() => onNavigate('riwayat')} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">
              Lihat Riwayat →
            </button>
          </div>
        </SectionCard>
        <SectionCard title="Butuh Bantuan?" subtitle="Dokumentasi alur & format file">
          <p className="text-xs leading-relaxed text-gray-500">
            Pelajari struktur kolom JIT yang dikenali sistem dan langkah pemrosesan di menu Panduan.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => onNavigate('panduan')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Buka Panduan</button>
            <button onClick={() => onNavigate('referensi')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Referensi Format</button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE — Riwayat (placeholder)
   ══════════════════════════════════════════════════════════════ */
function RiwayatPage() {
  const cols = ['Tanggal', 'Jumlah File JIT', 'Order NB', 'Nama Output', 'Status'];
  return (
    <div className="space-y-4">
      <PlaceholderBadge />
      <SectionCard title="Riwayat Pemrosesan" subtitle="Arsip hasil penggabungan BLC per hari">
        <div className="overflow-hidden rounded-lg border border-gray-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>{cols.map((c) => <th key={c} className="px-4 py-2.5 font-semibold">{c}</th>)}</tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={cols.length} className="px-4 py-10 text-center text-gray-400">
                  Belum ada riwayat. Setiap proses yang berhasil akan tercatat di sini.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE — Referensi Format
   ══════════════════════════════════════════════════════════════ */
function ReferensiPage() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SectionCard title="Format Input — Data JIT" subtitle="Struktur kolom yang dikenali sistem">
        <p className="mb-3 text-xs leading-relaxed text-gray-500">
          Sistem mencari baris header berisi <code className="rounded bg-gray-100 px-1 font-mono text-[11px]">OrdNo</code> dan{' '}
          <code className="rounded bg-gray-100 px-1 font-mono text-[11px]">StyleNo</code> di sheet mana pun,
          lalu hanya menyimpan baris dengan OrdNo berpola <strong>U + 2 digit</strong> (mis. U07NB0001, U07N2052).
        </p>
        <div className="flex flex-wrap gap-1.5">
          {JIT_COLUMNS.map((c) => (
            <code key={c} className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-mono text-indigo-700 ring-1 ring-indigo-100">{c}</code>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Format Output — BLC" subtitle="Contoh acuan: BLC HDU 8.22 PAGI.xlsx">
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-[11px] leading-relaxed text-slate-100">
{`Baris 1  : Production Report By Order
Baris 2  : (kosong)
Baris 3  : <tahun> <bulan>        contoh: 2026 8
Baris 4  : jumlah baris data
Baris 5  : header kolom (OrdNo ...)
Baris 6+ : data order NB gabungan

Sheet    : BLC HDU <bulan>.<tanggal> PAGI
Filename : BLC HDU <bulan>.<tanggal>.xlsx`}
        </pre>
        <p className="mt-3 text-xs text-gray-500">
          Duplikasi antar-file diselesaikan dengan prioritas urutan unggah: file pertama menang.
        </p>
      </SectionCard>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE — Panduan
   ══════════════════════════════════════════════════════════════ */
function PanduanPage() {
  const steps = [
    { t: 'Siapkan file JIT', d: 'Kumpulkan semua laporan JIT harian/bulanan dalam format .xlsx. Urutkan dari data paling lama (mis. pagi) ke terbaru.' },
    { t: 'Buka menu Proses BLC', d: 'Seret atau klik area unggah, pilih beberapa file sekaligus. Daftar file bernomor sesuai urutan unggah.' },
    { t: 'Klik Gabungkan & Unduh BLC', d: 'Sistem memilah order NB, menghapus duplikat (file lebih awal menang), dan menyusun file BLC baru.' },
    { t: 'Periksa hasil unduhan', d: 'Cek jumlah baris pada baris ke-4 sheet BLC dan bandingkan dengan ringkasan Order NB di halaman.' },
  ];
  return (
    <SectionCard title="Panduan Penggunaan" subtitle="Alur lengkap dari unggahan hingga file BLC">
      <ol className="relative space-y-6 border-l-2 border-indigo-100 pl-6">
        {steps.map((s, i) => (
          <li key={s.t} className="relative">
            <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white ring-4 ring-white">
              {i + 1}
            </span>
            <p className="text-sm font-semibold text-gray-800">{s.t}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">{s.d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700 ring-1 ring-amber-100">
        ⚠️ Jika file JIT mentah Anda memiliki struktur header berbeda dan gagal terbaca, kirimkan contoh filenya agar pola deteksi dapat disesuaikan.
      </div>
    </SectionCard>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE — Pengaturan (placeholder)
   ══════════════════════════════════════════════════════════════ */
function PengaturanPage() {
  const settings = [
    { t: 'Unduh otomatis setelah proses', d: 'File BLC langsung terunduh tanpa konfirmasi tambahan.', on: true },
    { t: 'Nama sheet kustom', d: 'Ganti pola nama "BLC HDU <tgl> PAGI".', on: false },
    { t: 'Simpan riwayat ke database', d: 'Catat setiap pemrosesan beserta statistiknya.', on: false },
    { t: 'Mode gelap', d: 'Tampilan gelap untuk seluruh dashboard.', on: false },
  ];
  return (
    <div className="space-y-4">
      <PlaceholderBadge />
      <SectionCard title="Preferensi Aplikasi" subtitle="Opsi berikut masih bersifat pratinjau">
        <ul className="divide-y divide-gray-100">
          {settings.map((s) => (
            <li key={s.t} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-gray-700">{s.t}</p>
                <p className="mt-0.5 text-xs text-gray-400">{s.d}</p>
              </div>
              <span className={`relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed items-center rounded-full ${s.on ? 'bg-indigo-600 opacity-60' : 'bg-gray-200'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ${s.on ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE — Akumulasi (ASS/STT → akumulasi.xlsx)
   ══════════════════════════════════════════════════════════════ */
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
      setStatus('error'); setMessage(`Format tidak didukung.`);
      setErrorHelp({ title: 'Format file', steps: ['Gunakan file .XLS / .XLSX hasil export sistem.', 'Jika file .XLS gagal, buka di Excel → Save As → Excel Workbook (*.xlsx).'] });
      e.target.value = '';
      return;
    }
    setFiles((p) => ({ ...p, [key]: f }));
    setStatus('idle'); setMessage(''); setErrorHelp(null); setShowTip(false);
    e.target.value = '';
  };

  const ready = files.ass && files.stt;

  const handleProcess = async () => {
    if (!ready) return;
    setStatus('processing');
    setErrorHelp(null);
    setShowTip(false);
    setMessage('Memproses akumulasi di browser...');
    try {
      const read = async (f) => new Uint8Array(await f.arrayBuffer());
      // Auto-detect kind from line codes — protects against swapped uploads
      let sewParsed, assParsed;
      try {
        const [sttBytes, assBytes] = await Promise.all([read(files.stt), read(files.ass)]);
        // parseDailyFile now accepts Uint8Array directly and handles both HTML and XLSX
        sewParsed = parseDailyFile(sttBytes);
        assParsed = parseDailyFile(assBytes);
        // Fallback: also try via decoded text if initial parse gives 0 (legacy path)
        if (sewParsed.lines.size === 0) {
          const alt = parseDailyFile(parseWorkbookAny(sttBytes));
          if (alt.lines.size > 0) sewParsed = alt;
        }
        if (assParsed.lines.size === 0) {
          const alt = parseDailyFile(parseWorkbookAny(assBytes));
          if (alt.lines.size > 0) assParsed = alt;
        }
      } catch (e) {
        throw new Error(`Gagal membaca file: ${e.message}`);
      }
      if (sewParsed.lines.size === 0 || assParsed.lines.size === 0) {
        let isFrameset = false;
        let rawDetail = '';
        try {
          const [sttBytes2, assBytes2] = await Promise.all([read(files.stt), read(files.ass)]);
          const dStt = diagnoseFile(sttBytes2);
          const dAss = diagnoseFile(assBytes2);
          rawDetail = JSON.stringify({ stt: dStt, ass: dAss });
          const frameHint = (d) => d.isFrameset && d.hasSheet001Ref;
          isFrameset = frameHint(dStt) || frameHint(dAss);
          // log detail to console for debug, not shown to user
          console.warn('[Akumulasi diagnose]', { stt: dStt, ass: dAss });
        } catch (e) {
          rawDetail = e.message;
        }
        if (isFrameset) {
          const err = new Error('File .XLS tidak bisa dibaca langsung.');
          err.help = {
            title: 'File tersimpan sebagai "Web Page"',
            steps: [
              'Buka file .XLS di Microsoft Excel',
              'Pilih File → Save As',
              'Ganti "Save as type" ke Excel Workbook (*.xlsx)',
              'Simpan dan upload file .xlsx yang baru',
            ],
            note: 'Atau upload file sheet001.htm dari folder *_files jika ada.',
          };
          err.rawDetail = rawDetail;
          throw err;
        }
        const err2 = new Error('Format tabel tidak dikenali.');
        err2.help = {
          title: 'Pastikan format ASS/STT',
          steps: [
            'Tabel harus punya kolom LineNo | Line | D1 … D31 + Total',
            'Jangan ubah header atau hapus kolom',
            'Jika export terbaru, coba Save As → .xlsx lalu upload ulang',
          ],
        };
        err2.rawDetail = rawDetail;
        throw err2;
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Akumulasi] Sewing lines:', sewParsed.lines.size, '| Assembling lines:', assParsed.lines.size);
      }
      const k1 = detectKind(sewParsed);
      const k2 = detectKind(assParsed);
      if (k1 === 'ass' && k2 === 'sew') {
        [sewParsed, assParsed] = [assParsed, sewParsed]; // swapped uploads: fix silently
      } else if (k1 !== 'sew' || k2 !== 'ass') {
        const err = new Error('Jenis file tidak sesuai.');
        err.help = {
          title: 'Butuh 1 file Sewing + 1 file Assembling',
          steps: [
            'File Sewing berisi line S01–S18 / T02 / T03 / IP',
            'File Assembling berisi line A01–A18',
            'Coba tukar posisi upload atau cek isi file di Excel',
          ],
        };
        throw err;
      }

      setMessage('Mengunduh template akumulasi...');
      const tplRes = await fetch('/akumulasi-template.xlsx');
      if (!tplRes.ok) throw new Error('Template akumulasi tidak tersedia di server.');
      const out = fillAkumulasi(new Uint8Array(await tplRes.arrayBuffer()), sewParsed, assParsed);
      setSummary({ cells: out.filledCells, weeks: out.weeksFound });

      const blob = new Blob([out.zip], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'akumulasi.xlsx';
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);

      setStatus('success');
      setErrorHelp(null);
      setShowTip(false);
      setMessage(`Selesai! ${out.filledCells} sel output terisi pada ${out.weeksFound} blok minggu — akumulasi.xlsx terunduh.`);
    } catch (err) {
      console.error(err);
      if (err.rawDetail) console.warn('[Akumulasi rawDetail]', err.rawDetail);
      setStatus('error');
      setMessage(err.message || 'Terjadi kesalahan saat memproses akumulasi.');
      if (err.help) setErrorHelp(err.help);
      else setErrorHelp({ title: 'Cek file', steps: ['Pastikan file tidak rusak', 'Coba buka di Excel lalu Save As → .xlsx'] });
    }
  };

  const slots = [
    { key: 'stt', label: 'File STT', desc: 'Output Sewing harian (STT *.XLS)' },
    { key: 'ass', label: 'File ASS', desc: 'Input Assembling harian (ASS *.XLS)' },
  ];

  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { num: '1', title: 'Upload ASS & STT', desc: 'Laporan output harian per line dari sistem JIT.' },
          { num: '2', title: 'Template Otomatis', desc: 'Template akumulasi bulan berjalan diambil otomatis dari server.' },
          { num: '3', title: 'Isi Otomatis & Unduh', desc: 'Kolom Output tiap line diisi sesuai tanggal minggunya; total dihitung ulang.' },
        ].map((s) => (
          <li key={s.num} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{s.num}</span>
            <p className="text-sm font-semibold text-gray-800">{s.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">{s.desc}</p>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {slots.map((s) => (
          <label key={s.key}
                 className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors
                   ${files[s.key] ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40'}`}>
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${files[s.key] ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
              {files[s.key] ? '✓' : '+'}
            </span>
            <p className="text-sm font-semibold text-gray-800">{s.label}</p>
            <p className="truncate px-2 text-xs text-gray-500">{files[s.key]?.name || s.desc}</p>
            <input type="file" accept=".xlsx,.xls,.htm,.html" className="hidden" onChange={pick(s.key)} />
          </label>
        ))}
      </div>

      {message && (
        <div role="alert" className={`flex gap-2.5 rounded-xl border px-4 py-3 text-sm ${
          status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : status === 'error' ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-indigo-200 bg-indigo-50 text-indigo-800'}`}>
          {status === 'processing' && (
            <svg className="h-4 w-4 shrink-0 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
          {(status === 'success' || status === 'error') && <span className="shrink-0">{status === 'success' ? '✅' : '⚠️'}</span>}
          <span className="min-w-0 whitespace-pre-wrap break-words text-left">{message}</span>
          {status === 'error' && errorHelp && (
            <div className="group relative ml-auto shrink-0">
              <button
                type="button"
                onMouseEnter={() => setShowTip(true)}
                onMouseLeave={() => setShowTip(false)}
                onClick={() => setShowTip((v) => !v)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-red-600 ring-1 ring-red-200 hover:bg-red-50"
                aria-label="Bantuan"
              >
                ?
              </button>
              {showTip && (
                <div className="absolute right-0 top-8 z-10 w-72 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left shadow-lg">
                  <p className="text-xs font-semibold text-amber-800">{errorHelp.title}</p>
                  <ol className="mt-1.5 list-decimal list-inside space-y-0.5 text-xs leading-relaxed text-amber-700">
                    {errorHelp.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  {errorHelp.note && <p className="mt-2 text-xs italic text-amber-600">{errorHelp.note}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {status === 'error' && errorHelp && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <span className="shrink-0 text-lg">💡</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-800">{errorHelp.title}</p>
              <ol className="mt-1.5 list-decimal list-inside space-y-1 text-xs leading-relaxed text-amber-700">
                {errorHelp.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              {errorHelp.note && <p className="mt-2 text-xs italic text-amber-600">{errorHelp.note}</p>}
              <p className="mt-2 text-[11px] text-amber-600/80">Detail teknis tersimpan di Console (F12) untuk debugging.</p>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <dl className="grid grid-cols-2 gap-3">
          {[['Sel Terisi', summary.cells], ['Blok Minggu', summary.weeks]].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-center shadow-sm">
              <dt className="text-[10px] uppercase tracking-wide text-gray-400">{label}</dt>
              <dd className="text-lg font-bold text-gray-800">{value ?? '-'}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        {ready && (
          <button onClick={() => { setFiles({ ass: null, stt: null }); setStatus('idle'); setMessage(''); setErrorHelp(null); setShowTip(false); setSummary(null); }}
                  className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Reset
          </button>
        )}
        <button onClick={handleProcess}
                disabled={!ready || status === 'processing'}
                className={`inline-flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-md transition-all
                  ${ready && status !== 'processing'
                    ? 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-[0.98]'
                    : 'cursor-not-allowed bg-gray-300 shadow-none'}`}>
          {status === 'processing' ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Memproses...
            </>
          ) : (
            <>
              <Icon d={ICONS.bolt} className="h-4 w-4" />
              Isi Akumulasi & Unduh
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD SHELL
   ══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [activePage, setActivePage] = useState('beranda');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const navigate = (page) => { setActivePage(page); setMobileOpen(false); };
  const active = NAV_ITEMS.find((n) => n.id === activePage);
  // Render date only after mount to keep server/client markup identical (avoids hydration errors)
  const [today, setToday] = useState('');
  useEffect(() => {
    setToday(new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()));
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ─── Sidebar ─── */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col bg-slate-900 text-slate-300 transition-all duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0
          ${collapsed ? 'md:w-[68px]' : 'md:w-64'} w-64`}
      >
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-800 px-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-black text-white">B</span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">BLC Processor</p>
              <p className="truncate text-[10px] text-slate-500">Stuffing Automation Suite</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} onClick={() => navigate(item.id)} title={item.label}
                    className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors
                      ${activePage === item.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'hover:bg-slate-800 hover:text-white'}`}>
              <Icon d={item.icon} className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && !['beranda', 'proses', 'akumulasi'].includes(item.id) && (
                <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${activePage === item.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'}`}>
                  soon
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden shrink-0 border-t border-slate-800 p-3 md:block">
          <button onClick={() => setCollapsed(!collapsed)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white">
            <Icon d={ICONS.chevron} className={`h-5 w-5 shrink-0 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
            {!collapsed && <span>Ciutkan</span>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-20 bg-slate-900/50 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ─── Main area ─── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 md:hidden"
                    onClick={() => setMobileOpen(true)} aria-label="Buka menu">
              <Icon d={ICONS.menu} />
            </button>
            <div>
              <h1 className="text-sm font-bold text-gray-900">{active?.title}</h1>
              <p className="hidden text-[11px] text-gray-400 sm:block">Stuffing Processor · Otomatisasi penggabungan Data JIT</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 ring-1 ring-emerald-200 sm:inline-flex">
              ● Mesin aktif
            </span>
            <span className="hidden text-xs text-gray-400 lg:block">{today}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              OP
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-4 sm:p-6">
            {activePage === 'beranda' && <BerandaPage lastResult={lastResult} onNavigate={navigate} />}
            {activePage === 'proses' && <ProsesPage summary={lastResult} setSummary={setLastResult} />}
            {activePage === 'akumulasi' && <AkumulasiPage />}
            {activePage === 'riwayat' && <RiwayatPage />}
            {activePage === 'referensi' && <ReferensiPage />}
            {activePage === 'panduan' && <PanduanPage />}
            {activePage === 'pengaturan' && <PengaturanPage />}
          </div>
        </main>
      </div>
    </div>
  );
}
