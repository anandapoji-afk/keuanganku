import type { Transaction, HutangDPItem, HutangPiutangItem } from '@/lib/types';
import { formatTanggalIndo } from '@/lib/utils';

// ============================================================
// Padanan hitungDaftarHutangDariGrid(grid, sDate, eDate) di Kode.gs.
// Hanya menyertakan item DP yang tanggal transaksi AWAL-nya ada di rentang
// [sDate, eDate] (kalau null, semua disertakan). Total Dibayar tetap
// dihitung dari SELURUH cicilan yang tertaut (tidak dibatasi rentang),
// supaya status/sisa selalu akurat — sama seperti versi GAS lama.
// Dipakai baik oleh UI (halaman Hutang & Cicilan) maupun generator laporan.
// ============================================================
export function hitungDaftarHutangDariGrid(
  transaksi: Transaction[],
  sDate: Date | null = null,
  eDate: Date | null = null
): HutangDPItem[] {
  const byId: Record<string, Transaction[]> = {};
  const masterById: Record<string, Transaction> = {};

  transaksi.forEach((row) => {
    const pid = row.piutang_id;
    if (!pid) return;
    (byId[pid] = byId[pid] || []).push(row);
    if (row.status_bayar === 'DP') masterById[pid] = row;
  });

  const list: HutangDPItem[] = [];
  Object.keys(masterById).forEach((pid) => {
    const m = masterById[pid];
    const tglMaster = new Date(m.tanggal);
    if (sDate && tglMaster < sDate) return;
    if (eDate && tglMaster > eDate) return;

    const rows = (byId[pid] || []).slice().sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
    const totalDibayar = rows.reduce((a, r) => a + (parseFloat(String(r.nominal)) || 0), 0);
    const totalTagihan = parseFloat(String(m.total_tagihan)) || 0;
    const sisa = Math.max(totalTagihan - totalDibayar, 0);
    const status: HutangDPItem['status'] =
      sisa <= 0 ? 'Lunas' : totalDibayar > (parseFloat(String(m.nominal)) || 0) ? 'Sebagian Dibayar' : 'DP';

    list.push({
      piutangId: pid,
      keterangan: m.keterangan || '-',
      tipe: m.tipe,
      kategori: m.kategori || '-',
      tglSort: tglMaster.toISOString(),
      tglTampil: formatTanggalIndo(m.tanggal),
      totalTagihan,
      totalDibayar,
      sisa,
      status,
      riwayat: rows.map((r) => ({
        tglTampil: formatTanggalIndo(r.tanggal),
        nominal: parseFloat(String(r.nominal)) || 0,
        rekening: r.rekening || 'CASH',
      })),
    });
  });

  list.sort((a, b) => new Date(a.tglSort).getTime() - new Date(b.tglSort).getTime());
  return list;
}

// ============================================================
// Padanan hitungDaftarHutangPiutangDariGrid(grid, sDate, eDate) di Kode.gs.
// ============================================================
export function hitungDaftarHutangPiutangDariGrid(
  transaksi: Transaction[],
  sDate: Date | null = null,
  eDate: Date | null = null
): HutangPiutangItem[] {
  const byId: Record<string, Transaction[]> = {};
  const pokokById: Record<string, Transaction> = {};

  transaksi.forEach((row) => {
    const hpId = row.hutang_piutang_id;
    if (!hpId) return;
    (byId[hpId] = byId[hpId] || []).push(row);
    if (row.peranan_hp === 'Pokok') pokokById[hpId] = row;
  });

  const list: HutangPiutangItem[] = [];
  Object.keys(pokokById).forEach((hpId) => {
    const p = pokokById[hpId];
    const tglPokok = new Date(p.tanggal);
    if (sDate && tglPokok < sDate) return;
    if (eDate && tglPokok > eDate) return;

    const rows = (byId[hpId] || [])
      .filter((r) => r.peranan_hp === 'Pembayaran')
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

    const totalDibayar = rows.reduce((a, r) => a + (parseFloat(String(r.nominal)) || 0), 0);
    const nominalPokok = parseFloat(String(p.nominal)) || 0;
    const sisa = Math.max(nominalPokok - totalDibayar, 0);
    const status: HutangPiutangItem['status'] = sisa <= 0 ? 'Lunas' : 'Berjalan';

    list.push({
      hpId,
      tipe: p.kategori as 'Hutang' | 'Piutang',
      pihak: p.pihak_terkait || '-',
      keterangan: p.keterangan || '-',
      tglSort: tglPokok.toISOString(),
      tglTampil: formatTanggalIndo(p.tanggal),
      jatuhTempo: p.jatuh_tempo ? formatTanggalIndo(p.jatuh_tempo) : '',
      nominalPokok,
      totalDibayar,
      sisa,
      status,
      riwayat: rows.map((r) => ({
        tglTampil: formatTanggalIndo(r.tanggal),
        nominal: parseFloat(String(r.nominal)) || 0,
        rekening: r.rekening || 'CASH',
      })),
    });
  });

  list.sort((a, b) => new Date(a.tglSort).getTime() - new Date(b.tglSort).getTime());
  return list;
}

// Padanan hitungNetHutangPiutangDariGrid(grid, sDate, eDate) di Kode.gs —
// total Pemasukan & Pengeluaran dari transaksi berkategori Hutang/Piutang
// dalam rentang tanggal, dipakai supaya Saldo Bersih laporan ikut
// memperhitungkan efek Hutang (menambah) & Piutang (mengurangi).
export function hitungNetHutangPiutangDariGrid(
  transaksi: Transaction[],
  sDate: Date | null = null,
  eDate: Date | null = null
): { masuk: number; keluar: number } {
  let masuk = 0;
  let keluar = 0;
  transaksi.forEach((row) => {
    const kat = row.kategori;
    if (kat !== 'Hutang' && kat !== 'Piutang') return;
    const tgl = new Date(row.tanggal);
    if (sDate && tgl < sDate) return;
    if (eDate && tgl > eDate) return;
    const nom = parseFloat(String(row.nominal)) || 0;
    if (row.tipe === 'Pemasukan') masuk += nom;
    else if (row.tipe === 'Pengeluaran') keluar += nom;
  });
  return { masuk, keluar };
}
