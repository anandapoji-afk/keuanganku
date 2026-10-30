'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Plus,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Receipt,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Printer,
  Archive,
  Download,
  UploadCloud,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  CalendarRange,
  Calendar,
  Wallet,
  Clock,
  Tag,
  User,
  SlidersHorizontal,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';
import JSZip from 'jszip';
import { useAppData } from '@/components/layout/AppDataProvider';
import Modal from '@/components/ui/Modal';
import AiInput from '@/components/transaksi/AiInput';
import { fileToBase64 } from '@/lib/ai/media';
import { rp, DAFTAR_WARNA_HIGHLIGHT, warnaHighlightHex, formatBulanIndo } from '@/lib/utils';
import { simpanTransaksi, hapusTransaksi, simpanHighlightCatatan } from '@/lib/actions/transaksi';
import type { SimpanTransaksiPayload, Transaction, Tipe, StatusBayar, WarnaHighlight, HasilEkstrakAi } from '@/lib/types';

const FORM_KOSONG = {
  tanggal: new Date().toISOString().slice(0, 10),
  sampaiTanggal: '',
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

type KolomSort = 'tanggal' | 'nominal' | 'keterangan' | 'kategori' | 'rekening' | 'tipe' | 'created_at';
type AturanSort = { kolom: KolomSort; arah: 'asc' | 'desc' };

const KOLOM_SORT: { key: KolomSort; label: string; tipe: 'date' | 'number' | 'text' | 'timestamp'; arahAwal: 'asc' | 'desc' }[] = [
  { key: 'tanggal', label: 'Tanggal', tipe: 'date', arahAwal: 'desc' },
  { key: 'nominal', label: 'Nominal', tipe: 'number', arahAwal: 'desc' },
  { key: 'keterangan', label: 'Keterangan', tipe: 'text', arahAwal: 'asc' },
  { key: 'kategori', label: 'Kategori', tipe: 'text', arahAwal: 'asc' },
  { key: 'rekening', label: 'Rekening', tipe: 'text', arahAwal: 'asc' },
  { key: 'tipe', label: 'Tipe', tipe: 'text', arahAwal: 'asc' },
  { key: 'created_at', label: 'Waktu input', tipe: 'timestamp', arahAwal: 'desc' },
];

const LABEL_ARAH: Record<'date' | 'number' | 'text' | 'timestamp', { asc: string; desc: string }> = {
  date: { asc: 'Lama → Baru', desc: 'Baru → Lama' },
  timestamp: { asc: 'Lama → Baru', desc: 'Baru → Lama' },
  number: { asc: '1 → 9', desc: '9 → 1' },
  text: { asc: 'A → Z', desc: 'Z → A' },
};

const DEFAULT_SORT: AturanSort[] = [{ kolom: 'tanggal', arah: 'desc' }];

function bandingkanTransaksi(a: Transaction, b: Transaction, kolom: KolomSort): number {
  switch (kolom) {
    case 'tanggal': {
      const cmpTgl = (a.tanggal || '').localeCompare(b.tanggal || '');
      if (cmpTgl !== 0) return cmpTgl;
      const cmpJam = (a.jam || '00:00').localeCompare(b.jam || '00:00');
      if (cmpJam !== 0) return cmpJam;
      return (a.created_at || '').localeCompare(b.created_at || '');
    }
    case 'nominal':
      return (Number(a.nominal) || 0) - (Number(b.nominal) || 0);
    case 'created_at':
      return (a.created_at || '').localeCompare(b.created_at || '');
    default:
      return String(a[kolom] || '').localeCompare(String(b[kolom] || ''), 'id', { sensitivity: 'base' });
  }
}

type PresetPeriode = 'semua' | 'hari' | 'bulan' | 'jarak_bulan' | 'pilih_bulan' | 'rentang' | 'tahun';

function awalBulanDariIso(bulanStr: string): string {
  if (!bulanStr) return '';
  const [y, m] = bulanStr.split('-').map(Number);
  if (!y || !m) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-01`;
}

function akhirBulanDariIso(bulanStr: string): string {
  if (!bulanStr) return '';
  const [y, m] = bulanStr.split('-').map(Number);
  if (!y || !m) return '';
  const lastDay = new Date(y, m, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(lastDay)}`;
}

function getBulanIsoRelatif(deltaBulan: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + deltaBulan);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

const WARNA_CHIP_KATEGORI = [
  'bg-orange-100 text-orange-700 border-orange-200/60',
  'bg-blue-100 text-blue-700 border-blue-200/60',
  'bg-pink-100 text-pink-700 border-pink-200/60',
  'bg-sky-100 text-sky-700 border-sky-200/60',
  'bg-amber-100 text-amber-700 border-amber-200/60',
  'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200/60',
  'bg-emerald-100 text-emerald-700 border-emerald-200/60',
  'bg-violet-100 text-violet-700 border-violet-200/60',
  'bg-teal-100 text-teal-700 border-teal-200/60',
  'bg-rose-100 text-rose-700 border-rose-200/60',
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
  const [previewBuktiDaftar, setPreviewBuktiDaftar] = useState<string[]>([]);
  const [previewBuktiIndex, setPreviewBuktiIndex] = useState(0);
  const [previewBuktiLabel, setPreviewBuktiLabel] = useState('');
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const previewBuktiUrl = previewBuktiDaftar[previewBuktiIndex] ?? null;
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [presetPeriode, setPresetPeriode] = useState<PresetPeriode>('bulan');
  const [rentangKustom, setRentangKustom] = useState({ dari: '', sampai: '' });
  const [rentangBulan, setRentangBulan] = useState<{ dari: string; sampai: string }>({ dari: '', sampai: '' });
  const [pilihBulan, setPilihBulan] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  function tampilkanToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

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

  // Default pengurutan transaksi otomatis ke "Tanggal: Baru ke Lama"
  const [aturanSort, setAturanSort] = useState<AturanSort[]>(DEFAULT_SORT);

  // Saat filter apa pun diterapkan atau berubah, pastikan urutan tanggal Baru ke Lama otomatis menjadi default
  useEffect(() => {
    setAturanSort(DEFAULT_SORT);
  }, [filter]);

  // Urut berjenjang sesuai aturan; jika aturan kosong otomatis pakai DEFAULT_SORT
  const listUrut = useMemo(() => {
    const aturan = aturanSort.length > 0 ? aturanSort : DEFAULT_SORT;
    return listTampil.slice().sort((a, b) => {
      for (const r of aturan) {
        const hasil = bandingkanTransaksi(a, b, r.kolom);
        if (hasil !== 0) return r.arah === 'asc' ? hasil : -hasil;
      }
      return 0;
    });
  }, [listTampil, aturanSort]);

  const totalTampil = useMemo(() => {
    let masuk = 0;
    let keluar = 0;

    listTampil.forEach((t) => {
      if (['Transfer', 'Tabungan'].includes(t.kategori)) return;
      if (t.tipe === 'Pemasukan') masuk += t.nominal;
      else keluar += t.nominal;
    });

    return { masuk, keluar, selisih: masuk - keluar };
  }, [listTampil]);

  function ubahRentangBulan(patch: Partial<{ dari: string; sampai: string }>) {
    const next = { ...rentangBulan, ...patch };
    setRentangBulan(next);
    setAturanSort(DEFAULT_SORT);

    let start = next.dari;
    let end = next.sampai;
    if (start && end && start > end) {
      const temp = start;
      start = end;
      end = temp;
    }

    const startDate = start ? awalBulanDariIso(start) : '';
    const endDate = end ? akhirBulanDariIso(end) : (start ? akhirBulanDariIso(start) : '');

    setFilter((prev) => ({
      ...prev,
      tanggal: '',
      bulan: '',
      tahun: '',
      startDate,
      endDate,
    }));
  }

  function ubahPilihBulan(isoBulan: string) {
    setPilihBulan(isoBulan);
    setAturanSort(DEFAULT_SORT);
    setFilter((prev) => ({
      ...prev,
      tanggal: '',
      bulan: isoBulan,
      tahun: '',
      startDate: '',
      endDate: '',
    }));
  }

  function ubahRentangTanggal(patch: Partial<{ dari: string; sampai: string }>) {
    const next = { ...rentangKustom, ...patch };
    setRentangKustom(next);
    setAturanSort(DEFAULT_SORT);
    const aktif = rentangDariPreset('rentang', next);
    setFilter((prev) => ({
      ...prev,
      tanggal: '',
      bulan: '',
      tahun: '',
      startDate: aktif?.dari || '',
      endDate: aktif?.sampai || '',
    }));
  }

  function applyPresetPreset(nextPreset: PresetPeriode) {
    setAturanSort(DEFAULT_SORT);
    if (nextPreset === 'semua') {
      setPresetPeriode('semua');
      setFilter((prev) => ({
        ...prev,
        tanggal: '',
        bulan: '',
        tahun: '',
        startDate: '',
        endDate: '',
      }));
      setRentangKustom({ dari: '', sampai: '' });
      setRentangBulan({ dari: '', sampai: '' });
      setPilihBulan('');
      return;
    }

    const today = new Date();
    const hariIni = today.toISOString().slice(0, 10);
    const bulanIni = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const tahunIni = String(today.getFullYear());

    setPresetPeriode(nextPreset);

    if (nextPreset === 'hari') {
      setFilter((prev) => ({
        ...prev,
        tanggal: hariIni,
        bulan: '',
        tahun: '',
        startDate: '',
        endDate: '',
      }));
    } else if (nextPreset === 'bulan') {
      setFilter((prev) => ({
        ...prev,
        tanggal: '',
        bulan: bulanIni,
        tahun: '',
        startDate: '',
        endDate: '',
      }));
    } else if (nextPreset === 'jarak_bulan') {
      let dari = rentangBulan.dari;
      let sampai = rentangBulan.sampai;
      if (!dari && !sampai) {
        dari = getBulanIsoRelatif(-2);
        sampai = bulanIni;
        setRentangBulan({ dari, sampai });
      }
      const startDate = dari ? awalBulanDariIso(dari) : '';
      const endDate = sampai ? akhirBulanDariIso(sampai) : (dari ? akhirBulanDariIso(dari) : '');
      setFilter((prev) => ({
        ...prev,
        tanggal: '',
        bulan: '',
        tahun: '',
        startDate,
        endDate,
      }));
    } else if (nextPreset === 'pilih_bulan') {
      const b = pilihBulan || bulanIni;
      setPilihBulan(b);
      setFilter((prev) => ({
        ...prev,
        tanggal: '',
        bulan: b,
        tahun: '',
        startDate: '',
        endDate: '',
      }));
    } else if (nextPreset === 'tahun') {
      setFilter((prev) => ({
        ...prev,
        tanggal: '',
        bulan: '',
        tahun: tahunIni,
        startDate: '',
        endDate: '',
      }));
    } else if (nextPreset === 'rentang') {
      const aktif = rentangDariPreset('rentang', rentangKustom);
      setFilter((prev) => ({
        ...prev,
        tanggal: '',
        bulan: '',
        tahun: '',
        startDate: aktif?.dari || '',
        endDate: aktif?.sampai || '',
      }));
    }
  }

  function bukaTambah() {
    setEditId(null);
    setForm({ ...FORM_KOSONG, rekening: init.rekenings[0] || 'CASH' });
    setFileBaru([]);
    setBuktiLama([]);
    setErrMsg(null);
    setModalOpen(true);
  }

  // Buka modal saat dipanggil dari tombol center "+ Transaksi" di BottomNav
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('tambah') === '1' || sp.get('baru') === '1') {
        bukaTambah();
        // Bersihkan query param agar URL tetap rapi
        window.history.replaceState({}, '', window.location.pathname);
      }
    }

    const handleBukaTambahEvent = () => {
      bukaTambah();
    };

    window.addEventListener('buka-tambah-transaksi', handleBukaTambahEvent);
    return () => {
      window.removeEventListener('buka-tambah-transaksi', handleBukaTambahEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init.rekenings]);

  // Isi form dari hasil Gemini. Kategori/sub/rekening hanya dipakai kalau persis ada di daftar user.
  function terapkanHasilAi(h: HasilEkstrakAi) {
    const map = h.tipe === 'Pemasukan' ? init.katMasuk : init.katKeluar;
    const kategori = Object.keys(map).includes(h.kategori) ? h.kategori : '';
    const subKategori = kategori && (map[kategori] || []).includes(h.subKategori) ? h.subKategori : '';
    setForm((f) => ({
      ...f,
      tipe: h.tipe,
      tanggal: /^\d{4}-\d{2}-\d{2}$/.test(h.tanggal) ? h.tanggal : f.tanggal,
      jam: /^\d{2}:\d{2}$/.test(h.jam) ? h.jam : f.jam,
      kategori,
      subKategori,
      keterangan: h.keterangan || f.keterangan,
      nominal: h.nominal > 0 ? String(Math.round(h.nominal)) : f.nominal,
      rekening: init.rekenings.includes(h.rekening) ? h.rekening : f.rekening,
      pihakTerkait: h.pihakTerkait || f.pihakTerkait,
      catatan: h.catatan || f.catatan,
    }));
  }

  function bukaEdit(t: Transaction) {
    setEditId(t.id);
    setForm({
      tanggal: t.tanggal,
      sampaiTanggal: t.sampai_tanggal || '',
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

  useEffect(() => {
    if (previewBuktiUrl && previewBuktiUrl.startsWith('blob:') && !fileBaruUrls.includes(previewBuktiUrl)) {
      setPreviewBuktiDaftar([]);
    }
  }, [fileBaruUrls, previewBuktiUrl]);

  function bukaPreviewBukti(daftar: string[], index: number, label?: string) {
    setPreviewBuktiDaftar(daftar);
    setPreviewBuktiIndex(index);
    setPreviewBuktiLabel(label || 'Bukti Transaksi');
  }

  function tutupPreviewBukti() {
    setPreviewBuktiDaftar([]);
  }

  function previewSebelumnya() {
    setPreviewBuktiIndex((i) => (i - 1 + previewBuktiDaftar.length) % previewBuktiDaftar.length);
  }

  function previewBerikutnya() {
    setPreviewBuktiIndex((i) => (i + 1) % previewBuktiDaftar.length);
  }

  async function unduhSemuaBuktiZip(daftarUrls: string[], namaTransaksi: string) {
    if (!daftarUrls || daftarUrls.length === 0) return;
    setIsDownloadingZip(true);
    try {
      const zip = new JSZip();
      const rawTitle = (namaTransaksi || 'bukti-transaksi').trim();
      const cleanTitle = rawTitle.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'bukti-transaksi';

      for (let i = 0; i < daftarUrls.length; i++) {
        const url = daftarUrls[i];
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          let ext = 'jpg';
          if (blob.type === 'image/png') ext = 'png';
          else if (blob.type === 'image/webp') ext = 'webp';
          else if (blob.type === 'image/svg+xml') ext = 'svg';
          else if (blob.type === 'image/jpeg') ext = 'jpg';
          else if (url.toLowerCase().includes('.png')) ext = 'png';
          else if (url.toLowerCase().includes('.webp')) ext = 'webp';
          else if (url.toLowerCase().includes('.svg')) ext = 'svg';

          const filename = `${cleanTitle}_bukti_${i + 1}.${ext}`;
          zip.file(filename, blob);
        } catch (err) {
          console.error('Gagal mengambil file bukti untuk zip:', err);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${cleanTitle}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      console.error('Gagal membuat file zip:', e);
      alert('Gagal mengunduh file zip bukti.');
    } finally {
      setIsDownloadingZip(false);
    }
  }

  useEffect(() => {
    if (previewBuktiDaftar.length === 0) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') previewSebelumnya();
      else if (e.key === 'ArrowRight') previewBerikutnya();
      else if (e.key === 'Escape') tutupPreviewBukti();
    }
    window.addEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewBuktiDaftar.length]);

  const previewBuktiTitle =
    previewBuktiDaftar.length > 1 ? `${previewBuktiLabel} (${previewBuktiIndex + 1}/${previewBuktiDaftar.length})` : previewBuktiLabel;

  function hapusBuktiLama(index: number) {
    setBuktiLama((prev) => prev.filter((_, idx) => idx !== index));
  }

  function hapusFileBaru(index: number) {
    setFileBaru((prev) => prev.filter((_, idx) => idx !== index));
  }

  // ===== Drag and Drop Reordering untuk Bukti Lama =====
  const [dragBuktiLamaIdx, setDragBuktiLamaIdx] = useState<number | null>(null);
  const [dragOverBuktiLamaIdx, setDragOverBuktiLamaIdx] = useState<number | null>(null);

  function handleBuktiLamaDragStart(e: React.DragEvent, index: number) {
    setDragBuktiLamaIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }

  function handleBuktiLamaDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverBuktiLamaIdx !== index) {
      setDragOverBuktiLamaIdx(index);
    }
  }

  function handleBuktiLamaDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    if (dragBuktiLamaIdx !== null && dragBuktiLamaIdx !== targetIndex) {
      setBuktiLama((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragBuktiLamaIdx, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
    }
    setDragBuktiLamaIdx(null);
    setDragOverBuktiLamaIdx(null);
  }

  function handleBuktiLamaDragEnd() {
    setDragBuktiLamaIdx(null);
    setDragOverBuktiLamaIdx(null);
  }

  function geserBuktiLama(index: number, arah: -1 | 1) {
    const target = index + arah;
    if (target < 0 || target >= buktiLama.length) return;
    setBuktiLama((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  }

  // ===== Drag and Drop Reordering untuk Bukti Baru =====
  const [dragFileBaruIdx, setDragFileBaruIdx] = useState<number | null>(null);
  const [dragOverFileBaruIdx, setDragOverFileBaruIdx] = useState<number | null>(null);

  function handleFileBaruDragStart(e: React.DragEvent, index: number) {
    setDragFileBaruIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }

  function handleFileBaruDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverFileBaruIdx !== index) {
      setDragOverFileBaruIdx(index);
    }
  }

  function handleFileBaruDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    if (dragFileBaruIdx !== null && dragFileBaruIdx !== targetIndex) {
      setFileBaru((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragFileBaruIdx, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
    }
    setDragFileBaruIdx(null);
    setDragOverFileBaruIdx(null);
  }

  function handleFileBaruDragEnd() {
    setDragFileBaruIdx(null);
    setDragOverFileBaruIdx(null);
  }

  function geserFileBaru(index: number, arah: -1 | 1) {
    const target = index + arah;
    if (target < 0 || target >= fileBaru.length) return;
    setFileBaru((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  }

  // ===== Drag and drop file upload dropzone =====
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  function handleDropFiles(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingFiles(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
      if (droppedFiles.length > 0) {
        setFileBaru((prev) => [...prev, ...droppedFiles]);
      }
    }
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
      sampaiTanggal: form.sampaiTanggal ? form.sampaiTanggal.trim() : undefined,
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
    tampilkanToast(editId ? 'Transaksi berhasil diperbarui' : 'Transaksi baru berhasil ditambahkan');
    await refetchRiwayat();
  }

  async function hapus(id: string) {
    if (!confirm('Hapus transaksi ini?')) return;
    const res = await hapusTransaksi(id, init.active);
    if (!res.success) {
      alert(res.error);
      return;
    }
    tampilkanToast('Transaksi berhasil dihapus');
    await refetchRiwayat();
  }

  async function ubahHighlight(t: Transaction, warna: WarnaHighlight) {
    await simpanHighlightCatatan({ workspace: init.active, rowIdx: t.id, warna, catatan: t.catatan });
    await refetchRiwayat();
  }

  const isAdaFilterAktif = Boolean(
    filter.search ||
      filter.tipe !== 'Semua' ||
      filter.warna !== 'Semua' ||
      filter.rekening ||
      filter.kategori ||
      filter.tanggal ||
      filter.bulan ||
      filter.tahun ||
      filter.startDate ||
      filter.endDate ||
      presetPeriode !== 'bulan'
  );

  if (loading) return <div className="text-sm text-slate-400 py-10 text-center">Memuat data...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2"
          >
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Daftar Transaksi</h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200">
              {listUrut.length} Catatan
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan mutasi kas, kategori, kuitansi bukti foto, dan rincian arus keuangan
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/laporan"
            className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-sky-700 bg-white hover:bg-sky-50/50 border border-slate-200 hover:border-sky-300 font-semibold px-3 py-2 rounded-xl transition shadow-xs active:scale-95"
            title="Cetak atau unduh laporan dari hasil filter ini"
          >
            <Printer size={14} className="text-sky-600" />
            <span>Cetak Laporan</span>
          </Link>
          <motion.button
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02 }}
            onClick={bukaTambah}
            className="flex items-center gap-1.5 text-xs bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white px-3.5 py-2 rounded-xl font-bold shrink-0 shadow-sm shadow-sky-600/20 transition-all"
          >
            <Plus size={15} strokeWidth={2.6} />
            <span>+ Catat Transaksi</span>
          </motion.button>
        </div>
      </div>

      {/* 3 Kartu Ringkasan Atas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Pemasukan */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-50/30 to-white border border-emerald-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Pemasukan Periode Ini</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <ArrowDownLeft size={17} strokeWidth={2.4} />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600 mt-2">{rp(totalTampil.masuk)}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>Arus dana masuk terverifikasi</span>
          </div>
        </div>

        {/* Pengeluaran */}
        <div className="bg-gradient-to-br from-rose-500/10 via-rose-50/30 to-white border border-rose-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800">Pengeluaran Periode Ini</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-xs">
              <ArrowUpRight size={17} strokeWidth={2.4} />
            </div>
          </div>
          <div className="text-xl font-black text-rose-600 mt-2">{rp(totalTampil.keluar)}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>Arus dana keluar terverifikasi</span>
          </div>
        </div>

        {/* Selisih Arus Kas Bersih */}
        <div className="bg-gradient-to-br from-sky-500/10 via-sky-50/30 to-white border border-sky-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-800">Arus Kas Bersih (Net)</span>
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shadow-xs">
              <Wallet size={17} strokeWidth={2.4} />
            </div>
          </div>
          <div className={`text-xl font-black mt-2 ${totalTampil.selisih >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
            {totalTampil.selisih >= 0 ? '+' : ''}
            {rp(totalTampil.selisih)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
            <span className={`font-semibold ${totalTampil.selisih >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {totalTampil.selisih >= 0 ? 'Surplus Finansial' : 'Defisit Pengeluaran'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Toolbar Area */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3.5">
        {/* Baris 1: Pencarian Cepat & Tombol Reset */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            <input
              suppressHydrationWarning
              value={filter.search}
              onChange={(e) => {
                setFilter((prev) => ({ ...prev, search: e.target.value }));
                setAturanSort(DEFAULT_SORT);
              }}
              placeholder="Cari keterangan, pihak terkait, kategori, sub kategori, atau catatan..."
              className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-inner transition outline-none"
            />
            {filter.search && (
              <button
                type="button"
                onClick={() => {
                  setFilter((prev) => ({ ...prev, search: '' }));
                  setAturanSort(DEFAULT_SORT);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {isAdaFilterAktif && (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                clearFilter();
                setPresetPeriode('bulan');
                setRentangKustom({ dari: '', sampai: '' });
                setRentangBulan({ dari: '', sampai: '' });
                setPilihBulan('');
                setAturanSort(DEFAULT_SORT);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 whitespace-nowrap shadow-xs hover:bg-rose-100 transition"
              title="Reset semua filter ke kondisi awal"
            >
              <X size={13} strokeWidth={2.5} />
              <span>Reset Filter</span>
            </motion.button>
          )}
        </div>

        {/* Baris 2: Preset Periode Horizontal Scroll */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Periode Waktu:</span>
            {filter.kategori && (
              <span className="text-[11px] text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <span>Kategori: <strong>{filter.kategori}</strong></span>
                <button
                  type="button"
                  onClick={() => setFilter((p) => ({ ...p, kategori: '' }))}
                  className="hover:text-red-500 ml-1"
                >
                  ×
                </button>
              </span>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 scroll-smooth">
            {(
              [
                { v: 'hari', label: 'Hari Ini' },
                { v: 'bulan', label: 'Bulan Ini' },
                { v: 'jarak_bulan', label: 'Jarak Bulan' },
                { v: 'pilih_bulan', label: 'Pilih Bulan' },
                { v: 'rentang', label: 'Rentang Tanggal' },
                { v: 'tahun', label: 'Tahun Ini' },
                { v: 'semua', label: 'Semua Transaksi' },
              ] as const
            ).map((p) => (
              <motion.button
                key={p.v}
                whileTap={{ scale: 0.94 }}
                onClick={() => applyPresetPreset(p.v)}
                className={`text-xs px-3.5 py-1.5 rounded-xl border whitespace-nowrap shrink-0 font-medium transition-all ${
                  presetPeriode === p.v
                    ? 'bg-slate-900 border-slate-900 text-white shadow-xs font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Panel Filter Jarak Pilih Bulan */}
        {presetPeriode === 'jarak_bulan' && (
          <div className="bg-sky-50/50 border border-sky-200/80 rounded-2xl p-3.5 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <CalendarRange size={15} className="text-sky-600" />
                <span>Filter Jarak Pilih Bulan</span>
              </div>
              {rentangBulan.dari && rentangBulan.sampai && (
                <span className="text-[11px] text-sky-800 font-bold bg-white border border-sky-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                  {formatBulanIndo(rentangBulan.dari)} s/d {formatBulanIndo(rentangBulan.sampai)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dari Bulan</label>
                <input
                  suppressHydrationWarning
                  type="month"
                  value={rentangBulan.dari}
                  onChange={(e) => ubahRentangBulan({ dari: e.target.value })}
                  className="w-full bg-white border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-slate-700 shadow-xs outline-none transition"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sampai Bulan</label>
                <input
                  suppressHydrationWarning
                  type="month"
                  value={rentangBulan.sampai}
                  onChange={(e) => ubahRentangBulan({ sampai: e.target.value })}
                  className="w-full bg-white border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-slate-700 shadow-xs outline-none transition"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-sky-200/60">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Pilihan Cepat Jarak Bulan:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '3 Bulan Terakhir', dari: getBulanIsoRelatif(-2), sampai: getBulanIsoRelatif(0) },
                  { label: '6 Bulan Terakhir', dari: getBulanIsoRelatif(-5), sampai: getBulanIsoRelatif(0) },
                  { label: 'Kuartal 1 (Jan - Mar)', dari: `${new Date().getFullYear()}-01`, sampai: `${new Date().getFullYear()}-03` },
                  { label: 'Kuartal 2 (Apr - Jun)', dari: `${new Date().getFullYear()}-04`, sampai: `${new Date().getFullYear()}-06` },
                  { label: 'Kuartal 3 (Jul - Sep)', dari: `${new Date().getFullYear()}-07`, sampai: `${new Date().getFullYear()}-09` },
                  { label: 'Kuartal 4 (Okt - Des)', dari: `${new Date().getFullYear()}-10`, sampai: `${new Date().getFullYear()}-12` },
                  { label: 'Semester 1 (Jan - Jun)', dari: `${new Date().getFullYear()}-01`, sampai: `${new Date().getFullYear()}-06` },
                  { label: 'Semester 2 (Jul - Des)', dari: `${new Date().getFullYear()}-07`, sampai: `${new Date().getFullYear()}-12` },
                ].map((c) => {
                  const isAktif = rentangBulan.dari === c.dari && rentangBulan.sampai === c.sampai;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => ubahRentangBulan({ dari: c.dari, sampai: c.sampai })}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition font-medium ${
                        isAktif
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300 hover:text-sky-700'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Panel Filter Pilih 1 Bulan Tertentu */}
        {presetPeriode === 'pilih_bulan' && (
          <div className="bg-sky-50/50 border border-sky-200/80 rounded-2xl p-3.5 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Calendar size={15} className="text-sky-600" />
                <span>Pilih 1 Bulan Tertentu</span>
              </div>
              {pilihBulan && (
                <span className="text-[11px] text-sky-800 font-bold bg-white border border-sky-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                  {formatBulanIndo(pilihBulan)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                suppressHydrationWarning
                type="month"
                value={pilihBulan}
                onChange={(e) => ubahPilihBulan(e.target.value)}
                className="flex-1 bg-white border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-slate-700 shadow-xs outline-none transition"
              />
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                  ubahPilihBulan(cur);
                }}
                className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 px-3 py-2 rounded-xl whitespace-nowrap shadow-xs active:scale-95 transition"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  now.setDate(1);
                  now.setMonth(now.getMonth() - 1);
                  const val = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                  ubahPilihBulan(val);
                }}
                className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 px-3 py-2 rounded-xl whitespace-nowrap shadow-xs active:scale-95 transition"
              >
                Bulan Lalu
              </button>
            </div>
          </div>
        )}

        {/* Panel Filter Rentang Tanggal Spesifik */}
        {presetPeriode === 'rentang' && (
          <div className="bg-sky-50/50 border border-sky-200/80 rounded-2xl p-3.5 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800">Rentang Tanggal Spesifik</div>
              {rentangKustom.dari && rentangKustom.sampai && (
                <span className="text-[11px] text-sky-800 font-bold bg-white border border-sky-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                  {rentangKustom.dari} s/d {rentangKustom.sampai}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dari Tanggal</label>
                <input
                  suppressHydrationWarning
                  type="date"
                  value={rentangKustom.dari}
                  onChange={(e) => ubahRentangTanggal({ dari: e.target.value })}
                  className="w-full bg-white border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-2 text-xs shadow-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sampai Tanggal</label>
                <input
                  suppressHydrationWarning
                  type="date"
                  value={rentangKustom.sampai}
                  onChange={(e) => ubahRentangTanggal({ sampai: e.target.value })}
                  className="w-full bg-white border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-2 text-xs shadow-xs outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Baris 3: Segment Tipe, Filter Dropdowns & Tombol Urutkan */}
        <div className="relative space-y-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Segment Tipe */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/70 shrink-0">
              {(['Semua', 'Pemasukan', 'Pengeluaran'] as const).map((f) => (
                <motion.button
                  key={f}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    setFilter((prev) => ({ ...prev, tipe: f }));
                    setAturanSort(DEFAULT_SORT);
                  }}
                  className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                    filter.tipe === f
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {f}
                </motion.button>
              ))}
            </div>

            {/* Tombol Urutkan */}
            <SortMenu aturan={aturanSort} onTerapkan={setAturanSort} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Rekening Select */}
            <div className="relative">
              <select
                suppressHydrationWarning
                value={filter.rekening}
                onChange={(e) => {
                  setFilter((prev) => ({ ...prev, rekening: e.target.value }));
                  setAturanSort(DEFAULT_SORT);
                }}
                className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl pl-3 pr-8 py-2 text-xs text-slate-700 shadow-xs outline-none focus:border-sky-500 transition appearance-none cursor-pointer"
              >
                <option value="">Semua Rekening</option>
                {init.rekenings.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Warna Highlight Select */}
            <div className="relative">
              <select
                suppressHydrationWarning
                value={filter.warna}
                onChange={(e) => {
                  setFilter((prev) => ({ ...prev, warna: e.target.value as 'Semua' | WarnaHighlight }));
                  setAturanSort(DEFAULT_SORT);
                }}
                className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl pl-3 pr-8 py-2 text-xs text-slate-700 shadow-xs outline-none focus:border-sky-500 transition appearance-none cursor-pointer"
              >
                <option value="Semua">Semua Warna Highlight</option>
                {DAFTAR_WARNA_HIGHLIGHT.map((w) => (
                  <option key={w.value || 'none'} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Info Jumlah Transaksi & Sort Indicator */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-400">
        <span className="font-medium">
          Menampilkan <strong className="text-slate-700">{listUrut.length}</strong> transaksi
        </span>
        {aturanSort.length > 0 && (
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <span>Urutan:</span>
            <strong className="text-sky-700 font-semibold">
              {aturanSort[0].kolom === 'tanggal'
                ? aturanSort[0].arah === 'desc'
                  ? 'Tanggal Terbaru ke Terlama'
                  : 'Tanggal Terlama ke Terbaru'
                : `${aturanSort[0].kolom} (${aturanSort[0].arah})`}
            </strong>
          </span>
        )}
      </div>

      {/* Daftar Kartu Transaksi */}
      <div className="space-y-2.5">
        {listUrut.map((t) => {
          const hex = t.warna_highlight ? warnaHighlightHex(t.warna_highlight) : undefined;
          const isPemasukan = t.tipe === 'Pemasukan';
          const isAkumulasi = t.sampai_tanggal && t.sampai_tanggal !== t.tanggal;

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-2xl border p-4 shadow-xs hover:shadow-md transition-all relative overflow-hidden group ${
                isPemasukan ? 'border-l-4 border-l-emerald-500 border-slate-200/90' : 'border-l-4 border-l-rose-500 border-slate-200/90'
              }`}
              style={hex ? { background: hex } : undefined}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                {/* Info Kiri */}
                <div className="flex-1 space-y-1.5 cursor-pointer" onClick={() => bukaEdit(t)}>
                  {/* Judul & Tipe Badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm sm:text-base font-bold text-slate-800 group-hover:text-sky-700 transition-colors">
                      {t.keterangan}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isPemasukan
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {t.tipe}
                    </span>
                    {t.status_bayar === 'DP' && (
                      <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                        DP / Cicilan
                      </span>
                    )}
                  </div>

                  {/* Metadata Chips: Kategori, Tanggal, Rekening, Pihak */}
                  <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
                    {/* Chip Kategori & Sub Kategori */}
                    <span
                      className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border ${warnaChipKategori(
                        t.kategori
                      )}`}
                    >
                      {t.kategori}
                      {t.sub_kategori ? ` » ${t.sub_kategori}` : ''}
                    </span>

                    {/* Tanggal */}
                    <span className="text-slate-500 flex items-center gap-1 font-medium bg-slate-50 border border-slate-200/70 px-2 py-0.5 rounded-lg text-[11px]">
                      <Calendar size={12} className="text-slate-400" />
                      {isAkumulasi ? `${t.tanggal} s/d ${t.sampai_tanggal}` : t.tanggal}
                      {t.jam ? ` • ${t.jam}` : ''}
                    </span>

                    {/* Akun Rekening */}
                    <span className="text-slate-600 flex items-center gap-1 font-semibold bg-slate-50 border border-slate-200/70 px-2 py-0.5 rounded-lg text-[11px]">
                      <Wallet size={12} className="text-slate-400" />
                      {t.rekening}
                    </span>

                    {/* Pihak Terkait */}
                    {t.pihak_terkait && (
                      <span className="text-slate-600 flex items-center gap-1 bg-slate-50 border border-slate-200/70 px-2 py-0.5 rounded-lg text-[11px]">
                        <User size={12} className="text-slate-400" />
                        <span className="font-medium text-slate-700">{t.pihak_terkait}</span>
                      </span>
                    )}

                    {isAkumulasi && (
                      <span className="text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-md">
                        Akumulasi Rentang
                      </span>
                    )}
                  </div>

                  {/* Catatan Khusus */}
                  {t.catatan && (
                    <div className="text-xs text-amber-800 bg-amber-50/80 border border-amber-200/80 rounded-xl px-3 py-1.5 mt-1 inline-block">
                      💡 {t.catatan}
                    </div>
                  )}
                </div>

                {/* Sisi Kanan: Nominal & Tombol Aksi */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div
                    className={`font-black text-base sm:text-lg tracking-tight ${
                      isPemasukan ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {isPemasukan ? '+' : '-'}
                    {rp(t.nominal)}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => bukaEdit(t)}
                      className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition active:scale-95"
                      title="Edit transaksi"
                    >
                      <Edit3 size={13} />
                      <span className="hidden sm:inline">Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => hapus(t.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition active:scale-95"
                      title="Hapus transaksi"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Baris Bawah: Warna Highlight Picker & Bukti Transaksi */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {/* Highlight Dots */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-400">Tandai Warna:</span>
                  <div className="flex items-center gap-1">
                    {DAFTAR_WARNA_HIGHLIGHT.map((w) => (
                      <button
                        key={w.value}
                        type="button"
                        onClick={() => ubahHighlight(t, w.value)}
                        className={`w-4 h-4 rounded-full border transition-all ${
                          t.warna_highlight === w.value
                            ? 'ring-2 ring-slate-700 scale-110 shadow-xs'
                            : 'border-slate-300 hover:scale-105'
                        }`}
                        style={{ background: w.hex || '#ffffff' }}
                        title={w.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Bukti Transaksi (Kuitansi / Foto) */}
                {t.bukti && t.bukti.length > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                      <ImageIcon size={12} className="text-sky-600" />
                      <span>{t.bukti.length} Bukti Foto</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {t.bukti.slice(0, 3).map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => bukaPreviewBukti(t.bukti || [], i, t.keterangan)}
                          className="relative group/thumb rounded-lg border border-slate-200 overflow-hidden hover:ring-2 hover:ring-sky-400 transition shadow-2xs"
                          title="Klik untuk memperbesar bukti"
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
                        </button>
                      ))}
                      {t.bukti.length > 3 && (
                        <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md">
                          +{t.bukti.length - 3}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => bukaPreviewBukti(t.bukti || [], 0, t.keterangan)}
                        className="text-[11px] text-sky-700 hover:text-sky-800 font-bold bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2 py-0.5 rounded-lg transition"
                      >
                        Lihat Foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 italic">Tanpa lampiran bukti foto</div>
                )}
              </div>
            </motion.div>
          );
        })}

        {listUrut.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Receipt size={20} />
            </div>
            <div className="text-sm font-semibold text-slate-700">Tidak ada transaksi yang cocok</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Coba sesuaikan preset periode waktu, kata kunci pencarian, atau reset filter untuk menampilkan semua data.
            </p>
            {isAdaFilterAktif && (
              <button
                type="button"
                onClick={() => {
                  clearFilter();
                  setPresetPeriode('bulan');
                  setRentangKustom({ dari: '', sampai: '' });
                  setRentangBulan({ dari: '', sampai: '' });
                  setPilihBulan('');
                  setAturanSort(DEFAULT_SORT);
                }}
                className="mt-2 text-xs font-bold text-sky-600 hover:underline"
              >
                Reset Semua Filter Sekarang
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Transaksi */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Transaksi' : 'Tambah Transaksi Baru'}>
        <div className="space-y-3.5">
          {!editId && (
            <AiInput
              katMasuk={init.katMasuk}
              katKeluar={init.katKeluar}
              rekenings={init.rekenings}
              onHasil={terapkanHasilAi}
              onFoto={(files) => setFileBaru((prev) => [...prev, ...files])}
            />
          )}

          {/* Tipe Selector Switch */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {(['Pengeluaran', 'Pemasukan'] as const).map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setForm((f) => ({ ...f, tipe: tp, kategori: '', subKategori: '' }))}
                className={`flex-1 text-xs py-2 rounded-lg font-bold transition-all ${
                  form.tipe === tp
                    ? tp === 'Pemasukan'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tp === 'Pemasukan' ? '+ Pemasukan' : '- Pengeluaran'}
              </button>
            ))}
          </div>

          {/* Tanggal & Akumulasi */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field label="Dari Tanggal">
                <input
                  type="date"
                  value={form.tanggal}
                  onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
                  className="inp"
                />
              </Field>
              <Field label="Sampai Tanggal (opsional)">
                <input
                  type="date"
                  value={form.sampaiTanggal}
                  onChange={(e) => setForm((f) => ({ ...f, sampaiTanggal: e.target.value }))}
                  className="inp"
                />
              </Field>
            </div>
            <div className="text-[10.5px] text-slate-500 bg-slate-50 border border-slate-200/60 p-2 rounded-xl">
              💡 Isi <strong>Sampai Tanggal</strong> jika transaksi ini merupakan akumulasi rentang hari (contoh: belanja mingguan).
            </div>
            <Field label="Jam (opsional)">
              <input
                type="time"
                value={form.jam}
                onChange={(e) => setForm((f) => ({ ...f, jam: e.target.value }))}
                className="inp"
              />
            </Field>
          </div>

          {/* Kategori & Sub Kategori */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Kategori">
              <select
                value={form.kategori}
                onChange={(e) => setForm((f) => ({ ...f, kategori: e.target.value, subKategori: '' }))}
                className="inp"
              >
                <option value="">Pilih kategori...</option>
                {daftarKategori.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Sub Kategori (opsional)">
              <select
                value={form.subKategori}
                onChange={(e) => setForm((f) => ({ ...f, subKategori: e.target.value }))}
                className="inp"
                disabled={daftarSub.length === 0}
              >
                <option value="">{daftarSub.length === 0 ? '- Tanpa Sub Kategori -' : 'Pilih sub kategori...'}</option>
                {daftarSub.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Keterangan */}
          <Field label="Keterangan Transaksi">
            <input
              placeholder="Contoh: Belanja bahan dapur, Gajian bulanan, Bayar listrik"
              value={form.keterangan}
              onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))}
              className="inp"
            />
          </Field>

          {/* Nominal & Rekening */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Nominal (Rp)">
              <input
                type="number"
                placeholder="0"
                value={form.nominal}
                onChange={(e) => setForm((f) => ({ ...f, nominal: e.target.value }))}
                className="inp"
              />
            </Field>
            <Field label="Rekening / Akun Kas">
              <select
                value={form.rekening}
                onChange={(e) => setForm((f) => ({ ...f, rekening: e.target.value }))}
                className="inp"
              >
                {init.rekenings.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Pihak Terkait */}
          <Field label="Pihak Terkait (opsional)">
            <input
              placeholder="Contoh: Toko Berkah, Karyawan A, Nama Klien"
              value={form.pihakTerkait}
              onChange={(e) => setForm((f) => ({ ...f, pihakTerkait: e.target.value }))}
              className="inp"
            />
          </Field>

          {/* DP / Cicilan Checkbox */}
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.statusBayar === 'DP'}
                onChange={(e) => setForm((f) => ({ ...f, statusBayar: e.target.checked ? 'DP' : 'Lunas' }))}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
              />
              <span>Ini merupakan transaksi Uang Muka (DP) / Cicilan</span>
            </label>

            {form.statusBayar === 'DP' && (
              <Field label="Total Tagihan / Kontrak Penuh (Rp)">
                <input
                  type="number"
                  placeholder="Total nominal penuh sebelum dikurangi DP"
                  value={form.totalTagihan}
                  onChange={(e) => setForm((f) => ({ ...f, totalTagihan: e.target.value }))}
                  className="inp bg-white"
                />
              </Field>
            )}
          </div>

          {/* Catatan Tambahan */}
          <Field label="Catatan Tambahan (opsional)">
            <textarea
              placeholder="Tambahkan detail catatan atau pengingat..."
              value={form.catatan}
              onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))}
              className="inp"
              rows={2}
            />
          </Field>

          {/* Upload Bukti Foto / Struk */}
          <Field label="Bukti Transaksi / Foto Kuitansi (Bisa lebih dari 1)">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFiles(true);
              }}
              onDragLeave={() => setIsDraggingFiles(false)}
              onDrop={handleDropFiles}
              className={`relative border-2 border-dashed rounded-2xl p-4 text-center transition-all ${
                isDraggingFiles
                  ? 'border-sky-500 bg-sky-50/80 scale-[1.01]'
                  : 'border-slate-300 hover:border-sky-400 bg-slate-50/60 hover:bg-sky-50/30'
              }`}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                id="upload-bukti-input"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setFileBaru((prev) => [...prev, ...files]);
                  e.target.value = '';
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shadow-xs">
                  <UploadCloud size={18} />
                </div>
                <div className="text-xs font-bold text-slate-700">
                  <span>Klik atau seret foto kuitansi ke sini</span>
                </div>
                <div className="text-[10px] text-slate-400">JPG, PNG, WEBP (Otomatis dikompresi agar ringan)</div>
              </div>
            </div>

            {/* Hint Geser Urutan */}
            {(buktiLama.length > 1 || fileBaru.length > 1) && (
              <div className="flex items-center gap-1.5 mt-2 text-[10.5px] text-sky-700 bg-sky-50 px-2.5 py-1.5 rounded-xl border border-sky-200">
                <GripVertical size={13} className="shrink-0 text-sky-500" />
                <span>Geser &amp; lepas (drag &amp; drop) atau gunakan tombol ‹ › untuk mengatur urutan gambar.</span>
              </div>
            )}

            {/* Bukti Tersimpan (Existing) */}
            {buktiLama.length > 0 && (
              <div className="space-y-1.5 mt-3">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-700">
                  <span className="flex items-center gap-1">
                    <ImageIcon size={13} className="text-slate-500" />
                    Bukti Tersimpan ({buktiLama.length}):
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Klik × untuk menghapus</span>
                </div>
                <div className="flex flex-wrap gap-2.5 pt-0.5">
                  {buktiLama.map((url, i) => {
                    const isDragging = dragBuktiLamaIdx === i;
                    const isOver = dragOverBuktiLamaIdx === i;
                    return (
                      <div
                        key={i}
                        draggable
                        onDragStart={(e) => handleBuktiLamaDragStart(e, i)}
                        onDragOver={(e) => handleBuktiLamaDragOver(e, i)}
                        onDrop={(e) => handleBuktiLamaDrop(e, i)}
                        onDragEnd={handleBuktiLamaDragEnd}
                        className={`relative group rounded-xl p-1 border-2 transition-all cursor-grab active:cursor-grabbing bg-white shadow-xs select-none ${
                          isDragging
                            ? 'opacity-40 border-sky-400 scale-95'
                            : isOver
                            ? 'border-sky-500 ring-2 ring-sky-300 scale-105'
                            : 'border-slate-200 hover:border-sky-400 hover:shadow-md'
                        }`}
                        title="Tahan dan geser untuk mengubah urutan"
                      >
                        <div className="absolute -top-2 -left-2 bg-slate-800 text-white text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md z-10">
                          {i + 1}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            hapusBuktiLama(i);
                          }}
                          title="Hapus bukti ini"
                          className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-md transition z-10"
                        >
                          ×
                        </button>
                        <button
                          type="button"
                          onClick={() => bukaPreviewBukti(buktiLama, i, 'Bukti Tersimpan')}
                          className="block rounded-lg overflow-hidden focus:outline-none"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Bukti ${i + 1}`}
                            className="w-16 h-16 object-cover bg-slate-100 pointer-events-none rounded-lg"
                            onError={(e) => {
                              e.currentTarget.src = FALLBACK_RECEIPT_SVG;
                            }}
                          />
                        </button>
                        <div className="flex items-center justify-between mt-1 px-0.5">
                          <button
                            type="button"
                            disabled={i === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              geserBuktiLama(i, -1);
                            }}
                            className="w-4 h-4 rounded bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 disabled:opacity-20 flex items-center justify-center text-[10px] font-bold"
                          >
                            ‹
                          </button>
                          <GripVertical size={11} className="text-slate-400" />
                          <button
                            type="button"
                            disabled={i === buktiLama.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              geserBuktiLama(i, 1);
                            }}
                            className="w-4 h-4 rounded bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 disabled:opacity-20 flex items-center justify-center text-[10px] font-bold"
                          >
                            ›
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bukti Baru Ditambahkan */}
            {fileBaru.length > 0 && (
              <div className="space-y-1.5 mt-3">
                <div className="flex justify-between items-center text-[11px] font-bold text-emerald-700">
                  <span className="flex items-center gap-1">
                    <ImageIcon size={13} className="text-emerald-600" />
                    Bukti Baru Dipilih ({fileBaru.length}):
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Klik × untuk membatalkan</span>
                </div>
                <div className="flex flex-wrap gap-2.5 pt-0.5">
                  {fileBaru.map((file, i) => {
                    const objectUrl = fileBaruUrls[i];
                    const isDragging = dragFileBaruIdx === i;
                    const isOver = dragOverFileBaruIdx === i;
                    return (
                      <div
                        key={i}
                        draggable
                        onDragStart={(e) => handleFileBaruDragStart(e, i)}
                        onDragOver={(e) => handleFileBaruDragOver(e, i)}
                        onDrop={(e) => handleFileBaruDrop(e, i)}
                        onDragEnd={handleFileBaruDragEnd}
                        className={`relative group rounded-xl p-1 border-2 transition-all cursor-grab active:cursor-grabbing bg-white shadow-xs select-none ${
                          isDragging
                            ? 'opacity-40 border-emerald-400 scale-95'
                            : isOver
                            ? 'border-emerald-500 ring-2 ring-emerald-300 scale-105'
                            : 'border-emerald-200 hover:border-emerald-400 hover:shadow-md'
                        }`}
                        title="Tahan dan geser untuk mengubah urutan"
                      >
                        <div className="absolute -top-2 -left-2 bg-emerald-700 text-white text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md z-10">
                          {i + 1}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            hapusFileBaru(i);
                          }}
                          className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-md transition z-10"
                        >
                          ×
                        </button>
                        <button
                          type="button"
                          onClick={() => objectUrl && bukaPreviewBukti(fileBaruUrls, i, 'Bukti Baru')}
                          className="block rounded-lg overflow-hidden focus:outline-none"
                        >
                          {objectUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={objectUrl}
                              alt={file.name}
                              className="w-16 h-16 object-cover bg-slate-100 pointer-events-none rounded-lg"
                            />
                          )}
                        </button>
                        <div className="flex items-center justify-between mt-1 px-0.5">
                          <button
                            type="button"
                            disabled={i === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              geserFileBaru(i, -1);
                            }}
                            className="w-4 h-4 rounded bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 disabled:opacity-20 flex items-center justify-center text-[10px] font-bold"
                          >
                            ‹
                          </button>
                          <GripVertical size={11} className="text-slate-400" />
                          <button
                            type="button"
                            disabled={i === fileBaru.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              geserFileBaru(i, 1);
                            }}
                            className="w-4 h-4 rounded bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 disabled:opacity-20 flex items-center justify-center text-[10px] font-bold"
                          >
                            ›
                          </button>
                        </div>
                        <span className="block text-[9px] text-slate-500 truncate max-w-[64px] text-center mt-0.5">
                          {file.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Field>

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
            {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
          </button>
        </div>
      </Modal>

      {/* Modal Preview Bukti Penuh (Lightbox) */}
      <Modal open={!!previewBuktiUrl} onClose={tutupPreviewBukti} title={previewBuktiTitle || 'Preview Bukti Transaksi'}>
        <div className="space-y-3">
          <div className="relative bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center p-3 min-h-[260px] max-h-[70vh]">
            {previewBuktiUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewBuktiUrl}
                alt="Preview Bukti"
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_RECEIPT_SVG;
                }}
              />
            )}

            {previewBuktiDaftar.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={previewSebelumnya}
                  aria-label="Bukti sebelumnya"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center text-lg transition shadow-md"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={previewBerikutnya}
                  aria-label="Bukti berikutnya"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center text-lg transition shadow-md"
                >
                  ›
                </button>
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-white bg-black/60 px-3 py-1 rounded-full shadow-md">
                  {previewBuktiIndex + 1} / {previewBuktiDaftar.length}
                </div>
              </>
            )}
          </div>

          {previewBuktiDaftar.length > 1 && (
            <div className="flex items-center justify-center gap-1.5">
              {previewBuktiDaftar.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Lihat bukti ${i + 1}`}
                  onClick={() => setPreviewBuktiIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === previewBuktiIndex ? 'bg-sky-600 w-5' : 'bg-slate-300 w-1.5'
                  }`}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={previewBuktiUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                download="bukti-transaksi.jpg"
                className="text-xs text-sky-700 hover:text-sky-800 font-bold flex items-center gap-1.5 border border-sky-300 px-3 py-1.5 rounded-xl bg-sky-50 shadow-xs transition active:scale-95"
              >
                <Download size={13} />
                <span>Unduh Gambar Ini</span>
              </a>

              <button
                type="button"
                onClick={() => unduhSemuaBuktiZip(previewBuktiDaftar, previewBuktiLabel)}
                disabled={isDownloadingZip || previewBuktiDaftar.length === 0}
                className="text-xs text-white bg-slate-800 hover:bg-slate-900 active:bg-black font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl shadow-xs transition disabled:opacity-50 active:scale-95"
              >
                <Archive size={13} />
                <span>{isDownloadingZip ? 'Mengompres ZIP...' : `Unduh Semua ZIP (${previewBuktiDaftar.length})`}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {modalOpen && editId && previewBuktiUrl && buktiLama.includes(previewBuktiUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    const urlDihapus = previewBuktiUrl;
                    setBuktiLama((prev) => prev.filter((u) => u !== urlDihapus));
                    if (previewBuktiDaftar.length <= 1) {
                      tutupPreviewBukti();
                    } else {
                      setPreviewBuktiDaftar((prev) => prev.filter((u) => u !== urlDihapus));
                      setPreviewBuktiIndex((i) => Math.min(i, previewBuktiDaftar.length - 2));
                    }
                  }}
                  className="text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold px-3 py-1.5 rounded-xl transition"
                >
                  Hapus Bukti Ini
                </button>
              )}

              <button
                type="button"
                onClick={tutupPreviewBukti}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-1.5 rounded-xl font-bold transition"
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
          border-radius: 12px;
          padding: 8px 12px;
          font-size: 13px;
          background: #ffffff;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .inp:focus {
          border-color: #0284c7;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-700">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function SortMenu({ aturan, onTerapkan }: { aturan: AturanSort[]; onTerapkan: (a: AturanSort[]) => void }) {
  const [terbuka, setTerbuka] = useState(false);
  const [pilihTerbuka, setPilihTerbuka] = useState(false);
  const [draft, setDraft] = useState<AturanSort[]>(aturan);
  const wadah = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!terbuka) return;
    function klikLuar(e: MouseEvent | TouchEvent) {
      if (wadah.current && !wadah.current.contains(e.target as Node)) {
        setTerbuka(false);
        setPilihTerbuka(false);
      }
    }
    function tekanTombol(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setTerbuka(false);
        setPilihTerbuka(false);
      }
    }
    document.addEventListener('mousedown', klikLuar);
    document.addEventListener('touchstart', klikLuar);
    document.addEventListener('keydown', tekanTombol);
    return () => {
      document.removeEventListener('mousedown', klikLuar);
      document.removeEventListener('touchstart', klikLuar);
      document.removeEventListener('keydown', tekanTombol);
    };
  }, [terbuka]);

  function toggle() {
    if (terbuka) {
      setTerbuka(false);
      setPilihTerbuka(false);
      return;
    }
    setDraft(aturan);
    setTerbuka(true);
  }

  const kolomTersisa = KOLOM_SORT.filter((k) => !draft.some((d) => d.kolom === k.key));
  const berubah = JSON.stringify(draft) !== JSON.stringify(aturan);

  return (
    <div className="sm:relative" ref={wadah}>
      <button
        type="button"
        onClick={toggle}
        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition active:scale-95 shadow-xs ${
          aturan.length > 0 ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-white border-slate-200 text-slate-700'
        }`}
      >
        <ArrowUpDown size={14} />
        <span>Urutkan</span>
        {aturan.length > 0 && (
          <span className="text-[10px] font-bold bg-sky-200/80 text-sky-800 px-1.5 py-0.5 rounded-md">
            {aturan[0].kolom === 'tanggal'
              ? aturan[0].arah === 'desc'
                ? 'Baru → Lama'
                : 'Lama → Baru'
              : `${aturan[0].kolom} (${aturan[0].arah})`}
          </span>
        )}
      </button>

      {terbuka && (
        <div className="absolute inset-x-0 mt-2 z-30 sm:inset-x-auto sm:right-0 sm:top-full sm:w-[19rem] bg-white rounded-2xl border border-slate-200 shadow-xl p-4">
          {draft.length === 0 ? (
            <div className="mb-3">
              <div className="text-sm font-bold text-slate-800">Belum ada aturan pengurutan</div>
              <div className="text-xs text-slate-400 mt-0.5">Tambahkan kolom di bawah untuk mengurutkan transaksi</div>
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {draft.map((d, i) => {
                const info = KOLOM_SORT.find((k) => k.key === d.kolom);
                if (!info) return null;
                return (
                  <div key={d.kolom} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold w-3 text-center">{i + 1}</span>
                    <span className="flex-1 text-xs font-semibold text-slate-700 truncate">{info.label}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((cur) => cur.map((x) => (x.kolom === d.kolom ? { ...x, arah: x.arah === 'asc' ? 'desc' : 'asc' } : x)))
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition"
                    >
                      {d.arah === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                      {LABEL_ARAH[info.tipe][d.arah]}
                    </button>
                    <button
                      type="button"
                      aria-label={`Hapus urutan ${info.label}`}
                      onClick={() => setDraft((cur) => cur.filter((x) => x.kolom !== d.kolom))}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {kolomTersisa.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPilihTerbuka((v) => !v)}
                className="w-full flex items-center justify-between text-xs font-medium text-slate-600 border border-dashed border-slate-300 rounded-xl px-3 py-2 hover:bg-slate-50 transition"
              >
                <span>{draft.length === 0 ? 'Pilih kolom untuk diurutkan' : '+ Tambah kolom pengurutan'}</span>
                <ChevronDown size={14} className={`transition-transform ${pilihTerbuka ? 'rotate-180' : ''}`} />
              </button>
              {pilihTerbuka && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-lg py-1 max-h-56 overflow-auto">
                  {kolomTersisa.map((k) => (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => {
                        setDraft((cur) => [...cur, { kolom: k.key, arah: k.arahAwal }]);
                        setPilihTerbuka(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-50 transition"
                    >
                      <span className="text-slate-700 font-semibold">{k.label}</span>
                      <span className="text-[10px] text-slate-400">{k.tipe}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mt-3.5 pt-3 border-t border-slate-100">
            {draft.length > 0 ? (
              <button type="button" onClick={() => setDraft([])} className="text-xs text-slate-400 hover:text-red-500 font-medium">
                Hapus Semua
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              disabled={!berubah}
              onClick={() => {
                onTerapkan(draft);
                setTerbuka(false);
                setPilihTerbuka(false);
              }}
              className="text-xs font-bold px-3.5 py-2 rounded-xl bg-slate-900 text-white disabled:bg-slate-100 disabled:text-slate-300 transition shadow-xs"
            >
              Terapkan Pengurutan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
