'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { useToast } from '@/hooks/use-toast';
import { Link } from '@/lib/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { speechSupported } from '@/lib/tts/browser-player';
import { ACCEPT_UPLOAD, extractDocumentText, htmlToText } from '@/lib/ingest/extract';
import { demoTextFor, isDemoText } from '@/lib/tts/demo-text';
import { loadReaderState, saveReaderLangFilter } from '@/lib/tts/persistence';
import { useReaderStore } from '@/lib/tts/reader-store';
import { findCloudVoice, primaryLang } from '@/lib/tts/voices';
import { DocumentBody } from './DocumentBody';
import { DemoIcon, PauseIcon, PlayIcon, SpinnerIcon, StopIcon, TrashIcon, UploadIcon } from './icons';
import { PlaybackPanel } from './PlaybackPanel';
import { useBrowserVoices } from './use-browser-voices';
import {
  demoLangFor,
  filterVoices,
  languageDisplayName,
  pickBrowserVoice,
  useLanguageOptions,
} from './voice-controls';

const RATE_STEPS = [1, 1.25, 1.5, 1.75, 2, 0.75];
const BASE_FONT_PX = 17;
const CJK = /[\u4e00-\u9fff\u3040-\u30ff]/;

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function Reader({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('reader');
  const locale = useLocale();
  const { toast } = useToast();
  const voices = useBrowserVoices();
  const fileRef = useRef<HTMLInputElement>(null);
  const [langFilter, setLangFilter] = useState(() => loadReaderState()?.langFilter ?? 'all');
  const [ingest, setIngest] = useState<string | null>(null);

  const {
    text,
    segments,
    segmentIndex,
    status,
    rate,
    fontScale,
    voiceId,
    error,
    playedSeconds,
    lastDurationSeconds,
    setText,
    setVoiceId,
    setRate,
    setFontScale,
    clear,
    play,
    pause,
    resume,
    stop,
    seekToSegment,
    restore,
    clearError,
  } = useReaderStore();

  const reading = status !== 'idle';
  const preparing = status === 'preparing';
  const playing = status === 'playing';

  /**
   * Assumed available until the client says otherwise. Reading `speechSynthesis` during render
   * would disagree with the server, and React keeps the server's `disabled` attribute on a
   * mismatch — which would leave the play button dead for everyone.
   */
  const [supported, setSupported] = useState(true);
  useEffect(() => setSupported(speechSupported()), []);

  /* Restore the previous session, and seed a language-matching demo on a first visit. */
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    restore();
    const current = useReaderStore.getState().text;
    const filter = loadReaderState()?.langFilter ?? langFilter;
    if (!current.trim() || isDemoText(current)) {
      const next = demoTextFor(demoLangFor(filter, locale), locale);
      if (next !== current) setText(next);
    }
  }, [restore, setText, locale, langFilter]);

  /* Site locale or language chip — refresh an untouched demo, never a pasted document. */
  const demoSync = useRef(true);
  useEffect(() => {
    if (demoSync.current) {
      demoSync.current = false;
      return;
    }
    if (!isDemoText(useReaderStore.getState().text)) return;
    const next = demoTextFor(demoLangFor(langFilter, locale), locale);
    if (next !== useReaderStore.getState().text) setText(next);
  }, [locale, langFilter, setText]);

  /*
   * Fill in a default only when nothing usable is selected. A manual or persisted
   * pick must survive voiceschanged, remounts, and demo text swaps — changing the
   * language chip is the only path that re-picks, and applyLang already does that.
   */
  useEffect(() => {
    if (voices.length === 0) return;
    const currentId = useReaderStore.getState().voiceId;
    if (currentId && findCloudVoice(currentId)) return;
    const current = voices.find((voice) => voice.voiceURI === currentId);
    if (current) return;
    const preferred = pickBrowserVoice(voices, demoLangFor(langFilter, locale));
    if (!preferred || preferred.voiceURI === currentId) return;
    setVoiceId(preferred.voiceURI);
  }, [voices, locale, langFilter, setVoiceId]);

  useEffect(() => {
    if (!supported) toast({ description: t('noSpeech') });
  }, [supported, t, toast]);

  useEffect(() => {
    if (!error) return;
    const messages: Record<string, string> = {
      'empty-text': t('needText'),
      'no-voice': t('needVoice'),
      quota_natural: t('degradeNatural'),
      trial_exhausted: t('degradeTrial'),
      unauthenticated: t('premiumSignIn'),
      missing_key: t('degradeCloud'),
      supplier: t('degradeCloud'),
    };
    toast({ description: messages[error] ?? error });
    clearError();
  }, [error, t, toast, clearError]);

  /* Keep the spoken sentence in view without yanking the page around. */
  useEffect(() => {
    if (!reading) return;
    document.querySelector('[data-seg-active="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [segmentIndex, reading]);

  const voiceLabel = useMemo(() => {
    const cloud = voiceId ? findCloudVoice(voiceId) : null;
    if (cloud) return cloud.name;
    const active = voices.find((voice) => voice.voiceURI === voiceId);
    return active?.name ?? t('systemVoice');
  }, [voices, voiceId, t]);

  const counts = useMemo(() => {
    const chars = `${text.length.toLocaleString()} ${t('characters')}`;
    /* Whitespace word counts are meaningless for CJK, so show characters only. */
    if (CJK.test(text)) return chars;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return `${words.toLocaleString()} ${t('words')} · ${chars}`;
  }, [text, t]);

  const progress = segments.length ? (segmentIndex / segments.length) * 100 : 0;
  const heardSeconds = preparing || playing || status === 'paused' ? playedSeconds : lastDurationSeconds;
  const heardLabel = heardSeconds && heardSeconds > 0 ? formatClock(heardSeconds) : null;

  const onUpload = (file: File | undefined) => {
    if (!file) return;
    setIngest(t('readingFile'));
    void extractDocumentText(file, {
      onProgress: (progress) => {
        if (progress.phase === 'ocr-init') {
          setIngest(t('ocrStart', { total: progress.total }));
          return;
        }
        setIngest(t('ocrProgress', { page: progress.page, total: progress.total }));
        if (progress.text) {
          stop();
          setText(progress.text);
        }
      },
    }).then((result) => {
      setIngest(null);
      if (!result.ok) {
        const messages: Record<typeof result.reason, string> = {
          unsupported: t('needFormat'),
          legacy_doc: t('needDocx'),
          empty: t('emptyFile'),
          too_large: t('tooLarge'),
          parse: t('parseFailed'),
        };
        toast({ description: messages[result.reason] });
        return;
      }
      stop();
      setText(result.text);
      toast({ description: `${t('loaded')} ${file.name}` });
    }).catch(() => {
      setIngest(null);
      toast({ description: t('parseFailed') });
    });
  };

  const cycleRate = () => {
    const next = RATE_STEPS[(RATE_STEPS.indexOf(rate) + 1) % RATE_STEPS.length];
    setRate(next);
  };

  const languages = useLanguageOptions(voices);
  const visibleVoices = filterVoices(voices, langFilter, locale);

  const applyLang = (next: string) => {
    setLangFilter(next);
    saveReaderLangFilter(next);
    const targetLang = demoLangFor(next, locale);
    if (isDemoText(text)) {
      setText(demoTextFor(targetLang, locale));
      const pick = pickBrowserVoice(voices, targetLang);
      if (pick) setVoiceId(pick.voiceURI);
      return;
    }
    const remaining = filterVoices(voices, next, locale);
    if (!voiceId || !remaining.some((voice) => voice.voiceURI === voiceId)) {
      const pick = remaining[0];
      if (pick) setVoiceId(pick.voiceURI);
    }
  };

  return (
    <div
      className={cn('reader grid items-start gap-[18px]', compact ? 'reader-compact' : 'lg:grid-cols-[minmax(0,1fr)_306px]')}
      style={{ ['--doc-size' as string]: `${Math.round(BASE_FONT_PX * fontScale)}px` }}
    >
      <div className="min-w-0">
        <div
          className="doc-card"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            onUpload(event.dataTransfer.files[0]);
          }}
        >
          <TooltipProvider delayDuration={200} skipDelayDuration={80}>
            <div className="doc-toolbar">
              <ToolbarButton label={t('clear')} onClick={clear}>
                <TrashIcon />
              </ToolbarButton>
              <ToolbarButton label={t('upload')} hint={t('uploadHint')} onClick={() => fileRef.current?.click()}>
                <UploadIcon />
              </ToolbarButton>
              <ToolbarButton
                label={t('loadDemo')}
                onClick={() => {
                  const targetLang = demoLangFor(langFilter, locale);
                  setText(demoTextFor(targetLang, locale));
                  toast({ description: t('demoLoaded') });
                }}
              >
                <DemoIcon />
              </ToolbarButton>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT_UPLOAD}
                hidden
                onChange={(event) => {
                  onUpload(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              <span className="mx-1.5 h-5 w-px bg-border" />
              <ToolbarButton label={t('smaller')} onClick={() => setFontScale(Math.max(0.82, fontScale - 0.06))}>
                A−
              </ToolbarButton>
              <ToolbarButton label={t('bigger')} onClick={() => setFontScale(Math.min(1.5, fontScale + 0.06))}>
                A+
              </ToolbarButton>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {[ingest ?? counts, heardLabel].filter(Boolean).join(' · ')}
              </span>
              {compact && (
                <Link href="/reader" className="ml-2 text-xs font-semibold text-blue-700 hover:underline">
                  {t('openFull')}
                </Link>
              )}
            </div>
          </TooltipProvider>

          {reading ? (
            <DocumentBody
              text={text}
              segments={segments}
              segmentIndex={segmentIndex}
              preparing={preparing}
              onSeek={seekToSegment}
            />
          ) : (
            <textarea
              className="doc-body"
              value={text}
              spellCheck={false}
              placeholder={t('placeholder')}
              onChange={(event) => setText(event.target.value)}
              onPaste={(event) => {
                const html = event.clipboardData.getData('text/html');
                const plain = event.clipboardData.getData('text/plain');
                if (!html) return;
                const formatted = htmlToText(html);
                const richer = (formatted.match(/\n/g)?.length ?? 0) > (plain.match(/\n/g)?.length ?? 0);
                if (!formatted || !richer) return;
                event.preventDefault();
                const target = event.currentTarget;
                const start = target.selectionStart ?? 0;
                const end = target.selectionEnd ?? 0;
                setText(text.slice(0, start) + formatted + text.slice(end));
              }}
            />
          )}

          <div className="transport">
            {compact ? (
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <TransportSelect
                  className="transport-lang !w-[132px]"
                  label={t('language')}
                  value={primaryLang(langFilter)}
                  options={[
                    { value: 'all', label: t('allLanguages') },
                    ...languages.map((lang) => ({ value: lang, label: languageDisplayName(lang, locale) })),
                  ]}
                  onChange={applyLang}
                />
                <TransportSelect
                  className="transport-voice !w-[148px]"
                  label={t('voiceSelection')}
                  value={visibleVoices.some((voice) => voice.voiceURI === voiceId) ? (voiceId ?? '') : undefined}
                  placeholder={t('voiceSelection')}
                  options={visibleVoices.map((voice) => ({ value: voice.voiceURI, label: voice.name }))}
                  onChange={setVoiceId}
                />
              </div>
            ) : (
              <div className="voice-chip">
                <span className={cn('voice-dot h-2 w-2 flex-none rounded-full bg-emerald-400', preparing && 'is-preparing')} />
                <span className="truncate">{heardLabel ? `${voiceLabel} · ${heardLabel}` : voiceLabel}</span>
              </div>
            )}
            <button
              type="button"
              className={cn('play-btn', preparing && 'is-preparing')}
              disabled={!supported}
              aria-label={preparing ? t('preparing') : playing ? t('pause') : t('play')}
              aria-busy={preparing}
              onClick={() => {
                if (preparing) stop();
                else if (status === 'playing') pause();
                else if (status === 'paused') resume();
                else play();
              }}
            >
              {preparing ? <SpinnerIcon /> : playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div className="transport-actions flex flex-1 items-center justify-end gap-0.5">
              <button
                type="button"
                className="t-btn w-auto px-2.5 text-[13px] font-semibold tabular-nums"
                title={t('speed')}
                onClick={cycleRate}
              >
                {rate.toFixed(1)}x
              </button>
              <button type="button" className="t-btn" title={t('stop')} aria-label={t('stop')} onClick={stop}>
                <StopIcon />
              </button>
            </div>
          </div>

          <div className={cn('progress-track', preparing && 'is-preparing')}>
            <div className="progress-fill" style={preparing ? undefined : { width: `${progress.toFixed(1)}%` }} />
          </div>
        </div>

      </div>

      {!compact && (
        <PlaybackPanel
          voices={voices}
          voiceId={voiceId}
          langFilter={langFilter}
          rate={rate}
          onVoice={setVoiceId}
          onLang={applyLang}
          onRate={setRate}
        />
      )}
    </div>
  );
}

function TransportSelect({
  label,
  value,
  placeholder,
  className,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  className?: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          'transport-pick h-[34px] border-0 bg-white/10 px-3 text-[13px] text-white shadow-none focus:ring-0 focus:ring-offset-0',
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        side="top"
        align="start"
        avoidCollisions={false}
        position="popper"
        className="transport-pick-menu z-20"
      >
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ToolbarButton({
  label,
  hint,
  onClick,
  children,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const press = useRef<number | null>(null);
  const held = useRef(false);
  const [open, setOpen] = useState(false);

  const cancelPress = () => {
    if (press.current != null) {
      window.clearTimeout(press.current);
      press.current = null;
    }
  };

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onPointerDown={(event) => {
            if (event.pointerType !== 'touch') return;
            held.current = false;
            cancelPress();
            press.current = window.setTimeout(() => {
              held.current = true;
              setOpen(true);
            }, 380);
          }}
          onPointerUp={cancelPress}
          onPointerCancel={cancelPress}
          onPointerLeave={() => {
            cancelPress();
            if (held.current) setOpen(false);
          }}
          onClick={(event) => {
            if (held.current) {
              event.preventDefault();
              held.current = false;
              return;
            }
            onClick();
          }}
          className="grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-sm text-muted-foreground hover:bg-black/5 hover:text-foreground"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[240px] border-0 bg-zinc-800 px-2.5 py-1.5 text-xs text-white shadow-md">
        <div>{label}</div>
        {hint ? <div className="mt-0.5 font-normal text-white/70">{hint}</div> : null}
      </TooltipContent>
    </Tooltip>
  );
}

