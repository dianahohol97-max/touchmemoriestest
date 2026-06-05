'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// A general gallery of inscription (cover-decoration) examples, shown on the
// album page so customers can see what the engraving looks like before they
// design their own. Managed in admin (/admin/velour-colors). Renders nothing
// until at least one active example exists.

interface Example { id: string; photo_url: string; caption: string | null; }

export default function InscriptionExamples() {
  const [items, setItems] = useState<Example[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('inscription_examples')
        .select('id, photo_url, caption')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (alive) setItems((data || []) as Example[]);
    })();
    return () => { alive = false; };
  }, []);

  if (!items.length) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Приклади написів
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {items.map((it) => (
          <button key={it.id} type="button" onClick={() => setOpen(it.photo_url)}
            title={it.caption || 'Приклад напису'}
            style={{ flexShrink: 0, padding: 0, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', cursor: 'zoom-in', background: '#fff', width: 110, height: 110 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.photo_url} alt={it.caption || 'Приклад напису'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>

      {open && (
        <div onClick={() => setOpen(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20, cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open} alt="Приклад напису" style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} />
        </div>
      )}
    </div>
  );
}
