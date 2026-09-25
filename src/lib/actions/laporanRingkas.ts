'use server';

import ExcelJS from 'exceljs';
import { requireUser } from '@/lib/supabase/server';
import { resolveWorkspaceId } from './workspace';
import { formatTanggalIndo } from '@/lib/utils';
import { ringkasPerKategori } from '@/lib/report/ringkas';
import { hitungDaftarHutangDariGrid, hitungDaftarHutangPiutangDariGrid } from '@/lib/report/hutang';
import type { Transaction } from '@/lib/types';

export interface LaporanFileResult {
  data: string; // base64
  mimeType: string;
  filename: string;
}
export type LaporanResult = LaporanFileResult | { error: string };

async function ambilTransaksiRange(
  ws: string,
  startDateStr: string,
  endDateStr: string
): Promise<{ transaksi: Transaction[]; sDate: Date; eDate: Date; wsId: string } | { error: string }> {
  const { supabase, user } = await requireUser();
  const wsId = await resolveWorkspaceId(supabase, user.id, ws);
  if (!wsId) return { error: 'Data akun tidak ditemukan!' };

  const { data: transaksi } = await supabase.from('transactions').select('*').eq('workspace_id', wsId);

  const sDate = new Date(startDateStr);
  sDate.setHours(0, 0, 0, 0);
  const eDate = new Date(endDateStr);
  eDate.setHours(23, 59, 59, 999);

  return { transaksi: (transaksi || []) as Transaction[], sDate, eDate, wsId };
}

// Padanan downloadLaporanBase64(ws, startDateStr, endDateStr, format='xlsx')
export async function generateLaporanExcelRingkas(
  ws: string,
  startDateStr: string,
  endDateStr: string
): Promise<LaporanResult> {
  try {
    const ctx = await ambilTransaksiRange(ws, startDateStr, endDateStr);
    if ('error' in ctx) return ctx;
    const { transaksi, sDate, eDate } = ctx;

    const { listMasuk, listKeluar, subMasuk, subKeluar, totalMasuk, totalKeluar } = ringkasPerKategori(
      transaksi,
      sDate,
      eDate
    );
    const saldoAkhir = totalMasuk - totalKeluar;
    const teksPeriode = `${formatTanggalIndo(startDateStr)} s/d ${formatTanggalIndo(endDateStr)}`;

    const hutangList = hitungDaftarHutangDariGrid(transaksi, sDate, eDate);
    const hpList = hitungDaftarHutangPiutangDariGrid(transaksi, sDate, eDate);

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Laporan');
    sheet.columns = [{ width: 40 }, { width: 23 }];

    const rp = (n: number) => n; // nilai numerik asli, format tampilan diatur lewat numFmt
    const rows: (string | number)[][] = [];
    rows.push(['LAPORAN KEUANGAN', '']);
    rows.push(['Nama Akun / Workspace', ws]);
    rows.push(['Periode Laporan', teksPeriode]);
    rows.push(['', '']);

    rows.push(['PEMASUKAN', '']);
    const subRowIdx: number[] = [];
    let subRowsMasukCount = 0;
    Object.keys(listMasuk).forEach((k) => {
      rows.push([`   ${k}`, rp(listMasuk[k])]);
      if (subMasuk[k]) {
        Object.keys(subMasuk[k])
          .sort()
          .forEach((sk) => {
            rows.push([`      \u2022 ${sk}`, rp(subMasuk[k][sk])]);
            subRowIdx.push(rows.length);
            subRowsMasukCount++;
          });
      }
    });
    if (Object.keys(listMasuk).length === 0) rows.push(['   (Tidak ada pemasukan)', 0]);
    rows.push(['TOTAL PEMASUKAN', rp(totalMasuk)]);
    const totalMIdx = rows.length;
    rows.push(['', '']);

    rows.push(['PENGELUARAN', '']);
    const idxK = rows.length;
    let subRowsKeluarCount = 0;
    Object.keys(listKeluar).forEach((k) => {
      rows.push([`   ${k}`, rp(listKeluar[k])]);
      if (subKeluar[k]) {
        Object.keys(subKeluar[k])
          .sort()
          .forEach((sk) => {
            rows.push([`      \u2022 ${sk}`, rp(subKeluar[k][sk])]);
            subRowIdx.push(rows.length);
            subRowsKeluarCount++;
          });
      }
    });
    if (Object.keys(listKeluar).length === 0) rows.push(['   (Tidak ada pengeluaran)', 0]);
    rows.push(['TOTAL PENGELUARAN', rp(totalKeluar)]);
    const totalKIdx = rows.length;
    rows.push(['', '']);

    rows.push(['SALDO BERSIH PERIODE INI', rp(saldoAkhir)]);
    const idxS = rows.length;

    let idxHutangHeader = -1;
    let idxHutangTotal = -1;
    if (hutangList.length > 0) {
      const totalTagihanHutang = hutangList.reduce((a, h) => a + h.totalTagihan, 0);
      const totalDibayarHutang = hutangList.reduce((a, h) => a + h.totalDibayar, 0);
      const totalSisaHutang = hutangList.reduce((a, h) => a + h.sisa, 0);

      rows.push(['', '']);
      idxHutangHeader = rows.length + 1;
      rows.push(['HUTANG & DP (CICILAN)', '']);
      hutangList.forEach((h) => {
        rows.push([`   ${h.keterangan} \u2014 ${h.tipe}`, '']);
        rows.push(['      Total Tagihan', rp(h.totalTagihan)]);
        rows.push(['      Sudah Dibayar', rp(h.totalDibayar)]);
        rows.push(['      Sisa Hutang', rp(h.sisa)]);
        rows.push([`      Status: ${h.status}`, '']);
      });
      rows.push(['TOTAL SISA HUTANG (Periode Ini)', rp(totalSisaHutang)]);
      idxHutangTotal = rows.length;
      void totalTagihanHutang;
      void totalDibayarHutang;
    }

    let idxHPHeader = -1;
    let idxHPTotal = -1;
    if (hpList.length > 0) {
      const totalSisaHP = hpList.reduce((a, h) => a + h.sisa, 0);
      rows.push(['', '']);
      idxHPHeader = rows.length + 1;
      rows.push(['HUTANG & PIUTANG (PINJAM-MEMINJAM)', '']);
      hpList.forEach((h) => {
        rows.push([`   ${h.pihak} \u2014 ${h.tipe}`, '']);
        rows.push(['      Tanggal Transaksi', h.tglTampil]);
        rows.push(['      Nominal Awal', rp(h.nominalPokok)]);
        rows.push(['      Sudah Dibayar', rp(h.totalDibayar)]);
        rows.push([`      Status${h.jatuhTempo ? ` (Jatuh Tempo: ${h.jatuhTempo})` : ''}: ${h.status}`, '']);
      });
      rows.push(['TOTAL SISA HUTANG & PIUTANG (Periode Ini)', rp(totalSisaHP)]);
      idxHPTotal = rows.length;
    }

    sheet.addRows(rows);

    // ===== Styling (padanan blok "MEWARNAI & MEMFORMAT" di Kode.gs) =====
    sheet.mergeCells('A1:B1');
    sheet.getCell('A1').font = { bold: true, size: 14 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    ['A2', 'A3'].forEach((addr) => {
      sheet.getCell(addr).font = { bold: true, color: { argb: 'FF64748B' } };
    });

    for (let r = 5; r <= rows.length; r++) {
      sheet.getCell(`B${r}`).numFmt = '"Rp" #,##0';
    }

    subRowIdx.forEach((r) => {
      sheet.getCell(`A${r}`).font = { color: { argb: 'FF94A3B8' }, italic: true, size: 9.5 };
      sheet.getCell(`B${r}`).font = { color: { argb: 'FF94A3B8' }, italic: true, size: 9.5 };
    });

    const mergeHeaderBg = (row: number, bg: string) => {
      sheet.mergeCells(`A${row}:B${row}`);
      sheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      sheet.getCell(`A${row}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    };
    const totalRowBg = (row: number, bg: string, color: string) => {
      ['A', 'B'].forEach((col) => {
        sheet.getCell(`${col}${row}`).font = { bold: true, color: { argb: color } };
        sheet.getCell(`${col}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      });
    };

    mergeHeaderBg(5, 'FF10B981');
    totalRowBg(totalMIdx, 'FFD1FAE5', 'FF047857');
    mergeHeaderBg(idxK, 'FFEF4444');
    totalRowBg(totalKIdx, 'FFFEE2E2', 'FFB91C1C');

    sheet.getCell(`A${idxS}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    sheet.getCell(`A${idxS}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } };
    sheet.getCell(`B${idxS}`).font = { bold: true, size: 12, color: { argb: 'FF0369A1' } };
    sheet.getCell(`B${idxS}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };

    if (idxHutangHeader > 0) {
      mergeHeaderBg(idxHutangHeader, 'FF7C3AED');
      totalRowBg(idxHutangTotal, 'FFEDE9FE', 'FF6D28D9');
    }
    if (idxHPHeader > 0) {
      mergeHeaderBg(idxHPHeader, 'FF0D9488');
      totalRowBg(idxHPTotal, 'FFCCFBF1', 'FF0F766E');
    }

    const buf = await wb.xlsx.writeBuffer();
    const namaFile = `Laporan_${ws.replace(/ /g, '_')}_${startDateStr}_sd_${endDateStr}.xlsx`;

    return {
      data: Buffer.from(buf).toString('base64'),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: namaFile,
    };
  } catch (e) {
    return { error: String(e) };
  }
}

export { ambilTransaksiRange };
