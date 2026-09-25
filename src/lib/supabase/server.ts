import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createMockSupabaseClient, DEMO_USER } from './mock';

// Dipakai di Server Components, Server Actions, dan Route Handlers.
// Auth session dibaca/ditulis lewat cookie (padanan sesi login Google
// bawaan Apps Script — di sini digantikan Supabase Auth).
export async function createClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return createMockSupabaseClient() as unknown as SupabaseClient;
  }

  const cookieStore = cookies();

  return createServerClient(
    url,
    key,
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
export async function requireUser(): Promise<{ supabase: SupabaseClient; user: User }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return {
      supabase: createMockSupabaseClient() as unknown as SupabaseClient,
      user: DEMO_USER as unknown as User,
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return { supabase, user };
  } catch {
    // ignore
  }

  return {
    supabase: createMockSupabaseClient() as unknown as SupabaseClient,
    user: DEMO_USER as unknown as User,
  };
}
