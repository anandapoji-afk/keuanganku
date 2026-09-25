'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'motion/react';
import { Wallet, LogIn, UserPlus, Sparkles, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'masuk' | 'daftar'>('masuk');
  const [pesan, setPesan] = useState<{ tipe: 'error' | 'sukses'; teks: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Masuk dengan email & password akun Supabase asli
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setPesan(null);

    const supabase = createClient();

    if (mode === 'masuk') {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setPesan({
            tipe: 'error',
            teks: error.message.includes('Invalid login')
              ? 'Email atau password salah. Jika belum pernah mendaftar di database Supabase Anda, silakan pilih tab "Daftar Akun".'
              : error.message,
          });
          setLoading(false);
          return;
        }

        if (data?.session) {
          try {
            localStorage.setItem('keuanganku_auth', '1');
            localStorage.removeItem('keuanganku_demo');
          } catch {
            // ignore
          }

          document.cookie = 'keuanganku_demo=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
          document.cookie = 'keuanganku_auth=1; path=/; max-age=2592000; SameSite=None; Secure';
          
          window.location.replace('/ringkasan');
          return;
        }
      } catch (err: unknown) {
        setPesan({
          tipe: 'error',
          teks: err instanceof Error ? err.message : 'Terjadi kesalahan saat masuk.',
        });
        setLoading(false);
      }
    } else {
      // Mode Daftar
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          setPesan({
            tipe: 'error',
            teks: 'Gagal mendaftar: ' + error.message,
          });
          setLoading(false);
          return;
        }

        if (data?.session) {
          try {
            localStorage.setItem('keuanganku_auth', '1');
            localStorage.removeItem('keuanganku_demo');
          } catch {
            // ignore
          }

          document.cookie = 'keuanganku_demo=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
          document.cookie = 'keuanganku_auth=1; path=/; max-age=2592000; SameSite=None; Secure';
          
          window.location.replace('/ringkasan');
          return;
        } else {
          setPesan({
            tipe: 'sukses',
            teks: 'Pendaftaran berhasil dikirim! Silakan periksa inbox/spam email Anda untuk verifikasi jika konfirmasi email aktif di Supabase, lalu coba Masuk.',
          });
          setMode('masuk');
          setLoading(false);
        }
      } catch (err: unknown) {
        setPesan({
          tipe: 'error',
          teks: err instanceof Error ? err.message : 'Gagal membuat akun.',
        });
        setLoading(false);
      }
    }
  }

  // Masuk menggunakan database demo / sample
  function masukModeDemo() {
    try {
      localStorage.setItem('keuanganku_demo', '1');
      localStorage.removeItem('keuanganku_auth');
    } catch {
      // ignore
    }
    document.cookie = 'keuanganku_demo=1; path=/; max-age=2592000; SameSite=None; Secure';
    window.location.replace('/ringkasan');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/80 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/80 p-6 sm:p-7"
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
            <Wallet size={20} strokeWidth={2.3} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
              KeuanganKu
              <Sparkles size={14} className="text-amber-500" />
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">Manajemen Keuangan Pribadi & Usaha</p>
          </div>
        </div>

        {/* Tab Masuk / Daftar */}
        <div className="flex bg-slate-100 p-1 rounded-xl my-5 border border-slate-200/60">
          <button
            type="button"
            onClick={() => {
              setMode('masuk');
              setPesan(null);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'masuk' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('daftar');
              setPesan(null);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'daftar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Daftar Akun
          </button>
        </div>

        {/* Notifikasi Pesan */}
        {pesan && (
          <div
            className={`text-xs p-3 rounded-xl border mb-4 flex items-start gap-2 ${
              pesan.tipe === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            {pesan.tipe === 'error' ? (
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            )}
            <div className="leading-relaxed">{pesan.teks}</div>
          </div>
        )}

        {/* Form Login / Signup Supabase */}
        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-700">Email Database Supabase</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="mt-1 w-full rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 px-3.5 py-2 text-xs transition outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="mt-1 w-full rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 px-3.5 py-2 text-xs transition outline-none"
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.96 }}
            type="submit"
            disabled={loading}
            className="w-full mt-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold py-2.5 shadow-sm shadow-sky-600/20 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <span>Memproses...</span>
            ) : mode === 'masuk' ? (
              <>
                <LogIn size={15} strokeWidth={2.4} />
                <span>Masuk ke Database Saya</span>
              </>
            ) : (
              <>
                <UserPlus size={15} strokeWidth={2.4} />
                <span>Daftar Akun Baru</span>
              </>
            )}
          </motion.button>
        </form>

        {/* Pemisah */}
        <div className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-2 text-[10px] text-slate-400 uppercase font-semibold">atau coba</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* Tombol Masuk Mode Demo */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-center">
          <div className="text-xs font-semibold text-slate-700 mb-1">Preview / Uji Coba Cepat</div>
          <p className="text-[11px] text-slate-400 mb-3">
            Gunakan data sample tanpa perlu login ke akun database Supabase Anda.
          </p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={masukModeDemo}
            className="w-full bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>Masuk Mode Sample (Demo)</span>
            <ArrowRight size={13} />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
