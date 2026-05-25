'use client';

import { useState } from 'react';
import { useConsent } from '@/lib/consent/ConsentProvider';
import { useT } from '@/lib/i18n/context';

export function CookieBanner() {
  const { bannerVisible, acceptAll, rejectAll, updateConsent, consent } = useConsent();
  const t = useT();
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    functional: consent.functional,
    analytics: consent.analytics,
    marketing: consent.marketing,
  });

  const handleAcceptAll = () => {
    acceptAll();
    logConsent('cookies_accepted', { essential: true, functional: true, analytics: true, marketing: true });
  };

  const handleRejectAll = () => {
    rejectAll();
    logConsent('cookies_rejected', { essential: true, functional: false, analytics: false, marketing: false });
  };

  const handleSave = () => {
    updateConsent(settings);
    const action = settings.analytics || settings.marketing || settings.functional ? 'cookies_partial' : 'cookies_rejected';
    logConsent(action, { essential: true, ...settings });
  };

  if (!bannerVisible) return null;

  if (showSettings) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowSettings(false)} />
        <div style={{ position: 'relative', background: '#fff', borderRadius: 16, padding: '32px', maxWidth: 500, width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
          <button onClick={() => setShowSettings(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#94a3b8' }}>×</button>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e2d7d', marginBottom: 20 }}>{t('cookieBanner.settings')}</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CategoryToggle title={t('cookieBanner.necessary.title')} description={t('cookieBanner.necessary.description')} checked={true} disabled />
            <CategoryToggle title={t('cookieBanner.functional.title')} description={t('cookieBanner.functional.description')} checked={settings.functional} onChange={(v) => setSettings({ ...settings, functional: v })} />
            <CategoryToggle title={t('cookieBanner.analytics.title')} description={t('cookieBanner.analytics.description')} checked={settings.analytics} onChange={(v) => setSettings({ ...settings, analytics: v })} />
            <CategoryToggle title={t('cookieBanner.marketing.title')} description={t('cookieBanner.marketing.description')} checked={settings.marketing} onChange={(v) => setSettings({ ...settings, marketing: v })} />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button onClick={handleSave} style={{ flex: 1, padding: '12px 20px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              {t('cookieBanner.save')}
            </button>
            <button onClick={handleAcceptAll} style={{ flex: 1, padding: '12px 20px', background: '#f0f3ff', color: '#1e2d7d', border: '1.5px solid #c7d2fe', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              {t('cookieBanner.acceptAll')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, display: 'flex', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', maxWidth: 600, width: '100%', boxShadow: '0 -4px 30px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e2d7d', marginBottom: 8 }}>{t('cookieBanner.title')}</h3>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5, marginBottom: 16 }}>{t('cookieBanner.description')}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={handleAcceptAll} style={{ padding: '10px 20px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {t('cookieBanner.acceptAll')}
          </button>
          <button onClick={handleRejectAll} style={{ padding: '10px 20px', background: '#f1f5f9', color: '#475569', border: '1.5px solid #e2e8f0', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {t('cookieBanner.rejectAll')}
          </button>
          <button onClick={() => setShowSettings(true)} style={{ padding: '10px 16px', background: 'none', border: 'none', color: '#6366f1', fontWeight: 600, fontSize: 14, cursor: 'pointer', textDecoration: 'underline' }}>
            {t('cookieBanner.settings')}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryToggle({ title, description, checked, disabled, onChange }: {
  title: string; description: string; checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: disabled ? '#f8fafc' : '#fff', borderRadius: 10, border: '1px solid #e2e8f0', opacity: disabled ? 0.7 : 1 }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange?.(e.target.checked)}
        style={{ width: 20, height: 20, marginTop: 2, cursor: disabled ? 'not-allowed' : 'pointer', accentColor: '#1e2d7d' }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{description}</div>
      </div>
    </div>
  );
}

function logConsent(action: string, categories: Record<string, boolean>) {
  fetch('/api/consent/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, categories }),
  }).catch(() => {});
}
