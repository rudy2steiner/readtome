export type ReaderPersistedState = {
  text: string;
  segmentIndex: number;
  voiceURI: string | null;
  rate: number;
  fontScale: number;
  /** Voice-language chip. Survives Strict Mode remounts so a demo swap is not reset to `all`. */
  langFilter?: string;
  updatedAt: number;
};

const STORAGE_KEY = 'readtome.reader.v1';

export function loadReaderState(): ReaderPersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReaderPersistedState;
    if (typeof parsed.text !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveReaderState(state: Omit<ReaderPersistedState, 'updatedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = loadReaderState();
    const payload: ReaderPersistedState = {
      ...prev,
      ...state,
      langFilter: state.langFilter ?? prev?.langFilter ?? 'all',
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // quota / private mode — ignore for prototype
  }
}

export function saveReaderLangFilter(langFilter: string): void {
  const prev = loadReaderState();
  saveReaderState({
    text: prev?.text ?? '',
    segmentIndex: prev?.segmentIndex ?? 0,
    voiceURI: prev?.voiceURI ?? null,
    rate: prev?.rate ?? 1,
    fontScale: prev?.fontScale ?? 1,
    langFilter,
  });
}
