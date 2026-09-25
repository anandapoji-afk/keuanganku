'use client';

import { useMemo, useState } from 'react';
import { useAppData } from '@/components/layout/AppDataProvider';
import Modal from '@/components/ui/Modal';
import { rp } from '@/lib/utils';
import { hitungDaftarHutangDariGrid, hitungDaftarHutangPiutangDariGrid } from '@/lib/report/hutang';
import { tambahPembayaranDP } from '@/lib/actions/dp';
import { simpanHutangPiutangBaru, tambahPembayaranHutangPiutang } from '@/lib/actions/hutangPiutang';
import type { HutangDPItem, HutangPiutangItem } from '@/lib/types';

export default function HutangPiutangPage() {
  const { loading, init, filteredTransaksi, setFilter, refetchRiwayat } = useAppData();
  const [tab, setTab] = useState<'dp' | 'hp'>('dp');

  const daftarDP = useMemo(() => hitungDaftarHutangDariGrid(filteredTransaksi), [filteredTransaksi]);
  const daftarHP = useMemo(() => hitungDaftarHutangPiutangDariGrid(filteredTransaksi), [filteredTransaksi]);

  const [bayarDP, setBayarDP] = useState<HutangDPItem | null>(null);
  const [bayarHP, setBayarHP] = useState<HutangPiutangItem | null>(null);
  const [formBayar, setFormBayar] = useState({ tanggal: new Date().toISOString().slice(0, 10), nominal: '', rekening: '', keterangan: '' });
  const [modalHPBaru, setModalHPBaru] = useState(false);
  const [formHPBaru, setFormHPBaru] = useState({ tipe: 'Piutang' as 'Hutang' | 'Piutang', pihak: '', tanggal: new Date().toISOString().slice(0, 10), rekening: '', nominal: '', keterangan: '', jatuhTempo: '' });
  const [busy, setBusy] = useState(false);

  async function submitBayarDP() {
    if (!bayarDP) return;
    setBusy(true);
    const res = await tambahPembayaranDP({
      workspace: init.active,
      piutangId: bayarDP.piutangId,
      tanggal: formBayar.tanggal,
      nominal: parseFloat(formBayar.nominal) || 0,
      rekening: formBayar.rekening || init.rekenings[0],
      keterangan: formBayar.keterangan,
    });
    setBusy(false);
    if (!res.success) return alert(res.error);
    setBayarDP(null);
    await refetchRiwayat();
  }

  async function submitBayarHP() {
    if (!bayarHP) return;
    setBusy(true);
    const res = await tambahPembayaranHutangPiutang({
      workspace: init.active,
      hpId: bayarHP.hpId,
      tanggal: formBayar.tanggal,
      nominal: parseFloat(formBayar.nominal) || 0,
      rekening: formBayar.rekening || init.rekenings[0],
      keterangan: formBayar.keterangan,
    });
    setBusy(false);
    if (!res.success) return alert(res.error);
    setBayarHP(null);
    await refetchRiwayat();
  }

  async function submitHPBaru() {
    setBusy(true);
    const res = await simpanHutangPiutangBaru({
      workspace: init.active,
      tipe: formHPBaru.tipe,
      pihakTerkait: formHPBaru.pihak,
      tanggal: formHPBaru.tanggal,
      rekening: formHPBaru.rekening || init.rekenings[0],
      nominal: parseFloat(formHPBaru.nominal) || 0,
      keterangan: formHPBaru.keterangan,
      jatuhTempo: formHPBaru.jatuhTempo,
    });
    setBusy(false);
    if (!res.success) return alert(res.error);
    setModalHPBaru(false);
    setFormHPBaru({ tipe: 'Piutang', pihak: '', tanggal: new Date().toISOString().slice(0, 10), rekening: '', nominal: '', keterangan: '', jatuhTempo: '' });
    await refetchRiwayat();
  }

  if (loading) return <div className="text-sm text-slate-400 py-10 text-center">Memuat data...</div>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setTab('dp')} className={`flex-1 text-xs py-2 rounded-lg border font-semibold ${tab === 'dp' ? 'bg-violet-50 border-violet-400 text-violet-700' : 'border-slate-200 text-slate-400'}`}>
          DP &amp; Cicilan
        </button>
        <button onClick={() => setTab('hp')} className={`flex-1 text-xs py-2 rounded-lg border font-semibold ${tab === 'hp' ? 'bg-teal-50 border-teal-400 text-teal-700' : 'border-slate-200 text-slate-400'}`}>
          Hutang &amp; Piutang
        </button>
      </div>

      {tab === 'dp' && (
        <>
          <p className="text-[11px] text-slate-400 px-1">
            Item DP/Cicilan dibuat lewat form Transaksi (centang &quot;Ini transaksi DP/Cicilan&quot;).
          </p>
          <div className="space-y-2">
            {daftarDP.map((h) => (
              <div key={h.piutangId} className="bg-white rounded-xl border border-slate-200 p-3.5">
                <button onClick={() => setFilter((prev) => ({ ...prev, search: h.keterangan, kategori: h.kategori, startDate: '', endDate: '', tanggal: '', bulan: '', tahun: '', tipe: 'Semua' }))} className="w-full text-left">
                  <div className="flex justify-between">
                    <span className="font-medium text-sm text-slate-700">{h.keterangan}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${h.status === 'Lunas' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{h.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">{h.tglTampil} {'\u00b7'} {h.tipe}</div>
                  <div className="flex justify-between text-xs mt-2">
                    <span className="text-slate-500">Tagihan: {rp(h.totalTagihan)}</span>
                    <span className="text-slate-500">Dibayar: {rp(h.totalDibayar)}</span>
                    <span className="font-semibold text-violet-600">Sisa: {rp(h.sisa)}</span>
                  </div>
                </button>

                {h.riwayat.length > 0 && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <div className="text-[10px] font-semibold uppercase text-slate-500 mb-1">Riwayat pembayaran</div>
                    <div className="space-y-1">
                      {h.riwayat.map((r, idx) => (
                        <div key={`${h.piutangId}-${idx}`} className="flex justify-between text-[11px] text-slate-600">
                          <span>{r.tglTampil}</span>
                          <span>{r.rekening}</span>
                          <span className="font-medium text-violet-600">{rp(r.nominal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {h.status !== 'Lunas' && (
                  <button
                    onClick={() => {
                      setBayarDP(h);
                      setFormBayar({ tanggal: new Date().toISOString().slice(0, 10), nominal: '', rekening: init.rekenings[0], keterangan: '' });
                    }}
                    className="mt-2 text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg font-semibold"
                  >
                    Bayar Cicilan
                  </button>
                )}
              </div>
            ))}
            {daftarDP.length === 0 && <div className="text-center text-xs text-slate-400 py-8">Belum ada data DP/Cicilan.</div>}
          </div>
        </>
      )}

      {tab === 'hp' && (
        <>
          <div className="flex justify-end">
            <button onClick={() => setModalHPBaru(true)} className="text-xs bg-teal-600 text-white px-3.5 py-2 rounded-lg font-semibold">
              + Catat Hutang/Piutang
            </button>
          </div>
          <div className="space-y-2">
            {daftarHP.map((h) => (
              <div key={h.hpId} className="bg-white rounded-xl border border-slate-200 p-3.5">
                <button onClick={() => setFilter((prev) => ({ ...prev, search: h.keterangan || h.pihak, kategori: h.tipe, startDate: '', endDate: '', tanggal: '', bulan: '', tahun: '', tipe: 'Semua' }))} className="w-full text-left">
                  <div className="flex justify-between">
                    <span className="font-medium text-sm text-slate-700">{h.pihak} {'\u00b7'} {h.tipe}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${h.status === 'Lunas' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{h.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {h.tglTampil}
                    {h.jatuhTempo ? ` \u00b7 Jatuh tempo ${h.jatuhTempo}` : ''}
                  </div>
                  <div className="flex justify-between text-xs mt-2">
                    <span className="text-slate-500">Pokok: {rp(h.nominalPokok)}</span>
                    <span className="text-slate-500">Dibayar: {rp(h.totalDibayar)}</span>
                    <span className="font-semibold text-teal-600">Sisa: {rp(h.sisa)}</span>
                  </div>
                </button>

                {h.riwayat.length > 0 && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <div className="text-[10px] font-semibold uppercase text-slate-500 mb-1">Riwayat pembayaran</div>
                    <div className="space-y-1">
                      {h.riwayat.map((r, idx) => (
                        <div key={`${h.hpId}-${idx}`} className="flex justify-between text-[11px] text-slate-600">
                          <span>{r.tglTampil}</span>
                          <span>{r.rekening}</span>
                          <span className="font-medium text-teal-600">{rp(r.nominal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {h.status !== 'Lunas' && (
                  <button
                    onClick={() => {
                      setBayarHP(h);
                      setFormBayar({ tanggal: new Date().toISOString().slice(0, 10), nominal: '', rekening: init.rekenings[0], keterangan: '' });
                    }}
                    className="mt-2 text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg font-semibold"
                  >
                    Catat Pembayaran
                  </button>
                )}
              </div>
            ))}
            {daftarHP.length === 0 && <div className="text-center text-xs text-slate-400 py-8">Belum ada data hutang/piutang.</div>}
          </div>
        </>
      )}

      <Modal open={!!bayarDP} onClose={() => setBayarDP(null)} title={`Bayar Cicilan \u2014 ${bayarDP?.keterangan || ''}`}>
        <FormBayar formBayar={formBayar} setFormBayar={setFormBayar} rekenings={init.rekenings} busy={busy} onSubmit={submitBayarDP} />
      </Modal>

      <Modal open={!!bayarHP} onClose={() => setBayarHP(null)} title={`Pembayaran \u2014 ${bayarHP?.pihak || ''}`}>
        <FormBayar formBayar={formBayar} setFormBayar={setFormBayar} rekenings={init.rekenings} busy={busy} onSubmit={submitBayarHP} />
      </Modal>

      <Modal open={modalHPBaru} onClose={() => setModalHPBaru(false)} title="Catat Hutang / Piutang Baru">
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['Piutang', 'Hutang'] as const).map((tp) => (
              <button
                key={tp}
                onClick={() => setFormHPBaru((f) => ({ ...f, tipe: tp }))}
                className={`flex-1 text-xs py-2 rounded-lg border font-semibold ${formHPBaru.tipe === tp ? 'bg-teal-50 border-teal-400 text-teal-700' : 'border-slate-200 text-slate-400'}`}
              >
                {tp === 'Piutang' ? 'Piutang (saya meminjamkan)' : 'Hutang (saya meminjam)'}
              </button>
            ))}
          </div>
          <LabeledInput label="Pihak Terkait" value={formHPBaru.pihak} onChange={(v) => setFormHPBaru((f) => ({ ...f, pihak: v }))} />
          <div className="grid grid-cols-2 gap-2">
            <LabeledInput label="Tanggal" type="date" value={formHPBaru.tanggal} onChange={(v) => setFormHPBaru((f) => ({ ...f, tanggal: v }))} />
            <LabeledInput label="Jatuh Tempo (opsional)" type="date" value={formHPBaru.jatuhTempo} onChange={(v) => setFormHPBaru((f) => ({ ...f, jatuhTempo: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <LabeledInput label="Nominal" type="number" value={formHPBaru.nominal} onChange={(v) => setFormHPBaru((f) => ({ ...f, nominal: v }))} />
            <div>
              <label className="text-[11px] font-medium text-slate-500">Rekening</label>
              <select value={formHPBaru.rekening} onChange={(e) => setFormHPBaru((f) => ({ ...f, rekening: e.target.value }))} className="inp3 mt-1">
                {init.rekenings.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <LabeledInput label="Keterangan (opsional)" value={formHPBaru.keterangan} onChange={(v) => setFormHPBaru((f) => ({ ...f, keterangan: v }))} />
          <button onClick={submitHPBaru} disabled={busy} className="w-full bg-teal-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
            {busy ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </Modal>

      <style jsx global>{`
        .inp3 {
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

function FormBayar({
  formBayar,
  setFormBayar,
  rekenings,
  busy,
  onSubmit,
}: {
  formBayar: { tanggal: string; nominal: string; rekening: string; keterangan: string };
  setFormBayar: React.Dispatch<React.SetStateAction<{ tanggal: string; nominal: string; rekening: string; keterangan: string }>>;
  rekenings: string[];
  busy: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3">
      <LabeledInput label="Tanggal" type="date" value={formBayar.tanggal} onChange={(v) => setFormBayar((f) => ({ ...f, tanggal: v }))} />
      <LabeledInput label="Nominal" type="number" value={formBayar.nominal} onChange={(v) => setFormBayar((f) => ({ ...f, nominal: v }))} />
      <div>
        <label className="text-[11px] font-medium text-slate-500">Rekening</label>
        <select value={formBayar.rekening} onChange={(e) => setFormBayar((f) => ({ ...f, rekening: e.target.value }))} className="inp3 mt-1">
          {rekenings.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <LabeledInput label="Keterangan (opsional)" value={formBayar.keterangan} onChange={(v) => setFormBayar((f) => ({ ...f, keterangan: v }))} />
      <button onClick={onSubmit} disabled={busy} className="w-full bg-sky-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
        {busy ? 'Menyimpan...' : 'Simpan Pembayaran'}
      </button>
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-slate-500">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="inp3 mt-1" />
    </div>
  );
}