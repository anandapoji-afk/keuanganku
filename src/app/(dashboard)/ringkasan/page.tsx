'use client';

import { useMemo } from 'react';
import { useAppData } from '@/components/layout/AppDataProvider';
import { rp } from '@/lib/utils';

export default function RingkasanPage() {
  const { loading, init, transaksi } = useAppData();

  const { totalSaldo, bulanIniMasuk, bulanIniKeluar } = useMemo(() => {
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

    return { totalSaldo, bulanIniMasuk, bulanIniKeluar };
  }, [transaksi, init.rekenings]);

  if (loading) return <div className="text-sm text-slate-400 py-10 text-center">Memuat data...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-sky-600 to-sky-500 text-white rounded-2xl p-5 shadow-sm">
        <div className="text-xs text-sky-100">Total Saldo — {init.active}</div>
        <div className="text-2xl font-bold mt-1">{rp(totalSaldo)}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5">
          <div className="text-[11px] text-slate-400">Pemasukan Bulan Ini</div>
          <div className="text-emerald-600 font-bold text-sm mt-1">{rp(bulanIniMasuk)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5">
          <div className="text-[11px] text-slate-400">Pengeluaran Bulan Ini</div>
          <div className="text-red-600 font-bold text-sm mt-1">{rp(bulanIniKeluar)}</div>
        </div>
      </div>

    </div>
  );
}