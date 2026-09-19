'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

import { Link, usePathname } from '@/lib/navigation';
import { LanguageSwitch } from '@/components/navigation/LanguageSwitch';
import { ThemeSwitch } from '@/components/navigation/ThemeSwitch';
import { AuthButton } from '@/components/auth/AuthButton';
import { isBillingEnabled } from '@/lib/config/features';
import { cn } from '@/lib/utils';

function navPath(pathname: string) {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function Navigation() {
  const t = useTranslations();
  const pathname = navPath(usePathname());
  const [hash, setHash] = useState('');

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [pathname]);

  const onHome = pathname === '/' && hash !== '#features' && hash !== '#faq';

  return (
    <nav className="site-nav">
      <div className="lp-wrap site-nav-inner">
        <Link
          href="/"
          className="brand"
          onClick={() => {
            if (pathname === '/' && hash) {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
              setHash('');
            }
          }}
        >
          <Image
            className="brand-mark"
            src="/brand/readtome-pulse-mark.svg"
            alt=""
            width={40}
            height={30}
            priority
          />
          <span className="brand-name">{t('common.title')}</span>
        </Link>

        <div className="site-nav-links">
          <Link
            href="/"
            className={cn('site-nav-link', onHome && 'is-active')}
            onClick={() => {
              if (pathname === '/' && hash) {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
                setHash('');
              }
            }}
          >
            {t('nav.home')}
          </Link>
          <Link href="/reader" className={cn('site-nav-link', pathname === '/reader' && 'is-active')}>
            {t('nav.reader')}
          </Link>
          <Link
            href="/#features"
            className={cn('site-nav-link site-nav-hash', pathname === '/' && hash === '#features' && 'is-active')}
            onClick={() => setHash('#features')}
          >
            {t('nav.features')}
          </Link>
          <Link
            href="/#faq"
            className={cn('site-nav-link site-nav-hash', pathname === '/' && hash === '#faq' && 'is-active')}
            onClick={() => setHash('#faq')}
          >
            {t('nav.faq')}
          </Link>
          {isBillingEnabled && (
            <Link href="/pricing" className={cn('site-nav-link', pathname === '/pricing' && 'is-active')}>
              {t('nav.pricing')}
            </Link>
          )}
          <span className="site-nav-div" />
          <ThemeSwitch />
          <LanguageSwitch />
          <AuthButton />
        </div>
      </div>
    </nav>
  );
}
