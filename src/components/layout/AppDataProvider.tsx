'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getInitWorkspaceData, ambilPreferensiUser, simpanPreferensiUser, setupDefaultWorkspaceJikaBelumAda } from '@/lib/actions/workspace';
import { getRiwayatTransaksi } from '@/lib/actions/transaksi';
import type { InitWorkspaceData, Transaction, Budget, TabunganGabungan, Tipe, WarnaHighlight } from '@/lib/types';

export type TransaksiFilterState = {
  search: string;
  warna: 'Semua' | WarnaHighlight;
  tipe: 'Semua' | Tipe;
  rekening: string;
  kategori: string;
  tanggal: string;
  bulan: string;
  tahun: string;
  startDate: string;
  endDate: string;
};

interface AppDataState {
  loading: boolean;
  init: InitWorkspaceData;
  transaksi: Transaction[];
  filteredTransaksi: Transaction[];
  anggaran: Budget[];
  tabungan: TabunganGabungan[];
  filter: TransaksiFilterState;
  setFilter: React.Dispatch<React.SetStateAction<TransaksiFilterState>>;
  clearFilter: () => void;
  refetchAll: () => Promise<void>;
  refetchRiwayat: () => Promise<void>;
  gantiWorkspace: (ws: string) => Promise<void>;
}

const kosong: InitWorkspaceData = { workspaces: [], rekenings: ['CASH'], active: '', katMasuk: {}, katKeluar: {} };
const FILTER_KOSONG: TransaksiFilterState = {
  search: '',
  warna: 'Semua',
  tipe: 'Semua',
  rekening: '',
  kategori: '',
  tanggal: '',
  bulan: '',
  tahun: '',
  startDate: '',
  endDate: '',
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function matchesDynamicFilter(row: Transaction, filter: TransaksiFilterState): boolean {
  const text = normalizeText(filter.search);
  if (text) {
    const haystack = [
      row.keterangan,
      row.kategori,
      row.sub_kategori,
      row.rekening,
      row.pihak_terkait,
      row.catatan,
    ]
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(text)) return false;
  }

  if (filter.tipe !== 'Semua' && row.tipe !== filter.tipe) return false;
  if (filter.warna !== 'Semua' && row.warna_highlight !== filter.warna) return false;
  if (filter.rekening && row.rekening !== filter.rekening) return false;
  if (filter.kategori && row.kategori !== filter.kategori) return false;
  if (filter.tanggal && row.tanggal !== filter.tanggal) return false;
  if (filter.bulan) {
    const [y, m] = filter.bulan.split('-');
    const tgl = new Date(`${row.tanggal}T00:00:00`);
    if (String(tgl.getFullYear()) !== y || String(tgl.getMonth() + 1).padStart(2, '0') !== m) return false;
  }
  if (filter.tahun) {
    const tgl = new Date(`${row.tanggal}T00:00:00`);
    if (String(tgl.getFullYear()) !== filter.tahun) return false;
  }
  if (filter.startDate && new Date(`${row.tanggal}T00:00:00`) < new Date(`${filter.startDate}T00:00:00`)) return false;
  if (filter.endDate && new Date(`${row.tanggal}T00:00:00`) > new Date(`${filter.endDate}T23:59:59`)) return false;

  return true;
}

const AppDataContext = createContext<AppDataState | null>(null);

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData harus dipakai di dalam <AppDataProvider>');
  return ctx;
}

export default function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [init, setInit] = useState<InitWorkspaceData>(kosong);
  const [transaksi, setTransaksi] = useState<Transaction[]>([]);
  const [anggaran, setAnggaran] = useState<Budget[]>([]);
  const [tabungan, setTabungan] = useState<TabunganGabungan[]>([]);
  const [filter, setFilter] = useState<TransaksiFilterState>(FILTER_KOSONG);

  const filteredTransaksi = useMemo(() => {
    return transaksi
      .filter((row) => matchesDynamicFilter(row, filter))
      .slice()
      .sort((a, b) => {
        const aTime = new Date(`${a.tanggal}T${a.jam || '00:00'}:00`).getTime();
        const bTime = new Date(`${b.tanggal}T${b.jam || '00:00'}:00`).getTime();
        if (bTime !== aTime) return bTime - aTime;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [filter, transaksi]);

  const clearFilter = useCallback(() => setFilter(FILTER_KOSONG), []);

  const refetchRiwayat = useCallback(async (ws?: string) => {
    const target = ws || init.active;
    if (!target) return;
    const r = await getRiwayatTransaksi(target);
    setTransaksi(r.transaksi);
    setAnggaran(r.anggaran);
    setTabungan(r.tabungan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init.active]);

  const refetchAll = useCallback(async () => {
    setLoading(true);
    await setupDefaultWorkspaceJikaBelumAda();
    const pref = await ambilPreferensiUser();
    const wsAktif = (pref?.workspace as string | undefined) || undefined;
    const data = await getInitWorkspaceData(wsAktif);
    setInit(data);
    if (data.active) {
      const r = await getRiwayatTransaksi(data.active);
      setTransaksi(r.transaksi);
      setAnggaran(r.anggaran);
      setTabungan(r.tabungan);
    }
    setLoading(false);
  }, []);

  const gantiWorkspace = useCallback(async (ws: string) => {
    setLoading(true);
    const data = await getInitWorkspaceData(ws);
    setInit(data);
    await simpanPreferensiUser({ workspace: ws });
    const r = await getRiwayatTransaksi(ws);
    setTransaksi(r.transaksi);
    setAnggaran(r.anggaran);
    setTabungan(r.tabungan);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppDataContext.Provider
      value={{ loading, init, transaksi, filteredTransaksi, anggaran, tabungan, filter, setFilter, clearFilter, refetchAll, refetchRiwayat: () => refetchRiwayat(), gantiWorkspace }}
    >
      {children}
    </AppDataContext.Provider>
  );
}
