import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';

const profileInput = z.object({
  full_name: z.string().trim().min(2).max(100)
}).strict();

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('Unauthorized', 401);

  const protection = await protectMutation(request, supabase, 'account:profile-update', 10, 3600);
  if (protection) return protection;

  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonError('Invalid JSON body.'); }

  const parsed = profileInput.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid profile details.');

  const fullName = parsed.data.full_name;
  const { data, error } = await supabase
    .from('users')
    .update({ full_name: fullName })
    .eq('id', auth.user.id)
    .select('id,full_name')
    .single();

  if (error || !data) return jsonError('Profile could not be updated.', 403);

  return NextResponse.json(
    { profile: data },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
