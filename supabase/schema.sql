-- ============================================================
-- KeuanganKu — Skema Supabase (migrasi dari Google Apps Script + Sheets)
-- ============================================================
-- Pemetaan dari struktur Sheets lama -> tabel di bawah:
--   Master_Workspace   -> workspaces
--   Rekening_<ws>      -> accounts
--   Kategori_<ws>      -> categories + subcategories (dinormalisasi;
--                         baris "Kategori|SubKategori kosong" di Sheets lama
--                         sekarang cukup 1 baris di `categories`)
--   Anggaran_<ws>       -> budgets
--   Transaksi_<ws>      -> transactions  (kolom A-S sheet lama dipetakan
--                          1:1 ke kolom-kolom di bawah, lihat komentar per kolom)
--   Tabungan_<ws>       -> savings_targets (baris Jenis='Target')
--                          + savings_deposits (baris Jenis='Isi')
--   UserProperties.prefWorkspace -> user_preferences
--
-- Semua tabel workspace-scoped di-RLS berdasarkan kepemilikan (auth.uid()),
-- menggantikan model GAS lama yang mengandalkan 1 akun Google pemilik skrip.
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- WORKSPACES  (dulu: sheet Master_Workspace, kolom ID | Nama Workspace/Akun)
-- ============================================================
create table if not exists workspaces (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nama        text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, nama)
);

-- ============================================================
-- ACCOUNTS / REKENING  (dulu: sheet Rekening_<ws>, kolom ID | Nama Rekening)
-- Rekening bernama 'TABUNGAN' dibuat otomatis (lihat fungsi pastikanRekeningAda
-- di GAS lama) saat fitur Isi Tabungan pertama kali dipakai — logika yang sama
-- direplikasi di src/lib/actions/tabungan.ts.
-- ============================================================
create table if not exists accounts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  nama          text not null,
  created_at    timestamptz not null default now(),
  unique (workspace_id, nama)
);

-- ============================================================
-- CATEGORIES + SUBCATEGORIES
-- (dulu: sheet Kategori_<ws>, kolom Tipe | Kategori | SubKategori — satu
-- baris per sub, baris SubKategori kosong = kategori tanpa sub. Di sini
-- dinormalisasi: 1 baris kategori, sub-sub-nya baris terpisah di subcategories.)
-- ============================================================
create table if not exists categories (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  tipe          text not null check (tipe in ('Pemasukan', 'Pengeluaran')),
  nama          text not null,
  created_at    timestamptz not null default now(),
  unique (workspace_id, tipe, nama)
);

create table if not exists subcategories (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references categories(id) on delete cascade,
  nama          text not null,
  created_at    timestamptz not null default now(),
  unique (category_id, nama)
);

-- ============================================================
-- BUDGETS / ANGGARAN  (dulu: sheet Anggaran_<ws>,
-- kolom Bulan | Tahun | Kategori | Nominal Anggaran | SubKategori)
-- ============================================================
create table if not exists budgets (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  bulan         int not null check (bulan between 1 and 12),
  tahun         int not null,
  kategori      text not null,
  sub_kategori  text not null default '',
  nominal       numeric not null default 0,
  created_at    timestamptz not null default now(),
  unique (workspace_id, bulan, tahun, kategori, sub_kategori)
);

-- ============================================================
-- TRANSACTIONS  (dulu: sheet Transaksi_<ws>, kolom A-S)
-- Pemetaan kolom lama -> kolom baru:
--   A Tanggal          -> tanggal
--   B Tipe             -> tipe
--   C Kategori         -> kategori  (tetap TEXT bebas: bisa nama kategori
--                                    biasa, atau penanda 'Transfer' /
--                                    'Hutang' / 'Piutang' / 'Tabungan' —
--                                    sama seperti logika lama, BUKAN FK wajib
--                                    ke tabel categories)
--   D Keterangan       -> keterangan
--   E Nominal          -> nominal
--   F Saldo            -> saldo           (running balance, computed di app)
--   G Rekening         -> rekening
--   H Bukti            -> bukti           (text[] — dulu 1 string dipisah koma)
--   I PiutangID        -> piutang_id      (grup DP/Cicilan)
--   J StatusBayar      -> status_bayar    ('Lunas' | 'DP')
--   K TotalTagihan     -> total_tagihan
--   L Jam              -> jam
--   M WarnaHighlight   -> warna_highlight
--   N Catatan          -> catatan
--   O PihakTerkait     -> pihak_terkait
--   P HutangPiutangID  -> hutang_piutang_id  (dipakai juga sbg link Isi Tabungan)
--   Q PerananHP        -> peranan_hp         ('Pokok' | 'Pembayaran')
--   R JatuhTempo       -> jatuh_tempo
--   S SubKategori      -> sub_kategori
-- "rowIdx" (nomor baris Sheets) di app lama digantikan `id` (uuid) di sini.
-- ============================================================
create table if not exists transactions (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  tanggal             date not null,
  jam                 text not null default '',
  tipe                text not null check (tipe in ('Pemasukan', 'Pengeluaran')),
  kategori            text not null default '-',
  sub_kategori        text not null default '',
  keterangan          text not null default '',
  nominal             numeric not null default 0,
  saldo               numeric not null default 0,
  rekening            text not null default 'CASH',
  bukti               text[] not null default '{}',
  piutang_id          text default '',
  status_bayar        text default 'Lunas',
  total_tagihan       numeric default 0,
  warna_highlight     text default '',
  catatan             text default '',
  pihak_terkait       text default '',
  hutang_piutang_id   text default '',
  peranan_hp          text default '',
  jatuh_tempo         date,
  created_at          timestamptz not null default now()
);

create index if not exists idx_transactions_workspace on transactions(workspace_id, tanggal);
create index if not exists idx_transactions_piutang on transactions(workspace_id, piutang_id) where piutang_id is not null and piutang_id <> '';
create index if not exists idx_transactions_hp on transactions(workspace_id, hutang_piutang_id) where hutang_piutang_id is not null and hutang_piutang_id <> '';

-- ============================================================
-- SAVINGS / TABUNGAN
-- (dulu: 1 sheet Tabungan_<ws> berisi 2 jenis baris — Jenis='Target' dan
-- Jenis='Isi' — sekarang dipisah jadi 2 tabel agar relasinya eksplisit)
-- ============================================================
create table if not exists savings_targets (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  keterangan     text not null,
  target_nominal numeric not null default 0,
  tenggat        date,
  created_at     timestamptz not null default now()
);

create table if not exists savings_deposits (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  target_id      uuid not null references savings_targets(id) on delete cascade,
  tanggal        date not null,
  jam            text not null default '',
  nominal        numeric not null default 0,
  rekening       text not null default 'CASH',
  keterangan     text not null default '',
  -- link ke SEPASANG baris di `transactions` (Pengeluaran dari rekening asal +
  -- Pemasukan ke rekening TABUNGAN) yang dibuat bersamaan — dipakai untuk
  -- menghapus keduanya sekaligus, identik dgn peran RiwayatID/HutangPiutangID
  -- di sheet lama.
  transfer_link  text not null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_savings_deposits_target on savings_deposits(target_id);

-- ============================================================
-- USER PREFERENCES  (dulu: UserProperties.prefWorkspace per akun Google)
-- ============================================================
create table if not exists user_preferences (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  pref        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table workspaces enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table subcategories enable row level security;
alter table budgets enable row level security;
alter table transactions enable row level security;
alter table savings_targets enable row level security;
alter table savings_deposits enable row level security;
alter table user_preferences enable row level security;

create policy "workspaces_owner" on workspaces
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "accounts_owner" on accounts
  for all using (exists (select 1 from workspaces w where w.id = accounts.workspace_id and w.user_id = auth.uid()))
  with check (exists (select 1 from workspaces w where w.id = accounts.workspace_id and w.user_id = auth.uid()));

create policy "categories_owner" on categories
  for all using (exists (select 1 from workspaces w where w.id = categories.workspace_id and w.user_id = auth.uid()))
  with check (exists (select 1 from workspaces w where w.id = categories.workspace_id and w.user_id = auth.uid()));

create policy "subcategories_owner" on subcategories
  for all using (exists (select 1 from categories c join workspaces w on w.id = c.workspace_id where c.id = subcategories.category_id and w.user_id = auth.uid()))
  with check (exists (select 1 from categories c join workspaces w on w.id = c.workspace_id where c.id = subcategories.category_id and w.user_id = auth.uid()));

create policy "budgets_owner" on budgets
  for all using (exists (select 1 from workspaces w where w.id = budgets.workspace_id and w.user_id = auth.uid()))
  with check (exists (select 1 from workspaces w where w.id = budgets.workspace_id and w.user_id = auth.uid()));

create policy "transactions_owner" on transactions
  for all using (exists (select 1 from workspaces w where w.id = transactions.workspace_id and w.user_id = auth.uid()))
  with check (exists (select 1 from workspaces w where w.id = transactions.workspace_id and w.user_id = auth.uid()));

create policy "savings_targets_owner" on savings_targets
  for all using (exists (select 1 from workspaces w where w.id = savings_targets.workspace_id and w.user_id = auth.uid()))
  with check (exists (select 1 from workspaces w where w.id = savings_targets.workspace_id and w.user_id = auth.uid()));

create policy "savings_deposits_owner" on savings_deposits
  for all using (exists (select 1 from workspaces w where w.id = savings_deposits.workspace_id and w.user_id = auth.uid()))
  with check (exists (select 1 from workspaces w where w.id = savings_deposits.workspace_id and w.user_id = auth.uid()));

create policy "user_preferences_owner" on user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- STORAGE: BUKTI TRANSAKSI
-- ============================================================
insert into storage.buckets (id, name, public)
values ('bukti-transaksi', 'bukti-transaksi', true)
on conflict (id) do update set public = true;

create policy "bukti_storage_select_public" on storage.objects
  for select using (bucket_id = 'bukti-transaksi');

create policy "bukti_storage_insert_owner" on storage.objects
  for insert with check (
    bucket_id = 'bukti-transaksi'
    and auth.role() = 'authenticated'
    and array_length(storage.foldername(name), 1) >= 1
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "bukti_storage_update_owner" on storage.objects
  for update using (
    bucket_id = 'bukti-transaksi'
    and auth.role() = 'authenticated'
    and array_length(storage.foldername(name), 1) >= 1
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'bukti-transaksi'
    and auth.role() = 'authenticated'
    and array_length(storage.foldername(name), 1) >= 1
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "bukti_storage_delete_owner" on storage.objects
  for delete using (
    bucket_id = 'bukti-transaksi'
    and auth.role() = 'authenticated'
    and array_length(storage.foldername(name), 1) >= 1
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- SEED DEFAULT (opsional) — dibuat otomatis lewat kode saat user baru
-- pertama login (lihat src/lib/actions/workspace.ts -> setupDefaultWorkspace,
-- padanan fungsi setupMasterWorkspace() di GAS lama).
-- ============================================================

-- ============================================================
-- STORAGE — bukti transaksi (padanan folder Drive "KeuanganKu - Bukti Transaksi/<ws>")
-- Jalankan lewat Supabase Dashboard > Storage, atau uncomment jika storage
-- schema tersedia di project ini:
-- insert into storage.buckets (id, name, public) values ('bukti-transaksi', 'bukti-transaksi', true)
--   on conflict (id) do nothing;
-- ============================================================
