import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
 const configured=process.env.NEXT_PUBLIC_APP_URL||'https://coursepulse-site.vercel.app'; const base=configured.endsWith('/')?configured.slice(0,-1):configured;
 return {rules:[{userAgent:'*',allow:['/','/features','/about','/privacy','/terms','/contact','/support','/refund-policy'],disallow:['/dashboard','/admin','/api/','/auth/','/login','/signup']}],sitemap:new URL('/sitemap.xml',base).toString()};
}
