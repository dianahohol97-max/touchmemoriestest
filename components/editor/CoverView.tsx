'use client';

import { useBookEditorStore } from '@/lib/editor/store';
import { CoverEditor } from '@/components/CoverEditor';
import { buildCoverEditorProps, resolveCoverColor, getProductFlags } from '@/lib/editor/utils';
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

  const onCoverChange = (cfg: Partial<CoverState>) => {
    updateCoverFromChange(cfg);
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
          {isPrinted && !backPhoto && (
            <span style={{ color: 'rgba(0,0,0,0.2)', fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', writingMode: 'vertical-rl' }}>ЗАДНЯ — перетягніть фото</span>
          )}
          {!isPrinted && (
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', writingMode: 'vertical-rl' }}>ЗАДНЯ</span>
          )}
        </div>
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
