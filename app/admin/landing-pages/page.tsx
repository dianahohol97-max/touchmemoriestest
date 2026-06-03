'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Edit, Trash2, Eye, EyeOff, ExternalLink, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { toPublicCategorySlug } from '@/lib/seo/categorySlugs';

interface LandingPage {
  id?: string;
  category_slug: string;
  occasion: string;
  kind: string;
  h1: string;
  meta_title: string;
  meta_description: string;
  intro: string;
  product_slugs: string[];
  sort_order: number;
  is_active: boolean;
}

const EMPTY: LandingPage = {
  category_slug: '', occasion: '', kind: 'cluster', h1: '',
  meta_title: '', meta_description: '', intro: '', product_slugs: [],
  sort_order: 0, is_active: true,
};

export default function AdminLandingPages() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LandingPage | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: lps }, { data: categories }] = await Promise.all([
      supabase.from('landing_pages').select('*').order('sort_order', { ascending: true }),
      supabase.from('categories').select('name, slug').eq('is_active', true).order('name'),
    ]);
    setRows(lps || []);
    setCats(categories || []);
    setLoading(false);
  }

  function publicUrl(r: { category_slug: string; occasion: string }) {
    return `/uk/category/${toPublicCategorySlug(r.category_slug)}/${r.occasion}`;
  }

  async function toggleActive(r: any) {
    const { error } = await supabase.from('landing_pages').update({ is_active: !r.is_active }).eq('id', r.id);
    if (error) return toast.error('Не вдалося оновити');
    toast.success(!r.is_active ? 'Опубліковано' : 'Сховано');
    void load();
  }

  async function remove(r: any) {
    if (!confirm(`Видалити сторінку «${r.h1}»?`)) return;
    const { error } = await supabase.from('landing_pages').delete().eq('id', r.id);
    if (error) return toast.error('Не вдалося видалити');
    toast.success('Видалено');
    void load();
  }

  async function save() {
    if (!editing) return;
    if (!editing.category_slug || !editing.occasion || !editing.h1) {
      return toast.error('Заповніть категорію, occasion та H1');
    }
    setSaving(true);
    const payload = {
      category_slug: editing.category_slug,
      occasion: editing.occasion.trim(),
      kind: editing.kind,
      h1: editing.h1.trim(),
      meta_title: editing.meta_title?.trim() || null,
      meta_description: editing.meta_description?.trim() || null,
      intro: editing.intro || '',
      product_slugs: editing.product_slugs || [],
      sort_order: Number(editing.sort_order) || 0,
      is_active: editing.is_active,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing.id
      ? await supabase.from('landing_pages').update(payload).eq('id', editing.id)
      : await supabase.from('landing_pages').insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Така пара категорія+occasion вже існує' : 'Помилка збереження');
      return;
    }
    toast.success('Збережено');
    setEditing(null);
    void load();
  }

  const input = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500';
  const label = 'block text-xs font-semibold text-stone-500 mb-1';

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-stone-900">SEO-лендінги</h1>
        {!editing && (
          <button onClick={() => setEditing({ ...EMPTY })}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700">
            <Plus size={16} /> Нова сторінка
          </button>
        )}
      </div>
      <p className="text-stone-500 text-sm mb-6">
        Кластерні та гео-сторінки, що відкриваються за адресою <code>/category/[категорія]/[occasion]</code>.
        Текст і добірку товарів можна правити тут.
      </p>

      {editing ? (
        <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={label}>Категорія *</label>
              <select className={input} value={editing.category_slug}
                onChange={(e) => setEditing({ ...editing, category_slug: e.target.value })}>
                <option value="">— оберіть —</option>
                {cats.map((c) => <option key={c.slug} value={c.slug}>{c.name} ({c.slug})</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Occasion (slug) *</label>
              <input className={input} value={editing.occasion} placeholder="vesilni / kyiv"
                onChange={(e) => setEditing({ ...editing, occasion: e.target.value })} />
            </div>
            <div>
              <label className={label}>Тип</label>
              <select className={input} value={editing.kind}
                onChange={(e) => setEditing({ ...editing, kind: e.target.value })}>
                <option value="cluster">cluster (нагода)</option>
                <option value="geo">geo (місто)</option>
              </select>
            </div>
          </div>

          {editing.category_slug && editing.occasion && (
            <p className="text-xs text-stone-400">URL: <code>{publicUrl(editing)}</code></p>
          )}

          <div>
            <label className={label}>H1 (заголовок сторінки) *</label>
            <input className={input} value={editing.h1}
              onChange={(e) => setEditing({ ...editing, h1: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Meta title</label>
              <input className={input} value={editing.meta_title}
                onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} />
            </div>
            <div>
              <label className={label}>Meta description</label>
              <input className={input} value={editing.meta_description}
                onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} />
            </div>
          </div>

          <div>
            <label className={label}>Текст-вступ (абзаци розділяй порожнім рядком)</label>
            <textarea className={input} rows={8} value={editing.intro}
              onChange={(e) => setEditing({ ...editing, intro: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className={label}>Товари (slug через кому; порожньо = всі товари категорії)</label>
              <input className={input} value={(editing.product_slugs || []).join(', ')}
                placeholder="family-book, wedding-book"
                onChange={(e) => setEditing({ ...editing, product_slugs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
            </div>
            <div>
              <label className={label}>Порядок</label>
              <input type="number" className={input} value={editing.sort_order}
                onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={editing.is_active}
              onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
            Опубліковано (видно на сайті)
          </label>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              <Save size={16} /> {saving ? 'Збереження…' : 'Зберегти'}
            </button>
            <button onClick={() => setEditing(null)}
              className="inline-flex items-center gap-2 border border-stone-300 px-4 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-50">
              <X size={16} /> Скасувати
            </button>
          </div>
        </div>
      ) : loading ? (
        <p className="text-stone-400">Завантаження…</p>
      ) : rows.length === 0 ? (
        <p className="text-stone-400">Поки немає сторінок. Натисніть «Нова сторінка».</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 bg-white border border-stone-200 rounded-lg px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-stone-900 truncate">{r.h1}</div>
                <div className="text-xs text-stone-400 truncate">
                  {r.kind} · <a href={publicUrl(r)} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline inline-flex items-center gap-1">{publicUrl(r)} <ExternalLink size={11} /></a>
                </div>
              </div>
              <button onClick={() => toggleActive(r)} title={r.is_active ? 'Сховати' : 'Опублікувати'}
                className={`p-2 rounded-lg ${r.is_active ? 'text-green-600 hover:bg-green-50' : 'text-stone-400 hover:bg-stone-50'}`}>
                {r.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button onClick={() => setEditing({ ...EMPTY, ...r, product_slugs: r.product_slugs || [] })}
                className="p-2 rounded-lg text-stone-500 hover:bg-stone-100"><Edit size={16} /></button>
              <button onClick={() => remove(r)}
                className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
