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

  // Drag / resize handler for the back-cover PHOTO slot. Mirrors
  // CoverEditor.startSlotDrag (front cover) but writes to backCoverSlot and
  // converts pixels to percent against the back panel (pageW × cH) so the
  // position survives canvas resizing across desktop / mobile / preview.
  const startBackSlotDrag = (e: React.PointerEvent, type: string) => {
    e.stopPropagation();
    e.preventDefault();
    const orig = coverState.backCoverSlot ?? { x: 0, y: 0, w: 100, h: 100, shape: 'rect' as const };
    startPointerDrag(e, (dx, dy) => {
      const ddx = dx / pageW * 100, ddy = dy / cH * 100;
      const MIN = 10;
      const right = orig.x + orig.w;
      const bottom = orig.y + orig.h;
      setCoverState(p => {
        if (type === 'move') {
          return { ...p, backCoverSlot: { ...orig, x: Math.max(0, Math.min(100 - orig.w, orig.x + ddx)), y: Math.max(0, Math.min(100 - orig.h, orig.y + ddy)) } };
        }
        if (type === 'se') {
          const w = Math.max(MIN, Math.min(100 - orig.x, orig.w + ddx));
          const h = Math.max(MIN, Math.min(100 - orig.y, orig.h + ddy));
          return { ...p, backCoverSlot: { ...orig, w, h } };
        }
        if (type === 'sw') {
          const x = Math.max(0, Math.min(right - MIN, orig.x + ddx));
          const h = Math.max(MIN, Math.min(100 - orig.y, orig.h + ddy));
          return { ...p, backCoverSlot: { ...orig, x, w: right - x, h } };
        }
        if (type === 'ne') {
          const y = Math.max(0, Math.min(bottom - MIN, orig.y + ddy));
          const w = Math.max(MIN, Math.min(100 - orig.x, orig.w + ddx));
          return { ...p, backCoverSlot: { ...orig, y, w, h: bottom - y } };
        }
        // nw
        const x = Math.max(0, Math.min(right - MIN, orig.x + ddx));
        const y = Math.max(0, Math.min(bottom - MIN, orig.y + ddy));
        return { ...p, backCoverSlot: { ...orig, x, y, w: right - x, h: bottom - y } };
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
        {/* Back-cover photo slot — positioned, draggable and resizable
            (mirrors the front printed slot). Driven by coverState.backCoverSlot;
            falls back to a full-cover rect so legacy sessions still render. */}
        {isPrinted && ((coverState as any).backCoverEnabled || backPhoto) && (() => {
          const slot = coverState.backCoverSlot ?? { x: 0, y: 0, w: 100, h: 100, shape: 'rect' as const };
          const slotPx = { x: slot.x / 100 * pageW, y: slot.y / 100 * cH, w: slot.w / 100 * pageW, h: slot.h / 100 * cH };
          const isHeart = slot.shape === 'heart';
          const heartClipId = 'back-heart-' + Math.round(slotPx.x) + '-' + Math.round(slotPx.y);
          const br = isHeart ? '0px' : slot.shape === 'circle' ? '50%' : slot.shape === 'rounded' ? '12px' : '0px';
          return (
            <>
              {isHeart && (
                <svg width={0} height={0} style={{ position: 'absolute' }}>
                  <defs>
                    <clipPath id={heartClipId} clipPathUnits="userSpaceOnUse">
                      <path d={`M ${slotPx.x + slotPx.w / 2} ${slotPx.y + slotPx.h * 0.28}
                        C ${slotPx.x + slotPx.w / 2} ${slotPx.y + slotPx.h * 0.13}, ${slotPx.x + slotPx.w * 0.15} ${slotPx.y}, ${slotPx.x + slotPx.w * 0.05} ${slotPx.y + slotPx.h * 0.22}
                        C ${slotPx.x - slotPx.w * 0.05} ${slotPx.y + slotPx.h * 0.45}, ${slotPx.x + slotPx.w * 0.15} ${slotPx.y + slotPx.h * 0.65}, ${slotPx.x + slotPx.w / 2} ${slotPx.y + slotPx.h * 0.95}
                        C ${slotPx.x + slotPx.w * 0.85} ${slotPx.y + slotPx.h * 0.65}, ${slotPx.x + slotPx.w * 1.05} ${slotPx.y + slotPx.h * 0.45}, ${slotPx.x + slotPx.w * 0.95} ${slotPx.y + slotPx.h * 0.22}
                        C ${slotPx.x + slotPx.w * 0.85} ${slotPx.y} ${slotPx.x + slotPx.w / 2} ${slotPx.y + slotPx.h * 0.13}, ${slotPx.x + slotPx.w / 2} ${slotPx.y + slotPx.h * 0.28} Z`} />
                    </clipPath>
                  </defs>
                </svg>
              )}
              <div
                onPointerDown={e => startBackSlotDrag(e, 'move')}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={e => { e.preventDefault(); e.stopPropagation(); const id = e.dataTransfer.getData('text/plain'); if (id) setCoverState(p => ({ ...p, backCoverPhotoId: id })); }}
                style={{
                  position: 'absolute', left: slotPx.x, top: slotPx.y, width: slotPx.w, height: slotPx.h,
                  borderRadius: br, overflow: isHeart ? 'visible' : 'hidden', cursor: 'move', zIndex: 6, touchAction: 'manipulation',
                  clipPath: isHeart ? `url(#${heartClipId})` : undefined,
                  border: isHeart ? 'none' : (backPhoto ? 'none' : '2px dashed rgba(148,163,184,0.8)'),
                  background: backPhoto ? 'transparent' : '#f1f5f9',
                }}
              >
                {backPhoto
                  ? <img src={backPhoto.preview} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, pointerEvents: 'none' }} draggable={false} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 10, fontWeight: 600, textAlign: 'center', padding: 8 }}>перетягніть фото сюди</div>}
                {/* Move grip */}
                <div onPointerDown={e => { e.stopPropagation(); startBackSlotDrag(e, 'move'); }}
                  style={{ position: 'absolute', top: 4, left: 4, width: 22, height: 22, cursor: 'move', zIndex: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', borderRadius: 6, touchAction: 'manipulation' }}
                  title="Перетягнути слот">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v10M1 6h10M6 1L4 3M6 1l2 2M6 11l-2-2M6 11l2-2M1 6l2-2M1 6l2 2M11 6l-2-2M11 6l-2 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                {backPhoto && (
                  <button onClick={() => setCoverState(p => ({ ...p, backCoverPhotoId: null }))} onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}
                    style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9 }}>×</button>
                )}
              </div>
              {/* Resize handles */}
              {(['nw', 'ne', 'se', 'sw'] as const).map(dir => {
                const lp = (dir === 'ne' || dir === 'se') ? slotPx.x + slotPx.w : slotPx.x;
                const tp = (dir === 'se' || dir === 'sw') ? slotPx.y + slotPx.h : slotPx.y;
                return (
                  <div key={dir} onPointerDown={e => startBackSlotDrag(e, dir)}
                    style={{ position: 'absolute', left: lp - 8, top: tp - 8, width: 20, height: 20, borderRadius: '50%', background: '#3b82f6', border: '2.5px solid #fff', cursor: `${dir}-resize`, zIndex: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.4)', touchAction: 'manipulation' }} />
                );
              })}
            </>
          );
        })()}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {isPrinted && !backPhoto && !(coverState as any).backCoverEnabled && backTexts.length === 0 && (
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
