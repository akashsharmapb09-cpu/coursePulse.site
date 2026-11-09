import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/)
}).strict();

export async function GET() {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('College Head authentication with MFA is required.', 401);
  if (auth.profile.role !== 'ADMIN') return jsonError('College Head access is required.', 403);
  const { data, error } = await supabase.from('organizations')
    .select('id,name,slug,status,subscription_status').maybeSingle();
  if (error || !data) return jsonError('College workspace settings could not be loaded.', 500);
  return NextResponse.json({ organization: data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('College Head authentication with MFA is required.', 401);
  if (auth.profile.role !== 'ADMIN') return jsonError('College Head access is required.', 403);
  const protection = await protectMutation(request, supabase, 'admin:user-update', 10, 3600);
  if (protection) return protection;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Enter a valid college name and URL slug.');
  const { error } = await supabase.rpc('update_current_organization', {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug
  });
  if (error?.code === '23505') return jsonError('That college URL slug is already in use.', 409);
  if (error?.code === '42501') return jsonError('College Head MFA is required for this change.', 403);
  if (error) return jsonError('College workspace settings could not be saved.', 500);
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}
