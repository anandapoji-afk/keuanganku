CREATE OR REPLACE VIEW laporan_ringkas AS
SELECT 
  kategori_id,
  SUM(jumlah) as total_pengeluaran,
  DATE_TRUNC('month', tanggal) as bulan
FROM transaksi
WHERE jenis = 'pengeluaran'
GROUP BY kategori_id, DATE_TRUNC('month', tanggal);
