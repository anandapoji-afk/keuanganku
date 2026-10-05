'use server';

import { requireUser } from '@/lib/supabase/server';
import { resolveWorkspaceId } from './workspace';
import { formatTanggalIndo } from '@/lib/utils';
import { siapkanItemLaporan, kelompokkan, urutanKategori, type HasilKelompokkan } from '@/lib/report/kelompokkan';
import { hitungDaftarHutangDariGrid, hitungDaftarHutangPiutangDariGrid, hitungNetHutangPiutangDariGrid } from '@/lib/report/hutang';
import type { HutangDPItem, HutangPiutangItem, JenisLaporan, Transaction, LaporanFilterOptions } from '@/lib/types';

export interface LampiranBuktiItem {
  tglTampil: string;
  keterangan: string;
  rekening: string;
  nominal: number;
  tipe: 'Pemasukan' | 'Pengeluaran';
  bukti: string[];
  catatan?: string;
}

export interface FilterBadgeItem {
  label: string;
  value: string;
}

export interface DataLaporanPrint {
  ws: string;
  jenis: JenisLaporan;
  teksPeriode: string;
  filterBadges: FilterBadgeItem[];
  pemasukan: HasilKelompokkan;
  pengeluaran: HasilKelompokkan;
  saldoBersih: number;
  hutangList: HutangDPItem[];
  hpList: HutangPiutangItem[];
  lampiranBukti: LampiranBuktiItem[];
  dicetakPada: string;
  error?: string;
}

function parseFilterParams(
  startDateOrOptions?: string | LaporanFilterOptions,
  endDateStr?: string,
  extraOptions?: LaporanFilterOptions
): {
  sDate: Date | null;
  eDate: Date | null;
  filter: LaporanFilterOptions;
  teksPeriode: string;
  filterBadges: FilterBadgeItem[];
} {
  let filter: LaporanFilterOptions = {};
  if (typeof startDateOrOptions === 'object' && startDateOrOptions !== null) {
    filter = { ...startDateOrOptions };
  } else {
    filter = {
      startDate: startDateOrOptions || '',
      endDate: endDateStr || '',
      ...(extraOptions || {}),
    };
  }

  let sDate: Date | null = null;
  let eDate: Date | null = null;

  if (filter.startDate) {
    sDate = new Date(filter.startDate);
    sDate.setHours(0, 0, 0, 0);
  }
  if (filter.endDate) {
    eDate = new Date(filter.endDate);
    eDate.setHours(23, 59, 59, 999);
  }

  let teksPeriode = 'Semua Riwayat';
  if (filter.startDate && filter.endDate) {
    if (filter.startDate === filter.endDate) {
      teksPeriode = formatTanggalIndo(filter.startDate);
    } else {
      teksPeriode = `${formatTanggalIndo(filter.startDate)} s/d ${formatTanggalIndo(filter.endDate)}`;
    }
  } else if (filter.tanggal) {
    teksPeriode = formatTanggalIndo(filter.tanggal);
  } else if (filter.bulan) {
    const [y, m] = filter.bulan.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, 1);
    const namaBulan = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    teksPeriode = `Bulan ${namaBulan}`;
  } else if (filter.tahun) {
    teksPeriode = `Tahun ${filter.tahun}`;
  } else if (filter.startDate) {
    teksPeriode = `Mulai ${formatTanggalIndo(filter.startDate)}`;
  } else if (filter.endDate) {
    teksPeriode = `Sampai ${formatTanggalIndo(filter.endDate)}`;
  }

  const filterBadges: FilterBadgeItem[] = [];
  if (filter.tipe && filter.tipe !== 'Semua') {
    filterBadges.push({ label: 'Tipe', value: filter.tipe });
  }
  if (filter.kategori) {
    filterBadges.push({ label: 'Kategori', value: filter.kategori });
  }
  if (filter.rekening) {
    filterBadges.push({ label: 'Rekening', value: filter.rekening });
  }
  if (filter.warna && filter.warna !== 'Semua') {
    filterBadges.push({ label: 'Highlight', value: filter.warna });
  }
  if (filter.search) {
    filterBadges.push({ label: 'Pencarian', value: `"${filter.search}"` });
  }

  return { sDate, eDate, filter, teksPeriode, filterBadges };
}

// Padanan pengumpulan data di downloadLaporanPDF + awal buatHtmlLaporan
// Mendukung filter rentang tanggal maupun filter dinamis transaksi (kategori, rekening, tipe, keyword).
export async function ambilDataLaporanPrint(
  ws: string,
  startDateOrOptions: string | LaporanFilterOptions,
  endDateStr: string = '',
  jenis: JenisLaporan = 'detail',
  sertakanBukti: boolean = false,
  extraFilter?: LaporanFilterOptions
): Promise<DataLaporanPrint> {
  const { sDate, eDate, filter, teksPeriode, filterBadges } = parseFilterParams(startDateOrOptions, endDateStr, extraFilter);

  const kosong: DataLaporanPrint = {
    ws,
    jenis,
    teksPeriode,
    filterBadges,
    pemasukan: { grup: [], total: 0 },
    pengeluaran: { grup: [], total: 0 },
    saldoBersih: 0,
    hutangList: [],
    hpList: [],
    lampiranBukti: [],
    dicetakPada: formatTanggalIndo(new Date()),
  };

  try {
    const { supabase, user } = await requireUser();
    const wsId = await resolveWorkspaceId(supabase, user.id, ws);
    if (!wsId) return { ...kosong, error: 'Data akun tidak ditemukan!' };

    const { data: transRows } = await supabase.from('transactions').select('*').eq('workspace_id', wsId);
    const transaksi = (transRows || []) as Transaction[];

    const { data: katRows } = await supabase.from('categories').select('tipe, nama').eq('workspace_id', wsId);
    const { urutanMasuk, urutanKeluar } = urutanKategori(
      (katRows || []) as { tipe: 'Pemasukan' | 'Pengeluaran'; nama: string }[]
    );

    const dataAll = siapkanItemLaporan(transaksi, sDate, eDate, filter);
    const pemasukan = kelompokkan(dataAll, 'Pemasukan', urutanMasuk);
    const pengeluaran = kelompokkan(dataAll, 'Pengeluaran', urutanKeluar);

    const netHP = hitungNetHutangPiutangDariGrid(transaksi, sDate, eDate, filter);
    const saldoBersih = pemasukan.total + netHP.masuk - (pengeluaran.total + netHP.keluar);

    const hutangList = hitungDaftarHutangDariGrid(transaksi, sDate, eDate, filter);
    const hpList = hitungDaftarHutangPiutangDariGrid(transaksi, sDate, eDate, filter);

    // Padanan daftarLampiranBukti yang dikumpulkan baris() saat jenis 'detail'
    const lampiranBukti: LampiranBuktiItem[] = [];
    if (jenis === 'detail' && sertakanBukti) {
      dataAll
        .filter((d) => d.bukti && d.bukti.length > 0)
        .sort((a, b) => new Date(a.tglSort).getTime() - new Date(b.tglSort).getTime())
        .forEach((d) => {
          lampiranBukti.push({
            tglTampil: d.tglTampil,
            keterangan: d.keterangan,
            rekening: d.rekening,
            nominal: d.nominal,
            tipe: d.tipe,
            bukti: d.bukti,
            catatan: d.catatan,
          });
        });
    }

    return {
      ws,
      jenis,
      teksPeriode,
      filterBadges,
      pemasukan,
      pengeluaran,
      saldoBersih,
      hutangList,
      hpList,
      lampiranBukti,
      dicetakPada: formatTanggalIndo(new Date()),
    };
  } catch (e) {
    return { ...kosong, error: String(e) };
  }
}
