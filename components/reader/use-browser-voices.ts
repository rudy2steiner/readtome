'use client';

import { useEffect, useState } from 'react';

import { listBrowserVoices, onVoicesChanged } from '@/lib/tts/browser-player';

/**
 * Chrome resolves its voice list asynchronously and does not always fire `voiceschanged`,
 * so a short retry is the only reliable way to end up with a populated list.
 */
export function useBrowserVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const read = () => setVoices(listBrowserVoices());
    read();
    const unsubscribe = onVoicesChanged(read);
    const retry = window.setTimeout(read, 250);
    return () => {
      unsubscribe();
      window.clearTimeout(retry);
    };
  }, []);

  return voices;
}
