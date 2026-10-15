'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet,
  ArrowRightLeft,
  Building2,
  Smartphone,
  Banknote,
  PiggyBank,
  CreditCard,
  Plus,
  Search,
  ExternalLink,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Receipt,
  Layers,
} from 'lucide-react';
import { useAppData } from '@/components/layout/AppDataProvider';
import Modal from '@/components/ui/Modal';
import { rp, formatTanggalIndo } from '@/lib/utils';
import { transferSaldo, editTransferSaldo, hapusTransferSaldo } from '@/lib/actions/transfer';
import type { Transaction } from '@/lib/types';

// Helper icon berdasarkan nama rekening
function getRekeningIcon(nama: string) {
  const n = nama.toUpperCase();
  if (n.includes('TABUNGAN')) return <PiggyBank size={20} />;
  if (n.includes('CASH') || n.includes('DOMPET') || n.includes('TUNAI') || n.includes('KAS'))
    return <Banknote size={20} />;
  if (
    n.includes('BCA') ||
    n.includes('MANDIRI') ||
    n.includes('BRI') ||
    n.includes('BNI') ||
    n.includes('BANK') ||
    n.includes('JAGO') ||
    n.includes('BSI') ||
    n.includes('CIMB')
  )
    return <Building2 size={20} />;
  if (
    n.includes('GOPAY') ||
    n.includes('OVO') ||
    n.includes('DANA') ||
    n.includes('SHOPEE') ||
    n.includes('LINKAJA') ||
    n.includes('QRIS')
  )
    return <Smartphone size={20} />;
  return <CreditCard size={20} />;
}

interface TransferItemView {
  id: string;
  tanggal: string;
  jam?: string;
  dari: string;
  ke: string;
  nominal: number;
  keterangan: string;
  rawTx: Transaction;
}

export default function RekeningPage() {
  const router = useRouter();
  const { loading, init, transaksi, setFilter, refetchRiwayat } = useAppData();

  // Tab utama: Daftar Rekening vs Riwayat Transfer (aksen selaras dengan DP vs HP)
  const [tab, setTab] = useState<'rekening' | 'transfer'>('rekening');

  // Kontrol & Filter
  const [cariTeks, setCariTeks] = useState('');
  const [filterSaldo, setFilterSaldo] = useState<'semua' | 'positif' | 'nolMinus'>('semua');
  const [sembunyikanNol, setSembunyikanNol] = useState(false);

  // Modals
  const [modalTransfer, setModalTransfer] = useState(false);
  const [modalEditTransfer, setModalEditTransfer] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [form, setForm] = useState({
    tanggal: new Date().toISOString().slice(0, 10),
    dari: '',
    ke: '',
    nominal: '',
    keterangan: '',
  });

  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pesanNotif, setPesanNotif] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null);

  // Perhitungan saldo & arus kas per rekening
  const dataPerRekening = useMemo(() => {
    const map: Record<
      string,
      { saldo: number; masuk: number; keluar: number; count: number }
    > = {};

    init.rekenings.forEach((r) => {
      map[r] = { saldo: 0, masuk: 0, keluar: 0, count: 0 };
    });

    transaksi.forEach((t) => {
      if (t.tipe === 'Pemasukan' && t.rekening === 'TABUNGAN') return;
      if (!(t.rekening in map)) {
        map[t.rekening] = { saldo: 0, masuk: 0, keluar: 0, count: 0 };
      }
      map[t.rekening].count += 1;
      if (t.tipe === 'Pemasukan') {
        map[t.rekening].saldo += t.nominal;
        map[t.rekening].masuk += t.nominal;
      } else {
        map[t.rekening].saldo -= t.nominal;
        map[t.rekening].keluar += t.nominal;
      }
    });

    return map;
  }, [init.rekenings, transaksi]);

  // Statistik Ringkasan Atas
  const statsRekening = useMemo(() => {
    let totalSaldoSemua = 0;
    let rekTeraktifNama = '-';
    let rekTeraktifCount = 0;

    Object.entries(dataPerRekening).forEach(([nama, d]) => {
      totalSaldoSemua += d.saldo;
      if (d.count > rekTeraktifCount) {
        rekTeraktifCount = d.count;
        rekTeraktifNama = nama;
      }
    });

    // Volume transfer
    const txTransfer = transaksi.filter((t) => t.kategori === 'Transfer' && t.tipe === 'Pengeluaran');
    const totalVolumeTransfer = txTransfer.reduce((acc, t) => acc + t.nominal, 0);

    return {
      totalSaldoSemua,
      totalAkun: init.rekenings.length,
      rekTeraktifNama,
      rekTeraktifCount,
      totalVolumeTransfer,
      countTransfer: txTransfer.length,
    };
  }, [dataPerRekening, init.rekenings, transaksi]);

  // Daftar transfer yang dinormalisasi (menampilkan 1 baris per kejadian transfer dari Pengeluaran)
  const daftarTransfer = useMemo<TransferItemView[]>(() => {
    const rawTransfers = transaksi
      .filter((t) => t.kategori === 'Transfer')
      .slice()
      .sort((a, b) => {
        const aTime = new Date(`${a.tanggal}T${a.jam || '00:00'}:00`).getTime();
        const bTime = new Date(`${b.tanggal}T${b.jam || '00:00'}:00`).getTime();
        return bTime - aTime;
      });

    const pengeluaranList = rawTransfers.filter((t) => t.tipe === 'Pengeluaran');
    const pemasukanList = rawTransfers.filter((t) => t.tipe === 'Pemasukan');

    const result: TransferItemView[] = [];
    const usedPemasukanIds = new Set<string>();

    pengeluaranList.forEach((outTx) => {
      // Cari pasangan pemasukan
      const inTx = pemasukanList.find(
        (p) =>
          !usedPemasukanIds.has(p.id) &&
          p.tanggal === outTx.tanggal &&
          p.nominal === outTx.nominal &&
          p.rekening !== outTx.rekening
      );

      if (inTx) {
        usedPemasukanIds.add(inTx.id);
      }

      // Deteksi rekening tujuan dari pasangan atau keterangan
      let tujuan = inTx?.rekening || '';
      if (!tujuan) {
        const match = (outTx.keterangan || '').match(/→|->|ke\s+([A-Za-z0-9_-]+)/i);
        if (match) {
          const parts = outTx.keterangan.split(/→|->/);
          if (parts[1]) tujuan = parts[1].trim();
        }
      }

      result.push({
        id: outTx.id,
        tanggal: outTx.tanggal,
        jam: outTx.jam,
        dari: outTx.rekening,
        ke: tujuan || 'Tujuan',
        nominal: outTx.nominal,
        keterangan: outTx.keterangan,
        rawTx: outTx,
      });
    });

    // Handle jika ada pemasukan tanpa pasangan pengeluaran
    pemasukanList.forEach((inTx) => {
      if (!usedPemasukanIds.has(inTx.id)) {
        result.push({
          id: inTx.id,
          tanggal: inTx.tanggal,
          jam: inTx.jam,
          dari: 'Asal',
          ke: inTx.rekening,
          nominal: inTx.nominal,
          keterangan: inTx.keterangan,
          rawTx: inTx,
        });
      }
    });

    return result;
  }, [transaksi]);

  // Filter daftar rekening yang tampil
  const rekeningTampil = useMemo(() => {
    return Object.entries(dataPerRekening).filter(([nama, d]) => {
      if (sembunyikanNol && d.saldo === 0) return false;
      if (filterSaldo === 'positif' && d.saldo <= 0) return false;
      if (filterSaldo === 'nolMinus' && d.saldo > 0) return false;

      if (cariTeks.trim()) {
        const q = cariTeks.toLowerCase();
        if (!nama.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [dataPerRekening, sembunyikanNol, filterSaldo, cariTeks]);

  // Filter daftar transfer yang tampil
  const transferTampil = useMemo(() => {
    return daftarTransfer.filter((t) => {
      if (cariTeks.trim()) {
        const q = cariTeks.toLowerCase();
        const cocok =
          t.dari.toLowerCase().includes(q) ||
          t.ke.toLowerCase().includes(q) ||
          t.keterangan.toLowerCase().includes(q) ||
          t.tanggal.includes(q);
        if (!cocok) return false;
      }
      return true;
    });
  }, [daftarTransfer, cariTeks]);

  function bukaTransferBaru(dariRek?: string) {
    const defaultDari = dariRek || init.rekenings[0] || 'CASH';
    const defaultKe = init.rekenings.find((r) => r !== defaultDari) || init.rekenings[1] || '';
    setForm({
      tanggal: new Date().toISOString().slice(0, 10),
      dari: defaultDari,
      ke: defaultKe,
      nominal: '',
      keterangan: '',
    });
    setErrMsg(null);
    setModalTransfer(true);
  }

  function lihatDiTransaksiRekening(rek: string) {
    setFilter((prev) => ({
      ...prev,
      search: '',
      rekening: rek,
      tipe: 'Semua',
    }));
    router.push('/transaksi');
  }

  async function submitTransfer() {
    setBusy(true);
    setErrMsg(null);
    const nominal = parseFloat(form.nominal) || 0;
    if (nominal <= 0) {
      setErrMsg('Masukkan nominal transfer yang valid!');
      setBusy(false);
      return;
    }
    if (form.dari === form.ke) {
      setErrMsg('Rekening asal dan tujuan tidak boleh sama!');
      setBusy(false);
      return;
    }

    const res = await transferSaldo({
      workspace: init.active,
      tanggal: form.tanggal,
      dari: form.dari,
      ke: form.ke,
      nominal,
      keterangan: form.keterangan.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) {
      setErrMsg(res.error);
      return;
    }
    setModalTransfer(false);
    setPesanNotif({
      tipe: 'sukses',
      teks: `Transfer sebesar ${rp(nominal)} dari ${form.dari} ke ${form.ke} berhasil disimpan!`,
    });
    setTimeout(() => setPesanNotif(null), 4000);
    await refetchRiwayat();
  }

  async function submitEditTransfer() {
    if (!editId) return;
    setBusy(true);
    setErrMsg(null);
    const nominal = parseFloat(form.nominal) || 0;
    if (nominal <= 0) {
      setErrMsg('Masukkan nominal transfer yang valid!');
      setBusy(false);
      return;
    }
    if (form.dari === form.ke) {
      setErrMsg('Rekening asal dan tujuan tidak boleh sama!');
      setBusy(false);
      return;
    }

    const res = await editTransferSaldo({
      workspace: init.active,
      id: editId,
      tanggal: form.tanggal,
      dari: form.dari,
      ke: form.ke,
      nominal,
      keterangan: form.keterangan.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) {
      setErrMsg(res.error);
      return;
    }
    setModalEditTransfer(false);
    setEditId(null);
    setPesanNotif({ tipe: 'sukses', teks: 'Perubahan data transfer berhasil disimpan!' });
    setTimeout(() => setPesanNotif(null), 4000);
    await refetchRiwayat();
  }

  async function hapusTransfer(id: string, nominal: number, dari: string, ke: string) {
    if (!confirm(`Hapus catatan transfer sebesar ${rp(nominal)} dari ${dari} ke ${ke}? Saldo kedua rekening akan disesuaikan kembali.`))
      return;
    setBusy(true);
    const res = await hapusTransferSaldo({ workspace: init.active, id });
    setBusy(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    setPesanNotif({ tipe: 'sukses', teks: 'Catatan transfer berhasil dihapus dan saldo disesuaikan.' });
    setTimeout(() => setPesanNotif(null), 4000);
    await refetchRiwayat();
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium">Memuat data rekening dan saldo...</span>
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

      {/* Tab Navigasi Utama (Aksen Selaras dengan Menu Hutang & Cicilan) */}
      <div className="bg-slate-100/80 p-1 rounded-2xl flex gap-1 border border-slate-200/60 shadow-sm">
        <button
          onClick={() => setTab('rekening')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            tab === 'rekening'
              ? 'bg-white text-teal-700 shadow-sm border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <Wallet size={16} className={tab === 'rekening' ? 'text-teal-600' : 'text-slate-400'} />
          <span>Daftar Rekening &amp; Saldo</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              tab === 'rekening' ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {init.rekenings.length} akun
          </span>
        </button>

        <button
          onClick={() => setTab('transfer')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            tab === 'transfer'
              ? 'bg-white text-violet-700 shadow-sm border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <ArrowRightLeft size={16} className={tab === 'transfer' ? 'text-violet-600' : 'text-slate-400'} />
          <span>Riwayat Transfer Saldo</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              tab === 'transfer' ? 'bg-violet-100 text-violet-700' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {statsRekening.countTransfer} kali
          </span>
        </button>
      </div>

      {/* Ringkasan Kartu Atas (3 Kolom Berwarna Selaras dengan DP/Hutang/Tabungan) */}
      {tab === 'rekening' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-3.5 border border-emerald-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                Total Saldo Kas &amp; Bank
              </span>
              <Wallet size={14} className="text-emerald-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-slate-800 mt-1">
              {rp(statsRekening.totalSaldoSemua)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Akumulasi dari {statsRekening.totalAkun} rekening aktif
            </div>
          </div>

          <div className="bg-gradient-to-br from-teal-50 to-white rounded-2xl p-3.5 border border-teal-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider">
                Rekening Teraktif
              </span>
              <TrendingUp size={14} className="text-teal-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-slate-800 mt-1">
              {statsRekening.rekTeraktifNama}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {statsRekening.rekTeraktifCount} transaksi tercatat pada rekening ini
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-white rounded-2xl p-3.5 border border-violet-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wider">
                Volume Transfer Saldo
              </span>
              <ArrowRightLeft size={14} className="text-violet-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-violet-700 mt-1">
              {rp(statsRekening.totalVolumeTransfer)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {statsRekening.countTransfer} kali transfer antar rekening
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="bg-gradient-to-br from-violet-50 to-white rounded-2xl p-3.5 border border-violet-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wider">
                Total Nominal Ditransfer
              </span>
              <ArrowRightLeft size={14} className="text-violet-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-violet-700 mt-1">
              {rp(statsRekening.totalVolumeTransfer)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Total arus pergeseran likuiditas</div>
          </div>

          <div className="bg-gradient-to-br from-teal-50 to-white rounded-2xl p-3.5 border border-teal-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider">
                Frekuensi Pemindahan
              </span>
              <Receipt size={14} className="text-teal-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-slate-800 mt-1">
              {daftarTransfer.length} Kali
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Transaksi transfer tercatat</div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-3.5 border border-emerald-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                Rata-rata Nominal
              </span>
              <Wallet size={14} className="text-emerald-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-emerald-700 mt-1">
              {rp(daftarTransfer.length > 0 ? statsRekening.totalVolumeTransfer / daftarTransfer.length : 0)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Rata-rata setiap perputaran dana</div>
          </div>
        </div>
      )}

      {/* Toolbar Filter & Kontrol Aksi */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Pencarian */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={
                tab === 'rekening'
                  ? 'Cari nama rekening kas/bank...'
                  : 'Cari rekening asal, tujuan, atau keterangan transfer...'
              }
              value={cariTeks}
              onChange={(e) => setCariTeks(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
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
            {/* Toggle Sembunyikan Saldo Nol di tab Rekening */}
            {tab === 'rekening' && (
              <button
                onClick={() => setSembunyikanNol((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                  sembunyikanNol
                    ? 'bg-teal-50 border-teal-300 text-teal-700 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                title="Sembunyikan atau tampilkan rekening dengan saldo nol"
              >
                {sembunyikanNol ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>Sembunyikan Saldo Rp 0</span>
                {sembunyikanNol && (
                  <span className="bg-teal-200/70 text-teal-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                    Aktif
                  </span>
                )}
              </button>
            )}

            {/* Tombol Transfer Saldo */}
            <button
              onClick={() => bukaTransferBaru()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
            >
              <ArrowRightLeft size={14} />
              <span>Transfer Saldo</span>
            </button>
          </div>
        </div>

        {/* Filter Baris Status untuk Tab Rekening */}
        {tab === 'rekening' && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Status Saldo:</span>
              <div className="flex gap-1">
                {(['semua', 'positif', 'nolMinus'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterSaldo(st)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition ${
                      filterSaldo === st
                        ? 'bg-teal-100 text-teal-800 font-semibold'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {st === 'semua'
                      ? 'Semua Rekening'
                      : st === 'positif'
                      ? 'Saldo Positif'
                      : 'Saldo Nol / Minus'}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-slate-400">
              Menampilkan <span className="font-bold text-slate-600">{rekeningTampil.length}</span> dari {init.rekenings.length} rekening
            </div>
          </div>
        )}
      </div>

      {/* ===== KONTEN TAB DAFTAR REKENING ===== */}
      {tab === 'rekening' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-400 px-1">
            Saldo dihitung secara otomatis dari total pemasukan dikurangi pengeluaran untuk setiap rekening.
            Gunakan tombol Transfer Saldo untuk memindahkan dana tanpa memengaruhi total kas keseluruhan.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rekeningTampil.map(([nama, data]) => {
              const isPositif = data.saldo > 0;
              const isNol = data.saldo === 0;
              const isMinus = data.saldo < 0;

              return (
                <div
                  key={nama}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-sm transition-all overflow-hidden flex flex-col justify-between"
                >
                  <div className="p-4">
                    {/* Header Rekening */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                            isMinus
                              ? 'bg-rose-50 border-rose-100 text-rose-600'
                              : nama.toUpperCase() === 'TABUNGAN'
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                              : 'bg-teal-50 border-teal-100 text-teal-600'
                          }`}
                        >
                          {getRekeningIcon(nama)}
                        </div>

                        <div>
                          <h3 className="font-bold text-slate-800 text-base leading-tight">
                            {nama}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                            <span>{data.count} transaksi</span>
                            <span>&bull;</span>
                            <span className="text-[11px]">
                              {nama.toUpperCase() === 'TABUNGAN' ? 'Rekening Penampung' : 'Rekening Kas/Bank'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isPositif
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isMinus
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {isPositif ? (
                          <CheckCircle2 size={13} className="text-emerald-600" />
                        ) : isMinus ? (
                          <AlertCircle size={13} className="text-rose-600" />
                        ) : (
                          <Clock size={13} className="text-slate-400" />
                        )}
                        <span>{isPositif ? 'Aktif' : isMinus ? 'Minus' : 'Saldo Rp 0'}</span>
                      </span>
                    </div>

                    {/* Saldo Nominal Besar */}
                    <div className="mt-3.5">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Saldo Saat Ini
                      </div>
                      <div
                        className={`text-xl sm:text-2xl font-black mt-0.5 tracking-tight ${
                          isMinus ? 'text-rose-600' : 'text-slate-800'
                        }`}
                      >
                        {rp(data.saldo)}
                      </div>
                    </div>

                    {/* 3 Kolom Metrik Finansial Akun (Sama dengan Aksen Hutang/Cicilan) */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50/80 rounded-xl p-3 border border-slate-100 mt-3 text-center sm:text-left">
                      <div>
                        <div className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1">
                          <TrendingUp size={11} />
                          <span>Pemasukan</span>
                        </div>
                        <div className="text-xs font-bold text-emerald-700 mt-0.5">{rp(data.masuk)}</div>
                      </div>

                      <div>
                        <div className="text-[10px] text-rose-600 font-medium uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1">
                          <TrendingDown size={11} />
                          <span>Pengeluaran</span>
                        </div>
                        <div className="text-xs font-bold text-rose-700 mt-0.5">{rp(data.keluar)}</div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                          Aktivitas
                        </div>
                        <div className="text-xs font-bold text-slate-700 mt-0.5">{data.count} Transaksi</div>
                      </div>
                    </div>
                  </div>

                  {/* Baris Tombol Aksi Bawah */}
                  <div className="flex items-center justify-between gap-2 px-4 py-3 bg-slate-50/40 border-t border-slate-100">
                    <button
                      onClick={() => bukaTransferBaru(nama)}
                      className="inline-flex items-center gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold px-3 py-1.5 rounded-xl shadow-xs transition"
                    >
                      <ArrowRightLeft size={13} />
                      <span>Transfer dari Sini</span>
                    </button>

                    <button
                      onClick={() => lihatDiTransaksiRekening(nama)}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition"
                      title="Lihat seluruh riwayat mutasi rekening ini di menu Transaksi"
                    >
                      <ExternalLink size={13} />
                      <span>Lihat di Transaksi</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {rekeningTampil.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center space-y-2 shadow-xs">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                <Wallet size={24} />
              </div>
              <div className="text-sm font-semibold text-slate-700">Tidak ada rekening ditemukan</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Tidak ada rekening yang sesuai dengan kata kunci pencarian atau filter yang dipilih.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===== KONTEN TAB RIWAYAT TRANSFER ===== */}
      {tab === 'transfer' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-400 px-1">
            Riwayat perpindahan saldo antar rekening kas dan bank. Memindahkan uang antar rekening tidak
            memengaruhi laporan laba/rugi atau ringkasan kekayaan bersih.
          </p>

          <div className="space-y-2.5">
            {transferTampil.map((t) => (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-sm p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 text-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                    <ArrowRightLeft size={18} />
                  </div>

                  <div className="min-w-0">
                    {/* Alur perpindahan rekening */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/80">
                        {t.dari}
                      </span>
                      <ArrowRight size={13} className="text-violet-500" />
                      <span className="font-bold text-slate-700 bg-violet-50 text-violet-800 px-2 py-0.5 rounded-lg border border-violet-200/80">
                        {t.ke}
                      </span>
                      <span className="text-slate-300">&bull;</span>
                      <span className="text-slate-400 text-[11px]">
                        {formatTanggalIndo(t.tanggal)} {t.jam ? `\u00b7 ${t.jam}` : ''}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 font-medium mt-1">
                      {t.keterangan || `Transfer ${t.dari} ke ${t.ke}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <div className="font-bold text-slate-800 text-sm sm:text-base">{rp(t.nominal)}</div>
                    <div className="text-[10px] text-violet-600 font-medium">Mutasi Saldo</div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditId(t.id);
                        setForm({
                          tanggal: t.tanggal,
                          dari: t.dari,
                          ke: t.ke,
                          nominal: String(t.nominal),
                          keterangan: t.keterangan,
                        });
                        setErrMsg(null);
                        setModalEditTransfer(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                      title="Edit transaksi transfer"
                    >
                      <Edit3 size={15} />
                    </button>

                    <button
                      onClick={() => hapusTransfer(t.id, t.nominal, t.dari, t.ke)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Hapus riwayat transfer ini"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {transferTampil.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center space-y-2 shadow-xs">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                  <ArrowRightLeft size={24} />
                </div>
                <div className="text-sm font-semibold text-slate-700">Belum ada riwayat transfer</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {cariTeks
                    ? 'Tidak ditemukan transaksi transfer dengan kata kunci pencarian tersebut.'
                    : 'Pindahkan dana antar rekening kas atau bank Anda kapan saja dengan mudah.'}
                </p>
                {!cariTeks && (
                  <button
                    onClick={() => bukaTransferBaru()}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold px-3.5 py-2 rounded-xl shadow-xs transition"
                  >
                    <ArrowRightLeft size={14} />
                    <span>Lakukan Transfer Pertama</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Transfer Saldo Antar Rekening */}
      <Modal open={modalTransfer} onClose={() => setModalTransfer(false)} title="Transfer Saldo Antar Rekening">
        <div className="space-y-3.5">
          <div>
            <label className="text-[11px] font-semibold text-slate-600">Tanggal Transfer</label>
            <input
              type="date"
              value={form.tanggal}
              onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
              className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600">Dari Rekening Asal</label>
              <select
                value={form.dari}
                onChange={(e) => setForm((f) => ({ ...f, dari: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
              >
                {init.rekenings.map((r) => (
                  <option key={r} value={r}>
                    {r} (Saldo: {rp(dataPerRekening[r]?.saldo || 0)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600">Ke Rekening Tujuan</label>
              <select
                value={form.ke}
                onChange={(e) => setForm((f) => ({ ...f, ke: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
              >
                {init.rekenings.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600">Nominal Transfer (Rp)</label>
            <input
              type="number"
              placeholder="0"
              value={form.nominal}
              onChange={(e) => setForm((f) => ({ ...f, nominal: e.target.value }))}
              className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
            {form.nominal && (
              <div className="text-[11px] font-semibold text-teal-700 mt-1">
                {rp(parseFloat(form.nominal) || 0)}
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600">Keterangan (Opsional)</label>
            <input
              type="text"
              placeholder={`Contoh: Tarik tunai dari ${form.dari} ke ${form.ke}`}
              value={form.keterangan}
              onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))}
              className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
          </div>

          {errMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {errMsg}
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={submitTransfer}
              disabled={busy}
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-semibold py-2.5 rounded-xl shadow-xs disabled:opacity-50 transition"
            >
              {busy ? 'Memproses Transfer...' : 'Kirim / Simpan Transfer'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Edit Transfer Saldo */}
      <Modal
        open={modalEditTransfer}
        onClose={() => {
          setModalEditTransfer(false);
          setEditId(null);
        }}
        title="Edit Data Transfer Saldo"
      >
        <div className="space-y-3.5">
          <div>
            <label className="text-[11px] font-semibold text-slate-600">Tanggal Transfer</label>
            <input
              type="date"
              value={form.tanggal}
              onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
              className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600">Dari Rekening Asal</label>
              <select
                value={form.dari}
                onChange={(e) => setForm((f) => ({ ...f, dari: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
              >
                {init.rekenings.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600">Ke Rekening Tujuan</label>
              <select
                value={form.ke}
                onChange={(e) => setForm((f) => ({ ...f, ke: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
              >
                {init.rekenings.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600">Nominal Transfer (Rp)</label>
            <input
              type="number"
              placeholder="0"
              value={form.nominal}
              onChange={(e) => setForm((f) => ({ ...f, nominal: e.target.value }))}
              className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
            {form.nominal && (
              <div className="text-[11px] font-semibold text-teal-700 mt-1">
                {rp(parseFloat(form.nominal) || 0)}
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600">Keterangan (Opsional)</label>
            <input
              type="text"
              value={form.keterangan}
              onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))}
              className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
          </div>

          {errMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {errMsg}
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={submitEditTransfer}
              disabled={busy}
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-semibold py-2.5 rounded-xl shadow-xs disabled:opacity-50 transition"
            >
              {busy ? 'Menyimpan Perubahan...' : 'Simpan Perubahan Transfer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
