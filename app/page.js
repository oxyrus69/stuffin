'use client';

/**
 * Root page: middleware sudah meng-handle redirect ke /login atau /dashboard.
 * Fallback client (jika middleware tidak berjalan) -> coba ke /dashboard.
 */
export default function RootPage() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-400">
        <span className="spinner !border-gray-300 !border-t-indigo-500"></span>
        <span className="text-sm font-medium">Memuat...</span>
      </div>
    </div>
  );
}
