'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  Palette, ClipboardList, CheckCircle, RefreshCw,
  Clock, AlertCircle, ChevronRight, Eye, Send,
  Inbox, Star, TrendingUp, Calendar
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft:              { label: 'Чернетка',         color: '#64748b', bg: '#f1f5f9',  dot: '#94a3b8' },
  in_progress:        { label: 'В роботі',          color: '#7c3aed', bg: '#f5f3ff',  dot: '#7c3aed' },
  sent_for_review:    { label: 'На узгодженні',     color: '#0891b2', bg: '#ecfeff',  dot: '#0891b2' },
  revision_requested: { label: 'Потрібні правки',   color: '#d97706', bg: '#fffbeb',  dot: '#f59e0b' },
  approved:           { label: 'Затверджено',       color: '#059669', bg: '#f0fdf4',  dot: '#10b981' },
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  new: 'Нове', confirmed: 'Підтверджено', in_production: 'У виробництві',
  shipped: 'Відправлено', delivered: 'Доставлено', cancelled: 'Скасовано',
};

export default function DesignerCabinetPage() {
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myProjects, setMyProjects] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [freeOrders, setFreeOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'dashboard' | 'projects' | 'free' | 'revisions'>('dashboard');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setCurrentUser(user);

    // My projects (as designer)
    const { data: projects } = await supabase
      .from('customer_projects')
      .select('*, order:orders(id, order_number, customer_name, items, order_status)')
      .eq('designer_id', user.id)
      .order('updated_at', { ascending: false });
    setMyProjects(projects || []);

    // Orders assigned to me
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, items, order_status, created_at, designer_project_id, with_designer')
      .eq('designer_id', user.id)
      .eq('with_designer', true)
      .order('created_at', { ascending: false });
    setMyOrders(orders || []);

    // Free orders (with_designer=true, no designer assigned)
    const { data: free } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, items, order_status, created_at')
      .eq('with_designer', true)
      .is('designer_id', null)
      .in('order_status', ['new', 'confirmed'])
      .order('created_at', { ascending: false });
    setFreeOrders(free || []);

    setLoading(false);
  };

  const getConstructorUrl = (order: any, orderId: string) => {
    const items = (order?.items || []) as any[];
    const slug = (items[0]?.slug || items[0]?.product_slug || '').toLowerCase();
    let base = '/order/book';
    if (slug.includes('photoprint') || slug.includes('polaroid')) base = '/order/photoprint';
    else if (slug.includes('canvas') || slug.includes('polotni')) base = '/order/canvas';
    else if (slug.includes('puzzle')) base = `/order/puzzles?product=${slug}`;
    else if (slug.includes('starmap') || slug.includes('star-map')) base = '/order/starmap';
    const sep = base.includes('?') ? '&' : '?';
    if (base === '/order/book') return `${base}?product=${slug || 'photobook-velour'}&designer_order_id=${orderId}&designer_mode=1`;
    return `${base}${sep}designer_order_id=${orderId}&designer_mode=1`;
  };

  const takeOrder = async (orderId: string) => {
    if (!currentUser) return;
    await supabase.from('orders').update({ designer_id: currentUser.id, assigned_at: new Date().toISOString() }).eq('id', orderId);
    await loadData();
  };

  // Stats
  const stats = {
    total: myOrders.length,
    inWork: myProjects.filter(p => p.status === 'in_progress' || p.status === 'draft').length,
    onReview: myProjects.filter(p => p.status === 'sent_for_review').length,
    revisions: myProjects.filter(p => p.status === 'revision_requested').length,
    approved: myProjects.filter(p => p.status === 'approved').length,
    free: freeOrders.length,
  };

  const revisionProjects = myProjects.filter(p => p.status === 'revision_requested');

  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px',
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ color: '#94a3b8', fontSize: 14 }}>Завантаження...</div>
    </div>
  );

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, fontFamily: 'var(--font-primary, sans-serif)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1e2d7d', margin: 0 }}>
             Кабінет дизайнера
          </h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
            Твої проекти, замовлення та правки від клієнтів
          </p>
        </div>
        <button onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
          <RefreshCw size={14} /> Оновити
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: '#f8fafc', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {([
          { id: 'dashboard', label: 'Огляд', icon: <TrendingUp size={14} /> },
          { id: 'projects',  label: `Мої проекти (${myProjects.length})`, icon: <Palette size={14} /> },
          { id: 'free',      label: `Вільні (${freeOrders.length})`, icon: <Inbox size={14} />, alert: freeOrders.length > 0 },
          { id: 'revisions', label: `Правки (${revisionProjects.length})`, icon: <AlertCircle size={14} />, alert: revisionProjects.length > 0 },
        ] as any[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 0.15s', background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? '#1e2d7d' : '#64748b', boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', position: 'relative' }}>
            {t.icon} {t.label}
            {t.alert && <span style={{ position: 'absolute', top: 6, right: 8, width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />}
          </button>
        ))}
      </div>

      {/*  DASHBOARD  */}
      {tab === 'dashboard' && (
        <div>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'Всього замовлень', value: stats.total, icon: <ClipboardList size={20} />, color: '#1e2d7d', bg: '#eff6ff' },
              { label: 'В роботі',         value: stats.inWork, icon: <Palette size={20} />, color: '#7c3aed', bg: '#f5f3ff' },
              { label: 'На узгодженні',    value: stats.onReview, icon: <Send size={20} />, color: '#0891b2', bg: '#ecfeff' },
              { label: 'Правки',           value: stats.revisions, icon: <AlertCircle size={20} />, color: '#d97706', bg: '#fffbeb' },
              { label: 'Затверджено',      value: stats.approved, icon: <CheckCircle size={20} />, color: '#059669', bg: '#f0fdf4' },
              { label: 'Вільні',           value: stats.free, icon: <Inbox size={20} />, color: '#64748b', bg: '#f8fafc' },
            ].map(s => (
              <div key={s.label} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                  {s.icon}
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Recent activity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Recent projects */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#1e2d7d' }}>Останні проекти</span>
                <button onClick={() => setTab('projects')} style={{ fontSize: 12, color: '#7c3aed', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}>Всі →</button>
              </div>
              {myProjects.slice(0, 5).map(p => {
                const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.draft;
                return (
                  <Link key={p.id} href={`/admin/orders/${p.order_id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f8fafc', textDecoration: 'none' }}>
                    {p.thumbnail_url
                      ? <img src={p.thumbnail_url} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: 36, height: 36, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Palette size={16} color="#94a3b8" /></div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>#{(p as any).order?.order_number}</div>
                    </div>
                    <span style={{ background: st.bg, color: st.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{st.label}</span>
                  </Link>
                );
              })}
              {myProjects.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>Проектів ще немає</p>}
            </div>

            {/* Revisions */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#1e2d7d' }}>
                  Правки від клієнтів
                  {revisionProjects.length > 0 && <span style={{ marginLeft: 8, background: '#fef2f2', color: '#ef4444', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20 }}>{revisionProjects.length}</span>}
                </span>
                <button onClick={() => setTab('revisions')} style={{ fontSize: 12, color: '#d97706', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}>Всі →</button>
              </div>
              {revisionProjects.length === 0
                ? <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <CheckCircle size={32} color="#10b981" style={{ marginBottom: 8 }} />
                    <p style={{ fontSize: 13, color: '#64748b' }}>Правок немає </p>
                  </div>
                : revisionProjects.slice(0, 4).map(p => (
                  <Link key={p.id} href={`/admin/orders/${p.order_id}`}
                    style={{ display: 'block', padding: '10px 12px', background: '#fffbeb', borderRadius: 8, marginBottom: 8, textDecoration: 'none', border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>{p.title}</div>
                    {p.revision_notes && <div style={{ fontSize: 12, color: '#b45309', fontStyle: 'italic' }}>"{p.revision_notes}"</div>}
                    <div style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>Замовлення #{(p as any).order?.order_number}</div>
                  </Link>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/*  MY PROJECTS  */}
      {tab === 'projects' && (
        <div>
          <div style={{ display: 'grid', gap: 12 }}>
            {myProjects.map(p => {
              const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.draft;
              const order = (p as any).order;
              return (
                <div key={p.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 16 }}>
                  {p.thumbnail_url
                    ? <img src={p.thumbnail_url} style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 56, height: 56, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Palette size={24} color="#94a3b8" /></div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginBottom: 2 }}>{p.title}</div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94a3b8', flexWrap: 'wrap' }}>
                      {order?.order_number && <span>#{order.order_number}</span>}
                      {p.format && <span> {p.format}</span>}
                      {p.cover_type && <span> {p.cover_type}</span>}
                      {p.page_count > 0 && <span> {p.page_count} стор.</span>}
                      <span> {new Date(p.updated_at).toLocaleDateString('uk-UA')}</span>
                    </div>
                    {p.revision_notes && (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#b45309', background: '#fffbeb', padding: '4px 8px', borderRadius: 6, display: 'inline-block' }}>
                         {p.revision_notes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <span style={{ background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{st.label}</span>
                    {p.order_id && (
                      <Link href={`/admin/orders/${p.order_id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#1e2d7d', fontWeight: 600, textDecoration: 'none' }}>
                        <Eye size={13} /> Відкрити
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
            {myProjects.length === 0 && (
              <div style={{ ...cardStyle, textAlign: 'center', padding: 48 }}>
                <Palette size={40} color="#e2e8f0" style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 15, color: '#94a3b8', fontWeight: 600 }}>Проектів ще немає</p>
                <p style={{ fontSize: 13, color: '#cbd5e1' }}>Візьміть замовлення зі списку вільних</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/*  FREE ORDERS  */}
      {tab === 'free' && (
        <div>
          <div style={{ marginBottom: 20, padding: '12px 16px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', fontSize: 13, color: '#1e40af' }}>
             Тут замовлення де клієнт обрав «Оформити з дизайнером» і ще не призначено виконавця. Натисни «Взяти» щоб прийняти замовлення.
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {freeOrders.map(o => {
              const items = (o.items || []) as any[];
              const productName = items[0]?.name || 'Товар';
              return (
                <div key={o.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Inbox size={22} color="#3b82f6" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginBottom: 2 }}>
                      Замовлення #{o.order_number}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                      {o.customer_name} · {productName}
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#94a3b8' }}>
                      <span><Calendar size={10} style={{ display: 'inline', marginRight: 3 }} />{new Date(o.created_at).toLocaleDateString('uk-UA')}</span>
                      <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>{ORDER_STATUS_LABEL[o.order_status] || o.order_status}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Link href={`/admin/orders/${o.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                      <Eye size={14} /> Деталі
                    </Link>
                    <button onClick={() => takeOrder(o.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      <Star size={14} /> Взяти
                    </button>
                  </div>
                </div>
              );
            })}
            {freeOrders.length === 0 && (
              <div style={{ ...cardStyle, textAlign: 'center', padding: 48 }}>
                <CheckCircle size={40} color="#10b981" style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 15, color: '#64748b', fontWeight: 600 }}>Вільних замовлень немає</p>
                <p style={{ fontSize: 13, color: '#94a3b8' }}>Всі замовлення з дизайнером вже призначені</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/*  REVISIONS  */}
      {tab === 'revisions' && (
        <div>
          {revisionProjects.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 64 }}>
              <CheckCircle size={48} color="#10b981" style={{ marginBottom: 16 }} />
              <p style={{ fontSize: 18, fontWeight: 800, color: '#064e3b' }}>Правок немає </p>
              <p style={{ fontSize: 14, color: '#6ee7b7', marginTop: 4 }}>Усі клієнти задоволені!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {revisionProjects.map(p => {
                const order = (p as any).order;
                return (
                  <div key={p.id} style={{ ...cardStyle, borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#92400e', marginBottom: 2 }}>{p.title}</div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>
                          Замовлення #{order?.order_number} · {order?.customer_name}
                        </div>
                      </div>
                      <span style={{ background: '#fffbeb', color: '#d97706', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid #fde68a', flexShrink: 0 }}>
                        Потрібні правки
                      </span>
                    </div>
                    {p.revision_notes && (
                      <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Коментар клієнта:</div>
                        <div style={{ fontSize: 14, color: '#78350f', fontStyle: 'italic' }}>"{p.revision_notes}"</div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a href={getConstructorUrl(order, p.order_id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1e2d7d', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                        <Palette size={14} /> Відкрити конструктор
                      </a>
                      <Link href={`/review/${p.share_token}`} target="_blank"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                        <Eye size={14} /> Сторінка клієнта
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
