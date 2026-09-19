import { loggedFetch } from '@/lib/log/call';
import type { EngineId, PlaybackEvents, SegmentPlayer, SpeakRequest } from './engine';
import { DegradeError, degradeFor } from './errors';

type SpeakResponse =
  | { audio: string; format: string }
  | { taskId: string; token: string }
  | { error: DegradeError['code'] };

function decodeAudio(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function fail(code: DegradeError['code']): never {
  throw new DegradeError(code, degradeFor(code), code);
}

/**
 * Plays one chunk through <audio>. Synthesis is fetched from /api/tts/speak so the Worker can
 * return a task id instead of blocking on Atlas; this player polls until the mp3 arrives.
 */
export class CloudPlayer implements SegmentPlayer {
  readonly engine: EngineId;
  private audio: HTMLAudioElement | null = null;
  private buffers = new Map<string, ArrayBuffer>();
  private objectUrl: string | null = null;
  /** Drop onended/onerror from an element we already replaced or stopped. */
  private token = 0;

  constructor(engine: EngineId) {
    this.engine = engine;
  }

  async prepare(
    text: string,
    voiceId: string,
    signal: AbortSignal,
    listen?: { sourceText: string; partIndex: number },
  ): Promise<void> {
    const key = `${voiceId}:${text}`;
    if (this.buffers.has(key)) return;
    this.buffers.set(key, await this.fetchAudio(text, voiceId, signal, listen));
  }

  speak(request: SpeakRequest, events: PlaybackEvents): Promise<void> {
    return new Promise((resolve, reject) => {
      const key = `${request.voiceId}:${request.text}`;
      const token = (this.token += 1);
      const play = async () => {
        try {
          const buffer =
            this.buffers.get(key) ??
            (await this.fetchAudio(request.text, request.voiceId, undefined, {
              sourceText: request.sourceText || request.text,
              partIndex: request.partIndex ?? 0,
            }));
          if (this.token !== token) return;
          this.buffers.set(key, buffer);
          this.detachElement();

          const blob = new Blob([buffer], { type: 'audio/mpeg' });
          const url = URL.createObjectURL(blob);
          this.objectUrl = url;
          const audio = new Audio(url);
          this.audio = audio;
          audio.playbackRate = request.rate;

          audio.ontimeupdate = () => {
            if (this.token !== token || !audio.duration) return;
            const charIndex = Math.floor((audio.currentTime / audio.duration) * request.text.length);
            events.onWordBoundary?.(charIndex);
          };
          audio.onended = () => {
            if (this.token !== token) return;
            events.onSegmentEnd();
          };
          audio.onerror = () => {
            if (this.token !== token) return;
            const error = new DegradeError('supplier', 'browser', 'supplier');
            events.onError(error);
            reject(error);
          };
          await audio.play();
          if (this.token !== token) return;
          const reportDuration = () => {
            if (this.token !== token) return;
            const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
            if (duration) events.onDuration?.(duration);
          };
          if (Number.isFinite(audio.duration) && audio.duration > 0) reportDuration();
          else audio.onloadedmetadata = reportDuration;
          resolve();
        } catch (error) {
          if (this.token !== token) return;
          if (error instanceof DOMException && error.name === 'AbortError') return;
          const degrade = error instanceof DegradeError ? error : new DegradeError('supplier', 'browser', 'supplier');
          events.onError(degrade);
          reject(degrade);
        }
      };
      void play();
    });
  }

  pause(): void {
    this.audio?.pause();
  }

  resume(): void {
    void this.audio?.play();
  }

  stop(): void {
    this.token += 1;
    this.detachElement();
  }

  private detachElement(): void {
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.ontimeupdate = null;
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private async fetchAudio(
    text: string,
    voiceId: string,
    signal: AbortSignal | undefined,
    listen?: { sourceText: string; partIndex: number },
  ): Promise<ArrayBuffer> {
    const response = await loggedFetch('client.tts.speak', '/api/tts/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voiceId,
        sourceText: listen?.sourceText,
        partIndex: listen?.partIndex,
      }),
      signal,
    });
    const data = (await response.json()) as SpeakResponse;
    if ('error' in data && data.error) fail(data.error);
    if ('audio' in data && data.audio) return decodeAudio(data.audio);

    if (!('taskId' in data) || !data.taskId || !data.token) fail('supplier');
    return this.poll(data.taskId, data.token, signal);
  }

  private async poll(taskId: string, token: string, signal: AbortSignal | undefined): Promise<ArrayBuffer> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const response = await loggedFetch(`client.tts.task`, `/api/tts/task/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        signal,
      });
      const data = (await response.json()) as SpeakResponse & { pending?: boolean };
      if ('error' in data && data.error) fail(data.error);
      if ('audio' in data && data.audio) return decodeAudio(data.audio);
    }
    fail('supplier');
  }
}
