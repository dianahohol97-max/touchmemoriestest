'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  Search, Eye, ShoppingCart, Clock, CheckCircle2,
  Package, Image as ImageIcon, BookOpen, FileText,
  Calendar, Map, Grid, Magnet, Puzzle, Filter,
  Download, RefreshCw, FolderOpen
} from 'lucide-react';

const PRODUCT_TYPES = [
  { id: 'all', label: 'Всі продукти', icon: null },
  { id: 'photobook', label: 'Фотокниги', icon: BookOpen },
  { id: 'photoprint', label: 'Фотодрук', icon: ImageIcon },
  { id: 'journal', label: 'Журнали', icon: FileText },
  { id: 'poster', label: 'Постери', icon: Grid },
  { id: 'calendar', label: 'Календарі', icon: Calendar },
  { id: 'travelbook', label: 'Travel Book', icon: Map },
  { id: 'photomagnets', label: 'Магніти', icon: Magnet },
  { id: 'puzzle', label: 'Пазли', icon: Puzzle },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:              { label: 'Чернетка',        color: '#64748b', bg: '#f1f5f9' },
  in_progress:        { label: 'В роботі',         color: '#7c3aed', bg: '#f5f3ff' },
  sent_for_review:    { label: 'На узгодженні',    color: '#0891b2', bg: '#ecfeff' },
  revision_requested: { label: 'Потрібні правки',  color: '#d97706', bg: '#fffbeb' },
  approved:           { label: 'Затверджено',      color: '#059669', bg: '#f0fdf4' },
  ordered:            { label: 'Замовлено',        color: '#2563eb', bg: '#eff6ff' },
  in_production:      { label: 'У виробництві',    color: '#d97706', bg: '#fffbeb' },
  done:               { label: 'Виконано',         color: '#16a34a', bg: '#f0fdf4' },
};

const PRODUCT_LABELS: Record<string, string> = {
  photobook:   'Фотокнига',
  photoprint:  'Фотодрук',
  journal:     'Журнал',
  poster:      'Постер',
  calendar:    'Календар',
  travelbook:  'Travel Book',
  photomagnets:'Магніти',
  puzzle:      'Пазл',
};

const PRODUCT_COLORS: Record<string, string> = {
  photobook:   '#6366f1',
  photoprint:  '#0ea5e9',
  journal:     '#8b5cf6',
  poster:      '#f59e0b',
  calendar:    '#10b981',
  travelbook:  '#ef4444',
  photomagnets:'#ec4899',
  puzzle:      '#f97316',
};

export default function AdminProjectsPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('all');
  const [activeStatus, setActiveStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchProjects();
    fetchStats();
  }, [activeType, activeStatus, search]);

  const fetchStats = async () => {
    const { data } = await supabase
      .from('customer_projects')
      .select('product_type, status');
    if (!data) return;
    const s: Record<string, number> = { all: data.length };
    data.forEach((p: any) => {
      s[p.product_type] = (s[p.product_type] || 0) + 1;
    });
    setStats(s);
  };

  const fetchProjects = async () => {
    setLoading(true);
    let query = supabase
      .from('customer_projects')
      .select(`
        id, product_type, title, status, thumbnail_url,
        file_count, config, created_at, updated_at,
        order_id, designer_id, revision_notes,
        format, cover_type, page_count,
        customer_id, share_token
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (activeType !== 'all') query = query.eq('product_type', activeType);
    if (activeStatus !== 'all') query = query.eq('status', activeStatus);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error } = await query;
    if (!error && data) setProjects(data);
    setLoading(false);
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('uk-UA', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getConfigSummary = (config: any) => {
    if (!config) return null;
    const parts = [];
    if (config.selectedSize) parts.push(config.selectedSize);
    if (config.selectedPageCount) parts.push(`${config.selectedPageCount} стор.`);
    if (config.selectedCoverType) parts.push(config.selectedCoverType);
    return parts.join(' · ') || null;
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Макети клієнтів
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
            Всі проекти по всіх продуктах — {stats.all || 0} загалом
          </p>
        </div>
        <button
          onClick={() => { fetchProjects(); fetchStats(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#475569' }}
        >
          <RefreshCw size={14} /> Оновити
        </button>
      </div>

      {/* Product type tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {PRODUCT_TYPES.map(pt => (
          <button
            key={pt.id}
            onClick={() => setActiveType(pt.id)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s',
              border: activeType === pt.id ? `2px solid #1e2d7d` : '2px solid transparent',
              background: activeType === pt.id ? '#1e2d7d' : '#f1f5f9',
              color: activeType === pt.id ? '#fff' : '#475569',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {pt.id !== 'all' && pt.icon && <pt.icon size={13} />}
            {pt.label}
            {stats[pt.id] !== undefined && (
              <span style={{
                background: activeType === pt.id ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                color: activeType === pt.id ? '#fff' : '#64748b',
                borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 600
              }}>
                {stats[pt.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Пошук за назвою..."
            style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {/* Status filter */}
        <select
          value={activeStatus}
          onChange={e => setActiveStatus(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer' }}
        >
          <option value="all">Всі статуси</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Projects grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 14 }}>
          Завантаження...
        </div>
      ) : projects.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', color: '#94a3b8', gap: 12 }}>
          <FolderOpen size={48} strokeWidth={1} />
          <p style={{ fontSize: 16, fontWeight: 500 }}>Проектів не знайдено</p>
          <p style={{ fontSize: 13 }}>Коли клієнти будуть створювати макети — вони з'являться тут</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {projects.map(p => {
            const status = STATUS_CONFIG[p.status] || STATUS_CONFIG.draft;
            const productColor = PRODUCT_COLORS[p.product_type] || '#64748b';
            const configSummary = getConfigSummary(p.config);

            return (
              <div
                key={p.id}
                style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', transition: 'box-shadow 0.2s', cursor: 'default' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                {/* Thumbnail */}
                <div style={{ width: '100%', height: 160, background: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <ImageIcon size={32} color="#cbd5e1" strokeWidth={1} />
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Без прев'ю</span>
                    </div>
                  )}
                  {/* Product type badge */}
                  <span style={{
                    position: 'absolute', top: 8, left: 8,
                    background: productColor, color: '#fff',
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.5px'
                  }}>
                    {PRODUCT_LABELS[p.product_type] || p.product_type}
                  </span>
                  {/* Status badge */}
                  <span style={{
                    position: 'absolute', top: 8, right: 8,
                    background: status.bg, color: status.color,
                    fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                    border: `1px solid ${status.color}30`
                  }}>
                    {status.label}
                  </span>
                </div>

                {/* Content */}
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.title || `Проект без назви`}
                  </div>

                  {configSummary && (
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{configSummary}</div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {formatDate(p.created_at)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
                      <ImageIcon size={12} />
                      {p.file_count || 0} фото
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {p.order_id && (
                      <Link
                        href={`/admin/orders/${p.order_id}`}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 0', background: '#eff6ff', color: '#2563eb', borderRadius: 6, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}
                      >
                        <ShoppingCart size={12} /> Замовлення
                      </Link>
                    )}
                    <Link
                      href={`/admin/projects/${p.id}`}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 0', background: '#f1f5f9', color: '#475569', borderRadius: 6, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}
                    >
                      <Eye size={12} /> Деталі
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
