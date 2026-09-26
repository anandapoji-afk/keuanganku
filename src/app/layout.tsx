import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KeuanganKu',
  description: 'Aplikasi manajemen keuangan pribadi dan usaha — catat transaksi, anggaran, hutang piutang, dan laporan.',
  openGraph: {
    title: 'KeuanganKu',
    description: 'Aplikasi manajemen keuangan pribadi dan usaha — catat transaksi, anggaran, hutang piutang, dan laporan.',
  },
};

// Mengunci skala viewport di mobile: user tidak bisa pinch-zoom, dan browser
// tidak auto-zoom saat fokus ke <input> (penyebab umum auto-zoom adalah
// input dengan font-size < 16px — pastikan globals.css set font-size input
// minimal 16px sebagai lapisan proteksi kedua).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="text-slate-800 antialiased">{children}</body>
    </html>
  );
}
