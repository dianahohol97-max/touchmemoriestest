'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import uk from '@/locales/uk.json';
import en from '@/locales/en.json';
import ro from '@/locales/ro.json';
import pl from '@/locales/pl.json';
import de from '@/locales/de.json';

export type Locale = 'uk' | 'en' | 'ro' | 'pl' | 'de';
export const LOCALES: { code: Locale; label: string; flag: string }[] = [
    { code: 'uk', label: 'UA', flag: '🇺🇦' },
    { code: 'en', label: 'EN', flag: '🇬🇧' },
    { code: 'ro', label: 'RO', flag: '🇷🇴' },
    { code: 'pl', label: 'PL', flag: '🇵🇱' },
    { code: 'de', label: 'DE', flag: '🇩🇪' },
];

// International locales — auto-select international payment
export const INTERNATIONAL_LOCALES: Locale[] = ['en', 'ro', 'pl', 'de'];

const TRANSLATIONS: Record<Locale, any> = { uk, en, ro, pl, de };

const STORAGE_KEY = 'tm_locale';

interface I18nContextType {
    locale: Locale;
    setLocale: (l: Locale) => void;
    t: (key: string) => string;
    isInternational: boolean;
}

const I18nContext = createContext<I18nContextType>({
    locale: 'uk',
    setLocale: () => {},
    t: (k) => k,
    isInternational: false,
});

function getNestedValue(obj: any, path: string): string {
    const keys = path.split('.');
    let val = obj;
    for (const key of keys) {
        if (val == null) return path;
        val = val[key];
    }
    return typeof val === 'string' ? val : path;
}

function detectBrowserLocale(): Locale {
    if (typeof window === 'undefined') return 'uk';
    const lang = navigator.language?.toLowerCase().split('-')[0];
    if (lang === 'uk' || lang === 'ru') return 'uk'; // Ukrainian and Russian → UA
    if (lang === 'en') return 'en';
    if (lang === 'ro') return 'ro';
    if (lang === 'pl') return 'pl';
    if (lang === 'de') return 'de';
    return 'uk'; // fallback
}

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('uk');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // 1. Check localStorage
        const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
        if (saved && LOCALES.find(l => l.code === saved)) {
            setLocaleState(saved);
        } else {
            // 2. Auto-detect from browser
            const detected = detectBrowserLocale();
            setLocaleState(detected);
        }
        setMounted(true);
    }, []);

    const setLocale = useCallback((l: Locale) => {
        setLocaleState(l);
        localStorage.setItem(STORAGE_KEY, l);
    }, []);

    const t = useCallback((key: string): string => {
        return getNestedValue(TRANSLATIONS[locale], key) || getNestedValue(TRANSLATIONS['uk'], key) || key;
    }, [locale]);

    const isInternational = INTERNATIONAL_LOCALES.includes(locale);

    if (!mounted) return <>{children}</>;

    return (
        <I18nContext.Provider value={{ locale, setLocale, t, isInternational }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useTranslation() {
    return useContext(I18nContext);
}

// Standalone hook for components that just need t()
export function useT() {
    const { t } = useContext(I18nContext);
    return t;
}
