import { createBrowserClient } from '@supabase/ssr';

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;
let browserClient: BrowserSupabaseClient | null = null;

export function createClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase environment variables are not configured.');

  // Keep one browser client per app bundle so all components share one auth
  // storage subscription and one Navigator LockManager lock.
  browserClient = createBrowserClient(url, key);
  return browserClient;
}
