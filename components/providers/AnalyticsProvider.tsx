'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

// Replace these with your actual IDs in production (e.g., from env variables)
export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-XXXXXXXXXX';
export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || 'XXXXXXXXXXXXXXXX';

// Global types for window.gtag and window.fbq
declare global {
    interface Window {
        gtag: (...args: any[]) => void;
        fbq: (...args: any[]) => void;
        dataLayer: any[];
        _fbq: any;
    }
}

export function AnalyticsProvider() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Handle route changes
    useEffect(() => {
        if (pathname && window.gtag) {
            window.gtag('config', GA_TRACKING_ID, {
                page_path: pathname,
            });
        }

        if (pathname && window.fbq) {
            window.fbq('track', 'PageView');
        }
    }, [pathname, searchParams]);

    return (
        <>
            {/* Google Analytics 4 */}
            <Script
                strategy="afterInteractive"
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
            />
            <Script
                id="gtag-init"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_TRACKING_ID}', {
              page_path: window.location.pathname,
            });
          `,
                }}
            />

            {/* Meta Pixel */}
            <Script
                id="fb-pixel"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${FB_PIXEL_ID}');
            fbq('track', 'PageView');
          `,
                }}
            />
            <noscript>
                <img
                    height="1"
                    width="1"
                    style={{ display: 'none' }}
                    src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
                />
            </noscript>
        </>
    );
}

// Helper functions for tracking specific ecommerce events

export const trackViewItem = (product: any) => {
    if (typeof window === 'undefined') return;

    const itemData = {
        item_id: product.id,
        item_name: product.name,
        item_category: product.category_id,
        price: product.price,
        currency: 'UAH',
    };

    if (window.gtag) {
        window.gtag('event', 'view_item', {
            currency: 'UAH',
            value: product.price,
            items: [itemData],
        });
    }

    if (window.fbq) {
        window.fbq('track', 'ViewContent', {
            content_ids: [product.id],
            content_type: 'product',
            value: product.price,
            currency: 'UAH',
        });
    }
};

export const trackAddToCart = (product: any, quantity: number = 1) => {
    if (typeof window === 'undefined') return;

    const itemData = {
        item_id: product.id,
        item_name: product.name,
        item_category: product.category_id,
        price: product.price,
        quantity: quantity,
    };

    if (window.gtag) {
        window.gtag('event', 'add_to_cart', {
            currency: 'UAH',
            value: product.price * quantity,
            items: [itemData],
        });
    }

    if (window.fbq) {
        window.fbq('track', 'AddToCart', {
            content_ids: [product.id],
            content_type: 'product',
            value: product.price * quantity,
            currency: 'UAH',
        });
    }
};

export const trackBeginCheckout = (cartItems: any[], totalValue: number) => {
    if (typeof window === 'undefined') return;

    const items = cartItems.map((item) => ({
        item_id: item.id || item.product_id,
        item_name: item.name || item.title,
        price: item.price,
        quantity: item.quantity,
    }));

    if (window.gtag) {
        window.gtag('event', 'begin_checkout', {
            currency: 'UAH',
            value: totalValue,
            items: items,
        });
    }

    if (window.fbq) {
        window.fbq('track', 'InitiateCheckout', {
            content_ids: items.map(i => i.item_id),
            num_items: items.reduce((sum, item) => sum + item.quantity, 0),
            value: totalValue,
            currency: 'UAH',
        });
    }
};

export const trackPurchase = (orderId: string, cartItems: any[], totalValue: number) => {
    if (typeof window === 'undefined') return;

    const items = cartItems.map((item) => ({
        item_id: item.id || item.product_id,
        item_name: item.name || item.title,
        price: item.price,
        quantity: item.quantity || 1,
    }));

    if (window.gtag) {
        window.gtag('event', 'purchase', {
            transaction_id: orderId,
            currency: 'UAH',
            value: totalValue,
            items: items,
        });
    }

    if (window.fbq) {
        window.fbq('track', 'Purchase', {
            content_ids: items.map(i => i.item_id),
            content_type: 'product',
            value: totalValue,
            currency: 'UAH',
        });
    }
};
