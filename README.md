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

# production Worker `read-to-me`
npm run deploy
```

`deploy:dev` / `deploy` run `opennextjs-cloudflare build` then deploy. OpenNext inlines
`.env.local` at build time. After the first `deploy:dev`, push secrets from `.env.local` in one shot:

```bash
npm run secrets:dev    # Worker `read-to-me-dev`
npm run secrets        # production Worker `read-to-me`
```

Only `AUTH_*` (except `AUTH_TRUST_HOST`), Stripe, and `ATLASCLOUD_API_KEY` are uploaded. Empty keys and `NEXT_PUBLIC_*` are skipped.

Google OAuth redirect for the staging Worker:

`https://read-to-me-dev.<account>.workers.dev/api/auth/callback/google`

## Configuration

- `wrangler.jsonc` — Worker name, entrypoint (`.open-next/worker.js`), static assets, R2
  audio cache, D1 (`DB` → `readtome`), and compatibility flags (`nodejs_compat`).
- `open-next.config.ts` — OpenNext/Cloudflare adapter config (caching, etc.).
- Regenerate typed bindings after editing `wrangler.jsonc`: `npm run cf-typegen`.

### Environment variables / secrets

Copy `.env.example` to `.env.local` for `next dev`. For `npm run preview`, copy
`.dev.vars.example` to `.dev.vars` (gitignored). Upload Worker secrets from `.env.local`:

```bash
npm run secrets:dev
npm run secrets
```

| Variable / binding | Used for |
| --- | --- |
| `NEXT_PUBLIC_BILLING_ENABLED=true` | Pricing, cloud voices, `/api/tts/speak` |
| `NEXT_PUBLIC_AUTH_ENABLED=true` | Sign-in button in the nav |
| `NEXT_PUBLIC_CHECKOUT_ENABLED=true` | Stripe checkout for Plus/Pro/packs; off shows “Coming soon” |
| `NEXT_PUBLIC_TRIAL_MINUTES=10` | Cloud minutes granted on first sign-in (new users only) |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google login (`/auth/signin`) |
| `ADMIN_EMAILS` | Comma-separated Google emails that see the Admin tab |
| D1 binding `DB` (`readtome`) | `users` / `orders` / `usage` / `packs` / `listens` / `pricing_clicks` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Checkout, Customer Portal, `POST /api/stripe/webhook` |
| `ATLASCLOUD_API_KEY` | Cloud TTS via Atlas (`xai/tts-v1`) |

Auth, billing and cloud TTS all stay dormant when their keys are missing: the free browser reader
keeps working. After Google + Stripe exist, create the matching Stripe products
(`readtome-plus-monthly` / `yearly`, `readtome-pro-monthly` / `yearly`,
`readtome-pack-10h`) and point the webhook at
`/api/stripe/webhook`. Apply the D1 schema with `npm run db:migrate:local` (dev) and
`npm run db:migrate` (remote).

## Official launch

Ship with checkout **off** until Stripe is live. `npm run deploy` bakes `.env.local`
into the Worker, so that file must look like production before you build:

```
NEXT_PUBLIC_BILLING_ENABLED=true
NEXT_PUBLIC_AUTH_ENABLED=true
NEXT_PUBLIC_CHECKOUT_ENABLED=false
NEXT_PUBLIC_TRIAL_MINUTES=10
```

1. In Google Cloud, add production OAuth origins and redirects:
   - `https://www.read-to-me.org`
   - `https://read-to-me.org`
   - `https://www.read-to-me.org/api/auth/callback/google`
   - `https://read-to-me.org/api/auth/callback/google`
2. Apply remote D1 (idempotent): `npm run db:migrate`
3. Push secrets (includes `ADMIN_EMAILS`): `npm run secrets`
4. In Cloudflare, point `read-to-me.org` / `www` at Worker `read-to-me`
5. Deploy: `npm run deploy`
6. Smoke: home, `/reader`, `/pricing` (CTA records a click and says coming soon), Google sign-in, `/account` usage + Admin

Turn checkout on later by setting `NEXT_PUBLIC_CHECKOUT_ENABLED=true`, adding Stripe
products + webhook `https://www.read-to-me.org/api/stripe/webhook`, then rebuild and deploy.
