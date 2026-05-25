export type ConsentCategory = 'essential' | 'analytics' | 'marketing' | 'functional';

export interface ConsentState {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  decidedAt: string | null;
  version: number;
}

export const DEFAULT_CONSENT: ConsentState = {
  essential: true,
  analytics: false,
  marketing: false,
  functional: false,
  decidedAt: null,
  version: 1,
};

export const CONSENT_STORAGE_KEY = 'tm_consent_v1';
