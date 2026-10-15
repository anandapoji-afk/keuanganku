'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  PieChart,
  ArrowDownLeft,
  ArrowUpRight,
  Target,
  Plus,
  Search,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  X,
} from 'lucide-react';
import { useAppData } from '@/components/layout/AppDataProvider';
import Modal from '@/components/ui/Modal';
import { rp } from '@/lib/utils';
import { simpanAnggaran } from '@/lib/actions/anggaran';

function bulanTahunSekarang() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const WARNA_KARTU = [
  { border: 'border-l-orange-400', chip: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500' },
  { border: 'border-l-blue-400', chip: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500' },
  { border: 'border-l-pink-400', chip: 'bg-pink-100 text-pink-700', bar: 'bg-pink-500' },
  { border: 'border-l-sky-400', chip: 'bg-sky-100 text-sky-700', bar: 'bg-sky-500' },
  { border: 'border-l-amber-400', chip: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' },
  { border: 'border-l-fuchsia-400', chip: 'bg-fuchsia-100 text-fuchsia-700', bar: 'bg-fuchsia-500' },
  { border: 'border-l-emerald-400', chip: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
  { border: 'border-l-violet-400', chip: 'bg-violet-100 text-violet-700', bar: 'bg-violet-500' },
];

export default function AnggaranPage() {
  const router = useRouter();
  const { loading, init, filter, filteredTransaksi, anggaran, setFilter, refetchRiwayat } = useAppData();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ kategori: '', subKategori: '', nominal: '' });
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [subKatPemasukanSearch, setSubKatPemasukanSearch] = useState('');
  const [subKatPengeluaranSearch, setSubKatPengeluaranSearch] = useState('');

  // Periode set-anggaran mengikuti filter bulan aktif dari menu Transaksi
  const bulanTahun = filter.bulan || bulanTahunSekarang();
  const [tahun, bulan] = bulanTahun.split('-').map(Number);

  // ===== Rekap Pemasukan: total per kategori Pemasukan =====
  const rekapPemasukan = useMemo(() => {
    const totals: Record<string, number> = {};
    filteredTransaksi.forEach((t) => {
      if (t.tipe !== 'Pemasukan') return;
      if (['Transfer', 'Hutang', 'Piutang', 'Tabungan'].includes(t.kategori)) return;
      totals[t.kategori] = (totals[t.kategori] || 0) + t.nominal;
    });
    return Object.entries(totals)
      .filter(([, v]) => v !== 0)
      .sort((a, b) => b[1] - a[1]);
  }, [filteredTransaksi]);

  // ===== Rekap Sub Kategori Pemasukan: total per sub kategori Pemasukan =====
  const rekapSubKategoriPemasukan = useMemo(() => {
    const totals: Record<string, { kategori: string; subKategori: string; total: number; count: number }> = {};
    filteredTransaksi.forEach((t) => {
      if (t.tipe !== 'Pemasukan' || !t.sub_kategori) return;
      if (['Transfer', 'Hutang', 'Piutang', 'Tabungan'].includes(t.kategori)) return;
      const key = `${t.kategori}___${t.sub_kategori}`;
      if (!totals[key]) {
        totals[key] = { kategori: t.kategori, subKategori: t.sub_kategori, total: 0, count: 0 };
      }
      totals[key].total += t.nominal;
      totals[key].count += 1;
    });
    return Object.values(totals)
      .filter((item) => item.total !== 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredTransaksi]);

  // Filtered sub kategori pemasukan by search
  const filteredSubKatPemasukan = useMemo(() => {
    if (!subKatPemasukanSearch.trim()) return rekapSubKategoriPemasukan;
    const q = subKatPemasukanSearch.toLowerCase();
    return rekapSubKategoriPemasukan.filter(
      (item) => item.kategori.toLowerCase().includes(q) || item.subKategori.toLowerCase().includes(q)
    );
  }, [rekapSubKategoriPemasukan, subKatPemasukanSearch]);

  // ===== Rekap Pengeluaran & Anggaran: total per kategori Pengeluaran + limit anggaran =====
  const rekapPengeluaran = useMemo(() => {
    const totals: Record<string, number> = {};
    filteredTransaksi.forEach((t) => {
      if (t.tipe !== 'Pengeluaran') return;
      if (['Transfer', 'Hutang', 'Piutang', 'Tabungan'].includes(t.kategori)) return;
      totals[t.kategori] = (totals[t.kategori] || 0) + t.nominal;
    });
    return Object.entries(totals)
      .filter(([, v]) => v !== 0)
      .sort((a, b) => b[1] - a[1])
      .map(([kategori, terpakai]) => {
        const limit = anggaran.find((a) => a.tahun === tahun && a.bulan === bulan && a.kategori === kategori && !a.sub_kategori);
        return { kategori, terpakai, limit: limit ? limit.nominal : null };
      });
  }, [filteredTransaksi, anggaran, bulan, tahun]);

  // ===== Rekap Sub Kategori Pengeluaran: total per sub kategori Pengeluaran =====
  const rekapSubKategoriPengeluaran = useMemo(() => {
    const totals: Record<string, { kategori: string; subKategori: string; total: number; count: number }> = {};
    filteredTransaksi.forEach((t) => {
      if (t.tipe !== 'Pengeluaran' || !t.sub_kategori) return;
      if (['Transfer', 'Hutang', 'Piutang', 'Tabungan'].includes(t.kategori)) return;
      const key = `${t.kategori}___${t.sub_kategori}`;
      if (!totals[key]) {
        totals[key] = { kategori: t.kategori, subKategori: t.sub_kategori, total: 0, count: 0 };
      }
      totals[key].total += t.nominal;
      totals[key].count += 1;
    });
    return Object.values(totals)
      .filter((item) => item.total !== 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredTransaksi]);

  // Filtered sub kategori pengeluaran by search
  const filteredSubKatPengeluaran = useMemo(() => {
    if (!subKatPengeluaranSearch.trim()) return rekapSubKategoriPengeluaran;
    const q = subKatPengeluaranSearch.toLowerCase();
    return rekapSubKategoriPengeluaran.filter(
      (item) => item.kategori.toLowerCase().includes(q) || item.subKategori.toLowerCase().includes(q)
    );
  }, [rekapSubKategoriPengeluaran, subKatPengeluaranSearch]);

  // Ringkasan total pemasukan & pengeluaran & anggaran
  const ringkasan = useMemo(() => {
    const totalMasuk = rekapPemasukan.reduce((acc, [, v]) => acc + v, 0);
    const totalKeluar = rekapPengeluaran.reduce((acc, item) => acc + item.terpakai, 0);
    const totalLimit = rekapPengeluaran.reduce((acc, item) => acc + (item.limit || 0), 0);
    return { totalMasuk, totalKeluar, totalLimit, selisih: totalMasuk - totalKeluar };
  }, [rekapPemasukan, rekapPengeluaran]);

  function bukaSetAnggaran(kategoriAwal?: string) {
    setForm({ kategori: kategoriAwal || '', subKategori: '', nominal: '' });
    setErrMsg(null);
    setModalOpen(true);
  }

  function bukaFilterKartu({
    kategori,
    tipe,
    search,
  }: {
    kategori?: string;
    tipe: 'Pemasukan' | 'Pengeluaran';
    search?: string;
  }) {
    // Hilangkan karakter » dan bersihkan spasi ganda agar filter transaksi terbaca akurat
    const cleanSearch = (search || '').replace(/»/g, ' ').replace(/\s+/g, ' ').trim();
    setFilter((prev) => ({
      ...prev,
      search: cleanSearch,
      kategori: kategori || '',
      tipe,
    }));
    router.push('/transaksi');
  }

  async function simpan() {
    setSaving(true);
    setErrMsg(null);
    const res = await simpanAnggaran({
      workspace: init.active,
      bulanTahun,
      kategoriAnggaran: form.kategori,
      subKategoriAnggaran: form.subKategori,
      nominalAnggaran: parseFloat(form.nominal) || 0,
    });
    setSaving(false);
    if (!res.success) {
      setErrMsg(res.error);
      return;
    }
    setModalOpen(false);
    setForm({ kategori: '', subKategori: '', nominal: '' });
    await refetchRiwayat();
  }

  if (loading) return <div className="text-sm text-slate-400 py-10 text-center">Memuat data...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Anggaran & Rekap</h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200">
              Periode Aktif
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau arus pemasukan, realisasi pengeluaran, batasan anggaran, dan detail sub kategori
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => bukaSetAnggaran()}
          className="flex items-center gap-1.5 text-xs bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white px-3.5 py-2 rounded-xl font-bold self-start sm:self-auto shadow-sm shadow-sky-600/20 transition-all"
        >
          <Plus size={15} strokeWidth={2.6} />
          <span>+ Set Anggaran</span>
        </motion.button>
      </div>

      {/* 3 Kartu Ringkasan Atas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Pemasukan */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-50/30 to-white border border-emerald-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Total Pemasukan</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <ArrowDownLeft size={17} strokeWidth={2.4} />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600 mt-2">{rp(ringkasan.totalMasuk)}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>{rekapPemasukan.length} kategori pemasukan aktif</span>
          </div>
        </div>

        {/* Pengeluaran */}
        <div className="bg-gradient-to-br from-rose-500/10 via-rose-50/30 to-white border border-rose-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800">Total Pengeluaran</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-xs">
              <ArrowUpRight size={17} strokeWidth={2.4} />
            </div>
          </div>
          <div className="text-xl font-black text-rose-600 mt-2">{rp(ringkasan.totalKeluar)}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>{rekapPengeluaran.length} kategori pengeluaran aktif</span>
          </div>
        </div>

        {/* Selisih Arus Kas / Anggaran */}
        <div className="bg-gradient-to-br from-sky-500/10 via-sky-50/30 to-white border border-sky-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-800">Total Limit Anggaran</span>
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shadow-xs">
              <Target size={17} strokeWidth={2.4} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-800 mt-2">{rp(ringkasan.totalLimit)}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
            <span>Surplus / Defisit:</span>
            <span className={`font-bold ${ringkasan.selisih >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {ringkasan.selisih >= 0 ? '+' : ''}
              {rp(ringkasan.selisih)}
            </span>
          </div>
        </div>
      </div>

      {/* ===== REKAP PEMASUKAN ===== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Rekap Pemasukan per Kategori</h2>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">{rekapPemasukan.length} kategori</span>
        </div>

        {rekapPemasukan.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            Belum ada transaksi pemasukan di periode ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rekapPemasukan.map(([kategori, total]) => (
              <motion.button
                key={kategori}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => bukaFilterKartu({ kategori, tipe: 'Pemasukan' })}
                className="group bg-white rounded-2xl border border-slate-200/90 hover:border-emerald-300 p-4 text-left shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-emerald-700 tracking-wide uppercase transition-colors">
                      {kategori}
                    </span>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200/60 font-semibold px-2 py-0.5 rounded-full">
                      Pemasukan
                    </span>
                  </div>
                  <div className="text-emerald-600 font-black text-lg mt-2.5">{rp(total)}</div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400 group-hover:text-emerald-600">
                  <span>Lihat di transaksi</span>
                  <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </section>

      {/* ===== REKAP SUB KATEGORI PEMASUKAN (NEW!) ===== */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Rekap Sub Kategori Pemasukan</h2>
            <span className="text-[10.5px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              {rekapSubKategoriPemasukan.length} Sub Kategori
            </span>
          </div>

          {rekapSubKategoriPemasukan.length > 5 && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
              <input
                type="text"
                value={subKatPemasukanSearch}
                onChange={(e) => setSubKatPemasukanSearch(e.target.value)}
                placeholder="Cari sub kategori pemasukan..."
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-700 shadow-xs outline-none transition"
              />
              {subKatPemasukanSearch && (
                <button
                  type="button"
                  onClick={() => setSubKatPemasukanSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {rekapSubKategoriPemasukan.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            Belum ada transaksi dengan sub kategori pemasukan di periode ini.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden divide-y divide-slate-100">
            {filteredSubKatPemasukan.map((item) => (
              <button
                key={`${item.kategori}___${item.subKategori}`}
                onClick={() =>
                  bukaFilterKartu({
                    kategori: item.kategori,
                    tipe: 'Pemasukan',
                    search: item.subKategori,
                  })
                }
                className="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-emerald-50/40 transition group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                    <ArrowDownLeft size={14} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800 group-hover:text-emerald-800 transition-colors">
                      {item.subKategori}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <span className="font-medium text-slate-600">{item.kategori}</span>
                      <span>•</span>
                      <span>{item.count} transaksi</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-emerald-600">+{rp(item.total)}</div>
                  <div className="text-[10px] text-slate-400 group-hover:text-emerald-600 flex items-center justify-end gap-0.5">
                    <span>Filter transaksi</span>
                    <ChevronRight size={11} />
                  </div>
                </div>
              </button>
            ))}
            {filteredSubKatPemasukan.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">
                Tidak ada sub kategori yang cocok dengan &quot;{subKatPemasukanSearch}&quot;
              </div>
            )}
          </div>
        )}
      </section>

      {/* ===== REKAP PENGELUARAN & ANGGARAN ===== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Rekap Pengeluaran &amp; Anggaran
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">{rekapPengeluaran.length} kategori</span>
        </div>

        {rekapPengeluaran.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            Belum ada transaksi pengeluaran di periode ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rekapPengeluaran.map(({ kategori, terpakai, limit }, idx) => {
              const warna = WARNA_KARTU[idx % WARNA_KARTU.length];
              const over = limit !== null && terpakai > limit;
              const persen = limit ? Math.min((terpakai / limit) * 100, 100) : 0;
              return (
                <div
                  key={kategori}
                  role="button"
                  tabIndex={0}
                  onClick={() => bukaFilterKartu({ kategori, tipe: 'Pengeluaran' })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      bukaFilterKartu({ kategori, tipe: 'Pengeluaran' });
                    }
                  }}
                  className={`bg-white rounded-2xl border border-slate-200/90 border-l-4 ${warna.border} p-4 text-left cursor-pointer transition-all hover:shadow-md hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${warna.chip}`}>{kategori}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        bukaSetAnggaran(kategori);
                      }}
                      className="text-[10px] text-slate-600 hover:text-sky-700 shrink-0 border border-slate-200 rounded-lg px-2 py-0.5 bg-slate-50 hover:bg-sky-50 active:scale-95 transition font-semibold"
                    >
                      + Set Limit
                    </button>
                  </div>

                  <div className="mt-3">
                    <div className="text-[11px] text-slate-400 font-medium">Terpakai:</div>
                    <div className={`font-black text-lg ${over ? 'text-red-600' : 'text-slate-800'}`}>
                      {rp(terpakai)}
                    </div>
                  </div>

                  {limit !== null ? (
                    <div className="mt-2.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-400 font-medium">Limit: {rp(limit)}</span>
                        <span className={`font-bold ${over ? 'text-red-600' : 'text-sky-700'}`}>
                          {persen.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${over ? 'bg-red-500' : warna.bar}`}
                          style={{ width: `${persen}%` }}
                        />
                      </div>
                      {over && (
                        <div className="flex items-center gap-1 text-[10px] text-red-600 font-semibold mt-1.5">
                          <AlertCircle size={11} />
                          <span>Melebihi anggaran ({rp(terpakai - limit)})</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10.5px] text-slate-400 italic">
                      Belum ada batasan limit
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===== REKAP SUB KATEGORI PENGELUARAN ===== */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-600" />
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Rekap Sub Kategori Pengeluaran
            </h2>
            <span className="text-[10.5px] font-semibold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
              {rekapSubKategoriPengeluaran.length} Sub Kategori
            </span>
          </div>

          {rekapSubKategoriPengeluaran.length > 5 && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
              <input
                type="text"
                value={subKatPengeluaranSearch}
                onChange={(e) => setSubKatPengeluaranSearch(e.target.value)}
                placeholder="Cari sub kategori pengeluaran..."
                className="w-full bg-white border border-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-700 shadow-xs outline-none transition"
              />
              {subKatPengeluaranSearch && (
                <button
                  type="button"
                  onClick={() => setSubKatPengeluaranSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {rekapSubKategoriPengeluaran.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            Belum ada transaksi dengan sub kategori pengeluaran di periode ini.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden divide-y divide-slate-100">
            {filteredSubKatPengeluaran.map((item) => (
              <button
                key={`${item.kategori}___${item.subKategori}`}
                onClick={() =>
                  bukaFilterKartu({
                    kategori: item.kategori,
                    tipe: 'Pengeluaran',
                    search: item.subKategori,
                  })
                }
                className="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-rose-50/40 transition group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-rose-100/70 text-rose-700 flex items-center justify-center shrink-0">
                    <ArrowUpRight size={14} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800 group-hover:text-rose-800 transition-colors">
                      {item.subKategori}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <span className="font-medium text-slate-600">{item.kategori}</span>
                      <span>•</span>
                      <span>{item.count} transaksi</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-slate-800 group-hover:text-rose-700 transition-colors">
                    {rp(item.total)}
                  </div>
                  <div className="text-[10px] text-slate-400 group-hover:text-rose-600 flex items-center justify-end gap-0.5">
                    <span>Filter transaksi</span>
                    <ChevronRight size={11} />
                  </div>
                </div>
              </button>
            ))}
            {filteredSubKatPengeluaran.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">
                Tidak ada sub kategori yang cocok dengan &quot;{subKatPengeluaranSearch}&quot;
              </div>
            )}
          </div>
        )}
      </section>

      {/* Modal Set Anggaran */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Set Limit Anggaran">
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-700">Kategori Pengeluaran</label>
            <select
              value={form.kategori}
              onChange={(e) => setForm((f) => ({ ...f, kategori: e.target.value, subKategori: '' }))}
              className="inp2 mt-1 w-full"
            >
              <option value="">Pilih kategori</option>
              {Object.keys(init.katKeluar).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          {form.kategori && (init.katKeluar[form.kategori] || []).length > 0 && (
            <div>
              <label className="text-[11px] font-semibold text-slate-700">
                Sub Kategori (opsional — kosongkan utk limit per kategori umum)
              </label>
              <select
                value={form.subKategori}
                onChange={(e) => setForm((f) => ({ ...f, subKategori: e.target.value }))}
                className="inp2 mt-1 w-full"
              >
                <option value="">- Semua Sub Kategori -</option>
                {(init.katKeluar[form.kategori] || []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-[11px] font-semibold text-slate-700">Nominal Limit Anggaran (Rp)</label>
            <input
              type="number"
              placeholder="Contoh: 1500000"
              value={form.nominal}
              onChange={(e) => setForm((f) => ({ ...f, nominal: e.target.value }))}
              className="inp2 mt-1 w-full"
            />
          </div>
          {errMsg && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-xl flex items-center gap-1.5">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errMsg}</span>
            </div>
          )}
          <button
            onClick={simpan}
            disabled={saving}
            className="w-full bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white text-xs font-bold py-2.5 rounded-xl disabled:opacity-50 shadow-sm transition"
          >
            {saving ? 'Menyimpan...' : 'Simpan Limit Anggaran'}
          </button>
        </div>
      </Modal>

      <style jsx global>{`
        .inp2 {
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 8px 12px;
          font-size: 13px;
          background: #ffffff;
          outline: none;
        }
        .inp2:focus {
          border-color: #0284c7;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
        }
      `}</style>
    </div>
  );
}
