import { loggedFetch } from '@/lib/log/call';
import type { CloudEngineId, CloudSynthesisRequest, CloudTtsAdapter, SynthesisResult } from './engine';
import { PRICE_PER_1K_CHARS } from './engine';

const SUBMIT_URL = 'https://api.atlascloud.ai/api/v1/model/generateAudio';
const PREDICTION_URL = 'https://api.atlascloud.ai/api/v1/model/prediction';

/** Thrown when the server has no supplier key, so callers can degrade instead of leaking details. */
export class MissingCredentialsError extends Error {
  constructor() {
    super('Cloud voices are unavailable: ATLASCLOUD_API_KEY is not configured on the server.');
    this.name = 'MissingCredentialsError';
  }
}

export class SupplierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupplierError';
  }
}

function apiKey(): string {
  const key = process.env.ATLASCLOUD_API_KEY;
  if (!key) throw new MissingCredentialsError();
  return key;
}

type AtlasPrediction = {
  id?: string;
  status?: string;
  outputs?: string[];
  error?: string;
};

async function call(url: string, init: RequestInit): Promise<AtlasPrediction> {
  const response = await loggedFetch('atlas.prediction', url, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const body = (await response.json()) as { data?: AtlasPrediction; message?: string };
  if (!response.ok) throw new SupplierError(body?.message || `Atlas Cloud returned HTTP ${response.status}`);
  if (!body?.data) throw new SupplierError('Atlas Cloud returned no prediction');
  return body.data;
}

async function download(url: string): Promise<ArrayBuffer> {
  const response = await loggedFetch('atlas.audio', url);
  if (!response.ok) throw new SupplierError(`Could not fetch synthesized audio (HTTP ${response.status})`);
  return response.arrayBuffer();
}

/** Both engines submit-then-poll, so a finished prediction is resolved the same way for each. */
async function resolve(prediction: AtlasPrediction, chars: number): Promise<SynthesisResult> {
  const audioUrl = prediction.outputs?.[0];
  if (audioUrl) return { status: 'done', audio: await download(audioUrl), format: 'mp3', chars };

  if (prediction.status === 'failed' || prediction.status === 'timeout') {
    throw new SupplierError(prediction.error || `Synthesis ${prediction.status}`);
  }
  if (!prediction.id) throw new SupplierError('Atlas Cloud returned neither audio nor a task id');

  return { status: 'pending', taskId: prediction.id, chars };
}

function poll(taskId: string, chars: number): Promise<SynthesisResult> {
  return call(`${PREDICTION_URL}/${taskId}`, { method: 'GET' }).then((prediction) => resolve(prediction, chars));
}

/** xAI wants `voice_id` plus a BCP-47 language (or `auto`). */
function atlasAdapter(
  engine: CloudEngineId,
  maxCharsPerRequest: number,
  payloadFor: (request: CloudSynthesisRequest) => Record<string, unknown>,
): CloudTtsAdapter {
  return {
    engine,
    pricePer1kChars: PRICE_PER_1K_CHARS[engine],
    maxCharsPerRequest,
    async synthesize(request) {
      if (request.text.length > maxCharsPerRequest) {
        throw new SupplierError(`Text exceeds the ${maxCharsPerRequest}-character limit for ${engine} synthesis`);
      }
      const prediction = await call(SUBMIT_URL, { method: 'POST', body: JSON.stringify(payloadFor(request)) });
      return resolve(prediction, request.text.length);
    },
    poll(taskId) {
      return poll(taskId, 0);
    },
  };
}

export const naturalAdapter = atlasAdapter('natural', 15_000, (request) => ({
  model: 'xai/tts-v1',
  text: request.text,
  language: request.lang === 'multi' ? 'auto' : request.lang,
  voice_id: request.providerVoice,
  codec: 'mp3',
  sample_rate: 24_000,
  bit_rate: 64_000,
  /* Speed stays at 1: playback rate is applied client-side so one clip serves every speed. */
  speed: 1,
  text_normalization: true,
  optimize_streaming_latency: 2,
}));

export const CLOUD_ADAPTERS: Record<CloudEngineId, CloudTtsAdapter> = {
  natural: naturalAdapter,
};
