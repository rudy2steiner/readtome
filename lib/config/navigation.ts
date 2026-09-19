export const navigationConfig = {
  mainNav: [
    { href: '/', label: 'nav.home' },
    { href: '/reader', label: 'nav.reader' },
    { href: '/blog', label: 'nav.blog' }
  ]
} as const;

export const languageConfig = [
  { code: 'en', label: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', label: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
] as const;