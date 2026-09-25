'use server';

import { requireUser } from '@/lib/supabase/server';
import { resolveWorkspaceId } from './workspace';
import { recalculateBalance } from './transaksi';
import { getJamSekarang, buatId } from '@/lib/utils';
import type {
  ActionResult,
  SimpanHutangPiutangBaruPayload,
  TambahPembayaranHutangPiutangPayload,
} from '@/lib/types';

// Padanan simpanHutangPiutangBaru(obj).
// Piutang = saya memberi pinjaman  -> uang KELUAR dari rekening saya (Pengeluaran)
// Hutang  = saya menerima pinjaman -> uang MASUK ke rekening saya (Pemasukan)
// Kategori transaksi diberi nama 'Piutang'/'Hutang' (dikecualikan dari rekap
// Pemasukan/Pengeluaran biasa, sama seperti kategori 'Transfer'), tapi tetap
// mempengaruhi saldo per rekening.
export async function simpanHutangPiutangBaru(obj: SimpanHutangPiutangBaruPayload): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const pihak = (obj.pihakTerkait || '').trim();
    const nominal = parseFloat(String(obj.nominal)) || 0;

    if (!obj.workspace || !obj.tipe || !pihak || !obj.tanggal || nominal <= 0) {
      return { success: false, error: 'Data belum lengkap. Pastikan Pihak Terkait dan Nominal sudah diisi.' };
    }

    const wsId = await resolveWorkspaceId(supabase, user.id, obj.workspace);
    if (!wsId) return { success: false, error: 'Data akun tidak ditemukan!' };

    const tipeTransaksi = obj.tipe === 'Piutang' ? 'Pengeluaran' : 'Pemasukan';
    const ketDefault = (obj.tipe === 'Piutang' ? 'Piutang ke ' : 'Hutang dari ') + pihak;
    const hpId = buatId('HP');

    const { error } = await supabase.from('transactions').insert({
      workspace_id: wsId,
      tanggal: obj.tanggal,
      tipe: tipeTransaksi,
      kategori: obj.tipe, // 'Hutang' | 'Piutang'
      keterangan: (obj.keterangan || '').trim() || ketDefault,
      nominal,
      saldo: 0,
      rekening: obj.rekening || 'CASH',
      bukti: [],
      jam: obj.jam || getJamSekarang(),
      pihak_terkait: pihak,
      hutang_piutang_id: hpId,
      peranan_hp: 'Pokok',
      jatuh_tempo: obj.jatuhTempo || null,
    });
    if (error) return { success: false, error: error.message };

    await recalculateBalance(supabase, wsId);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// Padanan tambahPembayaranHutangPiutang(obj).
export async function tambahPembayaranHutangPiutang(obj: TambahPembayaranHutangPiutangPayload): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const nominal = parseFloat(String(obj.nominal)) || 0;

    if (!obj.workspace || !obj.hpId || !obj.tanggal || nominal <= 0) {
      return { success: false, error: 'Data pembayaran tidak lengkap.' };
    }

    const wsId = await resolveWorkspaceId(supabase, user.id, obj.workspace);
    if (!wsId) return { success: false, error: 'Data akun tidak ditemukan!' };

    type BarisHP = { kategori: string; pihak_terkait: string; nominal: number; peranan_hp: string };
    const { data: rows } = await supabase
      .from('transactions')
      .select('kategori, pihak_terkait, nominal, peranan_hp')
      .eq('workspace_id', wsId)
      .eq('hutang_piutang_id', obj.hpId)
      .returns<BarisHP[]>();

    let pokok: BarisHP | null = null;
    let totalDibayarSaatIni = 0;
    const barisAll = rows || [];
    barisAll.forEach((r) => {
      if (r.peranan_hp !== 'Pokok') totalDibayarSaatIni += parseFloat(String(r.nominal)) || 0;
    });
    pokok = barisAll.find((r) => r.peranan_hp === 'Pokok') ?? null;

    if (!pokok) return { success: false, error: 'Data Hutang/Piutang tidak ditemukan.' };

    const nominalPokok = parseFloat(String(pokok.nominal)) || 0;
    const sisaSaatIni = nominalPokok - totalDibayarSaatIni;
    if (sisaSaatIni <= 0) return { success: false, error: 'Item ini sudah lunas, tidak perlu pembayaran lagi.' };

    const tipeKategori = pokok.kategori; // 'Hutang' | 'Piutang'
    const pihakTerkait = pokok.pihak_terkait;
    const tipeTransaksi = tipeKategori === 'Piutang' ? 'Pemasukan' : 'Pengeluaran';
    const ketDefault = (tipeKategori === 'Piutang' ? 'Pembayaran dari ' : 'Bayar hutang ke ') + pihakTerkait;

    const { error } = await supabase.from('transactions').insert({
      workspace_id: wsId,
      tanggal: obj.tanggal,
      tipe: tipeTransaksi,
      kategori: tipeKategori,
      keterangan: (obj.keterangan || '').trim() || ketDefault,
      nominal,
      saldo: 0,
      rekening: obj.rekening || 'CASH',
      bukti: [],
      jam: obj.jam || getJamSekarang(),
      pihak_terkait: pihakTerkait,
      hutang_piutang_id: obj.hpId,
      peranan_hp: 'Pembayaran',
    });
    if (error) return { success: false, error: error.message };

    await recalculateBalance(supabase, wsId);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
