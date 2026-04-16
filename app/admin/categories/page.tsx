'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Activity, Folder, X, Save, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';

interface Category {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    is_active: boolean;
    sort_order: number;
    cover_image: string | null;
}

const IS: React.CSSProperties = { width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, outline:'none', background:'#fff', boxSizing:'border-box' };
const TS: React.CSSProperties = { ...IS, resize:'vertical', minHeight:80 };
const TH: React.CSSProperties = { padding:'10px 14px', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' };
const TD: React.CSSProperties = { padding:'10px 14px', verticalAlign:'middle' };

function F({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>
                {label}{req && <span style={{ color:'#ef4444', marginLeft:3 }}>*</span>}
            </label>
            {children}
        </div>
    );
}

const EMPTY: Omit<Category,'id'> = { name:'', slug:'', description:null, is_active:true, sort_order:0, cover_image:null };

export default function CategoriesPage() {
    const supabase = createClient();
    const [loading,    setLoading]    = useState(true);
    const [saving,     setSaving]     = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [sel,        setSel]        = useState<(Category & { _new?: boolean }) | null>(null);
    const [modal,      setModal]      = useState(false);

    useEffect(() => { fetch(); }, []);

    async function fetch() {
        setLoading(true);
        const { data, error } = await supabase.from('categories').select('*').order('sort_order');
        if (error) toast.error(error.message);
        if (data) setCategories(data);
        setLoading(false);
    }

    function openNew() {
        setSel({ id:'', ...EMPTY, sort_order: categories.length + 1, _new: true });
        setModal(true);
    }
    function openEdit(c: Category) { setSel({ ...c }); setModal(true); }
    function closeModal() { setModal(false); setSel(null); }

    function upd<K extends keyof Category>(k: K, v: Category[K]) {
        setSel(p => p ? { ...p, [k]: v } : p);
    }

    async function save() {
        if (!sel) return;
        if (!sel.name.trim() || !sel.slug.trim()) { toast.error('Заповніть назву та slug'); return; }
        setSaving(true);
        if ((sel as any)._new) {
            const { data, error } = await supabase.from('categories').insert({
                name: sel.name, slug: sel.slug, description: sel.description,
                is_active: sel.is_active, sort_order: sel.sort_order, cover_image: sel.cover_image,
            }).select().single();
            setSaving(false);
            if (error) { toast.error(error.message); return; }
            toast.success('Категорію створено ✓');
            setCategories(prev => [...prev, data].sort((a,b) => a.sort_order - b.sort_order));
        } else {
            const { error } = await supabase.from('categories').update({
                name: sel.name, slug: sel.slug, description: sel.description,
                is_active: sel.is_active, sort_order: sel.sort_order, cover_image: sel.cover_image,
            }).eq('id', sel.id);
            setSaving(false);
            if (error) { toast.error(error.message); return; }
            toast.success('Збережено ✓');
            setCategories(prev => prev.map(c => c.id === sel.id ? { ...sel } : c));
        }
        closeModal();
    }

    async function del(id: string, name: string) {
        if (!confirm(`Видалити категорію "${name}"?`)) return;
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) { toast.error(error.message); return; }
        toast.success('Видалено');
        setCategories(prev => prev.filter(c => c.id !== id));
    }

    async function moveOrder(id: string, dir: -1 | 1) {
        const idx = categories.findIndex(c => c.id === id);
        const swapIdx = idx + dir;
        if (swapIdx < 0 || swapIdx >= categories.length) return;
        const next = [...categories];
        const a = next[idx], b = next[swapIdx];
        [next[idx], next[swapIdx]] = [{ ...b, sort_order: a.sort_order }, { ...a, sort_order: b.sort_order }];
        setCategories(next);
        await Promise.all([
            supabase.from('categories').update({ sort_order: a.sort_order }).eq('id', b.id),
            supabase.from('categories').update({ sort_order: b.sort_order }).eq('id', a.id),
        ]);
    }

    const isNew = (sel as any)?._new;

    return (
        <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 64px)', overflow:'hidden', fontFamily:'var(--font-body,sans-serif)', fontSize:14, color:'#111827', background:'#f9fafb' }}>

            {/* TOP BAR */}
            <div style={{ padding:'12px 20px', borderBottom:'1px solid #e5e7eb', background:'#fff', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                <div style={{ fontWeight:800, fontSize:17, color:'#1e2d7d' }}>Категорії</div>
                <div style={{ fontSize:12, color:'#9ca3af' }}>{categories.length} категорій</div>
                <button onClick={openNew}
                    style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#1e2d7d', color:'#fff', borderRadius:8, fontWeight:700, fontSize:13, border:'none', cursor:'pointer' }}>
                    <Plus size={14}/> Нова категорія
                </button>
            </div>

            {/* TABLE */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
                {loading ? (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200 }}>
                        <Activity className="animate-spin" size={32} color="#1e2d7d"/>
                    </div>
                ) : (
                    <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0, background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                        <thead>
                            <tr style={{ background:'#f8fafc' }}>
                                <th style={{ ...TH, width:44 }}></th>
                                <th style={{ ...TH, textAlign:'left' }}>Назва</th>
                                <th style={{ ...TH, textAlign:'left' }}>Slug</th>
                                <th style={{ ...TH, textAlign:'center' }}>Статус</th>
                                <th style={{ ...TH, textAlign:'center' }}>Порядок</th>
                                <th style={{ ...TH, textAlign:'center', width:120 }}>Дії</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((c, idx) => (
                                <tr key={c.id}
                                    onClick={()=>openEdit(c)}
                                    style={{ borderTop: idx===0?'none':'1px solid #f1f5f9', cursor:'pointer' }}
                                    onMouseEnter={e=>(e.currentTarget.style.background='#f8fafc')}
                                    onMouseLeave={e=>(e.currentTarget.style.background='')}>
                                    <td style={{ ...TD, padding:'8px 8px 8px 14px' }}>
                                        <div style={{ width:36, height:36, borderRadius:8, overflow:'hidden', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                            {c.cover_image
                                                ? <img src={c.cover_image} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none';}}/>
                                                : <Folder size={16} color="#d1d5db"/>}
                                        </div>
                                    </td>
                                    <td style={{ ...TD, fontWeight:600 }}>{c.name}</td>
                                    <td style={{ ...TD, fontFamily:'monospace', fontSize:12, color:'#6b7280' }}>/{c.slug}</td>
                                    <td style={{ ...TD, textAlign:'center' }}>
                                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600,
                                            background: c.is_active?'#f0fdf4':'#fef2f2', color: c.is_active?'#10b981':'#ef4444' }}>
                                            <span style={{ width:6, height:6, borderRadius:'50%', background: c.is_active?'#10b981':'#ef4444', display:'inline-block' }}/>
                                            {c.is_active ? 'Активна' : 'Прихована'}
                                        </span>
                                    </td>
                                    <td style={{ ...TD, textAlign:'center' }}>
                                        <span style={{ fontWeight:600, color:'#6b7280' }}>{c.sort_order}</span>
                                    </td>
                                    <td style={{ ...TD, textAlign:'center' }} onClick={e=>e.stopPropagation()}>
                                        <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                                            <button onClick={()=>moveOrder(c.id,-1)} disabled={idx===0} title="Вгору"
                                                style={{ padding:'5px 7px', border:'1px solid #e5e7eb', borderRadius:7, background:'#fff', cursor:idx===0?'default':'pointer', color:idx===0?'#d1d5db':'#374151', display:'flex', alignItems:'center' }}>
                                                <ArrowUp size={13}/>
                                            </button>
                                            <button onClick={()=>moveOrder(c.id,1)} disabled={idx===categories.length-1} title="Вниз"
                                                style={{ padding:'5px 7px', border:'1px solid #e5e7eb', borderRadius:7, background:'#fff', cursor:idx===categories.length-1?'default':'pointer', color:idx===categories.length-1?'#d1d5db':'#374151', display:'flex', alignItems:'center' }}>
                                                <ArrowDown size={13}/>
                                            </button>
                                            <button onClick={()=>del(c.id,c.name)} title="Видалити"
                                                style={{ padding:'5px 7px', border:'1px solid #fca5a5', borderRadius:7, background:'#fff', cursor:'pointer', color:'#ef4444', display:'flex', alignItems:'center' }}>
                                                <Trash2 size={13}/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!loading && categories.length === 0 && (
                    <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>
                        <Folder size={40} style={{ margin:'0 auto 12px', opacity:.3, display:'block' }}/>
                        <div>Категорій немає. Створіть першу!</div>
                    </div>
                )}
            </div>

            {/* SLIDE-IN MODAL */}
            {modal && sel && (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'flex-end' }}
                    onClick={e=>{ if(e.target===e.currentTarget) closeModal(); }}>
                    <div style={{ width:'min(560px,100vw)', height:'100vh', background:'#fff', display:'flex', flexDirection:'column', boxShadow:'-4px 0 32px rgba(0,0,0,0.12)' }}>

                        {/* Header */}
                        <div style={{ padding:'14px 20px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
                            <div style={{ fontWeight:800, fontSize:16, color:'#1e2d7d' }}>
                                {isNew ? 'Нова категорія' : 'Редагування категорії'}
                            </div>
                            <div style={{ display:'flex', gap:8 }}>
                                <button onClick={()=>upd('is_active',!sel.is_active)}
                                    style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, border:`1px solid ${sel.is_active?'#10b981':'#ef4444'}`, background:sel.is_active?'#f0fdf4':'#fef2f2', color:sel.is_active?'#10b981':'#ef4444', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                                    {sel.is_active ? <Eye size={13}/> : <EyeOff size={13}/>}
                                    {sel.is_active ? 'Активна' : 'Прихована'}
                                </button>
                                <button onClick={save} disabled={saving}
                                    style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 18px', borderRadius:8, background:'#1e2d7d', color:'#fff', border:'none', cursor:'pointer', fontWeight:700, fontSize:13, opacity:saving?0.7:1 }}>
                                    {saving ? <Activity className="animate-spin" size={14}/> : <Save size={14}/>}
                                    {saving ? 'Збереження...' : isNew ? 'Створити' : 'Зберегти'}
                                </button>
                                <button onClick={closeModal}
                                    style={{ padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff', cursor:'pointer', color:'#6b7280', display:'flex', alignItems:'center' }}>
                                    <X size={16}/>
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div style={{ flex:1, overflowY:'auto', padding:20, background:'#f9fafb' }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

                            <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e5e7eb' }}>
                                <div style={{ fontWeight:700, color:'#1e2d7d', marginBottom:14 }}>Основна інформація</div>
                                <div style={{ display:'grid', gap:14 }}>
                                    <F label="Назва" req>
                                        <input value={sel.name} onChange={e=>{
                                            const v = e.target.value;
                                            upd('name', v);
                                            if (isNew) upd('slug', v.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''));
                                        }} style={IS}/>
                                    </F>
                                    <F label="Slug (URL)" req>
                                        <input value={sel.slug} onChange={e=>upd('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}
                                            style={{ ...IS, fontFamily:'monospace' }}/>
                                    </F>
                                    <F label="Опис">
                                        <textarea value={sel.description||''} onChange={e=>upd('description', e.target.value||null)} style={TS}/>
                                    </F>
                                    <F label="URL зображення">
                                        <input value={sel.cover_image||''} onChange={e=>upd('cover_image', e.target.value||null)} placeholder="https://..." style={IS}/>
                                        {sel.cover_image && (
                                            <img src={sel.cover_image} alt="" style={{ marginTop:8, width:'100%', maxHeight:120, objectFit:'cover', borderRadius:8, border:'1px solid #e5e7eb' }}
                                                onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none';}}/>
                                        )}
                                    </F>
                                    <F label="Порядок сортування">
                                        <input type="number" value={sel.sort_order} onChange={e=>upd('sort_order', parseInt(e.target.value)||0)} style={IS}/>
                                    </F>
                                </div>
                            </div>

                        </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
