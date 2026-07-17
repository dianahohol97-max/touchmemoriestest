'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import toast from 'react-hot-toast';
import { Copy, Check, Loader2, Plus, Mail } from 'lucide-react';

interface Partner {
  id: string;
  agency_name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  referral_code: string;
  travelbook_rate: number;
  other_rate: number;
  total_earned: number;
  total_paid_out: number;
  pending_payout: number;
  status: string;
  partner_kind?: string;
  payout_account?: string | null;
  payout_requested_at?: string | null;
}

interface PendingRequest {
  id: string;
  agency_name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  interested_model: string | null;
  status: string;
  created_at: string;
  kind?: string;
}

export default function AgencyPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [payingOut, setPayingOut] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/agency-partners');
      const json = await res.json();
      setPartners(json.partners || []);
    } catch { /* ignore */ }

    // New travel-agency / travel-blogger requests not yet approved
    const { data: reqs } = await supabase
      .from('partnership_requests')
      .select('*')
      .in('kind', ['travel_agency', 'travel_blogger'])
      .neq('status', 'approved')
      .order('created_at', { ascending: false });
    setRequests(reqs || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const approve = async (requestId: string) => {
    setApproving(requestId);
    try {
      const res = await fetch('/api/admin/agency-partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Помилка');
      toast.success(`Агенцію підтверджено · код ${json.partner.referral_code}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Не вдалося підтвердити');
    } finally {
      setApproving(null);
    }
  };

  const payout = async (agencyId: string) => {
    // Irreversible: the endpoint zeroes the partner's accrued balance. Never
    // let a single stray click do that.
    const partner = partners.find(p => p.id === agencyId);
    const label = partner
      ? `${partner.agency_name || 'партнеру'} (${Number(partner.pending_payout || 0).toFixed(0)} ₴)`
      : 'цьому партнеру';
    if (!confirm(`Позначити виплату ${label} як здійснену? Баланс до виплати буде обнулено — цю дію не можна скасувати.`)) return;
    setPayingOut(agencyId);
    try {
      const res = await fetch('/api/admin/agency-partners/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Помилка');
      toast.success(json.paid > 0 ? `Виплачено ${json.paid} ₴` : json.message);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Не вдалося');
    } finally {
      setPayingOut(null);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    toast.success('Код скопійовано');
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}><Loader2 className="animate-spin" style={{ display: 'inline' }} /> Завантаження…</div>;
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e2d7d', marginBottom: 4 }}>Тревел-партнери</h1>
      <p style={{ color: '#64748b', marginBottom: 28, fontSize: 14 }}>
        Реферальна програма: агенція отримує 5% з тревелбуків і 3% з решти товарів за своїм промокодом; клієнт за кодом/посиланням отримує знижку 5%. Нарахування рахуються автоматично при оплаті.
      </p>

      {/* New requests to approve */}
      {requests.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Нові заявки ({requests.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {requests.map(r => (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.agency_name}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: r.kind === 'travel_blogger' ? '#fce7f3' : '#e0e7ff', color: r.kind === 'travel_blogger' ? '#be185d' : '#3730a3' }}>{r.kind === 'travel_blogger' ? 'Блогер' : 'Агенція'}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{r.contact_name && `${r.contact_name} · `}{r.email}{r.phone && ` · ${r.phone}`}</div>
                  {r.website && <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.website}</div>}
                </div>
                <button
                  onClick={() => approve(r.id)}
                  disabled={approving === r.id}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#263A99', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  {approving === r.id ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  Підтвердити та видати код
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active partners */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Партнери ({partners.length})</h2>
        {partners.length === 0 ? (
          <div style={{ color: '#94a3b8', padding: '30px 0', textAlign: 'center' }}>Ще немає підтверджених партнерів</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {partners.map(p => (
              <div key={p.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 16 }}>{p.agency_name}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: p.partner_kind === 'travel_blogger' ? '#fce7f3' : '#e0e7ff', color: p.partner_kind === 'travel_blogger' ? '#be185d' : '#3730a3' }}>{p.partner_kind === 'travel_blogger' ? 'Блогер' : 'Агенція'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{p.contact_name && `${p.contact_name} · `}{p.email}{p.phone && ` · ${p.phone}`}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ background: '#eef2ff', color: '#1e2d7d', fontWeight: 800, padding: '6px 12px', borderRadius: 8, fontSize: 15, letterSpacing: '0.05em' }}>{p.referral_code}</code>
                    <button onClick={() => copyCode(p.referral_code)} title="Копіювати код" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><Copy size={16} /></button>
                  </div>
                </div>

                {/* Ready-to-share referral link */}
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>Посилання:</span>
                  <code style={{ fontSize: 12, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '5px 10px', borderRadius: 6, color: '#475569', wordBreak: 'break-all' }}>
                    {`https://touchmemories.com.ua/?ref=${p.referral_code}`}
                  </code>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(`https://touchmemories.com.ua/?ref=${p.referral_code}`); toast.success('Посилання скопійовано'); }}
                    title="Копіювати посилання"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, display: 'flex' }}
                  ><Copy size={15} /></button>
                  <button
                    onClick={async () => {
                      setSendingEmail(p.id);
                      try {
                        const r = await fetch(`/api/admin/agency-partners/${p.id}/resend-welcome`, { method: 'POST' });
                        const j = await r.json();
                        if (r.ok) toast.success(`Лист надіслано на ${j.sentTo}`);
                        else toast.error(j.error || 'Не вдалося надіслати');
                      } catch { toast.error('Не вдалося надіслати'); }
                      setSendingEmail(null);
                    }}
                    disabled={sendingEmail === p.id}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#fff', color: '#263A99', border: '1.5px solid #263A99', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: sendingEmail === p.id ? 'default' : 'pointer' }}>
                    {sendingEmail === p.id ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                    {sendingEmail === p.id ? 'Надсилаю…' : 'Надіслати лист'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 16 }}>
                  <Stat label="Ставки" value={`${p.travelbook_rate}% / ${p.other_rate}%`} hint="тревелбук / інше" />
                  <Stat label="Всього нараховано" value={`${Number(p.total_earned).toFixed(0)} ₴`} />
                  <Stat label="Виплачено" value={`${Number(p.total_paid_out).toFixed(0)} ₴`} />
                  <Stat label="До виплати" value={`${Number(p.pending_payout).toFixed(0)} ₴`} highlight={p.pending_payout > 0} />
                </div>

                {p.payout_account && (
                  <div style={{ marginTop: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Рахунок для виплати</div>
                    <div style={{ fontSize: 13, color: '#0f172a', whiteSpace: 'pre-wrap' }}>{p.payout_account}</div>
                  </div>
                )}

                {p.payout_requested_at && (
                  <div style={{ marginTop: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                     Партнер запросив виплату {new Date(p.payout_requested_at).toLocaleDateString('uk-UA')}
                  </div>
                )}

                {p.pending_payout >= 500 ? (
                  <div style={{ marginTop: 14, textAlign: 'right' }}>
                    <button
                      onClick={() => payout(p.id)}
                      disabled={payingOut === p.id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    >
                      {payingOut === p.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      Позначити виплаченим ({Number(p.pending_payout).toFixed(0)} ₴)
                    </button>
                  </div>
                ) : p.pending_payout > 0 ? (
                  <div style={{ marginTop: 12, fontSize: 12, color: '#c2410c' }}>
                    До виплати {Number(p.pending_payout).toFixed(0)} ₴ — виплата доступна від 500 ₴
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint, highlight }: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <div style={{ background: highlight ? '#f0fdf4' : '#f8fafc', border: `1px solid ${highlight ? '#bbf7d0' : '#f1f5f9'}`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: highlight ? '#16a34a' : '#0f172a' }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: '#cbd5e1' }}>{hint}</div>}
    </div>
  );
}
