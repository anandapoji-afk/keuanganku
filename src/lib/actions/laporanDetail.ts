'use server';

import ExcelJS from 'exceljs';
import { requireUser } from '@/lib/supabase/server';
import { resolveWorkspaceId } from './workspace';
import { formatTanggalIndo, warnaHighlightHex } from '@/lib/utils';
import { siapkanItemLaporan, kelompokkan, urutanKategori, type ItemLaporan, type GrupKategori } from '@/lib/report/kelompokkan';
import { hitungDaftarHutangDariGrid, hitungDaftarHutangPiutangDariGrid, hitungNetHutangPiutangDariGrid } from '@/lib/report/hutang';
import type { Transaction } from '@/lib/types';
import type { LaporanResult } from './laporanRingkas';

const ARGB = {
  green: 'FF10B981', greenBg: 'FFD1FAE5', greenTxt: 'FF047857',
  red: 'FFEF4444', redBg: 'FFFEE2E2', redTxt: 'FFB91C1C',
  purple: 'FF7C3AED', purpleBg: 'FFEDE9FE', purpleTxt: 'FF6D28D9',
  teal: 'FF0D9488', tealBg: 'FFCCFBF1', tealTxt: 'FF0F766E',
  orangeBg: 'FFFFEDD5', orangeTxt: 'FFC2410C',
  slateBg: 'FFF1F5F9', slateTxt: 'FF475569',
  white: 'FFFFFFFF', blue: 'FF2563EB', gray: 'FF94A3B8',
};

type RowVal = string | number;

// Padanan downloadLaporanExcelDetail(ws, startDateStr, endDateStr)
export async function generateLaporanExcelDetail(
  ws: string,
  startDateStr: string,
  endDateStr: string
): Promise<LaporanResult> {
  try {
    const { supabase, user } = await requireUser();
    const wsId = await resolveWorkspaceId(supabase, user.id, ws);
    if (!wsId) return { error: 'Data akun tidak ditemukan!' };

    const { data: transRows } = await supabase.from('transactions').select('*').eq('workspace_id', wsId);
    const transaksi = (transRows || []) as Transaction[];

    const { data: katRows } = await supabase.from('categories').select('tipe, nama').eq('workspace_id', wsId);
    const { urutanMasuk, urutanKeluar } = urutanKategori((katRows || []) as { tipe: 'Pemasukan' | 'Pengeluaran'; nama: string }[]);

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

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Laporan Detail');
    sheet.columns = [{ width: 33 }, { width: 31 }, { width: 17 }, { width: 20 }];

    const rows: RowVal[][] = [];
    const greenHeaderRows: number[] = [];
    const redHeaderRows: number[] = [];
    const purpleHeaderRows: number[] = [];
    const tealHeaderRows: number[] = [];
    const katHeaderRows: { row: number; warna: string }[] = [];
    const subKatHeaderRows: number[] = [];
    const subHeadRows: number[] = [];
    const totalRows: { row: number; warna: string }[] = [];
    const highlightRows: { row: number; warna: string }[] = [];
    const richKetRows: { row: number; ketPlain: string; pihakSuffix: string }[] = [];
    let saldoRow = -1;

    function pushRow(arr: RowVal[]): number {
      rows.push(arr);
      return rows.length;
    }

    function renderTransaksiKategori(g: GrupKategori) {
      subHeadRows.push(pushRow(['Tanggal', 'Keterangan', 'Rekening', 'Nominal']));

      function renderBaris(list: ItemLaporan[]) {
        list.forEach((t) => {
          const labelPihak = t.tipe === 'Pemasukan' ? 'Dari' : 'Ke';
          const pihakSuffix = t.pihakTerkait ? ` (${labelPihak}: ${t.pihakTerkait})` : '';
          const r = pushRow([t.tglTampil, t.keterangan + pihakSuffix, t.rekening, t.nominal]);
          if (t.warna) highlightRows.push({ row: r, warna: t.warna });
          if (pihakSuffix) richKetRows.push({ row: r, ketPlain: t.keterangan, pihakSuffix });
        });
      }

      const tanpaSub = g.transaksi.filter((t) => !t.subKategori);
      const bySub: Record<string, ItemLaporan[]> = {};
      g.transaksi.forEach((t) => {
        if (t.subKategori) (bySub[t.subKategori] = bySub[t.subKategori] || []).push(t);
      });
      const namaSubSorted = Object.keys(bySub).sort();

      if (tanpaSub.length > 0) renderBaris(tanpaSub);

      namaSubSorted.forEach((sk) => {
        const listSub = bySub[sk];
        const subtotalSub = listSub.reduce((a, d) => a + d.nominal, 0);
        subKatHeaderRows.push(pushRow([`   \u00bb ${sk}`, '', '', subtotalSub]));
        subHeadRows.push(pushRow(['Tanggal', 'Keterangan', 'Rekening', 'Nominal']));
        renderBaris(listSub);
      });
    }

    pushRow(['LAPORAN KEUANGAN DETAIL TRANSAKSI', '', '', '']);
    pushRow(['Nama Akun / Workspace', ws, '', '']);
    pushRow(['Periode Laporan', `${formatTanggalIndo(startDateStr)} s/d ${formatTanggalIndo(endDateStr)}`, '', '']);
    pushRow(['', '', '', '']);

    greenHeaderRows.push(pushRow(['PEMASUKAN', '', '', '']));
    if (pemasukan.grup.length === 0) pushRow(['   (Tidak ada pemasukan)', '', '', '']);
    pemasukan.grup.forEach((g) => {
      katHeaderRows.push({ row: pushRow([g.kategori, '', '', g.subtotal]), warna: 'in' });
      renderTransaksiKategori(g);
    });
    totalRows.push({ row: pushRow(['TOTAL PEMASUKAN', '', '', pemasukan.total]), warna: 'in' });
    pushRow(['', '', '', '']);

    redHeaderRows.push(pushRow(['PENGELUARAN', '', '', '']));
    if (pengeluaran.grup.length === 0) pushRow(['   (Tidak ada pengeluaran)', '', '', '']);
    pengeluaran.grup.forEach((g) => {
      katHeaderRows.push({ row: pushRow([g.kategori, '', '', g.subtotal]), warna: 'out' });
      renderTransaksiKategori(g);
    });
    totalRows.push({ row: pushRow(['TOTAL PENGELUARAN', '', '', pengeluaran.total]), warna: 'out' });
    pushRow(['', '', '', '']);

    saldoRow = pushRow(['SALDO BERSIH PERIODE INI', '', '', saldoBersih]);

    if (hutangList.length > 0) {
      const totalSisaHutang = hutangList.reduce((a, h) => a + h.sisa, 0);
      pushRow(['', '', '', '']);
      purpleHeaderRows.push(pushRow(['HUTANG & DP (CICILAN)', '', '', '']));
      hutangList.forEach((h) => {
        katHeaderRows.push({ row: pushRow([`${h.keterangan} (${h.tipe})`, `Status: ${h.status}`, 'Total Tagihan', h.totalTagihan]), warna: 'hutang' });
        pushRow(['', '', 'Sudah Dibayar', h.totalDibayar]);
        pushRow(['', '', 'Sisa Hutang', h.sisa]);
        subHeadRows.push(pushRow(['Tanggal', 'Pembayaran ke-', 'Rekening', 'Nominal']));
        h.riwayat.forEach((r, idx) => {
          const label = idx === 0 ? 'DP Awal' : `Cicilan ke-${idx}`;
          pushRow([r.tglTampil, label, r.rekening, r.nominal]);
        });
      });
      totalRows.push({ row: pushRow(['TOTAL SISA HUTANG (Periode Ini)', '', '', totalSisaHutang]), warna: 'hutang' });
    }

    if (hpList.length > 0) {
      const totalSisaHP = hpList.reduce((a, h) => a + h.sisa, 0);
      pushRow(['', '', '', '']);
      tealHeaderRows.push(pushRow(['HUTANG & PIUTANG (PINJAM-MEMINJAM)', '', '', '']));
      hpList.forEach((h) => {
        const warnaKat = h.tipe === 'Piutang' ? 'hp_piutang' : 'hp_hutang';
        const jt = h.jatuhTempo ? ` | Jatuh Tempo: ${h.jatuhTempo}` : '';
        katHeaderRows.push({ row: pushRow([`${h.pihak} (${h.tipe})`, `Status: ${h.status}${jt}`, 'Nominal Awal', h.nominalPokok]), warna: warnaKat });
        pushRow(['', '', 'Tanggal Transaksi', h.tglTampil]);
        pushRow(['', '', 'Sudah Dibayar', h.totalDibayar]);
        pushRow(['', '', 'Sisa', h.sisa]);
        if (h.riwayat.length > 0) {
          subHeadRows.push(pushRow(['Tanggal', 'Pembayaran ke-', 'Rekening', 'Nominal']));
          h.riwayat.forEach((r, idx) => pushRow([r.tglTampil, `Pembayaran ke-${idx + 1}`, r.rekening, r.nominal]));
        }
      });
      totalRows.push({ row: pushRow(['TOTAL SISA HUTANG & PIUTANG (Periode Ini)', '', '', totalSisaHP]), warna: 'hp_total' });
    }

    sheet.addRows(rows);

    // ===== STYLING =====
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').font = { bold: true, size: 14 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.slateBg } };
    ['A2', 'A3'].forEach((a) => (sheet.getCell(a).font = { bold: true, color: { argb: ARGB.gray } }));

    const mergeHeader = (rowsArr: number[], bg: string) =>
      rowsArr.forEach((r) => {
        sheet.mergeCells(`A${r}:D${r}`);
        sheet.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        sheet.getCell(`A${r}`).font = { bold: true, color: { argb: ARGB.white } };
        sheet.getCell(`A${r}`).alignment = { horizontal: 'center' };
      });
    mergeHeader(greenHeaderRows, ARGB.green);
    mergeHeader(redHeaderRows, ARGB.red);
    mergeHeader(purpleHeaderRows, ARGB.purple);
    mergeHeader(tealHeaderRows, ARGB.teal);

    function warnaKatDetail(w: string): [string, string] {
      if (w === 'in') return [ARGB.greenBg, ARGB.greenTxt];
      if (w === 'out') return [ARGB.redBg, ARGB.redTxt];
      if (w === 'hp_hutang') return [ARGB.orangeBg, ARGB.orangeTxt];
      if (w === 'hp_total') return [ARGB.tealBg, ARGB.tealTxt];
      return [ARGB.purpleBg, ARGB.purpleTxt]; // 'hutang' (DP lama) & 'hp_piutang'
    }

    katHeaderRows.forEach(({ row, warna }) => {
      const [bg, txt] = warnaKatDetail(warna);
      ['A', 'B', 'C', 'D'].forEach((col) => {
        sheet.getCell(`${col}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        sheet.getCell(`${col}${row}`).font = { bold: true, color: { argb: txt } };
      });
    });

    subKatHeaderRows.forEach((r) => {
      ['A', 'B', 'C', 'D'].forEach((col) => {
        sheet.getCell(`${col}${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.slateBg } };
        sheet.getCell(`${col}${r}`).font = { bold: true, color: { argb: ARGB.slateTxt } };
      });
    });

    subHeadRows.forEach((r) => {
      ['A', 'B', 'C', 'D'].forEach((col) => {
        sheet.getCell(`${col}${r}`).font = { color: { argb: ARGB.gray }, italic: true, size: 9 };
      });
    });

    highlightRows.forEach(({ row, warna }) => {
      const bg = warnaHighlightHex(warna);
      if (!bg) return;
      const argb = 'FF' + bg.replace('#', '').toUpperCase();
      ['A', 'B', 'C', 'D'].forEach((col) => {
        sheet.getCell(`${col}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
      });
    });

    // Rich text kolom B: bagian "(Ke:/Dari: ...)" diwarnai biru bold, padanan
    // RichTextValue di GAS lama.
    richKetRows.forEach(({ row, ketPlain, pihakSuffix }) => {
      sheet.getCell(`B${row}`).value = {
        richText: [
          { text: ketPlain, font: {} },
          { text: pihakSuffix, font: { bold: true, color: { argb: ARGB.blue } } },
        ],
      };
    });

    totalRows.forEach(({ row, warna }) => {
      const [bg, txt] = warnaKatDetail(warna);
      ['A', 'B', 'C', 'D'].forEach((col) => {
        sheet.getCell(`${col}${row}`).font = { bold: true, color: { argb: txt } };
        sheet.getCell(`${col}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      });
    });

    if (saldoRow > 0) {
      ['A', 'B', 'C'].forEach((col) => {
        sheet.getCell(`${col}${saldoRow}`).font = { bold: true, size: 12, color: { argb: ARGB.white } };
        sheet.getCell(`${col}${saldoRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } };
      });
      sheet.getCell(`D${saldoRow}`).font = { bold: true, size: 12, color: { argb: 'FF0369A1' } };
      sheet.getCell(`D${saldoRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
    }

    for (let r = 5; r <= rows.length; r++) {
      sheet.getCell(`D${r}`).numFmt = '"Rp" #,##0';
    }

    const buf = await wb.xlsx.writeBuffer();
    const namaFile = `Laporan_Detail_${ws.replace(/ /g, '_')}_${startDateStr}_sd_${endDateStr}.xlsx`;

    return {
      data: Buffer.from(buf).toString('base64'),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: namaFile,
    };
  } catch (e) {
    return { error: String(e) };
  }
}
