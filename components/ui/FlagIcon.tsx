'use client';

import type { Locale } from '@/lib/i18n/context';

/**
 * Inline SVG circular flags for the language switcher.
 *
 * We render real SVGs instead of emoji flags (🇺🇦 etc) because Windows does
 * NOT render regional-indicator emoji as flags — it falls back to the two
 * letters of the country code ("UA"), which duplicated the language label
 * and produced "UA UA" in the header. SVGs render identically everywhere.
 *
 * Each flag is drawn inside a circle (clipped) so it reads as a tidy badge.
 */
export function FlagIcon({ code, size = 18 }: { code: Locale; size?: number }) {
    const id = `flag-clip-${code}`;
    const common = {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        xmlns: 'http://www.w3.org/2000/svg',
        style: { display: 'block', flexShrink: 0 },
        'aria-hidden': true,
    } as const;

    switch (code) {
        case 'uk': // Ukraine — blue over yellow
            return (
                <svg {...common}>
                    <clipPath id={id}><circle cx="12" cy="12" r="12" /></clipPath>
                    <g clipPath={`url(#${id})`}>
                        <rect width="24" height="12" fill="#0057B7" />
                        <rect y="12" width="24" height="12" fill="#FFD700" />
                    </g>
                </svg>
            );
        case 'en': // United Kingdom — simplified Union Jack
            return (
                <svg {...common}>
                    <clipPath id={id}><circle cx="12" cy="12" r="12" /></clipPath>
                    <g clipPath={`url(#${id})`}>
                        <rect width="24" height="24" fill="#012169" />
                        <path d="M0 0L24 24M24 0L0 24" stroke="#fff" strokeWidth="4" />
                        <path d="M0 0L24 24M24 0L0 24" stroke="#C8102E" strokeWidth="2" />
                        <path d="M12 0V24M0 12H24" stroke="#fff" strokeWidth="6" />
                        <path d="M12 0V24M0 12H24" stroke="#C8102E" strokeWidth="3.5" />
                    </g>
                </svg>
            );
        case 'ro': // Romania — blue, yellow, red vertical
            return (
                <svg {...common}>
                    <clipPath id={id}><circle cx="12" cy="12" r="12" /></clipPath>
                    <g clipPath={`url(#${id})`}>
                        <rect width="8" height="24" fill="#002B7F" />
                        <rect x="8" width="8" height="24" fill="#FCD116" />
                        <rect x="16" width="8" height="24" fill="#CE1126" />
                    </g>
                </svg>
            );
        case 'pl': // Poland — white over red
            return (
                <svg {...common}>
                    <clipPath id={id}><circle cx="12" cy="12" r="12" /></clipPath>
                    <g clipPath={`url(#${id})`}>
                        <rect width="24" height="12" fill="#fff" />
                        <rect y="12" width="24" height="12" fill="#DC143C" />
                    </g>
                </svg>
            );
        case 'de': // Germany — black, red, gold horizontal
            return (
                <svg {...common}>
                    <clipPath id={id}><circle cx="12" cy="12" r="12" /></clipPath>
                    <g clipPath={`url(#${id})`}>
                        <rect width="24" height="8" fill="#000" />
                        <rect y="8" width="24" height="8" fill="#DD0000" />
                        <rect y="16" width="24" height="8" fill="#FFCE00" />
                    </g>
                </svg>
            );
        default:
            return null;
    }
}
