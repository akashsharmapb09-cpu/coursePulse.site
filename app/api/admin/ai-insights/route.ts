import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, protectMutation } from '@/lib/http';

export const dynamic = 'force-dynamic';

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('College Head authentication with MFA is required.', 401);
  if (auth.profile.role !== 'ADMIN') return jsonError('College Head access is required.', 403);

  const month = request.nextUrl.searchParams.get('month') ?? '';
  if (!monthSchema.safeParse(month).success) return jsonError('Month must use YYYY-MM format.');

  const { data, error } = await supabase.from('monthly_ai_insights')
    .select('report_month,model,overall_summary,priorities,generated_at')
    .eq('report_month', month + '-01')
    .maybeSingle();
  if (error) return jsonError('AI insight archive could not be loaded.', 500);
  return NextResponse.json({ insight: data ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('College Head authentication with MFA is required.', 401);
  if (auth.profile.role !== 'ADMIN') return jsonError('College Head access is required.', 403);

  const protection = await protectMutation(request, supabase, 'analytics:query', 3, 3600);
  if (protection) return protection;

  const parsed = z.object({ month: monthSchema }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Month must use YYYY-MM format.');

  const { data: session, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session.session?.access_token) return jsonError('Your session expired. Sign in again.', 401);

  const { data, error } = await supabase.functions.invoke('generate-monthly-ai-insights', {
    body: { month: parsed.data.month },
    headers: { Authorization: 'Bearer ' + session.session.access_token }
  });
  if (error || !data) return jsonError('The AI insight service is unavailable.', 503);
  if (data.error) {
    const status = data.code === 'AI_PROVIDER_NOT_CONFIGURED' ? 503 : 409;
    return NextResponse.json({ error: data.error, code: data.code }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
