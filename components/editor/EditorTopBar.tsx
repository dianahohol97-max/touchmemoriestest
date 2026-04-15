'use client';

import { ChevronLeft, ZoomIn, ZoomOut, Wand2, RotateCcw, Eye, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useBookEditorStore } from '@/lib/editor/store';
import { calculateDynamicPrice } from '@/lib/editor/pricing';
import { normalizeSizeKey, getProductFlags } from '@/lib/editor/utils';

interface EditorTopBarProps {
  onAddToCart: () => void;
  onSaveDesigner?: (action: 'save' | 'send_for_review') => void;
}

export function EditorTopBar({ onAddToCart, onSaveDesigner }: EditorTopBarProps) {
  const router = useRouter();
  const {
    config, photos, pages, isMobile, zoom, setZoom,
    history, undo, autoFill, setShowPreview, setShowTooltips, setTooltipStep,
    designerOrderId, designerSaving,
  } = useBookEditorStore();

  if (!config) return null;

  const { isPrinted } = getProductFlags(config);
  const slug = (config.productSlug || '').toLowerCase();
  const sizeVal = normalizeSizeKey(config.selectedSize || '20x20');
  const currentPageCount = Math.max(0, pages.length - 1);
  const { dynamicPrice, priceDiff } = calculateDynamicPrice(
    config.selectedCoverType || 'Велюр', sizeVal, currentPageCount,
    config.selectedPageCount || '20', config.totalPrice
  );
  const effectiveCoverColor = useBookEditorStore(s => s.getEffectiveCoverColor());
  const totalSpreads = Math.ceil((pages.length - 1) / 2);

  const sizeLabel = slug.includes('travel') ? '20×30 см'
    : (slug.includes('magazine') || slug.includes('journal') || slug.includes('zhurnal')) ? 'A4'
    : config.selectedSize ? `${config.selectedSize} см` : '';

  if (isMobile) {
    return (
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        {/* Row 1: Back + title + Cart */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: 8 }}>
          <button onClick={() => { if (window.confirm('Вийти з редактора?')) router.back(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: '4px 6px', borderRadius: 6, flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#1e2d7d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{config.productName || 'Фотокнига'}</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{photos.length} фото • {pages.length} стор.</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1e2d7d', flexShrink: 0 }}>{dynamicPrice} ₴</div>
          {designerOrderId ? (
            <button onClick={() => onSaveDesigner?.('save')} disabled={designerSaving}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0, opacity: designerSaving ? 0.6 : 1 }}>
               Зберегти
            </button>
          ) : (
            <button onClick={onAddToCart}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
               Готово
            </button>
          )}
        </div>
        {/* Row 2: Auto + Undo + Zoom + Preview */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 10px 6px', gap: 6, borderTop: '1px solid #f1f5f9' }}>
          <button onClick={autoFill}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1e2d7d' }}>
            <Wand2 size={12} /> Авто
          </button>
          <button onClick={undo} disabled={history.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 7, background: '#fff', cursor: history.length === 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, color: history.length === 0 ? '#cbd5e1' : '#1e2d7d', opacity: history.length === 0 ? 0.5 : 1 }}>
            <RotateCcw size={12} /> Undo
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
            <button onClick={() => setZoom(z => Math.max(30, z - 10))} style={{ padding: '5px 7px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}><ZoomOut size={12} /></button>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', minWidth: 30, textAlign: 'center' }}>{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(130, z + 10))} style={{ padding: '5px 7px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}><ZoomIn size={12} /></button>
          </div>
          <button onClick={() => setShowPreview(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#f0f3ff', color: '#1e2d7d', border: '1px solid #c7d2fe', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            <Eye size={12} /> Перегляд
          </button>
        </div>
      </div>
    );
  }

  // Desktop
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0, gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => { if (window.confirm('Вийти з редактора? Незбережені зміни буде втрачено.')) router.back(); }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, color: '#374151' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>НАЗАД</span>
        </button>
        <div style={{ width: 1, height: 32, background: '#e2e8f0' }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#1e2d7d' }}>{config.productName || 'Фотокнига'}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Редактор • {photos.length} фото • {pages.length} сторінок
            {sizeLabel ? ` • ${sizeLabel}` : ''}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={autoFill} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1e2d7d' }}><Wand2 size={14} /> Авто</button>
        <button onClick={undo} disabled={history.length === 0} title="Скасувати (Ctrl+Z)" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: history.length === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: history.length === 0 ? '#cbd5e1' : '#1e2d7d', opacity: history.length === 0 ? 0.5 : 1 }}><RotateCcw size={14} /> Undo</button>
        <button onClick={() => setZoom(z => Math.max(30, z - 10))} style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}><ZoomOut size={14} /></button>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', minWidth: 36, textAlign: 'center' }}>{zoom}%</span>
        <button onClick={() => setZoom(z => Math.min(130, z + 10))} style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}><ZoomIn size={14} /></button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ textAlign: 'right', paddingRight: 4 }}>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{pages.length - 1} стор. ({totalSpreads} розворот{totalSpreads === 1 ? '' : 'и'})</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1e2d7d' }}>
            {dynamicPrice} ₴
            {priceDiff !== 0 && <span style={{ fontSize: 11, color: priceDiff > 0 ? '#10b981' : '#ef4444', marginLeft: 4 }}>{priceDiff > 0 ? '+' : ''}{priceDiff}₴</span>}
          </div>
        </div>
        <button onClick={() => setShowPreview(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#f0f3ff', color: '#1e2d7d', border: '1px solid #c7d2fe', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}><Eye size={14} /> Попередній перегляд</button>
        <button onClick={() => { setTooltipStep(0); setShowTooltips(true); }} title="Підказки" style={{ padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}><HelpCircle size={14} /></button>
        {designerOrderId ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onSaveDesigner?.('save')} disabled={designerSaving}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: designerSaving ? 0.6 : 1 }}>
               Зберегти макет
            </button>
            <button onClick={() => onSaveDesigner?.('send_for_review')} disabled={designerSaving}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: designerSaving ? 0.6 : 1 }}>
               Надіслати на узгодження
            </button>
          </div>
        ) : (
          <button onClick={onAddToCart} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}> Зберегти та замовити</button>
        )}
      </div>
    </div>
  );
}
