'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search, Plus, X, ArrowDownLeft, ArrowUpRight, Filter, Receipt } from 'lucide-react';
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

// Palet chip kategori — kategori yang sama selalu dapat warna yang sama,
// dipilih lewat hash sederhana dari nama kategori (bukan mapping manual),
// jadi otomatis bekerja untuk kategori apa pun yang user buat sendiri.
const WARNA_CHIP_KATEGORI = [
  'bg-orange-100 text-orange-700',
  'bg-blue-100 text-blue-700',
  'bg-pink-100 text-pink-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-rose-100 text-rose-700',
];

function warnaChipKategori(kategori: string): string {
  let h = 0;
  for (let i = 0; i < kategori.length; i++) h = (h * 31 + kategori.charCodeAt(i)) >>> 0;
  return WARNA_CHIP_KATEGORI[h % WARNA_CHIP_KATEGORI.length];
}

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

const FALLBACK_RECEIPT_SVG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%230284c7" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';

export default function TransaksiPage() {
  const { loading, init, filteredTransaksi, filter, setFilter, clearFilter, refetchRiwayat } = useAppData();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...FORM_KOSONG });
  const [fileBaru, setFileBaru] = useState<File[]>([]);
  const [fileBaruUrls, setFileBaruUrls] = useState<string[]>([]);
  const [buktiLama, setBuktiLama] = useState<string[]>([]);
  const [previewBuktiUrl, setPreviewBuktiUrl] = useState<string | null>(null);
  const [previewBuktiTitle, setPreviewBuktiTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [presetPeriode, setPresetPeriode] = useState<PresetPeriode>('bulan');
  const [rentangKustom, setRentangKustom] = useState({ dari: '', sampai: '' });

  // Buat object URL sekali per perubahan fileBaru, bukan setiap render —
  // mencegah memory leak dan mismatch URL saat preview dibuka.
  useEffect(() => {
    const urls = fileBaru.map((f) => URL.createObjectURL(f));
    setFileBaruUrls(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [fileBaru]);

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

  // Tutup lightbox otomatis kalau blob URL yang sedang dipreview sudah di-revoke
  // (misal user hapus/tambah file baru saat lightbox masih terbuka).
  useEffect(() => {
    if (previewBuktiUrl && previewBuktiUrl.startsWith('blob:') && !fileBaruUrls.includes(previewBuktiUrl)) {
      setPreviewBuktiUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileBaruUrls]);

  function bukaPreviewBukti(url: string, title?: string) {
    setPreviewBuktiUrl(url);
    setPreviewBuktiTitle(title || 'Bukti Transaksi');
  }

  function hapusBuktiLama(index: number) {
    setBuktiLama((prev) => prev.filter((_, idx) => idx !== index));
  }

  function hapusFileBaru(index: number) {
    setFileBaru((prev) => prev.filter((_, idx) => idx !== index));
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
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            <input
              value={filter.search}
              onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Cari transaksi, rekening, kategori, pihak..."
              className="w-full bg-white border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 rounded-xl pl-9 pr-3 py-2 text-xs shadow-sm transition outline-none"
            />
          </div>
          {Object.values(filter).some((v) => typeof v === 'string' ? v !== '' : false) && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                clearFilter();
                setPresetPeriode('semua');
                setRentangKustom({ dari: '', sampai: '' });
              }}
              className="flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 border border-rose-200/80 rounded-xl px-2.5 py-2 whitespace-nowrap shadow-sm hover:bg-rose-100 transition"
            >
              <X size={12} strokeWidth={2.5} />
              <span>Reset</span>
            </motion.button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5 scroll-smooth">
          {(
            [
              { v: 'hari', label: 'Hari Ini' },
              { v: 'bulan', label: 'Bulan Ini' },
              { v: 'tahun', label: 'Tahun Ini' },
              { v: 'rentang', label: 'Rentang' },
              { v: 'semua', label: 'Semua' },
            ] as const
          ).map((p) => (
            <motion.button
              key={p.v}
              whileTap={{ scale: 0.93 }}
              onClick={() => applyPresetPreset(p.v)}
              className={`text-xs px-3.5 py-1.5 rounded-xl border whitespace-nowrap shrink-0 font-medium transition-all ${
                presetPeriode === p.v
                  ? 'bg-slate-800 border-slate-800 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {p.label}
            </motion.button>
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
              className="flex-1 bg-white border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-1.5 text-xs shadow-sm"
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
              className="flex-1 bg-white border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-1.5 text-xs shadow-sm"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <select
            value={filter.warna}
            onChange={(e) => setFilter((prev) => ({ ...prev, warna: e.target.value as 'Semua' | WarnaHighlight }))}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 shadow-sm outline-none focus:border-sky-500"
          >
            <option value="Semua">Semua warna highlight</option>
            {DAFTAR_WARNA_HIGHLIGHT.map((w) => (
              <option key={w.value || 'none'} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>

          <select
            value={filter.rekening}
            onChange={(e) => setFilter((prev) => ({ ...prev, rekening: e.target.value }))}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 shadow-sm outline-none focus:border-sky-500"
          >
            <option value="">Semua rekening</option>
            {init.rekenings.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
          {(['Semua', 'Pemasukan', 'Pengeluaran'] as const).map((f) => (
            <motion.button
              key={f}
              whileTap={{ scale: 0.94 }}
              onClick={() => setFilter((prev) => ({ ...prev, tipe: f }))}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter.tipe === f
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {f}
            </motion.button>
          ))}
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.03 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          onClick={bukaTambah}
          className="flex items-center gap-1.5 text-xs bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white px-3.5 py-2 rounded-xl font-bold shrink-0 shadow-sm shadow-sky-600/20 transition-all"
        >
          <Plus size={15} strokeWidth={2.6} />
          <span>Tambah</span>
        </motion.button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Pemasukan Periode Ini</span>
            <div className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft size={13} strokeWidth={2.4} />
            </div>
          </div>
          <div className="text-emerald-600 font-bold text-sm mt-1">{rp(totalTampil.masuk)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Pengeluaran Periode Ini</span>
            <div className="w-5 h-5 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight size={13} strokeWidth={2.4} />
            </div>
          </div>
          <div className="text-rose-600 font-bold text-sm mt-1">{rp(totalTampil.keluar)}</div>
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
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${warnaChipKategori(t.kategori)}`}>
                      {t.kategori}
                      {t.sub_kategori ? ` \u00bb ${t.sub_kategori}` : ''}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {t.tanggal} {'\u00b7'} {t.rekening}
                      {t.status_bayar === 'DP' ? ' \u00b7 DP' : ''}
                    </span>
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
                    type="button"
                    onClick={() => ubahHighlight(t, w.value)}
                    className={`w-4 h-4 rounded-full border ${t.warna_highlight === w.value ? 'ring-2 ring-slate-400' : 'border-slate-300'}`}
                    style={{ background: w.hex || '#fff' }}
                    title={w.label}
                  ></button>
                ))}
              </div>

              {/* Preview Bukti di Daftar Transaksi */}
              {t.bukti && t.bukti.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 flex-wrap">
                  <span className="text-[10px] font-medium text-slate-400">Bukti ({t.bukti.length}):</span>
                  {t.bukti.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        bukaPreviewBukti(url, `Bukti ${i + 1}/${t.bukti.length} · ${t.keterangan}`);
                      }}
                      className="relative group rounded-md border border-slate-200 overflow-hidden hover:ring-2 hover:ring-sky-400 transition"
                      title="Klik untuk melihat bukti transaksi"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Bukti ${i + 1}`}
                        className="w-7 h-7 object-cover bg-slate-100"
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_RECEIPT_SVG;
                        }}
                      />
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white">
                        🔍
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      bukaPreviewBukti(t.bukti[0], `Bukti 1/${t.bukti.length} · ${t.keterangan}`);
                    }}
                    className="text-[11px] text-sky-600 hover:text-sky-700 font-medium ml-1"
                  >
                    Lihat Bukti
                  </button>
                </div>
              )}
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
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setFileBaru((prev) => [...prev, ...files]);
                e.target.value = '';
              }}
              className="text-xs w-full text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
            />

            {/* Bukti Lama (Existing) */}
            {buktiLama.length > 0 && (
              <div className="space-y-1.5 mt-2.5">
                <div className="flex justify-between items-center text-[11px] font-semibold text-slate-600">
                  <span>Bukti Tersimpan ({buktiLama.length}):</span>
                  <span className="text-[10px] text-slate-400 font-normal">Klik × untuk menghapus</span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {buktiLama.map((url, i) => (
                    <div key={i} className="relative group">
                      <button
                        type="button"
                        onClick={() => bukaPreviewBukti(url, `Bukti Tersimpan ${i + 1}`)}
                        className="block rounded-lg overflow-hidden border-2 border-slate-200 hover:border-sky-400 focus:outline-none transition shadow-sm"
                        title="Klik untuk melihat ukuran penuh"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Bukti ${i + 1}`}
                          className="w-14 h-14 object-cover bg-slate-100"
                          onError={(e) => {
                            e.currentTarget.src = FALLBACK_RECEIPT_SVG;
                          }}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          hapusBuktiLama(i);
                        }}
                        title="Hapus bukti ini"
                        className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-md transition"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bukti Baru (Newly Added) */}
            {fileBaru.length > 0 && (
              <div className="space-y-1.5 mt-2.5">
                <div className="flex justify-between items-center text-[11px] font-semibold text-emerald-700">
                  <span>Bukti Baru Dipilih ({fileBaru.length}):</span>
                  <span className="text-[10px] text-slate-400 font-normal">Klik × untuk membatalkan</span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {fileBaru.map((file, i) => {
                    const objectUrl = fileBaruUrls[i];
                    return (
                      <div key={i} className="relative group">
                        <button
                          type="button"
                          onClick={() => objectUrl && bukaPreviewBukti(objectUrl, `Bukti Baru: ${file.name}`)}
                          className="block rounded-lg overflow-hidden border-2 border-emerald-300 hover:border-emerald-500 focus:outline-none transition shadow-sm"
                          title="Klik untuk melihat preview"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {objectUrl && (
                            <img
                              src={objectUrl}
                              alt={file.name}
                              className="w-14 h-14 object-cover bg-slate-100"
                            />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            hapusFileBaru(i);
                          }}
                          title="Batalkan file ini"
                          className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-md transition"
                        >
                          ×
                        </button>
                        <span className="block text-[9px] text-slate-500 truncate max-w-[56px] mt-0.5" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Field>

          {errMsg && <div className="text-xs text-red-600">{errMsg}</div>}

          <button onClick={simpan} disabled={saving} className="w-full bg-sky-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </Modal>

      {/* Modal Preview Bukti Penuh (Lightbox) */}
      <Modal open={!!previewBuktiUrl} onClose={() => setPreviewBuktiUrl(null)} title={previewBuktiTitle || 'Preview Bukti Transaksi'}>
        <div className="space-y-3">
          <div className="bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center p-3 min-h-[260px] max-h-[70vh]">
            {previewBuktiUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewBuktiUrl}
                alt="Preview Bukti"
                className="max-h-[65vh] w-auto max-w-full object-contain rounded shadow"
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_RECEIPT_SVG;
                }}
              />
            )}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
            <a
              href={previewBuktiUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              download="bukti-transaksi.jpg"
              className="text-xs text-sky-700 hover:text-sky-800 font-medium flex items-center gap-1.5 border border-sky-300 px-3 py-1.5 rounded-lg bg-sky-50 shadow-sm transition"
            >
              <span>⬇️</span> Unduh / Buka Gambar Asli
            </a>

            <div className="flex items-center gap-2">
              {modalOpen && editId && previewBuktiUrl && buktiLama.includes(previewBuktiUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    setBuktiLama((prev) => prev.filter((u) => u !== previewBuktiUrl));
                    setPreviewBuktiUrl(null);
                  }}
                  className="text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold px-3 py-1.5 rounded-lg transition"
                >
                  🗑️ Hapus Bukti Ini
                </button>
              )}

              <button
                type="button"
                onClick={() => setPreviewBuktiUrl(null)}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-1.5 rounded-lg font-medium transition"
              >
                Tutup
              </button>
            </div>
          </div>
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
