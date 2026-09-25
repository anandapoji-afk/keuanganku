'use client';

import { useMemo, useState } from 'react';
import { useAppData } from '@/components/layout/AppDataProvider';
import Modal from '@/components/ui/Modal';
import { rp } from '@/lib/utils';
import { transferSaldo, editTransferSaldo, hapusTransferSaldo } from '@/lib/actions/transfer';

// Catatan migrasi: di Kode.gs lama TIDAK ada fungsi tambahRekening/hapusRekening
// yang dipanggil dari Index.html — rekening baru hanya muncul otomatis lewat
// preset saat workspace dibuat (tambahAkunWorkspace/setupMasterWorkspace) atau
// otomatis oleh pastikanRekeningAda('TABUNGAN') saat fitur Isi Tabungan dipakai.
// Jadi daftar rekening di halaman ini murni tampilan saldo (read-only), SAMA
// seperti perilaku aplikasi lama. Kalau Anda ingin fitur tambah/hapus rekening
// manual, itu fitur BARU yang perlu ditambahkan menyusul (server action + tabel
// `accounts` sudah siap dipakai). Transfer Saldo antar rekening (transferSaldo)
// SUDAH ada di app lama, dipasang di sini.
export default function RekeningPage() {
  const { loading, init, transaksi, refetchRiwayat } = useAppData();
  const [modalTransfer, setModalTransfer] = useState(false);
  const [modalEditTransfer, setModalEditTransfer] = useState(false);
  const [form, setForm] = useState({ tanggal: new Date().toISOString().slice(0, 10), dari: '', ke: '', nominal: '', keterangan: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const saldoPerRekening = useMemo(() => {
    const map: Record<string, number> = {};
    init.rekenings.forEach((r) => (map[r] = 0));
    transaksi.forEach((t) => {
      if (t.tipe === 'Pemasukan' && t.rekening === 'TABUNGAN') return;
      if (!(t.rekening in map)) map[t.rekening] = 0;
      map[t.rekening] += t.tipe === 'Pemasukan' ? t.nominal : -t.nominal;
    });
    return map;
  }, [init.rekenings, transaksi]);

  const riwayatTransfer = useMemo(() => {
    return transaksi
      .filter((t) => t.kategori === 'Transfer')
      .slice()
      .sort((a, b) => {
        const aTime = new Date(`${a.tanggal}T${a.jam || '00:00'}:00`).getTime();
        const bTime = new Date(`${b.tanggal}T${b.jam || '00:00'}:00`).getTime();
        return bTime - aTime;
      });
  }, [transaksi]);

  function bukaTransfer() {
    setForm({ tanggal: new Date().toISOString().slice(0, 10), dari: init.rekenings[0] || '', ke: init.rekenings[1] || init.rekenings[0] || '', nominal: '', keterangan: '' });
    setErrMsg(null);
    setModalTransfer(true);
  }

  async function submitTransfer() {
    setBusy(true);
    setErrMsg(null);
    const res = await transferSaldo({
      workspace: init.active,
      tanggal: form.tanggal,
      dari: form.dari,
      ke: form.ke,
      nominal: parseFloat(form.nominal) || 0,
      keterangan: form.keterangan,
    });
    setBusy(false);
    if (!res.success) {
      setErrMsg(res.error);
      return;
    }
    setModalTransfer(false);
    await refetchRiwayat();
  }

  async function submitEditTransfer() {
    if (!editId) return;
    setBusy(true);
    setErrMsg(null);
    const res = await editTransferSaldo({
      workspace: init.active,
      id: editId,
      tanggal: form.tanggal,
      dari: form.dari,
      ke: form.ke,
      nominal: parseFloat(form.nominal) || 0,
      keterangan: form.keterangan,
    });
    setBusy(false);
    if (!res.success) {
      setErrMsg(res.error);
      return;
    }
    setModalEditTransfer(false);
    setEditId(null);
    await refetchRiwayat();
  }

  async function hapusTransfer(id: string) {
    if (!confirm('Hapus riwayat transfer ini?')) return;
    const res = await hapusTransferSaldo({ workspace: init.active, id });
    if (!res.success) {
      alert(res.error);
      return;
    }
    await refetchRiwayat();
  }

  if (loading) return <div className="text-sm text-slate-400 py-10 text-center">Memuat data...</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={bukaTransfer} className="text-xs bg-sky-600 text-white px-3.5 py-2 rounded-lg font-semibold">
          Transfer Saldo
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {Object.entries(saldoPerRekening).map(([rek, saldo]) => (
          <div key={rek} className="px-4 py-3.5 flex justify-between items-center">
            <div>
              <div className="font-medium text-sm text-slate-700">{rek}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {transaksi.filter((t) => t.rekening === rek).length} transaksi
              </div>
            </div>
            <div className="font-bold text-slate-800">{rp(saldo)}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        <div className="px-4 py-2.5 text-xs font-semibold text-slate-500">Riwayat Transfer</div>
        {riwayatTransfer.length === 0 && <div className="px-4 py-6 text-center text-xs text-slate-400">Belum ada riwayat transfer.</div>}
        {riwayatTransfer.map((t) => (
          <div key={t.id} className="px-4 py-3">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-700">{t.keterangan}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {t.tanggal} {'\u00b7'} {t.rekening} {'\u00b7'} {t.tipe}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold text-sm text-slate-800">{rp(t.nominal)}</div>
                <div className="flex gap-1 mt-1">
                  <button onClick={() => {
                    setEditId(t.id);
                    setForm({
                      tanggal: t.tanggal,
                      dari: t.tipe === 'Pengeluaran' ? t.rekening : init.rekenings[0] || '',
                      ke: t.tipe === 'Pemasukan' ? t.rekening : init.rekenings[1] || init.rekenings[0] || '',
                      nominal: String(t.nominal),
                      keterangan: t.keterangan,
                    });
                    setModalEditTransfer(true);
                  }} className="text-[10px] text-sky-600">Edit</button>
                  <button onClick={() => hapusTransfer(t.id)} className="text-[10px] text-red-500">Hapus</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalTransfer} onClose={() => setModalTransfer(false)} title="Transfer Saldo Antar Rekening">
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-slate-500">Tanggal</label>
            <input type="date" value={form.tanggal} onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))} className="inp6 mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-slate-500">Dari Rekening</label>
              <select value={form.dari} onChange={(e) => setForm((f) => ({ ...f, dari: e.target.value }))} className="inp6 mt-1">
                {init.rekenings.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500">Ke Rekening</label>
              <select value={form.ke} onChange={(e) => setForm((f) => ({ ...f, ke: e.target.value }))} className="inp6 mt-1">
                {init.rekenings.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Nominal</label>
            <input type="number" value={form.nominal} onChange={(e) => setForm((f) => ({ ...f, nominal: e.target.value }))} className="inp6 mt-1" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Keterangan (opsional)</label>
            <input value={form.keterangan} onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))} className="inp6 mt-1" />
          </div>
          {errMsg && <div className="text-xs text-red-600">{errMsg}</div>}
          <button onClick={submitTransfer} disabled={busy} className="w-full bg-sky-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
            {busy ? 'Menyimpan...' : 'Transfer'}
          </button>
        </div>
      </Modal>

      <Modal open={modalEditTransfer} onClose={() => { setModalEditTransfer(false); setEditId(null); }} title="Edit Transfer">
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-slate-500">Tanggal</label>
            <input type="date" value={form.tanggal} onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))} className="inp6 mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-slate-500">Dari Rekening</label>
              <select value={form.dari} onChange={(e) => setForm((f) => ({ ...f, dari: e.target.value }))} className="inp6 mt-1">
                {init.rekenings.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500">Ke Rekening</label>
              <select value={form.ke} onChange={(e) => setForm((f) => ({ ...f, ke: e.target.value }))} className="inp6 mt-1">
                {init.rekenings.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Nominal</label>
            <input type="number" value={form.nominal} onChange={(e) => setForm((f) => ({ ...f, nominal: e.target.value }))} className="inp6 mt-1" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Keterangan (opsional)</label>
            <input value={form.keterangan} onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))} className="inp6 mt-1" />
          </div>
          {errMsg && <div className="text-xs text-red-600">{errMsg}</div>}
          <button onClick={submitEditTransfer} disabled={busy} className="w-full bg-sky-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
            {busy ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </Modal>

      <style jsx global>{`
        .inp6 {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

