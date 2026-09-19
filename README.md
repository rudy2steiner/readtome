# Read to me

A Next.js 14 (App Router) app, deployed to **Cloudflare Workers** via [OpenNext](https://opennext.js.org/cloudflare).

## Local development

```bash
npm install
npm run dev
```

This runs the standard Next.js dev server (`next dev`). The Cloudflare bindings/runtime are
initialized for dev automatically via `initOpenNextCloudflareForDev()` in `next.config.js`.

## Preview on the Workers runtime

Builds the worker with OpenNext and serves it locally using `workerd` (the real Workers runtime):

```bash
npm run preview
```

## Deploy to Cloudflare Workers

```bash
# first time only: authenticate wrangler
npx wrangler login

# staging: workers.dev  →  https://read-to-me-dev.<account>.workers.dev
npm run deploy:dev

# Stripe test Worker  →  https://read-to-me-test.<account>.workers.dev
npm run deploy:test

# production Worker `read-to-me`
npm run deploy
```

`deploy:test` reads `.env.test` (copy from `.env.test.example`, Stripe `sk_test_`). `deploy:dev` / `deploy`
inline `.env.local`. After the first deploy, push secrets:

```bash
npm run secrets:dev    # Worker `read-to-me-dev`
npm run secrets:test   # Worker `read-to-me-test` (from `.env.test`)
npm run secrets        # production Worker `read-to-me` (use sk_live_ keys)
```

Only `AUTH_*` (except `AUTH_TRUST_HOST`), Stripe, Atlas, and `ADMIN_EMAILS` are uploaded. Empty keys and `NEXT_PUBLIC_*` are skipped.

Google OAuth redirects:

`https://read-to-me-dev.<account>.workers.dev/api/auth/callback/google`  
`https://read-to-me-test.<account>.workers.dev/api/auth/callback/google`

Stripe webhook for the test Worker:

`https://read-to-me-test.<account>.workers.dev/api/stripe/webhook`

## Configuration

- `wrangler.jsonc` — Worker name, entrypoint (`.open-next/worker.js`), static assets, R2
  audio cache, D1 (`DB` → `readtome`), and compatibility flags (`nodejs_compat`).
- `open-next.config.ts` — OpenNext/Cloudflare adapter config (caching, etc.).
- Regenerate typed bindings after editing `wrangler.jsonc`: `npm run cf-typegen`.

### Environment variables / secrets

Copy `.env.example` to `.env.local` for `next dev`. For `npm run preview`, copy
`.dev.vars.example` to `.dev.vars` (gitignored). Stripe test keys go in `.env.test`.
Upload Worker secrets:

```bash
npm run secrets:dev    # from `.env.local`
npm run secrets:test   # from `.env.test`
npm run secrets        # from `.env.local` → production
```

| Variable / binding | Used for |
| --- | --- |
| `NEXT_PUBLIC_BILLING_ENABLED=true` | Pricing, cloud voices, `/api/tts/speak` |
| `NEXT_PUBLIC_AUTH_ENABLED=true` | Sign-in button in the nav |
| `NEXT_PUBLIC_CHECKOUT_ENABLED=true` | Stripe checkout for Plus/Pro/packs; off shows “Coming soon” |
| `NEXT_PUBLIC_WEB_URL` | Checkout success/cancel and portal return (defaults to the request origin) |
| `NEXT_PUBLIC_TRIAL_MINUTES=10` | Cloud minutes granted on first sign-in (new users only) |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google login (`/auth/signin`) |
| `ADMIN_EMAILS` | Comma-separated Google emails that see the Admin tab |
| D1 binding `DB` (`readtome`) | `users` / `orders` / `usage` / `packs` / `listens` / `pricing_clicks` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Checkout, Customer Portal, `POST /api/stripe/webhook` |
| `ATLASCLOUD_API_KEY` | Cloud TTS via Atlas (`xai/tts-v1`) |

Auth, billing and cloud TTS all stay dormant when their keys are missing: the free browser reader
keeps working. After Stripe keys exist, the first checkout creates Prices with those
lookup keys and the webhook at `/api/stripe/webhook` marks orders paid. Apply the D1
schema with `npm run db:migrate:local` (dev) and `npm run db:migrate` (remote).

## Official launch

`npm run deploy` bakes `.env.local` into the Worker. Checkout return URLs ignore a
localhost `NEXT_PUBLIC_WEB_URL` when the request is on `https://www.read-to-me.org`.

Local Stripe keys are **test** (`sk_test_…`). Live charges need `sk_live_…` and a
Dashboard webhook secret for the production endpoint before you run `npm run secrets`.

```
NEXT_PUBLIC_BILLING_ENABLED=true
NEXT_PUBLIC_AUTH_ENABLED=true
NEXT_PUBLIC_CHECKOUT_ENABLED=true
NEXT_PUBLIC_WEB_URL=https://www.read-to-me.org
NEXT_PUBLIC_TRIAL_MINUTES=10
```

1. In Google Cloud, add production OAuth origins and redirects:
   - `https://www.read-to-me.org`
   - `https://read-to-me.org`
   - `https://www.read-to-me.org/api/auth/callback/google`
   - `https://read-to-me.org/api/auth/callback/google`
2. In Stripe **live** mode, put `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in
   `.env.local`, with a webhook at `https://www.read-to-me.org/api/stripe/webhook`
   for `checkout.session.completed`, `invoice.paid`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
   First live checkout creates Prices with lookup keys `readtome-plus-monthly` /
   `yearly`, `readtome-pro-monthly` / `yearly`, `readtome-pack-10h`.
3. Apply remote D1 (idempotent): `npm run db:migrate`
4. Push secrets (Stripe + Auth + `ADMIN_EMAILS`): `npm run secrets`
5. In Cloudflare, point `read-to-me.org` / `www` at Worker `read-to-me`
6. Deploy: `npm run deploy`
7. Smoke: home, `/reader`, Google sign-in, `/pricing` → Stripe Checkout,
   `/account` usage (plan + pack expiry) + billing + Admin
