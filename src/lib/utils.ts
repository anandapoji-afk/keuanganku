import type { WarnaHighlight } from './types';

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// Padanan formatTanggalIndo(dateStr) di Kode.gs
export function formatTanggalIndo(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return String(dateStr);
  return `${date.getDate()} ${NAMA_BULAN[date.getMonth()]} ${date.getFullYear()}`;
}

// Padanan rp(n) di buatHtmlLaporan (Kode.gs)
export function rp(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID').replace(/,/g, '.');
}

// Padanan pct(n, total) di buatHtmlLaporan
export function pct(n: number, total: number): string {
  return total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '0%';
}

// Padanan getJamSekarang() — dipanggil sbg fallback saat frontend tidak
// mengirim jam. Timezone diasumsikan waktu lokal browser/server (WIB dsb
// diatur lewat TZ env server jika perlu; Apps Script dulu pakai
// Session.getScriptTimeZone()).
export function getJamSekarang(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// Padanan warnaHighlightHex(warna) di Kode.gs — dipakai laporan PDF/Excel
export function warnaHighlightHex(warna: string): string {
  const map: Record<string, string> = {
    kuning: '#fef9c3',
    hijau: '#dcfce7',
    pink: '#fce7f3',
    biru: '#dbeafe',
    oranye: '#ffedd5',
    ungu: '#ede9fe',
  };
  return map[warna] || '';
}

export const DAFTAR_WARNA_HIGHLIGHT: { value: WarnaHighlight; label: string; hex: string }[] = [
  { value: '', label: 'Tanpa warna', hex: '' },
  { value: 'kuning', label: 'Kuning', hex: '#fef9c3' },
  { value: 'hijau', label: 'Hijau', hex: '#dcfce7' },
  { value: 'pink', label: 'Pink', hex: '#fce7f3' },
  { value: 'biru', label: 'Biru', hex: '#dbeafe' },
  { value: 'oranye', label: 'Oranye', hex: '#ffedd5' },
  { value: 'ungu', label: 'Ungu', hex: '#ede9fe' },
];

// Padanan keterangan.replace(/\b\w/g, l => l.toUpperCase()) di simpanTransaksi —
// mengubah huruf pertama tiap kata jadi kapital.
export function kapitalisasiKata(s: string): string {
  return s.replace(/\b\w/g, (l) => l.toUpperCase());
}

// ID unik bergaya lama (mis. 'PTG'+timestamp, 'HP'+timestamp) supaya format
// piutang_id / hutang_piutang_id tetap konsisten dgn histori data lama jika
// diimpor dari Sheets. Untuk data baru sebenarnya boleh pakai uuid biasa,
// tapi prefix dipertahankan agar gampang dibedakan di database.
export function buatId(prefix: string): string {
  return prefix + Date.now().toString();
}

export function cleanNum(v: string | number | null | undefined): number {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}
