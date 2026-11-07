import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://coursepulse-site.vercel.app';
  const base = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  return { rules: [{ userAgent: '*', allow: ['/', '/features', '/about', '/privacy', '/terms', '/contact', '/support', '/refund-policy'], disallow: ['/dashboard', '/admin', '/api', '/auth', '/login'] }], sitemap: `${base}/sitemap.xml` };
}
