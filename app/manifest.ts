import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CoursePulse',
    short_name: 'CoursePulse',
    description: 'Course feedback and aggregate learning analytics in one role-aware workspace.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7faf7',
    theme_color: '#245b3e',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
    ]
  };
}
