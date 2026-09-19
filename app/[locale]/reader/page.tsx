import { Metadata } from 'next';
import { getTranslations, unstable_setRequestLocale } from 'next-intl/server';

import { Reader } from '@/components/reader/Reader';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'meta' });
  return { title: t('readTitle'), description: t('readDescription') };
}

export default async function ReaderPage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'reader' });

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6 max-w-2xl">
          <h1 className="mb-2 text-3xl font-bold">{t('heading')}</h1>
          <p className="text-muted-foreground">{t('sub')}</p>
        </div>
        <Reader />
      </div>
    </main>
  );
}
