import AppDataProvider from '@/components/layout/AppDataProvider';
import { TopBar, BottomNav } from '@/components/layout/Nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-4 pb-20 md:pb-8">{children}</main>
      <BottomNav />
    </AppDataProvider>
  );
}
