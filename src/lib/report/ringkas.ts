import type { Transaction } from '@/lib/types';

export interface RingkasHasil {
  listMasuk: Record<string, number>;
  listKeluar: Record<string, number>;
  subMasuk: Record<string, Record<string, number>>;
  subKeluar: Record<string, Record<string, number>>;
  totalMasuk: number;
  totalKeluar: number;
}

// Padanan loop kalkulasi di downloadLaporanBase64 (Kode.gs). Transfer & Tabungan
// dikecualikan total (netral). Hutang/Piutang tidak muncul di rincian per-kategori,
// tapi nominalnya tetap masuk ke Total Pemasukan/Pengeluaran (Piutang mengurangi
// Saldo Bersih, Hutang menambah — karena Piutang dicatat sbg Pengeluaran & Hutang
// sbg Pemasukan pada baris Pokok-nya).
export function ringkasPerKategori(transaksi: Transaction[], sDate: Date, eDate: Date): RingkasHasil {
  const listMasuk: Record<string, number> = {};
  const listKeluar: Record<string, number> = {};
  const subMasuk: Record<string, Record<string, number>> = {};
  const subKeluar: Record<string, Record<string, number>> = {};
  let totalMasuk = 0;
  let totalKeluar = 0;

  transaksi.forEach((row) => {
    const kat = row.kategori;
    if (kat === 'Transfer' || kat === 'Tabungan') return;
    const tgl = new Date(row.tanggal);
    if (tgl < sDate || tgl > eDate) return;

    const tipe = row.tipe;
    const nom = parseFloat(String(row.nominal)) || 0;
    const subKat = row.sub_kategori || '';

    if (kat === 'Hutang' || kat === 'Piutang') {
      if (tipe === 'Pemasukan') totalMasuk += nom;
      else if (tipe === 'Pengeluaran') totalKeluar += nom;
      return;
    }

    if (tipe === 'Pemasukan') {
      listMasuk[kat] = (listMasuk[kat] || 0) + nom;
      totalMasuk += nom;
      if (subKat) {
        subMasuk[kat] = subMasuk[kat] || {};
        subMasuk[kat][subKat] = (subMasuk[kat][subKat] || 0) + nom;
      }
    } else if (tipe === 'Pengeluaran') {
      listKeluar[kat] = (listKeluar[kat] || 0) + nom;
      totalKeluar += nom;
      if (subKat) {
        subKeluar[kat] = subKeluar[kat] || {};
        subKeluar[kat][subKat] = (subKeluar[kat][subKat] || 0) + nom;
      }
    }
  });

  return { listMasuk, listKeluar, subMasuk, subKeluar, totalMasuk, totalKeluar };
}
