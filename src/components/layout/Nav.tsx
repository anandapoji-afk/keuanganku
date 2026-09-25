'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAppData } from './AppDataProvider';
import { createClient } from '@/lib/supabase/client';
import { tambahAkunWorkspace } from '@/lib/actions/workspace';
import Modal from '@/components/ui/Modal';

const MENU = [
  { href: '/ringkasan', label: 'Ringkasan', icon: '\u{1F3E0}' },
  { href: '/transaksi', label: 'Transaksi', icon: '\u{1F4B8}' },
  { href: '/anggaran', label: 'Anggaran', icon: '\u{1F4CA}' },
  { href: '/hutang-piutang', label: 'Hutang', icon: '\u{1F91D}' },
  { href: '/tabungan', label: 'Tabungan', icon: '\u{1F3E6}' },
];

const MENU_LAINNYA = [
  { href: '/kategori', label: 'Kategori' },
  { href: '/rekening', label: 'Rekening' },
  { href: '/laporan', label: 'Laporan' },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="no-print fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex md:hidden">
      {MENU.map((m) => {
        const active = pathname?.startsWith(m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
              active ? 'text-sky-600' : 'text-slate-400'
            }`}
          >
            <span className="text-lg leading-none">{m.icon}</span>
            {m.label}
          </Link>
        );
      })}
      <Link
        href="/kategori"
        className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
          pathname && MENU_LAINNYA.some((m) => pathname.startsWith(m.href)) ? 'text-sky-600' : 'text-slate-400'
        }`}
      >
        <span className="text-lg leading-none">{'\u2022\u2022\u2022'}</span>
        Lainnya
      </Link>
    </nav>
  );
}

export function TopBar() {
  const { init, gantiWorkspace, refetchAll, loading } = useAppData();
  const router = useRouter();
  const [modalAkunBaru, setModalAkunBaru] = useState(false);
  const [namaAkunBaru, setNamaAkunBaru] = useState('');
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function keluar() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
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
    <header className="no-print sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="font-bold text-slate-800 text-sm">KeuanganKu</div>

      <div className="flex items-center gap-2">
        <select
          value={init.active}
          disabled={loading}
          onChange={(e) => onSelectWorkspace(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
        >
          {init.workspaces.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
          <option value="__baru__">+ Akun Baru...</option>
        </select>

        <nav className="hidden md:flex items-center gap-1">
          {[...MENU, ...MENU_LAINNYA].map((m) => (
            <Link key={m.href} href={m.href} className="text-xs px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100">
              {m.label}
            </Link>
          ))}
        </nav>

        <button onClick={keluar} className="text-xs text-slate-400 hover:text-red-600 px-2">
          Keluar
        </button>
      </div>

      <Modal open={modalAkunBaru} onClose={() => setModalAkunBaru(false)} title="Buat Akun / Workspace Baru">
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-slate-500">Nama Akun</label>
            <input
              value={namaAkunBaru}
              onChange={(e) => setNamaAkunBaru(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
              placeholder="mis. Usaha Sampingan"
            />
          </div>
          {errMsg && <div className="text-xs text-red-600">{errMsg}</div>}
          <button onClick={submitAkunBaru} disabled={busy} className="w-full bg-sky-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
            {busy ? 'Membuat...' : 'Buat Akun'}
          </button>
        </div>
      </Modal>
    </header>
  );
}