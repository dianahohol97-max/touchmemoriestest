'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import uk from '@/locales/uk.json';
import en from '@/locales/en.json';
import ro from '@/locales/ro.json';
import pl from '@/locales/pl.json';
import de from '@/locales/de.json';

export type Locale = 'uk' | 'en' | 'ro' | 'pl' | 'de';

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
    { code: 'uk', label: 'UA', flag: '' },
    { code: 'en', label: 'EN', flag: '' },
    { code: 'ro', label: 'RO', flag: '' },
    { code: 'pl', label: 'PL', flag: '' },
    { code: 'de', label: 'DE', flag: '' },
];

export const INTERNATIONAL_LOCALES: Locale[] = ['en', 'ro', 'pl', 'de'];
const TRANSLATIONS: Record<Locale, any> = { uk, en, ro, pl, de };

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

export function I18nProvider({
    children,
    initialLocale,
}: {
    children: ReactNode;
    initialLocale?: Locale;
}) {
    const [locale, setLocaleState] = useState<Locale>(initialLocale || 'uk');

    useEffect(() => {
        if (initialLocale) {
            setLocaleState(initialLocale);
            return;
        }
        // Fallback: detect from localStorage if no initialLocale
        const saved = localStorage.getItem('tm_locale') as Locale | null;
        if (saved && LOCALES.find(l => l.code === saved)) {
            setLocaleState(saved);
        }
    }, [initialLocale]);

    const setLocale = useCallback((l: Locale) => {
        setLocaleState(l);
        localStorage.setItem('tm_locale', l);
        // Navigate to new locale URL
        if (typeof window !== 'undefined') {
            const path = window.location.pathname;
            const localePattern = /^\/(uk|en|ro|pl|de)(\/|$)/;
            const newPath = localePattern.test(path)
                ? path.replace(localePattern, `/${l}$2`)
                : `/${l}${path}`;
            window.location.href = newPath;
        }
    }, []);

    const t = useCallback((key: string): string => {
        return getNestedValue(TRANSLATIONS[locale], key)
            || getNestedValue(TRANSLATIONS['uk'], key)
            || key;
    }, [locale]);

    const isInternational = INTERNATIONAL_LOCALES.includes(locale);

    return (
        <I18nContext.Provider value={{ locale, setLocale, t, isInternational }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useTranslation() {
    return useContext(I18nContext);
}

export function useT() {
    return useContext(I18nContext).t;
}

export function useLocale() {
    return useContext(I18nContext).locale;
}
