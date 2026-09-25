'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  ArrowLeftRight,
  PieChart,
  PlusCircle,
  Receipt,
  PiggyBank,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useAppData } from '@/components/layout/AppDataProvider';
import { rp, formatTanggalIndo } from '@/lib/utils';

export default function RingkasanPage() {
  const { loading, init, transaksi } = useAppData();

  const { totalSaldo, bulanIniMasuk, bulanIniKeluar, riwayatTerbaru } = useMemo(() => {
    const saldoPerRekening: Record<string, number> = {};
    init.rekenings.forEach((r) => (saldoPerRekening[r] = 0));

    transaksi.forEach((t) => {
      if (t.tipe === 'Pemasukan' && t.rekening === 'TABUNGAN') return;
      if (!(t.rekening in saldoPerRekening)) saldoPerRekening[t.rekening] = 0;
      saldoPerRekening[t.rekening] += t.tipe === 'Pemasukan' ? t.nominal : -t.nominal;
    });

    const totalSaldo = Object.values(saldoPerRekening).reduce((a, b) => a + b, 0);

    const now = new Date();
    const bulanIni = now.getMonth();
    const tahunIni = now.getFullYear();
    let bulanIniMasuk = 0;
    let bulanIniKeluar = 0;
    transaksi.forEach((t) => {
      const tgl = new Date(t.tanggal);
      if (tgl.getMonth() !== bulanIni || tgl.getFullYear() !== tahunIni) return;
      if (['Transfer', 'Tabungan'].includes(t.kategori)) return;
      if (t.tipe === 'Pemasukan') bulanIniMasuk += t.nominal;
      else bulanIniKeluar += t.nominal;
    });

    const riwayatTerbaru = [...transaksi]
      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
      .slice(0, 5);

    return { totalSaldo, bulanIniMasuk, bulanIniKeluar, riwayatTerbaru };
  }, [transaksi, init.rekenings]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-xs font-medium text-slate-400">Memuat data keuangan...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero Card Total Saldo */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative overflow-hidden bg-gradient-to-br from-sky-600 via-sky-700 to-indigo-800 text-white rounded-2xl p-5 shadow-lg shadow-sky-900/10 border border-sky-500/20"
      >
        <div className="absolute right-0 top-0 -mt-6 -mr-6 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-sky-200 font-medium">
              <Wallet size={14} className="stroke-[2.2]" />
              <span>Total Saldo · {init.active}</span>
            </div>
            <div className="text-3xl font-extrabold tracking-tight mt-1.5">{rp(totalSaldo)}</div>
          </div>
          <Link
            href="/rekening"
            className="text-[11px] bg-white/15 hover:bg-white/25 active:scale-95 text-white px-2.5 py-1 rounded-lg backdrop-blur-sm transition border border-white/20"
          >
            Lihat Rekening
          </Link>
        </div>

        {/* Quick actions inside card */}
        <div className="relative z-10 grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-white/15">
          <Link
            href="/transaksi"
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 active:scale-95 px-3 py-2 rounded-xl transition text-xs font-semibold backdrop-blur-sm"
          >
            <PlusCircle size={16} className="text-sky-200" />
            <span>+ Catat Transaksi</span>
          </Link>
          <Link
            href="/laporan"
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 active:scale-95 px-3 py-2 rounded-xl transition text-xs font-semibold backdrop-blur-sm justify-between"
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-300" />
              <span>Laporan Arus Kas</span>
            </div>
            <ChevronRight size={13} className="text-white/60" />
          </Link>
        </div>
      </motion.div>

      {/* Cashflow Metric Cards */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pemasukan Bulan Ini</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft size={16} strokeWidth={2.4} />
            </div>
          </div>
          <div className="text-emerald-600 font-bold text-base sm:text-lg mt-2 tracking-tight">
            {rp(bulanIniMasuk)}
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pengeluaran Bulan Ini</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight size={16} strokeWidth={2.4} />
            </div>
          </div>
          <div className="text-rose-600 font-bold text-base sm:text-lg mt-2 tracking-tight">
            {rp(bulanIniKeluar)}
          </div>
        </motion.div>
      </div>

      {/* Quick Access Menu Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Menu Cepat</div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { href: '/transaksi', label: 'Transaksi', icon: ArrowLeftRight, color: 'text-sky-600 bg-sky-50' },
            { href: '/anggaran', label: 'Anggaran', icon: PieChart, color: 'text-indigo-600 bg-indigo-50' },
            { href: '/tabungan', label: 'Tabungan', icon: PiggyBank, color: 'text-amber-600 bg-amber-50' },
            { href: '/rekening', label: 'Rekening', icon: Wallet, color: 'text-emerald-600 bg-emerald-50' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-50 active:scale-90 transition group text-center"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${item.color} shadow-sm group-hover:scale-105 transition-transform`}>
                  <Icon size={20} strokeWidth={2} />
                </div>
                <span className="text-[11px] font-medium text-slate-600 mt-1.5 group-hover:text-slate-900">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Transaksi Terkini */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Receipt size={14} className="text-slate-400" />
            <span>Transaksi Terkini</span>
          </div>
          <Link
            href="/transaksi"
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-0.5 active:translate-x-0.5 transition"
          >
            <span>Semua</span>
            <ChevronRight size={13} />
          </Link>
        </div>

        {riwayatTerbaru.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">Belum ada data transaksi tercatat.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {riwayatTerbaru.map((t) => (
              <div key={t.id} className="py-2.5 flex items-center justify-between gap-3 group">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 truncate group-hover:text-sky-600 transition-colors">
                    {t.keterangan || t.kategori}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span>{formatTanggalIndo(t.tanggal)}</span>
                    <span>·</span>
                    <span className="bg-slate-100 px-1.5 py-0.2 rounded text-slate-600 font-medium">
                      {t.rekening}
                    </span>
                  </div>
                </div>
                <div
                  className={`text-xs font-bold whitespace-nowrap ${
                    t.tipe === 'Pemasukan' ? 'text-emerald-600' : 'text-slate-700'
                  }`}
                >
                  {t.tipe === 'Pemasukan' ? '+' : '-'} {rp(t.nominal)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
