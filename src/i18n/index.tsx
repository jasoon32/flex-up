import '@/lib/localStorage';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { en, type Strings } from './en';
import { zh } from './zh';

export type Lang = 'en' | 'zh';
export type { Strings };

const STRINGS: Record<Lang, Strings> = { en, zh };
const STORAGE_KEY = 'flexup.lang';

/** Shown in each language's own script in the picker. */
export const LANGUAGES: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'zh', label: '简体中文' },
];

function readSaved(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'zh' ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

let current: Lang = readSaved();

/** Current language for non-React code. */
export const currentLang = (): Lang => current;

/** Current strings for non-React code (validation, error messages, formatters). */
export const strings = (): Strings => STRINGS[current];

/** BCP 47 locale for dates and numbers. */
export const locale = (): string => (current === 'zh' ? 'zh-CN' : 'en-GB');

interface I18n {
  lang: Lang;
  t: Strings;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18n>({ lang: current, t: STRINGS[current], setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);

  const value = useMemo<I18n>(
    () => ({
      lang,
      t: STRINGS[lang],
      setLang: (next) => {
        current = next;
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // Not persisted; the choice still applies for this launch.
        }
        setLangState(next);
      },
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
