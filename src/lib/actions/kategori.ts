'use server';

import { requireUser } from '@/lib/supabase/server';
import { resolveWorkspaceId } from './workspace';
import type {
  ActionResult,
  TambahKategoriPayload,
  HapusKategoriPayload,
  TambahSubKategoriPayload,
  HapusSubKategoriPayload,
} from '@/lib/types';

// Padanan tambahKategori(obj)
export async function tambahKategori(obj: TambahKategoriPayload): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const nama = (obj.nama || '').trim();
    if (!obj.workspace || !obj.tipe || !nama) return { success: false, error: 'Error: Data kategori tidak lengkap.' };

    const wsId = await resolveWorkspaceId(supabase, user.id, obj.workspace);
    if (!wsId) return { success: false, error: 'Error: Data akun tidak ditemukan!' };

    const { data: existing } = await supabase
      .from('categories')
      .select('nama')
      .eq('workspace_id', wsId)
      .eq('tipe', obj.tipe);

    if ((existing || []).some((k) => k.nama.toLowerCase() === nama.toLowerCase())) {
      return { success: false, error: `Error: Kategori '${nama}' sudah ada!` };
    }

    const { error } = await supabase.from('categories').insert({ workspace_id: wsId, tipe: obj.tipe, nama });
    if (error) return { success: false, error: 'Error: ' + error.message };

    return { success: true, message: `Kategori '${nama}' berhasil ditambahkan!` };
  } catch (e) {
    return { success: false, error: 'Error: ' + String(e) };
  }
}

// Padanan hapusKategori(obj) — termasuk guard "masih dipakai di transaksi"
export async function hapusKategori(obj: HapusKategoriPayload): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const nama = (obj.nama || '').trim();
    if (!obj.workspace || !obj.tipe || !nama) return { success: false, error: 'Error: Data kategori tidak lengkap.' };

    const wsId = await resolveWorkspaceId(supabase, user.id, obj.workspace);
    if (!wsId) return { success: false, error: 'Error: Data akun tidak ditemukan!' };

    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', wsId)
      .eq('tipe', obj.tipe)
      .eq('kategori', nama);

    if (count && count > 0) {
      return { success: false, error: `Error: Kategori '${nama}' masih dipakai di data transaksi, tidak bisa dihapus.` };
    }

    const { data: kat } = await supabase
      .from('categories')
      .select('id')
      .eq('workspace_id', wsId)
      .eq('tipe', obj.tipe)
      .eq('nama', nama)
      .maybeSingle();

    if (!kat) return { success: false, error: 'Error: Kategori tidak ditemukan.' };

    // cascade menghapus subcategories terkait (lihat FK on delete cascade di schema.sql)
    const { error } = await supabase.from('categories').delete().eq('id', kat.id);
    if (error) return { success: false, error: 'Error: ' + error.message };

    return { success: true, message: `Kategori '${nama}' berhasil dihapus!` };
  } catch (e) {
    return { success: false, error: 'Error: ' + String(e) };
  }
}

// Padanan tambahSubKategori(obj) — mendukung banyak sub sekaligus (array `subs`)
export async function tambahSubKategori(obj: TambahSubKategoriPayload): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const subList = (obj.subs || [])
      .map((s) => (s || '').toString().trim())
      .filter((s) => s !== '');

    if (!obj.workspace || !obj.tipe || !obj.kategori || subList.length === 0) {
      return { success: false, error: 'Error: Data sub kategori tidak lengkap.' };
    }

    const wsId = await resolveWorkspaceId(supabase, user.id, obj.workspace);
    if (!wsId) return { success: false, error: 'Error: Data akun tidak ditemukan!' };

    const { data: kat } = await supabase
      .from('categories')
      .select('id')
      .eq('workspace_id', wsId)
      .eq('tipe', obj.tipe)
      .eq('nama', obj.kategori)
      .maybeSingle();
    if (!kat) return { success: false, error: 'Error: Data akun tidak ditemukan!' };

    const { data: existingSubs } = await supabase
      .from('subcategories')
      .select('nama')
      .eq('category_id', kat.id);

    const existingLower = new Set((existingSubs || []).map((s) => s.nama.toLowerCase()));
    const toInsert: string[] = [];
    subList.forEach((sub) => {
      if (!existingLower.has(sub.toLowerCase())) {
        existingLower.add(sub.toLowerCase()); // cegah duplikat sesama input baru
        toInsert.push(sub);
      }
    });

    if (toInsert.length === 0) return { success: false, error: 'Error: Sub kategori yang diinput sudah ada.' };

    const { error } = await supabase
      .from('subcategories')
      .insert(toInsert.map((nama) => ({ category_id: kat.id, nama })));
    if (error) return { success: false, error: 'Error: ' + error.message };

    return {
      success: true,
      message: toInsert.length === 1 ? 'Sub kategori berhasil ditambahkan!' : `${toInsert.length} Sub kategori berhasil ditambahkan sekaligus!`,
    };
  } catch (e) {
    return { success: false, error: 'Error: ' + String(e) };
  }
}

// Padanan hapusSubKategori(obj) — termasuk guard "masih dipakai di transaksi"
export async function hapusSubKategori(obj: HapusSubKategoriPayload): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const sub = (obj.sub || '').trim();
    if (!obj.workspace || !obj.tipe || !obj.kategori || !sub) {
      return { success: false, error: 'Error: Data sub kategori tidak lengkap.' };
    }

    const wsId = await resolveWorkspaceId(supabase, user.id, obj.workspace);
    if (!wsId) return { success: false, error: 'Error: Data akun tidak ditemukan!' };

    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', wsId)
      .eq('tipe', obj.tipe)
      .eq('kategori', obj.kategori)
      .eq('sub_kategori', sub);

    if (count && count > 0) {
      return { success: false, error: `Error: Sub kategori '${sub}' masih dipakai di data transaksi, tidak bisa dihapus.` };
    }

    const { data: kat } = await supabase
      .from('categories')
      .select('id')
      .eq('workspace_id', wsId)
      .eq('tipe', obj.tipe)
      .eq('nama', obj.kategori)
      .maybeSingle();
    if (!kat) return { success: false, error: 'Error: Sub kategori tidak ditemukan.' };

    const { error } = await supabase
      .from('subcategories')
      .delete()
      .eq('category_id', kat.id)
      .eq('nama', sub);
    if (error) return { success: false, error: 'Error: ' + error.message };

    return { success: true, message: `Sub kategori '${sub}' berhasil dihapus!` };
  } catch (e) {
    return { success: false, error: 'Error: ' + String(e) };
  }
}
