'use server';

import { requireUser } from '@/lib/supabase/server';
import { resolveWorkspaceId } from './workspace';
import type { ActionResult, SimpanAnggaranPayload } from '@/lib/types';

// Padanan simpanAnggaran(formObject). `bulanTahun` datang dari <input type="month">
// dengan format "YYYY-MM" (dulu di-split GAS sbg [tahun, bulan]).
export async function simpanAnggaran(payload: SimpanAnggaranPayload): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const wsId = await resolveWorkspaceId(supabase, user.id, payload.workspace);
    if (!wsId) return { success: false, error: 'Error: Data akun tidak ditemukan!' };

    const [tahunStr, bulanStr] = (payload.bulanTahun || '').split('-');
    const tahun = parseInt(tahunStr, 10);
    const bulan = parseInt(bulanStr, 10);
    const kategori = payload.kategoriAnggaran;
    const subKategori = payload.subKategoriAnggaran || '';
    const nominal = parseFloat(String(payload.nominalAnggaran)) || 0;

    if (!tahun || !bulan || !kategori) return { success: false, error: 'Error: Data anggaran tidak lengkap.' };

    const { error } = await supabase
      .from('budgets')
      .upsert(
        { workspace_id: wsId, bulan, tahun, kategori, sub_kategori: subKategori, nominal },
        { onConflict: 'workspace_id,bulan,tahun,kategori,sub_kategori' }
      );
    if (error) return { success: false, error: 'Error: ' + error.message };

    return { success: true, message: `Anggaran untuk ${payload.workspace} berhasil disimpan!` };
  } catch (e) {
    return { success: false, error: 'Error: ' + String(e) };
  }
}
