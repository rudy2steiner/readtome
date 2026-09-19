'use client';

import { useTranslations } from 'next-intl';
import { Moon, Sun } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/lib/theme/theme';

export function ThemeSwitch() {
  const t = useTranslations('nav');
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? t('themeDark') : t('themeLight');

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="theme-btn" aria-label={label} onClick={toggle}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="border-0 bg-zinc-800 px-2 py-1 text-xs text-white shadow-md">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
