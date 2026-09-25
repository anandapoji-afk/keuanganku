'use client';

import { useState } from 'react';
import { useAppData } from '@/components/layout/AppDataProvider';
import Modal from '@/components/ui/Modal';
import { rp, formatTanggalIndo } from '@/lib/utils';
import { simpanTabunganBaru, simpanIsiTabungan, hapusItemTabungan } from '@/lib/actions/tabungan';

export default function TabunganPage() {
  const { loading, init, tabungan, refetchRiwayat } = useAppData();
  const [modalBaru, setModalBaru] = useState(false);
  const [formBaru, setFormBaru] = useState({ keterangan: '', nominal: '', tenggat: '' });
  const [modalIsi, setModalIsi] = useState<string | null>(null);
  const [formIsi, setFormIsi] = useState({ tanggal: new Date().toISOString().slice(0, 10), nominal: '', rekening: '', keterangan: '' });
  const [busy, setBusy] = useState(false);

  async function submitBaru() {
    setBusy(true);
    const res = await simpanTabunganBaru({ workspace: init.active, keterangan: formBaru.keterangan, nominal: parseFloat(formBaru.nominal) || 0, tenggat: formBaru.tenggat });
    setBusy(false);
    if (!res.success) return alert(res.error);
    setModalBaru(false);
    setFormBaru({ keterangan: '', nominal: '', tenggat: '' });
    await refetchRiwayat();
  }

  async function submitIsi() {
    if (!modalIsi) return;
    setBusy(true);
    const res = await simpanIsiTabungan({
      workspace: init.active,
      tbgId: modalIsi,
      tanggal: formIsi.tanggal,
      nominal: parseFloat(formIsi.nominal) || 0,
      rekening: formIsi.rekening || init.rekenings[0],
      keterangan: formIsi.keterangan,
    });
    setBusy(false);
    if (!res.success) return alert(res.error);
    setModalIsi(null);
    await refetchRiwayat();
  }

  async function hapusTarget(id: string) {
    if (!confirm('Hapus target tabungan ini?')) return;
    const res = await hapusItemTabungan({ workspace: init.active, id, jenis: 'Target' });
    if (!res.success) return alert(res.error);
    await refetchRiwayat();
  }

  async function hapusIsi(depositId: string) {
    if (!confirm('Hapus riwayat isi ini? Saldo rekening akan disesuaikan kembali.')) return;
    const res = await hapusItemTabungan({ workspace: init.active, id: depositId, jenis: 'Isi' });
    if (!res.success) return alert(res.error);
    await refetchRiwayat();
  }

  if (loading) return <div className="text-sm text-slate-400 py-10 text-center">Memuat data...</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setModalBaru(true)} className="text-xs bg-sky-600 text-white px-3.5 py-2 rounded-lg font-semibold">
          + Target Tabungan
        </button>
      </div>

      <div className="space-y-3">
        {tabungan.map((t) => {
          const terkumpul = t.deposits.reduce((a, d) => a + d.nominal, 0);
          const persen = t.targetNominal > 0 ? Math.min((terkumpul / t.targetNominal) * 100, 100) : 0;
          return (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-3.5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-sm text-slate-700">{t.keterangan}</div>
                  {t.tenggat && <div className="text-[11px] text-slate-400">Target: {formatTanggalIndo(t.tenggat)}</div>}
                </div>
                <button onClick={() => hapusTarget(t.id)} className="text-[10px] text-slate-300 hover:text-red-500">
                  Hapus
                </button>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                {rp(terkumpul)} / {rp(t.targetNominal)}
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${persen}%` }} />
              </div>

              {t.deposits.length > 0 && (
                <div className="mt-2 space-y-1">
                  {t.deposits.map((d) => (
                    <div key={d.id} className="flex justify-between items-center text-[11px] text-slate-500">
                      <span>
                        {formatTanggalIndo(d.tanggal)} {'\u00b7'} {d.rekening}
                      </span>
                      <div className="flex items-center gap-2">
                        <span>{rp(d.nominal)}</span>
                        <button onClick={() => hapusIsi(d.id)} className="text-slate-300 hover:text-red-500">
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setModalIsi(t.id);
                  setFormIsi({ tanggal: new Date().toISOString().slice(0, 10), nominal: '', rekening: init.rekenings[0], keterangan: '' });
                }}
                className="mt-2.5 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold"
              >
                Nabung
              </button>
            </div>
          );
        })}
        {tabungan.length === 0 && <div className="text-center text-xs text-slate-400 py-8">Belum ada target tabungan.</div>}
      </div>

      <Modal open={modalBaru} onClose={() => setModalBaru(false)} title="Target Tabungan Baru">
        <div className="space-y-3">
          <LI label="Keterangan" value={formBaru.keterangan} onChange={(v) => setFormBaru((f) => ({ ...f, keterangan: v }))} />
          <LI label="Nominal Target" type="number" value={formBaru.nominal} onChange={(v) => setFormBaru((f) => ({ ...f, nominal: v }))} />
          <LI label="Tenggat (opsional)" type="date" value={formBaru.tenggat} onChange={(v) => setFormBaru((f) => ({ ...f, tenggat: v }))} />
          <button onClick={submitBaru} disabled={busy} className="w-full bg-sky-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
            {busy ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </Modal>

      <Modal open={!!modalIsi} onClose={() => setModalIsi(null)} title="Isi Tabungan">
        <div className="space-y-3">
          <LI label="Tanggal" type="date" value={formIsi.tanggal} onChange={(v) => setFormIsi((f) => ({ ...f, tanggal: v }))} />
          <LI label="Nominal" type="number" value={formIsi.nominal} onChange={(v) => setFormIsi((f) => ({ ...f, nominal: v }))} />
          <div>
            <label className="text-[11px] font-medium text-slate-500">Rekening Asal</label>
            <select value={formIsi.rekening} onChange={(e) => setFormIsi((f) => ({ ...f, rekening: e.target.value }))} className="inp4 mt-1">
              {init.rekenings.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <LI label="Keterangan (opsional)" value={formIsi.keterangan} onChange={(v) => setFormIsi((f) => ({ ...f, keterangan: v }))} />
          <button onClick={submitIsi} disabled={busy} className="w-full bg-emerald-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
            {busy ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </Modal>

      <style jsx global>{`
        .inp4 {
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

function LI({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-slate-500">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="inp4 mt-1" />
    </div>
  );
}