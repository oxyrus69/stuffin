'use client';

import { useState } from 'react';

/* Direction contract (extends the established Vercel-dark world, DESIGN.md):
   THESIS — gerbang gelap tunggal; kanvas void-black, satu kartu hairline,
   putih hanya pada brand tile dan tombol Masuk (The One Light Rule).
   OWN-WORLD — hitam berlapis #000/#0a0a0a, border #1f1f1f/#262626, Inter
   tracking negatif, mono untuk label teknis; tanpa gradien, tanpa glass.
   STORY — operator memasukkan kunci jinji; galat dan status memakai bahasa
   status-mono sistem; footer membawa tagline glow HOPE.
   FIRST VIEWPORT — tile putih 28px di tengah atas, judul HOPE, kartu form
   max-w-[320px], tombol Masuk putih full-width di dasar kartu.
   FINISH — unreviewed and undocumented is unfinished; this build ends with
   the finish review, the verdict, DESIGN.md, and every shipping raster
   carrying its provenance. */

const VercelMark = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="currentColor" />
  </svg>
);

export default function LoginPage() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || 'Kunci tidak valid. Silakan coba lagi.');
        setIsLoading(false);
        return;
      }
      window.location.href = '/dashboard';
    } catch (err) {
      setError('Gagal menghubungi server. Coba lagi.');
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-[#ededed] selection:bg-white selection:text-black"
      style={{ fontFamily: 'Inter, "Geist Sans", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif', fontFeatureSettings: '"ss01","ss02"' }}
    >
      <style>{`html{color-scheme:dark} ::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:#262626;border-radius:999px;border:2px solid #000}::-webkit-scrollbar-thumb:hover{background:#333} *{scrollbar-width:thin; scrollbar-color:#262626 #000} input::placeholder{color:#666} @keyframes hope-glow{0%,100%{text-shadow:0 0 4px rgba(255,255,255,0.1),0 0 8px rgba(255,255,255,0.05)}50%{text-shadow:0 0 8px rgba(255,255,255,0.4),0 0 20px rgba(255,255,255,0.15),0 0 40px rgba(255,255,255,0.05)}} .hope-glow{animation:hope-glow 3s ease-in-out infinite} :focus-visible{outline:none}`}</style>

      <main className="w-full max-w-[320px] animate-fade-up">
        {/* Brand — satu tile putih, satu-satunya cahaya di atas kunci */}
        <div className="mb-6 text-center">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-black">
            <VercelMark className="h-5 w-5" />
          </span>
          <h1 className="mt-3 text-base font-semibold tracking-[-0.02em] text-white">HOPE</h1>
          <p className="mt-1 text-sm leading-5 tracking-[-0.01em] text-[#888]">Masukkan kunci untuk mengakses aplikasi</p>
        </div>

        <div className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-4">
          <form onSubmit={handleLogin}>
            <label htmlFor="key" className="block font-mono text-[10px] font-medium uppercase tracking-widest text-[#888]">
              Kunci Akses
            </label>
            <input
              id="key"
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(''); }}
              placeholder="••••••"
              autoFocus
              autoComplete="current-password"
              className="mt-2 h-9 w-full rounded-md border border-[#262626] bg-black px-3 text-center font-mono text-sm tracking-[0.25em] text-white placeholder:tracking-[0.25em] focus:border-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
            />

            {error && (
              <div role="alert" className="mt-3 flex items-center gap-2 rounded-md border border-[#3a1a1a] bg-[#1a0a0a] px-3 py-2 text-xs leading-4 text-[#f87171]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f87171]" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!key.trim() || isLoading}
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-white bg-white text-sm font-medium tracking-[-0.01em] text-black transition-colors hover:bg-[#ededed] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#262626] border-t-black" />
                  Memverifikasi...
                </span>
              ) : (
                'Masuk'
              )}
            </button>
          </form>
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-[#1f1f1f] py-4 text-center font-mono text-xs tracking-[-0.01em] text-[#888]">
        Aplikasi Internal · © 2026 HOPE · <span className="hope-glow text-[#999]">Help Out Purest Entity</span>
      </footer>
    </div>
  );
}
