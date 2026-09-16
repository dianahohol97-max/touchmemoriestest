'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Check, Loader2, Plus, Mail, X, RotateCcw, Users } from 'lucide-react';
import { isRepeatApplication } from '@/lib/partners/application-gate';
import { partnerRefLink } from '@/lib/partners/referral-link';
import { usePermissions } from '../context/PermissionsContext';
import { canApprovePartners } from '@/lib/auth/permissions';

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
  orders_count: number;
  orders_revenue: number;
  /** Переходи за реферальним посиланням; повтори за добу рахуються один раз. */
  visits?: number;
  last_visit_at?: string | null;
  status: string;
  partner_kind?: string;
  payout_account?: string | null;
  payout_requested_at?: string | null;
  /** Менеджер, який привів партнера — з нього рахується його комісія. */
  sales_manager_id?: string | null;
  created_at?: string;
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
  decline_reason?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
}

/**
 * Причини відмови коротким вибором — щоб закриття заявки не перетворювалося на
 * вправу з формулювання. Будь-що поза списком пишеться текстом (Діана,
 * 16.09.2026). Лист партнеру при відмові НЕ надсилається: це окреме рішення.
 */
const DECLINE_REASONS = [
    'Не відповідає профілю бренду',
    'Немає активної сторінки або портфоліо',
    'Не вийшли на звʼязок',
];

export default function AgencyPartnersPage() {
  /**
   * Сторінка й кнопки на ній живуть за РІЗНИМИ правами, і це не збіг.
   *
   * У меню «Тревел-партнери» стоїть у розділі `catalog`, тож відкрити її може
   * кожен, у кого є каталог. Але API під кнопками суворіші: підтвердження
   * заявки вимагає `marketing: full` (requirePartnerApprover — воно випускає в
   * світ активний промокод зі знижкою), а виплата вимагає адміністратора, бо
   * це видача грошей. До цього сторінка не питала про права нічого й малювала
   * всі кнопки всім: людина з каталогом бачила «Підтвердити та видати код»,
   * натискала й отримувала тост «Forbidden», який виглядає як поломка сайту, а
   * не як межа її повноважень.
   *
   * Гасити кнопку — половина відповіді. Провайдер прав має запобіжник: якщо
   * /api/admin/me/permissions не відповість за чотири секунди, він ставить
   * isAdmin=true, щоб ніхто не лишився в порожній адмінці. Тому кожен обробник
   * нижче окремо розбирає 403 і каже словами, кому ця дія доступна.
   */
  const { permissions, isAdmin } = usePermissions();
  const canApprove = canApprovePartners(isAdmin, permissions);
  const canPayout = isAdmin;

  const [partners, setPartners] = useState<Partner[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [payingOut, setPayingOut] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  // Відкрита панель відмови: id заявки та вже обрана причина.
  const [closing, setClosing] = useState<{ id: string; reason: string } | null>(null);
  const [savingRequest, setSavingRequest] = useState<string | null>(null);
  /**
   * Помилки завантаження показуються, а не ковтаються.
   *
   * До 16.09.2026 всі три запити тут стояли в порожньому catch, і збій виглядав
   * як порожнеча: список менеджерів без доступу згортався в єдиний пункт
   * «Ніхто — прийшов сам», і людина робила висновок, що менеджерів у системі
   * немає. Порожньо і зламано мають виглядати по-різному (Діана, 16.09.2026).
   */
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  // Менеджери з продажів — щоб привʼязку «хто привів» можна було поставити або
  // виправити просто тут, у списку партнерів, а не окремою сторінкою.
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);

  /** Одна відповідь — один зрозумілий рядок помилки замість мовчазної порожнечі. */
  const describeFailure = (what: string, res: Response | null, json: any) => {
    if (res?.status === 403) return `${what}: немає доступу до цих даних під вашим обліковим записом`;
    if (res?.status === 401) return `${what}: сесія завершилася, увійдіть ще раз`;
    return `${what}: ${json?.error || (res ? `сервер відповів ${res.status}` : 'запит не дійшов')}`;
  };

  const load = async () => {
    setLoading(true);
    const errors: string[] = [];

    try {
      const res = await fetch('/api/admin/agency-partners');
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(describeFailure('Список партнерів', res, json));
      setPartners(json?.partners || []);
    } catch (e: any) {
      setPartners([]);
      errors.push(e?.message || 'Список партнерів не завантажився');
    }

    // Лише імена: повний вигляд цього маршруту віддає ще й комісії менеджерів,
    // і саме тому він адміністраторський.
    try {
      const res = await fetch('/api/admin/sales-managers?fields=names');
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(describeFailure('Список менеджерів', res, json));
      setManagers((json?.managers || []).map((m: any) => ({ id: m.id, name: m.name })));
    } catch (e: any) {
      setManagers([]);
      errors.push(e?.message || 'Список менеджерів не завантажився');
    }

    // Тягнемо заявки ВСІХ статусів, включно з підтвердженими: підтверджені на
    // екрані не показуються, але без них не видно, що заявка повторна.
    // Читаємо через маршрут, а не напряму з браузера, щоб список бачив кожен,
    // кому видано право підтверджувати партнерів, а не тільки адміністратор.
    try {
      const res = await fetch('/api/admin/partnership-requests?status=all');
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(describeFailure('Заявки на партнерство', res, json));
      setRequests((json?.requests || []).filter((r: PendingRequest) => ['travel_agency', 'travel_blogger'].includes(r.kind || 'travel_agency')));
    } catch (e: any) {
      setRequests([]);
      errors.push(e?.message || 'Заявки не завантажилися');
    }

    setLoadErrors(errors);
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
      // Підтвердження випускає живий промокод зі знижкою, тому воно під
      // requirePartnerApprover. Голий «Forbidden» тут читався як поломка.
      if (res.status === 403) throw new Error('Підтверджувати партнерів можуть адміністратори та маркетинг із повним доступом');
      if (!res.ok) throw new Error(json?.error || 'Помилка');
      toast.success(
        json.credited_manager
          ? `Агенцію підтверджено · код ${json.partner.referral_code} · зараховано менеджеру ${json.credited_manager}`
          : `Агенцію підтверджено · код ${json.partner.referral_code}`,
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Не вдалося підтвердити');
    } finally {
      setApproving(null);
    }
  };

  /**
   * Закриття заявки або повернення її в роботу.
   *
   * 'duplicate' і 'declined' навмисно різні: повторну заявку не відхилили по
   * суті, і в списку вона стоїть окремим блоком із посиланням на картку
   * партнера, а не серед відмов.
   */
  const patchRequest = async (id: string, status: 'new' | 'declined' | 'duplicate', reason?: string) => {
    setSavingRequest(id);
    try {
      const res = await fetch('/api/admin/partnership-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, reason }),
      });
      const json = await res.json();
      // Той самий гард, що й на підтвердженні: закрити заявку означає вирішити
      // її долю, тож право те саме.
      if (res.status === 403) throw new Error('Закривати заявки можуть адміністратори та маркетинг із повним доступом');
      if (!res.ok) throw new Error(json?.error || 'Помилка');
      toast.success(
        status === 'duplicate' ? 'Позначено повторною'
          : status === 'declined' ? 'Заявку відхилено'
          : 'Заявку повернено в роботу',
      );
      setClosing(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Не вдалося зберегти');
    } finally {
      setSavingRequest(null);
    }
  };

  /** Партнер на ту саму пошту — щоб дати посилання на його картку. */
  const partnerFor = (email: string | null) => {
    const key = String(email || '').trim().toLowerCase();
    if (!key) return null;
    return partners.find(p => String(p.email || '').trim().toLowerCase() === key) || null;
  };

  const shortDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }) : '';

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
      // Виплата — це видача грошей, тому вона лишається суто
      // адміністраторською (requireAdmin) і не йде під право підтвердження.
      if (res.status === 403) throw new Error('Проводити виплати може лише адміністратор');
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

      {loadErrors.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#b91c1c', marginBottom: 4 }}>Частина даних не завантажилася</div>
          {loadErrors.map((e, i) => (
            <div key={i} style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.6 }}>{e}</div>
          ))}
        </div>
      )}

      {/* Заявки: нові, повторні, відхилені.
          До 16.09.2026 тут був один список усього, що не 'approved', і єдина
          кнопка «Підтвердити». Відхилити заявку з адмінки було неможливо, тож
          усе, що не стало партнером, висіло тут вічно. */}
      {(() => {
        const openRequests = requests.filter(r => ['new', 'contacted'].includes(r.status));
        const duplicateRequests = requests.filter(r => r.status === 'duplicate');
        const declinedRequests = requests.filter(r => r.status === 'declined');

        const requestCard = (r: PendingRequest, tone: 'open' | 'closed') => {
          const partner = partnerFor(r.email);
          const repeat = isRepeatApplication(r, partners, requests);
          const busy = savingRequest === r.id;
          const closingThis = closing?.id === r.id;
          const earlier = requests
            .filter(o => o.id !== r.id
              && String(o.email || '').toLowerCase() === String(r.email || '').toLowerCase()
              && new Date(o.created_at).getTime() < new Date(r.created_at).getTime())
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          const repeatNote = partner
            ? `повторна заявка, партнер уже є з ${shortDate(partner.created_at)}`
            : earlier
              ? `повторна заявка, попередня від ${shortDate(earlier.created_at)}`
              : 'повторна заявка';

          return (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, opacity: tone === 'closed' ? 0.75 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.agency_name}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: r.kind === 'travel_blogger' ? '#fce7f3' : '#e0e7ff', color: r.kind === 'travel_blogger' ? '#be185d' : '#3730a3' }}>{r.kind === 'travel_blogger' ? 'Блогер' : 'Агенція'}</span>
                    {repeat && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#fef3c7', color: '#92400e' }}>
                        <Users size={11} /> Повторна
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: '#cbd5e1' }}>{shortDate(r.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{r.contact_name && `${r.contact_name} · `}{r.email}{r.phone && ` · ${r.phone}`}</div>
                  {r.website && <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.website}</div>}
                  {repeat && (
                    <div style={{ fontSize: 12.5, color: '#92400e', marginTop: 6 }}>
                      {repeatNote}
                      {partner && (
                        <a href={`#partner-${partner.id}`} style={{ color: '#263A99', fontWeight: 700, marginLeft: 6 }}>
                          відкрити картку →
                        </a>
                      )}
                    </div>
                  )}
                  {tone === 'closed' && (
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 6 }}>
                      {r.status === 'duplicate' ? 'Позначено повторною' : 'Відхилено'}
                      {r.closed_at && ` ${shortDate(r.closed_at)}`}
                      {r.closed_by && `, ${r.closed_by}`}
                      {r.decline_reason && ` · ${r.decline_reason}`}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {!canApprove ? (
                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                      Рішення по заявці ухвалюють адміністратори та маркетинг із повним доступом. Ви бачите заявку, щоб знати про неї, але кнопок тут немає саме тому.
                    </div>
                  ) : tone === 'open' ? (
                    <>
                      <button
                        onClick={() => approve(r.id)}
                        disabled={approving === r.id || busy}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#263A99', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                      >
                        {approving === r.id ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                        Підтвердити та видати код
                      </button>
                      {repeat && (
                        <button
                          onClick={() => patchRequest(r.id, 'duplicate', repeatNote)}
                          disabled={busy}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: '#92400e', border: '1.5px solid #fcd34d', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                        >
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                          Повторна
                        </button>
                      )}
                      <button
                        onClick={() => setClosing(closingThis ? null : { id: r.id, reason: '' })}
                        disabled={busy}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: '#b91c1c', border: '1.5px solid #fecaca', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                      >
                        <X size={14} /> Відхилити
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => patchRequest(r.id, 'new')}
                      disabled={busy}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: '#475569', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                      Повернути в роботу
                    </button>
                  )}
                </div>
              </div>

              {closingThis && (
                <div style={{ marginTop: 14, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Причина відмови</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {DECLINE_REASONS.map(reason => (
                      <button key={reason} type="button"
                        onClick={() => setClosing({ id: r.id, reason })}
                        style={{ fontSize: 12.5, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontWeight: 600,
                          border: closing?.reason === reason ? '1.5px solid #263A99' : '1px solid #e2e8f0',
                          background: closing?.reason === reason ? '#eef3ff' : '#fff',
                          color: closing?.reason === reason ? '#263A99' : '#475569' }}>
                        {reason}
                      </button>
                    ))}
                  </div>
                  <input
                    value={closing?.reason || ''}
                    onChange={e => setClosing({ id: r.id, reason: e.target.value })}
                    placeholder="Або напишіть свою причину"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13.5, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => patchRequest(r.id, 'declined', closing?.reason)}
                      disabled={busy || !String(closing?.reason || '').trim()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: String(closing?.reason || '').trim() ? '#b91c1c' : '#e2e8f0', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: String(closing?.reason || '').trim() ? 'pointer' : 'not-allowed' }}
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                      Відхилити заявку
                    </button>
                    <button onClick={() => setClosing(null)}
                      style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Скасувати
                    </button>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Лист партнеру не надсилається</span>
                  </div>
                </div>
              )}
            </div>
          );
        };

        return (
          <>
            {openRequests.length > 0 && (
              <section style={{ marginBottom: 36 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Нові заявки ({openRequests.length})</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {openRequests.map(r => requestCard(r, 'open'))}
                </div>
              </section>
            )}

            {duplicateRequests.length > 0 && (
              <section style={{ marginBottom: 36 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#92400e', marginBottom: 12 }}>Повторні заявки ({duplicateRequests.length})</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {duplicateRequests.map(r => requestCard(r, 'closed'))}
                </div>
              </section>
            )}

            {declinedRequests.length > 0 && (
              <section style={{ marginBottom: 36 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#64748b', marginBottom: 12 }}>Відхилені заявки ({declinedRequests.length})</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {declinedRequests.map(r => requestCard(r, 'closed'))}
                </div>
              </section>
            )}
          </>
        );
      })()}

      {/* Active partners */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Партнери ({partners.length})</h2>
        {partners.length === 0 ? (
          <div style={{ color: '#94a3b8', padding: '30px 0', textAlign: 'center' }}>Ще немає підтверджених партнерів</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {partners.map(p => (
              // id — щоб посилання «відкрити картку» з повторної заявки вело
              // саме на цього партнера, а не просто на розділ.
              <div key={p.id} id={`partner-${p.id}`} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, scrollMarginTop: 90 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 16 }}>{p.agency_name}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: p.partner_kind === 'travel_blogger' ? '#fce7f3' : p.partner_kind === 'wedding_agency' ? '#fef3c7' : p.partner_kind === 'photographer' ? '#dcfce7' : '#e0e7ff', color: p.partner_kind === 'travel_blogger' ? '#be185d' : p.partner_kind === 'wedding_agency' ? '#92400e' : p.partner_kind === 'photographer' ? '#166534' : '#3730a3' }}>{p.partner_kind === 'travel_blogger' ? 'Блогер' : p.partner_kind === 'wedding_agency' ? 'Весільна агенція' : p.partner_kind === 'photographer' ? 'Фотограф' : 'Агенція'}</span>
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
                    {partnerRefLink(p.referral_code)}
                  </code>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(partnerRefLink(p.referral_code)); toast.success('Посилання скопійовано'); }}
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

                {/* Хто привів. Ставиться автоматично, коли партнер прийшов
                    від менеджера або збігся з його лідом; тут це видно й можна
                    виправити. */}
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>Привів менеджер:</span>
                  <select
                    value={p.sales_manager_id || ''}
                    disabled={managers.length === 0}
                    onChange={async e => {
                      const managerId = e.target.value || null;
                      const r = await fetch('/api/admin/sales-managers', {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ assign: 'partner', target_id: p.id, manager_id: managerId }),
                      });
                      if (r.ok) { await load(); toast.success(managerId ? 'Менеджера записано' : 'Привʼязку знято'); }
                      // Привʼязка керує тим, кому піде комісія з продажу, тому
                      // лишається адміністраторською. Кажемо це прямо, щоб 403
                      // не виглядав як збій збереження.
                      else if (r.status === 403) toast.error('Змінювати «привів менеджер» може лише адміністратор');
                      else toast.error('Не вдалося зберегти');
                    }}
                    style={{ fontSize: 12.5, border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 10px', background: '#fff', color: '#475569' }}>
                    <option value="">Ніхто — прийшов сам</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  {managers.length === 0 && (
                    <span style={{ fontSize: 12, color: '#b91c1c' }}>список менеджерів не завантажився</span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 16 }}>
                  <Stat
                    label="Переходів"
                    value={String(p.visits ?? 0)}
                    hint={p.last_visit_at ? `востаннє ${new Date(p.last_visit_at).toLocaleDateString('uk-UA')}` : 'повтори за добу — один'}
                  />
                  <Stat label="Замовлень за кодом" value={String(p.orders_count)} hint="лише оплачені" />
                  <Stat label="Виручка за кодом" value={`${Number(p.orders_revenue).toFixed(0)} ₴`} />
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

                {p.pending_payout >= 500 && !canPayout ? (
                  <div style={{ marginTop: 14, textAlign: 'right', fontSize: 12, color: '#92400e' }}>
                    До виплати {Number(p.pending_payout).toFixed(0)} ₴ — проводить виплату адміністратор
                  </div>
                ) : p.pending_payout >= 500 ? (
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
