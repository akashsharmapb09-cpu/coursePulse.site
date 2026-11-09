import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, jsonError, checkReadRateLimit } from '@/lib/http';

export const dynamic = 'force-dynamic';

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/).refine(value => {
  const [year, month] = value.split('-').map(Number);
  return year >= 2000 && month >= 1 && month <= 12;
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getCurrentUser(supabase);
  if (!auth) return jsonError('College Head administrator MFA is required.', 401);
  if (auth.profile.role !== 'ADMIN') return jsonError('College Head access is required.', 403);

  const rateLimit = await checkReadRateLimit(supabase, 'analytics:query', 30, 3600);
  if (rateLimit) return rateLimit;

  const requestedMonth = request.nextUrl.searchParams.get('month');
  if (requestedMonth && !monthSchema.safeParse(requestedMonth).success) return jsonError('Month must use YYYY-MM format.');
  const month = requestedMonth ?? new Date().toISOString().slice(0, 7);
  const reportMonth = month + '-01';

  const { data, error } = await supabase.from('monthly_academic_reports')
    .select('report_month,scope_type,scope_id,scope_label,response_count,average_rating,previous_average,rating_change,recommendation,generated_at')
    .eq('report_month', reportMonth)
    .order('scope_type', { ascending: true })
    .order('scope_label', { ascending: true })
    .limit(2000);

  if (error) return jsonError('Scheduled monthly archive could not be loaded.', 500);
  return NextResponse.json({ month, reports: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
