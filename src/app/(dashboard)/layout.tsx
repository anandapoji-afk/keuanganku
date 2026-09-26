import AppDataProvider from '@/components/layout/AppDataProvider';
import { TopBar, BottomNav } from '@/components/layout/Nav';
import PageTransition from '@/components/layout/PageTransition';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-4 pb-28">
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomNav />
    </AppDataProvider>
  );
}
