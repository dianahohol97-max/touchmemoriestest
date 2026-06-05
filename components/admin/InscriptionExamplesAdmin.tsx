'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Eye, EyeOff } from 'lucide-react';

interface Example {
    id: string;
    photo_url: string;
    caption: string | null;
    sort_order: number;
    active: boolean;
}

const IS: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' };

export default function InscriptionExamplesAdmin() {
    const supabase = createClient();
    const [items, setItems] = useState<Example[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);

    async function load() {
        const { data } = await supabase.from('inscription_examples')
            .select('id, photo_url, caption, sort_order, active').order('sort_order');
        setItems((data || []) as Example[]);
        setLoading(false);
    }
    useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    function patch(id: string, p: Partial<Example>) {
        setItems(prev => prev.map(x => x.id === id ? { ...x, ...p } : x));
    }

    async function uploadToStorage(file: File): Promise<string | null> {
        const bucket = 'touch-memories-assets', folder = 'inscription-examples';
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

    async function addExample(file: File) {
        setUploading(true);
        const t = toast.loading('Завантаження...');
        const url = await uploadToStorage(file);
        toast.dismiss(t);
        if (url) {
            const nextOrder = items.length ? Math.max(...items.map(i => i.sort_order || 0)) + 1 : 1;
            const { data, error } = await supabase.from('inscription_examples')
                .insert({ photo_url: url, sort_order: nextOrder, active: true }).select('*').single();
            if (error) toast.error('Помилка: ' + error.message);
            else { setItems(prev => [...prev, data as Example]); toast.success('Приклад додано'); }
        }
        setUploading(false);
    }

    async function saveExample(x: Example) {
        setSavingId(x.id);
        const { error } = await supabase.from('inscription_examples')
            .update({ caption: x.caption?.trim() || null, sort_order: Number(x.sort_order) || 0, active: x.active }).eq('id', x.id);
        if (error) toast.error('Помилка: ' + error.message); else toast.success('Збережено');
        setSavingId(null);
    }

    async function deleteExample(x: Example) {
        if (!confirm('Видалити цей приклад?')) return;
        const { error } = await supabase.from('inscription_examples').delete().eq('id', x.id);
        if (error) { toast.error('Помилка: ' + error.message); return; }
        setItems(prev => prev.filter(i => i.id !== x.id));
        toast.success('Видалено');
    }

    return (
        <div style={{ marginBottom: 36, padding: 18, border: '1px solid #e2e8f0', borderRadius: 14, background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Приклади написів (оздоблення)</h2>
                <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#1e2d7d', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
                    <Plus size={15} /> {uploading ? 'Завантаження...' : 'Додати приклад'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
                        onChange={e => { const f = e.target.files?.[0]; if (f) addExample(f); e.target.value = ''; }} />
                </label>
            </div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
                Загальна галерея прикладів написів — показується на сторінках альбомів над конструктором напису, незалежно від обраного кольору.
            </p>

            {loading ? <p style={{ fontSize: 13, color: '#94a3b8' }}>Завантаження…</p> :
                items.length === 0 ? <p style={{ fontSize: 13, color: '#94a3b8' }}>Поки немає прикладів. Додай перше фото.</p> : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                        {items.map(x => (
                            <div key={x.id} style={{ border: x.active ? '1px solid #e2e8f0' : '1px dashed #cbd5e1', borderRadius: 12, padding: 10, background: x.active ? '#fff' : '#f1f5f9', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ width: '100%', height: 130, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)', background: '#f1f5f9' }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={x.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                </div>
                                <input style={IS} placeholder="Підпис (необов'язково)" value={x.caption || ''} onChange={e => patch(x.id, { caption: e.target.value })} />
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <input style={{ ...IS, width: 70 }} type="number" value={x.sort_order} onChange={e => patch(x.id, { sort_order: Number(e.target.value) })} title="Порядок" />
                                    <button onClick={() => patch(x.id, { active: !x.active })} title={x.active ? 'Показується' : 'Прихований'}
                                        style={{ padding: 7, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', color: x.active ? '#16a34a' : '#94a3b8' }}>
                                        {x.active ? <Eye size={15} /> : <EyeOff size={15} />}
                                    </button>
                                    <button onClick={() => saveExample(x)} disabled={savingId === x.id}
                                        style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: savingId === x.id ? 0.6 : 1 }}>
                                        <Save size={14} /> Зберегти
                                    </button>
                                    <button onClick={() => deleteExample(x)} title="Видалити"
                                        style={{ padding: '7px 10px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer' }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
        </div>
    );
}
