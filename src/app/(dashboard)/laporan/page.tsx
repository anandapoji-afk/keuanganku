'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  FileText,
  Printer,
  FileSpreadsheet,
  Filter,
  Calendar,
  Layers,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Image as ImageIcon,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  ExternalLink,
} from 'lucide-react';
import { useAppData } from '@/components/layout/AppDataProvider';
import { generateLaporanExcelRingkas } from '@/lib/actions/laporanRingkas';
import { generateLaporanExcelDetail } from '@/lib/actions/laporanDetail';
import type { LaporanResult } from '@/lib/actions/laporanRingkas';
import type { LaporanFilterOptions, Tipe } from '@/lib/types';
import { rp, formatTanggalIndo } from '@/lib/utils';

function unduhBase64(res: LaporanResult) {
  if ('error' in res) {
    alert('Gagal membuat laporan: ' + res.error);
    return;
  }
  const byteChars = atob(res.data);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: res.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = res.filename;
  a.click();
  URL.revokeObjectURL(url);
}

function awalBulanIni() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function akhirBulanIni() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export default function LaporanPage() {
  const { loading, init, filter: activeFilter, filteredTransaksi, transaksi, clearFilter } = useAppData();

  // Cek apakah di menu Transaksi ada filter yang sedang aktif
  const isFilterTransaksiAktif = Boolean(
    activeFilter.search ||
    (activeFilter.tipe && activeFilter.tipe !== 'Semua') ||
    activeFilter.kategori ||
    activeFilter.rekening ||
    (activeFilter.warna && activeFilter.warna !== 'Semua') ||
    activeFilter.tanggal ||
    activeFilter.bulan ||
    activeFilter.tahun ||
    activeFilter.startDate ||
    activeFilter.endDate
  );

  const [sumberMode, setSumberMode] = useState<'transaksi' | 'kustom'>(
    isFilterTransaksiAktif ? 'transaksi' : 'kustom'
  );

  // Form Filter Kustom
  const [customStart, setCustomStart] = useState(awalBulanIni());
  const [customEnd, setCustomEnd] = useState(akhirBulanIni());
  const [customTipe, setCustomTipe] = useState<'Semua' | Tipe>('Semua');
  const [customKategori, setCustomKategori] = useState('');
  const [customRekening, setCustomRekening] = useState('');
  const [customSearch, setCustomSearch] = useState('');

  // Opsi cetak
  const [jenis, setJenis] = useState<'ringkas' | 'detail'>('detail');
  const [sertakanBukti, setSertakanBukti] = useState(false);
  const [sertakanCatatan, setSertakanCatatan] = useState(true);
  const [busy, setBusy] = useState<'' | 'ringkas' | 'detail'>('');

  // Hitung filter object yang efektif berdasarkan mode yang dipilih
  const effectiveFilter: LaporanFilterOptions = useMemo(() => {
    if (sumberMode === 'transaksi') {
      return {
        startDate: activeFilter.startDate || '',
        endDate: activeFilter.endDate || '',
        search: activeFilter.search || '',
        tipe: activeFilter.tipe || 'Semua',
        kategori: activeFilter.kategori || '',
        rekening: activeFilter.rekening || '',
        warna: activeFilter.warna || 'Semua',
        tanggal: activeFilter.tanggal || '',
        bulan: activeFilter.bulan || '',
        tahun: activeFilter.tahun || '',
      };
    } else {
      return {
        startDate: customStart,
        endDate: customEnd,
        search: customSearch,
        tipe: customTipe,
        kategori: customKategori,
        rekening: customRekening,
      };
    }
  }, [sumberMode, activeFilter, customStart, customEnd, customSearch, customTipe, customKategori, customRekening]);

  // Daftar kategori untuk dropdown custom
  const daftarSemuaKategori = useMemo(() => {
    const setKat = new Set<string>();
    Object.keys(init.katMasuk || {}).forEach((k) => setKat.add(k));
    Object.keys(init.katKeluar || {}).forEach((k) => setKat.add(k));
    return Array.from(setKat);
  }, [init]);

  // Ringkasan preview transaksi yang akan dicetak
  const { previewTotalMasuk, previewTotalKeluar, previewCount } = useMemo(() => {
    let list = transaksi;
    if (sumberMode === 'transaksi') {
      list = filteredTransaksi;
    } else {
      list = transaksi.filter((t) => {
        if (customStart && new Date(`${t.tanggal}T00:00:00`) < new Date(`${customStart}T00:00:00`)) return false;
        if (customEnd && new Date(`${t.tanggal}T00:00:00`) > new Date(`${customEnd}T23:59:59`)) return false;
        if (customTipe !== 'Semua' && t.tipe !== customTipe) return false;
        if (customKategori && t.kategori !== customKategori) return false;
        if (customRekening && t.rekening !== customRekening) return false;
        if (customSearch) {
          const needle = customSearch.toLowerCase();
          const hay = `${t.keterangan} ${t.kategori} ${t.sub_kategori} ${t.rekening} ${t.pihak_terkait}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });
    }

    let masuk = 0;
    let keluar = 0;
    list.forEach((t) => {
      if (['Transfer', 'Tabungan'].includes(t.kategori)) return;
      if (t.tipe === 'Pemasukan') masuk += t.nominal;
      else keluar += t.nominal;
    });

    return { previewTotalMasuk: masuk, previewTotalKeluar: keluar, previewCount: list.length };
  }, [sumberMode, filteredTransaksi, transaksi, customStart, customEnd, customTipe, customKategori, customRekening, customSearch]);

  function pasangPresetTanggal(preset: 'hariIni' | 'bulanIni' | 'bulanLalu' | 'tahunIni' | 'semua') {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'hariIni') {
      const t = iso(now);
      setCustomStart(t);
      setCustomEnd(t);
    } else if (preset === 'bulanIni') {
      setCustomStart(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
      setCustomEnd(iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    } else if (preset === 'bulanLalu') {
      setCustomStart(iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      setCustomEnd(iso(new Date(now.getFullYear(), now.getMonth(), 0)));
    } else if (preset === 'tahunIni') {
      setCustomStart(iso(new Date(now.getFullYear(), 0, 1)));
      setCustomEnd(iso(new Date(now.getFullYear(), 11, 31)));
    } else if (preset === 'semua') {
      setCustomStart('');
      setCustomEnd('');
    }
  }

  function bukaCetakPDF() {
    const params = new URLSearchParams({
      ws: init.active,
      jenis,
      bukti: sertakanBukti ? '1' : '0',
      catatan: sertakanCatatan ? '1' : '0',
    });

    if (effectiveFilter.startDate) params.set('start', effectiveFilter.startDate);
    if (effectiveFilter.endDate) params.set('end', effectiveFilter.endDate);
    if (effectiveFilter.search) params.set('search', effectiveFilter.search);
    if (effectiveFilter.tipe && effectiveFilter.tipe !== 'Semua') params.set('tipe', effectiveFilter.tipe);
    if (effectiveFilter.kategori) params.set('kategori', effectiveFilter.kategori);
    if (effectiveFilter.rekening) params.set('rekening', effectiveFilter.rekening);
    if (effectiveFilter.warna && effectiveFilter.warna !== 'Semua') params.set('warna', effectiveFilter.warna);
    if (effectiveFilter.tanggal) params.set('tanggal', effectiveFilter.tanggal);
    if (effectiveFilter.bulan) params.set('bulan', effectiveFilter.bulan);
    if (effectiveFilter.tahun) params.set('tahun', effectiveFilter.tahun);

    window.open(`/reports/print?${params.toString()}`, '_blank');
  }

  async function unduhExcelRingkas() {
    setBusy('ringkas');
    const res = await generateLaporanExcelRingkas(init.active, effectiveFilter);
    setBusy('');
    unduhBase64(res);
  }

  async function unduhExcelDetail() {
    setBusy('detail');
    const res = await generateLaporanExcelDetail(init.active, effectiveFilter);
    setBusy('');
    unduhBase64(res);
  }

  if (loading) return <div className="text-sm text-slate-400 py-10 text-center">Memuat data...</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="font-bold text-slate-800 text-lg flex items-center gap-2">
          <FileText className="text-sky-600" size={20} />
          <span>Laporan Keuangan</span>
        </h1>
        <p className="text-xs text-slate-400">
          Cetak atau unduh laporan keuangan sesuai filter transaksi aktif atau kustom
        </p>
      </div>

      {/* Tab Sumber Data Laporan: Filter Transaksi vs Kustom */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-1.5 shadow-sm">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setSumberMode('transaksi')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              sumberMode === 'transaksi'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Filter size={14} />
            <span>Sesuai Filter Transaksi</span>
            {isFilterTransaksiAktif && (
              <span className={`w-2 h-2 rounded-full ${sumberMode === 'transaksi' ? 'bg-white' : 'bg-sky-500'}`} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSumberMode('kustom')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              sumberMode === 'kustom'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar size={14} />
            <span>Rentang &amp; Filter Kustom</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Sumber dari Filter Menu Transaksi */}
      {sumberMode === 'transaksi' && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Filter size={14} className="text-sky-600" />
              <span>Filter yang Sedang Aktif di Menu Transaksi</span>
            </div>
            <Link
              href="/transaksi"
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1 hover:underline"
            >
              <span>Ubah di Transaksi</span>
              <ExternalLink size={12} />
            </Link>
          </div>

          {isFilterTransaksiAktif ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {activeFilter.startDate && activeFilter.endDate && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 font-medium px-2.5 py-1 rounded-lg border border-slate-200">
                    <Calendar size={12} className="text-slate-500" />
                    <span>Rentang:</span>
                    <strong className="text-slate-900">
                      {formatTanggalIndo(activeFilter.startDate)} s/d {formatTanggalIndo(activeFilter.endDate)}
                    </strong>
                  </span>
                )}
                {activeFilter.tanggal && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 font-medium px-2.5 py-1 rounded-lg border border-slate-200">
                    <Calendar size={12} className="text-slate-500" />
                    <span>Tanggal:</span>
                    <strong className="text-slate-900">{formatTanggalIndo(activeFilter.tanggal)}</strong>
                  </span>
                )}
                {activeFilter.bulan && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 font-medium px-2.5 py-1 rounded-lg border border-slate-200">
                    <span>Bulan:</span>
                    <strong className="text-slate-900">{activeFilter.bulan}</strong>
                  </span>
                )}
                {activeFilter.tahun && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 font-medium px-2.5 py-1 rounded-lg border border-slate-200">
                    <span>Tahun:</span>
                    <strong className="text-slate-900">{activeFilter.tahun}</strong>
                  </span>
                )}
                {activeFilter.tipe && activeFilter.tipe !== 'Semua' && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-sky-50 text-sky-700 font-medium px-2.5 py-1 rounded-lg border border-sky-200">
                    <span>Tipe:</span>
                    <strong className="text-sky-900">{activeFilter.tipe}</strong>
                  </span>
                )}
                {activeFilter.kategori && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 font-medium px-2.5 py-1 rounded-lg border border-indigo-200">
                    <span>Kategori:</span>
                    <strong className="text-indigo-900">{activeFilter.kategori}</strong>
                  </span>
                )}
                {activeFilter.rekening && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 font-medium px-2.5 py-1 rounded-lg border border-emerald-200">
                    <span>Rekening:</span>
                    <strong className="text-emerald-900">{activeFilter.rekening}</strong>
                  </span>
                )}
                {activeFilter.warna && activeFilter.warna !== 'Semua' && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-700 font-medium px-2.5 py-1 rounded-lg border border-amber-200">
                    <span>Highlight:</span>
                    <strong className="text-amber-900">{activeFilter.warna}</strong>
                  </span>
                )}
                {activeFilter.search && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-purple-50 text-purple-700 font-medium px-2.5 py-1 rounded-lg border border-purple-200">
                    <Search size={12} className="text-purple-500" />
                    <span>Kata Kunci:</span>
                    <strong className="text-purple-900">&quot;{activeFilter.search}&quot;</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">
                  🎯 Hasil filter mencakup <strong>{filteredTransaksi.length}</strong> transaksi.
                </span>
                <button
                  type="button"
                  onClick={clearFilter}
                  className="text-[11px] text-slate-400 hover:text-red-600 flex items-center gap-1 transition"
                >
                  <RotateCcw size={11} />
                  <span>Reset Filter</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/80 leading-relaxed">
              Semua transaksi di akun <strong>&quot;{init.active}&quot;</strong> ({transaksi.length} transaksi) akan dicetak karena belum ada filter yang dipasang di menu Transaksi. Anda juga bisa menggunakan mode <strong>&quot;Rentang &amp; Filter Kustom&quot;</strong> di atas untuk membatasi periode laporan.
            </div>
          )}
        </motion.div>
      )}

      {/* Mode 2: Sumber dari Filter Kustom */}
      {sumberMode === 'kustom' && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm space-y-3"
        >
          {/* Preset Tanggal Cepat */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Preset Periode Cepat</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'hariIni', label: 'Hari Ini' },
                { key: 'bulanIni', label: 'Bulan Ini' },
                { key: 'bulanLalu', label: 'Bulan Lalu' },
                { key: 'tahunIni', label: 'Tahun Ini' },
                { key: 'semua', label: 'Semua Waktu' },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => pasangPresetTanggal(p.key as any)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 hover:border-sky-400 hover:bg-sky-50 text-slate-600 font-medium active:scale-95 transition"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tanggal Mulai & Selesai */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600">Dari Tanggal</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs mt-1 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600">Sampai Tanggal</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs mt-1 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
              />
            </div>
          </div>

          {/* Filter Tambahan Kustom */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div>
              <label className="text-[11px] font-semibold text-slate-600">Tipe</label>
              <select
                value={customTipe}
                onChange={(e) => setCustomTipe(e.target.value as any)}
                className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs mt-1 outline-none focus:border-sky-500 bg-white"
              >
                <option value="Semua">Semua Tipe</option>
                <option value="Pemasukan">Pemasukan</option>
                <option value="Pengeluaran">Pengeluaran</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600">Kategori</label>
              <select
                value={customKategori}
                onChange={(e) => setCustomKategori(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs mt-1 outline-none focus:border-sky-500 bg-white"
              >
                <option value="">Semua Kategori</option>
                {daftarSemuaKategori.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600">Rekening</label>
              <select
                value={customRekening}
                onChange={(e) => setCustomRekening(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs mt-1 outline-none focus:border-sky-500 bg-white"
              >
                <option value="">Semua Rekening</option>
                {init.rekenings.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pencarian Kata Kunci */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600">Pencarian Kata Kunci (opsional)</label>
            <div className="relative mt-1">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                value={customSearch}
                onChange={(e) => setCustomSearch(e.target.value)}
                placeholder="Cari keterangan, pihak terkait, subkategori..."
                className="w-full border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Format Laporan & Lampiran */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm space-y-3.5">
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Jenis / Format Laporan
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setJenis('detail')}
              className={`py-2.5 px-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                jenis === 'detail'
                  ? 'bg-sky-50 border-sky-400 text-sky-800 shadow-sm'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <div className="font-bold flex items-center justify-between">
                <span>Detail Transaksi</span>
                {jenis === 'detail' && <CheckCircle2 size={15} className="text-sky-600" />}
              </div>
              <div className="text-[10.5px] font-normal text-slate-500 mt-0.5 leading-tight">
                Rincian setiap transaksi per kategori, rekening, dan catatan
              </div>
            </button>

            <button
              type="button"
              onClick={() => setJenis('ringkas')}
              className={`py-2.5 px-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                jenis === 'ringkas'
                  ? 'bg-sky-50 border-sky-400 text-sky-800 shadow-sm'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <div className="font-bold flex items-center justify-between">
                <span>Ringkas per Kategori</span>
                {jenis === 'ringkas' && <CheckCircle2 size={15} className="text-sky-600" />}
              </div>
              <div className="text-[10.5px] font-normal text-slate-500 mt-0.5 leading-tight">
                Rekap total dan subkategori tanpa daftar baris per baris
              </div>
            </button>
          </div>
        </div>

        {/* Checkbox Lampiran Bukti Foto */}
        <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={sertakanBukti}
            onChange={(e) => setSertakanBukti(e.target.checked)}
            disabled={jenis !== 'detail'}
            className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 disabled:opacity-40"
          />
          <div className="flex items-center gap-1.5">
            <ImageIcon size={14} className="text-slate-500" />
            <span>Sertakan lampiran foto bukti transaksi di halaman lampiran PDF</span>
          </div>
        </label>

        {/* Checkbox Sertakan Catatan Transaksi */}
        <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={sertakanCatatan}
            onChange={(e) => setSertakanCatatan(e.target.checked)}
            disabled={jenis !== 'detail'}
            className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 disabled:opacity-40"
          />
          <div className="flex items-center gap-1.5">
            <FileText size={14} className="text-slate-500" />
            <span>Sertakan catatan transaksi (ditampilkan di bawah keterangan)</span>
          </div>
        </label>
      </div>

      {/* Preview Ringkasan Angka yang Akan Dicetak */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-300 border-b border-white/10 pb-2">
          <span>Ringkasan Laporan yang Akan Dicetak</span>
          <span className="font-semibold text-sky-300 bg-white/10 px-2 py-0.5 rounded-full">
            {previewCount} transaksi
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="bg-white/5 p-2 rounded-xl border border-white/10">
            <div className="text-[10px] text-slate-400">Pemasukan</div>
            <div className="text-xs sm:text-sm font-bold text-emerald-400 mt-0.5">{rp(previewTotalMasuk)}</div>
          </div>
          <div className="bg-white/5 p-2 rounded-xl border border-white/10">
            <div className="text-[10px] text-slate-400">Pengeluaran</div>
            <div className="text-xs sm:text-sm font-bold text-rose-400 mt-0.5">{rp(previewTotalKeluar)}</div>
          </div>
          <div className="bg-white/5 p-2 rounded-xl border border-white/10">
            <div className="text-[10px] text-slate-400">Saldo Bersih</div>
            <div className="text-xs sm:text-sm font-bold text-sky-400 mt-0.5">{rp(previewTotalMasuk - previewTotalKeluar)}</div>
          </div>
        </div>
      </div>

      {/* Tombol Aksi Export */}
      <div className="space-y-2.5 pt-1">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={bukaCetakPDF}
          className="w-full bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white text-sm font-bold py-3 rounded-2xl shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 transition"
        >
          <Printer size={17} />
          <span>Lihat &amp; Cetak Laporan PDF</span>
        </motion.button>

        <div className="grid grid-cols-2 gap-2.5">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={unduhExcelDetail}
            disabled={busy === 'detail'}
            className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold py-2.5 px-3 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span>{busy === 'detail' ? 'Membuat file...' : 'Unduh Excel Detail'}</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={unduhExcelRingkas}
            disabled={busy === 'ringkas'}
            className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold py-2.5 px-3 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span>{busy === 'ringkas' ? 'Membuat file...' : 'Unduh Excel Ringkas'}</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
