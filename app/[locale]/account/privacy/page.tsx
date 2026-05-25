'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useConsent } from '@/lib/consent/ConsentProvider';
import { toast } from 'sonner';
import { Shield, Download, Trash2, Cookie, Mail, History, Loader2 } from 'lucide-react';

export default function PrivacyPage() {
  const supabase = createClient();
  const { consent, reopenBanner } = useConsent();
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [consentHistory, setConsentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingMarketing, setTogglingMarketing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserEmail(user.email || '');

    // Load marketing consent status
    const { data: customer } = await supabase
      .from('customers')
      .select('consent_marketing_at')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    setMarketingConsent(!!customer?.consent_marketing_at);

    // Load consent history
    const { data: history } = await supabase
      .from('consent_log')
      .select('*')
      .or(`customer_id.eq.${user.id},email.eq.${user.email}`)
      .order('created_at', { ascending: false })
      .limit(50);
    setConsentHistory(history || []);

    setLoading(false);
  };

  const toggleMarketing = async () => {
    setTogglingMarketing(true);
    try {
      const res = await fetch('/api/account/consent-marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ granted: !marketingConsent }),
      });
      if (res.ok) {
        setMarketingConsent(!marketingConsent);
        toast.success(marketingConsent ? 'Маркетингові розсилки вимкнено' : 'Маркетингові розсилки увімкнено');
        loadData();
      }
    } catch { toast.error('Помилка'); }
    setTogglingMarketing(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/account/data-export', { method: 'POST' });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my-data-touchmemories.json';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Дані завантажено');
      } else { toast.error('Помилка експорту'); }
    } catch { toast.error('Помилка експорту'); }
    setExporting(false);
  };

  const handleDelete = async () => {
    if (deleteEmail !== userEmail) {
      toast.error('Email не збігається');
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: deleteEmail }),
      });
      if (res.ok) {
        toast.success('Акаунт видалено');
        await supabase.auth.signOut();
        window.location.href = '/';
      } else {
        const data = await res.json();
        toast.error(data.error || 'Помилка видалення');
      }
    } catch { toast.error('Помилка видалення'); }
    setDeleting(false);
  };

  const maskIp = (ip: string | null) => {
    if (!ip) return '—';
    const parts = ip.split('.');
    if (parts.length === 4) { parts[3] = '***'; return parts.join('.'); }
    return ip.replace(/:[^:]+$/, ':***');
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Завантаження...</div>;

  const sectionStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '24px 28px', marginBottom: 20 };
  const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 800, color: '#1e2d7d', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 };
  const btnPrimary: React.CSSProperties = { padding: '10px 20px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 };
  const btnDanger: React.CSSProperties = { ...btnPrimary, background: '#ef4444' };
  const btnSecondary: React.CSSProperties = { padding: '10px 20px', background: '#f1f5f9', color: '#475569', border: '1.5px solid #e2e8f0', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1e2d7d', marginBottom: 8 }}>
        <Shield size={28} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
        Конфіденційність
      </h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>Керуйте вашими даними та налаштуваннями приватності</p>

      {/* Section 1: Marketing */}
      <div style={sectionStyle}>
        <div style={sectionTitle}><Mail size={18} /> Маркетингові розсилки</div>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>Отримувати новини, акції та спеціальні пропозиції від Touch.Memories</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={toggleMarketing} disabled={togglingMarketing} style={{ width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', background: marketingConsent ? '#1e2d7d' : '#e2e8f0', position: 'relative', transition: '0.2s' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: marketingConsent ? 27 : 3, transition: '0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: marketingConsent ? '#1e2d7d' : '#94a3b8' }}>
            {marketingConsent ? 'Увімкнено' : 'Вимкнено'}
          </span>
        </div>
      </div>

      {/* Section 2: Cookie Settings */}
      <div style={sectionStyle}>
        <div style={sectionTitle}><Cookie size={18} /> Налаштування cookies</div>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>
          Аналітичні: <strong>{consent.analytics ? 'увімкнено' : 'вимкнено'}</strong> ·
          Маркетингові: <strong>{consent.marketing ? 'увімкнено' : 'вимкнено'}</strong> ·
          Функціональні: <strong>{consent.functional ? 'увімкнено' : 'вимкнено'}</strong>
        </p>
        <button onClick={reopenBanner} style={btnSecondary}>
          <Cookie size={16} /> Змінити налаштування cookies
        </button>
      </div>

      {/* Section 3: Data Export */}
      <div style={sectionStyle}>
        <div style={sectionTitle}><Download size={18} /> Завантажити мої дані</div>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>Завантажте копію ваших персональних даних у форматі JSON (профіль, замовлення, історія згод)</p>
        <button onClick={handleExport} disabled={exporting} style={btnPrimary}>
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {exporting ? 'Експорт...' : 'Завантажити дані'}
        </button>
      </div>

      {/* Section 4: Delete Account */}
      <div style={{ ...sectionStyle, borderColor: '#fecaca' }}>
        <div style={{ ...sectionTitle, color: '#ef4444' }}><Trash2 size={18} /> Видалити акаунт</div>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>Ваші персональні дані будуть анонімізовані. Замовлення збережуться відповідно до податкового законодавства (4 роки). Ця дія незворотна.</p>
        <button onClick={() => setShowDeleteModal(true)} style={btnDanger}>
          <Trash2 size={16} /> Видалити мій акаунт
        </button>
      </div>

      {/* Section 5: Consent History */}
      <div style={sectionStyle}>
        <div style={sectionTitle}><History size={18} /> Історія згод</div>
        {consentHistory.length === 0 ? (
          <p style={{ fontSize: 14, color: '#94a3b8' }}>Записів немає</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#94a3b8', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Дата</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#94a3b8', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Дія</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#94a3b8', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {consentHistory.map((row: any) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '8px 12px', color: '#475569' }}>{new Date(row.created_at).toLocaleString('uk-UA')}</td>
                    <td style={{ padding: '8px 12px', color: '#1e2d7d', fontWeight: 600 }}>{row.consent_type}</td>
                    <td style={{ padding: '8px 12px', color: '#94a3b8', fontFamily: 'monospace' }}>{maskIp(row.ip_address)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 998 }} onClick={() => setShowDeleteModal(false)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 16, padding: 32, maxWidth: 450, width: '90%', zIndex: 999, boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#ef4444', marginBottom: 12 }}>Видалити акаунт?</h3>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 1.5 }}>
              Ця дія незворотна. Ваші персональні дані будуть анонімізовані. Для підтвердження введіть ваш email:
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1e2d7d', marginBottom: 8 }}>{userEmail}</p>
            <input
              type="email"
              value={deleteEmail}
              onChange={e => setDeleteEmail(e.target.value)}
              placeholder="Введіть email для підтвердження"
              style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowDeleteModal(false)} style={btnSecondary}>Скасувати</button>
              <button onClick={handleDelete} disabled={deleting || deleteEmail !== userEmail} style={{ ...btnDanger, opacity: deleteEmail !== userEmail ? 0.5 : 1 }}>
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Видалити назавжди
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
