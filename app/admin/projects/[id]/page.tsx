'use client';
import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Download, ShoppingCart, Image as ImageIcon, ZoomIn, X } from 'lucide-react';

const PRODUCT_LABELS: Record<string, string> = {
  photobook: 'Фотокнига', photoprint: 'Фотодрук', journal: 'Журнал',
  poster: 'Постер', calendar: 'Календар', travelbook: 'Travel Book',
  photomagnets: 'Магніти', puzzle: 'Пазл',
};
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Чернетка', color: '#64748b' },
  ordered: { label: 'Замовлено', color: '#2563eb' },
  in_production: { label: 'У виробництві', color: '#d97706' },
  done: { label: 'Виконано', color: '#16a34a' },
};

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const [project, setProject] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => { fetchProject(); }, [id]);

  const fetchProject = async () => {
    const { data: p } = await supabase.from('customer_projects').select('*').eq('id', id).single();
    setProject(p);
    if (p?.order_id) {
      const { data: f } = await supabase.from('order_files').select('*').eq('order_id', p.order_id).order('page_number');
      setFiles(f || []);
    }
    setLoading(false);
  };

  const getFileUrl = (f: any) => {
    const { data } = supabase.storage.from(f.bucket_name || 'photobook-uploads').getPublicUrl(f.file_path);
    return data.publicUrl;
  };

  if (loading) return <div style={{ padding: 40, color: '#94a3b8' }}>Завантаження...</div>;
  if (!project) return <div style={{ padding: 40, color: '#ef4444' }}>Проект не знайдено</div>;

  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.draft;
  const config = project.config || {};

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link href="/admin/projects" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', textDecoration: 'none', fontSize: 13 }}>
          <ArrowLeft size={16} /> Назад
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
            {project.title || 'Проект без назви'}
          </h1>
          <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>
              {PRODUCT_LABELS[project.product_type] || project.product_type}
            </span>
            <span style={{ fontSize: 12, color: status.color, fontWeight: 600 }}>{status.label}</span>
          </div>
        </div>
        {project.order_id && (
          <Link href={`/admin/orders/${project.order_id}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1e2d7d', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
            <ShoppingCart size={14} /> Переглянути замовлення
          </Link>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
        {/* Left: Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Thumbnail */}
          {project.thumbnail_url && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
              <img src={project.thumbnail_url} alt="" style={{ width: '100%', display: 'block' }} />
            </div>
          )}

          {/* Config card */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Конфігурація</div>
            {Object.entries(config).length === 0 ? (
              <p style={{ fontSize: 13, color: '#94a3b8' }}>Немає даних</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {config.selectedSize && <Row label="Розмір" value={config.selectedSize} />}
                {config.selectedPageCount && <Row label="Сторінок" value={config.selectedPageCount} />}
                {config.selectedCoverType && <Row label="Обкладинка" value={config.selectedCoverType} />}
                {config.selectedCoverColor && <Row label="Колір" value={config.selectedCoverColor} />}
                {config.selectedDecorationType && <Row label="Декор" value={config.selectedDecorationType} />}
                {config.totalPrice && <Row label="Ціна" value={`${config.totalPrice} грн`} />}
              </div>
            )}
          </div>

          {/* Meta */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Інфо</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row label="Створено" value={new Date(project.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
              <Row label="Оновлено" value={new Date(project.updated_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
              <Row label="Фото" value={`${project.file_count || files.length} файлів`} />
            </div>
          </div>
        </div>

        {/* Right: Files */}
        <div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                Файли клієнта ({files.length})
              </div>
            </div>

            {files.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', color: '#94a3b8', gap: 8 }}>
                <ImageIcon size={36} strokeWidth={1} />
                <p style={{ fontSize: 13 }}>Файли ще не завантажені</p>
                <p style={{ fontSize: 12 }}>Файли з'являться тут після того як клієнт завантажить фото та оформить замовлення</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {files.map((f, i) => {
                  const url = getFileUrl(f);
                  const isImage = f.mime_type?.startsWith('image/');
                  return (
                    <div key={f.id}
                      style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', position: 'relative', cursor: isImage ? 'pointer' : 'default' }}
                      onClick={() => isImage && setLightbox(url)}
                    >
                      {isImage ? (
                        <img src={url} alt={f.file_name} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ width: '100%', height: 120, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ImageIcon size={28} color="#cbd5e1" />
                        </div>
                      )}
                      {f.page_number != null && (
                        <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>
                          стор. {f.page_number}
                        </div>
                      )}
                      <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {f.file_name || `Файл ${i + 1}`}
                        </span>
                        <a href={url} download={f.file_name} onClick={e => e.stopPropagation()}
                          style={{ color: '#94a3b8', flexShrink: 0 }}>
                          <Download size={11} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Canvas data preview */}
          {project.canvas_data && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginTop: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Дані макету (JSON)</div>
              <pre style={{ fontSize: 11, color: '#475569', background: '#f8fafc', padding: 12, borderRadius: 8, overflow: 'auto', maxHeight: 300, margin: 0 }}>
                {JSON.stringify(project.canvas_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'pointer' }}
        >
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#0f172a', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
