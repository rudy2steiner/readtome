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

npm run deploy
```

`npm run deploy` runs `opennextjs-cloudflare build` and then `opennextjs-cloudflare deploy`.

## Configuration

- `wrangler.jsonc` — Worker name, entrypoint (`.open-next/worker.js`), static assets binding,
  and compatibility flags (`nodejs_compat`).
- `open-next.config.ts` — OpenNext/Cloudflare adapter config (caching, etc.).
- Regenerate typed bindings after editing `wrangler.jsonc`: `npm run cf-typegen`.

### Environment variables / secrets

For local Workers preview, put values in a `.dev.vars` file (gitignored). For production, set
them as secrets:

```bash
npx wrangler secret put MY_SECRET
```
