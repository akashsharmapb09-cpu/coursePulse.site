import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  if (request.nextUrl.pathname.startsWith('/api/') && mutating) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const fetchSite = request.headers.get('sec-fetch-site');
    if (fetchSite === 'cross-site') return NextResponse.json({ error: 'Cross-site request rejected.' }, { status: 403 });
    const source = origin || referer;
    if (source) {
      try {
        const sourceUrl = new URL(source);
        if (sourceUrl.host !== request.nextUrl.host || !['http:', 'https:'].includes(sourceUrl.protocol)) {
          return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
      }
    }
  }
  return updateSession(request);
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
