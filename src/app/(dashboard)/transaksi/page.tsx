'use client';

import { useMemo, useState } from 'react';
import { useAppData } from '@/components/layout/AppDataProvider';
import Modal from '@/components/ui/Modal';
import { rp, DAFTAR_WARNA_HIGHLIGHT, warnaHighlightHex } from '@/lib/utils';
import { simpanTransaksi, hapusTransaksi, simpanHighlightCatatan } from '@/lib/actions/transaksi';
import type { SimpanTransaksiPayload, Transaction, Tipe, StatusBayar, WarnaHighlight } from '@/lib/types';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const FORM_KOSONG = {
  tanggal: new Date().toISOString().slice(0, 10),
  jam: '',
  tipe: 'Pengeluaran' as Tipe,
  kategori: '',
  subKategori: '',
  rekening: '',
  keterangan: '',
  pihakTerkait: '',
  nominal: '',
  statusBayar: 'Lunas' as StatusBayar,
  totalTagihan: '',
  warnaHighlight: '' as WarnaHighlight,
  catatan: '',
};

type PresetPeriode = 'semua' | 'hari' | 'bulan' | 'tahun' | 'rentang';

function rentangDariPreset(preset: PresetPeriode, custom: { dari: string; sampai: string }): { dari: string; sampai: string } | null {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === 'semua') return null;
  if (preset === 'hari') {
    const t = iso(now);
    return { dari: t, sampai: t };
  }
  if (preset === 'bulan') {
    return { dari: iso(new Date(now.getFullYear(), now.getMonth(), 1)), sampai: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
  if (preset === 'tahun') {
    return { dari: iso(new Date(now.getFullYear(), 0, 1)), sampai: iso(new Date(now.getFullYear(), 11, 31)) };
  }
  return custom.dari && custom.sampai ? custom : null;
}

export default function TransaksiPage() {
  const { loading, init, filteredTransaksi, filter, setFilter, clearFilter, refetchRiwayat } = useAppData();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...FORM_KOSONG });
  const [fileBaru, setFileBaru] = useState<File[]>([]);
  const [buktiLama, setBuktiLama] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [presetPeriode, setPresetPeriode] = useState<PresetPeriode>('bulan');
  const [rentangKustom, setRentangKustom] = useState({ dari: '', sampai: '' });

  const daftarKategori = useMemo(() => {
    const map = form.tipe === 'Pemasukan' ? init.katMasuk : init.katKeluar;
    return Object.keys(map);
  }, [form.tipe, init]);

  const daftarSub = useMemo(() => {
    const map = form.tipe === 'Pemasukan' ? init.katMasuk : init.katKeluar;
    return map[form.kategori] || [];
  }, [form.tipe, form.kategori, init]);

  const listTampil = filteredTransaksi;

  const totalTampil = useMemo(() => {
    let masuk = 0;
    let keluar = 0;

    listTampil.forEach((t) => {
      if (['Transfer', 'Tabungan'].includes(t.kategori)) return;
      if (t.tipe === 'Pemasukan') masuk += t.nominal;
      else keluar += t.nominal;
    });

    return { masuk, keluar };
  }, [listTampil]);

  function applyPresetPreset(nextPreset: PresetPeriode) {
    if (nextPreset === 'semua') {
      setPresetPeriode('semua');
      clearFilter();
      setRentangKustom({ dari: '', sampai: '' });
      return;
    }

    const today = new Date();
    const hariIni = today.toISOString().slice(0, 10);
    const bulanIni = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const tahunIni = String(today.getFullYear());

    setPresetPeriode(nextPreset);
    const aktif = rentangDariPreset(nextPreset, rentangKustom);

    setFilter((prev) => ({
      ...prev,
      tanggal: nextPreset === 'hari' ? hariIni : '',
      bulan: nextPreset === 'bulan' ? bulanIni : '',
      tahun: nextPreset === 'tahun' ? tahunIni : '',
      startDate: nextPreset === 'rentang' ? aktif?.dari || '' : '',
      endDate: nextPreset === 'rentang' ? aktif?.sampai || '' : '',
    }));
  }

  function applyQuickFilter(patch: Partial<typeof filter>) {
    setFilter((prev) => ({
      ...prev,
      ...patch,
      tanggal: patch.tanggal ?? '',
      bulan: patch.bulan ?? '',
      tahun: patch.tahun ?? '',
      startDate: patch.startDate ?? '',
      endDate: patch.endDate ?? '',
    }));
  }

  function bukaTambah() {
    setEditId(null);
    setForm({ ...FORM_KOSONG, rekening: init.rekenings[0] || 'CASH' });
    setFileBaru([]);
    setBuktiLama([]);
    setErrMsg(null);
    setModalOpen(true);
  }

  function bukaEdit(t: Transaction) {
    setEditId(t.id);
    setForm({
      tanggal: t.tanggal,
      jam: t.jam,
      tipe: t.tipe,
      kategori: t.kategori,
      subKategori: t.sub_kategori,
      rekening: t.rekening,
      keterangan: t.keterangan,
      pihakTerkait: t.pihak_terkait,
      nominal: String(t.nominal),
      statusBayar: t.status_bayar,
      totalTagihan: String(t.total_tagihan || ''),
      warnaHighlight: t.warna_highlight,
      catatan: t.catatan,
    });
    setFileBaru([]);
    setBuktiLama(t.bukti || []);
    setErrMsg(null);
    setModalOpen(true);
  }

  async function simpan() {
    setSaving(true);
    setErrMsg(null);

    const buktiBaru = await Promise.all(
      fileBaru.map(async (f) => ({ data: await fileToBase64(f), mime: f.type, nama: f.name }))
    );

    const payload: SimpanTransaksiPayload = {
      rowIdx: editId || undefined,
      workspace: init.active,
      tanggal: form.tanggal,
      jam: form.jam,
      tipe: form.tipe,
      kategori: form.kategori,
      subKategori: form.subKategori,
      rekening: form.rekening,
      keterangan: form.keterangan,
      pihakTerkait: form.pihakTerkait,
      nominal: parseFloat(form.nominal) || 0,
      warnaHighlight: form.warnaHighlight,
      catatan: form.catatan,
      statusBayar: form.statusBayar,
      totalTagihan: parseFloat(form.totalTagihan) || 0,
      buktiLama,
      buktiBaru,
    };

    const res = await simpanTransaksi(payload);
    setSaving(false);
    if (!res.success) {
      setErrMsg(res.error);
      return;
    }
    setModalOpen(false);
    await refetchRiwayat();
  }

  async function hapus(id: string) {
    if (!confirm('Hapus transaksi ini?')) return;
    const res = await hapusTransaksi(id, init.active);
    if (!res.success) {
      alert(res.error);
      return;
    }
    await refetchRiwayat();
  }

  async function ubahHighlight(t: Transaction, warna: WarnaHighlight) {
    await simpanHighlightCatatan({ workspace: init.active, rowIdx: t.id, warna, catatan: t.catatan });
    await refetchRiwayat();
  }

  if (loading) return <div className="text-sm text-slate-400 py-10 text-center">Memuat data...</div>;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={filter.search}
            onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Cari transaksi, rekening, kategori, pihak..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
          />
          {Object.values(filter).some((v) => typeof v === 'string' ? v !== '' : false) && (
            <button
              onClick={() => {
                clearFilter();
                setPresetPeriode('semua');
                setRentangKustom({ dari: '', sampai: '' });
              }}
              className="text-[10px] text-red-500 border border-red-200 rounded px-2 py-1.5 whitespace-nowrap"
            >
              Hapus Filter
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {(
            [
              { v: 'hari', label: 'Hari Ini' },
              { v: 'bulan', label: 'Bulan Ini' },
              { v: 'tahun', label: 'Tahun Ini' },
              { v: 'rentang', label: 'Rentang' },
              { v: 'semua', label: 'Semua' },
            ] as const
          ).map((p) => (
            <button
              key={p.v}
              onClick={() => applyPresetPreset(p.v)}
              className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap shrink-0 ${
                presetPeriode === p.v ? 'bg-slate-800 border-slate-800 text-white' : 'border-slate-200 text-slate-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {presetPeriode === 'rentang' && (
          <div className="flex gap-2">
            <input
              type="date"
              value={rentangKustom.dari}
              onChange={(e) => {
                const next = { ...rentangKustom, dari: e.target.value };
                setRentangKustom(next);
                const aktif = rentangDariPreset('rentang', next);
                setFilter((prev) => ({ ...prev, startDate: aktif?.dari || '', endDate: aktif?.sampai || '' }));
              }}
              className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
            />
            <input
              type="date"
              value={rentangKustom.sampai}
              onChange={(e) => {
                const next = { ...rentangKustom, sampai: e.target.value };
                setRentangKustom(next);
                const aktif = rentangDariPreset('rentang', next);
                setFilter((prev) => ({ ...prev, startDate: aktif?.dari || '', endDate: aktif?.sampai || '' }));
              }}
              className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <select
            value={filter.warna}
            onChange={(e) => setFilter((prev) => ({ ...prev, warna: e.target.value as 'Semua' | WarnaHighlight }))}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
          >
            <option value="Semua">Semua warna</option>
            {DAFTAR_WARNA_HIGHLIGHT.map((w) => (
              <option key={w.value || 'none'} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>

          <select
            value={filter.rekening}
            onChange={(e) => setFilter((prev) => ({ ...prev, rekening: e.target.value }))}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
          >
            <option value="">Semua rekening</option>
            {init.rekenings.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(['Semua', 'Pemasukan', 'Pengeluaran'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter((prev) => ({ ...prev, tipe: f }))}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                filter.tipe === f ? 'bg-sky-600 border-sky-600 text-white' : 'border-slate-200 text-slate-500'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button onClick={bukaTambah} className="text-xs bg-sky-600 text-white px-3.5 py-2 rounded-lg font-semibold shrink-0">
          + Tambah
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-[11px] text-slate-400">Pemasukan (periode ini)</div>
          <div className="text-emerald-600 font-bold text-sm mt-0.5">{rp(totalTampil.masuk)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-[11px] text-slate-400">Pengeluaran (periode ini)</div>
          <div className="text-red-600 font-bold text-sm mt-0.5">{rp(totalTampil.keluar)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {listTampil.map((t) => {
          const hex = t.warna_highlight ? warnaHighlightHex(t.warna_highlight) : undefined;
          return (
            <div key={t.id} className="px-4 py-3" style={hex ? { background: hex } : undefined}>
              <div className="flex justify-between items-start gap-2">
                <button className="text-left flex-1" onClick={() => bukaEdit(t)}>
                  <div className="text-sm text-slate-700 font-medium">{t.keterangan}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {t.tanggal} {'\u00b7'} {t.kategori}
                    {t.sub_kategori ? ` \u00bb ${t.sub_kategori}` : ''} {'\u00b7'} {t.rekening}
                    {t.status_bayar === 'DP' ? ' \u00b7 DP' : ''}
                  </div>
                  {t.catatan && <div className="text-[11px] text-amber-600 mt-0.5">{t.catatan}</div>}
                </button>
                <div className="text-right shrink-0">
                  <div className={`font-semibold text-sm ${t.tipe === 'Pemasukan' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {t.tipe === 'Pemasukan' ? '+' : '-'}
                    {rp(t.nominal)}
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <button onClick={() => bukaEdit(t)} className="text-[10px] text-sky-600 hover:text-sky-700">
                      Edit
                    </button>
                    <button onClick={() => hapus(t.id)} className="text-[10px] text-slate-300 hover:text-red-500">
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-1 mt-2">
                {DAFTAR_WARNA_HIGHLIGHT.map((w) => (
                  <button
                    key={w.value}
                    onClick={() => ubahHighlight(t, w.value)}
                    className={`w-4 h-4 rounded-full border ${t.warna_highlight === w.value ? 'ring-2 ring-slate-400' : 'border-slate-300'}`}
                    style={{ background: w.hex || '#fff' }}
                    title={w.label}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {listTampil.length === 0 && <div className="px-4 py-8 text-center text-xs text-slate-400">Belum ada transaksi.</div>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Transaksi' : 'Tambah Transaksi'}>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['Pemasukan', 'Pengeluaran'] as const).map((tp) => (
              <button
                key={tp}
                onClick={() => setForm((f) => ({ ...f, tipe: tp, kategori: '', subKategori: '' }))}
                className={`flex-1 text-xs py-2 rounded-lg border font-semibold ${
                  form.tipe === tp
                    ? tp === 'Pemasukan'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                      : 'bg-red-50 border-red-400 text-red-700'
                    : 'border-slate-200 text-slate-400'
                }`}
              >
                {tp}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Tanggal">
              <input type="date" value={form.tanggal} onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))} className="inp" />
            </Field>
            <Field label="Jam (opsional)">
              <input type="time" value={form.jam} onChange={(e) => setForm((f) => ({ ...f, jam: e.target.value }))} className="inp" />
            </Field>
          </div>

          <Field label="Kategori">
            <select value={form.kategori} onChange={(e) => setForm((f) => ({ ...f, kategori: e.target.value, subKategori: '' }))} className="inp">
              <option value="">Pilih kategori</option>
              {daftarKategori.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>

          {daftarSub.length > 0 && (
            <Field label="Sub Kategori (opsional)">
              <select value={form.subKategori} onChange={(e) => setForm((f) => ({ ...f, subKategori: e.target.value }))} className="inp">
                <option value="">-</option>
                {daftarSub.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Keterangan">
            <input value={form.keterangan} onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))} className="inp" />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Nominal">
              <input type="number" value={form.nominal} onChange={(e) => setForm((f) => ({ ...f, nominal: e.target.value }))} className="inp" />
            </Field>
            <Field label="Rekening">
              <select value={form.rekening} onChange={(e) => setForm((f) => ({ ...f, rekening: e.target.value }))} className="inp">
                {init.rekenings.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Pihak Terkait (opsional)">
            <input value={form.pihakTerkait} onChange={(e) => setForm((f) => ({ ...f, pihakTerkait: e.target.value }))} className="inp" />
          </Field>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={form.statusBayar === 'DP'}
              onChange={(e) => setForm((f) => ({ ...f, statusBayar: e.target.checked ? 'DP' : 'Lunas' }))}
            />
            Ini transaksi DP / Cicilan
          </label>

          {form.statusBayar === 'DP' && (
            <Field label="Total Tagihan">
              <input type="number" value={form.totalTagihan} onChange={(e) => setForm((f) => ({ ...f, totalTagihan: e.target.value }))} className="inp" />
            </Field>
          )}

          <Field label="Catatan (opsional)">
            <textarea value={form.catatan} onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))} className="inp" rows={2} />
          </Field>

          <Field label="Bukti Transaksi (opsional, bisa lebih dari 1)">
            <input type="file" accept="image/*" multiple onChange={(e) => setFileBaru(Array.from(e.target.files || []))} className="text-xs" />
            {buktiLama.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {buktiLama.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="bukti" className="w-14 h-14 object-cover rounded border border-slate-200" />
                ))}
              </div>
            )}
          </Field>

          {errMsg && <div className="text-xs text-red-600">{errMsg}</div>}

          <button onClick={simpan} disabled={saving} className="w-full bg-sky-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </Modal>

      <style jsx global>{`
        .inp {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-slate-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}