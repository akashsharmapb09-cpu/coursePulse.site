import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CoursePulse',
    short_name: 'CoursePulse',
    description: 'A simple college project for anonymous course feedback and course-level results. No login or role setup required.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7faf7',
    theme_color: '#245b3e',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
    ]
  };
}
