import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';

const assignSchema = z.object({
  organization_id: z.string().uuid(),
  head_name: z.string().trim().min(2).max(120),
  head_email: z.string().trim().email().max(254)
}).strict();

async function requirePlatformAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { supabase, ok: false as const };
  const { data, error } = await supabase.rpc('platform_is_admin');
  if (error || data !== true) return { supabase, ok: false as const };
  return { supabase, ok: true as const };
}

export async function POST(request: NextRequest) {
  const { supabase, ok } = await requirePlatformAdmin();
  if (!ok) return jsonError('Platform Super Admin access with MFA is required.', 403);

  const protection = await protectMutation(request, supabase, 'admin:user-update', 10, 3600);
  if (protection) return protection;

  const parsed = assignSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Enter a valid HOD name and email.');

  const { data: session, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session.session?.access_token) return jsonError('Your session expired. Sign in again.', 401);

  const { data, error } = await supabase.functions.invoke('create-college-workspace', {
    body: {
      organization_id: parsed.data.organization_id,
      head_name: parsed.data.head_name,
      head_email: parsed.data.head_email.toLowerCase()
    },
    headers: {
      Authorization: 'Bearer ' + session.session.access_token,
      'x-app-base-url': request.nextUrl.origin
    }
  });

  if (error) {
    const functionResponse = (error as { context?: unknown }).context;
    if (functionResponse instanceof Response) {
      const failure = await functionResponse.clone().json().catch(() => null) as { error?: unknown } | null;
      const message = typeof failure?.error === 'string' ? failure.error : 'The HOD invitation request failed.';
      const status = functionResponse.status >= 400 && functionResponse.status <= 599 ? functionResponse.status : 503;
      return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
    return jsonError('The HOD invitation service could not be reached. Please retry.', 503);
  }

  if (!data) return jsonError('The HOD invitation service returned no response. Please retry.', 502);
  if (data.error) return NextResponse.json({ error: data.error }, { status: 409, headers: { 'Cache-Control': 'no-store' } });

  return NextResponse.json(data, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(request: NextRequest) {
  const { supabase, ok } = await requirePlatformAdmin();
  if (!ok) return jsonError('Platform Super Admin access with MFA is required.', 403);

  const protection = await protectMutation(request, supabase, 'admin:user-update', 10, 3600);
  if (protection) return protection;

  const parsed = z.object({ organization_id: z.string().uuid() }).strict()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Select a valid college HOD account.');

  const { error } = await supabase.rpc('platform_remove_organization_head', {
    p_organization_id: parsed.data.organization_id
  });
  if (error?.code === 'P0002') return jsonError('HOD account or college workspace was not found.', 404);
  if (error?.code === '42501') return jsonError('This HOD account is protected or Platform Super Admin MFA is required.', 403);
  if (error) return jsonError('HOD access could not be removed.', 500);

  return NextResponse.json({
    success: true,
    removed: true,
    note: 'HOD sign-in access has been disabled. The college is awaiting a replacement HOD; historical records remain intact.'
  }, { headers: { 'Cache-Control': 'no-store' } });
}
