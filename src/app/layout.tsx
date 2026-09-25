import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KeuanganKu',
  description: 'Aplikasi manajemen keuangan pribadi dan usaha — catat transaksi, anggaran, hutang piutang, dan laporan.',
  openGraph: {
    title: 'KeuanganKu',
    description: 'Aplikasi manajemen keuangan pribadi dan usaha — catat transaksi, anggaran, hutang piutang, dan laporan.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="text-slate-800 antialiased">{children}</body>
    </html>
  );
}
