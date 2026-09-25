'use server';

import { requireUser } from '@/lib/supabase/server';
import { resolveWorkspaceId } from './workspace';
import { recalculateBalance } from './transaksi';
import { getJamSekarang } from '@/lib/utils';
import type { ActionResult, TransferSaldoPayload } from '@/lib/types';

// Padanan transferSaldo(obj) — mencatat 2 baris: Pengeluaran di rekening
// asal + Pemasukan di rekening tujuan, kategori 'Transfer'.
export async function transferSaldo(obj: TransferSaldoPayload): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const nominal = parseFloat(String(obj.nominal)) || 0;
    const jam = obj.jam || getJamSekarang();
    const keterangan = obj.keterangan || `Transfer ${obj.dari} \u2192 ${obj.ke}`;

    if (!obj.workspace || !obj.tanggal || !obj.dari || !obj.ke || nominal <= 0) {
      return { success: false, error: 'Data transfer tidak lengkap.' };
    }
    if (obj.dari === obj.ke) {
      return { success: false, error: 'Rekening asal dan tujuan tidak boleh sama!' };
    }

    const wsId = await resolveWorkspaceId(supabase, user.id, obj.workspace);
    if (!wsId) return { success: false, error: `Sheet transaksi tidak ditemukan untuk akun: ${obj.workspace}` };

    const { error } = await supabase.from('transactions').insert([
      {
        workspace_id: wsId,
        tanggal: obj.tanggal,
        tipe: 'Pengeluaran',
        kategori: 'Transfer',
        keterangan,
        nominal,
        saldo: 0,
        rekening: obj.dari,
        bukti: [],
        jam,
      },
      {
        workspace_id: wsId,
        tanggal: obj.tanggal,
        tipe: 'Pemasukan',
        kategori: 'Transfer',
        keterangan,
        nominal,
        saldo: 0,
        rekening: obj.ke,
        bukti: [],
        jam,
      },
    ]);
    if (error) return { success: false, error: error.message };

    await recalculateBalance(supabase, wsId);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function editTransferSaldo(obj: {
  workspace: string;
  id: string;
  tanggal: string;
  dari: string;
  ke: string;
  nominal: number;
  keterangan?: string;
  jam?: string;
}): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const wsId = await resolveWorkspaceId(supabase, user.id, obj.workspace);
    if (!wsId) return { success: false, error: 'Workspace tidak ditemukan.' };

    const nominal = parseFloat(String(obj.nominal)) || 0;
    if (!obj.id || !obj.tanggal || !obj.dari || !obj.ke || nominal <= 0) {
      return { success: false, error: 'Data transfer tidak lengkap.' };
    }
    if (obj.dari === obj.ke) {
      return { success: false, error: 'Rekening asal dan tujuan tidak boleh sama!' };
    }

    const { data: rowAwal } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', obj.id)
      .eq('workspace_id', wsId)
      .single();

    if (!rowAwal) return { success: false, error: 'Data transfer tidak ditemukan.' };

    const keteranganBaru = (obj.keterangan || '').trim() || `Transfer ${obj.dari} → ${obj.ke}`;
    const jam = obj.jam || rowAwal.jam || getJamSekarang();

    const { data: pasangan } = await supabase
      .from('transactions')
      .select('*')
      .eq('workspace_id', wsId)
      .eq('kategori', 'Transfer')
      .eq('nominal', rowAwal.nominal)
      .eq('tanggal', rowAwal.tanggal)
      .eq('keterangan', rowAwal.keterangan)
      .neq('id', obj.id)
      .order('created_at', { ascending: true });

    const pairId = pasangan?.[0]?.id;
    if (!pairId) return { success: false, error: 'Pasangan transfer tidak ditemukan.' };

    const { error } = await supabase.from('transactions').upsert([
      {
        id: obj.id,
        workspace_id: wsId,
        tanggal: obj.tanggal,
        tipe: rowAwal.tipe,
        kategori: 'Transfer',
        keterangan: keteranganBaru,
        nominal,
        saldo: 0,
        rekening: obj.dari,
        bukti: rowAwal.bukti || [],
        jam,
      },
      {
        id: pairId,
        workspace_id: wsId,
        tanggal: obj.tanggal,
        tipe: pasangan[0].tipe,
        kategori: 'Transfer',
        keterangan: keteranganBaru,
        nominal,
        saldo: 0,
        rekening: obj.ke,
        bukti: pasangan[0].bukti || [],
        jam,
      },
    ], { onConflict: 'id' });

    if (error) return { success: false, error: error.message };

    await recalculateBalance(supabase, wsId);
    return { success: true, message: 'Transfer berhasil diperbarui.' };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function hapusTransferSaldo(obj: { workspace: string; id: string }): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const wsId = await resolveWorkspaceId(supabase, user.id, obj.workspace);
    if (!wsId) return { success: false, error: 'Workspace tidak ditemukan.' };

    const { data: row } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', obj.id)
      .eq('workspace_id', wsId)
      .single();

    if (!row) return { success: false, error: 'Data transfer tidak ditemukan.' };

    const { data: pasangan } = await supabase
      .from('transactions')
      .select('*')
      .eq('workspace_id', wsId)
      .eq('kategori', 'Transfer')
      .eq('nominal', row.nominal)
      .eq('tanggal', row.tanggal)
      .eq('keterangan', row.keterangan)
      .neq('id', obj.id)
      .limit(1);

    const ids = [obj.id, ...(pasangan || []).map((r) => r.id)];
    const { error } = await supabase.from('transactions').delete().in('id', ids);
    if (error) return { success: false, error: error.message };

    await recalculateBalance(supabase, wsId);
    return { success: true, message: 'Transfer berhasil dihapus.' };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
