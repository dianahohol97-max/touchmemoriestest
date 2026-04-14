'use client';
import { COVER_TEMPLATES, CoverTemplate } from '@/lib/editor/cover-templates';

interface CoverTemplatesPickerProps {
  onApply: (template: CoverTemplate) => void;
  productType?: string; // 'photobook' | 'magazine' | 'travelbook' | 'journal' | 'wishbook'
}

function MiniPreview({ t }: { t: CoverTemplate }) {
  const w = 80, h = 80;
  const ps = t.photoSlot;
  const slotX = ps ? ps.x/100*w : 0, slotY = ps ? ps.y/100*h : 0, slotW = ps ? ps.w/100*w : 0, slotH = ps ? ps.h/100*h : 0;
  const br = ps?.shape === 'circle' ? '50%' : ps?.shape === 'rounded' ? '4px' : '0';

  return (
    <div style={{ width: w, height: h, background: t.bgColor, position: 'relative', overflow: 'hidden', borderRadius: 4, border: '1px solid #e2e8f0' }}>
      {/* Photo slot placeholder */}
      {ps && <div style={{
        position: 'absolute', left: slotX, top: slotY, width: slotW, height: slotH,
        borderRadius: br, background: '#ddd', border: '0.5px dashed #bbb',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
        </svg>
      </div>}
      {/* Overlay */}
      {t.overlay && t.overlay.type !== 'none' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: t.overlay.type === 'gradient' ? t.overlay.gradient : t.overlay.color,
          opacity: t.overlay.opacity / 100,
        }}/>
      )}
      {/* Text previews */}
      {t.texts.map((txt, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${txt.x}%`, top: `${txt.y}%`,
          transform: 'translate(-50%, -50%)',
          fontSize: Math.max(4, txt.fontSize * 0.15),
          fontFamily: txt.fontFamily,
          color: txt.color,
          fontWeight: txt.bold ? 700 : 400,
          whiteSpace: 'nowrap',
          lineHeight: 1,
          pointerEvents: 'none',
        }}>
          {txt.text.length > 16 ? txt.text.slice(0, 14) + '…' : txt.text}
        </div>
      ))}
    </div>
  );
}

export function CoverTemplatesPicker({ onApply, productType }: CoverTemplatesPickerProps) {
  // Filter templates: show only matching tags, or templates without tags (universal)
  const filtered = COVER_TEMPLATES.filter(t => {
    if (!t.tags || t.tags.length === 0) return !productType || !['magazine','journal','wishbook'].includes(productType); // universal templates only for photobook/travelbook
    if (!productType) return true;
    return t.tags.includes(productType);
  });
  const groups = [...new Set(filtered.map(t => t.group))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1e2d7d', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 16 }}>✨</span> Шаблони обкладинок
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>
        Оберіть шаблон — текст і фото можна редагувати після застосування
      </div>

      {groups.map(group => (
        <div key={group}>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            {group}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {filtered.filter(t => t.group === group).map(t => (
              <button
                key={t.id}
                onClick={() => onApply(t)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: 4, border: '1px solid #e2e8f0', borderRadius: 8,
                  background: '#fff', cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#1e2d7d'; e.currentTarget.style.background = '#f8f9ff'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
              >
                <MiniPreview t={t} />
                <span style={{ fontSize: 9, fontWeight: 600, color: '#64748b', lineHeight: 1.2 }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
