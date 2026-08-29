'use client';

/**
 * Root page: middleware sudah meng-handle redirect ke /login atau /dashboard.
 * Fallback client (jika middleware tidak berjalan) -> coba ke /dashboard.
 */
export default function RootPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black selection:bg-white selection:text-black">
      <div className="flex items-center gap-3 text-[#666]">
        <span className="spinner"></span>
        <span className="font-mono text-xs tracking-[-0.01em]">Memuat...</span>
      </div>
    </div>
  );
}
