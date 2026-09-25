'use server';

import { requireUser } from '@/lib/supabase/server';
import { resolveWorkspaceId } from './workspace';
import { uploadBuktiKeSupabaseStorage, hapusBuktiDariSupabaseStorage } from './upload';
import { getJamSekarang, kapitalisasiKata, buatId } from '@/lib/utils';
import type {
  ActionResult,
  SimpanTransaksiPayload,
  SimpanHighlightCatatanPayload,
  Transaction,
  Budget,
  RiwayatTransaksi,
  TabunganGabungan,
} from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Padanan recalculateBalance(ws) di Kode.gs.
// PENTING: running balance dihitung menurut URUTAN PEMBUATAN baris
// (di Sheets = urutan baris fisik / appendRow order), BUKAN diurutkan
// ulang berdasarkan tanggal transaksi — di sini direplikasi lewat
// `order('created_at').order('id')`, karena baris baru selalu
// ditambahkan di akhir (created_at terbaru) persis seperti appendRow,
// dan edit tidak memindah posisi baris. Baris "Pemasukan" ke rekening
// TABUNGAN tetap dikecualikan dari saldo fisik, sama seperti versi lama.
// ============================================================
export async function recalculateBalance(supabase: SupabaseClient, workspaceId: string): Promise<void> {
  const { data: rows } = await supabase
    .from('transactions')
    .select('id, tipe, nominal, rekening')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (!rows || rows.length === 0) return;

  let running = 0;
  const updates: { id: string; saldo: number }[] = [];
  for (const row of rows) {
    const isPemasukanKeTabungan = row.tipe === 'Pemasukan' && row.rekening === 'TABUNGAN';
    if (!isPemasukanKeTabungan) {
      const nominal = parseFloat(String(row.nominal)) || 0;
      if (row.tipe === 'Pemasukan') running += nominal;
      else if (row.tipe === 'Pengeluaran') running -= nominal;
    }
    updates.push({ id: row.id, saldo: running });
  }

  // upsert hanya menyentuh kolom yang dikirim (id, saldo) — kolom lain tidak berubah,
  // padanan setValues(2,6,...) yang cuma menulis kolom F (Saldo) di GAS lama.
  await supabase.from('transactions').upsert(updates, { onConflict: 'id' });
}

// Padanan simpanTransaksi(formObject) — mode tambah baru & edit sekaligus.
export async function simpanTransaksi(payload: SimpanTransaksiPayload): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const wsId = await resolveWorkspaceId(supabase, user.id, payload.workspace);
    if (!wsId) return { success: false, error: 'Error: Data akun tidak ditemukan!' };

    const jam = payload.jam || getJamSekarang();
    const keterangan = kapitalisasiKata(payload.keterangan || '');
    const nominal = parseFloat(String(payload.nominal)) || 0;
    const pihakTerkait = (payload.pihakTerkait || '').trim();
    const subKategori = (payload.subKategori || '').trim();

    // ===== Bukti transaksi (multi-file) =====
    let daftarBuktiUrl: string[] = [];
    if (payload.buktiLama && payload.buktiLama.length > 0) {
      daftarBuktiUrl = daftarBuktiUrl.concat(payload.buktiLama);
    }
    if (payload.buktiBaru && payload.buktiBaru.length > 0) {
      for (const fileB of payload.buktiBaru) {
        const uploaded = await uploadBuktiKeSupabaseStorage(fileB.data, fileB.mime, fileB.nama, payload.workspace);
        if ('error' in uploaded) return { success: false, error: 'Error: ' + uploaded.error };
        daftarBuktiUrl.push(uploaded.url);
      }
    }

    // ===== Status pembayaran (Lunas / DP) =====
    const statusBayarBaru = payload.statusBayar === 'DP' ? 'DP' : 'Lunas';
    let totalTagihanBaru = 0;
    let piutangId = '';

    if (statusBayarBaru === 'DP') {
      totalTagihanBaru = parseFloat(String(payload.totalTagihan)) || 0;
      if (totalTagihanBaru <= 0) return { success: false, error: 'Error: Total Tagihan harus diisi untuk transaksi DP.' };
      if (nominal <= 0) return { success: false, error: 'Error: Nominal DP harus diisi.' };
      if (nominal > totalTagihanBaru) return { success: false, error: 'Error: Nominal DP tidak boleh melebihi Total Tagihan.' };
    }

    if (payload.rowIdx) {
      // ---- MODE EDIT ----
      const { data: rowLama } = await supabase
        .from('transactions')
        .select('piutang_id, status_bayar, warna_highlight, catatan, bukti')
        .eq('id', payload.rowIdx)
        .eq('workspace_id', wsId)
        .single();
      if (!rowLama) return { success: false, error: 'Error: Transaksi tidak ditemukan.' };

      // Hapus bukti yang sudah di-remove oleh user dari storage
      const buktiLamaDb = ((rowLama as unknown as { bukti?: string[] }).bukti || []) as string[];
      const retainedSet = new Set(payload.buktiLama || []);
      const yangDihapus = buktiLamaDb.filter((u) => !retainedSet.has(u));
      for (const urlHapus of yangDihapus) {
        await hapusBuktiDariSupabaseStorage(urlHapus);
      }

      const piutangIdLama = rowLama.piutang_id || '';
      const statusBayarLama = rowLama.status_bayar || 'Lunas';
      const warnaHighlightLama = payload.warnaHighlight !== undefined ? payload.warnaHighlight : rowLama.warna_highlight || '';
      const catatanLama = payload.catatan !== undefined ? payload.catatan : rowLama.catatan || '';

      if (statusBayarLama === 'DP' && piutangIdLama) {
        const { count } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', wsId)
          .eq('piutang_id', piutangIdLama)
          .neq('id', payload.rowIdx);
        const sudahAdaCicilan = !!count && count > 0;

        if (statusBayarBaru === 'Lunas' && sudahAdaCicilan) {
          return {
            success: false,
            error: 'Error: Tidak bisa mengubah ke Lunas karena sudah ada riwayat pembayaran cicilan. Hapus dulu cicilannya di menu Hutang & Cicilan.',
          };
        }
        if (statusBayarBaru === 'DP') piutangId = piutangIdLama;
      }

      if (statusBayarBaru === 'DP' && !piutangId) piutangId = buatId('PTG');

      const { error } = await supabase
        .from('transactions')
        .update({
          tanggal: payload.tanggal,
          tipe: payload.tipe,
          kategori: payload.kategori,
          keterangan,
          nominal,
          rekening: payload.rekening || 'CASH',
          bukti: daftarBuktiUrl,
          piutang_id: statusBayarBaru === 'DP' ? piutangId : '',
          status_bayar: statusBayarBaru,
          total_tagihan: totalTagihanBaru,
          jam,
          warna_highlight: warnaHighlightLama,
          catatan: catatanLama,
          pihak_terkait: pihakTerkait,
          sub_kategori: subKategori,
        })
        .eq('id', payload.rowIdx)
        .eq('workspace_id', wsId);
      if (error) return { success: false, error: 'Error: ' + error.message };

      await recalculateBalance(supabase, wsId);
      return { success: true, message: 'Data berhasil diperbarui!' };
    } else {
      // ---- MODE TAMBAH BARU ----
      if (statusBayarBaru === 'DP') piutangId = buatId('PTG');

      const { error } = await supabase.from('transactions').insert({
        workspace_id: wsId,
        tanggal: payload.tanggal,
        tipe: payload.tipe,
        kategori: payload.kategori,
        keterangan,
        nominal,
        saldo: 0,
        rekening: payload.rekening || 'CASH',
        bukti: daftarBuktiUrl,
        piutang_id: statusBayarBaru === 'DP' ? piutangId : '',
        status_bayar: statusBayarBaru,
        total_tagihan: totalTagihanBaru,
        jam,
        warna_highlight: payload.warnaHighlight || '',
        catatan: payload.catatan || '',
        pihak_terkait: pihakTerkait,
        sub_kategori: subKategori,
      });
      if (error) return { success: false, error: 'Error: ' + error.message };

      await recalculateBalance(supabase, wsId);
      return { success: true, message: `Data berhasil disimpan di ${payload.workspace}` };
    }
  } catch (e) {
    return { success: false, error: 'Error: ' + String(e) };
  }
}

// Padanan simpanHighlightCatatan(obj)
export async function simpanHighlightCatatan(obj: SimpanHighlightCatatanPayload): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    if (!obj.workspace || !obj.rowIdx) return { success: false, error: 'Error: Data tidak lengkap.' };

    const wsId = await resolveWorkspaceId(supabase, user.id, obj.workspace);
    if (!wsId) return { success: false, error: 'Error: Data akun tidak ditemukan!' };

    const { error } = await supabase
      .from('transactions')
      .update({ warna_highlight: obj.warna || '', catatan: (obj.catatan || '').trim() })
      .eq('id', obj.rowIdx)
      .eq('workspace_id', wsId);
    if (error) return { success: false, error: 'Error: ' + error.message };

    return { success: true, message: 'Catatan & highlight berhasil disimpan!' };
  } catch (e) {
    return { success: false, error: 'Error: ' + String(e) };
  }
}

// Padanan hapusTransaksi(rowIdx, ws) — termasuk proteksi baris master DP/Pokok
// yang masih punya cicilan/pembayaran tertaut, dan best-effort hapus file bukti.
export async function hapusTransaksi(rowIdx: string, ws: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const wsId = await resolveWorkspaceId(supabase, user.id, ws);
    if (!wsId) return { success: false, error: 'Error: Data akun tidak ditemukan!' };

    const { data: row } = await supabase
      .from('transactions')
      .select('piutang_id, status_bayar, hutang_piutang_id, peranan_hp, bukti')
      .eq('id', rowIdx)
      .eq('workspace_id', wsId)
      .single();
    if (!row) return { success: false, error: 'Error: Transaksi tidak ditemukan.' };

    if (row.status_bayar === 'DP' && row.piutang_id) {
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', wsId)
        .eq('piutang_id', row.piutang_id)
        .neq('id', rowIdx);
      if (count && count > 0) {
        return {
          success: false,
          error: 'Error: Tidak bisa menghapus, transaksi ini masih memiliki riwayat pembayaran cicilan. Hapus cicilannya terlebih dahulu di menu Cicilan.',
        };
      }
    }

    if (row.peranan_hp === 'Pokok' && row.hutang_piutang_id) {
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', wsId)
        .eq('hutang_piutang_id', row.hutang_piutang_id)
        .neq('id', rowIdx);
      if (count && count > 0) {
        return {
          success: false,
          error: 'Error: Tidak bisa menghapus, item ini masih memiliki riwayat pembayaran. Hapus riwayat pembayarannya terlebih dahulu di menu Hutang & Piutang.',
        };
      }
    }

    // best-effort hapus file bukti — tidak menggagalkan proses jika error
    for (const url of row.bukti || []) {
      await hapusBuktiDariSupabaseStorage(url);
    }

    const { error } = await supabase.from('transactions').delete().eq('id', rowIdx).eq('workspace_id', wsId);
    if (error) return { success: false, error: 'Error: ' + error.message };

    await recalculateBalance(supabase, wsId);
    return { success: true, message: 'Data berhasil dihapus!' };
  } catch (e) {
    return { success: false, error: 'Error: ' + String(e) };
  }
}

// Padanan getRiwayatTransaksi(ws) — mengembalikan transaksi + anggaran + tabungan
// (gabungan target + riwayat isi) untuk workspace aktif.
export async function getRiwayatTransaksi(ws: string): Promise<RiwayatTransaksi> {
  const { supabase, user } = await requireUser();
  const wsId = await resolveWorkspaceId(supabase, user.id, ws);
  if (!wsId) return { transaksi: [], anggaran: [], tabungan: [] };

  const { data: transaksi } = await supabase
    .from('transactions')
    .select('*')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: true });

  const { data: anggaran } = await supabase
    .from('budgets')
    .select('*')
    .eq('workspace_id', wsId);

  const { data: targets } = await supabase
    .from('savings_targets')
    .select('*, savings_deposits(*)')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: true });

  const tabungan: TabunganGabungan[] = (targets || []).map((t) => ({
    id: t.id,
    jenis: 'Target',
    keterangan: t.keterangan,
    targetNominal: parseFloat(String(t.target_nominal)) || 0,
    tenggat: t.tenggat,
    deposits: ((t as unknown as { savings_deposits: unknown[] }).savings_deposits || []) as RiwayatTransaksi['tabungan'][number]['deposits'],
  }));

  return {
    transaksi: (transaksi || []) as Transaction[],
    anggaran: (anggaran || []) as Budget[],
    tabungan,
  };
}
