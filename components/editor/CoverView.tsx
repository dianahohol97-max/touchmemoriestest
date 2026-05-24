'use client';

import { useBookEditorStore } from '@/lib/editor/store';
import { CoverEditor } from '@/components/CoverEditor';
import { buildCoverEditorProps, resolveCoverColor, getProductFlags } from '@/lib/editor/utils';
import { startPointerDrag } from '@/lib/hooks/useMobileInteractions';
import type { PhotoData, CoverState } from '@/lib/editor/types';

interface CoverViewProps {
  pageW: number;
  cH: number;
}

export function CoverView({ pageW, cH }: CoverViewProps) {
  const {
    config, coverState, photos, setCoverState, updateCoverFromChange,
  } = useBookEditorStore();
  const effectiveCoverColor = useBookEditorStore(s => s.getEffectiveCoverColor());

  if (!config) return null;

  const { isPrinted, isHardCoverJournal } = getProductFlags(config);

  // Build props ONCE — both mobile and desktop CoverEditor use the exact same object
  const coverProps = buildCoverEditorProps(config, coverState, effectiveCoverColor);
  const sizeValue = (config.selectedSize || '20x20').replace(/[×х]/g, 'x').replace(/\s*см/, '');

  // Resolve back cover background
  const materialType = config.selectedCoverType || '';
  const backBg = isPrinted
    ? (coverState.backCoverBgColor || '#f1f5f9')
    : resolveCoverColor(materialType, effectiveCoverColor);

  const backPhoto = isPrinted
    ? photos.find(p => p.id === coverState.backCoverPhotoId) ?? null
    : null;

  const backTexts = (coverState as any).backCoverTexts || [];

  const onCoverChange = (cfg: Partial<CoverState>) => {
    updateCoverFromChange(cfg);
  };

  // Drag handler for a back-cover text block. Mirrors the pattern used in
  // CoverEditor.startTextDrag — x/y are percent-based so the position
  // survives canvas resizing across desktop / mobile / preview.
  const startBackTextDrag = (e: React.PointerEvent, id: string, tx: number, ty: number) => {
    e.stopPropagation();
    startPointerDrag(e, (dx, dy) => {
      setCoverState(prev => {
        const list = (prev as any).backCoverTexts || [];
        return {
          ...prev,
          backCoverTexts: list.map((t: any) => t.id === id
            ? { ...t, x: Math.max(2, Math.min(98, tx + dx / pageW * 100)), y: Math.max(2, Math.min(98, ty + dy / cH * 100)) }
            : t),
        } as any;
      });
    });
  };

  return (
    <div style={{ width: pageW * 2, height: cH, display: 'flex', borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', flexShrink: 0 }}>
      {/* Back cover */}
      <div
        style={{ width: pageW, height: cH, flexShrink: 0, position: 'relative', background: backBg, borderRight: '2px solid rgba(0,0,0,0.12)' }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const id = e.dataTransfer.getData('text/plain');
          if (id && isPrinted) setCoverState(p => ({ ...p, backCoverPhotoId: id }));
        }}
      >
        {backPhoto && (
          <img src={backPhoto.preview} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} draggable={false} />
        )}
        {backPhoto && isPrinted && (
          <button
            onClick={() => setCoverState(p => ({ ...p, backCoverPhotoId: null }))}
            style={{ position: 'absolute', top: 4, right: 8, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}
          >×</button>
        )}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {isPrinted && !backPhoto && backTexts.length === 0 && (
            <span style={{ color: 'rgba(0,0,0,0.2)', fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', writingMode: 'vertical-rl' }}>ЗАДНЯ — перетягніть фото</span>
          )}
          {!isPrinted && backTexts.length === 0 && (
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', writingMode: 'vertical-rl' }}>ЗАДНЯ</span>
          )}
        </div>
        {/* Back cover text blocks. Free-positioned (percent of pageW/cH),
            drag to move, click to edit text, × to remove. Renders above
            the back-cover photo (zIndex 12) so it's always reachable. */}
        {backTexts.map((tb: any) => (
          <div key={tb.id}
            onPointerDown={e => startBackTextDrag(e, tb.id, tb.x, tb.y)}
            style={{
              position: 'absolute',
              left: `${tb.x}%`,
              top: `${tb.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 12,
              padding: '2px 6px',
              border: '1px dashed rgba(0,0,0,0.25)',
              borderRadius: 3,
              cursor: 'move',
              touchAction: 'manipulation',
              maxWidth: `${pageW * 0.84}px`,
            }}
          >
            <span
              contentEditable
              suppressContentEditableWarning
              onClick={e => { e.stopPropagation(); (e.target as HTMLElement).focus(); }}
              onPointerDown={e => e.stopPropagation()}
              onBlur={e => {
                const text = e.currentTarget.textContent || '';
                setCoverState(prev => {
                  const list = (prev as any).backCoverTexts || [];
                  return { ...prev, backCoverTexts: list.map((t: any) => t.id === tb.id ? { ...t, text } : t) } as any;
                });
              }}
              style={{
                display: 'inline-block',
                fontSize: (tb.fontSize || 18) + 'px',
                fontFamily: (tb.fontFamily || 'Montserrat') + ', sans-serif',
                color: tb.color || (backPhoto ? '#fff' : '#1e2d7d'),
                fontWeight: tb.bold ? 800 : 600,
                outline: 'none',
                cursor: 'text',
                whiteSpace: 'nowrap',
                textShadow: backPhoto ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
              }}
            >{tb.text}</span>
            <button
              title="Видалити напис"
              onPointerDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation();
                setCoverState(prev => {
                  const list = (prev as any).backCoverTexts || [];
                  return { ...prev, backCoverTexts: list.filter((t: any) => t.id !== tb.id) } as any;
                });
              }}
              style={{
                position: 'absolute', top: -8, right: -8, width: 18, height: 18, borderRadius: '50%',
                background: '#ef4444', color: '#fff', border: '2px solid #fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, lineHeight: 1, fontWeight: 800, padding: 0, zIndex: 25,
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            >×</button>
          </div>
        ))}
        {/* Spine line */}
        <div style={{ position: 'absolute', right: 0, top: 0, width: 2, height: '100%', background: 'rgba(0,0,0,0.15)' }} />
      </div>

      {/* Front cover — with decoration */}
      <CoverEditor
        canvasW={pageW}
        canvasH={cH}
        sizeValue={sizeValue}
        config={coverProps}
        photos={photos}
        hidePhotoSlot={isHardCoverJournal}
        onChange={onCoverChange}
      />
    </div>
  );
}
