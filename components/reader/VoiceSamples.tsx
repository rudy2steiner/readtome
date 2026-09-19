'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { loggedFetch } from '@/lib/log/call';
import { Link } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useReaderStore } from '@/lib/tts/reader-store';
import { PauseIcon, PlayIcon } from './icons';

type SampleVoice = {
  name: string;
  tier: 'natural';
  clips: Record<string, string>;
};

type Manifest = {
  /** The sentence every clip reads, so listeners know what they are comparing. */
  copy: Record<string, string>;
  voices: SampleVoice[];
};

/**
 * Pre-generated clips from the same engines the paid tiers call at runtime. The manifest is
 * fetched rather than imported so that a missing or half-deployed `public/samples/` hides the
 * whole strip instead of rendering play buttons that produce silence.
 */
export function VoiceSamples() {
  const t = useTranslations('samples');
  const locale = useLocale();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Two clicks in the same tick both read the pre-render state, so the ref — not `playing` — decides
  // what is sounding. `attempt` lets a superseded play() promise reject without clearing its successor.
  const playingRef = useRef<string | null>(null);
  const attemptRef = useRef(0);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const readerStatus = useReaderStore((s) => s.status);
  const lang = locale === 'zh' ? 'zh' : 'en';

  useEffect(() => {
    let live = true;
    loggedFetch('client.samples.manifest', '/samples/samples.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no manifest'))))
      .then((json: Manifest) => live && setManifest(json))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const show = (name: string | null) => {
    playingRef.current = name;
    setPlaying(name);
  };

  const stop = () => {
    audioRef.current?.pause();
    attemptRef.current += 1;
    show(null);
    setProgress(0);
  };

  // A sample and the reader talking over each other is never what the visitor asked for.
  useEffect(() => {
    if (readerStatus === 'playing' || readerStatus === 'preparing') stop();
  }, [readerStatus]);

  useEffect(() => stop, []);

  if (!manifest) return null;

  const play = (voice: SampleVoice) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingRef.current === voice.name) {
      stop();
      return;
    }
    useReaderStore.getState().stop();

    const attempt = ++attemptRef.current;
    audio.pause();
    setProgress(0);
    show(voice.name);
    audio.src = `/samples/${voice.clips[lang]}`;
    audio.play().catch(() => {
      // Swapping src rejects the previous play(); only the clip still being waited on may complain.
      if (attemptRef.current !== attempt) return;
      toast({ description: t('playFailed') });
      show(null);
    });
  };

  return (
    <div className="voice-samples mx-auto mb-8 text-center">
      <p className="mb-5 text-[13.5px] text-muted-foreground">{t('heroLabel')}</p>

      <div className="flex flex-wrap items-start justify-center gap-x-7 gap-y-4">
        {manifest.voices.map((voice) => {
          const active = playing === voice.name;
          return (
            <div
              key={voice.name}
              className="grid justify-items-center gap-2"
              style={{ '--p': active ? String(progress) : '0' } as React.CSSProperties}
            >
              <button
                type="button"
                className="sample-btn"
                aria-label={t('playLabel', { name: voice.name })}
                onClick={() => play(voice)}
              >
                <span className="sample-ring" aria-hidden />
                <span className={cn('sample-mono', active && 'is-playing')} aria-hidden>
                  {voice.name.charAt(0)}
                </span>
                <span className="sample-play">{active ? <PauseIcon /> : <PlayIcon />}</span>
              </button>
              <span className="text-[13.5px] font-semibold tracking-tight">{voice.name}</span>
            </div>
          );
        })}
      </div>

      <p className="mx-auto mt-5 min-h-5 max-w-[560px] text-pretty text-[13.5px] italic leading-relaxed text-muted-foreground">
        “{manifest.copy[lang]}”
      </p>

      <p className="hero-samples-cta">
        <Link href="/pricing" className="lp-btn lp-btn-ghost lp-btn-sm">
          <span>{t('cta')}</span>
          <ArrowRight className="h-[15px] w-[15px]" />
        </Link>
        <span className="text-[13px] text-muted-foreground">{t('ctaPrice')}</span>
      </p>

      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) setProgress(el.currentTime / el.duration);
        }}
        onEnded={stop}
      />
    </div>
  );
}
