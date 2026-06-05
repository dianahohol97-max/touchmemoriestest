'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Cover-colour picker for velour products. Colours live in the canonical
// cover_colors table (managed in admin under /admin/velour-colors), grouped by
// cover_type_id. The same group is therefore shared across every product that
// points at the same cover_type. Shows the live swatch photo when uploaded,
// otherwise falls back to the approximate hex chip.

interface CoverColor {
  id: string;
  code: string | null;
  name: string;
  hex_approx: string | null;
  photo_url: string | null;
}

export default function VelourSwatchPicker({
  coverTypeId,
  value,
  onChange,
  disabledCodes = [],
}: {
  coverTypeId: string;
  value: string;
  onChange: (name: string) => void;
  disabledCodes?: string[];
}) {
  const [colors, setColors] = useState<CoverColor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('cover_colors')
          .select('id, code, name, hex_approx, photo_url')
          .eq('cover_type_id', coverTypeId)
          .eq('active', true)
          .order('sort_order', { ascending: true });
        if (!alive) return;
        const list = ((data || []) as CoverColor[]).filter(
          (c) => !(disabledCodes || []).includes(c.code || '')
        );
        setColors(list);
        if (list.length && !value) onChange(list[0].name);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverTypeId]);

  if (loading) return <div style={{ fontSize: 13, color: '#94a3b8' }}>Завантаження кольорів…</div>;
  if (!colors.length) return <div style={{ fontSize: 13, color: '#94a3b8' }}>Кольори тимчасово недоступні.</div>;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {colors.map((c) => {
        const sel = value === c.name;
        return (
          <button
            key={c.id}
            type="button"
            title={c.code ? `${c.name} (${c.code})` : c.name}
            onClick={() => onChange(c.name)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              padding: 6, borderRadius: 12, cursor: 'pointer',
              border: sel ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
              background: sel ? '#f0f3ff' : 'white', width: 84,
            }}
          >
            <span style={{ width: 68, height: 68, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', background: c.hex_approx || '#e2e8f0', display: 'block' }}>
              {c.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photo_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
            </span>
            <span style={{ fontSize: 11, fontWeight: sel ? 700 : 500, color: sel ? '#1e2d7d' : '#475569', textAlign: 'center', lineHeight: 1.15 }}>{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}
