import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DICTIONARIES,
  LOCALE_LABELS,
  LOCALE_FLAGS,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  type TranslationKey,
} from './dictionaries';

const LOCALE_STORAGE_KEY = 'ava-pco-locale';
const DEFAULT_LOCALE: SupportedLocale = 'pt';

function detectInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
    return stored as SupportedLocale;
  }
  // Fallback: detecta navigator.language com prefixo
  const nav = window.navigator?.language?.toLowerCase().slice(0, 2);
  if (nav && (SUPPORTED_LOCALES as readonly string[]).includes(nav)) {
    return nav as SupportedLocale;
  }
  return DEFAULT_LOCALE;
}

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (l: SupportedLocale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? `{${k}}` : String(v);
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(detectInitialLocale);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const dict = DICTIONARIES[locale];
    const fallback = DICTIONARIES[DEFAULT_LOCALE];
    return {
      locale,
      setLocale: (l) => {
        setLocaleState(l);
        try {
          window.localStorage.setItem(LOCALE_STORAGE_KEY, l);
        } catch {
          /* ignora — sem storage não persiste */
        }
      },
      t: (key, vars) => interpolate(dict[key] ?? fallback[key] ?? key, vars),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nContextValue['t'] {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback seguro: se alguém usar useT fora do provider (ex.: testes),
    // devolve as keys no idioma default sem quebrar.
    return (key, vars) => interpolate(DICTIONARIES[DEFAULT_LOCALE][key] ?? key, vars);
  }
  return ctx.t;
}

export function useLocale(): {
  locale: SupportedLocale;
  setLocale: (l: SupportedLocale) => void;
} {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return { locale: DEFAULT_LOCALE, setLocale: () => {} };
  }
  return { locale: ctx.locale, setLocale: ctx.setLocale };
}

export { SUPPORTED_LOCALES, LOCALE_LABELS, LOCALE_FLAGS };
export type { SupportedLocale, TranslationKey };
