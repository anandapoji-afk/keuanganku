'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Search, Plus, X, ArrowDownLeft, ArrowUpRight, Filter, Receipt, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Printer, Archive, Download, UploadCloud, GripVertical, ChevronLeft, ChevronRight, Image as ImageIcon, CalendarRange, Calendar } from 'lucide-react';
import JSZip from 'jszip';
import { useAppData } from '@/components/layout/AppDataProvider';
import Modal from '@/components/ui/Modal';
import { rp, DAFTAR_WARNA_HIGHLIGHT, warnaHighlightHex, formatBulanIndo } from '@/lib/utils';
import { simpanTransaksi, hapusTransaksi, simpanHighlightCatatan } from '@/lib/actions/transaksi';
import type { SimpanTransaksiPayload, Transaction, Tipe, StatusBayar, WarnaHighlight } from '@/lib/types';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Jika file bukan gambar, lewati proses resize dan gunakan FileReader bawaan
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl); // Bebaskan memori browser

      // Tentukan batas maksimal resolusi (1280px cukup tajam untuk struk namun sangat ringan)
      const MAX_WIDTH = 1280;
      const MAX_HEIGHT = 1280;
      let width = img.width;
      let height = img.height;

      // Hitung dimensi baru sambil mempertahankan rasio aspek
      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Gagal memuat canvas context'));
        return;
      }

      // Gambar ulang file dengan ukuran yang sudah disesuaikan
      ctx.drawImage(img, 0, 0, width, height);

      // Kompresi ke JPEG dengan kualitas 80% (kecuali untuk PNG agar transparansi aman)
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = 0.8;

      const dataUrl = canvas.toDataURL(mimeType, quality);
      resolve(dataUrl.split(',')[1]); // Ambil string base64 mentahnya saja
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Fallback ke FileReader jika gambar gagal dimuat (misal format tidak dikenali DOM)
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

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
  date: { asc: 'Lama \u2192 Baru', desc: 'Baru \u2192 Lama' },
  timestamp: { asc: 'Lama \u2192 Baru', desc: 'Baru \u2192 Lama' },
  number: { asc: '1 \u2192 9', desc: '9 \u2192 1' },
  text: { asc: 'A \u2192 Z', desc: 'Z \u2192 A' },
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
  d.setDate(1); // Mencegah bug loncat bulan di tanggal 31
  d.setMonth(d.getMonth() + deltaBulan);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

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
  // Daftar url pada konteks yang sedang dibuka (riwayat / bukti lama / bukti baru)
  // + index aktif di dalamnya — dipakai utk navigasi Berikutnya/Sebelumnya di lightbox.
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

  // Default pengurutan transaksi otomatis ke "Tanggal: Baru ke Lama"
  const [aturanSort, setAturanSort] = useState<AturanSort[]>(DEFAULT_SORT);

  // Saat filter apa pun diterapkan atau berubah, pastikan urutan tanggal Baru ke Lama otomatis menjadi default
  useEffect(() => {
    setAturanSort(DEFAULT_SORT);
  }, [filter]);

  // Urut berjenjang sesuai aturan; jika aturan kosong otomatis pakai DEFAULT_SORT (Tanggal: Baru ke Lama)
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

    return { masuk, keluar };
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
      clearFilter();
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
        dari = getBulanIsoRelatif(-2); // 3 bulan terakhir (2 bulan lalu s/d bulan ini)
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

  // Tutup lightbox otomatis kalau blob URL yang sedang dipreview sudah di-revoke
  // (misal user hapus/tambah file baru saat lightbox masih terbuka).
  useEffect(() => {
    if (previewBuktiUrl && previewBuktiUrl.startsWith('blob:') && !fileBaruUrls.includes(previewBuktiUrl)) {
      setPreviewBuktiDaftar([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileBaruUrls]);

  // daftar = semua url pada konteks yang sama (array bukti 1 transaksi, atau
  // buktiLama, atau fileBaruUrls) supaya Berikutnya/Sebelumnya bisa menyusurinya.
  // label = prefix judul tanpa nomor urut, nomor urutnya dihitung otomatis dari index.
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

  // Unduh semua bukti dalam daftar lightbox sebagai file zip dengan nama sesuai keterangan transaksi
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

  // Navigasi keyboard di lightbox (desktop): kiri/kanan ganti bukti, Esc tutup.
  useEffect(() => {
    if (previewBuktiDaftar.length === 0) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') previewSebelumnya();
      else if (e.key === 'ArrowRight') previewBerikutnya();
      else if (e.key === 'Escape') tutupPreviewBukti();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
              suppressHydrationWarning
              value={filter.search}
              onChange={(e) => {
                setFilter((prev) => ({ ...prev, search: e.target.value }));
                setAturanSort(DEFAULT_SORT);
              }}
              placeholder="Cari transaksi, rekening, kategori, pihak..."
              className="w-full bg-white border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 rounded-xl pl-9 pr-3 py-2 text-xs shadow-sm transition outline-none"
            />
          </div>
          {(Boolean(filter.search) ||
            filter.tipe !== 'Semua' ||
            filter.warna !== 'Semua' ||
            Boolean(filter.rekening) ||
            Boolean(filter.kategori) ||
            Boolean(filter.tanggal) ||
            Boolean(filter.bulan) ||
            Boolean(filter.tahun) ||
            Boolean(filter.startDate) ||
            Boolean(filter.endDate) ||
            presetPeriode !== 'bulan') && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                clearFilter();
                setPresetPeriode('semua');
                setRentangKustom({ dari: '', sampai: '' });
                setRentangBulan({ dari: '', sampai: '' });
                setPilihBulan('');
                setAturanSort(DEFAULT_SORT);
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
              { v: 'jarak_bulan', label: 'Jarak Bulan' },
              { v: 'pilih_bulan', label: 'Pilih Bulan' },
              { v: 'rentang', label: 'Rentang Tanggal' },
              { v: 'tahun', label: 'Tahun Ini' },
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

        {/* Panel Filter Jarak Pilih Bulan */}
        {presetPeriode === 'jarak_bulan' && (
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <CalendarRange size={14} className="text-sky-600" />
                <span>Filter Jarak Pilih Bulan</span>
              </div>
              {rentangBulan.dari && rentangBulan.sampai && (
                <span className="text-[11px] text-sky-700 font-medium bg-sky-100/70 border border-sky-200 px-2 py-0.5 rounded-lg">
                  {formatBulanIndo(rentangBulan.dari)} s/d {formatBulanIndo(rentangBulan.sampai)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Dari Bulan
                </label>
                <input
                  suppressHydrationWarning
                  type="month"
                  value={rentangBulan.dari}
                  onChange={(e) => ubahRentangBulan({ dari: e.target.value })}
                  className="w-full bg-white border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl px-3 py-1.5 text-xs text-slate-700 shadow-sm outline-none transition"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Sampai Bulan
                </label>
                <input
                  suppressHydrationWarning
                  type="month"
                  value={rentangBulan.sampai}
                  onChange={(e) => ubahRentangBulan({ sampai: e.target.value })}
                  className="w-full bg-white border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl px-3 py-1.5 text-xs text-slate-700 shadow-sm outline-none transition"
                />
              </div>
            </div>

            <div className="pt-1 border-t border-slate-200/60">
              <div className="text-[10px] font-medium text-slate-400 mb-1.5">Pilihan Cepat Jarak Bulan:</div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    label: '3 Bulan Terakhir',
                    dari: getBulanIsoRelatif(-2),
                    sampai: getBulanIsoRelatif(0),
                  },
                  {
                    label: '6 Bulan Terakhir',
                    dari: getBulanIsoRelatif(-5),
                    sampai: getBulanIsoRelatif(0),
                  },
                  {
                    label: 'Kuartal 1 (Jan - Mar)',
                    dari: `${new Date().getFullYear()}-01`,
                    sampai: `${new Date().getFullYear()}-03`,
                  },
                  {
                    label: 'Kuartal 2 (Apr - Jun)',
                    dari: `${new Date().getFullYear()}-04`,
                    sampai: `${new Date().getFullYear()}-06`,
                  },
                  {
                    label: 'Kuartal 3 (Jul - Sep)',
                    dari: `${new Date().getFullYear()}-07`,
                    sampai: `${new Date().getFullYear()}-09`,
                  },
                  {
                    label: 'Kuartal 4 (Okt - Des)',
                    dari: `${new Date().getFullYear()}-10`,
                    sampai: `${new Date().getFullYear()}-12`,
                  },
                  {
                    label: 'Semester 1 (Jan - Jun)',
                    dari: `${new Date().getFullYear()}-01`,
                    sampai: `${new Date().getFullYear()}-06`,
                  },
                  {
                    label: 'Semester 2 (Jul - Des)',
                    dari: `${new Date().getFullYear()}-07`,
                    sampai: `${new Date().getFullYear()}-12`,
                  },
                ].map((c) => {
                  const isAktif = rentangBulan.dari === c.dari && rentangBulan.sampai === c.sampai;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => ubahRentangBulan({ dari: c.dari, sampai: c.sampai })}
                      className={`text-[10.5px] px-2.5 py-1 rounded-lg border transition font-medium ${
                        isAktif
                          ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-600'
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
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 shadow-sm space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Calendar size={14} className="text-sky-600" />
                <span>Pilih 1 Bulan Tertentu</span>
              </div>
              {pilihBulan && (
                <span className="text-[11px] text-sky-700 font-medium bg-sky-100/70 border border-sky-200 px-2 py-0.5 rounded-lg">
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
                className="flex-1 bg-white border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl px-3 py-1.5 text-xs text-slate-700 shadow-sm outline-none transition"
              />
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                  ubahPilihBulan(cur);
                }}
                className="text-[11px] font-medium text-slate-600 bg-white border border-slate-200 hover:border-slate-300 px-2.5 py-1.5 rounded-xl whitespace-nowrap shadow-sm"
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
                className="text-[11px] font-medium text-slate-600 bg-white border border-slate-200 hover:border-slate-300 px-2.5 py-1.5 rounded-xl whitespace-nowrap shadow-sm"
              >
                Bulan Lalu
              </button>
            </div>
          </div>
        )}

        {/* Panel Filter Rentang Tanggal Spesifik */}
        {presetPeriode === 'rentang' && (
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-800">
                Rentang Tanggal Spesifik
              </div>
              {rentangKustom.dari && rentangKustom.sampai && (
                <span className="text-[11px] text-sky-700 font-medium bg-sky-100/70 border border-sky-200 px-2 py-0.5 rounded-lg">
                  {rentangKustom.dari} s/d {rentangKustom.sampai}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Dari Tanggal</label>
                <input
                  suppressHydrationWarning
                  type="date"
                  value={rentangKustom.dari}
                  onChange={(e) => ubahRentangTanggal({ dari: e.target.value })}
                  className="w-full bg-white border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-1.5 text-xs shadow-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Sampai Tanggal</label>
                <input
                  suppressHydrationWarning
                  type="date"
                  value={rentangKustom.sampai}
                  onChange={(e) => ubahRentangTanggal({ sampai: e.target.value })}
                  className="w-full bg-white border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-1.5 text-xs shadow-sm outline-none"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <select
            suppressHydrationWarning
            value={filter.warna}
            onChange={(e) => {
              setFilter((prev) => ({ ...prev, warna: e.target.value as 'Semua' | WarnaHighlight }));
              setAturanSort(DEFAULT_SORT);
            }}
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
            suppressHydrationWarning
            value={filter.rekening}
            onChange={(e) => {
              setFilter((prev) => ({ ...prev, rekening: e.target.value }));
              setAturanSort(DEFAULT_SORT);
            }}
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
              onClick={() => {
                setFilter((prev) => ({ ...prev, tipe: f }));
                setAturanSort(DEFAULT_SORT);
              }}
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

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">{listUrut.length} transaksi</span>
        <div className="flex items-center gap-2">
          <Link
            href="/laporan"
            className="flex items-center gap-1 text-[11px] text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 font-semibold px-2 py-1 rounded-lg transition active:scale-95"
            title="Cetak atau unduh laporan dari hasil filter ini"
          >
            <Printer size={12} />
            <span>Cetak Laporan</span>
          </Link>
          <SortMenu aturan={aturanSort} onTerapkan={setAturanSort} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {listUrut.map((t) => {
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
                      {t.sampai_tanggal && t.sampai_tanggal !== t.tanggal ? (
                        <span className="text-slate-700 font-medium">
                          {t.tanggal} s/d {t.sampai_tanggal}
                        </span>
                      ) : (
                        t.tanggal
                      )}{' '}
                      {'\u00b7'} {t.rekening}
                      {t.status_bayar === 'DP' ? ' \u00b7 DP' : ''}
                    </span>
                    {t.sampai_tanggal && t.sampai_tanggal !== t.tanggal && (
                      <span className="text-[9.5px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded-md">
                        Akumulasi
                      </span>
                    )}
                  </div>
                  {t.pihak_terkait && (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Pihak: <span className="font-medium text-slate-600">{t.pihak_terkait}</span>
                    </div>
                  )}
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
                        bukaPreviewBukti(t.bukti || [], i, t.keterangan);
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
                      bukaPreviewBukti(t.bukti || [], 0, t.keterangan);
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

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
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
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] text-slate-500">
                💡 Isi <strong>Sampai Tanggal</strong> jika transaksi ini merupakan akumulasi rentang hari.
              </span>
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
            {/* Area Dropzone Upload File */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFiles(true);
              }}
              onDragLeave={() => setIsDraggingFiles(false)}
              onDrop={handleDropFiles}
              className={`relative border-2 border-dashed rounded-xl p-3 text-center transition-all ${
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
              <div className="flex flex-col items-center justify-center gap-1 pointer-events-none">
                <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shadow-sm">
                  <UploadCloud size={16} />
                </div>
                <div className="text-xs font-semibold text-slate-700">
                  <span>Klik atau seret foto bukti ke sini</span>
                </div>
                <div className="text-[10px] text-slate-400">Format JPG, PNG, WEBP (Bisa lebih dari 1 foto)</div>
              </div>
            </div>

            {/* Hint Geser Urutan */}
            {(buktiLama.length > 1 || fileBaru.length > 1) && (
              <div className="flex items-center gap-1.5 mt-2 text-[10.5px] text-sky-700 bg-sky-50/80 px-2.5 py-1.5 rounded-lg border border-sky-200">
                <GripVertical size={13} className="shrink-0 text-sky-500" />
                <span>Geser &amp; lepas (drag &amp; drop) atau gunakan tombol ‹ › untuk mengatur urutan gambar.</span>
              </div>
            )}

            {/* Bukti Lama (Existing) */}
            {buktiLama.length > 0 && (
              <div className="space-y-1.5 mt-2.5">
                <div className="flex justify-between items-center text-[11px] font-semibold text-slate-700">
                  <span className="flex items-center gap-1">
                    <ImageIcon size={13} className="text-slate-500" />
                    Bukti Tersimpan ({buktiLama.length}):
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Klik × untuk menghapus</span>
                </div>
                <div className="flex flex-wrap gap-3 pt-0.5">
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
                        className={`relative group rounded-xl p-1 border-2 transition-all cursor-grab active:cursor-grabbing bg-white shadow-sm select-none ${
                          isDragging
                            ? 'opacity-40 border-sky-400 scale-95'
                            : isOver
                            ? 'border-sky-500 ring-2 ring-sky-300 scale-105'
                            : 'border-slate-200 hover:border-sky-400 hover:shadow-md'
                        }`}
                        title="Tahan dan geser untuk mengubah urutan"
                      >
                        {/* Nomor Urut Badge */}
                        <div className="absolute -top-2 -left-2 bg-slate-800 text-white text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md z-10">
                          {i + 1}
                        </div>

                        {/* Tombol Hapus */}
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
                          title="Klik untuk melihat ukuran penuh"
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

                        {/* Tombol Navigasi Cepat Kiri/Kanan & Grip */}
                        <div className="flex items-center justify-between mt-1 px-0.5">
                          <button
                            type="button"
                            disabled={i === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              geserBuktiLama(i, -1);
                            }}
                            className="w-4 h-4 rounded bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 disabled:opacity-20 flex items-center justify-center text-[10px] font-bold"
                            title="Geser ke kiri"
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
                            title="Geser ke kanan"
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

            {/* Bukti Baru (Newly Added) */}
            {fileBaru.length > 0 && (
              <div className="space-y-1.5 mt-2.5">
                <div className="flex justify-between items-center text-[11px] font-semibold text-emerald-700">
                  <span className="flex items-center gap-1">
                    <ImageIcon size={13} className="text-emerald-600" />
                    Bukti Baru Dipilih ({fileBaru.length}):
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Klik × untuk membatalkan</span>
                </div>
                <div className="flex flex-wrap gap-3 pt-0.5">
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
                        className={`relative group rounded-xl p-1 border-2 transition-all cursor-grab active:cursor-grabbing bg-white shadow-sm select-none ${
                          isDragging
                            ? 'opacity-40 border-emerald-400 scale-95'
                            : isOver
                            ? 'border-emerald-500 ring-2 ring-emerald-300 scale-105'
                            : 'border-emerald-200 hover:border-emerald-400 hover:shadow-md'
                        }`}
                        title="Tahan dan geser untuk mengubah urutan"
                      >
                        {/* Nomor Urut Badge */}
                        <div className="absolute -top-2 -left-2 bg-emerald-700 text-white text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md z-10">
                          {i + 1}
                        </div>

                        {/* Tombol Hapus */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            hapusFileBaru(i);
                          }}
                          title="Batalkan file ini"
                          className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-md transition z-10"
                        >
                          ×
                        </button>

                        <button
                          type="button"
                          onClick={() => objectUrl && bukaPreviewBukti(fileBaruUrls, i, 'Bukti Baru')}
                          className="block rounded-lg overflow-hidden focus:outline-none"
                          title="Klik untuk melihat preview"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {objectUrl && (
                            <img
                              src={objectUrl}
                              alt={file.name}
                              className="w-16 h-16 object-cover bg-slate-100 pointer-events-none rounded-lg"
                            />
                          )}
                        </button>

                        {/* Tombol Navigasi Cepat Kiri/Kanan & Grip */}
                        <div className="flex items-center justify-between mt-1 px-0.5">
                          <button
                            type="button"
                            disabled={i === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              geserFileBaru(i, -1);
                            }}
                            className="w-4 h-4 rounded bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 disabled:opacity-20 flex items-center justify-center text-[10px] font-bold"
                            title="Geser ke kiri"
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
                            title="Geser ke kanan"
                          >
                            ›
                          </button>
                        </div>
                        <span className="block text-[9px] text-slate-500 truncate max-w-[64px] text-center mt-0.5" title={file.name}>
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
      <Modal open={!!previewBuktiUrl} onClose={tutupPreviewBukti} title={previewBuktiTitle || 'Preview Bukti Transaksi'}>
        <div className="space-y-3">
          <div className="relative bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center p-3 min-h-[260px] max-h-[70vh]">
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

            {previewBuktiDaftar.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={previewSebelumnya}
                  aria-label="Bukti sebelumnya"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center text-lg transition"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={previewBerikutnya}
                  aria-label="Bukti berikutnya"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center text-lg transition"
                >
                  ›
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-white bg-black/50 px-2 py-0.5 rounded-full">
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
                  className={`w-1.5 h-1.5 rounded-full transition ${i === previewBuktiIndex ? 'bg-sky-600 w-4' : 'bg-slate-300'}`}
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
                className="text-xs text-sky-700 hover:text-sky-800 font-medium flex items-center gap-1.5 border border-sky-300 px-3 py-1.5 rounded-lg bg-sky-50 shadow-sm transition active:scale-95"
              >
                <Download size={13} />
                <span>Unduh Gambar Ini</span>
              </a>

              <button
                type="button"
                onClick={() => unduhSemuaBuktiZip(previewBuktiDaftar, previewBuktiLabel)}
                disabled={isDownloadingZip || previewBuktiDaftar.length === 0}
                className="text-xs text-white bg-slate-800 hover:bg-slate-900 active:bg-black font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm transition disabled:opacity-50 active:scale-95"
                title={`Unduh semua ${previewBuktiDaftar.length} file bukti sebagai file .zip bernama "${previewBuktiLabel || 'bukti-transaksi'}.zip"`}
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
                  className="text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold px-3 py-1.5 rounded-lg transition"
                >
                  🗑️ Hapus Bukti Ini
                </button>
              )}

              <button
                type="button"
                onClick={tutupPreviewBukti}
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

// Menu urutkan bergaya panel Supabase: pilih kolom lewat dropdown putus-putus,
// atur arah tiap kolom, lalu "Terapkan pengurutan". Aturan berjenjang sesuai urutan tambah.
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
    <div className="relative" ref={wadah}>
      <button
        type="button"
        onClick={toggle}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition active:scale-95 ${
          aturan.length > 0 ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-white border-slate-200 text-slate-600'
        }`}
      >
        <ArrowUpDown size={13} />
        <span>Urutkan</span>
        {aturan.length > 0 && (
          <span className="text-[10px] font-medium bg-sky-200/80 text-sky-800 px-1.5 py-0.5 rounded-md">
            {aturan[0].kolom === 'tanggal'
              ? aturan[0].arah === 'desc'
                ? 'Baru → Lama'
                : 'Lama → Baru'
              : `${aturan[0].kolom} (${aturan[0].arah})`}
          </span>
        )}
      </button>

      {terbuka && (
        <div className="absolute right-0 top-full mt-2 z-30 w-[19rem] max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-slate-200 shadow-xl p-4">
          {draft.length === 0 ? (
            <div className="mb-3">
              <div className="text-sm font-semibold text-slate-700">Belum ada pengurutan</div>
              <div className="text-xs text-slate-400 mt-0.5">Tambahkan kolom di bawah untuk mengurutkan tampilan</div>
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {draft.map((d, i) => {
                const info = KOLOM_SORT.find((k) => k.key === d.kolom);
                if (!info) return null;
                return (
                  <div key={d.kolom} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-300 w-3 text-center">{i + 1}</span>
                    <span className="flex-1 text-sm text-slate-700 truncate">{info.label}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((cur) => cur.map((x) => (x.kolom === d.kolom ? { ...x, arah: x.arah === 'asc' ? 'desc' : 'asc' } : x)))
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95"
                    >
                      {d.arah === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                      {LABEL_ARAH[info.tipe][d.arah]}
                    </button>
                    <button
                      type="button"
                      aria-label={`Hapus urutan ${info.label}`}
                      onClick={() => setDraft((cur) => cur.filter((x) => x.kolom !== d.kolom))}
                      className="text-slate-300 hover:text-red-500"
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
                className="w-full flex items-center justify-between text-xs text-slate-600 border border-dashed border-slate-300 rounded-lg px-3 py-2 hover:bg-slate-50"
              >
                <span>{draft.length === 0 ? 'Pilih kolom untuk diurutkan' : 'Tambah kolom pengurutan'}</span>
                <ChevronDown size={14} className={`transition-transform ${pilihTerbuka ? 'rotate-180' : ''}`} />
              </button>
              {pilihTerbuka && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-56 overflow-auto">
                  {kolomTersisa.map((k) => (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => {
                        setDraft((cur) => [...cur, { kolom: k.key, arah: k.arahAwal }]);
                        setPilihTerbuka(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50"
                    >
                      <span className="text-slate-700">{k.label}</span>
                      <span className="text-[10px] text-slate-400">{k.tipe}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mt-3">
            {draft.length > 0 ? (
              <button type="button" onClick={() => setDraft([])} className="text-[11px] text-slate-400 hover:text-red-500">
                Hapus semua
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
              className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-slate-800 text-white disabled:bg-slate-100 disabled:text-slate-300"
            >
              Terapkan pengurutan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
