'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Image as ImageIcon, Eye, EyeOff } from 'lucide-react';

interface CoverType { id: string; name: string; }
interface CoverColor {
    id: string;
    cover_type_id: string;
    code: string | null;
    name: string;
    hex_approx: string | null;
    photo_url: string | null;
    sort_order: number;
    active: boolean;
    _isNew?: boolean;
}

const IS: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' };

export default function VelourColorsPage() {
    const supabase = createClient();
    const [types, setTypes] = useState<CoverType[]>([]);
    const [colors, setColors] = useState<CoverColor[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        const [{ data: t }, { data: c }] = await Promise.all([
            supabase.from('cover_types').select('id, name').order('name'),
            supabase.from('cover_colors').select('id, cover_type_id, code, name, hex_approx, photo_url, sort_order, active').order('sort_order'),
        ]);
        setTypes((t || []) as CoverType[]);
        setColors((c || []) as CoverColor[]);
        setLoading(false);
    }
    useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    function patch(id: string, p: Partial<CoverColor>) {
        setColors(prev => prev.map(c => c.id === id ? { ...c, ...p } : c));
    }

    function addColor(typeId: string) {
        const siblings = colors.filter(c => c.cover_type_id === typeId);
        const nextOrder = siblings.length ? Math.max(...siblings.map(c => c.sort_order || 0)) + 1 : 1;
        const tmpId = `new-${Date.now()}`;
        setColors(prev => [...prev, { id: tmpId, cover_type_id: typeId, code: '', name: '', hex_approx: '#cccccc', photo_url: null, sort_order: nextOrder, active: true, _isNew: true }]);
    }

    async function saveColor(c: CoverColor) {
        if (!c.name.trim()) { toast.error('Вкажіть назву кольору'); return; }
        setSavingId(c.id);
        const payload = {
            cover_type_id: c.cover_type_id,
            code: c.code?.trim() || null,
            name: c.name.trim(),
            hex_approx: c.hex_approx || null,
            photo_url: c.photo_url || null,
            sort_order: Number(c.sort_order) || 0,
            active: c.active,
        };
        if (c._isNew) {
            const { data, error } = await supabase.from('cover_colors').insert(payload).select('id').single();
            if (error) { toast.error('Помилка: ' + error.message); }
            else { patch(c.id, { id: data!.id, _isNew: false }); toast.success('Колір додано'); }
        } else {
            const { error } = await supabase.from('cover_colors').update(payload).eq('id', c.id);
            if (error) { toast.error('Помилка: ' + error.message); }
            else { toast.success('Збережено'); }
        }
        setSavingId(null);
    }

    async function deleteColor(c: CoverColor) {
        if (c._isNew) { setColors(prev => prev.filter(x => x.id !== c.id)); return; }
        if (!confirm(`Видалити колір «${c.name}»?`)) return;
        const { error } = await supabase.from('cover_colors').delete().eq('id', c.id);
        if (error) { toast.error('Помилка: ' + error.message); return; }
        setColors(prev => prev.filter(x => x.id !== c.id));
        toast.success('Видалено');
    }

    async function uploadPhoto(c: CoverColor, file: File) {
        setUploadingId(c.id);
        const toastId = toast.loading('Завантаження фото...');
        const url = await uploadToStorage(file, 'touch-memories-assets', 'cover-colors');
        toast.dismiss(toastId);
        if (url) { patch(c.id, { photo_url: url }); toast.success('Фото завантажено — натисніть «Зберегти»'); }
        setUploadingId(null);
    }

    async function uploadToStorage(file: File, bucket: string, folder: string): Promise<string | null> {
        try {
            const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
            const signRes = await fetch('/api/admin/signed-upload', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bucket, folder, ext }),
            });
            const signJson = await signRes.json().catch(() => ({}));
            if (!signRes.ok) throw new Error(signJson.error || `HTTP ${signRes.status}`);
            const { error: upErr } = await supabase.storage.from(bucket)
                .uploadToSignedUrl(signJson.path, signJson.token, file, { contentType: file.type || undefined });
            if (upErr) throw upErr;
            return signJson.publicUrl as string;
        } catch (errSigned: any) {
            try {
                const fd = new FormData();
                fd.append('file', file); fd.append('bucket', bucket); fd.append('folder', folder);
                const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
                return json.url as string;
            } catch (errRoute: any) {
                toast.error(`Помилка завантаження: ${errRoute?.message || errSigned?.message || errRoute}`);
                return null;
            }
        }
    }

    if (loading) return <div style={{ padding: 24 }}>Завантаження…</div>;

    return (
        <div style={{ padding: '24px 28px', maxWidth: 1100 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e2d7d', marginBottom: 6 }}>Кольори велюру</h1>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>
                Кольори згруповані за типом обкладинки. Для кожного кольору можна задати код, назву, приблизний відтінок і завантажити живе фото свотча. Ці кольори тягнуться на сторінки товарів, що використовують відповідну групу.
            </p>

            {types.map(type => {
                const list = colors.filter(c => c.cover_type_id === type.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                return (
                    <div key={type.id} style={{ marginBottom: 32 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{type.name}</h2>
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>{list.length} кольорів</span>
                            <button onClick={() => addColor(type.id)}
                                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                <Plus size={15} /> Додати колір
                            </button>
                        </div>

                        {list.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8' }}>Поки немає кольорів.</p>}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                            {list.map(c => (
                                <div key={c.id} style={{ border: c.active ? '1px solid #e2e8f0' : '1px dashed #cbd5e1', borderRadius: 12, padding: 12, background: c.active ? '#fff' : '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <span style={{ width: 56, height: 56, borderRadius: 8, flexShrink: 0, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', background: c.hex_approx || '#e2e8f0' }}>
                                            {c.photo_url && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                            )}
                                        </span>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <input style={IS} placeholder="Назва" value={c.name} onChange={e => patch(c.id, { name: e.target.value })} />
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <input style={{ ...IS, flex: 1 }} placeholder="Код" value={c.code || ''} onChange={e => patch(c.id, { code: e.target.value })} />
                                                <input type="color" value={c.hex_approx || '#cccccc'} onChange={e => patch(c.id, { hex_approx: e.target.value })} style={{ width: 38, height: 34, padding: 0, border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }} title="Приблизний відтінок" />
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#475569' }}>
                                            <ImageIcon size={14} />
                                            {uploadingId === c.id ? '...' : (c.photo_url ? 'Замінити фото' : 'Фото')}
                                            <input type="file" accept="image/*" className="hidden" style={{ display: 'none' }} disabled={uploadingId === c.id}
                                                onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(c, f); e.target.value = ''; }} />
                                        </label>
                                        <input style={{ ...IS, width: 64 }} type="number" value={c.sort_order} onChange={e => patch(c.id, { sort_order: Number(e.target.value) })} title="Порядок" />
                                        <button onClick={() => patch(c.id, { active: !c.active })} title={c.active ? 'Активний' : 'Прихований'}
                                            style={{ padding: 7, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', color: c.active ? '#16a34a' : '#94a3b8' }}>
                                            {c.active ? <Eye size={15} /> : <EyeOff size={15} />}
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => saveColor(c)} disabled={savingId === c.id}
                                            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: savingId === c.id ? 0.6 : 1 }}>
                                            <Save size={14} /> Зберегти
                                        </button>
                                        <button onClick={() => deleteColor(c)} title="Видалити"
                                            style={{ padding: '7px 10px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer' }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
