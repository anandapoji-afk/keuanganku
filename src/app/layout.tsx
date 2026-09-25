import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KeuanganKu',
  description: 'Aplikasi manajemen keuangan — migrasi dari Google Apps Script ke Next.js + Supabase',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="text-slate-800 antialiased">{children}</body>
    </html>
  );
}
