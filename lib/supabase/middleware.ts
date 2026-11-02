import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function updateSession(
  request: NextRequest,
  forwardedHeaders: Headers = new Headers(request.headers)
) {
  let response = NextResponse.next({ request: { headers: forwardedHeaders } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        forwardedHeaders.set('cookie', request.cookies.toString());
        response = NextResponse.next({ request: { headers: forwardedHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });
  await supabase.auth.getUser();
  return response;
}
