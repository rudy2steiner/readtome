import type { MetadataRoute } from 'next';
import { defaultLocale, locales } from '@/app/i18n/config';

const BASE = 'https://www.read-to-me.org';
const PAGES = ['', '/reader', '/pricing'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) =>
    PAGES.map((page) => ({
      url: locale === defaultLocale ? `${BASE}${page || '/'}` : `${BASE}/${locale}${page}`,
      changeFrequency: 'weekly' as const,
      priority: page === '' ? 1 : 0.8,
    })),
  );
}
