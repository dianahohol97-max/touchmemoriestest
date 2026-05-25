'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useConsent } from '@/lib/consent/ConsentProvider';

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

export function MetaPixel() {
  const { consent } = useConsent();
  const [shouldLoad, setShouldLoad] = useState(false);
  const pathname = usePathname();

  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

  useEffect(() => {
    if (consent.marketing && pixelId) setShouldLoad(true);
  }, [consent.marketing, pixelId]);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.marketing) setShouldLoad(true);
    }
    window.addEventListener('tm-consent-change', handler);
    return () => window.removeEventListener('tm-consent-change', handler);
  }, []);

  useEffect(() => {
    if (shouldLoad && pathname && window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, [pathname, shouldLoad]);

  if (!pixelId || !shouldLoad) return null;

  return (
    <>
      <Script id="fb-pixel-init" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
