'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LANDING_THEMES } from '@/lib/photographers/themes';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

interface Profile {
  id: string; slug: string; name: string; bio: string | null; email: string;
  phone: string | null; instagram: string | null; website: string | null;
  logo_url: string | null; avatar_url: string | null;
  city: string | null; specialization: string | null;
  landing_enabled: boolean; landing_theme: string | null;
  pricing: PriceRow[]; portfolio: string[];
  custom_domain: string | null; custom_domain_paid: boolean;
  booking_enabled: boolean;
  pay_mono_enabled: boolean; pay_mono_link: string | null;
  pay_wfp_enabled: boolean; pay_wfp_link: string | null;
  pay_requisites_enabled: boolean; pay_requisites: string | null;
}
interface Slot {
  id: string; slot_date: string; slot_time: string; duration_min: number;
  price: string | null; status: string; payment_status: string;
  client_name: string | null; client_phone: string | null; client_comment: string | null;
}
interface PriceRow { title: string; price: string; description?: string }
export interface Gallery {
  id: string; client_token: string; title: string; client_name: string | null;
  shoot_date: string | null; expires_at: string; files_purged_at: string | null;
  photo_count: number; favorite_count: number; days_left: number;
  photo_downloads: number; zip_downloads: number;
  cover_photo_id: string | null;
  cover_url: string | null;
  design: Record<string, string> | null;
}
export interface CabinetPhoto { id: string; file_name: string; url: string; favorite: boolean; media_type?: 'photo' | 'video' }

// Brand-styled building blocks (touch.memories palette: Soft White bg, Sand
// borders, Charcoal text, Brand Blue accents, Montserrat headings).
export const card: React.CSSProperties = { background: '#fff', border: '1px solid #E8DCC8', borderRadius: 16, padding: 22, marginBottom: 18 };
export const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#55504a', marginBottom: 4, marginTop: 12 };
export const input: React.CSSProperties = { width: '100%', border: '1px solid #ddd2bd', borderRadius: 10, padding: '10px 13px', fontSize: 14, boxSizing: 'border-box', background: '#fff' };
export const btn: React.CSSProperties = { background: '#263A99', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-heading), sans-serif' };
export const btnGhost: React.CSSProperties = { ...btn, background: '#fff', color: '#263A99', border: '1px solid #c9d0ee' };
export const sectionTitle: React.CSSProperties = { fontFamily: 'var(--font-heading), sans-serif', fontSize: 19, fontWeight: 800, color: '#1A1A1A', margin: 0 };

type CabinetTab = 'galleries' | 'earnings' | 'orders' | 'booking' | 'landing';

export default function CabinetClient({ token }: { token: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [b2bStatus, setB2bStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<CabinetTab>('galleries');

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 2500); };

  const loadAll = async () => {
    const [pRes, gRes] = await Promise.all([
      fetch(`/api/photographers/profile?token=${encodeURIComponent(token)}`),
      fetch(`/api/photographers/galleries?token=${encodeURIComponent(token)}`),
    ]);
    const pJson = await pRes.json();
    const gJson = await gRes.json();
    if (!pRes.ok) { setError(pJson?.error || 'Кабінет не знайдено'); return; }
    setProfile(pJson.photographer);
    setB2bStatus(pJson.b2b_status ?? null);
    setGalleries(gJson.galleries || []);
  };

  useEffect(() => { loadAll().finally(() => setLoading(false)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  if (loading) return <Centered>Завантаження…</Centered>;
  if (error || !profile) return <Centered>{error || 'Кабінет не знайдено'}</Centered>;

  // Tab navigation instead of one endless scroll — Diana's UX complaint
  // («незручна і не юзабельна»). Booking/візитка tabs appear only behind the
  // landing_enabled feature flag.
  const TABS: { id: CabinetTab; label: string }[] = [
    { id: 'galleries', label: 'Галереї' },
    { id: 'earnings', label: 'Заробіток' },
    { id: 'orders', label: 'Замовлення' },
    ...(profile.landing_enabled
      ? [{ id: 'booking' as const, label: 'Запис на зйомку' }, { id: 'landing' as const, label: 'Візитка' }]
      : []),
  ];
  const favTotal = galleries.reduce((s, g) => s + (g.favorite_count || 0), 0);

  return (
    // Site header + footer wrap the cabinet — paddingTop clears the fixed
    // Navigation.
    <div style={{ background: '#FAF8F5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
    <Navigation />
    <main style={{ flex: 1, paddingTop: 110 }}>
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '28px 16px 80px', fontFamily: 'var(--font-body), sans-serif', color: '#1A1A1A' }}>

      {/* Header: identity + quick stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading), sans-serif', fontSize: 27, fontWeight: 900, color: '#1A1A1A', margin: 0 }}>
            Кабінет фотографа
          </h1>
          <p style={{ color: '#8B8378', margin: '4px 0 0', fontSize: 14 }}>
            {profile.name}
            {profile.landing_enabled && (
              <> · <a href={`/uk/photographer/${profile.slug}`} target="_blank" style={{ color: '#263A99', fontWeight: 600 }}>ваша публічна сторінка ↗</a></>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ background: '#fff', border: '1px solid #E8DCC8', borderRadius: 12, padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 800, fontSize: 18, color: '#263A99' }}>{galleries.length}</div>
            <div style={{ fontSize: 11.5, color: '#8B8378' }}>галерей</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #E8DCC8', borderRadius: 12, padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 800, fontSize: 18, color: '#a5504f' }}>♥ {favTotal}</div>
            <div style={{ fontSize: 11.5, color: '#8B8378' }}>обрано клієнтами</div>
          </div>
        </div>
      </div>

      <DiscountBanner status={b2bStatus} />

      {/* Tab bar — sticky so navigation survives long lists; scrolls
          horizontally on narrow screens instead of wrapping into a mess. */}
      <div style={{ position: 'sticky', top: 86, zIndex: 40, background: '#FAF8F5', margin: '0 -4px 18px', padding: '6px 4px' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', background: '#fff', border: '1px solid #E8DCC8', borderRadius: 999, padding: 5 }}>
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              style={{
                flex: '0 0 auto', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                borderRadius: 999, padding: '9px 18px', fontSize: 14, fontWeight: 700,
                fontFamily: 'var(--font-heading), sans-serif',
                background: tab === t.id ? '#263A99' : 'transparent',
                color: tab === t.id ? '#fff' : '#55504a',
                transition: 'background .15s, color .15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {notice && <div style={{ position: 'fixed', top: 16, right: 16, background: '#065f46', color: '#fff', borderRadius: 10, padding: '10px 16px', zIndex: 100, fontSize: 14 }}>{notice}</div>}

      {tab === 'galleries' && (
        <>
          <StorageSection token={token} />
          <GalleriesSection token={token} galleries={galleries} onChanged={loadAll} flash={flash} />
        </>
      )}
      {tab === 'earnings' && <ReferralSection token={token} flash={flash} />}
      {tab === 'orders' && <OrdersSection token={token} />}
      {/* Booking/візитка live behind the landing_enabled feature flag while
          their design is finished (Diana, 2026-08-04). */}
      {tab === 'booking' && profile.landing_enabled && (
        <BookingCabinetSection token={token} profile={profile} onChanged={loadAll} flash={flash} />
      )}
      {tab === 'landing' && profile.landing_enabled && (
        <>
          <ProfileSection token={token} profile={profile} onChanged={loadAll} flash={flash} />
          <LandingSection token={token} profile={profile} onChanged={loadAll} flash={flash} />
        </>
      )}
    </div>
    </main>
    <Footer categories={[]} />
    </div>
  );
}

/* ── Плашка про купівельну знижку 10% (два різні входи) ──────────────── */

function DiscountBanner({ status }: { status: string | null }) {
  // verified — discount active; pending — applied but awaiting approval;
  // null / other — no application yet (this cabinet may be self-service only).
  if (status === 'verified') {
    return (
      <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ fontWeight: 800, color: '#065f46', fontSize: 15, marginBottom: 2 }}>Ваша знижка 10% активна</div>
        <div style={{ fontSize: 13, color: '#047857', marginBottom: 10 }}>
          Замовлення робиться як звичайна покупка на сайті: <b>увійдіть у свій акаунт покупця</b> (той самий email і пароль, що при реєстрації), оберіть товар у каталозі — і ціна зі знижкою застосується автоматично в каталозі та кошику, жодних промокодів вводити не треба.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="/uk" style={{ display: 'inline-block', background: '#065f46', color: '#fff', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
            Перейти до каталогу
          </a>
          <a href="/uk/login" style={{ display: 'inline-block', background: '#fff', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
            Увійти в акаунт
          </a>
        </div>
      </div>
    );
  }
  if (status === 'pending') {
    return (
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ fontWeight: 800, color: '#92400e', fontSize: 15, marginBottom: 2 }}>⏳ Заявку на знижку 10% розглядаємо</div>
        <div style={{ fontSize: 13, color: '#b45309' }}>
          Щойно ми підтвердимо заявку, знижка на фотокниги, журнали, фотодрук і тревелбуки увімкнеться у вашому акаунті автоматично — і ви зможете купувати за спеціальною ціною.
        </div>
      </div>
    );
  }
  // No approved application yet — the discount and referral earnings are
  // moderated (Diana, 2026-08-04 second pass), so steer to the application.
  return (
    <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
      <div style={{ fontWeight: 800, color: '#1e2d7d', fontSize: 15, marginBottom: 2 }}>Хочете знижку 10% і заробіток з рекомендацій?</div>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
        Цей кабінет — для галерей і вашої сторінки. Окремо ви можете отримати <b>постійну знижку 10%</b> на фотокниги, журнали, фотодрук і тревелбуки та <b>відсоток з замовлень клієнтів</b> за вашим посиланням — подайте коротку заявку фотографа з портфоліо, ми розглянемо її вручну.
      </div>
      <a href="/uk/photographers/apply" style={{ display: 'inline-block', background: '#1e2d7d', color: '#fff', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
        Подати заявку фотографа
      </a>
    </div>
  );
}

/* ── Реферальна програма ─────────────────────────────────────────────── */

/**
 * The photographer's referral block. Enrolment and all money movement live in
 * the SAME program travel agencies use: GET /api/photographers/referral
 * lazily creates the agency_partners row (kind 'photographer') and hands back
 * that partner's token; summary + payout account + payout requests then go
 * through the existing /api/partnership/partner API, so there is exactly one
 * payout pipeline and the photographer appears in the admin partners list.
 */
function ReferralSection({ token, flash }: { token: string; flash: (m: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [partnerToken, setPartnerToken] = useState<string>('');
  const [err, setErr] = useState('');
  const [account, setAccount] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadSummary = async (pt: string) => {
    const r = await fetch(`/api/partnership/partner?token=${encodeURIComponent(pt)}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || 'Не вдалося завантажити');
    setData(j);
    setAccount(j?.partner?.payout_account || '');
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/photographers/referral?token=${encodeURIComponent(token)}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || 'Не вдалося завантажити');
        if (cancelled) return;
        if (j.pending) { setData({ pending: true }); return; }
        setPartnerToken(j.partner_token);
        await loadSummary(j.partner_token);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Помилка завантаження');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (err) return <div style={card}><h2 style={sectionTitle}>Реферальна програма</h2><div style={{ color: '#b91c1c', marginTop: 10, fontSize: 14 }}>{err}</div></div>;
  if (!data) return <div style={card}><h2 style={sectionTitle}>Реферальна програма</h2><div style={{ color: '#94a3b8', marginTop: 10 }}>Завантаження…</div></div>;

  // Gated until the moderated photographer application is approved — the same
  // review that unlocks the 10% discount unlocks earnings.
  if (data.pending) {
    return (
      <div style={card}>
        <h2 style={sectionTitle}>Реферальна програма</h2>
        <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.65, margin: '10px 0 12px' }}>
          Рекомендуйте нас клієнтам і отримуйте відсоток з кожного їхнього оплаченого замовлення, а клієнт — знижку 5%. Ця опція вмикається після підтвердження заявки фотографа, разом зі знижкою 10% на друк. Подайте заявку з посиланням на портфоліо, і ми розглянемо її вручну.
        </p>
        <a href="/uk/photographers/apply" style={{ display: 'inline-block', background: '#1e2d7d', color: '#fff', borderRadius: 8, padding: '10px 18px', fontWeight: 700, fontSize: 13.5, textDecoration: 'none' }}>
          Подати заявку фотографа
        </a>
      </div>
    );
  }

  const p = data.partner;
  const link = `https://touchmemories.com.ua/?ref=${p.referral_code}`;
  const minPayout = Number(data.min_payout) || 500;

  const copyLink = () => {
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const saveAccount = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/partnership/partner', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: partnerToken, payout_account: account }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Не вдалося зберегти');
      flash('Рахунок збережено');
      await loadSummary(partnerToken);
    } catch (e: any) { flash(e?.message || 'Помилка'); } finally { setBusy(false); }
  };

  const requestPayout = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/partnership/partner', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: partnerToken, action: 'request_payout' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Не вдалося надіслати запит');
      flash('Запит на виплату надіслано');
      await loadSummary(partnerToken);
    } catch (e: any) { flash(e?.message || 'Помилка'); } finally { setBusy(false); }
  };

  return (
    <div style={card}>
      <h2 style={sectionTitle}>Реферальна програма</h2>
      <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.65, margin: '10px 0 14px' }}>
        Діліться посиланням із клієнтами після зйомки. Клієнт отримує знижку 5% на замовлення, а ви — {Number(p.travelbook_rate)}% з тревелбуків і глянцевих журналів та {Number(p.other_rate)}% з решти товарів кожного оплаченого замовлення за вашим кодом. Виплата доступна від {minPayout} ₴.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <input readOnly value={link}
          style={{ flex: 1, minWidth: 220, padding: '11px 13px', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13.5, background: '#f8fafc', color: '#475569' }} />
        <button onClick={copyLink}
          style={{ padding: '11px 18px', background: copied ? '#16a34a' : '#1e2d7d', color: '#fff', borderRadius: 9, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 13.5, whiteSpace: 'nowrap' }}>
          {copied ? 'Скопійовано' : 'Копіювати'}
        </button>
      </div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        Ваш код: <b style={{ color: '#1e2d7d', letterSpacing: '0.04em' }}>{p.referral_code}</b> — клієнт може ввести його і вручну на касі, результат той самий.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={{ background: '#eff3ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: '14px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1e2d7d' }}>{Number(p.pending_payout).toFixed(0)} ₴</div>
          <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>До виплати</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1e2d7d' }}>{Number(p.total_earned).toFixed(0)} ₴</div>
          <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Зароблено всього</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1e2d7d' }}>{Number(p.total_paid_out).toFixed(0)} ₴</div>
          <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Виплачено</div>
        </div>
      </div>

      <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Рахунок для виплат (IBAN або номер картки)</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={account} onChange={e => setAccount(e.target.value)} placeholder="UA…"
            style={{ flex: 1, minWidth: 200, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13.5 }} />
          <button onClick={saveAccount} disabled={busy}
            style={{ padding: '10px 16px', background: '#374151', color: '#fff', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            Зберегти
          </button>
        </div>
        {p.payout_requested_at ? (
          <div style={{ marginTop: 10, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
            Запит на виплату надіслано {new Date(p.payout_requested_at).toLocaleDateString('uk-UA')} — очікуйте переказ.
          </div>
        ) : Number(p.pending_payout) >= minPayout ? (
          <button onClick={requestPayout} disabled={busy}
            style={{ marginTop: 10, padding: '10px 18px', background: '#16a34a', color: '#fff', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 13.5 }}>
            Запросити виплату ({Number(p.pending_payout).toFixed(0)} ₴)
          </button>
        ) : (
          <div style={{ marginTop: 10, fontSize: 12.5, color: '#94a3b8' }}>
            Виплату можна запросити, коли назбирається {minPayout} ₴.
          </div>
        )}
      </div>

      {Array.isArray(data.commissions) && data.commissions.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Останні нарахування</div>
          {data.commissions.slice(0, 8).map((c: any) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>{c.order_number} · {new Date(c.created_at).toLocaleDateString('uk-UA')}</span>
              <span style={{ fontWeight: 700, color: c.payout_status === 'paid' ? '#16a34a' : '#1e2d7d' }}>
                +{Number(c.total_commission).toFixed(0)} ₴{c.payout_status === 'paid' ? ' · виплачено' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Місце і тариф ───────────────────────────────────────────────────── */

interface UsageInfo {
  usage: { usedBytes: number; limitBytes: number; planId: string; planName: string; ratio: number; over: boolean };
  plan: { id: string; stored: string; expires_at: string | null };
  plans: { id: string; name: string; priceUah: number; storageGb: number; blurb: string; perks: string[] }[];
}

const fmtBytes = (b: number) => {
  const gb = b / 1024 / 1024 / 1024;
  if (gb < 1) return `${Math.round(b / 1024 / 1024)} МБ`;
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} ГБ`;
};

/** Storage meter + plan picker. Opens the plan list automatically once the
 *  photographer is close to the cap, which is exactly when they need it
 *  (Diana: «як тільки перевищив 4 ГБ, одразу пропонувалось оплатити»). */
function StorageSection({ token }: { token: string }) {
  const [info, setInfo] = useState<UsageInfo | null>(null);
  const [showPlans, setShowPlans] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/photographers/subscription?token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok) return;
      setInfo(json);
      if (json?.usage?.ratio >= 0.8) setShowPlans(true);
    } catch { /* the meter is informational — never break the cabinet */ }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const pay = async (planId: string) => {
    if (paying) return;
    setPaying(planId);
    try {
      const res = await fetch('/api/photographers/subscription', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, plan: planId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.payment_url) { alert(json?.error || 'Не вдалося створити рахунок'); return; }
      window.location.href = json.payment_url;
    } finally { setPaying(null); }
  };

  if (!info) return null;
  const { usage, plan, plans } = info;
  const pct = Math.round(usage.ratio * 100);
  const warn = usage.ratio >= 0.8;
  const barColor = usage.over ? '#b91c1c' : warn ? '#b45309' : '#263A99';

  return (
    <div style={{ ...card, border: warn ? '1px solid #fcd9a5' : card.border, background: warn ? '#fffdf7' : '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={sectionTitle}>Місце для галерей</h2>
        <button style={{ ...btnGhost, padding: '7px 14px' }} onClick={() => setShowPlans(v => !v)}>
          {showPlans ? 'Згорнути тарифи' : 'Змінити тариф'}
        </button>
      </div>

      <div style={{ fontSize: 13.5, color: '#55504a', marginTop: 8 }}>
        Тариф «{usage.planName}» — зайнято {fmtBytes(usage.usedBytes)} з {fmtBytes(usage.limitBytes)}
        {plan.expires_at && plan.id !== 'free' && (
          <> · діє до {new Date(plan.expires_at).toLocaleDateString('uk-UA')}</>
        )}
      </div>
      <div style={{ height: 8, borderRadius: 999, background: '#eee7db', marginTop: 8, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(2, pct)}%`, height: '100%', background: barColor, transition: 'width .3s' }} />
      </div>

      {usage.over && (
        <div style={{ marginTop: 10, fontSize: 13.5, color: '#b91c1c', fontWeight: 600 }}>
          Місце закінчилося — нові фото не завантажуються. Оберіть більший тариф або видаліть непотрібні галереї.
        </div>
      )}
      {!usage.over && warn && (
        <div style={{ marginTop: 10, fontSize: 13.5, color: '#b45309' }}>
          Залишилося менше пʼятої частини місця. Варто перейти на більший тариф, щоб не зупинитися посеред зйомки.
        </div>
      )}

      {showPlans && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginTop: 14 }}>
          {plans.map(p => {
            const isCurrent = p.id === usage.planId;
            return (
              <div key={p.id} style={{
                border: isCurrent ? '2px solid #263A99' : '1px solid #E8DCC8',
                borderRadius: 12, padding: '14px 14px 12px', background: '#fff',
              }}>
                <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 800, fontSize: 15 }}>{p.name}</div>
                <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 900, fontSize: 22, color: '#263A99', margin: '4px 0 2px' }}>
                  {p.priceUah === 0 ? 'Безкоштовно' : `${p.priceUah} ₴`}
                  {p.priceUah > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: '#8B8378' }}> / міс</span>}
                </div>
                <div style={{ fontSize: 13, color: '#55504a', marginBottom: 8 }}>{p.storageGb} ГБ</div>
                <div style={{ fontSize: 12, color: '#8B8378', lineHeight: 1.5, marginBottom: 10 }}>{p.blurb}</div>
                {isCurrent ? (
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#065f46', textAlign: 'center', padding: '8px 0' }}>Ваш тариф</div>
                ) : p.priceUah === 0 ? (
                  <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '8px 0' }}>Базовий</div>
                ) : (
                  <button style={{ ...btn, width: '100%', padding: '9px 0' }} disabled={!!paying} onClick={() => pay(p.id)}>
                    {paying === p.id ? 'Створюємо рахунок…' : 'Оплатити'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showPlans && (
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>
          Оплата карткою через Monobank, тариф вмикається одразу після оплати і діє 30 днів. Коли термін мине, кабінет повертається на безкоштовний тариф — уже завантажені галереї при цьому не видаляються.
        </div>
      )}
    </div>
  );
}

/* ── Мої замовлення (покупки зі знижкою) ─────────────────────────────── */

const ORDER_STATUS_UA: Record<string, string> = {
  new: 'Нове', pending: 'Очікує', confirmed: 'Підтверджено', production: 'У виробництві',
  shipped: 'Відправлено', delivered: 'Доставлено', cancelled: 'Скасовано', completed: 'Виконано',
};

interface CabinetOrder {
  id: string; order_number: string; created_at: string; order_status: string | null;
  payment_status: string | null; total: number | null; subtotal: number | null;
  discount_amount: number | null; discount_type: string | null; promo_code: string | null;
  items_count: number;
}

/** The photographer's own shop orders — so the discounted purchases live in
 *  the same cabinet as galleries and referral earnings (Diana, 2026-08-04:
 *  «адмінка для фотографів — галереї, реферали, замовлення зі знижкою»). */
function OrdersSection({ token }: { token: string }) {
  const [orders, setOrders] = useState<CabinetOrder[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/photographers/orders?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) { setError(json?.error || 'Не вдалося завантажити'); return; }
        setOrders(json.orders || []);
      } catch { if (!cancelled) setError('Не вдалося завантажити'); }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={sectionTitle}>Мої замовлення</h2>
        <a href="/uk/account" style={{ fontSize: 13, color: '#1e2d7d', fontWeight: 700 }}>Всі деталі в акаунті →</a>
      </div>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
        Покупки з вашого акаунта — знижка фотографа застосовується автоматично при оформленні.
      </p>

      {error && <div style={{ color: '#991b1b', fontSize: 13, marginTop: 8 }}>{error}</div>}
      {!error && orders === null && <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>Завантаження…</div>}
      {orders !== null && orders.length === 0 && (
        <div style={{ color: '#94a3b8', marginTop: 8, fontSize: 14 }}>
          Замовлень поки немає. Оберіть щось у <a href="/uk" style={{ color: '#1e2d7d' }}>каталозі</a> — ціна зі знижкою застосується автоматично.
        </div>
      )}

      {(orders || []).map(o => (
        <div key={o.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontWeight: 800 }}>№ {o.order_number}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              {new Date(o.created_at).toLocaleDateString('uk-UA')} · {o.items_count} тов. · {ORDER_STATUS_UA[o.order_status || ''] || o.order_status || '—'}
              {o.payment_status === 'paid' ? ' · оплачено' : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 900, color: '#1e2d7d' }}>{Number(o.total || 0).toFixed(0)} ₴</div>
            {Number(o.discount_amount || 0) > 0 && (
              <div style={{ fontSize: 12, fontWeight: 800, color: '#065f46', background: '#ecfdf5', borderRadius: 999, padding: '2px 10px', marginTop: 4 }}>
                знижка −{Number(o.discount_amount).toFixed(0)} ₴
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Галереї ─────────────────────────────────────────────────────────── */

function GalleriesSection({ token, galleries, onChanged, flash }: {
  token: string; galleries: Gallery[]; onChanged: () => Promise<void>; flash: (m: string) => void;
}) {
  // Creation moved to its own page (/gallery/new); this section is now a
  // pure list.
  const editorHref = (id: string) => `/uk/photographer/cabinet/${token}/gallery/${id}`;

  const copyLink = (g: Gallery) => {
    navigator.clipboard.writeText(`${window.location.origin}/uk/gallery/${g.client_token}`);
    flash('Посилання скопійовано');
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={sectionTitle}>Галереї клієнтів</h2>
        {/* Creating a gallery lives on its own page — an inline form read as
            "nothing happened" when the button was pressed (Diana). */}
        <a href={`/uk/photographer/cabinet/${token}/gallery/new`}
           style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>
          + Нова галерея
        </a>
      </div>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>Фото зберігаються 30 днів від створення галереї, після чого видаляються автоматично.</p>

      {galleries.length === 0 && (
        <div style={{ color: '#8B8378', marginTop: 14, fontSize: 14 }}>
          Поки що немає галерей. <a href={`/uk/photographer/cabinet/${token}/gallery/new`} style={{ color: '#263A99', fontWeight: 700 }}>Створити першу →</a>
        </div>
      )}

      {galleries.map(g => (
        <div key={g.id} style={{ border: '1px solid #E8DCC8', background: '#fff', borderRadius: 14, padding: 14, marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {/* Cover thumbnail — a gallery you can recognise at a glance. */}
            {g.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.cover_url} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 10, background: '#F5EFE6', color: '#c9bda6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>▦</div>
            )}
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 800, fontSize: 15.5, color: '#1A1A1A' }}>{g.title}</div>
              <div style={{ fontSize: 13, color: '#8B8378', marginTop: 3 }}>
                {g.client_name && <span>{g.client_name} · </span>}
                {g.shoot_date && <span>{new Date(g.shoot_date).toLocaleDateString('uk-UA')} · </span>}
                <span>{g.photo_count} фото</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {g.favorite_count > 0 && (
                <span style={{ fontSize: 12, fontWeight: 800, color: '#a5504f', background: '#fbf1f0', borderRadius: 999, padding: '4px 10px' }}>
                  ♥ {g.favorite_count}
                </span>
              )}
              {(g.zip_downloads > 0 || g.photo_downloads > 0) && (
                <span title={`Завантажень: ZIP-архів ${g.zip_downloads} раз(ів), окремих фото ${g.photo_downloads}`}
                  style={{ fontSize: 12, fontWeight: 800, color: '#263A99', background: '#eef1fb', borderRadius: 999, padding: '4px 10px' }}>
                  ↓ {g.zip_downloads + g.photo_downloads}
                </span>
              )}
              {g.files_purged_at
                ? <span style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', background: '#fef2f2', borderRadius: 999, padding: '4px 10px' }}>Термін минув</span>
                : <span style={{ fontSize: 12, fontWeight: 700, color: '#8B8378', background: '#F5EFE6', borderRadius: 999, padding: '4px 10px' }}>ще {g.days_left} дн.</span>}
            </div>
          </div>
          {/* Everything about a gallery now lives on its own page — the list
              stays scannable and each card is one click from the editor. */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <a href={editorHref(g.id)} style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>
              {g.photo_count === 0 ? 'Додати фото' : 'Відкрити галерею'}
            </a>
            {!g.files_purged_at && (
              <>
                <button style={btnGhost} onClick={() => copyLink(g)}>Скопіювати посилання</button>
                <a href={`/uk/gallery/${g.client_token}`} target="_blank" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>Переглянути очима клієнта</a>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Read-only grid of the photos the client hearted — what the photographer
 *  should print. Fetched on demand when the card is expanded. */
export function ClientPicks({ token, galleryId }: { token: string; galleryId: string }) {
  const [photos, setPhotos] = useState<CabinetPhoto[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/photographers/galleries/${galleryId}/photos?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) { setError(json?.error || 'Не вдалося завантажити'); return; }
        setPhotos((json.photos as CabinetPhoto[]).filter(p => p.favorite));
      } catch { if (!cancelled) setError('Не вдалося завантажити'); }
    })();
    return () => { cancelled = true; };
  }, [token, galleryId]);

  if (error) return <div style={{ marginTop: 10, color: '#991b1b', fontSize: 13 }}>{error}</div>;
  if (!photos) return <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 13 }}>Завантаження…</div>;
  if (photos.length === 0) return <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 13 }}>Клієнт ще нічого не обрав.</div>;

  return (
    <div style={{ marginTop: 10, background: '#fff8f8', border: '1px solid #fde3e4', borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#c0343a', marginBottom: 8 }}>
        Клієнт обрав {photos.length} фото для друку:
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
        {photos.map(p => (
          // ?download= forces Content-Disposition: attachment — the <a download>
          // attribute is ignored for cross-origin storage URLs.
          <a key={p.id} href={`${p.url}${p.url.includes('?') ? '&' : '?'}download=${encodeURIComponent(p.file_name || 'photo.jpg')}`}
             target="_blank" rel="noopener noreferrer"
             title={`Завантажити ${p.file_name}`} style={{ display: 'block' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.file_name} loading="lazy"
                 style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, border: '1px solid #f1d4d5' }} />
          </a>
        ))}
      </div>
    </div>
  );
}

/** Edit gallery basics (назва/клієнт/дата) + storage term. The term buttons
 *  extend from "now or current expiry, whichever is later", capped at 90
 *  days from today by the API. */
export function EditGalleryPanel({ token, gallery, onDone, flash }: {
  token: string; gallery: Gallery; onDone: () => Promise<void>; flash: (m: string) => void;
}) {
  const [title, setTitle] = useState(gallery.title);
  const [clientName, setClientName] = useState(gallery.client_name || '');
  const [shootDate, setShootDate] = useState(gallery.shoot_date || '');
  const [saving, setSaving] = useState(false);

  const patch = async (body: Record<string, unknown>, okMsg: string) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/photographers/galleries/${gallery.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...body }),
      });
      if (!res.ok) { alert((await res.json())?.error || 'Не вдалося зберегти'); return; }
      await onDone();
      flash(okMsg);
    } finally { setSaving(false); }
  };

  return (
    <div style={{ marginTop: 10, background: '#f8fafc', borderRadius: 10, padding: 14 }}>
      <label style={label}>Назва галереї</label>
      <input style={input} value={title} onChange={e => setTitle(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={label}>Ім&apos;я клієнта</label>
          <input style={input} value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Олена та Максим" />
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>Видно клієнту на обкладинці під назвою.</div>
        </div>
        <div>
          <label style={label}>Дата зйомки</label>
          <input style={input} type="date" value={shootDate} onChange={e => setShootDate(e.target.value)} />
        </div>
      </div>
      <button style={{ ...btn, marginTop: 12 }} disabled={saving}
        onClick={() => patch({ title, client_name: clientName, shoot_date: shootDate || null }, 'Збережено')}>
        Зберегти
      </button>

      <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 16, paddingTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#55504a', marginBottom: 6 }}>
          Термін дії — до {new Date(gallery.expires_at).toLocaleDateString('uk-UA')}
          {!gallery.files_purged_at && <span style={{ color: '#8B8378', fontWeight: 400 }}> (лишилось {g_daysWord(gallery.days_left)})</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {[30, 60, 90].map(d => (
            <button key={d} style={btnGhost} disabled={saving || !!gallery.files_purged_at}
              onClick={() => patch({ extend_days: d }, `Термін продовжено на ${d} дн.`)}>
              +{d} днів
            </button>
          ))}
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Максимум — 90 днів від сьогодні. Після завершення терміну файли видаляються автоматично.</span>
        </div>
      </div>
    </div>
  );
}

const g_daysWord = (n: number) => `${n} ${n === 1 ? 'день' : n >= 2 && n <= 4 ? 'дні' : 'днів'}`;

/** Gallery design constructor: background, display font, font size and cover
 *  layout. Each click saves immediately via PATCH (the server merges and
 *  validates against the whitelists in lib/photographers/gallery-design). */
export function DesignPanel({ token, galleryId, design, clientToken, photoCount, coverUrl, onDone, flash }: {
  token: string; galleryId: string; design: Record<string, any> | null;
  clientToken: string; photoCount: number; coverUrl: string | null;
  onDone: () => Promise<void>; flash: (m: string) => void;
}) {
  // Cover focal point (object-position). Sliders move it live; the PATCH is
  // sent when the photographer lets go, not on every pixel.
  const [cx, setCx] = useState<number>(Number(design?.cover_x ?? 50));
  const [cy, setCy] = useState<number>(Number(design?.cover_y ?? 50));
  const [current, setCurrent] = useState<Record<string, string>>({
    bg: design?.bg || 'light',
    font: design?.font || 'playfair',
    font_scale: design?.font_scale || 'm',
    cover: design?.cover || 'classic',
    layout: design?.layout || 'masonry',
    radius: design?.radius || 's',
    gap: design?.gap || 'm',
    lang: design?.lang || 'uk',
  });
  const [saving, setSaving] = useState(false);
  // Bumped after every saved change — remounts the preview iframe so the
  // photographer sees the result immediately, without leaving the cabinet.
  const [previewKey, setPreviewKey] = useState(0);
  // Which part of the gallery the preview shows. Layout changes only matter
  // below the fold, so picking a layout switches the preview to the grid
  // automatically (Diana: «я б хотіла бачити відразу як фото будуть
  // розміщені»).
  const [previewView, setPreviewView] = useState<'cover' | 'photos'>('cover');

  const savePatch = async (patch: Record<string, string | number>, view?: 'cover' | 'photos') => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/photographers/galleries/${galleryId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, design: patch }),
      });
      if (!res.ok) { alert((await res.json())?.error || 'Не вдалося зберегти'); return false; }
      await onDone();
      if (view) setPreviewView(view);
      setPreviewKey(k => k + 1);
      flash('Дизайн збережено');
      return true;
    } finally { setSaving(false); }
  };

  const save = async (key: string, value: string) => {
    if (saving) return;
    const prev = current;
    setCurrent(c => ({ ...c, [key]: value }));
    const gridKeys = ['layout', 'radius', 'gap'];
    const ok = await savePatch({ [key]: value }, gridKeys.includes(key) ? 'photos' : key === 'cover' ? 'cover' : undefined);
    if (!ok) setCurrent(prev);
  };

  const saveFocal = () => savePatch({ cover_x: cx, cover_y: cy }, 'cover');

  const previewSrc = `/uk/gallery/${clientToken}${previewView === 'photos' ? '#photos' : ''}`;

  const group: React.CSSProperties = { marginTop: 12 };
  const groupLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 };
  const row: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' };
  const opt = (active: boolean): React.CSSProperties => ({
    padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
    border: active ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
    background: active ? '#eef3ff' : '#fff', color: '#1f2937',
  });

  const OPTIONS: { key: string; label: string; items: [string, string][] }[] = [
    { key: 'bg', label: 'Колір фону', items: [['light', 'Світлий'], ['cream', 'Кремовий'], ['dark', 'Темний']] },
    { key: 'font', label: 'Шрифт заголовків', items: [['playfair', 'Playfair — класичний'], ['cormorant', 'Cormorant — витончений'], ['montserrat', 'Montserrat — сучасний'], ['caveat', 'Caveat — рукописний']] },
    { key: 'font_scale', label: 'Розмір шрифту', items: [['s', 'Компактний'], ['m', 'Стандартний'], ['l', 'Великий']] },
    { key: 'cover', label: 'Варіант обкладинки', items: [['classic', 'Класична — по центру'], ['bottom', 'Знизу зліва'], ['split', 'Панель + фото'], ['minimal', 'Мінімальна — без фото']] },
    // «Мозаїка» зберігає пропорції, тож при однакових вертикальних фото вона
    // виглядає як рівна сітка — для ритму є «журнальна» розкладка.
    { key: 'layout', label: 'Розкладка фото', items: [['masonry', 'Мозаїка — за пропорціями фото'], ['grid', 'Рівна сітка — квадрати'], ['large', 'Великі фото — 2 колонки'], ['mixed', 'Журнальна — різні розміри']] },
    { key: 'radius', label: 'Заокруглення кутів', items: [['none', 'Без заокруглення'], ['s', 'Ледь помітне'], ['m', 'Середнє'], ['l', 'Сильне']] },
    { key: 'gap', label: 'Відстань між фото', items: [['none', 'Впритул'], ['s', 'Вузька'], ['m', 'Середня'], ['l', 'Широка']] },
    // Для фотографів, що знімають закордоном: мова, якою клієнт бачить
    // галерею. Назви мов — українською, бо кабінет україномовний.
    { key: 'lang', label: 'Мова галереї (для клієнта)', items: [['uk', 'Українська'], ['en', 'Англійська'], ['pl', 'Польська'], ['de', 'Німецька'], ['cs', 'Чеська'], ['it', 'Італійська'], ['es', 'Іспанська'], ['pt', 'Португальська'], ['fr', 'Французька'], ['ro', 'Румунська']] },
  ];

  return (
    <div style={{ marginTop: 10, background: '#f8fafc', borderRadius: 10, padding: 14 }}>
      {/* On wide screens the preview sits beside the options and sticks while
          scrolling, so the photographer sees each change without jumping up
          and down the page (Diana, 2026-08-04). Narrow screens stack. */}
      <style>{`
        .tmDesignGrid { display: grid; gap: 18px; align-items: start; }
        @media (min-width: 1000px) {
          .tmDesignGrid { grid-template-columns: minmax(0, 1fr) minmax(340px, 44%); }
          .tmDesignPreview { position: sticky; top: 96px; }
        }
      `}</style>
      <div className="tmDesignGrid">
      <div>
      {OPTIONS.map(o => (
        <div key={o.key} style={o.key === 'bg' ? undefined : group}>
          <div style={groupLabel}>{o.label}</div>
          <div style={row}>
            {o.items.map(([val, label]) => (
              <button key={val} type="button" style={opt(current[o.key] === val)} onClick={() => save(o.key, val)} disabled={saving}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Cover focal point — the crop that the fullscreen hero applies.
          Drag the sliders and the mini-preview shows exactly what will be
          visible; the marker is where the crop centres. */}
      <div style={group}>
        <div style={groupLabel}>Центрування обкладинки</div>
        {coverUrl ? (
          <>
            <div style={{ position: 'relative', width: '100%', maxWidth: 380, aspectRatio: '16 / 9', borderRadius: 10, overflow: 'hidden', border: '1px solid #E8DCC8', background: '#efece7' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${cx}% ${cy}%`, display: 'block' }} />
              <span aria-hidden style={{
                position: 'absolute', left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%, -50%)',
                width: 22, height: 22, borderRadius: '50%', border: '2px solid #fff',
                boxShadow: '0 0 0 1px rgba(0,0,0,.35), 0 2px 8px rgba(0,0,0,.35)', pointerEvents: 'none',
              }} />
            </div>
            <div style={{ maxWidth: 380, marginTop: 10 }}>
              {([['По горизонталі', cx, setCx], ['По вертикалі', cy, setCy]] as const).map(([lbl, val, setter]) => (
                <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#8B8378', width: 104, flexShrink: 0 }}>{lbl}</span>
                  <input type="range" min={0} max={100} value={val} disabled={saving}
                    onChange={e => setter(Number(e.target.value))}
                    onPointerUp={saveFocal} onKeyUp={saveFocal} onTouchEnd={saveFocal}
                    style={{ flex: 1, accentColor: '#263A99' }} />
                  <span style={{ fontSize: 12, color: '#8B8378', width: 34, textAlign: 'right' }}>{val}%</span>
                </div>
              ))}
              <button type="button" style={{ ...btnGhost, marginTop: 4 }} disabled={saving}
                onClick={() => { setCx(50); setCy(50); savePatch({ cover_x: 50, cover_y: 50 }, 'cover'); }}>
                Скинути до центру
              </button>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: '#94a3b8' }}>
            Спершу завантажте фото — тоді тут зʼявиться превʼю обкладинки з центруванням.
          </div>
        )}
      </div>

      </div>

      {/* Live preview: the REAL client page in a scaled-down iframe (2× size,
          0.5 scale ≈ desktop viewport), remounted after each save. Honest by
          construction — no separate preview markup to drift out of sync. */}
      <div className="tmDesignPreview" style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #eef2f7', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Так побачить клієнт:</span>
            {([['cover', 'обкладинку'], ['photos', 'розміщення фото']] as const).map(([v, lbl]) => (
              <button key={v} type="button"
                onClick={() => { setPreviewView(v); setPreviewKey(k => k + 1); }}
                style={{
                  border: 'none', cursor: 'pointer', borderRadius: 999, padding: '5px 12px',
                  fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-heading), sans-serif',
                  background: previewView === v ? '#263A99' : '#eef2f7',
                  color: previewView === v ? '#fff' : '#55504a',
                }}>
                {lbl}
              </button>
            ))}
          </div>
          <a href={`/uk/gallery/${clientToken}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#1e2d7d', fontWeight: 700 }}>
            Відкрити повністю ↗
          </a>
        </div>
        <div style={{ height: 460, overflow: 'hidden' }}>
          <iframe
            key={`${previewKey}-${previewView}`}
            src={previewSrc}
            title="Попередній перегляд галереї"
            style={{ width: '200%', height: '200%', border: 'none', transform: 'scale(0.5)', transformOrigin: 'top left', pointerEvents: 'none' }}
          />
        </div>
        {photoCount === 0 && (
          <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 12px', borderTop: '1px solid #eef2f7' }}>
            Поки в галереї немає фото, обкладинка показується як заглушка — завантажте фото, і превʼю оновиться з вашим знімком.
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

/** Photo manager: the one place where the photographer sees every file in a
 *  gallery, sets the cover and deletes what they don't want. Deletion had no
 *  UI at all before (Diana: «як видалити старі фото»), although the API
 *  supported it. Hover a tile → «На обкладинку» / «Видалити». */
export function PhotoManager({ token, galleryId, coverPhotoId, onDone, flash }: {
  token: string; galleryId: string; coverPhotoId: string | null;
  onDone: () => Promise<void>; flash: (m: string) => void;
}) {
  const [photos, setPhotos] = useState<CabinetPhoto[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(coverPhotoId);
  const [hover, setHover] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/photographers/galleries/${galleryId}/photos?token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok) { setError(json?.error || 'Не вдалося завантажити'); return; }
      setPhotos(json.photos as CabinetPhoto[]);
    } catch { setError('Не вдалося завантажити'); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token, galleryId]);

  const setCover = async (photoId: string) => {
    if (busy) return;
    const prev = selected;
    setSelected(photoId);
    setBusy(true);
    try {
      const res = await fetch(`/api/photographers/galleries/${galleryId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, cover_photo_id: photoId }),
      });
      if (!res.ok) { setSelected(prev); alert((await res.json())?.error || 'Не вдалося зберегти'); return; }
      await onDone();
      flash('Обкладинку збережено');
    } finally { setBusy(false); }
  };

  const remove = async (p: CabinetPhoto) => {
    if (busy) return;
    // Deleting a client's photo is irreversible (file leaves storage), so it
    // always asks — and warns when the client had picked it for print.
    const warn = p.favorite ? '\n\nУВАГА: це фото клієнт обрав для друку.' : '';
    if (!confirm(`Видалити «${p.file_name}»? Файл буде стерто назавжди.${warn}`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/photographers/galleries/${galleryId}/photos`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, photo_id: p.id }),
      });
      if (!res.ok) { alert((await res.json())?.error || 'Не вдалося видалити'); return; }
      setPhotos(list => (list || []).filter(x => x.id !== p.id));
      if (selected === p.id) setSelected(null);
      await onDone();
      flash('Фото видалено');
    } finally { setBusy(false); }
  };

  if (error) return <div style={{ marginTop: 10, color: '#991b1b', fontSize: 13 }}>{error}</div>;
  if (!photos) return <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 13 }}>Завантаження…</div>;
  if (photos.length === 0) return <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 13 }}>Спершу завантажте фото.</div>;

  const tileBtn: React.CSSProperties = {
    border: 'none', borderRadius: 8, padding: '5px 9px', fontSize: 11.5, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'var(--font-heading), sans-serif',
  };

  return (
    <div style={{ marginTop: 10, background: '#f8fafc', borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
        Наведіть на фото, щоб поставити його на обкладинку або видалити. Обкладинку клієнт бачить на весь екран, відкриваючи галерею; без вибору береться перше фото.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))', gap: 8 }}>
        {photos.map(p => (
          <div key={p.id}
            onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(h => (h === p.id ? null : h))}
            title={p.file_name}
            style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: selected === p.id ? '3px solid #263A99' : '3px solid transparent', background: '#e9e4db' }}>
            {p.media_type === 'video' ? (
              <video src={p.url} muted playsInline preload="metadata"
                     style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.url} alt={p.file_name} loading="lazy"
                   style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
            )}

            {p.media_type === 'video' && (
              <span style={{ position: 'absolute', left: 5, bottom: 5, background: 'rgba(15,18,30,0.65)', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 800, padding: '2px 7px' }}>
                ▶ відео
              </span>
            )}
            {p.favorite && (
              <span title="Клієнт обрав це фото для друку"
                style={{ position: 'absolute', left: 5, top: 5, background: '#a5504f', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 800, padding: '2px 7px' }}>♥</span>
            )}
            {selected === p.id && (
              <span style={{ position: 'absolute', top: 5, right: 5, background: '#263A99', color: '#fff', borderRadius: 999, fontSize: 10.5, fontWeight: 800, padding: '2px 8px' }}>
                Обкладинка
              </span>
            )}

            {/* Action overlay — appears on hover, always visible on touch. */}
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'rgba(15,18,30,0.55)', backdropFilter: 'blur(2px)',
              opacity: hover === p.id ? 1 : 0, transition: 'opacity .15s',
              pointerEvents: hover === p.id ? 'auto' : 'none',
            }}>
              {selected !== p.id && (
                <button type="button" disabled={busy} onClick={() => setCover(p.id)}
                  style={{ ...tileBtn, background: '#fff', color: '#263A99' }}>
                  На обкладинку
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => remove(p)}
                style={{ ...tileBtn, background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.6)' }}>
                Видалити
              </button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>
        Усього {photos.length} файл(ів) у галереї. Видалення незворотне — файл стирається зі сховища.
      </div>
    </div>
  );
}

export function UploadZone({ token, galleryId, onDone, flash }: {
  token: string; galleryId: string; onDone: () => Promise<void>; flash: (m: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  // Фото йдуть multipart через наш API (один файл на запит — перевірений у
  // проєкті патерн). Відео більші за ліміт тіла функції, тож ідуть напряму в
  // сховище: API видає одноразовий підписаний URL → браузер робить PUT →
  // API підтверджує і реєструє запис (media_type 'video').
  const uploadVideo = async (f: File): Promise<string | null> => {
    const signRes = await fetch(`/api/photographers/galleries/${galleryId}/videos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, stage: 'sign', file_name: f.name, size: f.size, content_type: f.type }),
    });
    const signJson = await signRes.json();
    if (!signRes.ok) return signJson?.error || 'Не вдалося підготувати аплоад';

    const putRes = await fetch(signJson.signed_url, {
      method: 'PUT',
      headers: { 'Content-Type': f.type || 'video/mp4' },
      body: f,
    });
    if (!putRes.ok) return `Аплоад «${f.name}» не вдався (${putRes.status})`;

    const confirmRes = await fetch(`/api/photographers/galleries/${galleryId}/videos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, stage: 'confirm', path: signJson.path, file_name: f.name }),
    });
    const confirmJson = await confirmRes.json();
    if (!confirmRes.ok) return confirmJson?.error || 'Не вдалося зареєструвати відео';
    return null;
  };

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0 || busy) return;
    setBusy(true);
    try {
      const all = Array.from(files);
      let done = 0;
      for (const f of all) {
        if (f.type.startsWith('video/')) {
          const err = await uploadVideo(f);
          if (err) { alert(err); break; }
        } else {
          const fd = new FormData();
          fd.append('token', token);
          fd.append('files', f);
          const res = await fetch(`/api/photographers/galleries/${galleryId}/photos`, { method: 'POST', body: fd });
          const json = await res.json();
          if (!res.ok) { alert(json?.error || 'Помилка аплоаду'); break; }
        }
        done += 1;
        setProgress(`${done}/${all.length}`);
      }
      await onDone();
      if (done > 0) flash(`Завантажено ${done} файл(ів)`);
    } finally { setBusy(false); setProgress(''); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <div style={{ marginTop: 10, background: '#f8fafc', borderRadius: 10, padding: 14 }}>
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={e => upload(e.target.files)} disabled={busy} />
      {busy && <div style={{ marginTop: 8, color: '#1e2d7d', fontWeight: 700, fontSize: 14 }}>Завантажуємо… {progress}</div>}
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Фото до 25 МБ, відео до 200 МБ, разом до 500 файлів у галереї.</div>
    </div>
  );
}

/* ── Профіль ─────────────────────────────────────────────────────────── */

function ProfileSection({ token, profile, onChanged, flash }: {
  token: string; profile: Profile; onChanged: () => Promise<void>; flash: (m: string) => void;
}) {
  const [form, setForm] = useState({
    name: profile.name || '', bio: profile.bio || '', phone: profile.phone || '',
    instagram: profile.instagram || '', website: profile.website || '',
    city: profile.city || '', specialization: profile.specialization || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/photographers/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...form }),
      });
      if (res.ok) { await onChanged(); flash('Профіль збережено'); }
      else alert((await res.json())?.error || 'Помилка');
    } finally { setSaving(false); }
  };

  return (
    <div style={card}>
      <h2 style={sectionTitle}>Профіль (візитка)</h2>
      <label style={label}>Ім&apos;я / назва студії</label>
      <input style={input} value={form.name} onChange={set('name')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={label}>Спеціалізація</label>
          <input style={input} value={form.specialization} onChange={set('specialization')} placeholder="Весільний фотограф" />
        </div>
        <div>
          <label style={label}>Місто</label>
          <input style={input} value={form.city} onChange={set('city')} placeholder="Київ" />
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
        Спеціалізація і місто показуються в заголовку вашої сторінки та допомагають знаходити вас у Google (напр. «весільний фотограф Київ»).
      </div>
      <label style={label}>Про себе</label>
      <textarea style={{ ...input, minHeight: 80, resize: 'vertical' }} value={form.bio} onChange={set('bio')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={label}>Телефон</label><input style={input} value={form.phone} onChange={set('phone')} /></div>
        <div><label style={label}>Instagram</label><input style={input} value={form.instagram} onChange={set('instagram')} placeholder="@username" /></div>
      </div>
      <label style={label}>Сайт</label>
      <input style={input} value={form.website} onChange={set('website')} placeholder="https://…" />

      <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <BrandUpload token={token} kind="logo" current={profile.logo_url} label="Логотип" onDone={onChanged} flash={flash} />
        <BrandUpload token={token} kind="avatar" current={profile.avatar_url} label="Фото профілю" onDone={onChanged} flash={flash} />
      </div>

      <button style={{ ...btn, marginTop: 16 }} onClick={save} disabled={saving}>{saving ? 'Зберігаємо…' : 'Зберегти профіль'}</button>
    </div>
  );
}

function BrandUpload({ token, kind, current, label: title, onDone, flash }: {
  token: string; kind: 'logo' | 'avatar' | 'portfolio'; current?: string | null; label: string;
  onDone: () => Promise<void>; flash: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const upload = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('token', token); fd.append('kind', kind); fd.append('file', file);
      const res = await fetch('/api/photographers/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { alert(json?.error || 'Помилка'); return; }
      await onDone();
      flash(`${title}: завантажено`);
    } finally { setBusy(false); }
  };
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      {current && kind !== 'portfolio' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
      )}
      <span style={{ ...btnGhost, display: 'inline-block' }}>{busy ? 'Завантажуємо…' : `${title}`}</span>
      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => upload(e.target.files?.[0])} disabled={busy} />
    </label>
  );
}

/* ── Лендинг: прайс + портфоліо + домен ──────────────────────────────── */

function LandingSection({ token, profile, onChanged, flash }: {
  token: string; profile: Profile; onChanged: () => Promise<void>; flash: (m: string) => void;
}) {
  const [pricing, setPricing] = useState<PriceRow[]>(Array.isArray(profile.pricing) ? profile.pricing : []);
  const [saving, setSaving] = useState(false);

  const setRow = (i: number, k: keyof PriceRow, v: string) =>
    setPricing(rows => rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const save = async () => {
    setSaving(true);
    try {
      const clean = pricing.filter(r => (r.title || '').trim());
      const res = await fetch('/api/photographers/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pricing: clean }),
      });
      if (res.ok) { setPricing(clean); await onChanged(); flash('Прайс збережено'); }
      else alert((await res.json())?.error || 'Помилка');
    } finally { setSaving(false); }
  };

  const removePortfolio = async (url: string) => {
    const next = (profile.portfolio || []).filter(u => u !== url);
    const res = await fetch('/api/photographers/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, portfolio: next }),
    });
    if (res.ok) { await onChanged(); flash('Фото прибрано з портфоліо'); }
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={sectionTitle}>Лендинг: прайс і портфоліо</h2>
        <a href={`/uk/photographer/${profile.slug}`} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>
          Переглянути мою сторінку ↗
        </a>
      </div>
      <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
        Адреса вашого лендингу: <a href={`/uk/photographer/${profile.slug}`} target="_blank" style={{ color: '#1e2d7d', fontWeight: 700 }}>touchmemories.com.ua/uk/photographer/{profile.slug}</a>
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, marginTop: 16 }}>Дизайн сторінки</h3>
      <ThemePicker token={token} current={profile.landing_theme || 'classic'} onChanged={onChanged} flash={flash} slug={profile.slug} />

      <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, marginTop: 22 }}>Прайс</h3>
      {pricing.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <input style={input} placeholder="Послуга (напр. Фотосесія 1 год)" value={row.title || ''} onChange={e => setRow(i, 'title', e.target.value)} />
          <input style={input} placeholder="Ціна" value={row.price || ''} onChange={e => setRow(i, 'price', e.target.value)} />
          <input style={input} placeholder="Опис (необов'язково)" value={row.description || ''} onChange={e => setRow(i, 'description', e.target.value)} />
          <button style={{ ...btnGhost, padding: '9px 12px' }} onClick={() => setPricing(rows => rows.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button style={btnGhost} onClick={() => setPricing(r => [...r, { title: '', price: '' }])}>+ Додати позицію</button>
        <button style={btn} onClick={save} disabled={saving}>{saving ? 'Зберігаємо…' : 'Зберегти прайс'}</button>
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, marginTop: 22 }}>Портфоліо</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginTop: 8 }}>
        {(profile.portfolio || []).map(url => (
          <div key={url} style={{ position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />
            <button onClick={() => removePortfolio(url)}
              style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', lineHeight: '20px' }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        <BrandUpload token={token} kind="portfolio" label="Додати фото в портфоліо" onDone={onChanged} flash={flash} />
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, marginTop: 22 }}>Власний домен</h3>
      {profile.custom_domain_paid && profile.custom_domain ? (
        <p style={{ fontSize: 14, color: '#065f46', margin: 0 }}>Підключено: <b>{profile.custom_domain}</b></p>
      ) : (
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
          Платна опція: ваш лендинг на власному домені (напр. <i>photo-olena.com</i>).
          Напишіть нам на <a href="mailto:hello@touchmemories.com.ua" style={{ color: '#1e2d7d' }}>hello@touchmemories.com.ua</a> — підключимо.
        </p>
      )}
    </div>
  );
}

/* ── Запис на зйомку: слоти + оплата ─────────────────────────────────── */

const fmtSlotDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' });

function BookingCabinetSection({ token, profile, onChanged, flash }: {
  token: string; profile: Profile; onChanged: () => Promise<void>; flash: (m: string) => void;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState('');
  const [adding, setAdding] = useState(false);
  const [pay, setPay] = useState({
    booking_enabled: profile.booking_enabled ?? true,
    pay_mono_enabled: !!profile.pay_mono_enabled, pay_mono_link: profile.pay_mono_link || '',
    pay_mono_token: (profile as any).pay_mono_token || '',
    pay_wfp_enabled: !!profile.pay_wfp_enabled, pay_wfp_link: profile.pay_wfp_link || '',
    pay_wfp_account: (profile as any).pay_wfp_account || '',
    pay_wfp_secret: (profile as any).pay_wfp_secret || '',
    pay_requisites_enabled: !!profile.pay_requisites_enabled, pay_requisites: profile.pay_requisites || '',
  });
  const [savingPay, setSavingPay] = useState(false);

  const loadSlots = async () => {
    const res = await fetch(`/api/photographers/slots?token=${encodeURIComponent(token)}`);
    const json = await res.json();
    if (res.ok) setSlots(json.slots || []);
  };
  useEffect(() => { loadSlots(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const addSlot = async () => {
    if (!date || !time || adding) return;
    setAdding(true);
    try {
      const res = await fetch('/api/photographers/slots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, date, time, duration_min: duration, price }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json?.error || 'Помилка'); return; }
      setTime(''); setPrice('');
      await loadSlots();
      flash('Слот додано');
    } finally { setAdding(false); }
  };

  const removeSlot = async (id: string) => {
    const res = await fetch('/api/photographers/slots', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slot_id: id }),
    });
    if (res.ok) { await loadSlots(); flash('Слот видалено'); }
    else alert((await res.json())?.error || 'Помилка');
  };

  const markPaid = async (id: string, paid: boolean) => {
    const res = await fetch('/api/photographers/slots', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slot_id: id, paid }),
    });
    if (res.ok) { await loadSlots(); flash(paid ? 'Позначено оплаченим' : 'Позначку знято'); }
    else alert((await res.json())?.error || 'Помилка');
  };

  const savePayments = async () => {
    setSavingPay(true);
    try {
      const res = await fetch('/api/photographers/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...pay }),
      });
      if (res.ok) { await onChanged(); flash('Налаштування оплати збережено'); }
      else alert((await res.json())?.error || 'Помилка');
    } finally { setSavingPay(false); }
  };

  const toggle = (k: keyof typeof pay) => setPay(p => ({ ...p, [k]: !p[k] }));

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={sectionTitle}>Запис на зйомку</h2>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
          {/* Зберігається одразу — вимкнув і блок зник зі сторінки, без окремої кнопки */}
          <input type="checkbox" checked={pay.booking_enabled}
            onChange={async e => {
              const enabled = e.target.checked;
              setPay(p => ({ ...p, booking_enabled: enabled }));
              const res = await fetch('/api/photographers/profile', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, booking_enabled: enabled }),
              });
              if (res.ok) flash(enabled ? 'Запис увімкнено на сторінці' : 'Запис вимкнено — блок зник зі сторінки');
              else { setPay(p => ({ ...p, booking_enabled: !enabled })); alert('Не вдалося зберегти'); }
            }} />
          Показувати запис на сторінці
        </label>
      </div>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
        Додайте вільні дати й час — клієнти бронюватимуть їх прямо на вашій сторінці, а вам прийде лист. Оплата надходить напряму вам.
      </p>

      {/* Додавання слота */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, background: '#f8fafc', borderRadius: 10, padding: 14 }}>
        <div>
          <label style={label}>Дата</label>
          <input style={input} type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label style={label}>Час</label>
          <input style={input} type="time" value={time} onChange={e => setTime(e.target.value)} />
        </div>
        <div>
          <label style={label}>Тривалість</label>
          <select style={input} value={duration} onChange={e => setDuration(Number(e.target.value))}>
            <option value={30}>30 хв</option><option value={60}>1 год</option>
            <option value={90}>1.5 год</option><option value={120}>2 год</option>
            <option value={180}>3 год</option><option value={240}>4 год</option>
          </select>
        </div>
        <div>
          <label style={label}>Ціна (текст)</label>
          <input style={input} value={price} onChange={e => setPrice(e.target.value)} placeholder="2500 грн" />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button style={{ ...btn, width: '100%' }} onClick={addSlot} disabled={adding || !date || !time}>
            {adding ? '…' : '+ Додати'}
          </button>
        </div>
      </div>

      {/* Список слотів */}
      {slots.length > 0 && (
        <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
          {slots.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontWeight: 800, minWidth: 130, textTransform: 'capitalize' }}>{fmtSlotDate(s.slot_date)}</div>
              <div style={{ fontWeight: 700 }}>{s.slot_time}</div>
              <div style={{ color: '#64748b', fontSize: 13 }}>{s.duration_min} хв{s.price ? ` · ${s.price}` : ''}</div>
              <div style={{ flex: 1 }} />
              {s.status === 'booked' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#065f46', background: '#ecfdf5', borderRadius: 999, padding: '4px 10px' }}>
                    ✓ {s.client_name} · {s.client_phone}
                  </span>
                  {/* Payment badge: platform never sees the money — the client
                      claims payment, the photographer verifies in their bank */}
                  {s.payment_status === 'paid' ? (
                    <button onClick={() => markPaid(s.id, false)} title="Зняти позначку"
                      style={{ fontSize: 12, fontWeight: 700, color: '#065f46', background: '#d1fae5', border: 'none', borderRadius: 999, padding: '4px 10px', cursor: 'pointer' }}>
                       Оплачено
                    </button>
                  ) : s.payment_status === 'claimed' ? (
                    <button onClick={() => markPaid(s.id, true)} title="Клієнт повідомив про оплату — перевірте банк і підтвердіть"
                      style={{ fontSize: 12, fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px dashed #f59e0b', borderRadius: 999, padding: '4px 10px', cursor: 'pointer' }}>
                       Клієнт повідомив про оплату — підтвердити?
                    </button>
                  ) : (
                    <button onClick={() => markPaid(s.id, true)} title="Позначити оплаченим"
                      style={{ fontSize: 12, fontWeight: 700, color: '#64748b', background: '#f1f5f9', border: 'none', borderRadius: 999, padding: '4px 10px', cursor: 'pointer' }}>
                      Не оплачено · позначити ✓
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e', background: '#fffbeb', borderRadius: 999, padding: '4px 10px' }}>Вільно</span>
                  <button style={{ ...btnGhost, padding: '6px 10px' }} onClick={() => removeSlot(s.id)}>✕</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Оплата */}
      <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, marginTop: 22 }}>Оплата (напряму вам)</h3>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
        Клієнт побачить увімкнені способи одразу після бронювання. Увімкніть хоча б один — або жодного, якщо берете оплату при зустрічі.
      </p>
      <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={pay.pay_mono_enabled} onChange={() => toggle('pay_mono_enabled')} />
            Monobank
          </label>
          {pay.pay_mono_enabled && (
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              <div>
                <label style={{ ...label, marginTop: 0 }}>Варіант 1 — просто посилання (банка/оплата)</label>
                <input style={input} placeholder="https://send.monobank.ua/jar/…"
                  value={pay.pay_mono_link} onChange={e => setPay(p => ({ ...p, pay_mono_link: e.target.value }))} />
              </div>
              <div>
                <label style={{ ...label, marginTop: 0 }}>Варіант 2 — автопідтвердження: токен еквайрингу mono (X-Token)</label>
                <input style={input} placeholder="Токен з кабінету еквайрингу monobank (для ФОП)"
                  value={pay.pay_mono_token} onChange={e => setPay(p => ({ ...p, pay_mono_token: e.target.value }))} />
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  З токеном рахунок створюється автоматично на суму слота, а статус «Оплачено» ставиться сам після оплати. Токен бачите лише ви.
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={pay.pay_wfp_enabled} onChange={() => toggle('pay_wfp_enabled')} />
            WayForPay
          </label>
          {pay.pay_wfp_enabled && (
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              <div>
                <label style={{ ...label, marginTop: 0 }}>Варіант 1 — просто посилання на оплату</label>
                <input style={input} placeholder="https://secure.wayforpay.com/…"
                  value={pay.pay_wfp_link} onChange={e => setPay(p => ({ ...p, pay_wfp_link: e.target.value }))} />
              </div>
              <div>
                <label style={{ ...label, marginTop: 0 }}>Варіант 2 — автопідтвердження: merchant-дані WayForPay</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input style={input} placeholder="merchantAccount"
                    value={pay.pay_wfp_account} onChange={e => setPay(p => ({ ...p, pay_wfp_account: e.target.value }))} />
                  <input style={input} type="password" placeholder="SecretKey"
                    value={pay.pay_wfp_secret} onChange={e => setPay(p => ({ ...p, pay_wfp_secret: e.target.value }))} />
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  З merchant-даними рахунок створюється автоматично, а «Оплачено» ставиться саме після оплати. Ключі бачите лише ви.
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={pay.pay_requisites_enabled} onChange={() => toggle('pay_requisites_enabled')} />
            Реквізити для ручної оплати
          </label>
          {pay.pay_requisites_enabled && (
            <textarea style={{ ...input, marginTop: 8, minHeight: 70, resize: 'vertical' }}
              placeholder={'Картка: 5375 0000 0000 0000\nОтримувач: Олена Коваленко\nПризначення: фотозйомка'}
              value={pay.pay_requisites} onChange={e => setPay(p => ({ ...p, pay_requisites: e.target.value }))} />
          )}
        </div>
      </div>
      <button style={{ ...btn, marginTop: 12 }} onClick={savePayments} disabled={savingPay}>
        {savingPay ? 'Зберігаємо…' : 'Зберегти налаштування оплати'}
      </button>
    </div>
  );
}

/* ── Вибір теми лендингу ─────────────────────────────────────────────── */

function ThemePicker({ token, current, onChanged, flash, slug }: {
  token: string; current: string; onChanged: () => Promise<void>; flash: (m: string) => void; slug: string;
}) {
  const [saving, setSaving] = useState('');

  const pick = async (key: string) => {
    if (key === current || saving) return;
    setSaving(key);
    try {
      const res = await fetch('/api/photographers/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, landing_theme: key }),
      });
      if (res.ok) { await onChanged(); flash('Дизайн застосовано'); }
      else alert((await res.json())?.error || 'Помилка');
    } finally { setSaving(''); }
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>
        Оберіть стиль — зміни видно одразу на <a href={`/uk/photographer/${slug}`} target="_blank" style={{ color: '#1e2d7d', fontWeight: 700 }}>вашій сторінці</a>.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {LANDING_THEMES.map(t => {
          const active = t.key === current;
          return (
            <button key={t.key} onClick={() => pick(t.key)} disabled={!!saving}
              style={{
                textAlign: 'left', cursor: active ? 'default' : 'pointer', padding: 0, overflow: 'hidden',
                borderRadius: 12, background: '#fff',
                border: active ? '2px solid #1e2d7d' : '1px solid #e5e7eb',
                boxShadow: active ? '0 0 0 3px rgba(30,45,125,0.12)' : 'none',
                opacity: saving && saving !== t.key ? 0.6 : 1,
              }}>
              {/* Міні-макет: смуга хіро + плитки портфоліо в кольорах теми */}
              <div style={{ background: t.bg, padding: '12px 12px 10px' }}>
                <div style={{ width: 26, height: 26, borderRadius: t.pill ? '50%' : 4, background: t.accent, margin: t.heroAlign === 'center' ? '0 auto 6px' : '0 0 6px' }} />
                <div style={{
                  height: 8, width: '65%', borderRadius: 3, background: t.ink,
                  margin: t.heroAlign === 'center' ? '0 auto 5px' : '0 0 5px',
                  fontFamily: t.headingFont,
                }} />
                <div style={{ height: 5, width: '45%', borderRadius: 3, background: t.faint, margin: t.heroAlign === 'center' ? '0 auto 8px' : '0 0 8px' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ aspectRatio: t.grid === 'portrait' ? '4/5' : '1/1', borderRadius: Math.min(t.radius, 6), background: t.tileBg, border: `1px solid ${t.border}` }} />
                  ))}
                </div>
              </div>
              <div style={{ padding: '8px 12px 10px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#1e2d7d' }}>
                  {saving === t.key ? 'Застосовуємо…' : t.label} {active && '✓'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.4 }}>{t.tagline}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'Arial, sans-serif' }}>{children}</div>;
}
