'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Instagram / Facebook in-app browser warning.
 *
 * ~98% of traffic arrives from Instagram, whose built-in webview regularly
 * fails to load the heavy constructor pages ("This page couldn't load" —
 * recurring support DMs). On editor/constructor/order routes, when the user
 * agent is an in-app webview, show a prominent dismissible banner explaining
 * how to open the site in a real browser (⋯ → Open in external browser).
 * Detection is UA-based: Instagram, FB_IAB/FBAN/FBAV (Facebook), Threads.
 */
const HEAVY_ROUTES = ['/editor', '/constructor', '/order', '/checkout'];

export default function InAppBrowserBanner() {
    const pathname = usePathname() || '';
    const [show, setShow] = useState(false);

    useEffect(() => {
        try {
            if (sessionStorage.getItem('tm_inapp_banner_dismissed')) return;
            const ua = navigator.userAgent || '';
            const inApp = /Instagram|FB_IAB|FBAN|FBAV|Threads/i.test(ua);
            const onHeavyRoute = HEAVY_ROUTES.some(r => pathname.includes(r));
            setShow(inApp && onHeavyRoute);
        } catch { /* ignore */ }
    }, [pathname]);

    if (!show) return null;

    return (
        <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999,
            background: '#263A99', color: '#fff', padding: '14px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
            boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
        }}>
            <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>🌐</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
                        Редактор може не працювати в Instagram
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.95 }}>
                        Натисніть <b>⋯</b> у правому верхньому куті та оберіть <b>«Відкрити в браузері»</b> — і все запрацює у Safari чи Chrome.
                    </div>
                </div>
                <button
                    onClick={() => { setShow(false); try { sessionStorage.setItem('tm_inapp_banner_dismissed', '1'); } catch {} }}
                    aria-label="Закрити"
                    style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
                >✕</button>
            </div>
        </div>
    );
}
