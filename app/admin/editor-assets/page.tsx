'use client';
import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { Plus, Trash2, Search, Upload } from 'lucide-react';

type ResourceType = 'stickers' | 'frames' | 'covers';

interface Sticker { id:string; name:string; category:string; image_url:string; tags:string[]; sort_order:number; is_active:boolean }
interface Frame { id:string; name:string; category:string; image_url:string; svg_data:string; tags:string[]; is_active:boolean }
interface Cover { id:string; name:string; name_uk:string; thumbnail_url:string; is_blank:boolean; sort_order:number; is_active:boolean; product_slugs:string[] }

export default function EditorAssetsPage() {
  const [tab, setTab] = useState<ResourceType>('stickers');
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [covers, setCovers] = useState<Cover[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [s, f, c] = await Promise.all([
      sb.from('editor_stickers').select('*').order('sort_order'),
      sb.from('editor_frames').select('*').order('sort_order'),
      sb.from('book_cover_templates').select('*').order('sort_order'),
    ]);
    if (s.data) setStickers(s.data);
    if (f.data) setFrames(f.data);
    if (c.data) setCovers(c.data);
    setLoading(false);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `editor-assets/${Date.now()}.${ext}`;
    const { data, error } = await sb.storage.from('public').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = sb.storage.from('public').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleAdd = async () => {
    try {
      let imageUrl = form.image_url || '';
      if (form._file) imageUrl = await uploadImage(form._file);
      
      if (tab === 'stickers') {
        await sb.from('editor_stickers').insert({ name: form.name, category: form.category||'general', image_url: imageUrl, tags: (form.tags||'').split(',').map((t:string)=>t.trim()).filter(Boolean), sort_order: stickers.length });
      } else if (tab === 'frames') {
        await sb.from('editor_frames').insert({ name: form.name, category: form.category||'simple', image_url: imageUrl, svg_data: form.svg_data||'', tags: (form.tags||'').split(',').map((t:string)=>t.trim()).filter(Boolean) });
      } else {
        await sb.from('book_cover_templates').insert({ name: form.name, name_uk: form.name_uk||form.name, thumbnail_url: imageUrl, product_slugs: (form.product_slugs||'photobook-velour').split(',').map((s:string)=>s.trim()), sort_order: covers.length, is_blank: false });
      }
      setAdding(false); setForm({}); await loadAll();
    } catch(e) { alert('Помилка: ' + String(e)); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Видалити?')) return;
    await sb.from(tab === 'stickers' ? 'editor_stickers' : tab === 'frames' ? 'editor_frames' : 'book_cover_templates').delete().eq('id', id);
    await loadAll();
  };

  const handleToggle = async (id: string, current: boolean) => {
    await sb.from(tab === 'stickers' ? 'editor_stickers' : tab === 'frames' ? 'editor_frames' : 'book_cover_templates').update({ is_active: !current }).eq('id', id);
    await loadAll();
  };

  const items = tab === 'stickers' ? stickers : tab === 'frames' ? frames : covers;
  const filtered = items.filter((i:any) => !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.name_uk?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ padding:24, maxWidth:1100, margin:'0 auto', fontFamily:'sans-serif' }}>
      <h1 style={{ fontSize:22, fontWeight:800, color:'#1e2d7d', marginBottom:20 }}>Ресурси редактора фотокниги</h1>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {(['stickers','frames','covers'] as ResourceType[]).map(t => (
          <button key={t} onClick={()=>{setTab(t);setSearch('');}}
            style={{ padding:'8px 20px', border:tab===t?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background:tab===t?'#f0f3ff':'#fff', cursor:'pointer', fontWeight:700, fontSize:13, color:tab===t?'#1e2d7d':'#374151' }}>
            {t==='stickers'?'Стікери':t==='frames'?'Рамки':'Обкладинки'}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <div style={{ flex:1, position:'relative' }}>
          <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Пошук..." style={{ width:'100%', padding:'8px 8px 8px 32px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' }}/>
        </div>
        <button onClick={()=>setAdding(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13 }}>
          <Plus size={14}/> Додати
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:16, marginBottom:16, display:'flex', flexWrap:'wrap', gap:10, alignItems:'flex-end' }}>
          <div style={{ flex:'1 1 160px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>Назва *</div>
            <input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} style={{ width:'100%', padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:13, boxSizing:'border-box' }}/>
          </div>
          {tab === 'covers' && (
            <div style={{ flex:'1 1 160px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>Назва (укр)</div>
              <input value={form.name_uk||''} onChange={e=>setForm({...form,name_uk:e.target.value})} style={{ width:'100%', padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:13, boxSizing:'border-box' }}/>
            </div>
          )}
          <div style={{ flex:'1 1 120px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>Категорія</div>
            <input value={form.category||''} onChange={e=>setForm({...form,category:e.target.value})} placeholder={tab==='stickers'?'love, nature...':'simple, floral...'} style={{ width:'100%', padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:13, boxSizing:'border-box' }}/>
          </div>
          <div style={{ flex:'1 1 160px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>Теги (через кому)</div>
            <input value={form.tags||''} onChange={e=>setForm({...form,tags:e.target.value})} style={{ width:'100%', padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:13, boxSizing:'border-box' }}/>
          </div>
          <div style={{ flex:'1 1 180px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>URL зображення або завантажити</div>
            <input value={form.image_url||''} onChange={e=>setForm({...form,image_url:e.target.value})} placeholder="https://..." style={{ width:'100%', padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12, boxSizing:'border-box' }}/>
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*,.svg" onChange={e=>setForm({...form,_file:e.target.files?.[0]})} style={{ display:'none' }}/>
            <button onClick={()=>fileRef.current?.click()} style={{ padding:'7px 12px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:5 }}>
              <Upload size={13}/> {form._file?.name||'Файл'}
            </button>
          </div>
          {tab === 'frames' && (
            <div style={{ flex:'1 1 100%' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>SVG код (опційно)</div>
              <textarea value={form.svg_data||''} onChange={e=>setForm({...form,svg_data:e.target.value})} rows={3} style={{ width:'100%', padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:11, fontFamily:'monospace', boxSizing:'border-box', resize:'vertical' }}/>
            </div>
          )}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handleAdd} style={{ padding:'8px 16px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13 }}>Зберегти</button>
            <button onClick={()=>{setAdding(false);setForm({});}} style={{ padding:'8px 16px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:13 }}>Скасувати</button>
          </div>
        </div>
      )}

      {/* Items grid */}
      {loading ? <p style={{ color:'#94a3b8' }}>Завантаження...</p> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
          {filtered.map((item:any) => (
            <div key={item.id} style={{ border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden', background:'#fff', opacity:item.is_active?1:0.5 }}>
              {(item.image_url||item.thumbnail_url) && (
                <div style={{ height:90, background:'#f8f9fa', display:'flex', alignItems:'center', justifyContent:'center', padding:8 }}>
                  <img src={item.image_url||item.thumbnail_url} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} alt={item.name}/>
                </div>
              )}
              {!item.image_url && !item.thumbnail_url && (
                <div style={{ height:90, background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ fontSize:11, color:'#94a3b8' }}>Без зображення</span>
                </div>
              )}
              <div style={{ padding:'8px 10px' }}>
                <div style={{ fontWeight:700, fontSize:12, color:'#1e2d7d', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name_uk||item.name}</div>
                <div style={{ fontSize:10, color:'#94a3b8', marginBottom:8 }}>{item.category||''}</div>
                <div style={{ display:'flex', gap:4 }}>
                  <button onClick={()=>handleToggle(item.id, item.is_active)}
                    style={{ flex:1, padding:'4px', border:'1px solid #e2e8f0', borderRadius:5, background:item.is_active?'#f0fdf4':'#fff7f7', cursor:'pointer', fontSize:10, fontWeight:700, color:item.is_active?'#059669':'#ef4444' }}>
                    {item.is_active?'Вкл':'Вимк'}
                  </button>
                  <button onClick={()=>handleDelete(item.id)}
                    style={{ padding:'4px 8px', border:'1px solid #fee2e2', borderRadius:5, background:'#fff7f7', cursor:'pointer', color:'#ef4444' }}>
                    <Trash2 size={12}/>
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length===0 && <p style={{ color:'#94a3b8', gridColumn:'1/-1' }}>Нічого не знайдено</p>}
        </div>
      )}
    </div>
  );
}
