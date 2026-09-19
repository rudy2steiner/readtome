import { CHUNK_TARGET_CHARS } from './engine';

export type TextSegment = {
  index: number;
  text: string;
  start: number;
  end: number;
};

/**
 * One synthesis request. Chunks exist because synthesis costs ~2.5s of fixed overhead plus 16ms
 * per character: a single short sentence takes longer to render than it takes to play, while a
 * 300-character chunk renders at roughly 2.5x realtime. Sentence boundaries survive inside
 * `segments` so highlighting stays per-sentence even though audio arrives per-chunk.
 */
export type TextChunk = {
  index: number;
  text: string;
  start: number;
  end: number;
  segments: TextSegment[];
};

const SENTENCE_END = /[!?。！？；;…]/;
const LIST_MARK = /^\d{1,2}、/;
/** ~14s of Chinese at CHARS_PER_MINUTE.zh — small enough to follow, big enough to read. */
const CJK_SOFT = 72;

/** Split into sentence-like segments for highlight + resume. */
export function segmentText(input: string): TextSegment[] {
  const text = input.replace(/\r\n/g, '\n');
  if (!text.trim()) return [];

  const ranges: { start: number; end: number }[] = [];
  let start = -1;

  const flush = (end: number) => {
    if (start < 0 || end <= start) {
      start = -1;
      return;
    }
    const raw = text.slice(start, end);
    const leading = raw.search(/\S/);
    const trimmed = raw.trim();
    const origin = start;
    start = -1;
    if (!trimmed) return;
    const segStart = origin + (leading >= 0 ? leading : 0);
    ranges.push({ start: segStart, end: segStart + trimmed.length });
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (start < 0) {
      if (ch === '\n' || !ch.trim()) continue;
      start = i;
    }

    if (ch === '\n') {
      flush(i);
      continue;
    }

    if (SENTENCE_END.test(ch) || (ch === '.' && !/[A-Za-z0-9]/.test(text.charAt(i + 1)))) {
      flush(i + 1);
      continue;
    }

    if (start >= 0 && i > start && LIST_MARK.test(text.slice(i, i + 4))) {
      flush(i);
      start = i;
    }

    if (start >= 0) {
      const window = text.slice(start, i + 1);
      const cjkCount = (window.match(/[\u4e00-\u9fff]/g) || []).length;
      if (cjkCount >= CJK_SOFT) {
        let cut = -1;
        for (let k = window.length - 1; k >= Math.floor(window.length / 2); k -= 1) {
          if (/[，、,\s]/.test(window.charAt(k))) {
            cut = start + k + 1;
            break;
          }
        }
        flush(cut > start ? cut : i + 1);
        if (cut > start) i = cut - 1;
      }
    }
  }
  flush(text.length);

  const segments = ranges.map((range, index) => ({
    index,
    text: text.slice(range.start, range.end),
    start: range.start,
    end: range.end,
  }));

  if (segments.length === 0 && text.trim()) {
    const trimmed = text.trim();
    const from = text.indexOf(trimmed);
    segments.push({ index: 0, text: trimmed, start: from, end: from + trimmed.length });
  }

  return segments;
}

const CLAUSE_BREAK = /[,;:、，；：]/;

/** Prefer a clause break, then whitespace, and only cut mid-word when a run has neither. */
function cutPoint(window: string, earliest: number): number {
  for (let i = window.length - 1; i >= earliest; i -= 1) {
    if (CLAUSE_BREAK.test(window.charAt(i))) return i + 1;
  }
  for (let i = window.length - 1; i >= earliest; i -= 1) {
    if (/\s/.test(window.charAt(i))) return i + 1;
  }
  return window.length;
}

/** Highlight units: sentence splits, then any leftover run longer than one chunk. */
export function displaySegments(input: string): TextSegment[] {
  const pieces: TextSegment[] = [];
  segmentText(input).forEach((segment) => {
    pieces.push(...(segment.text.length > CHUNK_TARGET_CHARS.max ? splitOversized(segment, CHUNK_TARGET_CHARS.max) : [segment]));
  });
  return pieces.map((segment, index) => ({ ...segment, index }));
}

/** A sentence longer than one whole chunk becomes several segments, none over the limit. */
function splitOversized(segment: TextSegment, limit: number): TextSegment[] {
  const pieces: TextSegment[] = [];
  let offset = 0;

  while (segment.text.length - offset > limit) {
    const cut = cutPoint(segment.text.substr(offset, limit), Math.floor(limit / 2));
    pieces.push(pieceOf(segment, offset, offset + cut));
    offset += cut;
  }
  pieces.push(pieceOf(segment, offset, segment.text.length));

  return pieces.filter((piece) => piece.text.length > 0);
}

function pieceOf(segment: TextSegment, from: number, to: number): TextSegment {
  const raw = segment.text.slice(from, to);
  const leading = raw.length - raw.replace(/^\s+/, '').length;
  const text = raw.trim();
  return { index: segment.index, text, start: segment.start + from + leading, end: segment.start + from + leading + text.length };
}

/**
 * Maps a character offset inside a chunk's synthesized text back to the sentence it belongs to,
 * which is how a word boundary event becomes a sentence highlight in the document.
 */
export function segmentAtChunkOffset(chunk: TextChunk, offset: number): TextSegment {
  let consumed = 0;
  for (let i = 0; i < chunk.segments.length; i += 1) {
    consumed += chunk.segments[i].text.length + (i > 0 ? 1 : 0);
    if (offset < consumed) return chunk.segments[i];
  }
  return chunk.segments[chunk.segments.length - 1];
}

export type ChunkOptions = {
  minChars?: number;
  maxChars?: number;
  /** The engine's own per-request ceiling — xAI allows 15k, MiniMax 10k. */
  maxCharsPerRequest?: number;
};

/**
 * Group sentences into synthesis-sized chunks: keep adding sentences until the chunk is long
 * enough to render faster than it plays, and never exceed the per-request limit.
 */
export function chunkSegments(segments: TextSegment[], options: ChunkOptions = {}): TextChunk[] {
  const min = options.minChars ?? CHUNK_TARGET_CHARS.min;
  const limit = Math.min(options.maxChars ?? CHUNK_TARGET_CHARS.max, options.maxCharsPerRequest ?? Infinity);

  const chunks: TextChunk[] = [];
  let current: TextSegment[] = [];
  let length = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push({
      index: chunks.length,
      text: current.map((segment) => segment.text).join(' '),
      start: current[0].start,
      end: current[current.length - 1].end,
      segments: current,
    });
    current = [];
    length = 0;
  };

  segments.forEach((segment) => {
    const pieces = segment.text.length > limit ? splitOversized(segment, limit) : [segment];
    pieces.forEach((piece) => {
      if (length > 0 && length + 1 + piece.text.length > limit) flush();
      current.push(piece);
      length += (length > 0 ? 1 : 0) + piece.text.length;
      if (length >= min) flush();
    });
  });
  flush();

  return chunks;
}
