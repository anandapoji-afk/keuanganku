'use server';

import { requireUser } from '@/lib/supabase/server';
import { hapusBuktiDariSupabaseStorage } from './upload';
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

// Padanan hapusAkunWorkspace(namaWorkspace) — menghapus 1 akun/workspace beserta
// SELURUH data miliknya: rekening, kategori, anggaran, transaksi, tabungan
// (termasuk riwayat isi), dan file bukti transaksi di Storage.
//
// Baris tabel (accounts, categories, subcategories, budgets, transactions,
// savings_targets, savings_deposits) sudah otomatis ikut terhapus lewat
// `on delete cascade` di schema.sql begitu baris `workspaces` dihapus — TIDAK
// perlu dihapus manual satu-satu di sini.
//
// Yang TIDAK ikut cascade oleh database: file bukti transaksi di Supabase
// Storage (bucket terpisah dari tabel). File-file itu HARUS dihapus duluan di
// sini, sebelum baris workspace dihapus — begitu workspace hilang, path
// filenya (lewat join ke transactions) tidak bisa diambil lagi dan file jadi
// sampah yatim permanen di storage.
export async function hapusAkunWorkspace(namaWorkspace: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const nama = (namaWorkspace || '').trim();
    if (!nama) return { success: false, error: 'Error: Nama akun tidak valid.' };

    const { data: semuaWs } = await supabase
      .from('workspaces')
      .select('id, nama')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (!semuaWs || semuaWs.length === 0) return { success: false, error: 'Error: Akun tidak ditemukan.' };
    if (semuaWs.length <= 1) {
      return { success: false, error: 'Error: Tidak bisa menghapus akun terakhir. Minimal harus ada 1 akun.' };
    }

    const target = semuaWs.find((w) => w.nama === nama);
    if (!target) return { success: false, error: 'Error: Akun tidak ditemukan.' };

    // 1. Kumpulkan & hapus semua file bukti milik workspace ini dari Storage
    //    (best-effort per file — satu file gagal dihapus tidak menggagalkan
    //    seluruh proses, sama seperti pola di hapusTransaksi()).
    const { data: rowsBukti } = await supabase
      .from('transactions')
      .select('bukti')
      .eq('workspace_id', target.id)
      .not('bukti', 'is', null);

    const semuaUrlBukti = (rowsBukti || []).flatMap((r) => (r.bukti as string[]) || []);
    for (const url of semuaUrlBukti) {
      await hapusBuktiDariSupabaseStorage(url);
    }

    // 2. Hapus baris workspace -> cascade membereskan accounts, categories,
    //    subcategories, budgets, transactions, savings_targets, savings_deposits.
    const { error } = await supabase.from('workspaces').delete().eq('id', target.id).eq('user_id', user.id);
    if (error) return { success: false, error: 'Error: ' + error.message };

    // 3. Kalau workspace yang dihapus adalah workspace aktif user, pindahkan
    //    preferensi ke akun lain yang tersisa supaya sesi berikutnya tidak
    //    mengarah ke akun yang sudah tidak ada.
    const pref = await ambilPreferensiUser();
    const wsAktifSekarang = (pref?.workspace as string | undefined) || '';
    if (wsAktifSekarang === nama) {
      const sisa = semuaWs.find((w) => w.id !== target.id);
      if (sisa) await simpanPreferensiUser({ workspace: sisa.nama });
    }

    return { success: true, message: `Akun '${nama}' beserta seluruh datanya berhasil dihapus.` };
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
