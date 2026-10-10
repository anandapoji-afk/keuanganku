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
  if (filter.search) {
    const raw = filter.search.toLowerCase();
    const cleaned = raw.replace(/»/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned) {
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

      const tokens = cleaned.split(' ').filter(Boolean);
      const allTokensMatch = tokens.every((token) => haystack.includes(token));
      if (!haystack.includes(cleaned) && !allTokensMatch) return false;
    }
  }

  if (filter.tipe !== 'Semua' && row.tipe !== filter.tipe) return false;
  if (filter.warna !== 'Semua' && row.warna_highlight !== filter.warna) return false;
  if (filter.rekening && row.rekening !== filter.rekening) return false;
  if (filter.kategori && row.kategori !== filter.kategori) return false;

  const rowEndDate = row.sampai_tanggal || row.tanggal;

  if (filter.tanggal) {
    if (row.sampai_tanggal) {
      if (filter.tanggal < row.tanggal || filter.tanggal > row.sampai_tanggal) return false;
    } else {
      if (row.tanggal !== filter.tanggal) return false;
    }
  }

  if (filter.bulan) {
    const [y, m] = filter.bulan.split('-');
    const tglStart = new Date(`${row.tanggal}T00:00:00`);
    const tglEnd = new Date(`${rowEndDate}T00:00:00`);
    const startMatch = String(tglStart.getFullYear()) === y && String(tglStart.getMonth() + 1).padStart(2, '0') === m;
    const endMatch = String(tglEnd.getFullYear()) === y && String(tglEnd.getMonth() + 1).padStart(2, '0') === m;
    if (!startMatch && !endMatch) return false;
  }

  if (filter.tahun) {
    const tglStart = new Date(`${row.tanggal}T00:00:00`);
    const tglEnd = new Date(`${rowEndDate}T00:00:00`);
    if (String(tglStart.getFullYear()) !== filter.tahun && String(tglEnd.getFullYear()) !== filter.tahun) return false;
  }

  if (filter.startDate && new Date(`${rowEndDate}T00:00:00`) < new Date(`${filter.startDate}T00:00:00`)) return false;
  if (filter.endDate && new Date(`${row.tanggal}T00:00:00`) > new Date(`${filter.endDate}T23:59:59`)) return false;

  return true;
}

function bandingkanTransaksiBaruKeLama(a: Transaction, b: Transaction): number {
  const tglA = a.tanggal || '';
  const tglB = b.tanggal || '';
  if (tglB !== tglA) return tglB.localeCompare(tglA);
  const jamA = a.jam || '00:00';
  const jamB = b.jam || '00:00';
  if (jamB !== jamA) return jamB.localeCompare(jamA);
  const crA = a.created_at || '';
  const crB = b.created_at || '';
  return crB.localeCompare(crA);
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
      .sort(bandingkanTransaksiBaruKeLama);
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
