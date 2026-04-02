'use client';

import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import { useBookEditorStore } from '@/lib/editor/store';
import { getCanvasDimensions, getSizeKeyForProduct } from '@/lib/editor/utils';
import { LAYOUTS } from '@/lib/editor/constants';

interface SpreadNavigationProps {
  minPagesLen: number;
  minSpreads: number;
}

export function SpreadNavigation({ minPagesLen, minSpreads }: SpreadNavigationProps) {
  const {
    config, pages, currentIdx, setCurrentIdx, activeSide, isMobile,
    freeSlots, changeLayout, addSpread, removeCurrentSpread,
    getActivePageIdx, zoom,
  } = useBookEditorStore();

  const maxSpreadIdx = Math.ceil((pages.length - 1) / 2);
  const sizeKey = getSizeKeyForProduct(config);
  const { cH, pageW } = getCanvasDimensions(sizeKey, zoom);

  const shuffleLayout = () => {
    const targetIdx = getActivePageIdx();
    const page = pages[targetIdx];
    if (!page) return;
    const curFreeCount = (freeSlots[targetIdx] || []).length;
    const slotCount = page.slots.length > 0 ? page.slots.length : curFreeCount;
    const compatible = slotCount > 0
      ? LAYOUTS.filter(l => l.slots === slotCount)
      : LAYOUTS.filter(l => l.slots > 0);
    const pool = compatible.length > 0 ? compatible : LAYOUTS;
    const curRealLayout = page.layout === 'p-text' ? null : page.layout;
    const cur = curRealLayout ? pool.findIndex(l => l.id === curRealLayout) : -1;
    const next = (cur + 1) % pool.length;
    changeLayout(pool[next].id, pageW, cH, targetIdx);
  };

  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e2d7d', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}
        style={{ background: 'none', border: 'none', cursor: currentIdx === 0 ? 'not-allowed' : 'pointer', opacity: currentIdx === 0 ? 0.3 : 1, color: '#1e2d7d' }}>
        <ChevronLeft size={20} />
      </button>
      <span>{currentIdx === 0 ? 'Обкладинка' : `${(currentIdx - 1) * 2 + 1}–${(currentIdx - 1) * 2 + 2}`}</span>
      <button onClick={() => setCurrentIdx(i => Math.min(maxSpreadIdx, i + 1))} disabled={currentIdx === maxSpreadIdx}
        style={{ background: 'none', border: 'none', cursor: currentIdx === maxSpreadIdx ? 'not-allowed' : 'pointer', opacity: currentIdx === maxSpreadIdx ? 0.3 : 1, color: '#1e2d7d' }}>
        <ChevronRight size={20} />
      </button>
      {currentIdx !== 0 && (
        <button onClick={shuffleLayout} title="Змінити розкладку"
          style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8, padding: '5px 12px', border: '1px solid #c7d2fe', borderRadius: 8, background: '#f0f3ff', cursor: 'pointer', color: '#1e2d7d', fontWeight: 700, fontSize: 12 }}>
          <Shuffle size={13} /> Інший шаблон
        </button>
      )}
      {!isMobile && (
        <>
          <button onClick={addSpread} title="Додати розворот"
            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '5px 10px', border: '1px solid #d1fae5', borderRadius: 8, background: '#f0fdf4', cursor: 'pointer', color: '#059669', fontWeight: 700, fontSize: 12 }}>
            + розворот
          </button>
          {currentIdx !== 0 && (
            <button onClick={() => removeCurrentSpread(minPagesLen, minSpreads)} title="Видалити поточний розворот"
              disabled={pages.length <= minPagesLen}
              style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '5px 10px', border: '1px solid #fee2e2', borderRadius: 8, background: '#fff7f7', cursor: pages.length <= minPagesLen ? 'not-allowed' : 'pointer', color: pages.length <= minPagesLen ? '#fca5a5' : '#ef4444', fontWeight: 700, fontSize: 12, opacity: pages.length <= minPagesLen ? 0.5 : 1 }}>
              − розворот
            </button>
          )}
        </>
      )}
    </div>
  );
}
