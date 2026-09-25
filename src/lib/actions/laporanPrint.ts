'use server';

import { requireUser } from '@/lib/supabase/server';
import { resolveWorkspaceId } from './workspace';
import { formatTanggalIndo } from '@/lib/utils';
import { siapkanItemLaporan, kelompokkan, urutanKategori, type HasilKelompokkan } from '@/lib/report/kelompokkan';
import { hitungDaftarHutangDariGrid, hitungDaftarHutangPiutangDariGrid, hitungNetHutangPiutangDariGrid } from '@/lib/report/hutang';
import type { HutangDPItem, HutangPiutangItem, JenisLaporan, Transaction } from '@/lib/types';

export interface LampiranBuktiItem {
  tglTampil: string;
  keterangan: string;
  rekening: string;
  nominal: number;
  tipe: 'Pemasukan' | 'Pengeluaran';
  bukti: string[];
}

export interface DataLaporanPrint {
  ws: string;
  jenis: JenisLaporan;
  teksPeriode: string;
  pemasukan: HasilKelompokkan;
  pengeluaran: HasilKelompokkan;
  saldoBersih: number;
  hutangList: HutangDPItem[];
  hpList: HutangPiutangItem[];
  lampiranBukti: LampiranBuktiItem[];
  dicetakPada: string;
  error?: string;
}

// Padanan pengumpulan data di downloadLaporanPDF + awal buatHtmlLaporan
// (sebelum tahap render string HTML — di Next.js tahap render dilakukan
// oleh JSX di src/app/reports/print/page.tsx).
export async function ambilDataLaporanPrint(
  ws: string,
  startDateStr: string,
  endDateStr: string,
  jenis: JenisLaporan,
  sertakanBukti: boolean
): Promise<DataLaporanPrint> {
  const kosong: DataLaporanPrint = {
    ws,
    jenis,
    teksPeriode: '',
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

    const sDate = new Date(startDateStr);
    sDate.setHours(0, 0, 0, 0);
    const eDate = new Date(endDateStr);
    eDate.setHours(23, 59, 59, 999);

    const dataAll = siapkanItemLaporan(transaksi, sDate, eDate);
    const pemasukan = kelompokkan(dataAll, 'Pemasukan', urutanMasuk);
    const pengeluaran = kelompokkan(dataAll, 'Pengeluaran', urutanKeluar);

    const netHP = hitungNetHutangPiutangDariGrid(transaksi, sDate, eDate);
    const saldoBersih = pemasukan.total + netHP.masuk - (pengeluaran.total + netHP.keluar);

    const hutangList = hitungDaftarHutangDariGrid(transaksi, sDate, eDate);
    const hpList = hitungDaftarHutangPiutangDariGrid(transaksi, sDate, eDate);

    // Padanan daftarLampiranBukti yang dikumpulkan baris() saat jenis 'detail'
    // (lihat catatan di Kode.gs) — MAKS_BUKTI_PER_HALAMAN diterapkan saat
    // render (lihat page.tsx), di sini cukup kumpulkan urut kronologis.
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
          });
        });
    }

    return {
      ws,
      jenis,
      teksPeriode: `${formatTanggalIndo(startDateStr)} s/d ${formatTanggalIndo(endDateStr)}`,
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
