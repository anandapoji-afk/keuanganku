'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'masuk' | 'daftar'>('masuk');
  const [pesan, setPesan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setPesan(null);
    const supabase = createClient();

    if (mode === 'masuk') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setPesan('Error: ' + error.message);
      else {
        router.push('/');
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setPesan('Error: ' + error.message);
      else setPesan('Akun dibuat. Silakan cek email untuk verifikasi (jika diaktifkan), lalu masuk.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-xl font-bold text-slate-800">KeuanganKu</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          {mode === 'masuk' ? 'Masuk ke akun Anda' : 'Buat akun baru'}
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {pesan && <div className="text-xs text-red-600">{pesan}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 text-white text-sm font-semibold py-2.5 hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? 'Memproses...' : mode === 'masuk' ? 'Masuk' : 'Daftar'}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === 'masuk' ? 'daftar' : 'masuk')}
          className="mt-4 text-xs text-sky-600 hover:underline w-full text-center"
        >
          {mode === 'masuk' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
        </button>
      </div>
    </div>
  );
}
