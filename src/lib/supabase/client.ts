'use client';

import { createBrowserClient } from '@supabase/ssr';
import { createMockSupabaseClient } from './mock';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return createMockSupabaseClient() as any;
  }

  return createBrowserClient(url, key);
}

