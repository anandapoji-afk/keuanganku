'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppData } from '@/components/layout/AppDataProvider';
import Modal from '@/components/ui/Modal';
import { rp } from '@/lib/utils';
import { simpanAnggaran } from '@/lib/actions/anggaran';

function bulanTahunSekarang() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Warna border kiri per kartu kategori, di-cycle sesuai urutan — meniru
// tampilan berwarna-warni pada webapp GAS lama.
const WARNA_KARTU = [
  { border: 'border-l-orange-400', chip: 'bg-orange-100 text-orange-700' },
  { border: 'border-l-blue-400', chip: 'bg-blue-100 text-blue-700' },
  { border: 'border-l-pink-400', chip: 'bg-pink-100 text-pink-700' },
  { border: 'border-l-sky-400', chip: 'bg-sky-100 text-sky-700' },
  { border: 'border-l-amber-400', chip: 'bg-amber-100 text-amber-700' },
  { border: 'border-l-fuchsia-400', chip: 'bg-fuchsia-100 text-fuchsia-700' },
  { border: 'border-l-emerald-400', chip: 'bg-emerald-100 text-emerald-700' },
  { border: 'border-l-violet-400', chip: 'bg-violet-100 text-violet-700' },
];

export default function AnggaranPage() {
  const router = useRouter();
  const { loading, init, filter, filteredTransaksi, anggaran, setFilter, refetchRiwayat } = useAppData();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ kategori: '', subKategori: '', nominal: '' });
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Periode set-anggaran (utk kolom "bulan_tahun" saat simpan) mengikuti filter
  // bulan aktif dari menu Transaksi; kalau filter bulan sedang tidak dipakai
  // (mis. preset "Semua"/"Tahun"/"Rentang"), jatuh ke bulan berjalan.
  const bulanTahun = filter.bulan || bulanTahunSekarang();
  const [tahun, bulan] = bulanTahun.split('-').map(Number);

  // ===== Rekap Pemasukan: total per kategori Pemasukan, mengikuti filter
  // periode aktif dari menu Transaksi (bukan filter bulan terpisah lagi) =====
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

  // ===== Rekap Pengeluaran & Anggaran: total per kategori Pengeluaran mengikuti
  // filter periode aktif + limit anggaran (kalau sudah di-set, memakai bulan/tahun
  // dari filter aktif — hanya relevan saat filter bulan sedang dipakai) =====
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

  // ===== Rekap Sub Kategori Pengeluaran: total per sub kategori (lintas
  // kategori), mengikuti filter periode aktif =====
  const rekapSubKategori = useMemo(() => {
    const totals: Record<string, number> = {};
    filteredTransaksi.forEach((t) => {
      if (t.tipe !== 'Pengeluaran' || !t.sub_kategori) return;
      const key = `${t.kategori} » ${t.sub_kategori}`;
      totals[key] = (totals[key] || 0) + t.nominal;
    });
    return Object.entries(totals)
      .filter(([, v]) => v !== 0)
      .sort((a, b) => b[1] - a[1]);
  }, [filteredTransaksi]);

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
    setFilter((prev) => ({
      ...prev,
      search: search || '',
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
    <div className="space-y-5">
      <div>
        <h1 className="font-bold text-slate-800">Anggaran</h1>
        <p className="text-xs text-slate-400">Pantau pemasukan dan pengeluaran Anda</p>
      </div>

      {/* ===== REKAP PEMASUKAN ===== */}
      <section>
        <h2 className="text-xs font-bold text-slate-500 border-l-4 border-emerald-500 pl-2 mb-2">REKAP PEMASUKAN</h2>
        {rekapPemasukan.length === 0 ? (
          <div className="text-xs text-slate-400 italic py-3">Belum ada transaksi pemasukan di periode ini.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {rekapPemasukan.map(([kategori, total]) => (
              <button
                key={kategori}
                onClick={() => bukaFilterKartu({ kategori, tipe: 'Pemasukan' })}
                className="bg-white rounded-xl border border-slate-200 p-3.5 text-left"
              >
                <div className="text-[10px] font-bold text-slate-400 tracking-wide uppercase pb-1.5 border-b border-slate-100">{kategori}</div>
                <div className="text-emerald-600 font-bold text-base mt-1.5">{rp(total)}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ===== REKAP PENGELUARAN & ANGGARAN ===== */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-slate-500 border-l-4 border-emerald-500 pl-2">REKAP PENGELUARAN &amp; ANGGARAN</h2>
          <button onClick={() => bukaSetAnggaran()} className="text-xs bg-sky-600 text-white px-3 py-1.5 rounded-lg font-semibold shrink-0">
            + Set Anggaran
          </button>
        </div>

        {rekapPengeluaran.length === 0 ? (
          <div className="text-xs text-slate-400 italic py-3">Belum ada transaksi pengeluaran di periode ini.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
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
                  className={`bg-white rounded-xl border border-slate-200 border-l-4 ${warna.border} p-3.5 text-left cursor-pointer transition hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${warna.chip}`}>{kategori}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); bukaSetAnggaran(kategori); }}
                      className="text-[10px] text-slate-400 hover:text-sky-600 shrink-0 border border-slate-200 rounded px-1.5 py-0.5 bg-white active:scale-95 transition"
                    >
                      + Set
                    </button>
                  </div>
                  <div className={`font-bold text-sm mt-2 ${over ? 'text-red-600' : 'text-slate-700'}`}>Terpakai: {rp(terpakai)}</div>
                  {limit !== null ? (
                    <>
                      <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                        <div className={`h-full ${over ? 'bg-red-500' : 'bg-sky-500'}`} style={{ width: `${persen}%` }} />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Limit: {rp(limit)}</div>
                    </>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic mt-1">(Tidak ada limit)</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===== REKAP SUB KATEGORI PENGELUARAN ===== */}
      <section>
        <h2 className="text-xs font-bold text-slate-500 border-l-4 border-emerald-500 pl-2 mb-2">REKAP SUB KATEGORI PENGELUARAN</h2>
        {rekapSubKategori.length === 0 ? (
          <div className="text-xs text-slate-400 italic py-3">Belum ada transaksi atau anggaran sub kategori di periode ini.</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {rekapSubKategori.map(([label, total]) => (
              <button
                key={label}
                onClick={() => bukaFilterKartu({ kategori: label.split(' » ')[0] || '', tipe: 'Pengeluaran', search: label })}
                className="w-full px-4 py-2.5 flex justify-between items-center text-sm text-left"
              >
                <span className="text-slate-600">{label}</span>
                <span className="font-semibold text-slate-800">{rp(total)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Set Anggaran">
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-slate-500">Kategori Pengeluaran</label>
            <select value={form.kategori} onChange={(e) => setForm((f) => ({ ...f, kategori: e.target.value, subKategori: '' }))} className="inp2 mt-1">
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
              <label className="text-[11px] font-medium text-slate-500">Sub Kategori (opsional — kosongkan utk anggaran per kategori)</label>
              <select value={form.subKategori} onChange={(e) => setForm((f) => ({ ...f, subKategori: e.target.value }))} className="inp2 mt-1">
                <option value="">-</option>
                {(init.katKeluar[form.kategori] || []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-[11px] font-medium text-slate-500">Nominal Anggaran</label>
            <input type="number" value={form.nominal} onChange={(e) => setForm((f) => ({ ...f, nominal: e.target.value }))} className="inp2 mt-1" />
          </div>
          {errMsg && <div className="text-xs text-red-600">{errMsg}</div>}
          <button onClick={simpan} disabled={saving} className="w-full bg-sky-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </Modal>

      <style jsx global>{`
        .inp2 {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
