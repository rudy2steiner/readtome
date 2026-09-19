'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/lib/navigation';
import { locales, type Locale } from '@/app/i18n/config';

export function useLanguageSwitch() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale() as Locale;

  const switchLanguage = (newLocale: Locale) => {
    if (newLocale !== currentLocale) {
      router.replace(pathname, { locale: newLocale });
    }
  };

  return {
    currentLocale,
    switchLanguage,
    isValidLocale: (locale: string): locale is Locale => locales.includes(locale as Locale)
  };
}