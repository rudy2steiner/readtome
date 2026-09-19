const CHARS_PER_MINUTE = { en: 1020, zh: 305 };

function secondsForChars(chars, lang) {
  return Math.max(1, Math.ceil((chars / CHARS_PER_MINUTE[lang]) * 60));
}

function creditSecondsFor(_engine, audioSeconds, _subscribed) {
  return audioSeconds;
}

function decideDraw(input) {
  if (input.need <= 0) return { ok: true, source: { kind: 'plan' } };
  if (input.planRemaining >= input.need) return { ok: true, source: { kind: 'plan' } };
  if (input.subscribed) {
    const pack = input.packs.find((item) => item.remaining >= input.need);
    if (pack) return { ok: true, source: { kind: 'pack', packUuid: pack.uuid } };
    return { ok: false, reason: 'quota_natural' };
  }
  if (input.trialRemaining >= input.need) return { ok: true, source: { kind: 'trial' } };
  return { ok: false, reason: input.trialRemaining > 0 ? 'quota_natural' : 'trial_exhausted' };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(secondsForChars(1020, 'en') === 60, '1020 English chars is one minute');
assert(secondsForChars(305, 'zh') === 60, '305 Chinese chars is one minute');
assert(secondsForChars(1020, 'en') === secondsForChars(305, 'zh'), 'same quota yields the same listening time');

assert(creditSecondsFor('natural', 60, true) === 60, 'cloud listening is 1×');
assert(creditSecondsFor('natural', 60, false) === 60, 'trial stays 1×');

const planFirst = decideDraw({
  engine: 'natural',
  subscribed: true,
  planRemaining: 120,
  packs: [{ uuid: 'old', remaining: 600 }],
  trialRemaining: 600,
  need: 40,
});
assert(planFirst.ok && planFirst.source.kind === 'plan', 'plan quota is drawn before packs');

const packNext = decideDraw({
  engine: 'natural',
  subscribed: true,
  planRemaining: 10,
  packs: [
    { uuid: 'old', remaining: 40 },
    { uuid: 'new', remaining: 600 },
  ],
  trialRemaining: 0,
  need: 40,
});
assert(packNext.ok && packNext.source.kind === 'pack' && packNext.source.packUuid === 'old', 'oldest covering pack wins');

const emptyPool = decideDraw({
  engine: 'natural',
  subscribed: true,
  planRemaining: 0,
  packs: [],
  trialRemaining: 0,
  need: 20,
});
assert(!emptyPool.ok && emptyPool.reason === 'quota_natural', 'empty shared pool falls back to the browser');

const trial = decideDraw({
  engine: 'natural',
  subscribed: false,
  planRemaining: 0,
  packs: [{ uuid: 'nat', remaining: 600 }],
  trialRemaining: 600,
  need: creditSecondsFor('natural', 30, false),
});
assert(trial.ok && trial.source.kind === 'trial', 'unsigned-up Free uses the one-off trial at 1×');

const exhausted = decideDraw({
  engine: 'natural',
  subscribed: false,
  planRemaining: 0,
  packs: [],
  trialRemaining: 0,
  need: 20,
});
assert(!exhausted.ok && exhausted.reason === 'trial_exhausted', 'used-up trial asks for a plan');

console.log('quota-check ok');
