'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TRIAL_MINUTES } from '@/lib/billing/quota';
import { isAuthUiEnabled, isCheckoutEnabled } from '@/lib/config/features';
import { signInWithGoogle } from '@/lib/auth/google-sign-in';
import { loggedFetch } from '@/lib/log/call';
import { Link } from '@/lib/navigation';
import { cn } from '@/lib/utils';

type Cycle = 'yearly' | 'monthly';

const PLANS = {
  plus: { yearly: 7, monthly: 9, yearlyTotal: '$84', monthlyId: 'readtome-plus-monthly', yearlyId: 'readtome-plus-yearly' },
  pro: { yearly: 15, monthly: 19, yearlyTotal: '$180', monthlyId: 'readtome-pro-monthly', yearlyId: 'readtome-pro-yearly' },
} as const;

export function PricingPage() {
  const t = useTranslations('pricing');
  const { data: session } = useSession();
  const { toast } = useToast();
  const [cycle, setCycle] = useState<Cycle>('yearly');
  const [busy, setBusy] = useState<string | null>(null);

  const checkout = async (productId: string, pack = false) => {
    await loggedFetch('client.pricing.click', '/api/billing/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId }),
    }).catch(() => undefined);

    if (!isCheckoutEnabled) {
      toast({ description: t('comingSoon') });
      return;
    }

    if (!session?.user) {
      if (isAuthUiEnabled) {
        void signInWithGoogle('/pricing');
        return;
      }
      toast({ description: t('checkoutFailed') });
      return;
    }
    setBusy(productId);
    try {
      const response = await loggedFetch('client.checkout', '/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      });
      const data = (await response.json()) as { url?: string; upgraded?: boolean; error?: string };
      if (data.upgraded) {
        window.location.href = '/account?checkout=success';
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      toast({
        description:
          data.error === 'need_plan'
            ? t('packs.needPlan')
            : data.error === 'downgrade_not_allowed'
              ? t('downgradeDisabled')
              : data.error === 'stripe_not_configured' || data.error === 'billing_disabled'
                ? t('comingSoon')
                : t('checkoutFailed'),
      });
    } catch {
      toast({ description: t('checkoutFailed') });
    } finally {
      setBusy(null);
    }
    void pack;
  };

  return (
    <div className="pricing-page pb-16">
      <section className="mx-auto max-w-5xl px-4 pb-4 pt-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{t('subtitle')}</p>

        <div className="cycle" role="group">
          <button type="button" className={cn('cycle-btn', cycle === 'yearly' && 'is-on')} onClick={() => setCycle('yearly')}>
            <span>{t('yearly')}</span>
            <span className="cycle-save">{t('save')}</span>
          </button>
          <button type="button" className={cn('cycle-btn', cycle === 'monthly' && 'is-on')} onClick={() => setCycle('monthly')}>
            {t('monthly')}
          </button>
        </div>

        <div className="plan-grid">
          <article className="plan">
            <h3 className="plan-name">{t('free.name')}</h3>
            <p className="plan-tag">{t('free.tagline')}</p>
            <div className="price">
              <span className="price-cur">$</span>
              <span className="price-num">0</span>
            </div>
            <p className="price-note">{t('free.forever')}</p>
            <Link href="/reader" className="plan-cta btn-ghost">
              {t('free.cta')}
            </Link>
            <FeatureList keys={['free.f1', 'free.f2', 'free.f3', 'free.f4']} t={t} />
          </article>

          <PaidPlan
            featured
            name={t('plus.name')}
            tag={t('plus.tagline')}
            cta={t('plus.cta')}
            features={['plus.f1', 'plus.f2', 'plus.f3', 'plus.f4']}
            cycle={cycle}
            prices={PLANS.plus}
            busy={busy}
            onBuy={checkout}
            t={t}
          />
          <PaidPlan
            name={t('pro.name')}
            tag={t('pro.tagline')}
            cta={t('pro.cta')}
            features={['pro.f1', 'pro.f2', 'pro.f3']}
            cycle={cycle}
            prices={PLANS.pro}
            busy={busy}
            onBuy={checkout}
            t={t}
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-center text-3xl font-bold">{t('voices.title')}</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">{t('voices.subtitle')}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {(['basic', 'natural'] as const).map((kind) => (
            <article key={kind} className="rounded-2xl border bg-background p-6 text-left">
              <h3 className="font-semibold">{t(`voices.${kind}T`)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(`voices.${kind}D`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-8">
        <h2 className="text-center text-3xl font-bold">{t('packs.title')}</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">{t('packs.subtitle')}</p>
        <div className="mx-auto mt-8 max-w-xl">
          <PackCard
            title={t('packs.hours')}
            price="$15"
            productId="readtome-pack-10h"
            busy={busy}
            onBuy={checkout}
            t={t}
          />
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 py-10">
        <h2 className="text-xl font-semibold">{t('notes.title')}</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>{t('notes.n1')}</li>
          <li>{t('notes.n2')}</li>
          <li>{t('notes.n3')}</li>
          <li>{t('notes.n4')}</li>
        </ul>
      </section>
    </div>
  );
}

function FeatureList({ keys, t }: { keys: string[]; t: (key: string, values?: { minutes: number }) => string }) {
  return (
    <ul className="plan-feats">
      {keys.map((key) => (
        <li key={key}>
          <Check className="tick" />
          <span>{t(key, { minutes: TRIAL_MINUTES })}</span>
        </li>
      ))}
    </ul>
  );
}

function PaidPlan({
  featured,
  name,
  tag,
  cta,
  features,
  cycle,
  prices,
  busy,
  onBuy,
  t,
}: {
  featured?: boolean;
  name: string;
  tag: string;
  cta: string;
  features: string[];
  cycle: Cycle;
  prices: (typeof PLANS)['plus'];
  busy: string | null;
  onBuy: (id: string) => void;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  const amount = cycle === 'yearly' ? prices.yearly : prices.monthly;
  const productId = cycle === 'yearly' ? prices.yearlyId : prices.monthlyId;
  return (
    <article className={cn('plan', featured && 'is-featured')}>
      {featured && <span className="plan-flag">{t('popular')}</span>}
      <h3 className="plan-name">{name}</h3>
      <p className="plan-tag">{tag}</p>
      <div className="price">
        <span className="price-cur">$</span>
        <span className="price-num">{amount}</span>
        <span className="price-per">{t('perMonth')}</span>
      </div>
      <p className="price-note">
        {cycle === 'yearly' ? t('billedYearly', { amount: prices.yearlyTotal }) : t('billedMonthly')}
      </p>
      <button type="button" className={cn('plan-cta', featured ? 'btn-solid' : 'btn-ghost')} disabled={busy === productId} onClick={() => onBuy(productId)}>
        {cta}
      </button>
      <FeatureList keys={features} t={t} />
    </article>
  );
}

function PackCard({
  title,
  price,
  productId,
  busy,
  onBuy,
  t,
}: {
  title: string;
  price: string;
  productId: string;
  busy: string | null;
  onBuy: (id: string, pack?: boolean) => void;
  t: (key: string) => string;
}) {
  return (
    <article className="flex items-center justify-between gap-4 rounded-2xl border p-5 text-left">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-2xl font-bold">{price}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t('packs.rule')}</p>
      </div>
      <button type="button" className="btn-ghost shrink-0 px-4 py-2" disabled={busy === productId} onClick={() => onBuy(productId, true)}>
        {t('packs.buy')}
      </button>
    </article>
  );
}
