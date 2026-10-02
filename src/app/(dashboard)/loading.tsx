import PageSkeleton from '@/components/ui/Skeleton';

// Tampil instan saat pindah halaman, selagi kode halaman tujuan dimuat.
// Layout (TopBar, BottomNav, AppDataProvider) tetap terpasang, jadi data
// tidak di-fetch ulang.
export default function Loading() {
  return <PageSkeleton variant="daftar" />;
}
