import { create } from 'zustand';

import { DegradeError } from './errors';
import { loadReaderState, saveReaderState } from './persistence';
import { Prefetcher } from './prefetch';
import { createBackend, type PlaybackBackend } from './players';
import { chunkSegments, displaySegments, segmentAtChunkOffset, type TextChunk, type TextSegment } from './segment';

/** `preparing` is its own state because cloud synthesis takes seconds before the first sound. */
export type ReaderStatus = 'idle' | 'preparing' | 'playing' | 'paused';

export type ReaderState = {
  text: string;
  segments: TextSegment[];
  chunks: TextChunk[];
  chunkIndex: number;
  /** Document-level sentence index, used for the follow-along highlight. */
  segmentIndex: number;
  voiceId: string | null;
  rate: number;
  fontScale: number;
  status: ReaderStatus;
  error: string | null;
  /** Seconds heard so far in the current pass, at 1x. */
  playedSeconds: number;
  /** Whole-document audio length after the last finished or stopped pass. */
  lastDurationSeconds: number | null;
};

export type ReaderActions = {
  setText: (text: string) => void;
  setVoiceId: (voiceId: string) => void;
  setRate: (rate: number) => void;
  setFontScale: (scale: number) => void;
  clear: () => void;
  play: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seekToSegment: (index: number) => void;
  restore: () => void;
  clearError: () => void;
};

let backend: PlaybackBackend | null = null;
let backendVoiceId: string | null = null;
let backendSource = '';
let prefetcher: Prefetcher | null = null;
/** Splitting a long document is only worth doing when playback needs it, not on every keystroke. */
let segmentedFor: string | null = null;

function backendFor(voiceId: string, sourceText: string): PlaybackBackend {
  if (!backend || backendVoiceId !== voiceId || backendSource !== sourceText) {
    backend?.player.stop();
    prefetcher?.abort();
    backend = createBackend(voiceId, sourceText);
    backendVoiceId = voiceId;
    backendSource = sourceText;
    prefetcher = new Prefetcher(backend.prepare);
  }
  return backend;
}

function teardown(): void {
  backend?.player.stop();
  prefetcher?.abort();
}

/** The chunk that contains a given sentence, so resuming mid-document restarts the right request. */
function chunkForSegment(chunks: TextChunk[], segmentIndex: number): number {
  const found = chunks.findIndex((chunk) => chunk.segments.some((segment) => segment.index === segmentIndex));
  return found < 0 ? 0 : found;
}

export const useReaderStore = create<ReaderState & ReaderActions>((set, get) => {
  const persist = () => {
    const { text, segmentIndex, voiceId, rate, fontScale } = get();
    saveReaderState({ text, segmentIndex, voiceURI: voiceId, rate, fontScale });
  };

  const ensureSegments = (): ReaderState => {
    const { text } = get();
    if (segmentedFor !== text) {
      const segments = displaySegments(text);
      segmentedFor = text;
      set({ segments, chunks: chunkSegments(segments) });
    }
    return get();
  };

  /** Speaks one chunk and chains into the next, which is the whole playback loop. */
  const speakChunk = (index: number) => {
    const { chunks, voiceId, rate, text } = get();
    const chunk = chunks[index];
    if (!chunk || !voiceId) return;

    const active = backendFor(voiceId, text);
    prefetcher?.ensure(chunks, index);
    set({
      status: 'preparing',
      chunkIndex: index,
      segmentIndex: chunk.segments[0].index,
      error: null,
    });

    active.player
      .speak(
        { text: chunk.text, voiceId, rate, sourceText: text, partIndex: chunk.index },
        {
          onDuration: (seconds) => {
            set({ playedSeconds: get().playedSeconds + seconds });
          },
          onSegmentEnd: () => {
            const next = index + 1;
            if (next < get().chunks.length) {
              speakChunk(next);
            } else {
              teardown();
              set({
                status: 'idle',
                chunkIndex: 0,
                segmentIndex: 0,
                lastDurationSeconds: get().playedSeconds,
              });
              persist();
            }
          },
          onWordBoundary: (charIndex) => {
            const segment = segmentAtChunkOffset(chunk, charIndex);
            if (segment.index !== get().segmentIndex) {
              set({ segmentIndex: segment.index });
              persist();
            }
          },
          onError: (error) => {
            teardown();
            set({
              status: 'idle',
              error: error instanceof DegradeError ? error.code : error instanceof Error ? error.message : 'supplier',
              lastDurationSeconds: get().playedSeconds || get().lastDurationSeconds,
            });
          },
        },
      )
      .then(() => {
        if (get().status === 'preparing') set({ status: 'playing' });
      })
      .catch(() => undefined);
  };

  const startPass = (index: number) => {
    set({ playedSeconds: 0, lastDurationSeconds: null });
    speakChunk(index);
  };

  return {
    text: '',
    segments: [],
    chunks: [],
    chunkIndex: 0,
    segmentIndex: 0,
    voiceId: null,
    rate: 1,
    fontScale: 1,
    status: 'idle',
    error: null,
    playedSeconds: 0,
    lastDurationSeconds: null,

    setText: (text) => {
      teardown();
      set({ text, chunkIndex: 0, segmentIndex: 0, status: 'idle', error: null, playedSeconds: 0, lastDurationSeconds: null });
      persist();
    },

    setVoiceId: (voiceId) => {
      const wasPlaying = get().status === 'playing' || get().status === 'preparing';
      teardown();
      set({ voiceId, status: 'idle' });
      persist();
      if (wasPlaying) startPass(chunkForSegment(get().chunks, get().segmentIndex));
    },

    setRate: (rate) => {
      const wasPlaying = get().status === 'playing' || get().status === 'preparing';
      set({ rate });
      persist();
      if (wasPlaying) {
        teardown();
        startPass(chunkForSegment(get().chunks, get().segmentIndex));
      }
    },

    setFontScale: (fontScale) => {
      set({ fontScale });
      persist();
    },

    clear: () => {
      teardown();
      segmentedFor = '';
      set({
        text: '',
        segments: [],
        chunks: [],
        chunkIndex: 0,
        segmentIndex: 0,
        status: 'idle',
        error: null,
        playedSeconds: 0,
        lastDurationSeconds: null,
      });
      persist();
    },

    play: () => {
      if (!get().text.trim()) {
        set({ error: 'empty-text' });
        return;
      }
      const { chunks, segmentIndex, voiceId } = ensureSegments();
      if (chunks.length === 0) {
        set({ error: 'empty-text' });
        return;
      }
      if (!voiceId) {
        set({ error: 'no-voice' });
        return;
      }
      startPass(chunkForSegment(chunks, segmentIndex));
    },

    pause: () => {
      if (get().status !== 'playing') return;
      backend?.player.pause();
      set({ status: 'paused' });
      persist();
    },

    resume: () => {
      if (get().status !== 'paused') return;
      backend?.player.resume();
      set({ status: 'playing' });
    },

    stop: () => {
      teardown();
      set({
        status: 'idle',
        chunkIndex: 0,
        segmentIndex: 0,
        lastDurationSeconds: get().playedSeconds || get().lastDurationSeconds,
      });
      persist();
    },

    seekToSegment: (index) => {
      const { segments, status } = get();
      if (index < 0 || index >= segments.length) return;
      const wasPlaying = status === 'playing' || status === 'preparing';
      teardown();
      set({ segmentIndex: index, status: 'idle' });
      persist();
      if (wasPlaying) startPass(chunkForSegment(get().chunks, index));
    },

    clearError: () => set({ error: null }),

    restore: () => {
      const saved = loadReaderState();
      if (!saved) return;
      const segments = displaySegments(saved.text);
      segmentedFor = saved.text;
      set({
        text: saved.text,
        segments,
        chunks: chunkSegments(segments),
        segmentIndex: Math.min(saved.segmentIndex, Math.max(segments.length - 1, 0)),
        chunkIndex: 0,
        voiceId: saved.voiceURI,
        rate: saved.rate || 1,
        fontScale: saved.fontScale || 1,
      });
    },
  };
});
