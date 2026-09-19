import type { TextChunk } from './segment';

/** Renders one chunk ahead of playback. Browser voices need no preparation, so theirs is a no-op. */
export type PrepareChunk = (chunk: TextChunk, signal: AbortSignal) => Promise<void>;

/**
 * Keeps a small window of chunks synthesized ahead of the playhead. The window exists to bound
 * spend as much as to hide latency: a listener who stops after thirty seconds should only ever
 * have paid for thirty seconds, so nothing beyond the window is ever requested, and `abort`
 * cancels whatever is still in flight the moment playback is abandoned.
 */
export class Prefetcher {
  private inFlight = new Map<number, AbortController>();
  private ready = new Set<number>();

  constructor(private readonly prepare: PrepareChunk, readonly windowSize = 3) {}

  /** Starts preparation for the playhead chunk and the next few, skipping done and in-flight ones. */
  ensure(chunks: TextChunk[], from: number): void {
    for (let index = from; index < Math.min(from + this.windowSize, chunks.length); index += 1) {
      if (this.ready.has(index) || this.inFlight.has(index)) continue;

      const controller = new AbortController();
      this.inFlight.set(index, controller);
      this.prepare(chunks[index], controller.signal)
        .then(() => {
          if (!controller.signal.aborted) this.ready.add(index);
        })
        .catch(() => undefined)
        .then(() => {
          if (this.inFlight.get(index) === controller) this.inFlight.delete(index);
        });
    }
  }

  isReady(index: number): boolean {
    return this.ready.has(index);
  }

  pending(): number[] {
    return Array.from(this.inFlight.keys()).sort((a, b) => a - b);
  }

  /** Called on stop, on document edits, and on voice changes — anything that invalidates the queue. */
  abort(): void {
    this.inFlight.forEach((controller) => controller.abort());
    this.inFlight.clear();
    this.ready.clear();
  }
}
