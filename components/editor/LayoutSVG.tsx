'use client';

import type { LayoutType } from '@/lib/editor/types';
import { getSlotDefs } from '@/lib/editor/slot-defs';

export function LayoutSVG({ layout, active }: { layout: LayoutType; active: boolean }) {
  const isSpread = layout.startsWith('sp-');
  const W = isSpread ? 72 : 36, H = 46;
  const defs = getSlotDefs(layout, W, H);
  const c = active ? '#fff' : '#94a3b8';
  return (
    <svg width={W} height={H} style={{ display: 'block', borderRadius: 2, overflow: 'hidden', background: active ? 'rgba(255,255,255,0.15)' : '#f1f5f9', flexShrink: 0 }}>
      {defs.map(({ i, s }) => (
        <rect key={i} x={Number(s.left) || 0} y={Number(s.top) || 0} width={Number(s.width) || 0} height={Number(s.height) || 0} rx={1} fill={c} opacity={active ? 0.9 : 0.7} />
      ))}
      {isSpread && <line x1={W/2} y1={0} x2={W/2} y2={H} stroke={active ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'} strokeWidth={0.5} strokeDasharray="2 2"/>}
      {defs.length === 0 && <text x={W / 2} y={H / 2 + 4} textAnchor="middle" fontSize={10} fill={c} fontWeight={700}>T</text>}
    </svg>
  );
}
