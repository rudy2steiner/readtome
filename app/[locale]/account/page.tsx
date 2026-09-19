import { unstable_setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AccountPage } from '@/components/billing/AccountPage';
import { isBillingEnabled } from '@/lib/config/features';

export default function AccountRoute({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  if (!isBillingEnabled) redirect('/');
  return <AccountPage />;
}
