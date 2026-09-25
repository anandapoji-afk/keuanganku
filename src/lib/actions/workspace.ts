'use server';

import { requireUser } from '@/lib/supabase/server';
import type { ActionResult, InitWorkspaceData, KatMap } from '@/lib/types';

// ============================================================
// Padanan setupMasterWorkspace() di Kode.gs — dulu otomatis membuat
// workspace "Dompet Pribadi" + rekening BCA/CASH + kategori default saat
// doGet() pertama kali dipanggil (spreadsheet baru). Di sini dipanggil
// eksplisit saat user baru login dan belum punya workspace sama sekali.
// Idempotent: hanya membuat jika user belum punya workspace apapun.
// ============================================================
export async function setupDefaultWorkspaceJikaBelumAda(): Promise<void> {
  const { supabase, user } = await requireUser();

  const { count } = await supabase
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (count && count > 0) return;

  const { data: ws, error } = await supabase
    .from('workspaces')
    .insert({ user_id: user.id, nama: 'Dompet Pribadi' })
    .select('id')
    .single();
  if (error || !ws) return;

  await supabase.from('accounts').insert([
    { workspace_id: ws.id, nama: 'BCA' },
    { workspace_id: ws.id, nama: 'CASH' },
  ]);

  const defaultKats: { tipe: 'Pemasukan' | 'Pengeluaran'; nama: string }[] = [
    { tipe: 'Pengeluaran', nama: 'Makan & Minum' },
    { tipe: 'Pengeluaran', nama: 'Transportasi' },
    { tipe: 'Pengeluaran', nama: 'Keluarga' },
    { tipe: 'Pengeluaran', nama: 'Belanja' },
    { tipe: 'Pengeluaran', nama: 'Lain-lain' },
    { tipe: 'Pemasukan', nama: 'Gaji & Honor' },
    { tipe: 'Pemasukan', nama: 'Bonus' },
    { tipe: 'Pemasukan', nama: 'Lain-lain' },
  ];
  await supabase
    .from('categories')
    .insert(defaultKats.map((k) => ({ workspace_id: ws.id, tipe: k.tipe, nama: k.nama })));
}

// Padanan tambahAkunWorkspace(namaBaru) — membuat workspace baru dgn
// preset kategori "bisnis" (Operasional/Pemasaran/dst), beda dari preset
// personal di setupDefaultWorkspaceJikaBelumAda, PERSIS seperti GAS lama.
export async function tambahAkunWorkspace(namaBaru: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const nama = (namaBaru || '').trim();
    if (!nama) return { success: false, error: 'Nama akun tidak boleh kosong.' };

    const { data: existing } = await supabase
      .from('workspaces')
      .select('id, nama')
      .eq('user_id', user.id);

    if ((existing || []).some((w: { nama: string }) => w.nama.toLowerCase() === nama.toLowerCase())) {
      return { success: false, error: "Error: Nama Akun sudah ada!" };
    }

    const { data: ws, error } = await supabase
      .from('workspaces')
      .insert({ user_id: user.id, nama })
      .select('id')
      .single();
    if (error || !ws) return { success: false, error: 'Error: ' + (error?.message || 'gagal membuat workspace') };

    await supabase.from('accounts').insert({ workspace_id: ws.id, nama: 'KAS KANTOR' });

    const defaultKats: { tipe: 'Pemasukan' | 'Pengeluaran'; nama: string }[] = [
      { tipe: 'Pengeluaran', nama: 'Operasional' },
      { tipe: 'Pengeluaran', nama: 'Pemasaran' },
      { tipe: 'Pengeluaran', nama: 'Inventaris' },
      { tipe: 'Pengeluaran', nama: 'Lain-lain' },
      { tipe: 'Pemasukan', nama: 'Penjualan' },
      { tipe: 'Pemasukan', nama: 'Pendanaan' },
      { tipe: 'Pemasukan', nama: 'Lain-lain' },
    ];
    await supabase
      .from('categories')
      .insert(defaultKats.map((k) => ({ workspace_id: ws.id, tipe: k.tipe, nama: k.nama })));

    return { success: true, message: `Akun '${nama}' berhasil dibuat!` };
  } catch (e) {
    return { success: false, error: 'Error: ' + String(e) };
  }
}

// Resolve nama workspace -> id, dibatasi ke milik user yang sedang login
// (padanan implisit "1 pemilik spreadsheet" di GAS lama, di sini eksplisit lewat RLS + query).
export async function resolveWorkspaceId(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  userId: string,
  namaWorkspace: string
): Promise<string | null> {
  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .eq('user_id', userId)
    .eq('nama', namaWorkspace)
    .maybeSingle();
  return data?.id ?? null;
}

// Padanan getInitWorkspaceData(wsAktif)
export async function getInitWorkspaceData(wsAktif?: string): Promise<InitWorkspaceData> {
  const { supabase, user } = await requireUser();

  const { data: wsRows } = await supabase
    .from('workspaces')
    .select('id, nama')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  const listWs = (wsRows || []).map((w) => w.nama);
  const active = wsAktif && listWs.includes(wsAktif) ? wsAktif : listWs[0];
  const activeRow = (wsRows || []).find((w) => w.nama === active);

  let listRek: string[] = ['CASH'];
  const katMasuk: KatMap = {};
  const katKeluar: KatMap = {};

  if (activeRow) {
    const { data: rekRows } = await supabase
      .from('accounts')
      .select('nama')
      .eq('workspace_id', activeRow.id)
      .order('created_at', { ascending: true });
    if (rekRows && rekRows.length > 0) listRek = rekRows.map((r) => r.nama);

    const { data: katRows } = await supabase
      .from('categories')
      .select('id, tipe, nama, subcategories(nama)')
      .eq('workspace_id', activeRow.id)
      .order('created_at', { ascending: true });

    (katRows || []).forEach((k) => {
      const target = k.tipe === 'Pemasukan' ? katMasuk : k.tipe === 'Pengeluaran' ? katKeluar : null;
      if (!target) return;
      target[k.nama] = ((k as unknown as { subcategories: { nama: string }[] }).subcategories || []).map(
        (s) => s.nama
      );
    });
  }

  return { workspaces: listWs, rekenings: listRek, active: active || '', katMasuk, katKeluar };
}

// Padanan simpanPreferensiUser(pref) / ambilPreferensiUser()
export async function simpanPreferensiUser(pref: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, pref, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function ambilPreferensiUser(): Promise<Record<string, unknown> | null> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from('user_preferences')
    .select('pref')
    .eq('user_id', user.id)
    .maybeSingle();
  return data?.pref ?? null;
}
