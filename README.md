# KeuanganKu — Next.js + Supabase

Hasil migrasi dari Google Apps Script (`Kode.gs` + `Index.html`) ke Next.js 14
(App Router, TypeScript) + Supabase. Semua **logika bisnis** (perhitungan
saldo, DP/cicilan, hutang-piutang, tabungan, anggaran, laporan) diport 1:1 —
lihat komentar "Padanan ..." di tiap file `src/lib/actions/*.ts` yang merujuk
ke fungsi asal di `Kode.gs`.

## Struktur proyek

```
supabase/schema.sql          Skema database (jalankan sekali di Supabase)
src/lib/types.ts             Semua tipe TypeScript (mencerminkan skema + payload lama)
src/lib/utils.ts             Helper umum (format tanggal/rupiah, dst — padanan helper Kode.gs)
src/lib/supabase/            Supabase client (browser & server)
src/lib/actions/             Server Actions — 1 file per domain, padanan tiap fungsi Kode.gs:
  workspace.ts                 getInitWorkspaceData, tambahAkunWorkspace, preferensi user
  kategori.ts                  tambah/hapus kategori & sub kategori
  transaksi.ts                 simpanTransaksi, hapusTransaksi, recalculateBalance, dst.
  dp.ts                        tambahPembayaranDP
  hutangPiutang.ts             simpanHutangPiutangBaru, tambahPembayaranHutangPiutang
  tabungan.ts                  simpanTabunganBaru, simpanIsiTabungan, hapusItemTabungan
  anggaran.ts                  simpanAnggaran
  transfer.ts                  transferSaldo
  upload.ts                    upload bukti transaksi (Drive -> Supabase Storage)
  laporanRingkas.ts            Excel Ringkas (padanan downloadLaporanBase64)
  laporanDetail.ts             Excel Detail (padanan downloadLaporanExcelDetail)
  laporanPrint.ts              Data untuk halaman cetak PDF
src/lib/report/                Helper murni (dipakai client & server): pengelompokan
                                transaksi, perhitungan daftar hutang/DP & hutang-piutang
src/app/(dashboard)/           Halaman utama (Ringkasan, Transaksi, Anggaran, Kategori,
                                Rekening, Hutang & Piutang, Tabungan, Laporan)
src/app/reports/print/         Halaman cetak laporan (pengganti generator PDF GAS —
                                pakai fitur "Print > Save as PDF" browser, CSS sudah
                                diset utk itu, termasuk lampiran bukti maks 2/halaman)
src/app/login/                 Login/daftar (Supabase Auth)
src/middleware.ts              Proteksi route (redirect ke /login jika belum masuk)
```

## Yang SENGAJA berubah (bukan bug):

1. **Multi-user, bukan 1 pemilik skrip.** GAS lama otomatis "milik" 1 akun
   Google. Di sini pakai Supabase Auth + Row Level Security, supaya aplikasi
   yang sama bisa dipakai banyak orang dengan datanya masing-masing.
2. **Kategori/SubKategori dinormalisasi** jadi 2 tabel (`categories` +
   `subcategories`) menggantikan trik "baris SubKategori kosong = kategori
   tanpa sub" di Sheets. Perilaku yang dilihat user identik.
3. **Bukti transaksi** disimpan di Supabase Storage (bukan Google Drive).
4. **Generator PDF** diganti halaman cetak (`/reports/print`) + tombol
   "Print / Save as PDF" browser — CSS-nya sudah dibuat semirip mungkin
   dengan versi lama termasuk fitur lampiran bukti maks 2 transaksi/halaman
   yang baru saja Anda minta.
5. **Halaman Rekening bersifat read-only** (lihat komentar di
   `src/app/(dashboard)/rekening/page.tsx`) — di app lama memang tidak ada
   fungsi tambah/hapus rekening manual, jadi tidak saya tambahkan supaya
   logikanya tidak berubah. Tabel `accounts` sudah siap kalau Anda mau
   menambah fitur itu belakangan.

## Setup

### 1. Buat project Supabase
- https://supabase.com/dashboard -> New Project
- Buka **SQL Editor**, jalankan seluruh isi `supabase/schema.sql`
- Buka **Storage**, buat bucket baru bernama `bukti-transaksi`, set **Public**
  (atau ubah `src/lib/actions/upload.ts` kalau mau private + signed URL)
- Buka **Project Settings > API**, salin `Project URL` & `anon public key`

### 2. Environment variables
```bash
cp .env.local.example .env.local
# isi NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Install & jalankan
```bash
npm install
npm run dev
```
Buka http://localhost:3000 — daftar akun baru (Supabase Auth email/password),
workspace default "Dompet Pribadi" akan otomatis dibuat saat pertama login
(padanan `setupMasterWorkspace()` di GAS lama).

### 4. Build produksi
```bash
npm run build
npm start
```

## Catatan pengembangan lanjutan
- Semua Server Action sudah pakai RLS (`requireUser()` di
  `src/lib/supabase/server.ts`) — tidak ada endpoint yang bisa diakses tanpa
  login.
- `recalculateBalance` melakukan 1 query + 1 upsert batch per simpan/hapus
  transaksi. Untuk dataset sangat besar, pertimbangkan pindah ke Postgres
  function (RPC) supaya perhitungan berjalan di sisi database.
- UI dibangun dengan Tailwind, mobile-first (bottom nav di mobile, topbar
  menu di desktop) sesuai gaya visual yang biasa Anda pakai — belum
  pixel-identik dengan HTML lama karena memang migrasi ke komponen React,
  tapi semua field & aksi formnya sudah lengkap 1:1.
- `npx tsc --noEmit` dan `npm run build` sudah dicoba dan lulus tanpa error
  di lingkungan pengembangan ini (pakai env placeholder, belum tersambung ke
  Supabase asli) — setelah isi `.env.local` dengan project asli, jalankan
  ulang `npm run dev` dan uji tiap fitur dengan data nyata.
