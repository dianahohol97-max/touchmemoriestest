'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Per-product colour availability for a `velour_swatches` option. Colours live
// globally in cover_colors (managed under /admin/velour-colors); here the admin
// simply toggles which of that cover type's colours are offered on THIS product.
// Unchecked colours are written to the option's `disabled_codes` array and the
// storefront picker (VelourSwatchPicker) hides them.

interface CC { id: string; code: string | null; name: string; hex_approx: string | null; }

export default function VelourColorToggles({
  coverTypeId,
  disabledCodes,
  onChange,
}: {
  coverTypeId: string;
  disabledCodes: string[];
  onChange: (codes: string[]) => void;
}) {
  const [colors, setColors] = useState<CC[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = createClient();
        const { data } = await sb
          .from('cover_colors')
          .select('id, code, name, hex_approx')
          .eq('cover_type_id', coverTypeId)
          .eq('active', true)
          .order('sort_order', { ascending: true });
        if (alive) setColors((data || []) as CC[]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [coverTypeId]);

  if (!coverTypeId) return <div style={{ fontSize: 12, color: '#9ca3af' }}>Вкажіть cover_type_id для цієї опції, щоб керувати кольорами.</div>;
  if (loading) return <div style={{ fontSize: 12, color: '#9ca3af' }}>Завантаження кольорів…</div>;
  if (!colors.length) return <div style={{ fontSize: 12, color: '#9ca3af' }}>Немає активних кольорів для цього типу обкладинки. Додавайте/ховайте їх глобально в розділі «Кольори велюру».</div>;

  const toggle = (code: string) => {
    const set = new Set(disabledCodes || []);
    if (set.has(code)) set.delete(code); else set.add(code);
    onChange(Array.from(set));
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
        Познач кольори, доступні для <b>цього товару</b>. Зняті не показуються клієнту. Сам список кольорів керується глобально в «Кольори велюру».
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {colors.map((c) => {
          const enabled = !(disabledCodes || []).includes(c.code || '');
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => c.code && toggle(c.code)}
              title={enabled ? 'Доступний — натисни, щоб прибрати' : 'Прихований — натисни, щоб увімкнути'}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '6px 11px', borderRadius: 8, cursor: 'pointer',
                border: enabled ? '2px solid #1e2d7d' : '1px solid #e5e7eb',
                background: enabled ? '#f0f3ff' : '#f9fafb', opacity: enabled ? 1 : 0.6,
              }}
            >
              <span style={{ width: 18, height: 18, borderRadius: 5, background: c.hex_approx || '#e2e8f0', border: '1px solid rgba(0,0,0,0.12)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: enabled ? '#1e2d7d' : '#9ca3af', textDecoration: enabled ? 'none' : 'line-through' }}>
                {c.name}{c.code ? ` (${c.code})` : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
