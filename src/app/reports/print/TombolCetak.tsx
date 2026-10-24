'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Printer, ArrowLeft } from 'lucide-react';
import { downloadElementAsPdf } from '@/lib/report/generatePdf';
import { ensurePaginated, resetPagination } from '@/lib/report/paginate';

export default function TombolCetak() {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState('');
  const [jumlahHalaman, setJumlahHalaman] = useState(0);

  // Pecah laporan jadi halaman A4 nyata di pratinjau — PDF & cetak memakai titik potong yang sama.
  useEffect(() => {
    let batal = false;
    const main = document.querySelector<HTMLElement>('.report-page[data-paginate]');
    async function jalankan() {
      try {
        await document.fonts?.ready;
      } catch {
        /* abaikan */
      }
      if (batal || !main) return;
      ensurePaginated(main);
      setJumlahHalaman(document.querySelectorAll('.report-page').length + document.querySelectorAll('[data-page-gap]').length);
    }
    jalankan();
    return () => {
      batal = true;
      if (main) resetPagination(main);
    };
  }, []);

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const root = document.querySelector('.report-root') as HTMLElement || document.body;
      const titleEl = document.querySelector('h1, .report-page h1, title');
      const rawTitle = titleEl?.textContent || 'Laporan_Keuangan';
      const cleanTitle = rawTitle.replace(/[^\w-]/g, '_').slice(0, 60) || 'Laporan_Keuangan';
      await downloadElementAsPdf(root, `${cleanTitle}.pdf`, (i, n) => setProgress(i >= n ? '' : `${i + 1}/${n}`));
    } catch (e) {
      console.error('Gagal mengunduh PDF:', e);
      alert('Gagal mengunduh file PDF.');
    } finally {
      setDownloading(false);
      setProgress('');
    }
  }

  return (
    <div className="no-print fixed top-4 right-4 z-50 flex items-center gap-2 bg-white/95 backdrop-blur border border-slate-200 shadow-xl p-1.5 rounded-xl">
      {jumlahHalaman > 0 && (
        <span className="text-[11px] font-semibold text-slate-500 px-2">{jumlahHalaman} hlm A4</span>
      )}
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
        <span>{downloading ? `Membuat PDF${progress ? ` ${progress}` : '...'}` : 'Unduh PDF (A4)'}</span>
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
