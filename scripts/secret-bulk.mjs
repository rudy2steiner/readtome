#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const SECRET_KEYS = [
  'AUTH_SECRET',
  'AUTH_GOOGLE_ID',
  'AUTH_GOOGLE_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'ATLASCLOUD_API_KEY',
  'ADMIN_EMAILS',
];

const args = process.argv.slice(2);
const envFlag = args.includes('--env') ? args[args.indexOf('--env') + 1] : undefined;
const fileFlag = args.includes('--file') ? args[args.indexOf('--file') + 1] : undefined;
const source = fileFlag || ['.env.local', '.dev.vars'].find((path) => existsSync(path));

if (!source) {
  console.error('No .env.local or .dev.vars found. Pass --file <path>.');
  process.exit(1);
}

const parsed = new Map();
for (const line of readFileSync(source, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const cut = trimmed.indexOf('=');
  if (cut <= 0) continue;
  const key = trimmed.slice(0, cut).trim();
  let value = trimmed.slice(cut + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  parsed.set(key, value);
}

const pairs = SECRET_KEYS.flatMap((key) => {
  const value = parsed.get(key);
  return value ? [[key, value]] : [];
});

if (pairs.length === 0) {
  console.error(`No secret values in ${source}. Looked for: ${SECRET_KEYS.join(', ')}`);
  process.exit(1);
}

console.log(`Uploading ${pairs.length} secret(s) from ${source}${envFlag ? ` → env ${envFlag}` : ' → production'}: ${pairs.map(([key]) => key).join(', ')}`);

const body = Object.fromEntries(pairs);
const wranglerArgs = ['wrangler', 'secret', 'bulk', ...(envFlag ? ['--env', envFlag] : [])];
const child = spawn('npx', wranglerArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
child.stdin.write(JSON.stringify(body));
child.stdin.end();
child.on('exit', (code) => process.exit(code ?? 1));
