import type { SupabaseClient } from '@supabase/supabase-js';
import type { InitWorkspaceData, KatMap, RiwayatTransaksi, TabunganGabungan, Transaction, Budget } from '@/lib/types';

// Helper murni (BUKAN Server Action) — dipakai bersama oleh workspace.ts dan
// transaksi.ts. Semua query ke tabel yang saling lepas dijalankan PARALEL
// lewat Promise.all, bukan berurutan satu per satu.

const RANGE_REGEX = /<!--range:([0-9-]+)-->/;

export function parseCatatanRange(rawCatatan: string): { catatan: string; sampaiTanggal: string | null } {
  if (!rawCatatan) return { catatan: '', sampaiTanggal: null };
  const match = rawCatatan.match(RANGE_REGEX);
  const sampaiTanggal = match ? match[1] : null;
  const catatan = rawCatatan.replace(/<!--range:.*?-->/g, '').trim();
  return { catatan, sampaiTanggal };
}

export const RIWAYAT_KOSONG: RiwayatTransaksi = { transaksi: [], anggaran: [], tabungan: [] };

// ---------- Rekening + Kategori ----------
export function ambilInitRaw(supabase: SupabaseClient, wsId: string) {
  return Promise.all([
    supabase.from('accounts').select('nama').eq('workspace_id', wsId).order('created_at', { ascending: true }),
    supabase
      .from('categories')
      .select('id, tipe, nama, subcategories(nama)')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: true }),
  ]);
}

export function bangunInit(
  listWs: string[],
  active: string,
  raw?: Awaited<ReturnType<typeof ambilInitRaw>>
): InitWorkspaceData {
  let listRek: string[] = ['CASH'];
  const katMasuk: KatMap = {};
  const katKeluar: KatMap = {};

  if (raw) {
    const [{ data: rekRows }, { data: katRows }] = raw;
    if (rekRows && rekRows.length > 0) listRek = rekRows.map((r) => r.nama);

    (katRows || []).forEach((k) => {
      const target = k.tipe === 'Pemasukan' ? katMasuk : k.tipe === 'Pengeluaran' ? katKeluar : null;
      if (!target) return;
      target[k.nama] = ((k as unknown as { subcategories: { nama: string }[] }).subcategories || []).map(
        (s) => s.nama
      );
    });
  }

  return { workspaces: listWs, rekenings: listRek, active, katMasuk, katKeluar };
}

// ---------- Transaksi + Anggaran + Tabungan ----------
export function ambilRiwayatRaw(supabase: SupabaseClient, wsId: string) {
  return Promise.all([
    supabase.from('transactions').select('*').eq('workspace_id', wsId).order('created_at', { ascending: true }),
    supabase.from('budgets').select('*').eq('workspace_id', wsId),
    supabase
      .from('savings_targets')
      .select('*, savings_deposits(*)')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: true }),
  ]);
}

export function bangunRiwayat(raw: Awaited<ReturnType<typeof ambilRiwayatRaw>>): RiwayatTransaksi {
  const [{ data: transaksi }, { data: anggaran }, { data: targets }] = raw;

  const tabungan: TabunganGabungan[] = (targets || []).map((t) => ({
    id: t.id,
    jenis: 'Target',
    keterangan: t.keterangan,
    targetNominal: parseFloat(String(t.target_nominal)) || 0,
    tenggat: t.tenggat,
    deposits: ((t as unknown as { savings_deposits: unknown[] }).savings_deposits ||
      []) as RiwayatTransaksi['tabungan'][number]['deposits'],
  }));

  const parsedTransaksi: Transaction[] = ((transaksi || []) as any[]).map((row) => {
    const { catatan, sampaiTanggal } = parseCatatanRange(row.catatan || '');
    return {
      ...row,
      catatan,
      sampai_tanggal: row.sampai_tanggal || sampaiTanggal,
    };
  });

  return {
    transaksi: parsedTransaksi,
    anggaran: (anggaran || []) as Budget[],
    tabungan,
  };
}
