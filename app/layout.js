import './globals.css';

export const metadata = {
  title: 'HOPE',
  description: 'Pengolahan BLC dari data JIT dan pengisian template akumulasi otomatis',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="h-full">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="h-full">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  const VERSION_KEY = 'hope_version';
  const checkVersion = async () => {
    try {
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (!res.ok) return false;
      const { version } = await res.json();
      const cached = localStorage.getItem(VERSION_KEY);
      if (cached && cached !== version) {
        // versi baru tersedia → bersihkan cache & hard reload
        localStorage.setItem(VERSION_KEY, version);
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) await r.unregister();
          const keys = await caches.keys();
          for (const k of keys) await caches.delete(k);
        } catch {}
        location.reload();
        return true;
      }
      if (!cached && version) localStorage.setItem(VERSION_KEY, version);
    } catch {}
    return false;
  };
  const setupSW = () => {
    if (!('serviceWorker' in navigator)) { checkVersion(); return; }
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        // jika ada waiting SW (update sudah di-download), langsung aktifkan
        if (reg.waiting) {
          reg.waiting.postMessage('SKIP_WAITING');
        }
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              nw.postMessage('SKIP_WAITING');
            }
          });
        });
        // saat controller berganti (update aktif), hard reload sekali
        let reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloaded) return;
          reloaded = true;
          location.reload();
        });
        // cek versi setelah SW siap
        await checkVersion();
        // cek saat kembali online (ideal: langsung sync setelah offline)
        window.addEventListener('online', () => {
          reg.update().catch(()=>{});
          checkVersion();
        });
        // cek periodik tiap buka tab / fokus
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(()=>{});
            checkVersion();
          }
        });
        // juga cek tiap 30 menit saat online
        setInterval(() => { reg.update().catch(()=>{}); checkVersion(); }, 30*60*1000);
      } catch {
        checkVersion();
      }
    });
  };
  setupSW();
})();`,
          }}
        />
      </body>
    </html>
  );
}
