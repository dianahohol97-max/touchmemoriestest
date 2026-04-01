'use client';

import { useEffect } from 'react';
import { I18nProvider } from './context';
import type { Locale } from './context';

// This component initializes the locale from server-side URL params
// and passes it to the client I18nProvider
export function I18nServerProvider({
    children,
    locale,
}: {
    children: React.ReactNode;
    locale: Locale;
}) {
    return (
        <I18nProvider initialLocale={locale}>
            {children}
        </I18nProvider>
    );
}
