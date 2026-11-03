import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { buildContentSecurityPolicy } from '@/lib/security-csp';

export async function middleware(request: NextRequest) {
  // A fresh nonce is generated for each document/request and forwarded to
  // Next.js so framework-generated inline scripts receive the same nonce.
  const nonce = btoa(crypto.randomUUID());
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  const response = await updateSession(request, requestHeaders);
  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
