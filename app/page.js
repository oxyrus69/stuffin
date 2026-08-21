'use client';

import { useEffect, useState } from 'react';

/**
 * Root page acts as auth router:
 * - No cookie or NOT logged_out → redirect to /dashboard
 * - Cookie app_auth=logged_out → redirect to /login
 */
export default function RootPage() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const auth = document.cookie.split('; ').find(c => c.startsWith('app_auth='));
    if (auth && auth.includes('logged_out')) {
      window.location.href = '/login';
    } else {
      window.location.href = '/dashboard';
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-400">
        <span className="spinner !border-gray-300 !border-t-indigo-500"></span>
        <span className="text-sm font-medium">Memuat...</span>
      </div>
    </div>
  );
}
