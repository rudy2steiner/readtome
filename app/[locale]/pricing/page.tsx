import { Metadata } from 'next';
import { getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { PricingPage } from '@/components/billing/PricingPage';
import { isBillingEnabled } from '@/lib/config/features';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'pricing' });
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default function PricingRoute({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  if (!isBillingEnabled) redirect('/');
  return <PricingPage />;
}
