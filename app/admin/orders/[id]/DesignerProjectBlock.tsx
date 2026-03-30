'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { Palette, Send, ExternalLink, Copy, CheckCircle, Clock, RefreshCw, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  order: any;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft:              { label: 'Чернетка',           color: '#64748b', bg: '#f1f5f9' },
  in_progress:        { label: 'В роботі',            color: '#7c3aed', bg: '#f5f3ff' },
  sent_for_review:    { label: 'На узгодженні',       color: '#0891b2', bg: '#ecfeff' },
  revision_requested: { label: 'Потрібні правки',     color: '#d97706', bg: '#fffbeb' },
  approved:           { label: 'Затверджено',         color: '#059669', bg: '#f0fdf4' },
};

export default function DesignerProjectBlock({ order }: Props) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadProject();
  }, [order.id]);

  const loadProject = async () => {
    setLoading(true);
    const res = await fetch(`/api/designer-projects?order_id=${order.id}`);
    const data = await res.json();
    setProject(data.project || null);
    setLoading(false);
  };

  // Build constructor URL based on order product
  const getConstructorUrl = () => {
    const items = (order.items || []) as any[];
    const slug = items[0]?.slug || items[0]?.product_slug || '';
    const s = slug.toLowerCase();

    let base = '/order/book';
    if (s.includes('photoprint') || s.includes('polaroid')) base = '/order/photoprint';
    else if (s.includes('canvas') || s.includes('polotni')) base = '/order/canvas';
    else if (s.includes('puzzle')) base = `/order/puzzles?product=${slug}`;
    else if (s.includes('starmap') || s.includes('star-map')) base = '/order/starmap';
    else if (s.includes('citymap') || s.includes('city-map')) base = '/order/citymap';

    const params = new URLSearchParams();
    if (base === '/order/book') params.set('product', slug || 'photobook-velour');
    params.set('designer_order_id', order.id);
    params.set('designer_mode', '1');

    return `${base}${params.toString() ? '?' + params.toString() : ''}`;
  };

  const getReviewUrl = () =>
    project?.share_token
      ? `${window.location.origin}/review/${project.share_token}`
      : null;

  const handleSendForReview = async () => {
    if (!project) { toast.error('Спочатку відкрийте конструктор і збережіть макет'); return; }
    setSending(true);
    const res = await fetch('/api/designer-projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: order.id, action: 'send_for_review' }),
    });
    if (res.ok) {
      toast.success('Посилання для узгодження готове!');
      await loadProject();
    } else {
      toast.error('Помилка надсилання');
    }
    setSending(false);
  };

  const copyReviewLink = async () => {
    const url = getReviewUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Посилання скопійовано!');
    setTimeout(() => setCopied(false), 2000);
  };

  const status = STATUS_MAP[project?.status] || null;

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    padding: '20px 24px',
    marginBottom: 0,
  };

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Palette size={20} color="#7c3aed" />
          <span style={{ fontWeight: 800, fontSize: 15, color: '#1e2d7d' }}>Макет дизайнера</span>
        </div>
        {status && (
          <span style={{ background: status.bg, color: status.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: `1px solid ${status.color}30` }}>
            {status.label}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13 }}>
          <Clock size={14} /> Завантаження...
        </div>
      ) : !project ? (
        // No project yet — show open constructor button
        <div>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
            Макет ще не створено. Відкрийте конструктор, створіть макет і він автоматично збережеться за цим замовленням.
          </p>
          <a href={getConstructorUrl()} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#7c3aed', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none', transition: 'background 0.2s' }}>
            <Palette size={16} /> Відкрити конструктор <ChevronRight size={16} />
          </a>
        </div>
      ) : (
        // Project exists
        <div>
          {/* Project info */}
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', marginBottom: 14, fontSize: 13 }}>
            <div style={{ fontWeight: 700, color: '#1e2d7d', marginBottom: 4 }}>{project.title}</div>
            <div style={{ color: '#64748b', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {project.format && <span>📐 {project.format}</span>}
              {project.cover_type && <span>📖 {project.cover_type}</span>}
              {project.page_count > 0 && <span>📄 {project.page_count} стор.</span>}
              <span>🕐 {new Date(project.updated_at).toLocaleDateString('uk-UA')}</span>
            </div>
          </div>

          {/* Thumbnail */}
          {project.thumbnail_url && (
            <img src={project.thumbnail_url} alt="Макет" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginBottom: 14 }} />
          )}

          {/* Revision notes */}
          {project.revision_notes && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>💬 Правки від клієнта:</div>
              <div style={{ color: '#92400e' }}>{project.revision_notes}</div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Open constructor again */}
            <a href={getConstructorUrl()} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#f0f3ff', color: '#1e2d7d', borderRadius: 7, fontWeight: 700, fontSize: 13, textDecoration: 'none', border: '1px solid #c7d2fe' }}>
              <Palette size={14} />
              {project.status === 'revision_requested' ? 'Редагувати (правки)' : 'Редагувати макет'}
            </a>

            {/* Send for review — only if not yet sent or revision requested */}
            {['in_progress', 'draft', 'revision_requested'].includes(project.status) && (
              <button onClick={handleSendForReview} disabled={sending}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#0891b2', color: '#fff', borderRadius: 7, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>
                <Send size={14} />
                {sending ? 'Надсилаємо...' : 'Надіслати на узгодження'}
              </button>
            )}

            {/* Copy review link — if sent */}
            {['sent_for_review', 'approved', 'revision_requested'].includes(project.status) && getReviewUrl() && (
              <button onClick={copyReviewLink}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: copied ? '#f0fdf4' : '#f8fafc', color: copied ? '#059669' : '#374151', borderRadius: 7, fontWeight: 700, fontSize: 13, border: `1px solid ${copied ? '#bbf7d0' : '#e2e8f0'}`, cursor: 'pointer' }}>
                {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copied ? 'Скопійовано!' : 'Копіювати посилання'}
              </button>
            )}

            {/* Open review page */}
            {getReviewUrl() && (
              <a href={getReviewUrl()!} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#f8fafc', color: '#374151', borderRadius: 7, fontWeight: 600, fontSize: 13, textDecoration: 'none', border: '1px solid #e2e8f0' }}>
                <ExternalLink size={14} /> Переглянути сторінку
              </a>
            )}

            <button onClick={loadProject} title="Оновити статус"
              style={{ padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', color: '#64748b' }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
