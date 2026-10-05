import type { Transaction, Tipe, LaporanFilterOptions } from '@/lib/types';
import { formatTanggalIndo } from '@/lib/utils';

export function matchesTransaksiFilter(row: Transaction, filter?: LaporanFilterOptions | null): boolean {
  if (!filter) return true;

  if (filter.search) {
    const text = filter.search.trim().toLowerCase();
    if (text) {
      const haystack = [
        row.keterangan,
        row.kategori,
        row.sub_kategori,
        row.rekening,
        row.pihak_terkait,
        row.catatan,
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(text)) return false;
    }
  }

  if (filter.tipe && filter.tipe !== 'Semua' && row.tipe !== filter.tipe) return false;
  if (filter.warna && filter.warna !== 'Semua' && row.warna_highlight !== filter.warna) return false;
  if (filter.rekening && row.rekening !== filter.rekening) return false;
  if (filter.kategori && row.kategori !== filter.kategori) return false;
  if (filter.tanggal && row.tanggal !== filter.tanggal) return false;
  if (filter.bulan) {
    const [y, m] = filter.bulan.split('-');
    const tgl = new Date(`${row.tanggal}T00:00:00`);
    if (String(tgl.getFullYear()) !== y || String(tgl.getMonth() + 1).padStart(2, '0') !== m) return false;
  }
  if (filter.tahun) {
    const tgl = new Date(`${row.tanggal}T00:00:00`);
    if (String(tgl.getFullYear()) !== filter.tahun) return false;
  }
  if (filter.startDate && new Date(`${row.tanggal}T00:00:00`) < new Date(`${filter.startDate}T00:00:00`)) return false;
  if (filter.endDate && new Date(`${row.tanggal}T00:00:00`) > new Date(`${filter.endDate}T23:59:59`)) return false;

  return true;
}

export interface ItemLaporan {
  tglTampil: string;
  tglSort: string;
  tipe: Tipe;
  kategori: string;
  keterangan: string;
  nominal: number;
  rekening: string;
  warna: string;
  pihakTerkait: string;
  subKategori: string;
  bukti: string[];
}

export interface SubBreakdownItem {
  nama: string;
  nominal: number;
}

export interface GrupKategori {
  kategori: string;
  transaksi: ItemLaporan[];
  subtotal: number;
  subBreakdown: SubBreakdownItem[];
}

export interface HasilKelompokkan {
  grup: GrupKategori[];
  total: number;
}

// Padanan filter dataAll di downloadLaporanPDF/downloadLaporanExcelDetail:
// exclude Transfer/Hutang/Piutang/Tabungan, filter rentang tanggal [sDate,eDate] atau filter custom.
export function siapkanItemLaporan(
  transaksi: Transaction[],
  sDate?: Date | null,
  eDate?: Date | null,
  filter?: LaporanFilterOptions | null
): ItemLaporan[] {
  const out: ItemLaporan[] = [];
  transaksi.forEach((row) => {
    if (sDate) {
      const tgl = new Date(row.tanggal);
      if (tgl < sDate) return;
    }
    if (eDate) {
      const tgl = new Date(row.tanggal);
      if (tgl > eDate) return;
    }
    if (filter && !matchesTransaksiFilter(row, filter)) return;
    if (['Transfer', 'Hutang', 'Piutang', 'Tabungan'].includes(row.kategori)) return;
    out.push({
      tglTampil: formatTanggalIndo(row.tanggal),
      tglSort: row.tanggal,
      tipe: row.tipe,
      kategori: row.kategori || '-',
      keterangan: row.keterangan || '',
      nominal: parseFloat(String(row.nominal)) || 0,
      rekening: row.rekening || 'CASH',
      warna: row.warna_highlight || '',
      pihakTerkait: row.pihak_terkait || '',
      subKategori: row.sub_kategori || '',
      bukti: row.bukti || [],
    });
  });
  return out;
}

// Padanan function kelompokkan(tipe, urutanKat) — dipakai downloadLaporanPDF
// & downloadLaporanExcelDetail (identik di keduanya di versi GAS lama).
export function kelompokkan(dataAll: ItemLaporan[], tipe: Tipe, urutanKat: string[]): HasilKelompokkan {
  const items = dataAll.filter((d) => d.tipe === tipe);
  const byKat: Record<string, ItemLaporan[]> = {};
  items.forEach((d) => {
    (byKat[d.kategori] = byKat[d.kategori] || []).push(d);
  });

  const urutanFinal = urutanKat.filter((k) => byKat[k]);
  Object.keys(byKat).forEach((k) => {
    if (!urutanFinal.includes(k)) urutanFinal.push(k);
  });

  const total = items.reduce((a, d) => a + d.nominal, 0);
  const grup: GrupKategori[] = urutanFinal.map((k) => {
    const trans = byKat[k].slice().sort((a, b) => new Date(a.tglSort).getTime() - new Date(b.tglSort).getTime());
    const subtotal = trans.reduce((a, d) => a + d.nominal, 0);
    const subMap: Record<string, number> = {};
    trans.forEach((d) => {
      if (d.subKategori) subMap[d.subKategori] = (subMap[d.subKategori] || 0) + d.nominal;
    });
    const subBreakdown = Object.keys(subMap)
      .sort()
      .map((sk) => ({ nama: sk, nominal: subMap[sk] }));
    return { kategori: k, transaksi: trans, subtotal, subBreakdown };
  });

  return { grup, total };
}

// Padanan pengambilan urutanMasuk/urutanKeluar dari sheet Kategori_<ws> —
// urutan kategori sesuai yang didaftarkan di aplikasi.
export function urutanKategori(kategoriRows: { tipe: Tipe; nama: string }[]): { urutanMasuk: string[]; urutanKeluar: string[] } {
  const urutanMasuk: string[] = [];
  const urutanKeluar: string[] = [];
  kategoriRows.forEach((r) => {
    if (r.tipe === 'Pemasukan') {
      if (!urutanMasuk.includes(r.nama)) urutanMasuk.push(r.nama);
    } else if (r.tipe === 'Pengeluaran') {
      if (!urutanKeluar.includes(r.nama)) urutanKeluar.push(r.nama);
    }
  });
  return { urutanMasuk, urutanKeluar };
}
