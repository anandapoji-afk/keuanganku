'use server';

import { requireUser } from '@/lib/supabase/server';
import { resolveWorkspaceId } from './workspace';
import { recalculateBalance } from './transaksi';
import { getJamSekarang, buatId } from '@/lib/utils';
import type {
  ActionResult,
  SimpanTabunganBaruPayload,
  SimpanIsiTabunganPayload,
  HapusItemTabunganPayload,
} from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Nama rekening khusus tempat "menampung" semua dana tabungan — sama seperti
// versi lama (REKENING_TABUNGAN = 'TABUNGAN').
const REKENING_TABUNGAN = 'TABUNGAN';

// Padanan pastikanRekeningAda(ws, nama) — dibuat otomatis di tabel `accounts`
// kalau belum terdaftar. Idempotent.
export async function pastikanRekeningAda(supabase: SupabaseClient, workspaceId: string, nama: string): Promise<void> {
  const { data: existing } = await supabase
    .from('accounts')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('nama', nama)
    .maybeSingle();
  if (existing) return;
  await supabase.from('accounts').insert({ workspace_id: workspaceId, nama });
}

// Padanan simpanTabunganBaru(obj) — membuat Target baru, TIDAK menyentuh
// Saldo/Transaksi sama sekali (murni penanda target).
export async function simpanTabunganBaru(obj: SimpanTabunganBaruPayload): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const nominal = parseFloat(String(obj.nominal)) || 0;
    const keterangan = (obj.keterangan || '').trim();

    if (!obj.workspace || !keterangan || nominal <= 0) return { success: false, error: 'Data tidak lengkap' };

    const wsId = await resolveWorkspaceId(supabase, user.id, obj.workspace);
    if (!wsId) return { success: false, error: 'Akun tidak ditemukan' };

    const { error } = await supabase.from('savings_targets').insert({
      workspace_id: wsId,
      keterangan,
      target_nominal: nominal,
      tenggat: obj.tenggat || null,
    });
    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// Padanan simpanIsiTabungan(obj) — saldo dipindahkan sebagai TRANSFER (bukan
// pengeluaran murni): 1 baris Pengeluaran dari rekening asal + 1 baris
// Pemasukan ke rekening TABUNGAN, ditautkan via transfer_link/hutang_piutang_id
// yang SAMA, supaya bisa dihapus bersamaan dari menu Tabungan. Ringkasan
// Saldo (total semua rekening) TIDAK berubah karena uang cuma pindah rekening.
export async function simpanIsiTabungan(obj: SimpanIsiTabunganPayload): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const nominal = parseFloat(String(obj.nominal)) || 0;

    if (!obj.workspace || !obj.tbgId || !obj.tanggal || nominal <= 0) return { success: false, error: 'Data tidak lengkap' };

    const wsId = await resolveWorkspaceId(supabase, user.id, obj.workspace);
    if (!wsId) return { success: false, error: 'Akun tidak ditemukan' };

    const jam = obj.jam || getJamSekarang();
    const rekeningAsal = obj.rekening || 'CASH';
    const keterangan = (obj.keterangan || '').trim() || 'Nabung';
    const riwayatId = buatId('TABR');

    const { error: errDeposit } = await supabase.from('savings_deposits').insert({
      workspace_id: wsId,
      target_id: obj.tbgId,
      tanggal: obj.tanggal,
      jam,
      nominal,
      rekening: rekeningAsal,
      keterangan,
      transfer_link: riwayatId,
    });
    if (errDeposit) return { success: false, error: errDeposit.message };

    await pastikanRekeningAda(supabase, wsId, REKENING_TABUNGAN);

    const { error: errTrans } = await supabase.from('transactions').insert([
      {
        workspace_id: wsId,
        tanggal: obj.tanggal,
        tipe: 'Pengeluaran',
        kategori: 'Tabungan',
        keterangan,
        nominal,
        saldo: 0,
        rekening: rekeningAsal,
        bukti: [],
        jam,
        hutang_piutang_id: riwayatId,
      },
      {
        workspace_id: wsId,
        tanggal: obj.tanggal,
        tipe: 'Pemasukan',
        kategori: 'Tabungan',
        keterangan,
        nominal,
        saldo: 0,
        rekening: REKENING_TABUNGAN,
        bukti: [],
        jam,
        hutang_piutang_id: riwayatId,
      },
    ]);
    if (errTrans) return { success: false, error: errTrans.message };

    await recalculateBalance(supabase, wsId);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// Padanan hapusItemTabungan(obj) — jenis 'Target' (proteksi: tidak bisa
// dihapus jika masih ada riwayat isi) atau 'Isi' (hapus riwayat + kedua
// baris transaksi mutasi saldo yang tertaut, lalu hitung ulang Saldo).
export async function hapusItemTabungan(obj: HapusItemTabunganPayload): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    if (!obj.workspace || !obj.id || !obj.jenis) return { success: false, error: 'Data tidak lengkap' };

    const wsId = await resolveWorkspaceId(supabase, user.id, obj.workspace);
    if (!wsId) return { success: false, error: 'Akun tidak ditemukan' };

    if (obj.jenis === 'Target') {
      const { count } = await supabase
        .from('savings_deposits')
        .select('id', { count: 'exact', head: true })
        .eq('target_id', obj.id);
      if (count && count > 0) {
        return { success: false, error: 'Tabungan ini sudah memiliki riwayat pengisian. Hapus riwayat isi tabungannya terlebih dahulu.' };
      }

      const { error } = await supabase.from('savings_targets').delete().eq('id', obj.id).eq('workspace_id', wsId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    // jenis === 'Isi'
    const { data: deposit } = await supabase
      .from('savings_deposits')
      .select('id, transfer_link')
      .eq('id', obj.id)
      .eq('workspace_id', wsId)
      .maybeSingle();
    if (!deposit) return { success: false, error: 'Data tidak ditemukan' };

    // hapus KEDUA baris transaksi mutasi saldo yang tertaut (Pengeluaran asal + Pemasukan TABUNGAN)
    await supabase.from('transactions').delete().eq('workspace_id', wsId).eq('hutang_piutang_id', deposit.transfer_link);

    const { error } = await supabase.from('savings_deposits').delete().eq('id', obj.id).eq('workspace_id', wsId);
    if (error) return { success: false, error: error.message };

    await recalculateBalance(supabase, wsId);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
