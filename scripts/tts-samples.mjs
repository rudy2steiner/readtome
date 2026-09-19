/**
 * Generates the voice sample clips used by the landing page demo row, plus a manifest.
 *
 *   node scripts/tts-samples.mjs
 *
 * Output: prototypes/samples/<voice>-<lang>.mp3 and prototypes/samples/samples.json
 * Reads ATLASCLOUD_API_KEY from the environment or .dev.vars.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'prototypes', 'samples');
const SUBMIT = 'https://api.atlascloud.ai/api/v1/model/generateAudio';
const PREDICTION = 'https://api.atlascloud.ai/api/v1/model/prediction';

function apiKey() {
  if (process.env.ATLASCLOUD_API_KEY) return process.env.ATLASCLOUD_API_KEY;
  const match = readFileSync(join(ROOT, '.dev.vars'), 'utf8').match(/ATLASCLOUD_API_KEY=(.+)/);
  if (!match) throw new Error('ATLASCLOUD_API_KEY not found in env or .dev.vars');
  return match[1].trim();
}

const KEY = apiKey();

/** One sentence per language, identical across voices so visitors can compare them. */
const COPY = {
  en: 'This is a real clip, not a mock-up. Paste an article, pick a voice, and Read to Me turns it into speech you can listen to anywhere.',
  zh: '这是一段真实合成的音频，不是演示占位。粘贴一篇文章，选一个音色，「为我朗读」就会把它念给你听。',
};

/**
 * Display names are the provider's own voice ids, capitalized. xAI publishes no personas for them
 * and inventing one would be making up a fact about a voice we do not control.
 */
const VOICES = [
  { id: 'eve', tier: 'natural', name: 'Eve' },
  { id: 'leo', tier: 'natural', name: 'Leo' },
  { id: 'rex', tier: 'natural', name: 'Rex' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function payloadFor(voice, lang) {
  return {
    model: 'xai/tts-v1',
    text: COPY[lang],
    language: lang,
    voice_id: voice.id,
    codec: 'mp3',
    sample_rate: 24000,
    bit_rate: 64000,
    speed: 1,
    text_normalization: true,
    optimize_streaming_latency: 0,
  };
}

async function generate(voice, lang) {
  const started = Date.now();
  const response = await fetch(SUBMIT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadFor(voice, lang)),
  });
  const body = await response.json();
  if (!response.ok || !body?.data?.id) throw new Error(body?.message || `HTTP ${response.status}`);

  let status = body.data.status;
  let audioUrl = body.data.outputs?.[0];

  while (!audioUrl && !['failed', 'timeout'].includes(status)) {
    if (Date.now() - started > 120_000) throw new Error('poll timeout');
    await sleep(400);
    const poll = await fetch(`${PREDICTION}/${body.data.id}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const data = (await poll.json())?.data ?? {};
    status = data.status;
    audioUrl = data.outputs?.[0];
  }
  if (!audioUrl) throw new Error(`status=${status}`);

  const audio = Buffer.from(await (await fetch(audioUrl)).arrayBuffer());
  const file = `${voice.tier}-${voice.id}-${lang}.mp3`;
  writeFileSync(join(OUT_DIR, file), audio);
  return { file, bytes: audio.length, ms: Date.now() - started };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const manifest = { copy: COPY, voices: [] };

  for (const voice of VOICES) {
    const entry = { name: voice.name, tier: voice.tier, clips: {} };
    for (const lang of Object.keys(COPY)) {
      process.stdout.write(`${voice.name} [${lang}] ... `);
      const result = await generate(voice, lang);
      console.log(`${Math.round(result.bytes / 1024)}KB in ${result.ms}ms`);
      entry.clips[lang] = result.file;
    }
    manifest.voices.push(entry);
  }

  writeFileSync(join(OUT_DIR, 'samples.json'), JSON.stringify(manifest, null, 2));
  console.log('\nWrote prototypes/samples/samples.json');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
