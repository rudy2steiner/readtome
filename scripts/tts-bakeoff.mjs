/**
 * Runs the same English and Chinese passage through several Atlas Cloud TTS models,
 * records latency and cost, and writes a blind A/B listening page.
 *
 *   node scripts/tts-bakeoff.mjs
 *
 * Reads ATLASCLOUD_API_KEY from the environment or .dev.vars.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'prototypes', 'bakeoff');
const SUBMIT = 'https://api.atlascloud.ai/api/v1/model/generateAudio';
const PREDICTION = 'https://api.atlascloud.ai/api/v1/model/prediction';

function apiKey() {
  if (process.env.ATLASCLOUD_API_KEY) return process.env.ATLASCLOUD_API_KEY;
  const match = readFileSync(join(ROOT, '.dev.vars'), 'utf8').match(/ATLASCLOUD_API_KEY=(.+)/);
  if (!match) throw new Error('ATLASCLOUD_API_KEY not found in env or .dev.vars');
  return match[1].trim();
}

const KEY = apiKey();

const PASSAGES = {
  en: {
    label: 'English article',
    text:
      'The habit started on a Tuesday. She loaded a 40-page report into the reader, pressed play, ' +
      'and went to make coffee. By the time the kettle boiled she was three pages in, and the part ' +
      'she had been dreading — a dense section on Q3 forecasting — turned out to be almost pleasant ' +
      'when someone else was doing the reading. Dr. Alvarez, who studies reading fatigue, says this ' +
      'is not laziness: listening moves the work to a different part of the brain, which is why people ' +
      'finish documents they would otherwise abandon halfway through.',
  },
  zh: {
    label: '中文段落',
    text:
      '这个习惯是从一个周二开始的。她把一份四十页的报告放进阅读器，按下播放，然后去煮咖啡。' +
      '等水烧开的时候，她已经听完了三页，而那段她一直不想面对的第三季度预测分析，' +
      '在别人替她读出来的时候，居然还挺舒服。研究阅读疲劳的学者说，这不是偷懒：' +
      '听会把这份工作交给大脑的另一个区域，所以人们能听完那些原本会半途放弃的文档。',
  },
};

/** Atlas list prices per 1K characters, read from the model catalog on 2026-09-18. */
const CONTENDERS = [
  {
    id: 'xai',
    model: 'xai/tts-v1',
    voice: 'eve',
    pricePer1k: 0.015,
    role: 'Natural candidate',
    payload: (text) => ({
      model: 'xai/tts-v1',
      text,
      language: 'auto',
      voice_id: 'eve',
      codec: 'mp3',
      sample_rate: 24000,
      bit_rate: 128000,
      speed: 1,
      text_normalization: true,
      optimize_streaming_latency: 0,
    }),
  },
  {
    id: 'gemini',
    model: 'google/gemini-2.5-flash-tts',
    voice: 'Kore',
    pricePer1k: 0.04,
    role: 'Middle option',
    payload: (text) => ({ model: 'google/gemini-2.5-flash-tts', text, voice: 'Kore' }),
  },
  {
    id: 'minimax',
    model: 'minimax/speech-2.6-turbo',
    voice: 'English_expressive_narrator',
    pricePer1k: 0.048,
    role: 'Current Expressive pick',
    payload: (text, lang) => ({
      model: 'minimax/speech-2.6-turbo',
      text,
      voice: 'English_expressive_narrator',
      speed: 1,
      vol: 1,
      pitch: 0,
      emotion: 'auto',
      language_boost: lang === 'zh' ? 'Chinese' : 'English',
      format: 'mp3',
      sample_rate: 32000,
    }),
  },
  {
    id: 'elevenlabs',
    model: 'elevenlabs/v3/text-to-speech',
    voice: 'EXAVITQu4vr4xnSDxMaL',
    pricePer1k: 0.1,
    role: 'Quality ceiling reference',
    payload: (text) => ({
      model: 'elevenlabs/v3/text-to-speech',
      text,
      voice: 'EXAVITQu4vr4xnSDxMaL',
      stability: 0.5,
      apply_text_normalization: 'auto',
    }),
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function synthesize(contender, langKey, text) {
  const started = Date.now();
  const response = await fetch(SUBMIT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(contender.payload(text, langKey)),
  });
  const submitMs = Date.now() - started;
  const body = await response.json();
  if (!response.ok || !body?.data?.id) {
    return { error: body?.message || `HTTP ${response.status}`, submitMs };
  }

  const id = body.data.id;
  let status = body.data.status;
  let audioUrl = body.data.outputs?.[0];
  let last = body.data;

  while (!audioUrl && !['failed', 'timeout'].includes(status)) {
    if (Date.now() - started > 120_000) return { error: 'poll timeout after 120s', submitMs };
    await sleep(400);
    const poll = await fetch(`${PREDICTION}/${id}`, { headers: { Authorization: `Bearer ${KEY}` } });
    last = (await poll.json())?.data ?? {};
    status = last.status;
    audioUrl = last.outputs?.[0];
  }

  if (!audioUrl) return { error: last.error || `status=${status}`, submitMs };

  const audio = Buffer.from(await (await fetch(audioUrl)).arrayBuffer());
  const file = `${contender.id}-${langKey}.mp3`;
  writeFileSync(join(OUT_DIR, file), audio);

  return {
    file,
    submitMs,
    totalMs: Date.now() - started,
    inferenceMs: last.timings?.inference ?? null,
    bytes: audio.length,
    chars: text.length,
    cost: (text.length / 1000) * contender.pricePer1k,
  };
}

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderPage(results) {
  const blocks = Object.entries(PASSAGES)
    .map(([langKey, passage]) => {
      const rows = shuffled(results.filter((r) => r.langKey === langKey && r.file))
        .map((r, i) => {
          const blindLabel = String.fromCharCode(65 + i);
          return `
      <div class="entry">
        <div class="blind">${blindLabel}</div>
        <audio controls preload="none" src="${r.file}"></audio>
        <div class="reveal" hidden>
          <strong>${r.model}</strong> · ${r.voice} · $${r.pricePer1k.toFixed(3)}/1K chars
          · first byte ${r.submitMs}ms · complete ${r.totalMs}ms
          · this clip cost $${r.cost.toFixed(4)}
          <div class="role">${r.role}</div>
        </div>
      </div>`;
        })
        .join('');

      return `
  <section>
    <h2>${passage.label} <span class="chars">${passage.text.length} chars</span></h2>
    <p class="passage">${passage.text}</p>
    ${rows}
  </section>`;
    })
    .join('');

  const failures = results.filter((r) => r.error);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TTS bake-off — Read To Me</title>
<style>
  body { font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 820px; margin: 0 auto; padding: 32px 20px 80px; color: #0f172a; }
  h1 { font-size: 26px; margin-bottom: 4px; }
  .lede { color: #64748b; margin-top: 0; }
  section { margin-top: 36px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  h2 { font-size: 18px; display: flex; align-items: baseline; gap: 10px; }
  .chars { font-size: 12px; font-weight: 400; color: #94a3b8; }
  .passage { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; font-size: 14px; color: #475569; }
  .entry { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 10px 0; border-bottom: 1px dashed #e8edf4; }
  .blind { width: 34px; height: 34px; border-radius: 50%; background: #0f172a; color: #fff; display: grid; place-items: center; font-weight: 700; flex: none; }
  audio { height: 34px; }
  .reveal { font-size: 13px; color: #334155; flex: 1 1 320px; }
  .role { color: #94a3b8; font-size: 12px; }
  button { background: #0f172a; color: #fff; border: 0; border-radius: 8px; padding: 9px 16px; font-size: 14px; cursor: pointer; }
  .fail { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 10px; padding: 12px 14px; font-size: 13px; }
</style>
</head>
<body>
<h1>TTS bake-off</h1>
<p class="lede">Same passage, four Atlas Cloud models, order randomized per section. Listen first, reveal after.</p>
<button id="toggle">Reveal models and prices</button>
${failures.length ? `<div class="fail">Failed: ${failures.map((f) => `${f.model} (${f.langKey}) — ${f.error}`).join('; ')}</div>` : ''}
${blocks}
<script>
  document.getElementById('toggle').addEventListener('click', function () {
    var hidden = document.querySelector('.reveal').hidden;
    document.querySelectorAll('.reveal').forEach(function (el) { el.hidden = !hidden; });
    this.textContent = hidden ? 'Hide models and prices' : 'Reveal models and prices';
  });
</script>
</body>
</html>`;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const results = [];

  for (const [langKey, passage] of Object.entries(PASSAGES)) {
    for (const contender of CONTENDERS) {
      process.stdout.write(`${contender.model} [${langKey}] ... `);
      const outcome = await synthesize(contender, langKey, passage.text);
      console.log(outcome.error ? `FAILED: ${outcome.error}` : `${outcome.totalMs}ms, $${outcome.cost.toFixed(4)}`);
      results.push({
        langKey,
        model: contender.model,
        voice: contender.voice,
        pricePer1k: contender.pricePer1k,
        role: contender.role,
        ...outcome,
      });
    }
  }

  writeFileSync(join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 2));
  writeFileSync(join(OUT_DIR, 'index.html'), renderPage(results));

  const total = results.reduce((sum, r) => sum + (r.cost || 0), 0);
  console.log(`\nTotal spend: $${total.toFixed(4)}`);
  console.log(`Open: prototypes/bakeoff/index.html`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
