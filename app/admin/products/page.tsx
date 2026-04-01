'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
    Save, Plus, Trash2, Activity, Package, DollarSign,
    Image as ImageIcon, Tag, Settings, X,
    Eye, EyeOff, Search, ToggleLeft, ToggleRight, FileText, BarChart2
} from 'lucide-react';

interface Category { id: string; name: string; slug: string; }
interface ProductOption {
    name: string; type: 'select' | 'multiselect' | 'text';
    required?: boolean;
    options: { label: string; value: string; price: number }[];
}
interface Product {
    id: string; name: string; slug: string; category_id: string | null;
    price: number; sale_price: number | null; price_from: boolean;
    cost_price: number | null; designer_service_price: number | null;
    short_description: string | null; description: string | null;
    images: string[]; video_url: string | null; og_image: string | null;
    options: ProductOption[]; is_active: boolean; is_personalized: boolean;
    has_designer_option: boolean; stock_quantity: number | null;
    track_inventory: boolean; tags: string[];
    meta_title: string | null; meta_description: string | null;
    is_popular: boolean; product_type: string | null;
}
type Tab = 'main' | 'prices' | 'media' | 'options' | 'stock' | 'seo';

const TABS: { id: Tab; label: string }[] = [
    { id: 'main', label: '📋 Основне' },
    { id: 'prices', label: '💰 Ціни' },
    { id: 'media', label: '🖼 Фото/Відео' },
    { id: 'options', label: '⚙️ Опції' },
    { id: 'stock', label: '📦 Склад' },
    { id: 'seo', label: '🔍 SEO' },
];

const IS = { width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, outline:'none', background:'#fff', boxSizing:'border-box' as const };
const TS = { ...IS, resize:'vertical' as const, minHeight:80 };

function F({ label, req, children }: { label:string; req?:boolean; children:React.ReactNode }) {
    return (
        <div>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>
                {label}{req && <span style={{ color:'#ef4444', marginLeft:3 }}>*</span>}
            </label>
            {children}
        </div>
    );
}

export default function ProductsAdminPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [sel, setSel] = useState<Product | null>(null);
    const [tab, setTab] = useState<Tab>('main');
    const [search, setSearch] = useState('');
    const [tagInput, setTagInput] = useState('');

    useEffect(() => { fetchAll(); }, []);

    async function fetchAll() {
        setLoading(true);
        const [{ data: prods }, { data: cats }] = await Promise.all([
            supabase.from('products').select(
                'id,name,slug,category_id,price,sale_price,price_from,cost_price,designer_service_price,short_description,description,images,video_url,og_image,options,is_active,is_personalized,has_designer_option,stock_quantity,track_inventory,tags,meta_title,meta_description,is_popular,product_type'
            ).order('name'),
            supabase.from('categories').select('id,name,slug').order('name'),
        ]);
        if (cats) setCategories(cats);
        if (prods) {
            const norm = (prods as any[]).map(p => ({
                ...p,
                images: Array.isArray(p.images) ? p.images : [],
                options: Array.isArray(p.options) ? p.options : [],
                tags: Array.isArray(p.tags) ? p.tags : [],
                is_active: p.is_active !== false,
                track_inventory: !!p.track_inventory,
                price_from: !!p.price_from,
                is_popular: !!p.is_popular,
            }));
            setProducts(norm);
            if (norm.length > 0) setSel(norm[0]);
        }
        setLoading(false);
    }

    async function save() {
        if (!sel) return;
        setSaving(true);
        const { error } = await supabase.from('products').update({
            name: sel.name, category_id: sel.category_id,
            price: sel.price, sale_price: sel.sale_price, price_from: sel.price_from,
            cost_price: sel.cost_price, designer_service_price: sel.designer_service_price,
            short_description: sel.short_description, description: sel.description,
            images: sel.images, video_url: sel.video_url, og_image: sel.og_image,
            options: sel.options, is_active: sel.is_active,
            is_personalized: sel.is_personalized, has_designer_option: sel.has_designer_option,
            stock_quantity: sel.stock_quantity, track_inventory: sel.track_inventory,
            tags: sel.tags, meta_title: sel.meta_title, meta_description: sel.meta_description,
            is_popular: sel.is_popular, product_type: sel.product_type,
        }).eq('id', sel.id);
        setSaving(false);
        if (error) { toast.error('Помилка: ' + error.message); return; }
        toast.success('Збережено ✓');
        setProducts(prev => prev.map(p => p.id === sel.id ? { ...sel } : p));
    }

    async function deleteProduct() {
        if (!sel) return;
        if (!confirm(`Видалити товар "${sel.name}"? Цю дію не можна скасувати.`)) return;
        const { error } = await supabase.from('products').delete().eq('id', sel.id);
        if (error) { toast.error('Помилка видалення: ' + error.message); return; }
        toast.success('Товар видалено');
        setProducts(prev => prev.filter(p => p.id !== sel.id));
        setSel(null);
    }

    function upd<K extends keyof Product>(k: K, v: Product[K]) {
        setSel(p => p ? { ...p, [k]: v } : p);
    }

    function addOpt() { upd('options', [...(sel?.options||[]), { name: 'Нова опція', type: 'select', required: true, options: [] }]); }
    function updOpt(i: number, patch: Partial<ProductOption>) {
        upd('options', (sel?.options||[]).map((o,j)=>j===i?{...o,...patch}:o));
    }
    function delOpt(i: number) { upd('options', (sel?.options||[]).filter((_,j)=>j!==i)); }
    function addItem(i: number) {
        upd('options', (sel?.options||[]).map((o,j)=>j===i?{...o,options:[...o.options,{label:'Варіант',value:`v${Date.now()}`,price:0}]}:o));
    }
    function updItem(oi: number, ii: number, f: string, v: any) {
        upd('options', (sel?.options||[]).map((o,j)=>j===oi?{...o,options:o.options.map((it,k)=>k===ii?{...it,[f]:v}:it)}:o));
    }
    function delItem(oi: number, ii: number) {
        upd('options', (sel?.options||[]).map((o,j)=>j===oi?{...o,options:o.options.filter((_,k)=>k!==ii)}:o));
    }
    function addTag(t: string) {
        if (!t.trim() || !sel) return;
        if (!sel.tags.includes(t.trim())) upd('tags', [...sel.tags, t.trim()]);
        setTagInput('');
    }
    function addImgUrl() {
        const u = prompt('URL зображення:');
        if (u && sel) {
            if (sel.images.length >= 10) { toast.error('Максимум 10 фото'); return; }
            upd('images', [...sel.images, u]);
        }
    }

    async function handleImageFiles(files: FileList | null) {
        if (!files || !sel) return;
        const remaining = 10 - sel.images.length;
        if (remaining <= 0) { toast.error('Максимум 10 фото'); return; }
        const toAdd = Array.from(files).slice(0, remaining);
        const newUrls: string[] = [];
        for (const file of toAdd) {
            if (!file.type.startsWith('image/')) continue;
            const url = URL.createObjectURL(file);
            newUrls.push(url);
        }
        if (newUrls.length) {
            upd('images', [...sel.images, ...newUrls]);
            toast.success(`Додано ${newUrls.length} фото (попередній перегляд)`);
        }
    }

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.slug.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
            <Activity className="animate-spin" size={36} color="#1e2d7d"/>
        </div>
    );

    const S = sel;

    return (
        <div style={{ display:'flex', height:'calc(100vh - 64px)', overflow:'hidden', fontFamily:'var(--font-body, sans-serif)', fontSize:14, color:'#111827' }}>

            {/* LEFT LIST */}
            <div style={{ width:240, borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column', background:'#fff', flexShrink:0 }}>
                <div style={{ padding:'14px 12px 10px', borderBottom:'1px solid #f3f4f6' }}>
                    <div style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', marginBottom:10 }}>Товари</div>
                    <div style={{ position:'relative' }}>
                        <Search size={13} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}/>
                        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Пошук..."
                            style={{ ...IS, paddingLeft:28, fontSize:13 }}/>
                    </div>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:8 }}>
                    {filtered.map(p => (
                        <button key={p.id} onClick={()=>{ setSel({...p}); setTab('main'); }}
                            style={{ width:'100%', textAlign:'left', padding:'8px 10px', borderRadius:8, marginBottom:2,
                                background: S?.id===p.id ? '#1e2d7d' : 'transparent',
                                color: S?.id===p.id ? '#fff' : '#374151', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0, background: p.is_active?'#10b981':'#ef4444' }}/>
                            <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                                <div style={{ fontSize:11, opacity:.7, marginTop:1 }}>{p.price} ₴</div>
                            </div>
                        </button>
                    ))}
                </div>
                <div style={{ padding:'8px 12px', borderTop:'1px solid #f3f4f6', fontSize:11, color:'#9ca3af', textAlign:'center' }}>
                    {filtered.length} / {products.length}
                </div>
            </div>

            {/* RIGHT */}
            {!S ? (
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', flexDirection:'column', gap:12 }}>
                    <Package size={48} style={{ opacity:.3 }}/><div>Оберіть товар</div>
                </div>
            ) : (
                <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                    {/* Header */}
                    <div style={{ padding:'12px 20px', borderBottom:'1px solid #e5e7eb', background:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:12 }}>
                        <div style={{ minWidth:0 }}>
                            <div style={{ fontWeight:800, fontSize:17, color:'#1e2d7d', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{S.name}</div>
                            <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>/{S.slug}</div>
                        </div>
                        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                            <button onClick={()=>upd('is_active',!S.is_active)}
                                style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, border:`1px solid ${S.is_active?'#10b981':'#ef4444'}`, background:S.is_active?'#f0fdf4':'#fef2f2', color:S.is_active?'#10b981':'#ef4444', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                                {S.is_active ? <Eye size={13}/> : <EyeOff size={13}/>}
                                {S.is_active ? 'Активний' : 'Неактивний'}
                            </button>
                            <button onClick={deleteProduct}
                                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, background:'#fff', color:'#ef4444', border:'1px solid #fca5a5', cursor:'pointer', fontWeight:600, fontSize:13 }}>
                                <Trash2 size={14}/> Видалити
                            </button>
                            <button onClick={save} disabled={saving}
                                style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 18px', borderRadius:8, background:'#1e2d7d', color:'#fff', border:'none', cursor:'pointer', fontWeight:700, fontSize:13, opacity:saving?.7:1 }}>
                                {saving ? <Activity className="animate-spin" size={14}/> : <Save size={14}/>}
                                {saving ? 'Збереження...' : 'Зберегти'}
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div style={{ display:'flex', borderBottom:'1px solid #e5e7eb', background:'#fff', padding:'0 16px', flexShrink:0, overflowX:'auto' }}>
                        {TABS.map(t => (
                            <button key={t.id} onClick={()=>setTab(t.id)}
                                style={{ padding:'10px 14px', border:'none', background:'transparent', cursor:'pointer', fontSize:13,
                                    fontWeight: tab===t.id?700:500, color: tab===t.id?'#1e2d7d':'#6b7280', whiteSpace:'nowrap',
                                    borderBottom: tab===t.id?'2px solid #1e2d7d':'2px solid transparent', marginBottom:-1 }}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div style={{ flex:1, overflowY:'auto', padding:20, background:'#f9fafb' }}>
                    <div style={{ maxWidth:800, display:'flex', flexDirection:'column', gap:16 }}>

                    {/* ── MAIN ── */}
                    {tab==='main' && <>
                        <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e5e7eb' }}>
                            <div style={{ fontWeight:700, color:'#1e2d7d', marginBottom:14 }}>Загальна інформація</div>
                            <div style={{ display:'grid', gap:14 }}>
                                <F label="Назва товару" req>
                                    <input value={S.name} onChange={e=>upd('name',e.target.value)} style={IS}/>
                                </F>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                                    <F label="Категорія">
                                        <select value={S.category_id||''} onChange={e=>upd('category_id',e.target.value||null)} style={IS}>
                                            <option value="">— без категорії —</option>
                                            {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </F>
                                    <F label="Тип товару">
                                        <select value={S.product_type||'personalized'} onChange={e=>upd('product_type',e.target.value)} style={IS}>
                                            <option value="personalized">Персоналізований</option>
                                            <option value="physical">Фізичний (склад)</option>
                                        </select>
                                    </F>
                                </div>
                                <F label="Короткий опис">
                                    <input value={S.short_description||''} onChange={e=>upd('short_description',e.target.value||null)} placeholder="Відображається під назвою на картці" style={IS}/>
                                </F>
                                <F label="Повний опис">
                                    <textarea value={S.description||''} onChange={e=>upd('description',e.target.value||null)} style={{...TS,minHeight:100}}/>
                                </F>
                            </div>
                        </div>
                        <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e5e7eb' }}>
                            <div style={{ fontWeight:700, color:'#1e2d7d', marginBottom:14 }}>Налаштування</div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                                {([
                                    ['is_personalized','Персоналізований','Вимагає завантаження фото/дизайну'],
                                    ['has_designer_option','Опція з дизайнером','Кнопка "Оформити з дизайнером"'],
                                    ['is_popular','Популярний','Відображати у блоці популярних'],
                                    ['price_from','Ціна "від"','Префікс "від" перед ціною'],
                                ] as const).map(([key,label,hint])=>(
                                    <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:10, background:'#f9fafb' }}>
                                        <div>
                                            <div style={{ fontSize:13, fontWeight:600 }}>{label}</div>
                                            <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>{hint}</div>
                                        </div>
                                        <button onClick={()=>upd(key as keyof Product, !(S as any)[key] as any)}
                                            style={{ background:'none', border:'none', cursor:'pointer', color:(S as any)[key]?'#10b981':'#d1d5db', lineHeight:1 }}>
                                            {(S as any)[key] ? <ToggleRight size={28}/> : <ToggleLeft size={28}/>}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>}

                    {/* ── PRICES ── */}
                    {tab==='prices' && <>
                        <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e5e7eb' }}>
                            <div style={{ fontWeight:700, color:'#1e2d7d', marginBottom:14 }}>Ціни</div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                                <F label="Базова ціна (₴)" req>
                                    <input type="number" value={S.price||''} onChange={e=>upd('price',parseFloat(e.target.value)||0)} style={IS}/>
                                </F>
                                <F label="Ціна зі знижкою (₴)">
                                    <input type="number" value={S.sale_price||''} onChange={e=>upd('sale_price',e.target.value?parseFloat(e.target.value):null)} placeholder="Необов'язково" style={IS}/>
                                </F>
                                <F label="Собівартість (₴)">
                                    <input type="number" value={S.cost_price||''} onChange={e=>upd('cost_price',e.target.value?parseFloat(e.target.value):null)} placeholder="Для внутрішнього обліку" style={IS}/>
                                </F>
                                <F label="Послуга дизайнера (₴)">
                                    <input type="number" value={S.designer_service_price||''} onChange={e=>upd('designer_service_price',e.target.value?parseFloat(e.target.value):null)} placeholder="0 = безкоштовно" style={IS}/>
                                </F>
                            </div>
                            {S.price>0 && S.cost_price && (
                                <div style={{ marginTop:12, padding:'10px 14px', background:'#f0fdf4', borderRadius:8, fontSize:13, color:'#166534' }}>
                                    💰 Маржа: <b>{Math.round(((S.price-S.cost_price)/S.price)*100)}%</b> · Прибуток: <b>{(S.price-S.cost_price).toFixed(0)} ₴</b>
                                </div>
                            )}
                        </div>
                    </>}

                    {/* ── MEDIA ── */}
                    {tab==='media' && <>
                        <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e5e7eb' }}>
                            {(() => {
                                const fileRef2 = { current: null as HTMLInputElement | null };
                                return (
                                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                                        <div>
                                            <div style={{ fontWeight:700, color:'#1e2d7d' }}>Фотографії</div>
                                            <div style={{ fontSize:11, color: S.images.length >= 10 ? '#ef4444' : '#9ca3af', marginTop:2 }}>{S.images.length}/10 фото</div>
                                        </div>
                                        <div style={{ display:'flex', gap:8 }}>
                                            <label style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', background: S.images.length >= 10 ? '#f3f4f6' : '#f0f3ff', color: S.images.length >= 10 ? '#9ca3af' : '#1e2d7d', border:'1px dashed #c7d2fe', borderRadius:8, cursor: S.images.length >= 10 ? 'not-allowed' : 'pointer', fontSize:13, fontWeight:600 }}>
                                                <ImageIcon size={13}/> Завантажити файл
                                                <input type="file" multiple accept="image/*" style={{ display:'none' }} disabled={S.images.length >= 10}
                                                    onChange={e=>handleImageFiles(e.target.files)}/>
                                            </label>
                                            <button onClick={addImgUrl} disabled={S.images.length >= 10} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', background: S.images.length >= 10 ? '#f3f4f6' : '#1e2d7d', color: S.images.length >= 10 ? '#9ca3af' : '#fff', border:'none', borderRadius:8, cursor: S.images.length >= 10 ? 'not-allowed' : 'pointer', fontSize:13, fontWeight:600 }}>
                                                <Plus size={13}/> URL
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                            {S.images.length===0 ? (
                                <div style={{ border:'2px dashed #e5e7eb', borderRadius:10, padding:36, textAlign:'center', color:'#9ca3af' }}>
                                    <ImageIcon size={32} style={{ margin:'0 auto 8px', opacity:.4 }}/>
                                    <div style={{ fontSize:13 }}>Немає фото. Додайте URL зображення.</div>
                                </div>
                            ) : (
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(110px,1fr))', gap:10 }}>
                                    {S.images.map((img,i)=>(
                                        <div key={i} style={{ position:'relative', borderRadius:8, overflow:'hidden', border:'1px solid #e5e7eb', aspectRatio:'1' }}>
                                            <img src={img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{(e.currentTarget as HTMLImageElement).style.background='#f3f4f6';}}/>
                                            <button onClick={()=>upd('images',S.images.filter((_,j)=>j!==i))}
                                                style={{ position:'absolute', top:3, right:3, background:'rgba(0,0,0,0.65)', color:'#fff', border:'none', borderRadius:'50%', width:20, height:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                                                <X size={11}/>
                                            </button>
                                            {i===0 && <div style={{ position:'absolute', bottom:3, left:3, background:'#1e2d7d', color:'#fff', fontSize:8, fontWeight:700, padding:'2px 5px', borderRadius:3 }}>ГОЛОВНЕ</div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e5e7eb' }}>
                            <div style={{ fontWeight:700, color:'#1e2d7d', marginBottom:14 }}>Відео та OG</div>
                            <div style={{ display:'grid', gap:12 }}>
                                <F label="URL відео (MP4)"><input value={S.video_url||''} onChange={e=>upd('video_url',e.target.value||null)} placeholder="https://..." style={IS}/></F>
                                <F label="OG Image URL"><input value={S.og_image||''} onChange={e=>upd('og_image',e.target.value||null)} placeholder="https://..." style={IS}/></F>
                            </div>
                        </div>
                    </>}

                    {/* ── OPTIONS ── */}
                    {tab==='options' && <>
                        <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e5e7eb' }}>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                                <div>
                                    <div style={{ fontWeight:700, color:'#1e2d7d' }}>Опції товару</div>
                                    <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>Ціна варіанту — <b>абсолютна</b> вартість (не доплата). Синхронізовано з БД.</div>
                                </div>
                                <button onClick={addOpt} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                                    <Plus size={13}/> Додати опцію
                                </button>
                            </div>
                            {S.options.length===0 ? (
                                <div style={{ border:'2px dashed #e5e7eb', borderRadius:10, padding:36, textAlign:'center', color:'#9ca3af' }}>
                                    <Settings size={32} style={{ margin:'0 auto 8px', opacity:.4 }}/>
                                    <div style={{ fontSize:13 }}>Опцій немає.</div>
                                </div>
                            ) : (
                                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                                    {S.options.map((opt,oi)=>(
                                        <div key={oi} style={{ border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden' }}>
                                            {/* opt header */}
                                            <div style={{ display:'grid', gridTemplateColumns:'1fr 130px 110px 36px', gap:8, padding:12, background:'#f8fafc', alignItems:'end' }}>
                                                <F label="Назва опції">
                                                    <input value={opt.name} onChange={e=>updOpt(oi,{name:e.target.value})} style={{...IS,fontSize:13}}/>
                                                </F>
                                                <F label="Тип">
                                                    <select value={opt.type} onChange={e=>updOpt(oi,{type:e.target.value as any})} style={{...IS,fontSize:13}}>
                                                        <option value="select">Select</option>
                                                        <option value="multiselect">Multi</option>
                                                        <option value="text">Text</option>
                                                    </select>
                                                </F>
                                                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:2 }}>
                                                    <input type="checkbox" checked={opt.required!==false} onChange={e=>updOpt(oi,{required:e.target.checked})} style={{ width:14, height:14 }}/>
                                                    Обов'язкова
                                                </label>
                                                <button onClick={()=>delOpt(oi)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', marginBottom:2 }}>
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                            {/* opt items */}
                                            <div style={{ padding:12 }}>
                                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 80px 28px', gap:6, marginBottom:6 }}>
                                                    {['Назва','Value','Ціна ₴',''].map((h,i)=><div key={i} style={{ fontSize:10, fontWeight:700, color:i===2?'#1e2d7d':'#9ca3af', textTransform:'uppercase' }}>{h}</div>)}
                                                </div>
                                                {opt.options.map((it,ii)=>(
                                                    <div key={ii} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 80px 28px', gap:6, marginBottom:6 }}>
                                                        <input value={it.label} onChange={e=>updItem(oi,ii,'label',e.target.value)} style={{...IS,fontSize:13,padding:'7px 10px'}}/>
                                                        <input value={it.value} onChange={e=>updItem(oi,ii,'value',e.target.value)} style={{...IS,fontSize:13,padding:'7px 10px',fontFamily:'monospace'}}/>
                                                        <input type="number" value={it.price||0} onChange={e=>updItem(oi,ii,'price',parseFloat(e.target.value)||0)} style={{...IS,fontSize:13,padding:'7px 10px'}}/>
                                                        <button onClick={()=>delItem(oi,ii)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:0 }}><X size={13}/></button>
                                                    </div>
                                                ))}
                                                <button onClick={()=>addItem(oi)} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#1e2d7d', background:'none', border:'1px dashed #c7d2fe', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontWeight:600, marginTop:4 }}>
                                                    <Plus size={11}/> Додати варіант
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>}

                    {/* ── STOCK ── */}
                    {tab==='stock' && <>
                        <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e5e7eb' }}>
                            <div style={{ fontWeight:700, color:'#1e2d7d', marginBottom:14 }}>Склад</div>
                            <div style={{ display:'grid', gap:14 }}>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', border:'1px solid #e5e7eb', borderRadius:10, background:'#f9fafb' }}>
                                    <div>
                                        <div style={{ fontSize:13, fontWeight:600 }}>Відстежувати залишки</div>
                                        <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>Автоматично знімати при 0</div>
                                    </div>
                                    <button onClick={()=>upd('track_inventory',!S.track_inventory)} style={{ background:'none', border:'none', cursor:'pointer', color:S.track_inventory?'#10b981':'#d1d5db' }}>
                                        {S.track_inventory ? <ToggleRight size={28}/> : <ToggleLeft size={28}/>}
                                    </button>
                                </div>
                                {S.product_type==='physical' && (
                                    <F label="Кількість на складі (шт)">
                                        <input type="number" value={S.stock_quantity??''} onChange={e=>upd('stock_quantity',e.target.value?parseInt(e.target.value):null)} placeholder="0" style={IS}/>
                                    </F>
                                )}
                                {S.is_personalized && (
                                    <div style={{ padding:'10px 14px', background:'#fef9c3', borderRadius:8, fontSize:13, color:'#713f12' }}>
                                        ℹ️ Персоналізовані товари виготовляються під замовлення — склад не обмежений.
                                    </div>
                                )}
                            </div>
                        </div>
                    </>}

                    {/* ── SEO ── */}
                    {tab==='seo' && <>
                        <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e5e7eb' }}>
                            <div style={{ fontWeight:700, color:'#1e2d7d', marginBottom:14 }}>SEO</div>
                            <div style={{ display:'grid', gap:14 }}>
                                <F label="Meta title"><input value={S.meta_title||''} onChange={e=>upd('meta_title',e.target.value||null)} placeholder={`${S.name} | Touch.Memories`} style={IS}/></F>
                                <F label="Meta description"><textarea value={S.meta_description||''} onChange={e=>upd('meta_description',e.target.value||null)} style={TS}/></F>
                                <F label="Теги">
                                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                                        {S.tags.map((t,i)=>(
                                            <span key={i} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', background:'#ede9fe', color:'#5b21b6', borderRadius:20, fontSize:12, fontWeight:600 }}>
                                                {t}<button onClick={()=>upd('tags',S.tags.filter((_,j)=>j!==i))} style={{ background:'none', border:'none', cursor:'pointer', color:'#7c3aed', padding:0, lineHeight:1, display:'flex' }}><X size={10}/></button>
                                            </span>
                                        ))}
                                    </div>
                                    <div style={{ display:'flex', gap:8 }}>
                                        <input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTag(tagInput);}}}
                                            placeholder="Новий тег, Enter щоб додати" style={{...IS,flex:1}}/>
                                        <button onClick={()=>addTag(tagInput)} style={{ padding:'9px 14px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:13 }}>
                                            Додати
                                        </button>
                                    </div>
                                </F>
                            </div>
                        </div>
                        <div style={{ background:'#f0f9ff', borderRadius:12, padding:14, border:'1px solid #bae6fd', fontSize:13, color:'#0369a1' }}>
                            <b>Google preview:</b>
                            <div style={{ marginTop:6, color:'#1d4ed8', fontSize:15, fontWeight:600 }}>{S.meta_title||S.name}</div>
                            <div style={{ color:'#166534', fontSize:12 }}>touchmemories.ua/catalog/{S.slug}</div>
                            <div style={{ color:'#374151', marginTop:3 }}>{S.meta_description||S.short_description||'—'}</div>
                        </div>
                    </>}

                    </div>
                    </div>
                </div>
            )}
        </div>
    );
}
