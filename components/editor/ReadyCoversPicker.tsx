'use client';
import { useState, useEffect, useMemo } from 'react';

export interface TravelCover {
  id: string;
  name: string;
  name_en: string | null;
  image_url: string;
  kind: 'city' | 'country';
  sort_order: number;
}

interface ReadyCoversPickerProps {
  locale?: string;
  onApply: (cover: TravelCover) => void;
}

export function ReadyCoversPicker({ locale = 'uk', onApply }: ReadyCoversPickerProps) {
  const [covers, setCovers] = useState<TravelCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'city' | 'country'>('all');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/travelbook-covers')
      .then(r => r.json())
      .then(d => { if (!cancelled) { setCovers(d.covers || []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const isUk = locale === 'uk';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return covers.filter(c => {
      if (filter !== 'all' && c.kind !== filter) return false;
      if (!q) return true;
      const nameUk = (c.name || '').toLowerCase();
      const nameEn = (c.name_en || '').toLowerCase();
      return nameUk.includes(q) || nameEn.includes(q);
    });
  }, [covers, search, filter]);

  const label = (c: TravelCover) => (isUk ? c.name : (c.name_en || c.name));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1e2d7d' }}>
        {isUk ? 'Готові обкладинки' : 'Ready-made covers'}
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>
        {isUk
          ? 'Оберіть готову обкладинку — потім можна додати свій текст зверху'
          : 'Pick a ready cover — you can add your own text on top afterwards'}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={isUk ? 'Пошук міста або країни…' : 'Search city or country…'}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: 8,
          border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box',
        }}
      />

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {([['all', isUk ? 'Усі' : 'All'], ['city', isUk ? 'Міста' : 'Cities'], ['country', isUk ? 'Країни' : 'Countries']] as const).map(([val, lbl]) => (
          <button
            key={val}
            onClick={() => setFilter(val as any)}
            style={{
              flex: 1, padding: '6px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: filter === val ? '1.5px solid #1e2d7d' : '1px solid #e2e8f0',
              background: filter === val ? '#eef2ff' : '#fff',
              color: filter === val ? '#1e2d7d' : '#64748b',
            }}
          >
            {lbl}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
          {isUk ? 'Завантаження…' : 'Loading…'}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
          {isUk ? 'Нічого не знайдено' : 'Nothing found'}
        </div>
      )}

      {/* Gallery grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 360, overflowY: 'auto', paddingRight: 2 }}>
        {filtered.map(c => (
          <button
            key={c.id}
            onClick={() => onApply(c)}
            title={label(c)}
            style={{
              border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
              background: '#fff', padding: 0, display: 'flex', flexDirection: 'column',
              transition: 'border-color 0.15s, transform 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#1e2d7d'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none'; }}
          >
            <div style={{ width: '100%', aspectRatio: '20 / 30', background: '#f1f5f9', position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.image_url}
                alt={label(c)}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#334155', padding: '5px 4px', textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label(c)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
