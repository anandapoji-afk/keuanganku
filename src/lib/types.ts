// ============================================================
// Tipe data inti — mencerminkan skema Supabase (lihat supabase/schema.sql)
// dan bentuk payload yang dulu dikirim dari Index.html ke Kode.gs.
// Nama field dipertahankan senada dengan versi GAS supaya logika bisnis
// (recalculateBalance, hitungDaftarHutangDariGrid, dst.) bisa diport 1:1.
// ============================================================

export type Tipe = 'Pemasukan' | 'Pengeluaran';
export type StatusBayar = 'Lunas' | 'DP';
export type PerananHP = 'Pokok' | 'Pembayaran' | '';
export type JenisLaporan = 'ringkas' | 'detail';
export type WarnaHighlight = '' | 'kuning' | 'hijau' | 'pink' | 'biru' | 'oranye' | 'ungu';

export interface Workspace {
  id: string;
  user_id: string;
  nama: string;
  created_at: string;
}

export interface Account {
  id: string;
  workspace_id: string;
  nama: string;
  created_at: string;
}

export interface Category {
  id: string;
  workspace_id: string;
  tipe: Tipe;
  nama: string;
  created_at: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  nama: string;
  created_at: string;
}

export interface Budget {
  id: string;
  workspace_id: string;
  bulan: number;
  tahun: number;
  kategori: string;
  sub_kategori: string;
  nominal: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  workspace_id: string;
  tanggal: string; // yyyy-MM-dd
  jam: string; // HH:mm
  tipe: Tipe;
  kategori: string;
  sub_kategori: string;
  keterangan: string;
  nominal: number;
  saldo: number;
  rekening: string;
  bukti: string[];
  piutang_id: string;
  status_bayar: StatusBayar;
  total_tagihan: number;
  warna_highlight: WarnaHighlight;
  catatan: string;
  pihak_terkait: string;
  hutang_piutang_id: string;
  peranan_hp: PerananHP;
  jatuh_tempo: string | null;
  created_at: string;
}

export interface SavingsTarget {
  id: string;
  workspace_id: string;
  keterangan: string;
  target_nominal: number;
  tenggat: string | null;
  created_at: string;
}

export interface SavingsDeposit {
  id: string;
  workspace_id: string;
  target_id: string;
  tanggal: string;
  jam: string;
  nominal: number;
  rekening: string;
  keterangan: string;
  transfer_link: string;
  created_at: string;
}

export interface UserPreferences {
  user_id: string;
  pref: Record<string, unknown>;
  updated_at: string;
}

// ============================================================
// Bentuk data gabungan yang dikonsumsi UI (padanan getInitWorkspaceData
// & getRiwayatTransaksi di GAS lama)
// ============================================================

export interface KatMap {
  [namaKategori: string]: string[]; // daftar sub kategori
}

export interface InitWorkspaceData {
  workspaces: string[];
  rekenings: string[];
  active: string;
  katMasuk: KatMap;
  katKeluar: KatMap;
}

export interface RiwayatTransaksi {
  transaksi: Transaction[];
  anggaran: Budget[];
  tabungan: TabunganGabungan[];
}

// Bentuk gabungan Target + riwayat Isi, dipakai halaman Tabungan
export interface TabunganGabungan {
  id: string;
  jenis: 'Target';
  keterangan: string;
  targetNominal: number;
  tenggat: string | null;
  deposits: SavingsDeposit[];
}

// ============================================================
// Payload aksi (persis field yang dulu dikirim google.script.run dari
// Index.html) — dipertahankan agar form React tinggal dipetakan langsung.
// ============================================================

export interface SimpanTransaksiPayload {
  rowIdx?: string; // id transaksi saat mode edit, kosong saat tambah baru
  workspace: string;
  tanggal: string;
  jam: string;
  tipe: Tipe;
  kategori: string;
  subKategori?: string;
  rekening: string;
  keterangan: string;
  pihakTerkait?: string;
  nominal: number;
  warnaHighlight?: WarnaHighlight;
  catatan?: string;
  statusBayar: StatusBayar;
  totalTagihan?: number;
  buktiLama?: string[]; // URL lama yang dipertahankan (mode edit)
  buktiBaru?: { data: string; mime: string; nama: string }[]; // file base64 baru
}

export interface SimpanAnggaranPayload {
  workspace: string;
  bulanTahun: string; // format "YYYY-M" (dari input type=month)
  kategoriAnggaran: string;
  subKategoriAnggaran?: string;
  nominalAnggaran: number;
}

export interface TransferSaldoPayload {
  workspace: string;
  tanggal: string;
  jam?: string;
  dari: string;
  ke: string;
  nominal: number;
  keterangan?: string;
}

export interface TambahPembayaranDPPayload {
  workspace: string;
  piutangId: string;
  tanggal: string;
  jam?: string;
  nominal: number;
  rekening: string;
  keterangan?: string;
}

export interface SimpanHighlightCatatanPayload {
  workspace: string;
  rowIdx: string;
  warna: WarnaHighlight;
  catatan: string;
}

export interface SimpanHutangPiutangBaruPayload {
  workspace: string;
  tipe: 'Hutang' | 'Piutang';
  pihakTerkait: string;
  tanggal: string;
  jam?: string;
  rekening: string;
  nominal: number;
  keterangan?: string;
  jatuhTempo?: string;
}

export interface TambahPembayaranHutangPiutangPayload {
  workspace: string;
  hpId: string;
  tanggal: string;
  jam?: string;
  nominal: number;
  rekening: string;
  keterangan?: string;
}

export interface TambahKategoriPayload {
  workspace: string;
  tipe: Tipe;
  nama: string;
}

export interface HapusKategoriPayload {
  workspace: string;
  tipe: Tipe;
  nama: string;
}

export interface TambahSubKategoriPayload {
  workspace: string;
  tipe: Tipe;
  kategori: string;
  subs: string[];
}

export interface HapusSubKategoriPayload {
  workspace: string;
  tipe: Tipe;
  kategori: string;
  sub: string;
}

export interface SimpanTabunganBaruPayload {
  workspace: string;
  keterangan: string;
  nominal: number;
  tenggat?: string;
}

export interface SimpanIsiTabunganPayload {
  workspace: string;
  tbgId: string;
  tanggal: string;
  jam?: string;
  nominal: number;
  rekening: string;
  keterangan?: string;
}

export interface HapusItemTabunganPayload {
  workspace: string;
  id: string;
  jenis: 'Target' | 'Isi';
}

// Hasil generik yang dulu dikembalikan sebagai string "Error: ..." atau
// object { success:true } / { error:'...' } — dinormalisasi ke satu bentuk.
export type ActionResult<T = undefined> =
  | { success: true; message?: string; data?: T }
  | { success: false; error: string };

// ============================================================
// Daftar Hutang/DP & Hutang-Piutang (hasil hitungDaftarHutangDariGrid /
// hitungDaftarHutangPiutangDariGrid di GAS lama)
// ============================================================

export interface RiwayatBayar {
  tglTampil: string;
  nominal: number;
  rekening: string;
}

export interface HutangDPItem {
  piutangId: string;
  keterangan: string;
  tipe: Tipe;
  kategori: string;
  tglSort: string;
  tglTampil: string;
  totalTagihan: number;
  totalDibayar: number;
  sisa: number;
  status: 'DP' | 'Sebagian Dibayar' | 'Lunas';
  riwayat: RiwayatBayar[];
}

export interface HutangPiutangItem {
  hpId: string;
  tipe: 'Hutang' | 'Piutang';
  pihak: string;
  keterangan: string;
  tglSort: string;
  tglTampil: string;
  jatuhTempo: string;
  nominalPokok: number;
  totalDibayar: number;
  sisa: number;
  status: 'Berjalan' | 'Lunas';
  riwayat: RiwayatBayar[];
}
