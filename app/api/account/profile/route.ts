import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';

const profileInput = z.object({
  full_name: z.string().trim().min(2).max(100).optional(),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,29}$/).optional()
}).strict().refine(input => input.full_name !== undefined || input.username !== undefined);

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

  const { data, error } = await supabase
    .from('users')
    .update(parsed.data)
    .eq('id', auth.user.id)
    .select('id,full_name,username')
    .single();

  if (error?.code === '23505') return jsonError('That username is already in use. Choose another one.', 409);
  if (error || !data) return jsonError('Profile could not be updated.', 403);

  return NextResponse.json(
    { profile: data },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
