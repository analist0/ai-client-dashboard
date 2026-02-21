/**
 * Supported locales for the AI Client Dashboard
 */

export const locales = [
  'en', 'he', 'ar', 'es', 'fr', 'de',
  'ja', 'zh', 'pt', 'ru', 'it', 'ko',
] as const;

export type Locale = typeof locales[number];

export const defaultLocale: Locale = 'en';

/** Locales that read right-to-left */
export const rtlLocales: Locale[] = ['he', 'ar'];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  he: 'עברית',
  ar: 'العربية',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  zh: '中文',
  pt: 'Português',
  ru: 'Русский',
  it: 'Italiano',
  ko: '한국어',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇬🇧',
  he: '🇮🇱',
  ar: '🇸🇦',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  ja: '🇯🇵',
  zh: '🇨🇳',
  pt: '🇧🇷',
  ru: '🇷🇺',
  it: '🇮🇹',
  ko: '🇰🇷',
};

export function isRtl(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

export function isValidLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export const LOCALE_STORAGE_KEY = 'ai-dashboard-locale';
