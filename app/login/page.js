'use client';

import { useState, useEffect } from 'react';

export default function LoginPage() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if already authenticated (shouldn't happen but just in case)
  useEffect(() => {
    const auth = document.cookie.split('; ').find(c => c.startsWith('app_auth='));
    if (!auth || !auth.includes('logged_out')) {
      window.location.href = '/dashboard';
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate slight delay for UX
    setTimeout(() => {
      if (key.trim() === 'jinji') {
        // Clear the "logged_out" cookie
        document.cookie = 'app_auth=; path=/; max-age=0';
        window.location.href = '/dashboard';
      } else {
        setError('Kunci tidak valid. Silakan coba lagi.');
        setIsLoading(false);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-purple-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/30 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Stuffing Processor — BLC &amp; Akumulasi</h1>
          <p className="text-indigo-300 text-sm mt-1">Masukkan kunci untuk mengakses aplikasi</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
          <form onSubmit={handleLogin}>
            <label className="block text-sm font-medium text-indigo-200 mb-2">
              Kunci Akses
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(''); }}
              placeholder="Masukkan kunci..."
              autoFocus
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-indigo-400
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                         transition-all duration-200 text-center text-lg tracking-widest font-mono"
            />

            {error && (
              <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-2">
                <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!key.trim() || isLoading}
              className="w-full mt-6 px-6 py-3.5 font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600
                         rounded-xl shadow-lg transition-all duration-300
                         hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl hover:scale-[1.02]
                         active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
                         disabled:hover:scale-100 disabled:hover:shadow-lg"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="spinner"></span>
                  Memverifikasi...
                </span>
              ) : (
                'Masuk'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-indigo-400/50 text-xs mt-6">
          Aplikasi Internal &middot; Stuffing Processor — BLC &amp; Akumulasi
        </p>
      </div>
    </div>
  );
}
