import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: { optimizePackageImports: ['lucide-react'] },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        // X-XSS-Protection is obsolete; explicitly disable the legacy filter.
        // The nonce-based CSP is the active XSS mitigation for modern browsers.
        { key: 'X-XSS-Protection', value: '0' }
      ]
    }];
  }
};
export default nextConfig;
