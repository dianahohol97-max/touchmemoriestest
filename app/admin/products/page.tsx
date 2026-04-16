'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
    Save, Plus, Trash2, Activity, Package,
    Image as ImageIcon, Settings, X,
    Eye, EyeOff, Search, ToggleLeft, ToggleRight, FileText,
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
    { id: 'main',    label: 'Основне' },
    { id: 'prices',  label: 'Ціни' },
    { id: 'media',   label: 'Фото/Відео' },
    { id: 'options', label: 'Опції' },
    { id: 'stock',   label: 'Склад' },
    { id: 'seo',     label: 'SEO' },
];

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

export default function ProductsAdminPage() {
    const supabase = createClient();
    const [loading,   setLoading]   = useState(true);
    const [saving,    setSaving]    = useState(false);
    const [products,  setProducts]  = useState<Product[]>([]);
    const [categories,setCategories]= useState<Category[]>([]);
    const [sel,       setSel]       = useState<Product | null>(null);
    const [tab,       setTab]       = useState<Tab>('main');
    const [search,    setSearch]    = useState('');
    const [catFilter, setCatFilter] = useState('');
    const [modal,     setModal]     = useState(false);
    const [tagInput,  setTagInput]  = useState('');

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
        setModal(false);
        // Revalidate cache so changes appear on site immediately
        fetch('/api/revalidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: sel.slug }) }).catch(() => {});
    }

    async function deleteProduct() {
        if (!sel) return;
        if (!confirm(`Видалити товар "${sel.name}"?`)) return;
        const { error } = await supabase.from('products').delete().eq('id', sel.id);
        if (error) { toast.error('Помилка: ' + error.message); return; }
        toast.success('Товар видалено');
        setProducts(prev => prev.filter(p => p.id !== sel.id));
        setModal(false); setSel(null);
    }

    function upd<K extends keyof Product>(k: K, v: Product[K]) {
        setSel(p => p ? { ...p, [k]: v } : p);
    }
    function addOpt() { upd('options', [...(sel?.options||[]), { name: 'Нова опція', type: 'select', required: true, options: [] }]); }
    function updOpt(i: number, patch: Partial<ProductOption>) {
        upd('options', (sel?.options||[]).map((o,j) => j===i ? {...o,...patch} : o));
    }
    function delOpt(i: number) { upd('options', (sel?.options||[]).filter((_,j) => j!==i)); }
    function addItem(i: number) {
        upd('options', (sel?.options||[]).map((o,j) => j===i ? {...o,options:[...o.options,{label:'Варіант',value:`v${Date.now()}`,price:0}]} : o));
    }
    function updItem(oi: number, ii: number, f: string, v: any) {
        upd('options', (sel?.options||[]).map((o,j) => j===oi ? {...o,options:o.options.map((it,k) => k===ii ? {...it,[f]:v} : it)} : o));
    }
    function delItem(oi: number, ii: number) {
        upd('options', (sel?.options||[]).map((o,j) => j===oi ? {...o,options:o.options.filter((_,k) => k!==ii)} : o));
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
        const newUrls: string[] = [];
        for (const file of Array.from(files).slice(0, remaining)) {
            if (file.type.startsWith('image/')) newUrls.push(URL.createObjectURL(file));
        }
        if (newUrls.length) { upd('images', [...sel.images, ...newUrls]); toast.success(`Додано ${newUrls.length} фото`); }
    }

    const isNew = sel?.id === '';

    function openEdit(p: Product) { setSel({...p}); setTab('main'); setModal(true); }
    function closeModal() { setModal(false); setSel(null); }

    async function handleVideoUpload(file: File) {
        if (!sel) return;
        if (!file.type.startsWith('video/')) { toast.error('Оберіть відео файл'); return; }
        if (file.size > 100 * 1024 * 1024) { toast.error('Відео не більше 100MB'); return; }
        toast.loading('Завантаження відео...', { id: 'video-upload' });
        const ext = file.name.split('.').pop();
        const path = `products/videos/${Date.now()}.${ext}`;
        const supabaseClient = createClient();
        const { error } = await supabaseClient.storage.from('touch-memories-assets').upload(path, file, { upsert: true });
        if (error) { toast.error('Помилка: ' + error.message, { id: 'video-upload' }); return; }
        const { data: { publicUrl } } = supabaseClient.storage.from('touch-memories-assets').getPublicUrl(path);
        upd('video_url', publicUrl);
        toast.success('Відео завантажено ✓', { id: 'video-upload' });
    }

    function openNew() {
        setSel({
            id: '', name: 'Новий товар', slug: '',
            category_id: null, price: 0, sale_price: null, price_from: false,
            cost_price: null, designer_service_price: null,
            short_description: null, description: null,
            images: [], video_url: null, og_image: null,
            options: [], is_active: true, is_personalized: true,
            has_designer_option: false, stock_quantity: null,
            track_inventory: false, tags: [],
            meta_title: null, meta_description: null,
            is_popular: false, product_type: 'personalized',
        });
        setTab('main'); setModal(true);
    }

    async function saveNew() {
        if (!sel) return;
        if (!sel.name.trim() || !sel.slug.trim()) { toast.error('Заповніть назву та slug'); return; }
        setSaving(true);
        const { data, error } = await supabase.from('products').insert({
            name: sel.name, slug: sel.slug, category_id: sel.category_id,
            price: sel.price, sale_price: sel.sale_price, price_from: sel.price_from,
            cost_price: sel.cost_price, designer_service_price: sel.designer_service_price,
            short_description: sel.short_description, description: sel.description,
            images: sel.images, video_url: sel.video_url, og_image: sel.og_image,
            options: sel.options, is_active: sel.is_active,
            is_personalized: sel.is_personalized, has_designer_option: sel.has_designer_option,
            stock_quantity: sel.stock_quantity, track_inventory: sel.track_inventory,
            tags: sel.tags, meta_title: sel.meta_title, meta_description: sel.meta_description,
            is_popular: sel.is_popular, product_type: sel.product_type,
        }).select().single();
        setSaving(false);
        if (error) { toast.error('Помилка: ' + error.message); return; }
        toast.success('Товар створено ✓');
        // Revalidate cache
        fetch('/api/revalidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: newProd?.slug || '' }) }).catch(() => {});
        const newProd = { ...sel, id: data.id };
        setProducts(prev => [...prev, newProd].sort((a,b) => a.name.localeCompare(b.name)));
        setModal(false); setSel(null);
    }

    const filtered = products.filter(p => {
        const q = search.toLowerCase();
        return (p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
            && (!catFilter || p.category_id === catFilter);
    });

    if (loading) return (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
            <Activity className="animate-spin" size={36} color="#1e2d7d"/>
        </div>
    );

    const S = sel;

    return (
        <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 64px)', overflow:'hidden', fontFamily:'var(--font-body,sans-serif)', fontSize:14, color:'#111827', background:'#f9fafb' }}>

            {/* TOP BAR */}
            <div style={{ padding:'12px 20px', borderBottom:'1px solid #e5e7eb', background:'#fff', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                <div style={{ fontWeight:800, fontSize:17, color:'#1e2d7d', marginRight:4 }}>Товари</div>
                <div style={{ position:'relative', flex:'1 1 0', maxWidth:300 }}>
                    <Search size={13} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}/>
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Швидкий пошук..."
                        style={{ ...IS, paddingLeft:30, fontSize:13 }}/>
                </div>
                <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
                    style={{ ...IS, width:'auto', minWidth:170, fontSize:13 }}>
                    <option value="">Виберіть категорію</option>
                    {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div style={{ fontSize:12, color:'#9ca3af', whiteSpace:'nowrap' }}>{filtered.length} / {products.length}</div>
                <button onClick={openNew}
                    style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#1e2d7d', color:'#fff', borderRadius:8, fontWeight:700, fontSize:13, border:'none', cursor:'pointer', flexShrink:0 }}>
                    <Plus size={14}/> Додати товар
                </button>
            </div>

            {/* TABLE */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
                <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0, background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                    <thead>
                        <tr style={{ background:'#f8fafc' }}>
                            <th style={{ ...TH, width:52 }}></th>
                            <th style={{ ...TH, textAlign:'left' }}>Назва</th>
                            <th style={{ ...TH, textAlign:'left' }}>Категорія</th>
                            <th style={{ ...TH, textAlign:'center' }}>Вартість</th>
                            <th style={{ ...TH, textAlign:'center' }}>Кількість</th>
                            <th style={{ ...TH, textAlign:'center' }}>Статус</th>
                            <th style={{ ...TH, textAlign:'center', width:100 }}>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((p, idx) => {
                            const cat = categories.find(c=>c.id===p.category_id);
                            const img = p.images?.[0];
                            return (
                                <tr key={p.id} onClick={()=>openEdit(p)}
                                    style={{ borderTop: idx===0?'none':'1px solid #f1f5f9', cursor:'pointer' }}
                                    onMouseEnter={e=>(e.currentTarget.style.background='#f8fafc')}
                                    onMouseLeave={e=>(e.currentTarget.style.background='')}>
                                    <td style={{ ...TD, padding:'8px 8px 8px 14px' }}>
                                        <div style={{ width:40, height:40, borderRadius:8, overflow:'hidden', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                            {img
                                                ? <img src={img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none';}}/>
                                                : <Package size={16} color="#d1d5db"/>}
                                        </div>
                                    </td>
                                    <td style={{ ...TD, fontWeight:600, maxWidth:260 }}>
                                        <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                                        <div style={{ fontSize:11, color:'#9ca3af', marginTop:1, fontWeight:400 }}>/{p.slug}</div>
                                    </td>
                                    <td style={{ ...TD, color:'#6b7280', fontSize:13 }}>
                                        {cat?.name || <span style={{ color:'#d1d5db' }}>—</span>}
                                    </td>
                                    <td style={{ ...TD, textAlign:'center', fontWeight:700, color:'#1e2d7d', whiteSpace:'nowrap' }}>
                                        {p.sale_price
                                            ? <><span style={{ textDecoration:'line-through', color:'#9ca3af', fontWeight:400, fontSize:12, marginRight:4 }}>{p.price} ₴</span><span>{p.sale_price} ₴</span></>
                                            : `${p.price} ₴`}
                                    </td>
                                    <td style={{ ...TD, textAlign:'center' }}>
                                        {p.product_type==='physical' && p.stock_quantity != null
                                            ? <span style={{ fontWeight:600 }}>{p.stock_quantity} шт</span>
                                            : <span style={{ color:'#d1d5db' }}>∞</span>}
                                    </td>
                                    <td style={{ ...TD, textAlign:'center' }}>
                                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600,
                                            background: p.is_active?'#f0fdf4':'#fef2f2', color: p.is_active?'#10b981':'#ef4444' }}>
                                            <span style={{ width:6, height:6, borderRadius:'50%', background: p.is_active?'#10b981':'#ef4444', display:'inline-block' }}/>
                                            {p.is_active ? 'Активний' : 'Неактивний'}
                                        </span>
                                    </td>
                                    <td style={{ ...TD, textAlign:'center' }} onClick={e=>e.stopPropagation()}>
                                        <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                                            <button onClick={()=>openEdit(p)} title="Редагувати"
                                                style={{ padding:'5px 7px', border:'1px solid #e5e7eb', borderRadius:7, background:'#fff', cursor:'pointer', color:'#374151', display:'flex', alignItems:'center' }}>
                                                <FileText size={14}/>
                                            </button>
                                            <button title="Видалити"
                                                onClick={async()=>{
                                                    if(!confirm(`Видалити "${p.name}"?`)) return;
                                                    const{error}=await supabase.from('products').delete().eq('id',p.id);
                                                    if(!error){setProducts(prev=>prev.filter(x=>x.id!==p.id));toast.success('Видалено');}
                                                    else toast.error(error.message);
                                                }}
                                                style={{ padding:'5px 7px', border:'1px solid #fca5a5', borderRadius:7, background:'#fff', cursor:'pointer', color:'#ef4444', display:'flex', alignItems:'center' }}>
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filtered.length === 0 && (
                    <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>
                        <Package size={40} style={{ margin:'0 auto 12px', opacity:.3, display:'block' }}/>
                        <div>Товарів не знайдено</div>
                    </div>
                )}
            </div>

            {/* SLIDE-IN MODAL */}
            {modal && S && (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'flex-end' }}
                    onClick={e=>{ if(e.target===e.currentTarget) closeModal(); }}>
                    <div style={{ width:'min(780px,100vw)', height:'100vh', background:'#fff', display:'flex', flexDirection:'column', boxShadow:'-4px 0 32px rgba(0,0,0,0.12)' }}>

                        {/* Modal header */}
                        <div style={{ padding:'12px 20px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:10 }}>
                            <div style={{ minWidth:0 }}>
                                <div style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{S.name}</div>
                                <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>/{S.slug}</div>
                            </div>
                            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                                <button onClick={()=>upd('is_active',!S.is_active)}
                                    style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, border:`1px solid ${S.is_active?'#10b981':'#ef4444'}`, background:S.is_active?'#f0fdf4':'#fef2f2', color:S.is_active?'#10b981':'#ef4444', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                                    {S.is_active ? <Eye size={13}/> : <EyeOff size={13}/>}
                                    {S.is_active ? 'Активний' : 'Неактивний'}
                                </button>
                                {!isNew && <button onClick={deleteProduct}
                                    style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, background:'#fff', color:'#ef4444', border:'1px solid #fca5a5', cursor:'pointer', fontWeight:600, fontSize:13 }}>
                                    <Trash2 size={14}/> Видалити
                                </button>}
                                <button onClick={isNew ? saveNew : save} disabled={saving}
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

                        {/* Modal body */}
                        <div style={{ flex:1, overflowY:'auto', padding:20, background:'#f9fafb' }}>
                        <div style={{ maxWidth:760, display:'flex', flexDirection:'column', gap:16 }}>

                        {tab==='main' && <>
                            <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e5e7eb' }}>
                                <div style={{ fontWeight:700, color:'#1e2d7d', marginBottom:14 }}>Загальна інформація</div>
                                <div style={{ display:'grid', gap:14 }}>
                                    <F label="Назва товару" req>
                                        <input value={S.name} onChange={e=>{
                                            upd('name',e.target.value);
                                            if(isNew) upd('slug', e.target.value.toLowerCase().replace(/[^a-zа-яіїєґ0-9\s-]/gi,'').replace(/\s+/g,'-').replace(/-+/g,'-'));
                                        }} style={IS}/>
                                    </F>
                                    {isNew && <F label="Slug (URL)" req>
                                        <input value={S.slug} onChange={e=>upd('slug',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))} placeholder="miy-tovar" style={{...IS, fontFamily:'monospace'}}/>
                                    </F>}
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
                                        <input value={S.short_description||''} onChange={e=>upd('short_description',e.target.value||null)} style={IS}/>
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
                                        Маржа: <b>{Math.round(((S.price-S.cost_price)/S.price)*100)}%</b> · Прибуток: <b>{(S.price-S.cost_price).toFixed(0)} ₴</b>
                                    </div>
                                )}
                            </div>
                        </>}

                        {tab==='media' && <>
                            <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e5e7eb' }}>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                                    <div>
                                        <div style={{ fontWeight:700, color:'#1e2d7d' }}>Фотографії</div>
                                        <div style={{ fontSize:11, color: S.images.length >= 10 ? '#ef4444' : '#9ca3af', marginTop:2 }}>{S.images.length}/10 фото</div>
                                    </div>
                                    <div style={{ display:'flex', gap:8 }}>
                                        <label style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', background: S.images.length >= 10 ? '#f3f4f6' : '#f0f3ff', color: S.images.length >= 10 ? '#9ca3af' : '#1e2d7d', border:'1px dashed #c7d2fe', borderRadius:8, cursor: S.images.length >= 10 ? 'not-allowed' : 'pointer', fontSize:13, fontWeight:600 }}>
                                            <ImageIcon size={13}/> Завантажити
                                            <input type="file" multiple accept="image/*" style={{ display:'none' }} disabled={S.images.length >= 10} onChange={e=>handleImageFiles(e.target.files)}/>
                                        </label>
                                        <button onClick={addImgUrl} disabled={S.images.length >= 10}
                                            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', background: S.images.length >= 10 ? '#f3f4f6' : '#1e2d7d', color: S.images.length >= 10 ? '#9ca3af' : '#fff', border:'none', borderRadius:8, cursor: S.images.length >= 10 ? 'not-allowed' : 'pointer', fontSize:13, fontWeight:600 }}>
                                            <Plus size={13}/> URL
                                        </button>
                                    </div>
                                </div>
                                {S.images.length===0 ? (
                                    <div style={{ border:'2px dashed #e5e7eb', borderRadius:10, padding:36, textAlign:'center', color:'#9ca3af' }}>
                                        <ImageIcon size={32} style={{ margin:'0 auto 8px', opacity:.4, display:'block' }}/>
                                        <div style={{ fontSize:13 }}>Немає фото</div>
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
                                    <F label="Відео (MP4)">
                                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                            {S.video_url && (
                                                <video src={S.video_url} controls style={{ width:'100%', borderRadius:8, maxHeight:180 }}/>
                                            )}
                                            <div style={{ display:'flex', gap:8 }}>
                                                <label style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', background:'#f0f3ff', color:'#1e2d7d', border:'1px dashed #c7d2fe', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600, flexShrink:0 }}>
                                                    📁 Завантажити файл
                                                    <input type="file" accept="video/*" style={{ display:'none' }} onChange={e=>{ if(e.target.files?.[0]) handleVideoUpload(e.target.files[0]); }}/>
                                                </label>
                                                <input value={S.video_url||''} onChange={e=>upd('video_url',e.target.value||null)} placeholder="або вставте URL відео..." style={{ ...IS, flex:1 }}/>
                                                {S.video_url && <button onClick={()=>upd('video_url',null)} style={{ padding:'8px', border:'1px solid #fca5a5', borderRadius:8, background:'#fff', cursor:'pointer', color:'#ef4444', display:'flex', alignItems:'center' }}>✕</button>}
                                            </div>
                                        </div>
                                    </F>
                                    <F label="OG Image URL"><input value={S.og_image||''} onChange={e=>upd('og_image',e.target.value||null)} placeholder="https://..." style={IS}/></F>
                                </div>
                            </div>
                        </>}

                        {tab==='options' && <>
                            <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e5e7eb' }}>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                                    <div>
                                        <div style={{ fontWeight:700, color:'#1e2d7d' }}>Опції товару</div>
                                        <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>Ціна варіанту — <b>абсолютна</b> вартість.</div>
                                    </div>
                                    <button onClick={addOpt} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                                        <Plus size={13}/> Додати опцію
                                    </button>
                                </div>
                                {S.options.length===0 ? (
                                    <div style={{ border:'2px dashed #e5e7eb', borderRadius:10, padding:36, textAlign:'center', color:'#9ca3af' }}>
                                        <Settings size={32} style={{ margin:'0 auto 8px', opacity:.4, display:'block' }}/>
                                        <div style={{ fontSize:13 }}>Опцій немає.</div>
                                    </div>
                                ) : (
                                    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                                        {S.options.map((opt,oi)=>(
                                            <div key={oi} style={{ border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden' }}>
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
                                            ℹ Персоналізовані товари виготовляються під замовлення — склад не обмежений.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>}

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
                                            <input value={tagInput} onChange={e=>setTagInput(e.target.value)}
                                                onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTag(tagInput);}}}
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
                </div>
            )}
        </div>
    );
}
