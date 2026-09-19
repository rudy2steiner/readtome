import { detectSpeechLang, secondsForChars } from '@/lib/billing/quota';
import { CHARS_PER_MINUTE, type PlaybackEvents, type SegmentPlayer, type SpeakRequest } from './engine';

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function listBrowserVoices(): SpeechSynthesisVoice[] {
  return speechSupported() ? window.speechSynthesis.getVoices() : [];
}

/** Voices load asynchronously in Chrome and Safari, so callers need to re-read them once. */
export function onVoicesChanged(listener: () => void): () => void {
  if (!speechSupported()) return () => undefined;
  window.speechSynthesis.addEventListener('voiceschanged', listener);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', listener);
}

/**
 * Wraps SpeechSynthesisUtterance behind the shared player interface. One utterance per chunk
 * keeps resume accurate: the engine restarts the current chunk at worst, never the document.
 */
export class BrowserPlayer implements SegmentPlayer {
  readonly engine = 'browser' as const;

  /**
   * `cancel()` fires end/error callbacks asynchronously, so a stopped utterance would otherwise
   * advance the queue after the user asked it to stop. Events from a stale token are dropped.
   */
  private token = 0;
  private clock: ReturnType<typeof setInterval> | null = null;
  private clockOrigin = 0;
  private clockChars = 0;
  private clockPaused = false;
  private charsPerMs = 0;

  speak(request: SpeakRequest, events: PlaybackEvents): Promise<void> {
    if (!speechSupported()) return Promise.reject(new Error('This browser has no speech synthesis.'));

    const synth = window.speechSynthesis;
    const token = (this.token += 1);
    this.clearClock();
    synth.cancel();

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(request.text);
      const voice = listBrowserVoices().find((candidate) => candidate.voiceURI === request.voiceId);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
      utterance.rate = request.rate;

      const cjk = /[\u4e00-\u9fff]/.test(request.text);
      this.charsPerMs = ((cjk ? CHARS_PER_MINUTE.zh : CHARS_PER_MINUTE.en) / 60_000) * request.rate;

      const tick = () => {
        if (this.token !== token || this.clockPaused) return;
        const charIndex = Math.min(
          request.text.length - 1,
          Math.floor(this.clockChars + (performance.now() - this.clockOrigin) * this.charsPerMs),
        );
        events.onWordBoundary?.(Math.max(0, charIndex));
      };

      utterance.onstart = () => {
        if (this.token !== token) return;
        this.clockOrigin = performance.now();
        this.clockChars = 0;
        this.clockPaused = false;
        this.clock = setInterval(tick, 80);
        events.onDuration?.(secondsForChars(request.text.length, detectSpeechLang(request.text)));
        resolve();
      };
      /*
       * Chrome's Chinese voices often never fire word boundaries. The clock keeps
       * sentence highlight moving; a real boundary just resyncs the estimate.
       */
      utterance.onboundary = (event) => {
        if (this.token !== token || this.clockPaused) return;
        if (event.name !== 'word' && event.name !== undefined) return;
        this.clockChars = event.charIndex;
        this.clockOrigin = performance.now();
        events.onWordBoundary?.(event.charIndex);
      };
      utterance.onend = () => {
        if (this.token !== token) return;
        this.clearClock();
        events.onSegmentEnd();
      };
      utterance.onerror = (event) => {
        if (this.token !== token || event.error === 'interrupted' || event.error === 'canceled') return;
        this.clearClock();
        const error = new Error(`Speech synthesis failed: ${event.error}`);
        events.onError(error);
        reject(error);
      };

      synth.speak(utterance);
    });
  }

  pause(): void {
    if (this.clock && !this.clockPaused) {
      this.clockChars += (performance.now() - this.clockOrigin) * this.charsPerMs;
      this.clockPaused = true;
    }
    if (speechSupported()) window.speechSynthesis.pause();
  }

  resume(): void {
    this.clockOrigin = performance.now();
    this.clockPaused = false;
    if (speechSupported()) window.speechSynthesis.resume();
  }

  stop(): void {
    if (!speechSupported()) return;
    this.token += 1;
    this.clearClock();
    window.speechSynthesis.cancel();
  }

  private clearClock(): void {
    if (this.clock) {
      clearInterval(this.clock);
      this.clock = null;
    }
    this.clockPaused = false;
  }
}
