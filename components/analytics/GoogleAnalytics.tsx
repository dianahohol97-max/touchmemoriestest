'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { useConsent } from '@/lib/consent/ConsentProvider';

export function GoogleAnalytics() {
  const { consent } = useConsent();
  const [shouldLoad, setShouldLoad] = useState(false);

  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT;

  useEffect(() => {
    if (consent.analytics && gaId) setShouldLoad(true);
  }, [consent.analytics, gaId]);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.analytics) setShouldLoad(true);
    }
    window.addEventListener('tm-consent-change', handler);
    return () => window.removeEventListener('tm-consent-change', handler);
  }, []);

  if (!gaId || !shouldLoad) return null;

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'granted',
          });
          gtag('config', '${gaId}', {
            anonymize_ip: true,
            send_page_view: true,
          });
        `}
      </Script>
    </>
  );
}
