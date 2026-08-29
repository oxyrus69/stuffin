import './globals.css';

export const metadata = {
  title: 'Stuffing Processor — BLC & Akumulasi',
  description: 'Pengolahan BLC dari data JIT dan pengisian template akumulasi otomatis',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
