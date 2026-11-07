import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const configured = process.env.NEXT_PUBLIC_APP_URL || 'https://coursepulse-site.vercel.app';
  const origin = configured.endsWith('/') ? configured.slice(0, -1) : configured;
  const routes = ['', '/features', '/about', '/privacy', '/terms', '/contact', '/support', '/refund-policy'];
  return routes.map(route => ({ url: `${origin}${route}`, changeFrequency: route === '' ? 'weekly' : 'monthly', priority: route === '' ? 1 : 0.6 }));
}
