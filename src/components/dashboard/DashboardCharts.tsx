'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppData } from '@/components/layout/AppDataProvider';
import { rp } from '@/lib/utils';
import type { Transaction, Budget } from '@/lib/types';

// Kategori yang tidak dihitung. Sama dengan kartu "Pemasukan/Pengeluaran Bulan Ini"
// di Dashboard, supaya angka grafik dan kartu selalu cocok. Ubah di satu tempat ini.
const KATEGORI_DIKECUALIKAN = ['Transfer', 'Tabungan'];

const NAMA_HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const NAMA_BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// 7 kategori terbesar dapat warna sendiri, sisanya digabung jadi "Lainnya".
const WARNA_SERI = ['#f97316', '#3b82f6', '#ec4899', '#10b981', '#8b5cf6', '#f59e0b', '#0ea5e9'];
const WARNA_LAINNYA = '#cbd5e1';
const WARNA_MASUK = '#10b981';
const WARNA_KELUAR = '#f43f5e';

const pad = (n: number) => String(n).padStart(2, '0');
const isoLokal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const jumlahDari = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

function angka1(x: number): string {
  return x.toFixed(1).replace(/\.0$/, '').replace('.', ',');
}

// Label sumbu ringkas: 250rb, 1,5jt, 2M
function ringkasRp(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${angka1(n / 1e9)}M`;
  if (a >= 1e6) return `${angka1(n / 1e6)}jt`;
  if (a >= 1e3) return `${Math.round(n / 1e3)}rb`;
  return String(Math.round(n));
}

// Skala sumbu Y dengan langkah "bulat" (1, 2, 2.5, 5, 10 x 10^k), maksimal ~4-5 garis.
function skalaY(maxVal: number): { max: number; ticks: number[] } {
  if (maxVal <= 0) return { max: 1, ticks: [0] };
  const kasar = maxVal / 4;
  const exp = Math.pow(10, Math.floor(Math.log10(kasar)));
  const f = kasar / exp;
  const langkah = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
  const n = Math.ceil(maxVal / langkah);
  const ticks = Array.from({ length: n + 1 }, (_, i) => i * langkah);
  return { max: n * langkah, ticks };
}

function adalahPengeluaran(t: Transaction): boolean {
  return t.tipe === 'Pengeluaran' && !KATEGORI_DIKECUALIKAN.includes(t.kategori);
}

// Ukur lebar wadah supaya SVG pas di layar apa pun (teks tetap tajam, tidak ikut membesar).
function KotakGrafik({ children }: { children: (lebar: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [lebar, setLebar] = useState(320);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ukur = () => setLebar(Math.max(260, Math.floor(el.clientWidth)));
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full">
      {children(lebar)}
    </div>
  );
}

function Kartu({ judul, aksi, children }: { judul: string; aksi?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-bold text-slate-700 tracking-wide uppercase">{judul}</h2>
        {aksi}
      </div>
      {children}
    </section>
  );
}

type Seri = { nama: string; nilai: number[]; total: number; warna: string };

// ============ 1. Pengeluaran per kategori: mingguan (harian) / tahunan (bulanan) ============
function GrafikPengeluaran({ transaksi }: { transaksi: Transaction[] }) {
  const [mode, setMode] = useState<'minggu' | 'tahun'>('minggu');
  const [offset, setOffset] = useState(0);
  const [pilih, setPilih] = useState<number | null>(null);

  const periode = useMemo(() => {
    const sekarang = new Date();
    if (mode === 'minggu') {
      const hariIni = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate());
      const dariSenin = (hariIni.getDay() + 6) % 7;
      const senin = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate() - dariSenin + offset * 7);
      const slot = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(senin.getFullYear(), senin.getMonth(), senin.getDate() + i);
        return {
          kunci: isoLokal(d),
          label: NAMA_HARI[i],
          sub: String(d.getDate()),
          lengkap: `${NAMA_HARI[i]}, ${d.getDate()} ${NAMA_BULAN[d.getMonth()]}`,
        };
      });
      const minggu = new Date(senin.getFullYear(), senin.getMonth(), senin.getDate() + 6);
      const judul = `${senin.getDate()} ${NAMA_BULAN[senin.getMonth()]} – ${minggu.getDate()} ${NAMA_BULAN[minggu.getMonth()]} ${minggu.getFullYear()}`;
      return { slot, judul, panjangKunci: 10, kunciSekarang: isoLokal(sekarang) };
    }
    const tahun = sekarang.getFullYear() + offset;
    const slot = NAMA_BULAN.map((nama, i) => ({
      kunci: `${tahun}-${pad(i + 1)}`,
      label: nama,
      sub: '',
      lengkap: `${NAMA_BULAN_PANJANG[i]} ${tahun}`,
    }));
    return { slot, judul: String(tahun), panjangKunci: 7, kunciSekarang: isoLokal(sekarang).slice(0, 7) };
  }, [mode, offset]);

  const data = useMemo(() => {
    const idx: Record<string, number> = {};
    periode.slot.forEach((s, i) => {
      idx[s.kunci] = i;
    });

    const perKategori: Record<string, number[]> = {};
    transaksi.forEach((t) => {
      if (!adalahPengeluaran(t)) return;
      const i = idx[(t.tanggal || '').slice(0, periode.panjangKunci)];
      if (i === undefined) return;
      if (!perKategori[t.kategori]) perKategori[t.kategori] = Array(periode.slot.length).fill(0);
      perKategori[t.kategori][i] += Number(t.nominal) || 0;
    });

    const urut = Object.entries(perKategori)
      .map(([nama, nilai]) => ({ nama, nilai, total: jumlahDari(nilai) }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);

    const seri: Seri[] = urut.slice(0, WARNA_SERI.length).map((x, i) => ({ ...x, warna: WARNA_SERI[i] }));
    const sisa = urut.slice(WARNA_SERI.length);
    if (sisa.length > 0) {
      const nilai = periode.slot.map((_, i) => sisa.reduce((a, x) => a + x.nilai[i], 0));
      seri.push({ nama: 'Lainnya', nilai, total: jumlahDari(nilai), warna: WARNA_LAINNYA });
    }

    const totalPerSlot = periode.slot.map((_, i) => seri.reduce((a, x) => a + x.nilai[i], 0));
    return { seri, totalPerSlot, total: jumlahDari(totalPerSlot) };
  }, [transaksi, periode]);

  function ubahMode(m: 'minggu' | 'tahun') {
    setMode(m);
    setOffset(0);
    setPilih(null);
  }

  function geser(arah: number) {
    setOffset((o) => Math.min(0, o + arah));
    setPilih(null);
  }

  const baris =
    pilih === null
      ? data.seri.map((s) => ({ nama: s.nama, warna: s.warna, nilai: s.total }))
      : data.seri
          .map((s) => ({ nama: s.nama, warna: s.warna, nilai: s.nilai[pilih] }))
          .filter((b) => b.nilai > 0)
          .sort((a, b) => b.nilai - a.nilai);
  const totalTampil = pilih === null ? data.total : data.totalPerSlot[pilih];
  const labelTotal = pilih === null ? 'Total periode' : periode.slot[pilih].lengkap;

  return (
    <Kartu judul="Pengeluaran per kategori">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="inline-flex bg-slate-100 rounded-lg p-0.5 text-[11px] font-semibold">
          {(['minggu', 'tahun'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => ubahMode(m)}
              className={`px-3 py-1 rounded-md transition ${mode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}
            >
              {m === 'minggu' ? 'Mingguan' : 'Tahunan'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Periode sebelumnya"
            onClick={() => geser(-1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 active:scale-95"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-[11px] font-semibold text-slate-600 min-w-[112px] text-center">{periode.judul}</span>
          <button
            type="button"
            aria-label="Periode berikutnya"
            disabled={offset >= 0}
            onClick={() => geser(1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 active:scale-95 disabled:opacity-30"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {data.total === 0 ? (
        <div className="h-32 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
          Belum ada pengeluaran di periode ini.
        </div>
      ) : (
        <KotakGrafik>
          {(W) => {
            const H = 210;
            const ML = 38;
            const MR = 6;
            const MT = 8;
            const MB = 32;
            const plotW = W - ML - MR;
            const plotH = H - MT - MB;
            const skala = skalaY(Math.max(0, ...data.totalPerSlot));
            const n = periode.slot.length;
            const lebarSlot = plotW / n;
            const lebarBar = Math.min(lebarSlot * 0.62, 34);
            const yDari = (v: number) => MT + plotH - (v / skala.max) * plotH;

            return (
              <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafik batang pengeluaran per kategori" className="block">
                {skala.ticks.map((tk) => (
                  <g key={tk}>
                    <line x1={ML} x2={W - MR} y1={yDari(tk)} y2={yDari(tk)} stroke={tk === 0 ? '#cbd5e1' : '#f1f5f9'} />
                    <text x={ML - 5} y={yDari(tk)} dy="0.32em" textAnchor="end" fontSize="9" fill="#94a3b8">
                      {ringkasRp(tk)}
                    </text>
                  </g>
                ))}
                {periode.slot.map((s, i) => {
                  const x0 = ML + i * lebarSlot;
                  const xBar = x0 + (lebarSlot - lebarBar) / 2;
                  const tengah = x0 + lebarSlot / 2;
                  const sekarang = s.kunci === periode.kunciSekarang;
                  let acc = 0;
                  return (
                    <g key={s.kunci}>
                      <g opacity={pilih === null || pilih === i ? 1 : 0.35}>
                        {data.seri.map((sr) => {
                          const v = sr.nilai[i];
                          if (v <= 0) return null;
                          const y = yDari(acc + v);
                          const h = yDari(acc) - y;
                          acc += v;
                          return <rect key={sr.nama} x={xBar} y={y} width={lebarBar} height={Math.max(h, 1)} fill={sr.warna} />;
                        })}
                      </g>
                      <text
                        x={tengah}
                        y={H - MB + 14}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight={sekarang ? 700 : 400}
                        fill={sekarang ? '#0284c7' : '#64748b'}
                      >
                        {s.label}
                      </text>
                      {s.sub && (
                        <text x={tengah} y={H - MB + 25} textAnchor="middle" fontSize="9" fill={sekarang ? '#0284c7' : '#94a3b8'}>
                          {s.sub}
                        </text>
                      )}
                      <rect
                        x={x0}
                        y={MT}
                        width={lebarSlot}
                        height={plotH + MB}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setPilih(pilih === i ? null : i)}
                      />
                    </g>
                  );
                })}
              </svg>
            );
          }}
        </KotakGrafik>
      )}

      {data.total > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <span className="text-[11px] text-slate-400">{labelTotal}</span>
            <span className="text-sm font-bold text-slate-800">{rp(totalTampil)}</span>
          </div>
          <div className="space-y-1.5">
            {baris.map((b) => (
              <div key={b.nama} className="flex items-center gap-2 text-[11px]">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: b.warna }} />
                <span className="text-slate-600 flex-1 truncate">{b.nama}</span>
                <span className="text-slate-400 tabular-nums">{totalTampil > 0 ? Math.round((b.nilai / totalTampil) * 100) : 0}%</span>
                <span className="font-semibold text-slate-700 tabular-nums">{rp(b.nilai)}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-slate-300 mt-2">Ketuk batang untuk melihat rincian hari/bulan itu.</div>
        </div>
      )}
    </Kartu>
  );
}

// ============ 2. Arus kas 6 bulan terakhir: pemasukan vs pengeluaran ============
function GrafikArusKas({ transaksi }: { transaksi: Transaction[] }) {
  const bulan = useMemo(() => {
    const now = new Date();
    const daftar = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { kunci: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: NAMA_BULAN[d.getMonth()], masuk: 0, keluar: 0 };
    });
    const idx: Record<string, number> = {};
    daftar.forEach((b, i) => {
      idx[b.kunci] = i;
    });
    transaksi.forEach((t) => {
      if (KATEGORI_DIKECUALIKAN.includes(t.kategori)) return;
      const i = idx[(t.tanggal || '').slice(0, 7)];
      if (i === undefined) return;
      const nominal = Number(t.nominal) || 0;
      if (t.tipe === 'Pemasukan') daftar[i].masuk += nominal;
      else if (t.tipe === 'Pengeluaran') daftar[i].keluar += nominal;
    });
    return daftar;
  }, [transaksi]);

  const maks = Math.max(0, ...bulan.map((b) => Math.max(b.masuk, b.keluar)));

  return (
    <Kartu judul="Arus kas 6 bulan terakhir">
      {maks === 0 ? (
        <div className="h-32 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
          Belum ada transaksi dalam 6 bulan terakhir.
        </div>
      ) : (
        <KotakGrafik>
          {(W) => {
            const H = 200;
            const ML = 38;
            const MR = 6;
            const MT = 8;
            const MB = 42;
            const plotW = W - ML - MR;
            const plotH = H - MT - MB;
            const skala = skalaY(maks);
            const lebarSlot = plotW / bulan.length;
            const lebarBar = Math.min(lebarSlot * 0.3, 22);
            const yDari = (v: number) => MT + plotH - (v / skala.max) * plotH;

            return (
              <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafik pemasukan dan pengeluaran 6 bulan terakhir" className="block">
                {skala.ticks.map((tk) => (
                  <g key={tk}>
                    <line x1={ML} x2={W - MR} y1={yDari(tk)} y2={yDari(tk)} stroke={tk === 0 ? '#cbd5e1' : '#f1f5f9'} />
                    <text x={ML - 5} y={yDari(tk)} dy="0.32em" textAnchor="end" fontSize="9" fill="#94a3b8">
                      {ringkasRp(tk)}
                    </text>
                  </g>
                ))}
                {bulan.map((b, i) => {
                  const tengah = ML + i * lebarSlot + lebarSlot / 2;
                  const selisih = b.masuk - b.keluar;
                  return (
                    <g key={b.kunci}>
                      <rect x={tengah - lebarBar - 1.5} y={yDari(b.masuk)} width={lebarBar} height={Math.max(yDari(0) - yDari(b.masuk), b.masuk > 0 ? 1 : 0)} fill={WARNA_MASUK} />
                      <rect x={tengah + 1.5} y={yDari(b.keluar)} width={lebarBar} height={Math.max(yDari(0) - yDari(b.keluar), b.keluar > 0 ? 1 : 0)} fill={WARNA_KELUAR} />
                      <text x={tengah} y={H - MB + 14} textAnchor="middle" fontSize="9" fill="#64748b">
                        {b.label}
                      </text>
                      <text x={tengah} y={H - MB + 27} textAnchor="middle" fontSize="8.5" fontWeight={600} fill={selisih >= 0 ? '#059669' : '#e11d48'}>
                        {selisih >= 0 ? '+' : '-'}
                        {ringkasRp(Math.abs(selisih))}
                      </text>
                    </g>
                  );
                })}
              </svg>
            );
          }}
        </KotakGrafik>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: WARNA_MASUK }} />
          Pemasukan
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: WARNA_KELUAR }} />
          Pengeluaran
        </span>
      </div>
      <div className="text-[10px] text-slate-300 mt-1">Angka di bawah nama bulan = selisih (pemasukan dikurangi pengeluaran).</div>
    </Kartu>
  );
}

// ============ 3. Anggaran vs realisasi bulan ini ============
function AnggaranBulanIni({ transaksi, anggaran }: { transaksi: Transaction[]; anggaran: Budget[] }) {
  const now = new Date();
  const tahun = now.getFullYear();
  const bulan = now.getMonth() + 1;

  const daftar = useMemo(() => {
    const kunci = `${tahun}-${pad(bulan)}`;
    const terpakai: Record<string, number> = {};
    transaksi.forEach((t) => {
      if (!adalahPengeluaran(t)) return;
      if ((t.tanggal || '').slice(0, 7) !== kunci) return;
      terpakai[t.kategori] = (terpakai[t.kategori] || 0) + (Number(t.nominal) || 0);
    });
    return anggaran
      .filter((a) => a.tahun === tahun && a.bulan === bulan && !a.sub_kategori)
      .map((a) => {
        const limit = Number(a.nominal) || 0;
        const pakai = terpakai[a.kategori] || 0;
        return { kategori: a.kategori, limit, pakai, persen: limit > 0 ? (pakai / limit) * 100 : 0 };
      })
      .sort((x, y) => y.persen - x.persen)
      .slice(0, 6);
  }, [transaksi, anggaran, tahun, bulan]);

  return (
    <Kartu
      judul="Anggaran bulan ini"
      aksi={
        <Link href="/anggaran" className="text-xs font-semibold text-sky-600">
          Atur
        </Link>
      }
    >
      {daftar.length === 0 ? (
        <div className="text-xs text-slate-400">
          Belum ada anggaran untuk {NAMA_BULAN_PANJANG[bulan - 1]}.{' '}
          <Link href="/anggaran" className="text-sky-600 font-semibold">
            Set anggaran
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {daftar.map((a) => {
            const lebih = a.pakai > a.limit;
            const warna = lebih ? 'bg-rose-500' : a.persen >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
            return (
              <div key={a.kategori}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-700 truncate">{a.kategori}</span>
                  <span className={lebih ? 'text-rose-600 font-semibold' : 'text-slate-500'}>
                    {rp(a.pakai)} / {rp(a.limit)}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full mt-1 overflow-hidden">
                  <div className={`h-full ${warna}`} style={{ width: `${Math.min(a.persen, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[10px] mt-0.5 text-slate-400">
                  <span>{lebih ? `Lebih ${rp(a.pakai - a.limit)}` : `Sisa ${rp(a.limit - a.pakai)}`}</span>
                  <span>{Math.round(a.persen)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Kartu>
  );
}

export default function DashboardCharts() {
  const { transaksi, anggaran } = useAppData();
  return (
    <div className="space-y-4">
      <GrafikPengeluaran transaksi={transaksi} />
      <GrafikArusKas transaksi={transaksi} />
      <AnggaranBulanIni transaksi={transaksi} anggaran={anggaran} />
    </div>
  );
}
