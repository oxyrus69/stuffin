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
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});});}`,
          }}
        />
      </body>
    </html>
  );
}
