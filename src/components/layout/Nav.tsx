'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Handshake,
  PiggyBank,
  Wallet,
  Tags,
  BarChart3,
  Plus,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useAppData } from './AppDataProvider';
import { createClient } from '@/lib/supabase/client';
import { tambahAkunWorkspace } from '@/lib/actions/workspace';
import Modal from '@/components/ui/Modal';

export interface MenuItem {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
}

export const ALL_MENU: MenuItem[] = [
  { href: '/ringkasan', label: 'Ringkasan', shortLabel: 'Ringkasan', icon: LayoutDashboard },
  { href: '/transaksi', label: 'Transaksi', shortLabel: 'Transaksi', icon: ArrowLeftRight },
  { href: '/anggaran', label: 'Anggaran', shortLabel: 'Anggaran', icon: PieChart },
  { href: '/hutang-piutang', label: 'Hutang & Piutang', shortLabel: 'Hutang', icon: Handshake },
  { href: '/tabungan', label: 'Tabungan', shortLabel: 'Tabungan', icon: PiggyBank },
  { href: '/rekening', label: 'Rekening', shortLabel: 'Rekening', icon: Wallet },
  { href: '/kategori', label: 'Kategori', shortLabel: 'Kategori', icon: Tags },
  { href: '/laporan', label: 'Laporan', shortLabel: 'Laporan', icon: BarChart3 },
];

export function BottomNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position to display edge fade indicators
  const checkScroll = () => {
    if (!navRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = navRef.current;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 8);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  // Auto-scroll active item into view whenever route changes
  useEffect(() => {
    if (!navRef.current) return;
    const activeEl = navRef.current.querySelector('[data-active="true"]') as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
    setTimeout(checkScroll, 300);
  }, [pathname]);

  const scrollByAmount = (offset: number) => {
    if (navRef.current) {
      navRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <nav className="no-print fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] md:hidden">
      {/* Scroll indicator overlay - Left Fade & Button */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pl-1 pr-4 bg-gradient-to-r from-white via-white/90 to-transparent pointer-events-none">
          <button
            type="button"
            onClick={() => scrollByAmount(-140)}
            className="pointer-events-auto w-6 h-6 rounded-full bg-white shadow-md border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-sky-600 active:scale-90 transition-transform"
            aria-label="Geser ke kiri"
          >
            <ChevronLeft size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Scroll indicator overlay - Right Fade & Button */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pr-1 pl-4 bg-gradient-to-l from-white via-white/90 to-transparent pointer-events-none">
          <button
            type="button"
            onClick={() => scrollByAmount(140)}
            className="pointer-events-auto w-6 h-6 rounded-full bg-white shadow-md border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-sky-600 active:scale-90 transition-transform"
            aria-label="Geser ke kanan"
          >
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Horizontal Scrollable Menu Track */}
      <div
        ref={navRef}
        onScroll={checkScroll}
        className="no-scrollbar overflow-x-auto flex items-center gap-1.5 px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] scroll-smooth snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {ALL_MENU.map((m) => {
          const active = pathname?.startsWith(m.href);
          const Icon = m.icon;

          return (
            <Link
              key={m.href}
              href={m.href}
              data-active={active ? 'true' : 'false'}
              className="relative flex-shrink-0 flex flex-col items-center justify-center min-w-[64px] px-2 py-1 rounded-xl select-none group snap-center"
            >
              <motion.div
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="flex flex-col items-center gap-1 w-full"
              >
                {/* Active Background Pill Highlight */}
                {active && (
                  <motion.span
                    layoutId="activeBottomTab"
                    className="absolute inset-0 bg-sky-50 border border-sky-100/80 rounded-xl -z-10 shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                  />
                )}

                {/* Flat Modern Icon Container */}
                <div
                  className={`w-9 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    active ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                >
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.2 : 1.75}
                    className="transition-transform duration-150 group-active:scale-90"
                  />
                </div>

                {/* Label */}
                <span
                  className={`text-[10px] tracking-tight leading-none text-center transition-colors truncate max-w-[66px] ${
                    active ? 'font-bold text-sky-700' : 'font-medium text-slate-500 group-hover:text-slate-700'
                  }`}
                >
                  {m.shortLabel || m.label}
                </span>

                {/* Active Underline Dot */}
                {active && (
                  <motion.span
                    layoutId="activeBottomDot"
                    className="w-1 h-1 rounded-full bg-sky-600 mt-0.5"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const { init, gantiWorkspace, refetchAll, loading } = useAppData();
  const router = useRouter();
  const [modalAkunBaru, setModalAkunBaru] = useState(false);
  const [namaAkunBaru, setNamaAkunBaru] = useState('');
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then((res: { data?: { user?: { email?: string } | null } }) => {
      const email = res?.data?.user?.email;
      if (email) {
        setUserEmail(email);
        setIsDemoMode(false);
      } else {
        setIsDemoMode(true);
      }
    });
  }, []);

  async function keluar() {
    const supabase = createClient();
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem('keuanganku_auth');
      localStorage.removeItem('keuanganku_demo');
      localStorage.setItem('keuanganku_logged_out', '1');
    } catch {
      // ignore
    }
    // Hapus semua cookie sesi dan demo
    document.cookie = 'keuanganku_auth=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
    document.cookie = 'keuanganku_demo=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
    if (typeof document !== 'undefined') {
      document.cookie.split(';').forEach((c) => {
        const name = c.split('=')[0].trim();
        if (name.startsWith('sb-') || name.startsWith('supabase')) {
          document.cookie = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure`;
        }
      });
    }
    window.location.replace('/login');
  }

  function onSelectWorkspace(v: string) {
    if (v === '__baru__') {
      setNamaAkunBaru('');
      setErrMsg(null);
      setModalAkunBaru(true);
      return;
    }
    gantiWorkspace(v);
  }

  async function submitAkunBaru() {
    if (!namaAkunBaru.trim()) {
      setErrMsg('Nama akun tidak boleh kosong');
      return;
    }
    setBusy(true);
    setErrMsg(null);
    const res = await tambahAkunWorkspace(namaAkunBaru);
    setBusy(false);
    if (!res.success) {
      setErrMsg(res.error);
      return;
    }
    setModalAkunBaru(false);
    await refetchAll();
    await gantiWorkspace(namaAkunBaru.trim());
  }

  return (
    <header className="no-print sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-5 py-2.5 transition-all">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Brand / Logo */}
        <Link href="/ringkasan" className="flex items-center gap-2 group select-none">
          <motion.div
            whileHover={{ rotate: 10, scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20"
          >
            <Wallet size={18} strokeWidth={2.2} />
          </motion.div>
          <div>
            <div className="font-bold text-slate-800 text-sm tracking-tight flex items-center gap-1 group-hover:text-sky-600 transition-colors">
              KeuanganKu
              <Sparkles size={12} className="text-amber-500 opacity-80" />
            </div>
            <div className="text-[10px] text-slate-400 font-medium -mt-0.5 hidden sm:flex items-center gap-1.5">
              <span>Kelola Keuangan</span>
              <span>·</span>
              {!isDemoMode && userEmail ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {userEmail}
                </span>
              ) : (
                <Link
                  href="/login"
                  className="text-amber-700 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 font-semibold transition flex items-center gap-1"
                  title="Klik untuk menghubungkan database Supabase Anda"
                >
                  <span>Mode Sample</span>
                  <span className="text-sky-600 underline font-normal">Login</span>
                </Link>
              )}
            </div>
          </div>
        </Link>

        {/* Right Area: Desktop Nav & Workspace Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/70 p-1 rounded-xl border border-slate-200/60">
            {ALL_MENU.map((m) => {
              const active = pathname?.startsWith(m.href);
              const Icon = m.icon;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className="relative px-2.5 py-1.5 rounded-lg text-xs font-medium select-none group flex items-center gap-1.5"
                >
                  <motion.div
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.94 }}
                    className="flex items-center gap-1.5"
                  >
                    {active && (
                      <motion.span
                        layoutId="activeDesktopTab"
                        className="absolute inset-0 bg-white rounded-lg shadow-sm -z-10"
                        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                      />
                    )}
                    <Icon
                      size={15}
                      strokeWidth={active ? 2.2 : 1.8}
                      className={active ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-600'}
                    />
                    <span className={active ? 'text-slate-900 font-semibold' : 'text-slate-600 group-hover:text-slate-900'}>
                      {m.label}
                    </span>
                  </motion.div>
                </Link>
              );
            })}
          </nav>

          {/* Workspace Switcher */}
          <div className="relative flex items-center">
            <select
              value={init.active}
              disabled={loading}
              onChange={(e) => onSelectWorkspace(e.target.value)}
              className="text-xs font-semibold text-slate-700 border border-slate-200 bg-white hover:border-slate-300 rounded-xl pl-2.5 pr-7 py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer transition appearance-none"
              title="Pilih Akun / Workspace"
            >
              {init.workspaces.map((w) => (
                <option key={w} value={w}>
                  📁 {w}
                </option>
              ))}
              <option value="__baru__">➕ + Akun Baru...</option>
            </select>
            <div className="pointer-events-none absolute right-2 text-slate-400 text-[10px]">▼</div>
          </div>

          {/* Logout Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={keluar}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50/60 transition"
            title="Keluar dari akun"
          >
            <LogOut size={15} strokeWidth={2} />
            <span className="hidden sm:inline font-medium">Keluar</span>
          </motion.button>
        </div>
      </div>

      {/* Modal Buat Akun / Workspace Baru */}
      <Modal open={modalAkunBaru} onClose={() => setModalAkunBaru(false)} title="Buat Akun / Workspace Baru">
        <div className="space-y-4 pt-1">
          <p className="text-xs text-slate-500">
            Pisahkan pencatatan keuangan pribadi, usaha sampingan, kantor, atau proyek dengan workspace terpisah.
          </p>
          <div>
            <label className="text-xs font-semibold text-slate-700">Nama Akun / Workspace</label>
            <input
              value={namaAkunBaru}
              onChange={(e) => setNamaAkunBaru(e.target.value)}
              className="w-full border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 rounded-xl px-3.5 py-2 text-sm mt-1.5 transition outline-none"
              placeholder="mis. Usaha Dagang, Kantor, Pribadi..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitAkunBaru();
              }}
            />
          </div>
          {errMsg && <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{errMsg}</div>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalAkunBaru(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Batal
            </button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={submitAkunBaru}
              disabled={busy}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>{busy ? 'Membuat...' : 'Buat Akun'}</span>
            </motion.button>
          </div>
        </div>
      </Modal>
    </header>
  );
}
