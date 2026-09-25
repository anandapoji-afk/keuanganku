'use server';

import { requireUser } from '@/lib/supabase/server';

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUKTI_BUCKET || 'bukti-transaksi';

// Padanan uploadBuktiKeDrive(base64Data, mimeType, namaFile, ws) + getOrBuatFolderBukti(ws)
// di Kode.gs. Dulu: file diupload ke folder Drive "KeuanganKu - Bukti Transaksi/<ws>"
// dan dibagikan via link publik ("ANYONE_WITH_LINK"). Di sini: diupload ke Supabase
// Storage pada path `<user_id>/<workspace>/<namaFile>`, bucket diset public (lihat
// supabase/schema.sql) supaya URL publiknya bisa langsung dipakai di laporan PDF/Excel
// sama seperti link Drive lama.
export async function uploadBuktiKeSupabaseStorage(
  base64Data: string,
  mimeType: string,
  namaFile: string,
  ws: string
): Promise<{ url: string } | { error: string }> {
  try {
    const { supabase, user } = await requireUser();

    const ext = mimeType && mimeType.includes('png') ? '.png' : '.jpg';

    // Nama file: buang ekstensi asli dulu (agar tidak jadi .png.png), lalu
    // sanitasi karakter yang tidak aman untuk key Supabase Storage.
    const namaTanpaExt = (namaFile || `bukti_${Date.now()}`).replace(/\.[a-zA-Z0-9]+$/, '');
    const safeNama = namaTanpaExt.replace(/[^a-zA-Z0-9._-]/g, '_') || `bukti_${Date.now()}`;

    // PENTING: object key Supabase Storage adalah path literal, BUKAN URI —
    // jangan encodeURIComponent di sini (karakter "%" tidak valid sebagai key).
    // Cukup ganti karakter yang tidak aman (spasi, dll) dengan "_".
    const safeWs = (ws || 'default').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${user.id}/${safeWs}/${Date.now()}_${safeNama}${ext}`;

    const bytes = Buffer.from(base64Data, 'base64');

    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: mimeType || 'image/jpeg',
      upsert: false,
    });
    if (error) return { error: error.message };

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: pub.publicUrl };
  } catch (e) {
    return { error: String(e) };
  }
}

// Padanan bagian "hapus file bukti di Drive (best-effort)" di hapusTransaksi.
export async function hapusBuktiDariSupabaseStorage(url: string): Promise<void> {
  try {
    const { supabase } = await requireUser();
    // path publik Supabase Storage: .../storage/v1/object/public/<bucket>/<path>
    const marker = `/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const path = decodeURIComponent(url.slice(idx + marker.length));
      await supabase.storage.from(BUCKET).remove([path]);
    } else {
      await supabase.storage.from(BUCKET).remove([url]);
    }
  } catch {
    // best-effort, sama seperti try/catch kosong di GAS lama
  }
}
