import './globals.css';

export const metadata = {
  title: 'Stuffing Data Processor',
  description: 'Otomatisasi pemrosesan data Excel Stuffing List, BLC, dan Daily Inspection',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
