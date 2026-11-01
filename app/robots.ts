import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://coursepulse-production.vercel.app';
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/dashboard', '/api/', '/auth/', '/login', '/signup'] }
    ],
    sitemap: new URL('/sitemap.xml', base).toString()
  };
}