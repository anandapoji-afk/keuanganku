'use server';

import { requireUser } from '@/lib/supabase/server';
import { resolveWorkspaceId } from './workspace';
import { recalculateBalance } from './transaksi';
import { getJamSekarang } from '@/lib/utils';
import type { ActionResult, TambahPembayaranDPPayload } from '@/lib/types';

// Padanan tambahPembayaranDP(obj) — mencatat baris cicilan baru (Lunas)
// yang tertaut via piutang_id, otomatis ikut mempengaruhi saldo rekening.
export async function tambahPembayaranDP(obj: TambahPembayaranDPPayload): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const nominal = parseFloat(String(obj.nominal)) || 0;

    if (!obj.workspace || !obj.piutangId || !obj.tanggal || nominal <= 0) {
      return { success: false, error: 'Data pembayaran tidak lengkap.' };
    }

    const wsId = await resolveWorkspaceId(supabase, user.id, obj.workspace);
    if (!wsId) return { success: false, error: 'Data akun tidak ditemukan!' };

    type BarisDP = { tipe: string; kategori: string; keterangan: string; nominal: number; status_bayar: string; total_tagihan: number };
    const { data: rowsRaw } = await supabase
      .from('transactions')
      .select('tipe, kategori, keterangan, nominal, status_bayar, total_tagihan')
      .eq('workspace_id', wsId)
      .eq('piutang_id', obj.piutangId);
    const rows = rowsRaw as BarisDP[] | null;

    let masterRow: BarisDP | null = null;
    let totalDibayarSaatIni = 0;
    const barisAll = rows || [];
    barisAll.forEach((r) => {
      totalDibayarSaatIni += parseFloat(String(r.nominal)) || 0;
    });
    masterRow = barisAll.find((r) => r.status_bayar === 'DP') ?? null;

    if (!masterRow) return { success: false, error: 'Data hutang tidak ditemukan.' };

    const totalTagihan = parseFloat(String(masterRow.total_tagihan)) || 0;
    const sisaSaatIni = totalTagihan - totalDibayarSaatIni;
    if (sisaSaatIni <= 0) return { success: false, error: 'Hutang ini sudah lunas, tidak perlu pembayaran lagi.' };

    const m = masterRow;
    const ketBaru = (obj.keterangan || '').trim() || `Cicilan: ${m.keterangan}`;

    const { error } = await supabase.from('transactions').insert({
      workspace_id: wsId,
      tanggal: obj.tanggal,
      tipe: m.tipe,
      kategori: m.kategori,
      keterangan: ketBaru,
      nominal,
      saldo: 0,
      rekening: obj.rekening || 'CASH',
      bukti: [],
      piutang_id: obj.piutangId,
      status_bayar: 'Lunas',
      total_tagihan: 0,
      jam: obj.jam || getJamSekarang(),
    });
    if (error) return { success: false, error: error.message };

    await recalculateBalance(supabase, wsId);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
