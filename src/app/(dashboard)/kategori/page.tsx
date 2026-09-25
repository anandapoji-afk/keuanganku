'use client';

import { useState } from 'react';
import { useAppData } from '@/components/layout/AppDataProvider';
import { tambahKategori, hapusKategori, tambahSubKategori, hapusSubKategori } from '@/lib/actions/kategori';
import type { Tipe } from '@/lib/types';

export default function KategoriPage() {
  const { loading, init, refetchAll } = useAppData();
  const [tipe, setTipe] = useState<Tipe>('Pengeluaran');
  const [namaBaru, setNamaBaru] = useState('');
  const [subInput, setSubInput] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const map = tipe === 'Pemasukan' ? init.katMasuk : init.katKeluar;

  async function tambah() {
    if (!namaBaru.trim()) return;
    setBusy(true);
    const res = await tambahKategori({ workspace: init.active, tipe, nama: namaBaru.trim() });
    setBusy(false);
    if (!res.success) return alert(res.error);
    setNamaBaru('');
    await refetchAll();
  }

  async function hapus(nama: string) {
    if (!confirm(`Hapus kategori '${nama}'? Sub kategorinya ikut terhapus.`)) return;
    const res = await hapusKategori({ workspace: init.active, tipe, nama });
    if (!res.success) return alert(res.error);
    await refetchAll();
  }

  async function tambahSub(kategori: string) {
    const nilai = (subInput[kategori] || '').trim();
    if (!nilai) return;
    const subs = nilai.split(',').map((s) => s.trim()).filter(Boolean);
    const res = await tambahSubKategori({ workspace: init.active, tipe, kategori, subs });
    if (!res.success) return alert(res.error);
    setSubInput((s) => ({ ...s, [kategori]: '' }));
    await refetchAll();
  }

  async function hapusSub(kategori: string, sub: string) {
    if (!confirm(`Hapus sub kategori '${sub}'?`)) return;
    const res = await hapusSubKategori({ workspace: init.active, tipe, kategori, sub });
    if (!res.success) return alert(res.error);
    await refetchAll();
  }

  if (loading) return <div className="text-sm text-slate-400 py-10 text-center">Memuat data...</div>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['Pemasukan', 'Pengeluaran'] as const).map((tp) => (
          <button
            key={tp}
            onClick={() => setTipe(tp)}
            className={`flex-1 text-xs py-2 rounded-lg border font-semibold ${
              tipe === tp ? 'bg-sky-50 border-sky-400 text-sky-700' : 'border-slate-200 text-slate-400'
            }`}
          >
            {tp}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={namaBaru}
          onChange={(e) => setNamaBaru(e.target.value)}
          placeholder={`Kategori ${tipe} baru`}
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={tambah} disabled={busy} className="bg-sky-600 text-white text-xs font-semibold px-4 rounded-lg">
          Tambah
        </button>
      </div>

      <div className="space-y-2">
        {Object.entries(map).map(([kategori, subs]) => (
          <div key={kategori} className="bg-white rounded-xl border border-slate-200 p-3.5">
            <div className="flex justify-between items-center">
              <span className="font-medium text-sm text-slate-700">{kategori}</span>
              <button onClick={() => hapus(kategori)} className="text-[11px] text-slate-300 hover:text-red-500">
                Hapus
              </button>
            </div>

            {subs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {subs.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 rounded-full px-2.5 py-1">
                    {s}
                    <button onClick={() => hapusSub(kategori, s)} className="text-slate-400 hover:text-red-500">
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-1.5 mt-2">
              <input
                value={subInput[kategori] || ''}
                onChange={(e) => setSubInput((s) => ({ ...s, [kategori]: e.target.value }))}
                placeholder="Sub kategori (pisah koma utk banyak)"
                className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
              />
              <button onClick={() => tambahSub(kategori)} className="text-xs text-sky-600 font-semibold px-2">
                +
              </button>
            </div>
          </div>
        ))}
        {Object.keys(map).length === 0 && <div className="text-center text-xs text-slate-400 py-6">Belum ada kategori {tipe.toLowerCase()}.</div>}
      </div>
    </div>
  );
}
