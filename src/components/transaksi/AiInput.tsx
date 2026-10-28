'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Camera, Loader2, Sparkles } from 'lucide-react';
import { ekstrakTransaksiAi } from '@/lib/actions/gemini';
import { audioKeWavBase64, fileToBase64 } from '@/lib/ai/media';
import type { HasilEkstrakAi, KatMap } from '@/lib/types';

const MAKS_DETIK = 60; // 60 dtk WAV 16kHz mono ~1,9MB, aman di bawah limit body Vercel
const MAKS_FOTO = 3;

type Berkas = { data: string; mime: string };

const mmss = (d: number) => `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`;

export default function AiInput({
  katMasuk,
  katKeluar,
  rekenings,
  onHasil,
  onFoto,
}: {
  katMasuk: KatMap;
  katKeluar: KatMap;
  rekenings: string[];
  onHasil: (h: HasilEkstrakAi) => void;
  onFoto: (files: File[]) => void; // foto yang di-scan ikut jadi bukti transaksi
}) {
  const [fase, setFase] = useState<'diam' | 'rekam' | 'proses'>('diam');
  const [detik, setDetik] = useState(0);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>();
  const fotoRef = useRef<HTMLInputElement>(null);

  // Modal ditutup saat merekam: matikan mikrofon, buang hasil.
  useEffect(
    () => () => {
      clearInterval(timer.current);
      if (rec.current && rec.current.state !== 'inactive') {
        rec.current.onstop = null;
        rec.current.stop();
        rec.current.stream.getTracks().forEach((t) => t.stop());
      }
    },
    []
  );

  async function proses(siapkan: () => Promise<Berkas[]>) {
    setFase('proses');
    setPesan(null);
    try {
      const res = await ekstrakTransaksiAi({
        files: await siapkan(),
        hariIni: new Date().toLocaleDateString('sv-SE'), // yyyy-MM-dd, zona waktu lokal user
        katMasuk,
        katKeluar,
        rekenings,
      });
      if (!res.success) return setPesan({ ok: false, teks: res.error });
      if (!res.data?.ditemukan) {
        return setPesan({ ok: false, teks: 'Transaksi tidak ditemukan. Coba lagi dengan input yang lebih jelas.' });
      }
      onHasil(res.data);
      setPesan({ ok: true, teks: 'Form terisi otomatis. Periksa dulu sebelum simpan.' });
    } catch {
      setPesan({ ok: false, teks: 'Gagal memproses. Cek koneksi lalu coba lagi.' });
    } finally {
      setFase('diam');
    }
  }

  async function mulaiRekam() {
    setPesan(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        clearInterval(timer.current);
        stream.getTracks().forEach((t) => t.stop());
        proses(async () => [{ data: await audioKeWavBase64(new Blob(chunks, { type: r.mimeType })), mime: 'audio/wav' }]);
      };
      r.start();
      rec.current = r;
      setDetik(0);
      setFase('rekam');
      let n = 0;
      timer.current = setInterval(() => {
        n += 1;
        setDetik(n);
        if (n >= MAKS_DETIK) r.stop();
      }, 1000);
    } catch {
      setPesan({ ok: false, teks: 'Mikrofon tidak bisa diakses. Izinkan akses mikrofon di browser (butuh HTTPS).' });
    }
  }

  function pilihFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, MAKS_FOTO);
    e.target.value = '';
    if (files.length === 0) return;
    onFoto(files);
    // 2048px: nota panjang butuh resolusi lebih tinggi dari kompres bukti (1280px) agar teks terbaca
    proses(() =>
      Promise.all(
        files.map(async (f) => ({ data: await fileToBase64(f, 2048), mime: f.type === 'image/png' ? 'image/png' : 'image/jpeg' }))
      )
    );
  }

  const tombol =
    'min-h-11 flex items-center justify-center gap-2 rounded-xl text-xs font-bold border transition active:scale-95 disabled:opacity-50 disabled:active:scale-100';

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800">
        <Sparkles size={14} className="text-sky-600" />
        <span>Isi otomatis dengan AI</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={fase === 'rekam' ? () => rec.current?.stop() : mulaiRekam}
          disabled={fase === 'proses'}
          aria-label={fase === 'rekam' ? 'Selesai merekam' : 'Rekam suara untuk mengisi transaksi'}
          className={`${tombol} ${
            fase === 'rekam'
              ? 'bg-rose-600 border-rose-600 text-white'
              : 'bg-white border-slate-200 text-slate-700 hover:border-sky-300'
          }`}
        >
          {fase === 'rekam' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-white motion-safe:animate-pulse" />
              <Square size={13} fill="currentColor" />
              <span>Selesai · {mmss(detik)}</span>
            </>
          ) : (
            <>
              <Mic size={16} className="text-sky-600" />
              <span>Rekam suara</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => fotoRef.current?.click()}
          disabled={fase !== 'diam'}
          aria-label="Foto atau pilih gambar nota, invoice, atau bukti potong"
          className={`${tombol} bg-white border-slate-200 text-slate-700 hover:border-sky-300`}
        >
          <Camera size={16} className="text-sky-600" />
          <span>Scan nota / foto</span>
        </button>
        <input ref={fotoRef} type="file" accept="image/*" multiple className="hidden" onChange={pilihFoto} />
      </div>

      <p aria-live="polite" className="text-[11px] leading-snug text-slate-500 min-h-[16px]">
        {fase === 'rekam' ? (
          <>Ucapkan transaksinya, mis. “beli bensin lima puluh ribu pakai tunai”. Ketuk Selesai kalau sudah.</>
        ) : fase === 'proses' ? (
          <span className="inline-flex items-center gap-1.5 text-sky-700 font-semibold">
            <Loader2 size={12} className="animate-spin" /> Membaca input dengan AI…
          </span>
        ) : pesan ? (
          <span className={pesan.ok ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'}>{pesan.teks}</span>
        ) : (
          <>Ucapkan transaksi atau foto nota, invoice, bukti potong (maks {MAKS_FOTO} foto). Hasil bisa diedit sebelum disimpan.</>
        )}
      </p>
    </div>
  );
}
