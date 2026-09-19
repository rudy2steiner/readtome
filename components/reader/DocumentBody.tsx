'use client';

import { Fragment, useMemo } from 'react';

import { cn } from '@/lib/utils';
import type { TextSegment } from '@/lib/tts/segment';

/**
 * The read-only view shown while speaking. Text between sentences (blank lines, indentation)
 * is emitted verbatim so switching in and out of playback never reflows the document.
 */
export function DocumentBody({
  text,
  segments,
  segmentIndex,
  preparing = false,
  onSeek,
}: {
  text: string;
  segments: TextSegment[];
  segmentIndex: number;
  preparing?: boolean;
  onSeek: (index: number) => void;
}) {
  const pieces = useMemo(() => {
    const out: { gap: string; segment: TextSegment }[] = [];
    let cursor = 0;
    segments.forEach((segment) => {
      out.push({ gap: text.slice(cursor, segment.start), segment });
      cursor = segment.end;
    });
    return { out, tail: text.slice(cursor) };
  }, [text, segments]);

  return (
    <div className="doc-body" aria-busy={preparing}>
      {pieces.out.map(({ gap, segment }) => (
        <Fragment key={`${segment.index}-${segment.start}`}>
          {gap}
          <span
            className={cn(
              'seg cursor-pointer',
              segment.index === segmentIndex && 'seg-spoken',
              segment.index === segmentIndex && preparing && 'seg-preparing',
              segment.index < segmentIndex && 'seg-done',
            )}
            data-seg-active={segment.index === segmentIndex}
            onClick={() => onSeek(segment.index)}
          >
            {text.slice(segment.start, segment.end)}
          </span>
        </Fragment>
      ))}
      {pieces.tail}
    </div>
  );
}
