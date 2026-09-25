'use client';

import { useState } from 'react';
import { useAppData } from '@/components/layout/AppDataProvider';
import { generateLaporanExcelRingkas } from '@/lib/actions/laporanRingkas';
import { generateLaporanExcelDetail } from '@/lib/actions/laporanDetail';
import type { LaporanResult } from '@/lib/actions/laporanRingkas';

function unduhBase64(res: LaporanResult) {
  if ('error' in res) {
    alert('Gagal membuat laporan: ' + res.error);
    return;
  }
  const byteChars = atob(res.data);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: res.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = res.filename;
  a.click();
  URL.revokeObjectURL(url);
}

function awalBulanIni() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function LaporanPage() {
  const { loading, init } = useAppData();
  const [start, setStart] = useState(awalBulanIni());
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [jenis, setJenis] = useState<'ringkas' | 'detail'>('detail');
  const [sertakanBukti, setSertakanBukti] = useState(false);
  const [busy, setBusy] = useState<'' | 'ringkas' | 'detail'>('');

  function bukaCetakPDF() {
    const params = new URLSearchParams({ ws: init.active, start, end, jenis, bukti: sertakanBukti ? '1' : '0' });
    window.open(`/reports/print?${params.toString()}`, '_blank');
  }

  async function unduhExcelRingkas() {
    setBusy('ringkas');
    const res = await generateLaporanExcelRingkas(init.active, start, end);
    setBusy('');
    unduhBase64(res);
  }

  async function unduhExcelDetail() {
    setBusy('detail');
    const res = await generateLaporanExcelDetail(init.active, start, end);
    setBusy('');
    unduhBase64(res);
  }

  if (loading) return <div className="text-sm text-slate-400 py-10 text-center">Memuat data...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-medium text-slate-500">Dari Tanggal</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="inp5 mt-1" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Sampai Tanggal</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="inp5 mt-1" />
          </div>
        </div>

        <div className="flex gap-2">
          {(['detail', 'ringkas'] as const).map((j) => (
            <button
              key={j}
              onClick={() => setJenis(j)}
              className={`flex-1 text-xs py-2 rounded-lg border font-semibold capitalize ${
                jenis === j ? 'bg-sky-50 border-sky-400 text-sky-700' : 'border-slate-200 text-slate-400'
              }`}
            >
              {j}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={sertakanBukti} onChange={(e) => setSertakanBukti(e.target.checked)} disabled={jenis !== 'detail'} />
          Sertakan lampiran bukti transaksi (khusus laporan PDF Detail)
        </label>
      </div>

      <div className="space-y-2">
        <button onClick={bukaCetakPDF} className="w-full bg-sky-600 text-white text-sm font-semibold py-2.5 rounded-lg">
          Lihat / Cetak Laporan PDF
        </button>
        <button onClick={unduhExcelRingkas} disabled={busy === 'ringkas'} className="w-full bg-white border border-slate-300 text-slate-700 text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
          {busy === 'ringkas' ? 'Membuat file...' : 'Unduh Excel Ringkas'}
        </button>
        <button onClick={unduhExcelDetail} disabled={busy === 'detail'} className="w-full bg-white border border-slate-300 text-slate-700 text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
          {busy === 'detail' ? 'Membuat file...' : 'Unduh Excel Detail'}
        </button>
      </div>

      <style jsx global>{`
        .inp5 {
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
