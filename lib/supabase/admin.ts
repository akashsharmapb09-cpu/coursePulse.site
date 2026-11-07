import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Supabase now recommends the modern secret key; legacy service_role remains supported.
  const elevatedKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !elevatedKey) {
    throw new Error('SUPABASE_SECRET_KEY is not configured on the server.');
  }

  return createClient(url, elevatedKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}
