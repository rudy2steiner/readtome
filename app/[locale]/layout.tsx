import { Inter } from 'next/font/google';
import { unstable_setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Toaster } from '@/components/ui/toaster';
import { Navigation } from '@/components/sections/Navigation';
import { Footer } from '@/components/sections/Footer';
import { I18nProvider } from '@/app/i18n/provider';
import { locales, isValidLocale } from '@/app/i18n/config';
import { AuthSessionProvider } from '@/lib/auth/session';
import { THEME_BOOT_SCRIPT } from '@/lib/theme/boot';
import { ThemeProvider } from '@/lib/theme/theme';
import { Metadata } from 'next';
import '../globals.css';
import '../landing.css';

const inter = Inter({ subsets: ['latin', 'latin-ext'] });

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.read-to-me.org'),
  title: {
    default: 'Read To Me: Turn text to speech in seconds | Free Online',
    template: '%s'
  },
  description:
    'Transform any text into natural-sounding speech in seconds. Paste an article or upload a document and listen with lifelike voices.',
  robots: {
    index: true,
    follow: true
  },
  icons: {
    icon: '/favicon.svg'
  }
};

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!isValidLocale(locale)) {
    notFound();
  }

  unstable_setRequestLocale(locale);

  let messages;
  try {
    messages = (await import(`@/messages/${locale}.json`)).default;
  } catch (error) {
    notFound();
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <script defer data-domain="read-to-me.org" src="https://app.pageview.app/js/script.js"></script>
      </head>
      <body className={inter.className}>
        <I18nProvider locale={locale} messages={messages} timeZone="UTC">
          <AuthSessionProvider>
            <ThemeProvider>
              <div className="min-h-screen flex flex-col">
                <Navigation />
                <main className="flex-grow">
                  {children}
                </main>
                <Footer />
              </div>
              <Toaster />
            </ThemeProvider>
          </AuthSessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}