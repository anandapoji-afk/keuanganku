import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Dipakai di Server Components, Server Actions, dan Route Handlers.
// Auth session dibaca/ditulis lewat cookie (padanan sesi login Google
// bawaan Apps Script — di sini digantikan Supabase Auth).
export async function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Dipanggil dari Server Component (bukan Action/Route Handler) —
            // aman diabaikan karena middleware yang akan me-refresh session.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // sama seperti di atas
          }
        },
      },
    }
  );
}

// Helper: ambil user yang sedang login, lempar error kalau belum login.
// Dipakai di awal setiap Server Action sebagai pengganti implicit
// "Session.getActiveUser()" di dunia Apps Script.
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Belum login.');
  return { supabase, user };
}
