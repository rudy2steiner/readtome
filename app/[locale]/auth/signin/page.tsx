import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SignForm } from '@/components/auth/SignForm';
import { auth } from '@/lib/auth';
import { isAuthEnabled } from '@/lib/auth/config';
import { Link } from '@/lib/navigation';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  if (!isAuthEnabled()) redirect('/');

  const session = await auth();
  if (session) redirect(searchParams.callbackUrl || '/reader');

  const t = await getTranslations('auth');

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-6 bg-muted/40 p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <SignForm callbackUrl={searchParams.callbackUrl || '/reader'} />
        <Link href="/" className="text-center text-sm text-muted-foreground hover:text-foreground">
          {t('backHome')}
        </Link>
      </div>
    </div>
  );
}
