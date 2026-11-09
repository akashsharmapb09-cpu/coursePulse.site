import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';

async function platformAuth() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { supabase, ok: false as const };
  const { data, error } = await supabase.rpc('platform_is_admin');
  if (error || data !== true) return { supabase, ok: false as const };
  return { supabase, ok: true as const };
}

const updateSchema = z.object({
  organization_id: z.string().uuid(),
  status: z.enum(['SETUP_REQUIRED','ACTIVE','SUSPENDED']),
  subscription_status: z.enum(['UNCONFIGURED','PILOT','ACTIVE','PAST_DUE','CANCELLED'])
}).strict();

const createSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  head_name: z.string().trim().min(2).max(120),
  head_email: z.string().trim().email().max(254)
}).strict();

export async function GET() {
  const { supabase, ok } = await platformAuth();
  if (!ok) return jsonError('Platform owner access with MFA is required.', 403);
  const { data, error } = await supabase.rpc('platform_list_organizations');
  if (error) return jsonError('College tenant list could not be loaded.', 500);
  return NextResponse.json({ organizations: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const { supabase, ok } = await platformAuth();
  if (!ok) return jsonError('Platform owner access with MFA is required.', 403);
  const protection = await protectMutation(request, supabase, 'admin:user-update', 10, 3600);
  if (protection) return protection;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Enter valid college and first Head details.');

  const { data: session, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session.session?.access_token) return jsonError('Your session expired. Sign in again.', 401);

  const { data, error } = await supabase.functions.invoke('create-college-workspace', {
    body: {
      ...parsed.data,
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
      const message = typeof failure?.error === 'string'
        ? failure.error
        : 'The first Head invitation request failed.';
      const status = functionResponse.status >= 400 && functionResponse.status <= 599
        ? functionResponse.status
        : 503;
      return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
    return jsonError('The first Head invitation service could not be reached. Please retry.', 503);
  }
  if (!data) return jsonError('The first Head invitation service returned no response. Please retry.', 502);
  if (data.error) return NextResponse.json({ error: data.error }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(data, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest) {
  const { supabase, ok } = await platformAuth();
  if (!ok) return jsonError('Platform owner access with MFA is required.', 403);
  const protection = await protectMutation(request, supabase, 'admin:user-update', 30, 3600);
  if (protection) return protection;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid tenant update.');
  const { error } = await supabase.rpc('platform_update_organization', {
    p_organization_id: parsed.data.organization_id,
    p_status: parsed.data.status,
    p_subscription_status: parsed.data.subscription_status
  });
  if (error?.code === 'P0002') return jsonError('College workspace not found.', 404);
  if (error?.code === '42501') return jsonError('Platform owner MFA is required.', 403);
  if (error) return jsonError('College tenant update failed.', 500);
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}
