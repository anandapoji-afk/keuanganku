// In-memory mock database for KeuanganKu when Supabase environment variables are not provided
// Allows the application to run smoothly out of the box in AI Studio.

export interface MockUser {
  id: string;
  email: string;
}

export const DEMO_USER: MockUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'ananda.poji@gmail.com',
};

export const SAMPLE_RECEIPT_URL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560" viewBox="0 0 400 560" fill="white"><rect width="400" height="560" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="2"/><rect x="20" y="20" width="360" height="520" fill="white" rx="8" stroke="%23e2e8f0"/><text x="200" y="65" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%230f172a">SUPERMARKET SEGAR</text><text x="200" y="88" text-anchor="middle" font-family="sans-serif" font-size="11" fill="%2364748b">Jl. Jenderal Sudirman No. 123</text><line x1="40" y1="110" x2="360" y2="110" stroke="%23e2e8f0" stroke-dasharray="4"/><text x="40" y="140" font-family="sans-serif" font-size="12" fill="%23334155">Minyak Goreng 2L</text><text x="360" y="140" text-anchor="end" font-family="sans-serif" font-size="12" fill="%23334155">Rp 38.000</text><text x="40" y="170" font-family="sans-serif" font-size="12" fill="%23334155">Beras Premium 5kg</text><text x="360" y="170" text-anchor="end" font-family="sans-serif" font-size="12" fill="%23334155">Rp 75.000</text><text x="40" y="200" font-family="sans-serif" font-size="12" fill="%23334155">Daging Sapi 1kg</text><text x="360" y="200" text-anchor="end" font-family="sans-serif" font-size="12" fill="%23334155">Rp 145.000</text><text x="40" y="230" font-family="sans-serif" font-size="12" fill="%23334155">Buah Apel Fuji 1kg</text><text x="360" y="230" text-anchor="end" font-family="sans-serif" font-size="12" fill="%23334155">Rp 42.000</text><text x="40" y="260" font-family="sans-serif" font-size="12" fill="%23334155">Susu Segar 1L (x2)</text><text x="360" y="260" text-anchor="end" font-family="sans-serif" font-size="12" fill="%23334155">Rp 50.000</text><text x="40" y="290" font-family="sans-serif" font-size="12" fill="%23334155">Bumbu Dapur</text><text x="360" y="290" text-anchor="end" font-family="sans-serif" font-size="12" fill="%23334155">Rp 70.000</text><line x1="40" y1="320" x2="360" y2="320" stroke="%230f172a" stroke-width="1.5"/><text x="40" y="350" font-family="sans-serif" font-size="14" font-weight="bold" fill="%230f172a">TOTAL BELANJA</text><text x="360" y="350" text-anchor="end" font-family="sans-serif" font-size="14" font-weight="bold" fill="%230f172a">Rp 420.000</text><text x="40" y="380" font-family="sans-serif" font-size="11" fill="%2364748b">Pembayaran: BCA Debit</text><text x="360" y="380" text-anchor="end" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23059669">LUNAS</text><rect x="130" y="420" width="140" height="36" fill="%23f1f5f9" rx="4"/><text x="200" y="443" text-anchor="middle" font-family="monospace" font-size="11" fill="%23475569">STRUK-2026-0925</text><text x="200" y="495" text-anchor="middle" font-family="sans-serif" font-size="11" fill="%2394a3b8">Terima kasih atas kunjungan Anda</text></svg>';

export const DEMO_WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';

function genId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface MockDb {
  workspaces: any[];
  accounts: any[];
  categories: any[];
  subcategories: any[];
  budgets: any[];
  transactions: any[];
  savings_targets: any[];
  savings_deposits: any[];
  user_preferences: any[];
  storage: Map<string, string>;
}

declare global {
  // eslint-disable-next-line no-var
  var __keuanganku_mock_db: MockDb | undefined;
}

function initMockDb(): MockDb {
  const now = new Date();
  const tahun = now.getFullYear();
  const bulan = now.getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  const tglStr = (day: number) => `${tahun}-${pad(bulan)}-${pad(day)}`;

  const ws = {
    id: DEMO_WORKSPACE_ID,
    user_id: DEMO_USER.id,
    nama: 'Dompet Pribadi',
    created_at: new Date(now.getTime() - 86400000 * 30).toISOString(),
  };

  const accounts = [
    { id: 'acc_bca', workspace_id: DEMO_WORKSPACE_ID, nama: 'BCA', created_at: ws.created_at },
    { id: 'acc_cash', workspace_id: DEMO_WORKSPACE_ID, nama: 'CASH', created_at: ws.created_at },
    { id: 'acc_tbg', workspace_id: DEMO_WORKSPACE_ID, nama: 'TABUNGAN', created_at: ws.created_at },
  ];

  const defaultKats = [
    { id: 'cat_1', workspace_id: DEMO_WORKSPACE_ID, tipe: 'Pengeluaran', nama: 'Makan & Minum', created_at: ws.created_at },
    { id: 'cat_2', workspace_id: DEMO_WORKSPACE_ID, tipe: 'Pengeluaran', nama: 'Transportasi', created_at: ws.created_at },
    { id: 'cat_3', workspace_id: DEMO_WORKSPACE_ID, tipe: 'Pengeluaran', nama: 'Keluarga', created_at: ws.created_at },
    { id: 'cat_4', workspace_id: DEMO_WORKSPACE_ID, tipe: 'Pengeluaran', nama: 'Belanja', created_at: ws.created_at },
    { id: 'cat_5', workspace_id: DEMO_WORKSPACE_ID, tipe: 'Pengeluaran', nama: 'Lain-lain', created_at: ws.created_at },
    { id: 'cat_6', workspace_id: DEMO_WORKSPACE_ID, tipe: 'Pemasukan', nama: 'Gaji & Honor', created_at: ws.created_at },
    { id: 'cat_7', workspace_id: DEMO_WORKSPACE_ID, tipe: 'Pemasukan', nama: 'Bonus', created_at: ws.created_at },
    { id: 'cat_8', workspace_id: DEMO_WORKSPACE_ID, tipe: 'Pemasukan', nama: 'Lain-lain', created_at: ws.created_at },
  ];

  const subcategories = [
    { id: 'sub_1', category_id: 'cat_1', nama: 'Restoran', created_at: ws.created_at },
    { id: 'sub_2', category_id: 'cat_1', nama: 'Belanja Dapur', created_at: ws.created_at },
    { id: 'sub_3', category_id: 'cat_1', nama: 'Kopi & Camilan', created_at: ws.created_at },
    { id: 'sub_4', category_id: 'cat_2', nama: 'Bensin', created_at: ws.created_at },
    { id: 'sub_5', category_id: 'cat_2', nama: 'Parkir', created_at: ws.created_at },
    { id: 'sub_6', category_id: 'cat_4', nama: 'Kebutuhan Pribadi', created_at: ws.created_at },
    { id: 'sub_7', category_id: 'cat_6', nama: 'Gaji Pokok', created_at: ws.created_at },
  ];

  const budgets = [
    { id: 'bdg_1', workspace_id: DEMO_WORKSPACE_ID, bulan, tahun, kategori: 'Makan & Minum', sub_kategori: '', nominal: 2500000, created_at: ws.created_at },
    { id: 'bdg_2', workspace_id: DEMO_WORKSPACE_ID, bulan, tahun, kategori: 'Transportasi', sub_kategori: '', nominal: 600000, created_at: ws.created_at },
    { id: 'bdg_3', workspace_id: DEMO_WORKSPACE_ID, bulan, tahun, kategori: 'Belanja', sub_kategori: '', nominal: 1000000, created_at: ws.created_at },
  ];

  const transactions = [
    {
      id: 'trx_1',
      workspace_id: DEMO_WORKSPACE_ID,
      tanggal: tglStr(1),
      jam: '09:00',
      tipe: 'Pemasukan',
      kategori: 'Gaji & Honor',
      sub_kategori: 'Gaji Pokok',
      keterangan: 'Gaji Bulanan',
      nominal: 8500000,
      saldo: 8500000,
      rekening: 'BCA',
      bukti: [],
      piutang_id: '',
      status_bayar: 'Lunas',
      total_tagihan: 0,
      warna_highlight: '',
      catatan: '',
      pihak_terkait: 'Kantor',
      hutang_piutang_id: '',
      peranan_hp: '',
      jatuh_tempo: null,
      created_at: new Date(now.getTime() - 86400000 * 20).toISOString(),
    },
    {
      id: 'trx_2',
      workspace_id: DEMO_WORKSPACE_ID,
      tanggal: tglStr(3),
      jam: '12:30',
      tipe: 'Pengeluaran',
      kategori: 'Makan & Minum',
      sub_kategori: 'Restoran',
      keterangan: 'Makan Siang Tim',
      nominal: 85000,
      saldo: 8415000,
      rekening: 'CASH',
      bukti: [],
      piutang_id: '',
      status_bayar: 'Lunas',
      total_tagihan: 0,
      warna_highlight: '',
      catatan: '',
      pihak_terkait: '',
      hutang_piutang_id: '',
      peranan_hp: '',
      jatuh_tempo: null,
      created_at: new Date(now.getTime() - 86400000 * 18).toISOString(),
    },
    {
      id: 'trx_3',
      workspace_id: DEMO_WORKSPACE_ID,
      tanggal: tglStr(5),
      jam: '15:00',
      tipe: 'Pengeluaran',
      kategori: 'Transportasi',
      sub_kategori: 'Bensin',
      keterangan: 'Isi Pertamax',
      nominal: 150000,
      saldo: 8265000,
      rekening: 'BCA',
      bukti: [],
      piutang_id: '',
      status_bayar: 'Lunas',
      total_tagihan: 0,
      warna_highlight: '',
      catatan: '',
      pihak_terkait: '',
      hutang_piutang_id: '',
      peranan_hp: '',
      jatuh_tempo: null,
      created_at: new Date(now.getTime() - 86400000 * 15).toISOString(),
    },
    {
      id: 'trx_4',
      workspace_id: DEMO_WORKSPACE_ID,
      tanggal: tglStr(7),
      jam: '10:00',
      tipe: 'Pengeluaran',
      kategori: 'Makan & Minum',
      sub_kategori: 'Belanja Dapur',
      keterangan: 'Belanja Supermarket Mingguan',
      nominal: 420000,
      saldo: 7845000,
      rekening: 'BCA',
      bukti: [SAMPLE_RECEIPT_URL],
      piutang_id: '',
      status_bayar: 'Lunas',
      total_tagihan: 0,
      warna_highlight: '',
      catatan: 'Struk belanja terlampir',
      pihak_terkait: 'Superindo',
      hutang_piutang_id: '',
      peranan_hp: '',
      jatuh_tempo: null,
      created_at: new Date(now.getTime() - 86400000 * 12).toISOString(),
    },
  ];

  const targetId = 'target_1';
  const savings_targets = [
    {
      id: targetId,
      workspace_id: DEMO_WORKSPACE_ID,
      keterangan: 'Dana Darurat & Liburan',
      target_nominal: 10000000,
      tenggat: `${tahun}-12-31`,
      created_at: ws.created_at,
    },
  ];

  const savings_deposits = [
    {
      id: 'dep_1',
      workspace_id: DEMO_WORKSPACE_ID,
      target_id: targetId,
      tanggal: tglStr(2),
      jam: '10:00',
      nominal: 1000000,
      rekening: 'BCA',
      keterangan: 'Setoran Awal Bulan',
      transfer_link: 'TABR_demo_1',
      created_at: new Date(now.getTime() - 86400000 * 19).toISOString(),
    },
  ];

  // Add the transfer entries for savings
  transactions.push(
    {
      id: 'trx_dep_out',
      workspace_id: DEMO_WORKSPACE_ID,
      tanggal: tglStr(2),
      jam: '10:00',
      tipe: 'Pengeluaran',
      kategori: 'Tabungan',
      sub_kategori: '',
      keterangan: 'Setoran Awal Bulan',
      nominal: 1000000,
      saldo: 6845000,
      rekening: 'BCA',
      bukti: [],
      piutang_id: '',
      status_bayar: 'Lunas',
      total_tagihan: 0,
      warna_highlight: '',
      catatan: '',
      pihak_terkait: '',
      hutang_piutang_id: 'TABR_demo_1',
      peranan_hp: '',
      jatuh_tempo: null,
      created_at: new Date(now.getTime() - 86400000 * 19).toISOString(),
    },
    {
      id: 'trx_dep_in',
      workspace_id: DEMO_WORKSPACE_ID,
      tanggal: tglStr(2),
      jam: '10:00',
      tipe: 'Pemasukan',
      kategori: 'Tabungan',
      sub_kategori: '',
      keterangan: 'Setoran Awal Bulan',
      nominal: 1000000,
      saldo: 6845000,
      rekening: 'TABUNGAN',
      bukti: [],
      piutang_id: '',
      status_bayar: 'Lunas',
      total_tagihan: 0,
      warna_highlight: '',
      catatan: '',
      pihak_terkait: '',
      hutang_piutang_id: 'TABR_demo_1',
      peranan_hp: '',
      jatuh_tempo: null,
      created_at: new Date(now.getTime() - 86400000 * 19).toISOString(),
    }
  );

  return {
    workspaces: [ws],
    accounts,
    categories: defaultKats,
    subcategories,
    budgets,
    transactions,
    savings_targets,
    savings_deposits,
    user_preferences: [{ user_id: DEMO_USER.id, pref: { workspace: 'Dompet Pribadi' }, updated_at: now.toISOString() }],
    storage: new Map(),
  };
}

export function getMockDb(): MockDb {
  if (!globalThis.__keuanganku_mock_db) {
    globalThis.__keuanganku_mock_db = initMockDb();
  }
  return globalThis.__keuanganku_mock_db;
}

export class MockQueryBuilder {
  private tableName: string;
  private filters: ((row: any) => boolean)[] = [];
  private orderClauses: { col: string; ascending: boolean }[] = [];
  private limitCount?: number;
  private selectCols?: string;
  private countMode?: string;
  private headMode?: boolean;
  private isSingle = false;
  private isMaybeSingle = false;
  private action?: () => { data: any; error: any; count?: number | null };

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  private getTableData(): any[] {
    const db = getMockDb();
    if (!(this.tableName in db)) {
      (db as any)[this.tableName] = [];
    }
    return (db as any)[this.tableName];
  }

  select(columns = '*', options?: { count?: string; head?: boolean }) {
    this.selectCols = columns;
    if (options?.count) this.countMode = options.count;
    if (options?.head) this.headMode = options.head;
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((row) => row[col] === val);
    return this;
  }

  neq(col: string, val: any) {
    this.filters.push((row) => row[col] !== val);
    return this;
  }

  in(col: string, vals: any[]) {
    this.filters.push((row) => vals.includes(row[col]));
    return this;
  }

  order(col: string, options: { ascending?: boolean } = {}) {
    this.orderClauses.push({ col, ascending: options.ascending !== false });
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  returns<T>() {
    return this as unknown as Promise<{ data: T | null; error: any; count?: number | null }> & this;
  }

  insert(payload: any | any[]) {
    this.action = () => {
      const items = Array.isArray(payload) ? payload : [payload];
      const table = this.getTableData();
      const inserted: any[] = [];

      for (const item of items) {
        const row = {
          ...item,
          id: item.id || genId(this.tableName.slice(0, 3)),
          created_at: item.created_at || new Date().toISOString(),
        };
        table.push(row);
        inserted.push(row);
      }

      return {
        data: Array.isArray(payload) ? inserted : inserted[0],
        error: null,
      };
    };
    return this;
  }

  update(patch: Record<string, any>) {
    this.action = () => {
      const table = this.getTableData();
      const matched = table.filter((row) => this.filters.every((f) => f(row)));
      for (const row of matched) {
        Object.assign(row, patch);
      }
      return { data: matched, error: null };
    };
    return this;
  }

  upsert(payload: any | any[], options?: { onConflict?: string }) {
    this.action = () => {
      const items = Array.isArray(payload) ? payload : [payload];
      const table = this.getTableData();
      const onConflictCols = options?.onConflict ? options.onConflict.split(',').map((s) => s.trim()) : ['id'];
      const upserted: any[] = [];

      for (const item of items) {
        const existingIdx = table.findIndex((row) =>
          onConflictCols.every((col) => row[col] !== undefined && row[col] === item[col])
        );

        if (existingIdx >= 0) {
          table[existingIdx] = { ...table[existingIdx], ...item };
          upserted.push(table[existingIdx]);
        } else {
          const row = {
            ...item,
            id: item.id || genId(this.tableName.slice(0, 3)),
            created_at: item.created_at || new Date().toISOString(),
          };
          table.push(row);
          upserted.push(row);
        }
      }

      return {
        data: Array.isArray(payload) ? upserted : upserted[0],
        error: null,
      };
    };
    return this;
  }

  delete() {
    this.action = () => {
      const db = getMockDb();
      const table = this.getTableData();
      const kept: any[] = [];
      const removed: any[] = [];

      for (const row of table) {
        if (this.filters.every((f) => f(row))) {
          removed.push(row);
        } else {
          kept.push(row);
        }
      }

      (db as any)[this.tableName] = kept;
      return { data: removed, error: null };
    };
    return this;
  }

  private execute() {
    if (this.action) {
      return this.action();
    }

    const table = this.getTableData();
    let rows = table.filter((row) => this.filters.every((f) => f(row)));

    if (this.orderClauses.length > 0) {
      rows = [...rows].sort((a, b) => {
        for (const { col, ascending } of this.orderClauses) {
          const valA = a[col];
          const valB = b[col];
          if (valA < valB) return ascending ? -1 : 1;
          if (valA > valB) return ascending ? 1 : -1;
        }
        return 0;
      });
    }

    const count = rows.length;

    if (this.limitCount !== undefined) {
      rows = rows.slice(0, this.limitCount);
    }

    // Handle nested relation selects
    const db = getMockDb();
    if (this.tableName === 'categories' && this.selectCols?.includes('subcategories')) {
      rows = rows.map((cat) => ({
        ...cat,
        subcategories: (db.subcategories || [])
          .filter((sub) => sub.category_id === cat.id)
          .map((sub) => ({ nama: sub.nama })),
      }));
    } else if (this.tableName === 'savings_targets' && this.selectCols?.includes('savings_deposits')) {
      rows = rows.map((target) => ({
        ...target,
        savings_deposits: (db.savings_deposits || []).filter((d) => d.target_id === target.id),
      }));
    }

    if (this.headMode) {
      return { data: null, error: null, count };
    }

    if (this.isSingle) {
      if (rows.length === 0) {
        return { data: null, error: { message: 'Row not found' }, count: 0 };
      }
      return { data: rows[0], error: null, count: 1 };
    }

    if (this.isMaybeSingle) {
      return { data: rows.length > 0 ? rows[0] : null, error: null, count: rows.length };
    }

    return { data: rows, error: null, count };
  }

  // Thenable implementation to support `await query`
  then(resolve: (value: any) => any, reject?: (reason: any) => any) {
    try {
      const res = this.execute();
      return Promise.resolve(res).then(resolve, reject);
    } catch (err) {
      if (reject) return Promise.reject(err).catch(reject);
      throw err;
    }
  }
}

export function createMockSupabaseClient() {
  const db = getMockDb();

  return {
    from(tableName: string) {
      return new MockQueryBuilder(tableName);
    },
    auth: {
      async getUser() {
        return { data: { user: DEMO_USER }, error: null };
      },
      async signInWithPassword(params: { email?: string; password?: string }) {
        const email = params?.email || DEMO_USER.email;
        DEMO_USER.email = email;
        return { data: { user: { ...DEMO_USER, email }, session: { access_token: 'mock-token' } }, error: null };
      },
      async signUp(params: { email?: string; password?: string }) {
        const email = params?.email || DEMO_USER.email;
        DEMO_USER.email = email;
        return { data: { user: { ...DEMO_USER, email }, session: { access_token: 'mock-token' } }, error: null };
      },
      async signOut() {
        return { error: null };
      },
    },
    storage: {
      from(_bucket: string) {
        return {
          async upload(path: string, bytes: any, options?: any) {
            let dataUrl = '';
            if (bytes && typeof bytes === 'object') {
              if (Buffer.isBuffer(bytes) || bytes instanceof Uint8Array) {
                const mime = options?.contentType || 'image/jpeg';
                dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
              }
            }
            db.storage.set(path, dataUrl || path);
            return { data: { path }, error: null };
          },
          getPublicUrl(path: string) {
            const stored = db.storage.get(path);
            if (stored) {
              return { data: { publicUrl: stored } };
            }
            if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) {
              return { data: { publicUrl: path } };
            }
            return { data: { publicUrl: SAMPLE_RECEIPT_URL } };
          },
          async remove(paths: string[]) {
            paths.forEach((p) => db.storage.delete(p));
            return { data: paths, error: null };
          },
        };
      },
    },
  };
}
