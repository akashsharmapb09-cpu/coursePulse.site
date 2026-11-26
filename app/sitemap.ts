import type { MetadataRoute } from 'next';
export default function sitemap():MetadataRoute.Sitemap{
 const base=process.env.NEXT_PUBLIC_APP_URL||'https://coursepulse-site.vercel.app';
 const routes=['/about','/features','/privacy','/terms','/support'];
 return [{url:base,lastModified:new Date(),changeFrequency:'weekly',priority:1},...routes.map(route=>({url:new URL(route,base).toString(),lastModified:new Date(),changeFrequency:'monthly' as const,priority:0.6}))];
}
