#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const split = process.argv.indexOf('--');
const file = process.argv[2];
const command = split >= 0 ? process.argv.slice(split + 1) : process.argv.slice(3);

if (!file || command.length === 0) {
  console.error('Usage: node scripts/run-with-env.mjs <env-file> -- <command>…');
  process.exit(1);
}

if (!existsSync(file)) {
  console.error(`Missing ${file}. Copy .env.test.example to .env.test.`);
  process.exit(1);
}

const extra = {};
for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const cut = trimmed.indexOf('=');
  if (cut <= 0) continue;
  let value = trimmed.slice(cut + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  extra[trimmed.slice(0, cut).trim()] = value;
}

const child = spawn(command[0], command.slice(1), {
  stdio: 'inherit',
  env: { ...process.env, ...extra },
  shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 1));
