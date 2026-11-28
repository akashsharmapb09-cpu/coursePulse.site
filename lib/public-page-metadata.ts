import type { Metadata } from 'next';

type PublicPageMetadataOptions = {
  title: string;
  description: string;
  path: `/${string}`;
  robots?: Metadata['robots'];
};

export function createPublicPageMetadata({
  title,
  description,
  path,
  robots
}: PublicPageMetadataOptions): Metadata {
  const socialTitle = title.toLowerCase().includes('coursepulse')
    ? title
    : `${title} | CoursePulse`;

  return {
    title,
    description,
    alternates: { canonical: path },
    ...(robots ? { robots } : {}),
    openGraph: {
      type: 'website',
      url: path,
      siteName: 'CoursePulse',
      title: socialTitle,
      description,
      images: [{ url: '/opengraph-image', alt: socialTitle }]
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: ['/opengraph-image']
    }
  };
}
