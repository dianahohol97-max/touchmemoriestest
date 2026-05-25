'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { ConsentState, DEFAULT_CONSENT, CONSENT_STORAGE_KEY } from './types';

interface ConsentContextValue {
  consent: ConsentState;
  hasDecided: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  updateConsent: (partial: Partial<Omit<ConsentState, 'essential' | 'decidedAt' | 'version'>>) => void;
  reopenBanner: () => void;
  bannerVisible: boolean;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentState>(DEFAULT_CONSENT);
  const [hydrated, setHydrated] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ConsentState;
        if (parsed.version === DEFAULT_CONSENT.version) {
          setConsent({ ...DEFAULT_CONSENT, ...parsed, essential: true });
          if (!parsed.decidedAt) setBannerVisible(true);
        } else {
          setBannerVisible(true);
        }
      } else {
        setBannerVisible(true);
      }
    } catch (e) {
      console.error('Consent hydration failed:', e);
      setBannerVisible(true);
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: ConsentState) => {
    setConsent(next);
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('Consent persist failed:', e);
    }
    window.dispatchEvent(new CustomEvent('tm-consent-change', { detail: next }));
  }, []);

  const acceptAll = useCallback(() => {
    persist({
      essential: true,
      analytics: true,
      marketing: true,
      functional: true,
      decidedAt: new Date().toISOString(),
      version: DEFAULT_CONSENT.version,
    });
    setBannerVisible(false);
  }, [persist]);

  const rejectAll = useCallback(() => {
    persist({
      essential: true,
      analytics: false,
      marketing: false,
      functional: false,
      decidedAt: new Date().toISOString(),
      version: DEFAULT_CONSENT.version,
    });
    setBannerVisible(false);
  }, [persist]);

  const updateConsent = useCallback(
    (partial: Partial<Omit<ConsentState, 'essential' | 'decidedAt' | 'version'>>) => {
      persist({
        ...consent,
        ...partial,
        essential: true,
        decidedAt: new Date().toISOString(),
        version: DEFAULT_CONSENT.version,
      });
      setBannerVisible(false);
    },
    [consent, persist]
  );

  const reopenBanner = useCallback(() => setBannerVisible(true), []);

  const value: ConsentContextValue = {
    consent: hydrated ? consent : DEFAULT_CONSENT,
    hasDecided: hydrated && consent.decidedAt !== null,
    acceptAll,
    rejectAll,
    updateConsent,
    reopenBanner,
    bannerVisible: hydrated && bannerVisible,
  };

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used within ConsentProvider');
  return ctx;
}
