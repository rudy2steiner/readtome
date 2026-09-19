'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signInWithGoogle } from '@/lib/auth/google-sign-in';
import { loggedFetch } from '@/lib/log/call';
import { GoogleLogo } from './GoogleLogo';

export function SignForm({ callbackUrl = '/reader' }: { callbackUrl?: string }) {
  const t = useTranslations('auth');
  const [hasGoogle, setHasGoogle] = useState(true);

  useEffect(() => {
    let live = true;
    loggedFetch('client.auth.providers', '/api/auth/providers')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (live) setHasGoogle(Boolean(data && 'google' in data));
      })
      .catch(() => {
        if (live) setHasGoogle(false);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{t('signInTitle')}</CardTitle>
        <CardDescription>{t('signInSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        {hasGoogle ? (
          <Button variant="outline" className="w-full gap-2" onClick={() => void signInWithGoogle(callbackUrl)}>
            <GoogleLogo />
            {t('continueGoogle')}
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">{t('googleUnavailable')}</p>
        )}
      </CardContent>
    </Card>
  );
}
