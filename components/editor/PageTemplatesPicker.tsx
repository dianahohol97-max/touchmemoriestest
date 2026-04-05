'use client';
import { PAGE_TEMPLATES, PageTemplate } from '@/lib/editor/page-templates';

interface PageTemplatesPickerProps {
  onApply: (template: PageTemplate) => void;
  productType?: string;
}

export function PageTemplatesPicker({ onApply, productType }: PageTemplatesPickerProps) {
  const filtered = PAGE_TEMPLATES.filter(t => {
    if (!t.tags || t.tags.length === 0) return true;
    if (!productType) return true;
    return t.tags.includes(productType);
  });
  const groups = [...new Set(filtered.map(t => t.group))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1e2d7d', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 16 }}>📝</span> Шаблони сторінок з текстом
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>
        Готові текстові сторінки — тексти можна редагувати після застосування
      </div>

      {groups.map(group => (
        <div key={group}>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            {group}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.filter(t => t.group === group).map(t => (
              <button
                key={t.id}
                onClick={() => onApply(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8,
                  background: '#fff', cursor: 'pointer', transition: 'all 0.15s',
                  textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#1e2d7d'; e.currentTarget.style.background = '#f8f9ff'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 6, background: t.bgColor || '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, color: '#94a3b8' }}>
                  {t.hasPhoto ? '📷' : '📝'}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', lineHeight: 1.2 }}>{t.label}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.3, marginTop: 2 }}>{t.texts.length} текст. блоків{t.hasPhoto ? ' + фото' : ''}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
