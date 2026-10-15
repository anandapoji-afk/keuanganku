'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  PiggyBank,
  Target,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Calendar,
  Wallet,
  Sparkles,
  ArrowRight,
  Receipt,
} from 'lucide-react';
import { useAppData } from '@/components/layout/AppDataProvider';
import Modal from '@/components/ui/Modal';
import { rp, formatTanggalIndo } from '@/lib/utils';
import { simpanTabunganBaru, simpanIsiTabungan, hapusItemTabungan } from '@/lib/actions/tabungan';
import type { TabunganGabungan } from '@/lib/types';

export default function TabunganPage() {
  const router = useRouter();
  const { loading, init, tabungan, setFilter, refetchRiwayat } = useAppData();

  // State Kontrol & Filter
  const [cariTeks, setCariTeks] = useState('');
  const [filterStatus, setFilterStatus] = useState<'semua' | 'aktif' | 'tercapai'>('semua');
  const [sembunyikanTercapai, setSembunyikanTercapai] = useState(false);
  const [riwayatTerbuka, setRiwayatTerbuka] = useState<Record<string, boolean>>({});

  // Modals
  const [modalBaru, setModalBaru] = useState(false);
  const [formBaru, setFormBaru] = useState({ keterangan: '', nominal: '', tenggat: '' });

  const [targetDipilih, setTargetDipilih] = useState<TabunganGabungan | null>(null);
  const [formIsi, setFormIsi] = useState({
    tanggal: new Date().toISOString().slice(0, 10),
    nominal: '',
    rekening: '',
    keterangan: '',
  });

  const [busy, setBusy] = useState(false);
  const [pesanNotif, setPesanNotif] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null);

  // Perhitungan Statistik Ringkasan Atas
  const stats = useMemo(() => {
    let totalTarget = 0;
    let totalTerkumpul = 0;
    let countTercapai = 0;
    let countAktif = 0;
    let countTerlambat = 0;
    const today = new Date().toISOString().slice(0, 10);

    tabungan.forEach((t) => {
      totalTarget += t.targetNominal;
      const terkumpul = t.deposits.reduce((acc, d) => acc + d.nominal, 0);
      totalTerkumpul += terkumpul;

      const isLengkap = t.targetNominal > 0 && terkumpul >= t.targetNominal;
      if (isLengkap) {
        countTercapai++;
      } else {
        countAktif++;
        if (t.tenggat && t.tenggat < today) {
          countTerlambat++;
        }
      }
    });

    const totalKurang = Math.max(0, totalTarget - totalTerkumpul);
    return {
      totalTarget,
      totalTerkumpul,
      totalKurang,
      countTercapai,
      countAktif,
      countTerlambat,
      totalTargetCount: tabungan.length,
    };
  }, [tabungan]);

  // Filter daftar yang tampil
  const daftarTampil = useMemo(() => {
    return tabungan.filter((t) => {
      const terkumpul = t.deposits.reduce((acc, d) => acc + d.nominal, 0);
      const isTercapai = t.targetNominal > 0 && terkumpul >= t.targetNominal;

      if (sembunyikanTercapai && isTercapai) return false;
      if (filterStatus === 'aktif' && isTercapai) return false;
      if (filterStatus === 'tercapai' && !isTercapai) return false;

      if (cariTeks.trim()) {
        const q = cariTeks.toLowerCase();
        const cocok =
          t.keterangan.toLowerCase().includes(q) ||
          t.deposits.some(
            (d) =>
              d.rekening.toLowerCase().includes(q) ||
              (d.keterangan || '').toLowerCase().includes(q)
          );
        if (!cocok) return false;
      }

      return true;
    });
  }, [tabungan, sembunyikanTercapai, filterStatus, cariTeks]);

  function toggleRiwayat(id: string) {
    setRiwayatTerbuka((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function lihatDiTransaksi(keterangan: string) {
    setFilter((prev) => ({
      ...prev,
      search: keterangan || '',
      kategori: 'Tabungan',
      tipe: 'Semua',
    }));
    router.push('/transaksi');
  }

  async function submitBaru() {
    const nominal = parseFloat(formBaru.nominal) || 0;
    if (!formBaru.keterangan.trim() || nominal <= 0) {
      alert('Mohon isi keterangan dan nominal target yang valid!');
      return;
    }
    setBusy(true);
    const res = await simpanTabunganBaru({
      workspace: init.active,
      keterangan: formBaru.keterangan.trim(),
      nominal,
      tenggat: formBaru.tenggat || undefined,
    });
    setBusy(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    setModalBaru(false);
    setFormBaru({ keterangan: '', nominal: '', tenggat: '' });
    setPesanNotif({ tipe: 'sukses', teks: `Target tabungan "${formBaru.keterangan}" berhasil dibuat!` });
    setTimeout(() => setPesanNotif(null), 4000);
    await refetchRiwayat();
  }

  function bukaModalNabung(item: TabunganGabungan) {
    const terkumpul = item.deposits.reduce((acc, d) => acc + d.nominal, 0);
    const sisa = Math.max(0, item.targetNominal - terkumpul);
    setTargetDipilih(item);
    setFormIsi({
      tanggal: new Date().toISOString().slice(0, 10),
      nominal: sisa > 0 ? String(sisa) : '',
      rekening: init.rekenings[0] || 'CASH',
      keterangan: `Nabung: ${item.keterangan}`,
    });
  }

  async function submitIsi() {
    if (!targetDipilih) return;
    const nominal = parseFloat(formIsi.nominal) || 0;
    if (nominal <= 0) {
      alert('Masukkan nominal setoran tabungan yang valid!');
      return;
    }
    setBusy(true);
    const res = await simpanIsiTabungan({
      workspace: init.active,
      tbgId: targetDipilih.id,
      tanggal: formIsi.tanggal,
      nominal,
      rekening: formIsi.rekening || init.rekenings[0] || 'CASH',
      keterangan: formIsi.keterangan,
    });
    setBusy(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    setTargetDipilih(null);
    setPesanNotif({ tipe: 'sukses', teks: `Setoran dana untuk "${targetDipilih.keterangan}" berhasil disimpan!` });
    setTimeout(() => setPesanNotif(null), 4000);
    await refetchRiwayat();
  }

  async function hapusTarget(id: string, keterangan: string) {
    if (!confirm(`Hapus target tabungan "${keterangan}"? Riwayat setoran di target ini akan terhapus.`)) return;
    setBusy(true);
    const res = await hapusItemTabungan({ workspace: init.active, id, jenis: 'Target' });
    setBusy(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    setPesanNotif({ tipe: 'sukses', teks: `Target tabungan "${keterangan}" berhasil dihapus.` });
    setTimeout(() => setPesanNotif(null), 4000);
    await refetchRiwayat();
  }

  async function hapusIsi(depositId: string, keterangan: string) {
    if (!confirm(`Hapus riwayat setoran ini? Saldo rekening asal akan dikembalikan.`)) return;
    setBusy(true);
    const res = await hapusItemTabungan({ workspace: init.active, id: depositId, jenis: 'Isi' });
    setBusy(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    setPesanNotif({ tipe: 'sukses', teks: `Riwayat setoran berhasil dihapus dan saldo rekening disesuaikan.` });
    setTimeout(() => setPesanNotif(null), 4000);
    await refetchRiwayat();
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium">Memuat data target tabungan...</span>
      </div>
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);

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
              pesanNotif.tipe === 'sukses'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <span>{pesanNotif.teks}</span>
            <button
              onClick={() => setPesanNotif(null)}
              className="ml-2 text-slate-400 hover:text-slate-600 text-sm"
            >
              &times;
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ringkasan Kartu Atas (Aksen Selaras dengan Menu Hutang & Cicilan) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="bg-gradient-to-br from-teal-50 to-white rounded-2xl p-3.5 border border-teal-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider">
              Total Target Tabungan
            </span>
            <Target size={14} className="text-teal-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-800 mt-1">{rp(stats.totalTarget)}</div>
          <div className="text-[10px] text-slate-400 mt-1">{stats.totalTargetCount} target impian terdaftar</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-3.5 border border-emerald-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
              Total Dana Terkumpul
            </span>
            <PiggyBank size={14} className="text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-emerald-700 mt-1">
            {rp(stats.totalTerkumpul)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {stats.countTercapai} target telah 100% tercapai
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl p-3.5 border border-amber-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
              Sisa Dana Diperlukan
            </span>
            <Clock size={14} className="text-amber-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-amber-800 mt-1">
            {rp(stats.totalKurang)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">
            {stats.countAktif} target sedang berjalan {stats.countTerlambat > 0 && `(${stats.countTerlambat} lewat tenggat)`}
          </div>
        </div>
      </div>

      {/* Toolbar Filter & Kontrol Aksi */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Pencarian */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari target tabungan, rekening, keterangan..."
              value={cariTeks}
              onChange={(e) => setCariTeks(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
            {cariTeks && (
              <button
                onClick={() => setCariTeks('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                &times;
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Fitur Sembunyikan yang Sudah Tercapai */}
            <button
              onClick={() => setSembunyikanTercapai((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                sembunyikanTercapai
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="Sembunyikan atau tampilkan target yang sudah 100% tercapai"
            >
              {sembunyikanTercapai ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>Sembunyikan yang Tercapai</span>
              {sembunyikanTercapai && (
                <span className="bg-emerald-200/70 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  Aktif
                </span>
              )}
            </button>

            {/* Tombol Buat Target Baru */}
            <button
              onClick={() => setModalBaru(true)}
              className="flex items-center gap-1 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
            >
              <Plus size={14} />
              <span>Target Tabungan</span>
            </button>
          </div>
        </div>

        {/* Filter Baris Status */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Status Target:</span>
            <div className="flex gap-1">
              {(['semua', 'aktif', 'tercapai'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition ${
                    filterStatus === st
                      ? 'bg-emerald-100 text-emerald-800 font-semibold'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {st === 'semua' ? 'Semua Target' : st === 'aktif' ? 'Sedang Berjalan' : 'Sudah Tercapai'}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            Menampilkan <span className="font-bold text-slate-600">{daftarTampil.length}</span> dari {tabungan.length} target
          </div>
        </div>
      </div>

      {/* Petunjuk Penggunaan Singkat */}
      <p className="text-[11px] text-slate-400 px-1">
        Target Tabungan mengalokasikan saldo dari rekening Anda ke rekening khusus penampung tabungan. Saldo
        total workspace Anda tetap utuh.
      </p>

      {/* Daftar Kartu Target Tabungan */}
      <div className="space-y-3">
        {daftarTampil.map((t) => {
          const terkumpul = t.deposits.reduce((acc, d) => acc + d.nominal, 0);
          const sisa = Math.max(0, t.targetNominal - terkumpul);
          const persen = t.targetNominal > 0 ? Math.min(Math.round((terkumpul / t.targetNominal) * 100), 100) : 100;
          const isTercapai = t.targetNominal > 0 && terkumpul >= t.targetNominal;
          const isLewatTenggat = !isTercapai && t.tenggat && t.tenggat < todayIso;
          const isOpen = !!riwayatTerbuka[t.id];

          return (
            <div
              key={t.id}
              className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-sm transition-all overflow-hidden"
            >
              {/* Header Kartu */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                        isTercapai
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                          : isLewatTenggat
                          ? 'bg-rose-50 border-rose-100 text-rose-600'
                          : 'bg-teal-50 border-teal-100 text-teal-600'
                      }`}
                    >
                      <PiggyBank size={20} />
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">
                        {t.keterangan}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-400 mt-1">
                        {t.tenggat ? (
                          <span className="flex items-center gap-1 text-[11px] text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                            <Calendar size={11} className="text-slate-500" />
                            <span>Tenggat: {formatTanggalIndo(t.tenggat)}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Tanpa tenggat waktu</span>
                        )}
                        <span>&bull;</span>
                        <span className="text-[11px] text-slate-500">{t.deposits.length} kali nabung</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge & Tombol Hapus */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        isTercapai
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isLewatTenggat
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-teal-50 text-teal-700 border border-teal-200'
                      }`}
                    >
                      {isTercapai ? (
                        <CheckCircle2 size={13} className="text-emerald-600" />
                      ) : isLewatTenggat ? (
                        <AlertCircle size={13} className="text-rose-600" />
                      ) : (
                        <Clock size={13} className="text-teal-600" />
                      )}
                      <span>{isTercapai ? 'Tercapai' : isLewatTenggat ? 'Lewat Tenggat' : 'Sedang Berjalan'}</span>
                    </span>

                    <button
                      onClick={() => hapusTarget(t.id, t.keterangan)}
                      className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Hapus target tabungan ini"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3.5 space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-600 font-semibold">{persen}% Terkumpul</span>
                    <span className="text-slate-400">
                      {isTercapai ? 'Target tercapai 100%' : `Kurang ${rp(sisa)} lagi`}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isTercapai
                          ? 'bg-emerald-500'
                          : isLewatTenggat
                          ? 'bg-rose-500'
                          : 'bg-teal-600'
                      }`}
                      style={{ width: `${persen}%` }}
                    />
                  </div>
                </div>

                {/* 3 Kolom Nilai Finansial (Sama dengan Aksen Hutang & Cicilan) */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50/80 rounded-xl p-3 border border-slate-100 mt-3 text-center sm:text-left">
                  <div>
                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                      Target Nominal
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5">{rp(t.targetNominal)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">
                      Sudah Ditabung
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-emerald-700 mt-0.5">{rp(terkumpul)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-amber-600 font-medium uppercase tracking-wider">
                      Sisa Kekurangan
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-amber-700 mt-0.5">{rp(sisa)}</div>
                  </div>
                </div>

                {/* Baris Tombol Aksi */}
                <div className="flex items-center justify-between gap-2 mt-3.5 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => bukaModalNabung(t)}
                      className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-xl shadow-xs transition"
                    >
                      <Plus size={14} />
                      <span>Nabung</span>
                    </button>

                    <button
                      onClick={() => lihatDiTransaksi(t.keterangan)}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition"
                      title="Lihat transaksi tabungan ini di menu Transaksi"
                    >
                      <ExternalLink size={13} />
                      <span className="hidden sm:inline">Lihat di Transaksi</span>
                    </button>
                  </div>

                  {/* Tombol Accordion Riwayat Setoran */}
                  <button
                    onClick={() => toggleRiwayat(t.id)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition"
                  >
                    <span>{t.deposits.length} Setoran</span>
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Accordion Riwayat Setoran */}
              {isOpen && (
                <div className="bg-slate-50/70 border-t border-slate-100 p-3 sm:p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 pb-1">
                    <span className="flex items-center gap-1.5">
                      <Receipt size={14} className="text-slate-400" />
                      <span>Rincian Setoran Masuk</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Total {t.deposits.length} kali penambahan saldo
                    </span>
                  </div>

                  {t.deposits.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">
                      Belum ada setoran dana untuk target tabungan ini. Klik tombol &quot;Nabung&quot; untuk mulai menabung.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {t.deposits.map((d) => (
                        <div
                          key={d.id}
                          className="bg-white rounded-xl border border-slate-200/80 p-2.5 flex items-center justify-between gap-3 text-xs shadow-2xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">{formatTanggalIndo(d.tanggal)}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-md">
                                Dari: {d.rekening}
                              </span>
                            </div>
                            {d.keterangan && (
                              <div className="text-[11px] text-slate-400 mt-0.5 truncate">{d.keterangan}</div>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="font-bold text-emerald-700 text-xs sm:text-sm">
                              +{rp(d.nominal)}
                            </span>
                            <button
                              onClick={() => hapusIsi(d.id, t.keterangan)}
                              className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Hapus setoran ini (saldo rekening asal akan dikembalikan)"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {daftarTampil.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center space-y-2 shadow-xs">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <PiggyBank size={24} />
            </div>
            <div className="text-sm font-semibold text-slate-700">Tidak ada target tabungan</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {cariTeks || filterStatus !== 'semua' || sembunyikanTercapai
                ? 'Tidak ada target yang cocok dengan filter atau pencarian Anda.'
                : 'Mulai wujudkan rencana keuangan Anda dengan membuat target tabungan baru sekarang.'}
            </p>
            {(!cariTeks && filterStatus === 'semua' && !sembunyikanTercapai) && (
              <button
                onClick={() => setModalBaru(true)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3.5 py-2 rounded-xl shadow-xs transition"
              >
                <Plus size={14} />
                <span>Buat Target Tabungan Pertama</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal Target Tabungan Baru */}
      <Modal open={modalBaru} onClose={() => setModalBaru(false)} title="Target Tabungan Baru">
        <div className="space-y-3.5">
          <div>
            <label className="text-[11px] font-semibold text-slate-600">Nama Target Tabungan</label>
            <input
              type="text"
              placeholder="Contoh: Liburan Akhir Tahun, Beli Motor, Dana Darurat"
              value={formBaru.keterangan}
              onChange={(e) => setFormBaru((f) => ({ ...f, keterangan: e.target.value }))}
              className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600">Nominal Target (Rp)</label>
            <input
              type="number"
              placeholder="Contoh: 5000000"
              value={formBaru.nominal}
              onChange={(e) => setFormBaru((f) => ({ ...f, nominal: e.target.value }))}
              className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
            {formBaru.nominal && (
              <div className="text-[11px] font-semibold text-emerald-700 mt-1">
                {rp(parseFloat(formBaru.nominal) || 0)}
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600">
              Tenggat Waktu / Target Tercapai (Opsional)
            </label>
            <input
              type="date"
              value={formBaru.tenggat}
              onChange={(e) => setFormBaru((f) => ({ ...f, tenggat: e.target.value }))}
              className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={submitBaru}
              disabled={busy}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2.5 rounded-xl shadow-xs disabled:opacity-50 transition"
            >
              {busy ? 'Menyimpan Target...' : 'Simpan Target Tabungan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Isi Tabungan (Nabung) */}
      <Modal open={!!targetDipilih} onClose={() => setTargetDipilih(null)} title="Isi Saldo Tabungan">
        {targetDipilih && (
          <div className="space-y-3.5">
            {/* Kartu info singkat target */}
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 text-xs space-y-1">
              <div className="font-semibold text-emerald-900">{targetDipilih.keterangan}</div>
              <div className="text-[11px] text-emerald-700 flex justify-between">
                <span>Target: {rp(targetDipilih.targetNominal)}</span>
                <span>
                  Sisa Kurang:{' '}
                  <strong className="font-bold">
                    {rp(
                      Math.max(
                        0,
                        targetDipilih.targetNominal -
                          targetDipilih.deposits.reduce((acc, d) => acc + d.nominal, 0)
                      )
                    )}
                  </strong>
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600">Tanggal Nabung</label>
              <input
                type="date"
                value={formIsi.tanggal}
                onChange={(e) => setFormIsi((f) => ({ ...f, tanggal: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-semibold text-slate-600">Nominal Setoran (Rp)</label>
                {/* Tombol Isi Penuh Sisa */}
                {(() => {
                  const sisa = Math.max(
                    0,
                    targetDipilih.targetNominal -
                      targetDipilih.deposits.reduce((acc, d) => acc + d.nominal, 0)
                  );
                  if (sisa > 0) {
                    return (
                      <button
                        type="button"
                        onClick={() => setFormIsi((f) => ({ ...f, nominal: String(sisa) }))}
                        className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer"
                      >
                        Set Sisa Penuh ({rp(sisa)})
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>

              <input
                type="number"
                placeholder="0"
                value={formIsi.nominal}
                onChange={(e) => setFormIsi((f) => ({ ...f, nominal: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
              {formIsi.nominal && (
                <div className="text-[11px] font-semibold text-emerald-700 mt-1">
                  {rp(parseFloat(formIsi.nominal) || 0)}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600">Diambil Dari Rekening</label>
              <select
                value={formIsi.rekening}
                onChange={(e) => setFormIsi((f) => ({ ...f, rekening: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              >
                {init.rekenings.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600">Catatan / Keterangan (Opsional)</label>
              <input
                type="text"
                placeholder="Contoh: Nabung dari sisa belanja mingguan"
                value={formIsi.keterangan}
                onChange={(e) => setFormIsi((f) => ({ ...f, keterangan: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={submitIsi}
                disabled={busy}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2.5 rounded-xl shadow-xs disabled:opacity-50 transition"
              >
                {busy ? 'Menyimpan Setoran...' : 'Simpan Setoran Tabungan'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}