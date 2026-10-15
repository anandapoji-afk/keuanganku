'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers,
  HandCoins,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Filter,
  Calendar,
  Plus,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RotateCcw,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { useAppData } from '@/components/layout/AppDataProvider';
import Modal from '@/components/ui/Modal';
import { rp } from '@/lib/utils';
import { hitungDaftarHutangDariGrid, hitungDaftarHutangPiutangDariGrid } from '@/lib/report/hutang';
import { tambahPembayaranDP } from '@/lib/actions/dp';
import { simpanHutangPiutangBaru, tambahPembayaranHutangPiutang } from '@/lib/actions/hutangPiutang';
import { hapusTransaksi } from '@/lib/actions/transaksi';
import type { HutangDPItem, HutangPiutangItem, TransaksiFilterState } from '@/lib/types';

function getNamaPeriodeAktif(f: TransaksiFilterState): string {
  if (f.tanggal) return `Tanggal: ${f.tanggal}`;
  if (f.startDate && f.endDate) return `${f.startDate} s/d ${f.endDate}`;
  if (f.startDate) return `Sejak ${f.startDate}`;
  if (f.endDate) return `Hingga ${f.endDate}`;
  if (f.bulan) {
    const [y, m] = f.bulan.split('-');
    const namaBulan = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ][parseInt(m, 10) - 1] || m;
    return `Bulan ${namaBulan} ${y}`;
  }
  if (f.tahun) return `Tahun ${f.tahun}`;
  return 'Semua Periode';
}

export default function HutangPiutangPage() {
  const router = useRouter();
  const { loading, init, transaksi, filter, setFilter, refetchRiwayat } = useAppData();
  const [tab, setTab] = useState<'dp' | 'hp'>('dp');

  // Filter yang berjalan (active period dari menu Transaksi)
  const [terapkanFilterBerjalan, setTerapkanFilterBerjalan] = useState(true);
  const [sembunyikanLunas, setSembunyikanLunas] = useState(true);
  const [cariTeks, setCariTeks] = useState('');

  // Sub-filter tabs
  const [filterStatusDP, setFilterStatusDP] = useState<'semua' | 'aktif' | 'terlambat' | 'lunas'>('semua');
  const [filterTipeHP, setFilterTipeHP] = useState<'semua' | 'Piutang' | 'Hutang' | 'terlambat' | 'lunas'>('semua');

  // Accordion riwayat per ID
  const [riwayatTerbuka, setRiwayatTerbuka] = useState<Record<string, boolean>>({});

  // Modals
  const [bayarDP, setBayarDP] = useState<HutangDPItem | null>(null);
  const [bayarHP, setBayarHP] = useState<HutangPiutangItem | null>(null);
  const [formBayar, setFormBayar] = useState({
    tanggal: new Date().toISOString().slice(0, 10),
    nominal: '',
    rekening: '',
    keterangan: '',
  });

  const [modalHPBaru, setModalHPBaru] = useState(false);
  const [formHPBaru, setFormHPBaru] = useState({
    tipe: 'Piutang' as 'Hutang' | 'Piutang',
    pihak: '',
    tanggal: new Date().toISOString().slice(0, 10),
    rekening: '',
    nominal: '',
    keterangan: '',
    jatuhTempo: '',
  });

  const [busy, setBusy] = useState(false);
  const [pesanNotif, setPesanNotif] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null);

  const hasActivePeriod = Boolean(filter.bulan || filter.startDate || filter.endDate || filter.tanggal || filter.tahun);
  const labelPeriode = getNamaPeriodeAktif(filter);

  // Buat filter periodik yang aman diterapkan ke DP & Hutang/Piutang
  const filterAktif = useMemo(() => {
    if (!terapkanFilterBerjalan || !hasActivePeriod) return null;
    return {
      ...filter,
      kategori: '', // hindari tabrakan dengan kategori transaksi belanja
      tipe: 'Semua' as const,
    };
  }, [filter, terapkanFilterBerjalan, hasActivePeriod]);

  // Kalkulasi data master
  const daftarDPRaw = useMemo(() => hitungDaftarHutangDariGrid(transaksi, null, null, filterAktif), [transaksi, filterAktif]);
  const daftarHPRaw = useMemo(() => hitungDaftarHutangPiutangDariGrid(transaksi, null, null, filterAktif), [transaksi, filterAktif]);

  // Statistik Ringkasan DP
  const statsDP = useMemo(() => {
    let totalTagihan = 0;
    let totalDibayar = 0;
    let totalSisa = 0;
    let countLunas = 0;
    let countAktif = 0;
    let countTerlambat = 0;

    daftarDPRaw.forEach((item) => {
      totalTagihan += item.totalTagihan;
      totalDibayar += item.totalDibayar;
      totalSisa += item.sisa;
      if (item.status === 'Lunas') countLunas++;
      else {
        countAktif++;
        if (item.status === 'Terlambat') countTerlambat++;
      }
    });

    return { totalTagihan, totalDibayar, totalSisa, countLunas, countAktif, countTerlambat, totalItem: daftarDPRaw.length };
  }, [daftarDPRaw]);

  // Statistik Ringkasan HP
  const statsHP = useMemo(() => {
    let piutangPokok = 0;
    let piutangSisa = 0;
    let hutangPokok = 0;
    let hutangSisa = 0;
    let countLunas = 0;
    let countBerjalan = 0;
    let countTerlambat = 0;

    daftarHPRaw.forEach((item) => {
      if (item.tipe === 'Piutang') {
        piutangPokok += item.nominalPokok;
        piutangSisa += item.sisa;
      } else {
        hutangPokok += item.nominalPokok;
        hutangSisa += item.sisa;
      }

      if (item.status === 'Lunas') countLunas++;
      else if (item.status === 'Terlambat') {
        countTerlambat++;
        countBerjalan++;
      } else {
        countBerjalan++;
      }
    });

    return {
      piutangPokok,
      piutangSisa,
      hutangPokok,
      hutangSisa,
      countLunas,
      countBerjalan,
      countTerlambat,
      totalItem: daftarHPRaw.length,
    };
  }, [daftarHPRaw]);

  // Filter DP yang tampil
  const daftarDP = useMemo(() => {
    return daftarDPRaw.filter((item) => {
      if (sembunyikanLunas && item.status === 'Lunas') return false;
      if (filterStatusDP === 'aktif' && item.status === 'Lunas') return false;
      if (filterStatusDP === 'lunas' && item.status !== 'Lunas') return false;
      if (filterStatusDP === 'terlambat' && item.status !== 'Terlambat') return false;

      if (cariTeks.trim()) {
        const q = cariTeks.toLowerCase();
        const cocok =
          item.keterangan.toLowerCase().includes(q) ||
          item.kategori.toLowerCase().includes(q) ||
          item.riwayat.some((r) => r.rekening.toLowerCase().includes(q) || (r.keterangan || '').toLowerCase().includes(q));
        if (!cocok) return false;
      }
      return true;
    });
  }, [daftarDPRaw, sembunyikanLunas, filterStatusDP, cariTeks]);

  // Filter HP yang tampil
  const daftarHP = useMemo(() => {
    return daftarHPRaw.filter((item) => {
      if (sembunyikanLunas && item.status === 'Lunas') return false;
      if (filterTipeHP === 'Piutang' && item.tipe !== 'Piutang') return false;
      if (filterTipeHP === 'Hutang' && item.tipe !== 'Hutang') return false;
      if (filterTipeHP === 'lunas' && item.status !== 'Lunas') return false;
      if (filterTipeHP === 'terlambat' && item.status !== 'Terlambat') return false;

      if (cariTeks.trim()) {
        const q = cariTeks.toLowerCase();
        const cocok =
          item.pihak.toLowerCase().includes(q) ||
          item.keterangan.toLowerCase().includes(q) ||
          item.tipe.toLowerCase().includes(q) ||
          item.riwayat.some((r) => r.rekening.toLowerCase().includes(q) || (r.keterangan || '').toLowerCase().includes(q));
        if (!cocok) return false;
      }
      return true;
    });
  }, [daftarHPRaw, sembunyikanLunas, filterTipeHP, cariTeks]);

  function toggleRiwayat(id: string) {
    setRiwayatTerbuka((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function submitBayarDP() {
    if (!bayarDP) return;
    const nominal = parseFloat(formBayar.nominal) || 0;
    if (nominal <= 0) {
      alert('Masukkan nominal pembayaran cicilan yang valid!');
      return;
    }
    setBusy(true);
    const res = await tambahPembayaranDP({
      workspace: init.active,
      piutangId: bayarDP.piutangId,
      tanggal: formBayar.tanggal,
      nominal,
      rekening: formBayar.rekening || init.rekenings[0] || 'CASH',
      keterangan: formBayar.keterangan,
    });
    setBusy(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    setBayarDP(null);
    setPesanNotif({ tipe: 'sukses', teks: `Pembayaran cicilan untuk "${bayarDP.keterangan}" berhasil disimpan!` });
    setTimeout(() => setPesanNotif(null), 4000);
    await refetchRiwayat();
  }

  async function submitBayarHP() {
    if (!bayarHP) return;
    const nominal = parseFloat(formBayar.nominal) || 0;
    if (nominal <= 0) {
      alert('Masukkan nominal pembayaran yang valid!');
      return;
    }
    setBusy(true);
    const res = await tambahPembayaranHutangPiutang({
      workspace: init.active,
      hpId: bayarHP.hpId,
      tanggal: formBayar.tanggal,
      nominal,
      rekening: formBayar.rekening || init.rekenings[0] || 'CASH',
      keterangan: formBayar.keterangan,
    });
    setBusy(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    setBayarHP(null);
    setPesanNotif({ tipe: 'sukses', teks: `Pembayaran untuk "${bayarHP.pihak}" berhasil disimpan!` });
    setTimeout(() => setPesanNotif(null), 4000);
    await refetchRiwayat();
  }

  async function submitHPBaru() {
    const nominal = parseFloat(formHPBaru.nominal) || 0;
    if (!formHPBaru.pihak.trim() || nominal <= 0) {
      alert('Mohon isi nama pihak terkait dan nominal yang valid!');
      return;
    }
    setBusy(true);
    const res = await simpanHutangPiutangBaru({
      workspace: init.active,
      tipe: formHPBaru.tipe,
      pihakTerkait: formHPBaru.pihak,
      tanggal: formHPBaru.tanggal,
      rekening: formHPBaru.rekening || init.rekenings[0] || 'CASH',
      nominal,
      keterangan: formHPBaru.keterangan,
      jatuhTempo: formHPBaru.jatuhTempo,
    });
    setBusy(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    setModalHPBaru(false);
    setFormHPBaru({
      tipe: 'Piutang',
      pihak: '',
      tanggal: new Date().toISOString().slice(0, 10),
      rekening: init.rekenings[0] || 'CASH',
      nominal: '',
      keterangan: '',
      jatuhTempo: '',
    });
    setPesanNotif({ tipe: 'sukses', teks: 'Catatan Hutang/Piutang baru berhasil dibuat!' });
    setTimeout(() => setPesanNotif(null), 4000);
    await refetchRiwayat();
  }

  async function handleHapusItem(idTransaksi?: string, label?: string) {
    if (!idTransaksi) return;
    const konfirmasi = confirm(`Yakin ingin menghapus "${label || 'item ini'}"?\nPastikan tidak ada riwayat pembayaran cicilan yang tertaut.`);
    if (!konfirmasi) return;

    setBusy(true);
    const res = await hapusTransaksi(idTransaksi, init.active);
    setBusy(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    setPesanNotif({ tipe: 'sukses', teks: 'Data berhasil dihapus!' });
    setTimeout(() => setPesanNotif(null), 3000);
    await refetchRiwayat();
  }

  async function handleHapusCicilan(idCicilan?: string, nominal?: number) {
    if (!idCicilan) return;
    const konfirmasi = confirm(`Hapus pembayaran cicilan sebesar ${rp(nominal || 0)} ini?`);
    if (!konfirmasi) return;

    setBusy(true);
    const res = await hapusTransaksi(idCicilan, init.active);
    setBusy(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    setPesanNotif({ tipe: 'sukses', teks: 'Pembayaran cicilan berhasil dihapus!' });
    setTimeout(() => setPesanNotif(null), 3000);
    await refetchRiwayat();
  }

  function lihatDiTransaksi(keterangan: string, kategori?: string) {
    setFilter((prev) => ({
      ...prev,
      search: keterangan,
      kategori: kategori || '',
      tipe: 'Semua',
    }));
    router.push('/transaksi');
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium">Memuat data hutang &amp; cicilan...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-10">
      {/* Toast Notifikasi */}
      <AnimatePresence>
        {pesanNotif && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-xl text-xs font-semibold shadow-md flex items-center justify-between ${
              pesanNotif.tipe === 'sukses' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <span>{pesanNotif.teks}</span>
            <button onClick={() => setPesanNotif(null)} className="ml-2 text-slate-400 hover:text-slate-600 text-sm">
              &times;
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Navigasi Utama */}
      <div className="bg-slate-100/80 p-1 rounded-2xl flex gap-1 border border-slate-200/60 shadow-sm">
        <button
          onClick={() => setTab('dp')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            tab === 'dp'
              ? 'bg-white text-violet-700 shadow-sm border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <Layers size={16} className={tab === 'dp' ? 'text-violet-600' : 'text-slate-400'} />
          <span>DP &amp; Cicilan</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              tab === 'dp' ? 'bg-violet-100 text-violet-700' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {statsDP.countAktif} aktif
          </span>
        </button>

        <button
          onClick={() => setTab('hp')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            tab === 'hp'
              ? 'bg-white text-teal-700 shadow-sm border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <HandCoins size={16} className={tab === 'hp' ? 'text-teal-600' : 'text-slate-400'} />
          <span>Hutang &amp; Piutang</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              tab === 'hp' ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {statsHP.countBerjalan} aktif
          </span>
        </button>
      </div>

      {/* Ringkasan Kartu Atas */}
      {tab === 'dp' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="bg-gradient-to-br from-violet-50 to-white rounded-2xl p-3.5 border border-violet-100 shadow-xs">
            <div className="text-[11px] font-semibold text-violet-600 uppercase tracking-wider">Total Tagihan</div>
            <div className="text-lg sm:text-xl font-bold text-slate-800 mt-1">{rp(statsDP.totalTagihan)}</div>
            <div className="text-[10px] text-slate-400 mt-1">{statsDP.totalItem} transaksi total</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-3.5 border border-emerald-100 shadow-xs">
            <div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Sudah Dibayar</div>
            <div className="text-lg sm:text-xl font-bold text-emerald-700 mt-1">{rp(statsDP.totalDibayar)}</div>
            <div className="text-[10px] text-slate-400 mt-1">{statsDP.countLunas} item sudah lunas</div>
          </div>
          <div className="bg-gradient-to-br from-rose-50 to-white rounded-2xl p-3.5 border border-rose-100 shadow-xs">
            <div className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Sisa Tagihan Belum Lunas</div>
            <div className="text-lg sm:text-xl font-bold text-rose-700 mt-1">{rp(statsDP.totalSisa)}</div>
            <div className="text-[10px] text-rose-500 font-medium mt-1">{statsDP.countAktif} item perlu diselesaikan</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="bg-gradient-to-br from-teal-50 to-white rounded-2xl p-3.5 border border-teal-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider">Piutang (Saya Pinjamkan)</span>
              <ArrowUpRight size={14} className="text-teal-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-slate-800 mt-1">{rp(statsHP.piutangSisa)}</div>
            <div className="text-[10px] text-slate-500 mt-1">Sisa dari total pokok {rp(statsHP.piutangPokok)}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl p-3.5 border border-amber-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Hutang (Saya Meminjam)</span>
              <ArrowDownLeft size={14} className="text-amber-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-amber-800 mt-1">{rp(statsHP.hutangSisa)}</div>
            <div className="text-[10px] text-slate-500 mt-1">Sisa dari total pokok {rp(statsHP.hutangPokok)}</div>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Status Berjalan</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg sm:text-xl font-bold text-slate-800">{statsHP.countBerjalan} Aktif</span>
              {statsHP.countTerlambat > 0 && (
                <span className="text-xs font-bold text-rose-600">({statsHP.countTerlambat} terlambat)</span>
              )}
            </div>
            <div className="text-[10px] text-emerald-600 font-medium mt-1">{statsHP.countLunas} transaksi lunas</div>
          </div>
        </div>
      )}

      {/* Toolbar Filter & Kontrol */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Pencarian */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama, keterangan, rekening..."
              value={cariTeks}
              onChange={(e) => setCariTeks(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
            {cariTeks && (
              <button onClick={() => setCariTeks('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                &times;
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Fitur Sembunyikan yang Sudah Lunas */}
            <button
              onClick={() => setSembunyikanLunas((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                sembunyikanLunas
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="Sembunyikan atau tampilkan transaksi yang sudah lunas"
            >
              {sembunyikanLunas ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>Sembunyikan yang Lunas</span>
              {sembunyikanLunas && (
                <span className="bg-emerald-200/70 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  Aktif
                </span>
              )}
            </button>

            {/* Tombol Catat Hutang/Piutang Baru (Hanya tampil di tab HP) */}
            {tab === 'hp' && (
              <button
                onClick={() => setModalHPBaru(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                <Plus size={14} />
                <span>Catat Hutang/Piutang</span>
              </button>
            )}
          </div>
        </div>

        {/* Banner Indikator & Kontrol Filter yang Berjalan */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-semibold text-slate-600">
              <Filter size={12} className="text-teal-600" />
              <span>Filter Periode:</span>
            </span>

            <span className="px-2 py-0.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-medium text-[11px]">
              {labelPeriode}
            </span>

            {hasActivePeriod && (
              <button
                type="button"
                onClick={() => setTerapkanFilterBerjalan((v) => !v)}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-lg border transition ${
                  terapkanFilterBerjalan
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {terapkanFilterBerjalan ? 'Filter Berjalan Diterapkan' : 'Tampilkan Semua Periode'}
              </button>
            )}
          </div>

          {/* Quick status chips */}
          {tab === 'dp' ? (
            <div className="flex gap-1">
              {(['semua', 'aktif', 'terlambat', 'lunas'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatusDP(st)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] capitalize font-medium transition ${
                    filterStatusDP === st
                      ? 'bg-violet-100 text-violet-700 font-semibold'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {st === 'semua' ? 'Semua' : st === 'aktif' ? 'Belum Lunas' : st}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-1 flex-wrap">
              {(['semua', 'Piutang', 'Hutang', 'terlambat', 'lunas'] as const).map((tp) => (
                <button
                  key={tp}
                  onClick={() => setFilterTipeHP(tp)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition ${
                    filterTipeHP === tp
                      ? 'bg-teal-100 text-teal-700 font-semibold'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {tp === 'semua' ? 'Semua' : tp === 'Piutang' ? 'Piutang Saja' : tp === 'Hutang' ? 'Hutang Saja' : tp === 'terlambat' ? 'Terlambat' : 'Lunas'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== TAB DP & CICILAN ===== */}
      {tab === 'dp' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-400 px-1">
            Transaksi DP &amp; Cicilan dicatat melalui form Transaksi (opsi &quot;Ini transaksi DP/Cicilan&quot;).
            Setiap pembayaran cicilan langsung mengurangi sisa tagihan.
          </p>

          <div className="space-y-3">
            {daftarDP.map((item) => {
              const isOpen = !!riwayatTerbuka[item.piutangId];
              const persentase = item.persentase ?? (item.totalTagihan > 0 ? Math.min(Math.round((item.totalDibayar / item.totalTagihan) * 100), 100) : 100);

              return (
                <div
                  key={item.piutangId}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-sm transition-all overflow-hidden"
                >
                  {/* Header Kartu */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 text-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Layers size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">
                            {item.keterangan}
                          </h3>
                          <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-400 mt-1">
                            <span className="font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                              {item.kategori}
                            </span>
                            <span>&bull;</span>
                            <span>{item.tglTampil}</span>
                            <span>&bull;</span>
                            <span className="text-[11px]">{item.tipe}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            item.status === 'Lunas'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'Terlambat'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-violet-50 text-violet-700 border border-violet-200'
                          }`}
                        >
                          {item.status === 'Lunas' ? (
                            <CheckCircle2 size={13} className="text-emerald-600" />
                          ) : item.status === 'Terlambat' ? (
                            <AlertCircle size={13} className="text-rose-600" />
                          ) : (
                            <Clock size={13} className="text-violet-600" />
                          )}
                          <span>{item.status}</span>
                        </span>

                        {item.id && (
                          <button
                            onClick={() => handleHapusItem(item.id, item.keterangan)}
                            className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Hapus transaksi DP utama (hanya jika belum ada cicilan)"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3.5 space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">{persentase}% Dibayar</span>
                        <span className="text-slate-400">
                          {item.riwayat.length}x pembayaran cicilan
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.status === 'Lunas'
                              ? 'bg-emerald-500'
                              : item.status === 'Terlambat'
                              ? 'bg-rose-500'
                              : 'bg-violet-600'
                          }`}
                          style={{ width: `${persentase}%` }}
                        />
                      </div>
                    </div>

                    {/* 3 Kolom Nilai Finansial */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50/80 rounded-xl p-3 border border-slate-100 mt-3 text-center sm:text-left">
                      <div>
                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total Tagihan</div>
                        <div className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5">{rp(item.totalTagihan)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">Sudah Dibayar</div>
                        <div className="text-xs sm:text-sm font-bold text-emerald-700 mt-0.5">{rp(item.totalDibayar)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-violet-600 font-medium uppercase tracking-wider">Sisa Tagihan</div>
                        <div className="text-xs sm:text-sm font-bold text-violet-700 mt-0.5">{rp(item.sisa)}</div>
                      </div>
                    </div>

                    {/* Baris Tombol Aksi */}
                    <div className="flex items-center justify-between gap-2 mt-3.5 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        {item.status !== 'Lunas' && (
                          <button
                            onClick={() => {
                              setBayarDP(item);
                              setFormBayar({
                                tanggal: new Date().toISOString().slice(0, 10),
                                nominal: String(item.sisa),
                                rekening: init.rekenings[0] || 'CASH',
                                keterangan: `Cicilan: ${item.keterangan}`,
                              });
                            }}
                            className="inline-flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white font-semibold px-3 py-1.5 rounded-xl shadow-xs transition"
                          >
                            <Plus size={14} />
                            <span>Bayar Cicilan</span>
                          </button>
                        )}

                        <button
                          onClick={() => lihatDiTransaksi(item.keterangan, item.kategori)}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition"
                        >
                          <ExternalLink size={12} />
                          <span>Transaksi</span>
                        </button>
                      </div>

                      {/* Tombol Accordion Riwayat */}
                      {item.riwayat.length > 0 && (
                        <button
                          onClick={() => toggleRiwayat(item.piutangId)}
                          className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-violet-700 px-2 py-1 rounded-lg transition"
                        >
                          <span>Riwayat ({item.riwayat.length})</span>
                          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Panel Riwayat Pembayaran (Accordion) */}
                  {isOpen && item.riwayat.length > 0 && (
                    <div className="bg-slate-50/70 border-t border-slate-100 p-3.5 space-y-2">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Rincian Riwayat Pembayaran
                      </div>
                      <div className="space-y-1.5">
                        {item.riwayat.map((r, idx) => (
                          <div
                            key={r.id || `${item.piutangId}-${idx}`}
                            className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-bold text-[10px] flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <div>
                                <span className="font-semibold text-slate-700">{r.tglTampil}</span>
                                <span className="text-[11px] text-slate-400 ml-1.5">via {r.rekening}</span>
                                {r.keterangan && (
                                  <div className="text-[10px] text-slate-400 italic">{r.keterangan}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-violet-700">{rp(r.nominal)}</span>
                              {r.id && (
                                <button
                                  onClick={() => handleHapusCicilan(r.id, r.nominal)}
                                  className="p-1 text-slate-300 hover:text-rose-600 rounded-md transition"
                                  title="Hapus baris pembayaran ini"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {daftarDP.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
                <Layers size={36} className="mx-auto text-slate-300 mb-2" />
                <div className="text-sm font-semibold text-slate-600">Tidak ada data DP &amp; Cicilan</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  {sembunyikanLunas
                    ? 'Semua transaksi cicilan sudah lunas atau tidak cocok dengan filter aktif. Matikan "Sembunyikan yang Lunas" untuk melihat riwayat.'
                    : 'Belum ada transaksi dengan status DP / Cicilan pada periode yang dipilih.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB HUTANG & PIUTANG ===== */}
      {tab === 'hp' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-400 px-1">
            Catat pinjaman keluar (Piutang) atau pinjaman masuk (Hutang). Tiap pembayaran dicatat berulang kali hingga pokok lunas.
          </p>

          <div className="space-y-3">
            {daftarHP.map((item) => {
              const isOpen = !!riwayatTerbuka[item.hpId];
              const isPiutang = item.tipe === 'Piutang';
              const persentase = item.persentase ?? (item.nominalPokok > 0 ? Math.min(Math.round((item.totalDibayar / item.nominalPokok) * 100), 100) : 100);

              return (
                <div
                  key={item.hpId}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-sm transition-all overflow-hidden"
                >
                  {/* Header Kartu */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                            isPiutang
                              ? 'bg-teal-50 border-teal-100 text-teal-600'
                              : 'bg-amber-50 border-amber-100 text-amber-600'
                          }`}
                        >
                          {isPiutang ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">
                              {item.pihak}
                            </h3>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isPiutang ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.tipe === 'Piutang' ? 'Piutang (Pinjaman Keluar)' : 'Hutang (Pinjaman Masuk)'}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 mt-1">
                            {item.keterangan || '-'}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mt-1">
                            <span>{item.tglTampil}</span>
                            {item.jatuhTempo && (
                              <>
                                <span>&bull;</span>
                                <span
                                  className={`flex items-center gap-1 font-medium ${
                                    item.status === 'Terlambat' ? 'text-rose-600 font-bold' : 'text-slate-500'
                                  }`}
                                >
                                  <Calendar size={12} />
                                  <span>Jatuh Tempo: {item.jatuhTempo}</span>
                                  {item.status === 'Terlambat' && <span>(Lewat)</span>}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            item.status === 'Lunas'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'Terlambat'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isPiutang
                              ? 'bg-teal-50 text-teal-700 border border-teal-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.status === 'Lunas' ? (
                            <CheckCircle2 size={13} className="text-emerald-600" />
                          ) : item.status === 'Terlambat' ? (
                            <AlertCircle size={13} className="text-rose-600" />
                          ) : (
                            <Clock size={13} className={isPiutang ? 'text-teal-600' : 'text-amber-600'} />
                          )}
                          <span>{item.status}</span>
                        </span>

                        {item.id && (
                          <button
                            onClick={() => handleHapusItem(item.id, `${item.tipe} - ${item.pihak}`)}
                            className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Hapus catatan pokok ini (hanya jika belum ada riwayat pembayaran)"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3.5 space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">{persentase}% Terbayar</span>
                        <span className="text-slate-400">
                          {item.riwayat.length}x pembayaran dicatat
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.status === 'Lunas'
                              ? 'bg-emerald-500'
                              : item.status === 'Terlambat'
                              ? 'bg-rose-500'
                              : isPiutang
                              ? 'bg-teal-600'
                              : 'bg-amber-600'
                          }`}
                          style={{ width: `${persentase}%` }}
                        />
                      </div>
                    </div>

                    {/* 3 Kolom Nilai Finansial */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50/80 rounded-xl p-3 border border-slate-100 mt-3 text-center sm:text-left">
                      <div>
                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Nominal Pokok</div>
                        <div className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5">{rp(item.nominalPokok)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">Sudah Dibayar</div>
                        <div className="text-xs sm:text-sm font-bold text-emerald-700 mt-0.5">{rp(item.totalDibayar)}</div>
                      </div>
                      <div>
                        <div className={`text-[10px] font-medium uppercase tracking-wider ${isPiutang ? 'text-teal-600' : 'text-amber-600'}`}>
                          Sisa Pokok
                        </div>
                        <div className={`text-xs sm:text-sm font-bold mt-0.5 ${isPiutang ? 'text-teal-700' : 'text-amber-700'}`}>
                          {rp(item.sisa)}
                        </div>
                      </div>
                    </div>

                    {/* Baris Tombol Aksi */}
                    <div className="flex items-center justify-between gap-2 mt-3.5 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        {item.status !== 'Lunas' && (
                          <button
                            onClick={() => {
                              setBayarHP(item);
                              setFormBayar({
                                tanggal: new Date().toISOString().slice(0, 10),
                                nominal: String(item.sisa),
                                rekening: init.rekenings[0] || 'CASH',
                                keterangan: isPiutang ? `Pembayaran dari ${item.pihak}` : `Bayar hutang ke ${item.pihak}`,
                              });
                            }}
                            className={`inline-flex items-center gap-1.5 text-xs text-white font-semibold px-3 py-1.5 rounded-xl shadow-xs transition ${
                              isPiutang ? 'bg-teal-600 hover:bg-teal-700' : 'bg-amber-600 hover:bg-amber-700'
                            }`}
                          >
                            <Plus size={14} />
                            <span>Catat Pembayaran</span>
                          </button>
                        )}

                        <button
                          onClick={() => lihatDiTransaksi(item.pihak, item.tipe)}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition"
                        >
                          <ExternalLink size={12} />
                          <span>Transaksi</span>
                        </button>
                      </div>

                      {/* Tombol Accordion Riwayat */}
                      {item.riwayat.length > 0 && (
                        <button
                          onClick={() => toggleRiwayat(item.hpId)}
                          className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-teal-700 px-2 py-1 rounded-lg transition"
                        >
                          <span>Riwayat ({item.riwayat.length})</span>
                          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Panel Riwayat Pembayaran (Accordion) */}
                  {isOpen && item.riwayat.length > 0 && (
                    <div className="bg-slate-50/70 border-t border-slate-100 p-3.5 space-y-2">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Rincian Riwayat Pembayaran
                      </div>
                      <div className="space-y-1.5">
                        {item.riwayat.map((r, idx) => (
                          <div
                            key={r.id || `${item.hpId}-${idx}`}
                            className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 font-bold text-[10px] flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <div>
                                <span className="font-semibold text-slate-700">{r.tglTampil}</span>
                                <span className="text-[11px] text-slate-400 ml-1.5">via {r.rekening}</span>
                                {r.keterangan && (
                                  <div className="text-[10px] text-slate-400 italic">{r.keterangan}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-teal-700">{rp(r.nominal)}</span>
                              {r.id && (
                                <button
                                  onClick={() => handleHapusCicilan(r.id, r.nominal)}
                                  className="p-1 text-slate-300 hover:text-rose-600 rounded-md transition"
                                  title="Hapus baris pembayaran ini"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {daftarHP.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
                <HandCoins size={36} className="mx-auto text-slate-300 mb-2" />
                <div className="text-sm font-semibold text-slate-600">Tidak ada data Hutang / Piutang</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  {sembunyikanLunas
                    ? 'Semua catatan hutang/piutang sudah lunas atau tidak cocok dengan filter aktif. Matikan "Sembunyikan yang Lunas" untuk melihat riwayat.'
                    : 'Belum ada catatan hutang/piutang pada periode yang dipilih. Klik tombol "+ Catat Hutang/Piutang" untuk memulai.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL BAYAR DP / CICILAN */}
      <Modal open={!!bayarDP} onClose={() => setBayarDP(null)} title={`Bayar Cicilan \u2014 ${bayarDP?.keterangan || ''}`}>
        <FormBayar
          sisa={bayarDP?.sisa || 0}
          formBayar={formBayar}
          setFormBayar={setFormBayar}
          rekenings={init.rekenings}
          busy={busy}
          onSubmit={submitBayarDP}
          tombolWarna="violet"
        />
      </Modal>

      {/* MODAL BAYAR HUTANG / PIUTANG */}
      <Modal open={!!bayarHP} onClose={() => setBayarHP(null)} title={`Catat Pembayaran \u2014 ${bayarHP?.pihak || ''}`}>
        <FormBayar
          sisa={bayarHP?.sisa || 0}
          formBayar={formBayar}
          setFormBayar={setFormBayar}
          rekenings={init.rekenings}
          busy={busy}
          onSubmit={submitBayarHP}
          tombolWarna="teal"
        />
      </Modal>

      {/* MODAL CATAT HUTANG / PIUTANG BARU */}
      <Modal open={modalHPBaru} onClose={() => setModalHPBaru(false)} title="Catat Hutang / Piutang Baru">
        <div className="space-y-3.5">
          {/* Pemilih Tipe */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Jenis Transaksi
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormHPBaru((f) => ({ ...f, tipe: 'Piutang' }))}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  formHPBaru.tipe === 'Piutang'
                    ? 'bg-teal-50 border-teal-400 text-teal-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <ArrowUpRight size={14} className="text-teal-600" />
                <span>Piutang (Saya Pinjamkan)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormHPBaru((f) => ({ ...f, tipe: 'Hutang' }))}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  formHPBaru.tipe === 'Hutang'
                    ? 'bg-amber-50 border-amber-400 text-amber-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <ArrowDownLeft size={14} className="text-amber-600" />
                <span>Hutang (Saya Meminjam)</span>
              </button>
            </div>
          </div>

          <LabeledInput
            label="Pihak Terkait (Nama Orang / Lembaga)"
            placeholder="Contoh: Budi, Bank Mandiri, Kantor"
            value={formHPBaru.pihak}
            onChange={(v) => setFormHPBaru((f) => ({ ...f, pihak: v }))}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <LabeledInput
              label="Tanggal Transaksi"
              type="date"
              value={formHPBaru.tanggal}
              onChange={(v) => setFormHPBaru((f) => ({ ...f, tanggal: v }))}
            />
            <LabeledInput
              label="Jatuh Tempo (opsional)"
              type="date"
              value={formHPBaru.jatuhTempo}
              onChange={(v) => setFormHPBaru((f) => ({ ...f, jatuhTempo: v }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <LabeledInput
              label="Nominal Pokok (Rp)"
              type="number"
              placeholder="0"
              value={formHPBaru.nominal}
              onChange={(v) => setFormHPBaru((f) => ({ ...f, nominal: v }))}
            />

            <div>
              <label className="text-[11px] font-medium text-slate-500">Rekening Sumber / Tujuan</label>
              <select
                value={formHPBaru.rekening}
                onChange={(e) => setFormHPBaru((f) => ({ ...f, rekening: e.target.value }))}
                className="inp3 mt-1"
              >
                {init.rekenings.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <LabeledInput
            label="Keterangan Tambahan (opsional)"
            placeholder="Catatan keperluan atau keterangan pinjaman..."
            value={formHPBaru.keterangan}
            onChange={(v) => setFormHPBaru((f) => ({ ...f, keterangan: v }))}
          />

          <button
            onClick={submitHPBaru}
            disabled={busy}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5 rounded-xl shadow-xs transition disabled:opacity-50"
          >
            {busy ? 'Menyimpan...' : 'Simpan Catatan'}
          </button>
        </div>
      </Modal>

      <style jsx global>{`
        .inp3 {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 8px 12px;
          font-size: 13px;
          background-color: #fff;
          outline: none;
          transition: all 0.15s ease-in-out;
        }
        .inp3:focus {
          border-color: #0d9488;
          box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.15);
        }
      `}</style>
    </div>
  );
}

function FormBayar({
  sisa,
  formBayar,
  setFormBayar,
  rekenings,
  busy,
  onSubmit,
  tombolWarna = 'teal',
}: {
  sisa: number;
  formBayar: { tanggal: string; nominal: string; rekening: string; keterangan: string };
  setFormBayar: React.Dispatch<React.SetStateAction<{ tanggal: string; nominal: string; rekening: string; keterangan: string }>>;
  rekenings: string[];
  busy: boolean;
  onSubmit: () => void;
  tombolWarna?: 'violet' | 'teal';
}) {
  return (
    <div className="space-y-3.5">
      {/* Kartu info sisa */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Sisa yang Belum Dibayar</div>
          <div className="text-sm font-bold text-slate-800 mt-0.5">{rp(sisa)}</div>
        </div>
        <button
          type="button"
          onClick={() => setFormBayar((f) => ({ ...f, nominal: String(sisa) }))}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition shadow-2xs"
        >
          Bayar Lunas Semua
        </button>
      </div>

      <LabeledInput
        label="Tanggal Pembayaran"
        type="date"
        value={formBayar.tanggal}
        onChange={(v) => setFormBayar((f) => ({ ...f, tanggal: v }))}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <LabeledInput
          label="Nominal Pembayaran (Rp)"
          type="number"
          placeholder="0"
          value={formBayar.nominal}
          onChange={(v) => setFormBayar((f) => ({ ...f, nominal: v }))}
        />

        <div>
          <label className="text-[11px] font-medium text-slate-500">Rekening Digunakan</label>
          <select
            value={formBayar.rekening}
            onChange={(e) => setFormBayar((f) => ({ ...f, rekening: e.target.value }))}
            className="inp3 mt-1"
          >
            {rekenings.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <LabeledInput
        label="Keterangan Pembayaran (opsional)"
        placeholder="Misal: Cicilan ke-2, Transfer via BCA"
        value={formBayar.keterangan}
        onChange={(v) => setFormBayar((f) => ({ ...f, keterangan: v }))}
      />

      <button
        onClick={onSubmit}
        disabled={busy}
        className={`w-full text-white text-sm font-semibold py-2.5 rounded-xl shadow-xs transition disabled:opacity-50 ${
          tombolWarna === 'violet' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-teal-600 hover:bg-teal-700'
        }`}
      >
        {busy ? 'Menyimpan...' : 'Simpan Pembayaran'}
      </button>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-slate-500">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="inp3 mt-1"
      />
    </div>
  );
}
