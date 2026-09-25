import { ambilDataLaporanPrint } from '@/lib/actions/laporanPrint';
import { rp, pct, warnaHighlightHex } from '@/lib/utils';
import TombolCetak from './TombolCetak';
import type { GrupKategori } from '@/lib/report/kelompokkan';
import type { JenisLaporan } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: {
    ws?: string;
    start?: string;
    end?: string;
    jenis?: string;
    bukti?: string;
  };
}

const MAKS_BUKTI_PER_HALAMAN = 2;

export default async function HalamanCetakLaporan({ searchParams }: Props) {
  const ws = searchParams.ws || '';
  const start = searchParams.start || '';
  const end = searchParams.end || '';
  const jenis: JenisLaporan = searchParams.jenis === 'ringkas' ? 'ringkas' : 'detail';
  const sertakanBukti = searchParams.bukti === '1';

  const data = await ambilDataLaporanPrint(ws, start, end, jenis, sertakanBukti);

  if (data.error) {
    return <div className="p-8 text-red-600">Gagal memuat laporan: {data.error}</div>;
  }

  const halamanLampiran: (typeof data.lampiranBukti)[] = [];
  for (let i = 0; i < data.lampiranBukti.length; i += MAKS_BUKTI_PER_HALAMAN) {
    halamanLampiran.push(data.lampiranBukti.slice(i, i + MAKS_BUKTI_PER_HALAMAN));
  }

  function RenderGrup({ grup, warna }: { grup: GrupKategori[]; warna: 'in' | 'out' }) {
    const bgHeader = warna === 'in' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-red-50 border-red-500 text-red-700';
    if (grup.length === 0) {
      return <div className="py-2 text-sm text-slate-400 italic">Tidak ada data.</div>;
    }
    return (
      <>
        {grup.map((g) => (
          <div key={g.kategori} className="mb-3 avoid-break">
            <div className={`flex justify-between items-center px-3 py-1.5 rounded border-l-4 font-semibold text-sm ${bgHeader}`}>
              <span>{g.kategori}</span>
              <span>{rp(g.subtotal)}</span>
            </div>

            {jenis === 'detail' ? (
              <table className="data w-full text-xs mt-1">
                <thead>
                  <tr className="thead-mini">
                    <td className="sub w-[14%]">Tanggal</td>
                    <td className="sub">Keterangan</td>
                    <td className="sub w-[16%]">Rekening</td>
                    <td className="sub num w-[16%]">Nominal</td>
                  </tr>
                </thead>
                <tbody>
                  {g.transaksi.map((t, idx) => {
                    const hex = t.warna ? warnaHighlightHex(t.warna) : '';
                    return (
                      <tr key={idx} className="data-row avoid-break" style={hex ? { background: hex } : undefined}>
                        <td className="sub align-top">{t.tglTampil}</td>
                        <td className="sub align-top">
                          {t.keterangan}
                          {t.subKategori ? <span className="ml-1 text-[10px] text-slate-400">» {t.subKategori}</span> : null}
                          {t.pihakTerkait ? (
                            <span className="ml-1 text-[10px] font-semibold text-sky-600">
                              ({t.tipe === 'Pemasukan' ? 'Dari' : 'Ke'}: {t.pihakTerkait})
                            </span>
                          ) : null}
                        </td>
                        <td className="sub align-top">
                          <span className="chip">{t.rekening}</span>
                        </td>
                        <td className={`sub num align-top ${warna === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>{rp(t.nominal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : g.subBreakdown.length > 0 ? (
              <div className="pl-3 mt-1 text-[11px] text-slate-500 space-y-0.5">
                {g.subBreakdown.map((sb) => (
                  <div key={sb.nama} className="flex justify-between">
                    <span>» {sb.nama}</span>
                    <span>
                      {rp(sb.nominal)} ({pct(sb.nominal, g.subtotal)})
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="report-root bg-slate-100 min-h-screen py-6 print:bg-white print:py-0">
      <TombolCetak />
      <style>{`
        @page { size: A4; margin: 14mm 12mm; }
        .report-page { width: 210mm; min-height: 297mm; margin: 0 auto 12px; background: #fff; padding: 14mm 12mm; box-shadow: 0 0 8px rgba(0,0,0,.08); }
        @media print {
          .no-print { display: none !important; }
          .report-page { box-shadow: none; margin: 0; width: auto; min-height: 0; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
          .page-break-before { break-before: page; page-break-before: always; }
          .page-break-after { break-after: page; page-break-after: always; }
        }
        .sect-title { border-left: 4px solid #0ea5e9; padding-left: 8px; font-weight: 700; font-size: 13px; margin: 18px 0 8px; }
        table.data { border-collapse: collapse; }
        table.data td.sub { border-bottom: 1px solid #e2e8f0; padding: 5px 6px; font-size: 10.5px; }
        table.data td.num { text-align: right; font-variant-numeric: tabular-nums; }
        tr.thead-mini td { font-size: 9px; text-transform: uppercase; color: #94a3b8; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding: 4px 6px; }
        .chip { display: inline-block; background: #f1f5f9; border-radius: 999px; padding: 1px 8px; font-size: 9.5px; color: #475569; }
        .saldo-box { display: flex; justify-content: space-between; align-items: center; background: #0ea5e9; color: #fff; padding: 10px 14px; border-radius: 8px; font-weight: 700; margin-top: 14px; }
        .lampiran-item { margin-bottom: 14px; page-break-inside: avoid; min-height: 360px; }
      `}</style>

      <div className="report-page">
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3 mb-4">
          <div>
            <div className="text-lg font-bold">LAPORAN KEUANGAN{jenis === 'detail' ? ' DETAIL TRANSAKSI' : ''}</div>
            <div className="text-xs text-slate-500 mt-1">Akun: {data.ws}</div>
            <div className="text-xs text-slate-500">Periode: {data.teksPeriode}</div>
          </div>
          <div className="text-right text-[10px] text-slate-400">KeuanganKu</div>
        </div>

        <div className="sect-title" style={{ borderLeftColor: '#10b981' }}>Pemasukan</div>
        <RenderGrup grup={data.pemasukan.grup} warna="in" />
        <div className="flex justify-between font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded mt-2 text-sm">
          <span>TOTAL PEMASUKAN</span>
          <span>{rp(data.pemasukan.total)}</span>
        </div>

        <div className="sect-title" style={{ borderLeftColor: '#ef4444' }}>Pengeluaran</div>
        <RenderGrup grup={data.pengeluaran.grup} warna="out" />
        <div className="flex justify-between font-bold text-red-700 bg-red-50 px-3 py-2 rounded mt-2 text-sm">
          <span>TOTAL PENGELUARAN</span>
          <span>{rp(data.pengeluaran.total)}</span>
        </div>

        {data.hutangList.length > 0 && (
          <>
            <div className="sect-title" style={{ borderLeftColor: '#7c3aed' }}>Hutang &amp; DP (Cicilan)</div>
            {data.hutangList.map((h) => (
              <div key={h.piutangId} className="avoid-break mb-2 text-xs border border-violet-200 rounded p-2">
                <div className="flex justify-between font-semibold text-violet-700">
                  <span>{h.keterangan} ({h.tipe})</span>
                  <span>{h.status}</span>
                </div>
                <div className="flex justify-between text-slate-500 mt-0.5">
                  <span>Total Tagihan: {rp(h.totalTagihan)}</span>
                  <span>Sisa: {rp(h.sisa)}</span>
                </div>
              </div>
            ))}
          </>
        )}

        {data.hpList.length > 0 && (
          <>
            <div className="sect-title" style={{ borderLeftColor: '#0d9488' }}>Hutang &amp; Piutang (Pinjam-Meminjam)</div>
            {data.hpList.map((h) => (
              <div key={h.hpId} className="avoid-break mb-2 text-xs border border-teal-200 rounded p-2">
                <div className="flex justify-between font-semibold text-teal-700">
                  <span>{h.pihak} ({h.tipe})</span>
                  <span>{h.status}</span>
                </div>
                <div className="flex justify-between text-slate-500 mt-0.5">
                  <span>Nominal: {rp(h.nominalPokok)}{h.jatuhTempo ? ` \u00b7 Jatuh Tempo: ${h.jatuhTempo}` : ''}</span>
                  <span>Sisa: {rp(h.sisa)}</span>
                </div>
              </div>
            ))}
          </>
        )}

        <div className="saldo-box">
          <span>Saldo Bersih Periode Ini</span>
          <span>{rp(data.saldoBersih)}</span>
        </div>

        <div className="flex justify-between text-[9px] text-slate-400 border-t border-slate-200 mt-4 pt-2">
          <span>Dicetak otomatis oleh KeuanganKu</span>
          <span>Dibuat {data.dicetakPada}</span>
        </div>
      </div>

      {/* ===== Lampiran Bukti Transaksi — halaman terpisah, maks 2 transaksi/halaman ===== */}
      {halamanLampiran.length > 0 &&
        halamanLampiran.map((grup, pageIdx) => (
          <div key={pageIdx} className={`report-page page-break-before ${pageIdx < halamanLampiran.length - 1 ? 'page-break-after' : ''}`}>
            {pageIdx === 0 && <div className="sect-title" style={{ borderLeftColor: '#0ea5e9' }}>Lampiran Bukti Transaksi</div>}
            {grup.map((item, i) => (
              <div key={i} className="lampiran-item">
                <table className="data w-full text-xs mb-1">
                  <thead>
                    <tr className="thead-mini">
                      <td className="sub w-[14%]">Tanggal</td>
                      <td className="sub">Keterangan</td>
                      <td className="sub w-[16%]">Rekening</td>
                      <td className="sub num w-[16%]">Nominal</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="data-row">
                      <td className="sub align-top">{item.tglTampil}</td>
                      <td className="sub align-top">{item.keterangan}</td>
                      <td className="sub align-top"><span className="chip">{item.rekening}</span></td>
                      <td className={`sub num align-top ${item.tipe === 'Pemasukan' ? 'text-emerald-600' : 'text-red-600'}`}>{rp(item.nominal)}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex flex-wrap gap-2 justify-center bg-slate-50 border border-dashed border-slate-300 rounded p-2">
                  {item.bukti.filter(Boolean).map((url, bi) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={bi}
                      src={url}
                      alt={`Bukti ${item.keterangan}`}
                      className="rounded border border-slate-300 object-contain bg-white"
                      style={{ maxHeight: item.bukti.length > 1 ? 320 : 340, maxWidth: item.bukti.length > 1 ? '47%' : '96%' }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
