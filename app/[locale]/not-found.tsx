import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';

export default async function NotFound() {
  const t = await getTranslations('error.notFound');

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <h2 className="text-2xl font-bold mb-4">{t('title')}</h2>
      <p className="text-muted-foreground mb-6">{t('description')}</p>
      <Link href="/" className="text-primary hover:underline">
        {t('returnHome')}
      </Link>
    </div>
  );
}
