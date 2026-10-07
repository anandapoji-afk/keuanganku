'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, Printer, ArrowLeft } from 'lucide-react';
import { downloadElementAsPdf } from '@/lib/report/generatePdf';

export default function TombolCetak() {
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const root = document.querySelector('.report-root') as HTMLElement || document.body;
      const titleEl = document.querySelector('h1, .report-page h1, title');
      const rawTitle = titleEl?.textContent || 'Laporan_Keuangan';
      const cleanTitle = rawTitle.replace(/[^\w-]/g, '_').slice(0, 60) || 'Laporan_Keuangan';
      await downloadElementAsPdf(root, `${cleanTitle}.pdf`);
    } catch (e) {
      console.error('Gagal mengunduh PDF:', e);
      alert('Gagal mengunduh file PDF.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="no-print fixed top-4 right-4 z-50 flex items-center gap-2 bg-white/95 backdrop-blur border border-slate-200 shadow-xl p-1.5 rounded-xl">
      <Link
        href="/laporan"
        className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
      >
        <ArrowLeft size={14} />
        <span>Kembali</span>
      </Link>

      <button
        onClick={handleDownloadPdf}
        disabled={downloading}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-50"
        title="Langsung mengunduh file PDF dengan format halaman A4"
      >
        <Download size={14} />
        <span>{downloading ? 'Membuat PDF A4...' : 'Unduh PDF (A4)'}</span>
      </button>

      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 active:bg-sky-800 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition"
        title="Buka dialog cetak browser / simpan via print"
      >
        <Printer size={14} />
        <span>Cetak / Print Dialog</span>
      </button>
    </div>
  );
}
