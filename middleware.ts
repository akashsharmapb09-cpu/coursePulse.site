import { NextResponse, type NextRequest } from 'next/server';
import { buildContentSecurityPolicy } from '@/lib/security-csp';

export function middleware(request:NextRequest){
  const nonce=btoa(crypto.randomUUID());
  const csp=buildContentSecurityPolicy(nonce);
  const requestHeaders=new Headers(request.headers);
  requestHeaders.set('x-nonce',nonce);
  requestHeaders.set('Content-Security-Policy',csp);
  const pathname=request.nextUrl.pathname;
  let response:NextResponse;
  if(/^\/(?:login|signup|admin|super-admin|auth|verify)(?:\/|$)/.test(pathname)){
    const destination=request.nextUrl.clone();
    destination.pathname='/dashboard';
    destination.search='';
    response=NextResponse.redirect(destination);
  }else if(/^\/api(?:\/|$)/.test(pathname)){
    response=NextResponse.json({error:'The public college demo does not use authenticated API routes.'},{status:410});
  }else{
    response=NextResponse.next({request:{headers:requestHeaders}});
  }
  response.headers.set('Content-Security-Policy',csp);
  return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']};
