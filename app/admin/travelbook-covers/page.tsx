'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pipette, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { sampleCoverBackgroundColor } from '@/lib/editor/cover-bg-color';

/**
 * Каталог готових обкладинок тревелбука.
 *
 * Головне тут — колонка кольору тла. Доти його ніде не задавали, і конструктор
 * вигадував його сам: рахував середнє по широкій смузі краю, де в наших
 * дизайнів лежить декоративна рамка. «Аргентина» так дістала бурий #b27467 при
 * рожевому тлі. Тепер колір стоїть у каталозі, задає його людина оком, а
 * розрахунок лишається підказкою для щойно завантажених обкладинок.
 *
 * Колір і картинка навмисно стоять поруч і однакової ширини: розбіжність між
 * ними видно лише тоді, коли дивишся на них разом, а не на два числа в різних
 * місцях.
 */

interface Cover {
  id: string;
  name: string;
  name_en: string | null;
  image_url: string;
  thumbnail_url: string | null;
  kind: 'city' | 'country';
  sort_order: number;
  active: boolean;
  background_color: string | null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export default function TravelbookCoversPage() {
  const [covers, setCovers] = useState<Cover[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'city' | 'country' | 'nocolor'>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<{ tone: 'ok' | 'warn' | 'bad'; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ name: string; name_en: string; kind: 'city' | 'country'; file: File | null }>({
    name: '', name_en: '', kind: 'city', file: null,
  });
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/admin/travelbook-covers');
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error || 'Не вдалося прочитати каталог');
      setCovers(body.covers || []);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Зберегти зміну однієї обкладинки. Порожній колір знімає значення. */
  const patch = useCallback(async (id: string, fields: Partial<Cover>): Promise<boolean> => {
    setSavingId(id); setError('');
    try {
      const r = await fetch('/api/admin/travelbook-covers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...fields }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error || 'Не вдалося зберегти');
      setCovers(prev => prev.map(c => (c.id === id ? body.cover : c)));
      return true;
    } catch (e: any) {
      setError(String(e?.message || e));
      return false;
    } finally {
      setSavingId(null);
    }
  }, []);

  /** Підказка з картинки для однієї обкладинки. */
  const suggestOne = useCallback(async (cover: Cover) => {
    setSuggesting(cover.id);
    try {
      const hex = await sampleCoverBackgroundColor(cover.image_url);
      if (!hex) { setError(`Не вдалося прочитати колір із «${cover.name}» — картинка не завантажилася або сховище не віддало заголовок CORS.`); return; }
      await patch(cover.id, { background_color: hex });
    } finally {
      setSuggesting(null);
    }
  }, [patch]);

  /**
   * Підказка для всіх обкладинок, яким кольору ще не задавали.
   *
   * Уже заданий колір не чіпається: його поставила людина, і перезаписати його
   * розрахунком означало б скасувати саме ту роботу, заради якої ця сторінка
   * існує.
   */
  const suggestAllEmpty = useCallback(async () => {
    const targets = covers.filter(c => !HEX.test(String(c.background_color || '')));
    if (targets.length === 0) { setSummary({ tone: 'ok', text: 'Усі обкладинки вже мають колір — рахувати нема чого.' }); return; }
    if (!confirm(`Порахувати підказку для ${targets.length} обкладинок без кольору? Уже задані кольори лишаться як є.`)) return;

    setSummary(null);
    setBulk({ done: 0, total: targets.length });
    let written = 0;
    const unreadable: string[] = [];
    const notSaved: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      const hex = await sampleCoverBackgroundColor(targets[i].image_url);
      if (!hex) unreadable.push(targets[i].name);
      else if (await patch(targets[i].id, { background_color: hex })) written++;
      else notSaved.push(targets[i].name);
      setBulk({ done: i + 1, total: targets.length });
    }
    setBulk(null);
    await load();

    // ПРОГІН ЗАВЖДИ НАЗИВАЄ ЧИСЛА.
    //
    // Раніше невдале читання картинки просто пропускалося, і прогін, який не
    // записав НІЧОГО, виглядав точнісінько як успішний: смужка «Рахую 100 зі
    // 100» доходила до кінця і зникала. Це та сама поломка, про яку каже
    // правило «тихо втрачене ніхто не помітить»: дані про невдачу були, і
    // ніхто їх не бачив.
    const parts = [`записано ${written} з ${targets.length}`];
    if (unreadable.length) parts.push(`не вдалося прочитати картинку: ${unreadable.length}`);
    if (notSaved.length) parts.push(`не збереглося: ${notSaved.length}`);
    const failed = unreadable.concat(notSaved);
    setSummary({
      tone: written === targets.length ? 'ok' : written === 0 ? 'bad' : 'warn',
      text: parts.join(', ')
        + (failed.length ? `. Не вийшло: ${failed.slice(0, 8).join(', ')}${failed.length > 8 ? ` та ще ${failed.length - 8}` : ''}.` : '')
        + (written === 0 ? ' Жоден колір не записано — картинки не читаються з цього браузера.' : ''),
    });
  }, [covers, patch, load]);

  const addCover = useCallback(async () => {
    if (!form.name.trim()) { setError('Потрібна назва'); return; }
    if (!form.file) { setError('Потрібен файл обкладинки'); return; }
    setUploading(true); setError('');
    try {
      const ext = (form.file.name.split('.').pop() || 'png').toLowerCase();
      const signed = await fetch('/api/admin/signed-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'travel-covers', ext }),
      });
      const s = await signed.json();
      if (!signed.ok) throw new Error(s?.error || 'Не вдалося отримати посилання для завантаження');

      // Той самий шлях, яким уже вантажать фото кольори велюру і контент:
      // байти йдуть прямо у сховище повз наші функції, бо тіло запиту до
      // функції на Vercel обрізається на 4,5 МБ (гоча 16 у CLAUDE.md).
      const { error: upErr } = await createClient().storage
        .from('travel-covers')
        .uploadToSignedUrl(s.path, s.token, form.file, { contentType: form.file.type || undefined });
      if (upErr) throw upErr;

      // Підказка рахується ОДРАЗУ, поки людина дивиться на щойно завантажену
      // картинку: саме тоді її найлегше виправити оком.
      const hex = await sampleCoverBackgroundColor(s.publicUrl);

      const created = await fetch('/api/admin/travelbook-covers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          name_en: form.name_en.trim(),
          kind: form.kind,
          image_url: s.publicUrl,
          sort_order: covers.filter(c => c.kind === form.kind).length,
          background_color: hex || '',
        }),
      });
      const c = await created.json();
      if (!created.ok) throw new Error(c?.error || 'Не вдалося створити запис');
      setAdding(false);
      setForm({ name: '', name_en: '', kind: 'city', file: null });
      await load();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setUploading(false);
    }
  }, [form, covers, load]);

  const remove = useCallback(async (cover: Cover) => {
    if (!confirm(`Видалити «${cover.name}» з каталогу? Файл у сховищі лишиться.`)) return;
    setSavingId(cover.id);
    try {
      const r = await fetch(`/api/admin/travelbook-covers?id=${encodeURIComponent(cover.id)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json())?.error || 'Не вдалося видалити');
      setCovers(prev => prev.filter(c => c.id !== cover.id));
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSavingId(null);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return covers.filter(c => {
      if (filter === 'city' || filter === 'country') { if (c.kind !== filter) return false; }
      if (filter === 'nocolor' && HEX.test(String(c.background_color || ''))) return false;
      if (!q) return true;
      return (c.name || '').toLowerCase().includes(q) || (c.name_en || '').toLowerCase().includes(q);
    });
  }, [covers, search, filter]);

  const withoutColor = covers.filter(c => !HEX.test(String(c.background_color || ''))).length;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e2d7d', marginBottom: 6 }}>Готові обкладинки тревелбука</h1>
      <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.55, marginBottom: 18, maxWidth: 780 }}>
        Колір тла тут задається оком і саме він заливає задню обкладинку в конструкторі. Підказка рахує
        найчастіший колір тонкого краю картинки, тож на дизайнах із декоративною рамкою вона інколи
        помиляється — дивіться на смужку під картинкою і виправляйте там, де колір не збігається з тлом.
      </p>

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12.5 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук міста або країни…"
          style={{ flex: '1 1 220px', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        {([['all', `Усі (${covers.length})`], ['city', 'Міста'], ['country', 'Країни'], ['nocolor', `Без кольору (${withoutColor})`]] as const).map(([val, lbl]) => (
          <button key={val} onClick={() => setFilter(val as any)}
            style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: filter === val ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
              background: filter === val ? '#f0f3ff' : '#fff', color: filter === val ? '#1e2d7d' : '#475569' }}>
            {lbl}
          </button>
        ))}
        <button onClick={suggestAllEmpty} disabled={!!bulk || loading}
          title="Порахувати підказку для всіх обкладинок, яким кольору ще не задавали"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: '1.5px solid #0369a1', background: '#fff', color: '#0369a1', cursor: bulk ? 'default' : 'pointer' }}>
          {bulk ? <Loader2 size={14} className="animate-spin" /> : <Pipette size={14} />}
          {bulk ? `Рахую ${bulk.done} з ${bulk.total}` : 'Підказати колір усім без кольору'}
        </button>
        <button onClick={() => setAdding(a => !a)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', background: '#1e2d7d', color: '#fff', cursor: 'pointer' }}>
          <Plus size={14} /> Додати обкладинку
        </button>
        <button onClick={load} disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer' }}>
          <RefreshCw size={14} /> Оновити
        </button>
      </div>

      {adding && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Назва українською *</div>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Назва англійською</div>
            <input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: '0 1 140px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Тип</div>
            <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as 'city' | 'country' })}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}>
              <option value="city">Місто</option>
              <option value="country">Країна</option>
            </select>
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Файл обкладинки *</div>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })}
              style={{ width: '100%', fontSize: 12 }} />
          </div>
          <button onClick={addCover} disabled={uploading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, border: 'none', background: uploading ? '#94a3b8' : '#16a34a', color: '#fff', cursor: uploading ? 'default' : 'pointer' }}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Завантажую…' : 'Завантажити'}
          </button>
        </div>
      )}

      {summary && (
        <div style={{
          marginBottom: 14, padding: '10px 12px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.5,
          background: summary.tone === 'ok' ? '#f0fdf4' : summary.tone === 'warn' ? '#fffbeb' : '#fef2f2',
          border: `1px solid ${summary.tone === 'ok' ? '#bbf7d0' : summary.tone === 'warn' ? '#fde68a' : '#fecaca'}`,
          color: summary.tone === 'ok' ? '#15803d' : summary.tone === 'warn' ? '#92400e' : '#b91c1c',
        }}>
          {summary.text}
        </div>
      )}

      <div style={{ marginBottom: 12, fontSize: 12, color: '#64748b' }}>
        Колір задано у {covers.length - withoutColor} з {covers.length} обкладинок.
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Завантаження…</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
        {filtered.map(cover => {
          const hex = String(cover.background_color || '');
          const known = HEX.test(hex);
          const busy = savingId === cover.id || suggesting === cover.id;
          return (
            <div key={cover.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#fff', opacity: cover.active ? 1 : 0.55 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover.thumbnail_url || cover.image_url} alt={cover.name} loading="lazy"
                style={{ width: '100%', aspectRatio: '2 / 3', objectFit: 'cover', display: 'block', background: '#f1f5f9' }} />
              {/* Смужка кольору просто під картинкою — так розбіжність видно оком. */}
              <div style={{ height: 34, background: known ? hex : 'repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 6px,#e2e8f0 6px,#e2e8f0 12px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#64748b' }}>
                {known ? '' : 'колір не задано'}
              </div>
              <div style={{ padding: '8px 9px 10px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cover.name}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 7 }}>{cover.kind === 'country' ? 'Країна' : 'Місто'}{cover.name_en ? ` · ${cover.name_en}` : ''}</div>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <input type="color" value={known ? hex : '#ffffff'} disabled={busy}
                    onChange={e => patch(cover.id, { background_color: e.target.value })}
                    style={{ width: 30, height: 26, border: '1px solid #e2e8f0', borderRadius: 5, cursor: 'pointer', padding: 1, flexShrink: 0 }} />
                  <input type="text" defaultValue={hex} key={hex} disabled={busy} placeholder="не задано"
                    onBlur={e => {
                      let v = e.target.value.trim();
                      if (v && !v.startsWith('#')) v = '#' + v;
                      if (v === hex) return;
                      if (v && !HEX.test(v)) { setError('Колір має бути у форматі #rrggbb'); return; }
                      patch(cover.id, { background_color: v });
                    }}
                    style={{ flex: 1, minWidth: 0, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, fontFamily: 'monospace', color: '#374151', outline: 'none' }} />
                  <button onClick={() => suggestOne(cover)} disabled={busy} title="Порахувати підказку з картинки"
                    style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: 5, background: '#f8fafc', cursor: busy ? 'default' : 'pointer', color: '#0369a1', flexShrink: 0 }}>
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <Pipette size={12} />}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button onClick={() => patch(cover.id, { active: !cover.active })} disabled={busy}
                    style={{ flex: 1, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 5, background: '#fff', fontSize: 10.5, fontWeight: 700, color: cover.active ? '#16a34a' : '#94a3b8', cursor: 'pointer' }}>
                    {cover.active ? 'Активна' : 'Прихована'}
                  </button>
                  <button onClick={() => remove(cover)} disabled={busy}
                    style={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fecaca', borderRadius: 5, background: '#fff7f7', color: '#ef4444', cursor: 'pointer' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && filtered.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Нічого не знайдено.</div>
      )}
    </div>
  );
}
