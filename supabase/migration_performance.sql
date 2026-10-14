-- ============================================================
-- KeuanganKu — Index performa (aman dijalankan berulang)
-- Jalankan di Supabase Dashboard > SQL Editor.
-- ============================================================
-- Query terbesar: transactions WHERE workspace_id = ? ORDER BY created_at.
-- Index lama (workspace_id, tanggal) tidak membantu pengurutan created_at,
-- sehingga Postgres harus sort manual setiap kali data dimuat.
create index if not exists idx_transactions_ws_created
  on transactions (workspace_id, created_at, id);

-- Query lain yang jalan di setiap pemuatan data awal
create index if not exists idx_workspaces_user_created
  on workspaces (user_id, created_at);
create index if not exists idx_accounts_ws_created
  on accounts (workspace_id, created_at);
create index if not exists idx_categories_ws_created
  on categories (workspace_id, created_at);
create index if not exists idx_subcategories_category
  on subcategories (category_id);
create index if not exists idx_budgets_ws
  on budgets (workspace_id);
create index if not exists idx_savings_targets_ws_created
  on savings_targets (workspace_id, created_at);

analyze;
