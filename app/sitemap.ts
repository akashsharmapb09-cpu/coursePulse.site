import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
 const base=process.env.NEXT_PUBLIC_APP_URL||'https://coursepulse-site.vercel.app';
 return [{url:base,lastModified:new Date(),changeFrequency:'weekly',priority:1},{url:new URL('/about', base).toString(),lastModified:new Date(),changeFrequency:'yearly',priority:0.6},...['/features','/privacy','/terms','/support','/refund-policy'].map(route=>({url:new URL(route,base).toString(),lastModified:new Date(),changeFrequency:'monthly' as const,priority:0.6}))];
}
