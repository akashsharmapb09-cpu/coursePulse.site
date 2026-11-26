import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { buildContentSecurityPolicy } from '@/lib/security-csp';

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const pathname = request.nextUrl.pathname;
  if (/^\/(?:admin|super-admin|verify)(?:\/|$)/.test(pathname) || pathname === '/auth/reset' || pathname === '/auth/complete') {
    const destination = request.nextUrl.clone();
    destination.pathname = '/dashboard';
    destination.search = '';
    const redirect = NextResponse.redirect(destination);
    redirect.headers.set('Content-Security-Policy', csp);
    return redirect;
  }
  if (/^\/api(?:\/|$)/.test(pathname)) {
    const blocked = NextResponse.json({ error: 'The public college demo does not use authenticated API routes.' }, { status: 410 });
    blocked.headers.set('Content-Security-Policy', csp);
    return blocked;
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          requestHeaders.set('cookie', request.cookies.toString());
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    });

    // Validates the user and refreshes the session cookie when needed.
    await supabase.auth.getUser();
  }

  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
};
