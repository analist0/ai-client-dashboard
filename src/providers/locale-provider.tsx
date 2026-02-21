/**
 * Locale Provider
 * Manages user language preference and provides NextIntlClientProvider.
 * Reads locale from localStorage (set by settings page) and updates
 * document direction for RTL languages.
 */

'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { NextIntlClientProvider } from 'next-intl';
import {
  type Locale,
  defaultLocale,
  isRtl,
  isValidLocale,
  LOCALE_STORAGE_KEY,
} from '@/i18n/locales';

// ── Types ──────────────────────────────────────────────

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isLoading: boolean;
}

// ── Context ────────────────────────────────────────────

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
  isLoading: false,
});

export function useLocale() {
  return useContext(LocaleContext);
}

// ── Message cache ──────────────────────────────────────

const messageCache = new Map<string, Record<string, unknown>>();

async function loadMessages(locale: string): Promise<Record<string, unknown>> {
  if (messageCache.has(locale)) {
    return messageCache.get(locale)!;
  }
  try {
    // Dynamic import — each locale JSON is its own chunk
    const mod = await import(`../../messages/${locale}.json`);
    messageCache.set(locale, mod.default);
    return mod.default;
  } catch {
    // Fallback to English on missing locale file
    const en = await import('../../messages/en.json');
    return en.default;
  }
}

// ── Provider ───────────────────────────────────────────

interface LocaleProviderProps {
  children: ReactNode;
  /** Messages for the initial render (loaded server-side for SSR) */
  initialMessages: Record<string, unknown>;
  initialLocale?: Locale;
}

export function LocaleProvider({
  children,
  initialMessages,
  initialLocale = defaultLocale,
}: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [messages, setMessages] = useState<Record<string, unknown>>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);

  // On mount: read from localStorage and apply if different from initial
  useEffect(() => {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && isValidLocale(saved) && saved !== locale) {
      applyLocale(saved);
    }
    // Sync dir/lang with current locale
    document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyLocale = useCallback(async (next: Locale) => {
    setIsLoading(true);
    const msgs = await loadMessages(next);
    setMessages(msgs);
    setLocaleState(next);
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    document.documentElement.dir = isRtl(next) ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
    setIsLoading(false);
  }, []);

  const setLocale = useCallback(
    (next: Locale) => {
      if (next !== locale) applyLocale(next);
    },
    [locale, applyLocale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, isLoading }}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
