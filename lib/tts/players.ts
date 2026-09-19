import { BrowserPlayer } from './browser-player';
import { CloudPlayer } from './cloud-player';
import type { SegmentPlayer } from './engine';
import type { PrepareChunk } from './prefetch';
import { findCloudVoice } from './voices';

export type PlaybackBackend = {
  player: SegmentPlayer;
  /** Warms a chunk before the playhead reaches it. Local synthesis has nothing to warm. */
  prepare: PrepareChunk;
};

const browserBackend: PlaybackBackend = {
  player: new BrowserPlayer(),
  prepare: () => Promise.resolve(),
};

/**
 * Resolves a voice to the machinery that plays it. The reader never asks which engine a voice
 * belongs to — that is derived here from the voice id and nowhere else.
 */
export function createBackend(voiceId: string, sourceText = ''): PlaybackBackend {
  const cloud = findCloudVoice(voiceId);
  if (!cloud) return browserBackend;

  const player = new CloudPlayer(cloud.engine);
  return {
    player,
    prepare: (chunk, signal) =>
      player.prepare(chunk.text, voiceId, signal, { sourceText, partIndex: chunk.index }),
  };
}
