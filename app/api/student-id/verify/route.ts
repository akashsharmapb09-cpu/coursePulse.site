import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>).token : null;
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/i.test(token)) {
    return NextResponse.json({ valid: false }, {
      status: 400,
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
    });
  }

  const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('verify_student_card', { p_token_hash: tokenHash });
  if (error) {
    return NextResponse.json({ error: 'Card verification is temporarily unavailable.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
    });
  }
  const card = Array.isArray(data) ? data[0] : null;
  return NextResponse.json({ valid: Boolean(card), card: card ?? null }, {
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
  });
}
