'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
    Mail, Send, Plus, Trash2, Eye, Copy, FileText,
    RefreshCw, CheckCircle, XCircle, Edit3, X, Save, AlertTriangle, Loader2
} from 'lucide-react';

interface Campaign {
    id: string; name: string; subject: string;
    body_html: string; from_name: string; from_email: string;
    status: 'draft'|'sending'|'sent'|'failed';
    segment: string; total_recipients: number;
    sent_count: number; failed_count: number;
    sent_at: string|null; created_at: string;
}
interface Template { id: string; name: string; subject: string; body: string; body_html: string|null; }
interface Subscriber { id: string; email: string; source: string; is_active: boolean; created_at: string; }
interface Stats { total: number; active: number; inactive: number; bySource: Record<string,number>; }

const SEGMENTS = [
    { value: 'all',             label: 'Всі активні' },
    { value: 'source_popup',    label: 'Popup' },
    { value: 'source_checkout', label: 'Checkout' },
    { value: 'source_manual',   label: 'Вручну' },
    { value: 'inactive',        label: 'Неактивні' },
];

const DEFAULT_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#1e2d7d;padding:28px 40px;text-align:center">
    <h1 style="margin:0;color:#ffffff;font-size:22px">Touch.Memories</h1>
  </td></tr>
  <tr><td style="padding:40px">
    <p style="margin:0 0 16px;font-size:16px;color:#1a202c">Привіт!</p>
    <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.7">
      Тут текст твого листа.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px">
      <tr><td style="background:#1e2d7d;border-radius:8px;padding:14px 32px">
        <a href="https://touchmemories1.vercel.app" style="color:#fff;text-decoration:none;font-size:15px;font-weight:600">Переглянути каталог →</a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:15px;color:#4a5568">З теплом,<br><strong>Touch.Memories</strong></p>
  </td></tr>
  <tr><td style="background:#f7f8fc;padding:20px 40px;text-align:center;border-top:1px solid #e8ecf0">
    <p style="margin:0;font-size:12px;color:#9ca3af">
      <a href="{{unsubscribe_url}}" style="color:#6b7280">Відписатись</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

const IS: React.CSSProperties = { width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, outline:'none', background:'#fff', boxSizing:'border-box' };
const TS: React.CSSProperties = { ...IS, resize:'vertical' as const, minHeight:120, fontFamily:'monospace', fontSize:12 };
const Btn = ({ onClick, children, color='#1e2d7d', outline=false, disabled=false, sm=false }: any) => (
    <button onClick={onClick} disabled={disabled} style={{
        display:'flex', alignItems:'center', gap:6,
        padding: sm ? '5px 10px' : '8px 16px',
        background: outline ? '#fff' : disabled ? '#e5e7eb' : color,
        color: outline ? color : disabled ? '#9ca3af' : '#fff',
        border: outline ? `1px solid ${color}` : 'none',
        borderRadius:8, cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: sm ? 12 : 13, fontWeight:600, flexShrink:0,
    }}>{children}</button>
);

function StatusBadge({ status }: { status: string }) {
    const m: Record<string,{bg:string;c:string;icon:React.ReactNode;l:string}> = {
        draft:   {bg:'#f3f4f6',c:'#6b7280',icon:<Edit3 size={10}/>,l:'Чернетка'},
        sending: {bg:'#fef3c7',c:'#d97706',icon:<Loader2 size={10} style={{animation:'spin 1s linear infinite'}}/>,l:'Надсилається'},
        sent:    {bg:'#d1fae5',c:'#059669',icon:<CheckCircle size={10}/>,l:'Надіслано'},
        failed:  {bg:'#fee2e2',c:'#dc2626',icon:<XCircle size={10}/>,l:'Помилка'},
    };
    const s = m[status]||m.draft;
    return <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',background:s.bg,color:s.c,borderRadius:20,fontSize:11,fontWeight:600}}>{s.icon} {s.l}</span>;
}

export default function EmailAdminPage() {
    const supabase = createClient();
    const [tab, setTab] = useState<'campaigns'|'templates'|'subscribers'|'stats'>('campaigns');
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [stats, setStats] = useState<Stats>({total:0,active:0,inactive:0,bySource:{}});
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Partial<Campaign>|null>(null);
    const [isNew, setIsNew] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sending, setSending] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [editTpl, setEditTpl] = useState<Partial<Template>|null>(null);
    const [isNewTpl, setIsNewTpl] = useState(false);

    useEffect(() => { loadAll(); }, []);

    async function loadAll() {
        setLoading(true);
        const [c,t,s] = await Promise.all([
            supabase.from('email_campaigns').select('*').order('created_at',{ascending:false}),
            supabase.from('message_templates').select('*').order('created_at',{ascending:false}),
            supabase.from('subscribers').select('*').order('created_at',{ascending:false}),
        ]);
        if(c.data) setCampaigns(c.data);
        if(t.data) setTemplates(t.data);
        if(s.data){
            setSubscribers(s.data);
            const active = s.data.filter((x:any) => x.is_active !== false).length;
            const bySource: Record<string,number> = {};
            s.data.forEach((x:any) => { const src = x.source||'manual'; bySource[src]=(bySource[src]||0)+1; });
            setStats({total:s.data.length, active, inactive:s.data.length-active, bySource});
        }
        setLoading(false);
    }

    function countSegment(seg: string) {
        if(seg==='inactive') return subscribers.filter(s=>s.is_active===false).length;
        const active = subscribers.filter(s=>s.is_active!==false);
        if(seg==='all'||seg==='active') return active.length;
        const src = seg.replace('source_','');
        return active.filter(s=>s.source===src).length;
    }

    async function saveCampaign() {
        if(!editing) return;
        if(!editing.name||!editing.subject||!editing.body_html){ toast.error('Заповніть назву, тему і тіло'); return; }
        setSaving(true);
        const payload = {
            name:editing.name, subject:editing.subject, body_html:editing.body_html,
            from_name:editing.from_name||'Touch.Memories',
            from_email:editing.from_email||'hello@touchmemories.ua',
            segment:editing.segment||'all', status:'draft' as const,
            updated_at:new Date().toISOString(),
        };
        if(isNew){
            const {data,error} = await supabase.from('email_campaigns').insert([payload]).select().single();
            if(error){ toast.error(error.message); setSaving(false); return; }
            setCampaigns(prev=>[data,...prev]); setEditing(data); setIsNew(false);
        } else {
            const {error} = await supabase.from('email_campaigns').update(payload).eq('id',editing.id!);
            if(error){ toast.error(error.message); setSaving(false); return; }
            setCampaigns(prev=>prev.map(c=>c.id===editing.id?{...c,...payload} as Campaign:c));
        }
        toast.success('Збережено ✓'); setSaving(false);
    }

    async function sendCampaign(id: string) {
        const c = campaigns.find(x=>x.id===id);
        const cnt = countSegment(c?.segment||'all');
        if(!confirm(`Надіслати "${c?.name}" для ${cnt} підписників?`)) return;
        setSending(true);
        try {
            const res = await fetch('/api/admin/send-campaign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({campaign_id:id})});
            const data = await res.json();
            if(!res.ok){ toast.error(data.error||'Помилка'); return; }
            toast.success(`✅ Надіслано ${data.sent}/${data.total} листів`);
            await loadAll();
        } finally { setSending(false); }
    }

    async function saveTemplate() {
        if(!editTpl?.name||!editTpl?.subject||!editTpl?.body){ toast.error('Заповніть всі поля'); return; }
        const p = {name:editTpl.name,subject:editTpl.subject,body:editTpl.body,body_html:editTpl.body,channel:'email',is_active:true};
        if(isNewTpl){
            const {data,error} = await supabase.from('message_templates').insert([p]).select().single();
            if(error){ toast.error(error.message); return; }
            setTemplates(prev=>[data,...prev]);
        } else {
            await supabase.from('message_templates').update(p).eq('id',editTpl.id!);
            setTemplates(prev=>prev.map(t=>t.id===editTpl.id?{...t,...p} as Template:t));
        }
        toast.success('Шаблон збережено'); setEditTpl(null);
    }

    const TABS = [{id:'campaigns',l:'📨 Кампанії',cnt:campaigns.length},{id:'templates',l:'📋 Шаблони',cnt:templates.length},{id:'subscribers',l:'👥 Підписники',cnt:stats.active},{id:'stats',l:'📊 Статистика',cnt:undefined}] as const;

    return (
        <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'#f8fafc'}}>

            {/* LEFT */}
            <div style={{width:editing?360:'100%',borderRight:editing?'1px solid #e5e7eb':'none',display:'flex',flexDirection:'column',overflow:'hidden'}}>
                <div style={{padding:'20px 20px 0',flexShrink:0}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                        <div>
                            <h1 style={{margin:0,fontSize:18,fontWeight:800,color:'#1e2d7d',display:'flex',alignItems:'center',gap:8}}><Mail size={18}/> Email Розсилка</h1>
                            <p style={{margin:'2px 0 0',fontSize:11,color:'#6b7280'}}>Brevo · {stats.active} активних</p>
                        </div>
                        <div style={{display:'flex',gap:6}}>
                            <Btn onClick={loadAll} outline color='#6b7280' sm><RefreshCw size={12}/></Btn>
                            {tab==='campaigns' && <Btn onClick={()=>{setEditing({name:'',subject:'',body_html:DEFAULT_HTML,from_name:'Touch.Memories',from_email:'hello@touchmemories.ua',segment:'all'});setIsNew(true);}}><Plus size={13}/> Нова</Btn>}
                            {tab==='templates' && <Btn onClick={()=>{setEditTpl({name:'',subject:'',body:DEFAULT_HTML});setIsNewTpl(true);}}><Plus size={13}/> Шаблон</Btn>}
                        </div>
                    </div>
                    <div style={{display:'flex',gap:2,borderBottom:'2px solid #e5e7eb'}}>
                        {TABS.map(t=>(
                            <button key={t.id} onClick={()=>setTab(t.id as any)} style={{padding:'7px 12px',background:'none',border:'none',cursor:'pointer',fontSize:12,fontWeight:tab===t.id?700:500,color:tab===t.id?'#1e2d7d':'#6b7280',borderBottom:tab===t.id?'2px solid #1e2d7d':'2px solid transparent',marginBottom:-2,display:'flex',alignItems:'center',gap:4}}>
                                {t.l} {t.cnt!==undefined && <span style={{background:tab===t.id?'#1e2d7d':'#e5e7eb',color:tab===t.id?'#fff':'#6b7280',borderRadius:10,padding:'1px 5px',fontSize:10}}>{t.cnt}</span>}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{flex:1,overflowY:'auto',padding:16}}>
                    {loading ? <div style={{textAlign:'center',padding:40,color:'#9ca3af'}}>Завантаження...</div> :

                    tab==='campaigns' ? (
                        <div style={{display:'flex',flexDirection:'column',gap:8}}>
                            {campaigns.length===0 && <div style={{textAlign:'center',padding:'48px 0',color:'#9ca3af'}}><Mail size={28} style={{margin:'0 auto 8px',display:'block',opacity:.3}}/><p style={{margin:0}}>Немає кампаній</p></div>}
                            {campaigns.map(camp=>(
                                <div key={camp.id} onClick={()=>{setEditing(camp);setIsNew(false);}} style={{padding:'12px 14px',background:editing?.id===camp.id?'#eff3ff':'#fff',border:`1px solid ${editing?.id===camp.id?'#c7d2fe':'#e5e7eb'}`,borderRadius:10,cursor:'pointer'}}>
                                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:6}}>
                                        <div style={{flex:1,minWidth:0}}>
                                            <div style={{fontWeight:700,fontSize:13,color:'#111',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginBottom:3}}>{camp.name}</div>
                                            <div style={{fontSize:11,color:'#6b7280',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginBottom:6}}>{camp.subject}</div>
                                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                                                <StatusBadge status={camp.status}/>
                                                {camp.status==='sent' && <span style={{fontSize:10,color:'#6b7280'}}>{camp.sent_count}/{camp.total_recipients}</span>}
                                            </div>
                                        </div>
                                        <button onClick={e=>{e.stopPropagation();if(confirm('Видалити?')){supabase.from('email_campaigns').delete().eq('id',camp.id).then(()=>{setCampaigns(p=>p.filter(c=>c.id!==camp.id));if(editing?.id===camp.id)setEditing(null);});toast.success('Видалено');}}} style={{background:'none',border:'none',cursor:'pointer',color:'#d1d5db',padding:4}} onMouseOver={e=>(e.currentTarget.style.color='#ef4444')} onMouseOut={e=>(e.currentTarget.style.color='#d1d5db')}><Trash2 size={13}/></button>
                                    </div>
                                    <div style={{fontSize:10,color:'#9ca3af',marginTop:5}}>{new Date(camp.created_at).toLocaleDateString('uk-UA')} · {SEGMENTS.find(s=>s.value===camp.segment)?.label}</div>
                                </div>
                            ))}
                        </div>

                    ) : tab==='templates' ? (
                        <div style={{display:'flex',flexDirection:'column',gap:8}}>
                            {templates.length===0 && <div style={{textAlign:'center',padding:'48px 0',color:'#9ca3af'}}><FileText size={28} style={{margin:'0 auto 8px',display:'block',opacity:.3}}/><p style={{margin:0}}>Немає шаблонів</p></div>}
                            {templates.map(tpl=>(
                                <div key={tpl.id} style={{padding:'12px 14px',background:'#fff',border:'1px solid #e5e7eb',borderRadius:10}}>
                                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                                        <div style={{flex:1,minWidth:0}}>
                                            <div style={{fontWeight:700,fontSize:13,color:'#111',marginBottom:2}}>{tpl.name}</div>
                                            <div style={{fontSize:11,color:'#6b7280',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{tpl.subject}</div>
                                        </div>
                                        <div style={{display:'flex',gap:5}}>
                                            <Btn sm color='#6b7280' onClick={()=>{setEditTpl(tpl);setIsNewTpl(false);}}><Edit3 size={11}/></Btn>
                                            <Btn sm onClick={()=>{if(editing){setEditing(p=>({...p,subject:tpl.subject,body_html:tpl.body_html||tpl.body}));toast.success('Застосовано');}else toast.info('Відкрий кампанію')}}><Copy size={11}/> Вставити</Btn>
                                            <button onClick={()=>{if(confirm('Видалити?')){supabase.from('message_templates').delete().eq('id',tpl.id).then(()=>setTemplates(p=>p.filter(t=>t.id!==tpl.id)));toast.success('Видалено');}}} style={{background:'none',border:'none',cursor:'pointer',color:'#d1d5db',padding:4}} onMouseOver={e=>(e.currentTarget.style.color='#ef4444')} onMouseOut={e=>(e.currentTarget.style.color='#d1d5db')}><Trash2 size={13}/></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                    ) : tab==='subscribers' ? (
                        <div>
                            <div style={{display:'flex',gap:8,marginBottom:14}}>
                                {[{l:'Всього',v:stats.total,c:'#1e2d7d'},{l:'Активних',v:stats.active,c:'#059669'},{l:'Відписались',v:stats.inactive,c:'#6b7280'}].map(s=>(
                                    <div key={s.l} style={{flex:1,background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:'10px 12px',textAlign:'center'}}>
                                        <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
                                        <div style={{fontSize:10,color:'#9ca3af',marginTop:1}}>{s.l}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{display:'flex',flexDirection:'column',gap:5}}>
                                {subscribers.map(sub=>(
                                    <div key={sub.id} style={{padding:'9px 12px',background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                        <div>
                                            <div style={{fontSize:12,fontWeight:600,color:'#111'}}>{sub.email}</div>
                                            <div style={{fontSize:10,color:'#9ca3af',marginTop:1}}>{sub.source||'manual'} · {new Date(sub.created_at).toLocaleDateString('uk-UA')}</div>
                                        </div>
                                        <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:sub.is_active!==false?'#d1fae5':'#f3f4f6',color:sub.is_active!==false?'#059669':'#6b7280',fontWeight:600}}>
                                            {sub.is_active!==false?'Актив.':'Відпис.'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    ) : (
                        <div style={{display:'flex',flexDirection:'column',gap:14}}>
                            <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:18}}>
                                <div style={{fontWeight:700,fontSize:14,marginBottom:12,color:'#1e2d7d'}}>📊 Кампанії</div>
                                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                                    {[
                                        {l:'Всього кампаній',v:campaigns.length},
                                        {l:'Надіслано',v:campaigns.filter(c=>c.status==='sent').length},
                                        {l:'Чернеток',v:campaigns.filter(c=>c.status==='draft').length},
                                        {l:'Листів всього',v:campaigns.reduce((s,c)=>s+(c.sent_count||0),0)},
                                    ].map(s=>(
                                        <div key={s.l} style={{background:'#f8fafc',borderRadius:8,padding:'12px 14px'}}>
                                            <div style={{fontSize:20,fontWeight:800,color:'#1e2d7d'}}>{s.v}</div>
                                            <div style={{fontSize:10,color:'#9ca3af',marginTop:1}}>{s.l}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:18}}>
                                <div style={{fontWeight:700,fontSize:14,marginBottom:12,color:'#1e2d7d'}}>👥 Джерела підписки</div>
                                {Object.entries(stats.bySource).map(([src,cnt])=>(
                                    <div key={src} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                                        <span style={{fontSize:12,color:'#374151'}}>{src}</span>
                                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                                            <div style={{width:80,height:5,background:'#f3f4f6',borderRadius:3,overflow:'hidden'}}>
                                                <div style={{width:`${((cnt as number)/stats.total)*100}%`,height:'100%',background:'#1e2d7d',borderRadius:3}}/>
                                            </div>
                                            <span style={{fontSize:12,fontWeight:700,color:'#1e2d7d',width:20,textAlign:'right'}}>{cnt}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:18}}>
                                <div style={{fontWeight:700,fontSize:14,marginBottom:12,color:'#1e2d7d'}}>📬 Надіслані кампанії</div>
                                {campaigns.filter(c=>c.status==='sent').slice(0,5).map(c=>(
                                    <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid #f3f4f6'}}>
                                        <div><div style={{fontSize:12,fontWeight:600}}>{c.name}</div><div style={{fontSize:10,color:'#9ca3af'}}>{c.sent_at?new Date(c.sent_at).toLocaleDateString('uk-UA'):'—'}</div></div>
                                        <div style={{textAlign:'right'}}><div style={{fontSize:13,fontWeight:800,color:'#059669'}}>{c.sent_count}</div><div style={{fontSize:10,color:'#9ca3af'}}>надіслано</div></div>
                                    </div>
                                ))}
                                {campaigns.filter(c=>c.status==='sent').length===0 && <p style={{color:'#9ca3af',fontSize:12,margin:0}}>Ще немає надісланих</p>}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: Campaign editor */}
            {editing && (
                <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'#fff'}}>
                    <div style={{padding:'14px 20px',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <div style={{fontWeight:800,fontSize:15,color:'#111'}}>{isNew?'Нова кампанія':editing.name||'Кампанія'}</div>
                            {!isNew && <StatusBadge status={editing.status||'draft'}/>}
                        </div>
                        <div style={{display:'flex',gap:7}}>
                            <Btn onClick={()=>setPreviewOpen(true)} outline color='#6b7280' sm><Eye size={12}/> Перегляд</Btn>
                            <Btn onClick={saveCampaign} disabled={saving} color='#059669'>
                                {saving?<Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>:<Save size={12}/>} Зберегти
                            </Btn>
                            {!isNew && editing.status!=='sent' && (
                                <Btn onClick={()=>sendCampaign(editing.id!)} disabled={sending} color='#1e2d7d'>
                                    {sending?<Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>:<Send size={12}/>}
                                    {sending?'Надсилається...':`Надіслати (${countSegment(editing.segment||'all')})`}
                                </Btn>
                            )}
                            {editing.status==='sent' && (
                                <div style={{padding:'8px 12px',background:'#d1fae5',color:'#059669',borderRadius:8,fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:5}}>
                                    <CheckCircle size={12}/> {editing.sent_count}/{editing.total_recipients} надіслано
                                </div>
                            )}
                            <button onClick={()=>setEditing(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af',padding:6}}><X size={16}/></button>
                        </div>
                    </div>

                    <div style={{flex:1,overflowY:'auto',padding:'18px 24px'}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                            <div>
                                <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:4}}>Назва кампанії *</label>
                                <input value={editing.name||''} onChange={e=>setEditing(p=>({...p,name:e.target.value}))} placeholder="напр. Квітнева знижка" style={IS}/>
                            </div>
                            <div>
                                <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:4}}>Тема листа *</label>
                                <input value={editing.subject||''} onChange={e=>setEditing(p=>({...p,subject:e.target.value}))} placeholder="🎁 Знижка 20% тільки сьогодні!" style={IS}/>
                            </div>
                            <div>
                                <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:4}}>Ім'я відправника</label>
                                <input value={editing.from_name||''} onChange={e=>setEditing(p=>({...p,from_name:e.target.value}))} style={IS}/>
                            </div>
                            <div>
                                <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:4}}>Email відправника</label>
                                <input value={editing.from_email||''} onChange={e=>setEditing(p=>({...p,from_email:e.target.value}))} style={IS}/>
                            </div>
                        </div>

                        <div style={{marginBottom:14}}>
                            <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:6}}>Сегмент отримувачів</label>
                            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                                {SEGMENTS.map(seg=>{
                                    const cnt = countSegment(seg.value);
                                    const sel = (editing.segment||'all')===seg.value;
                                    return (
                                        <button key={seg.value} onClick={()=>setEditing(p=>({...p,segment:seg.value}))}
                                            style={{padding:'6px 12px',border:`1px solid ${sel?'#1e2d7d':'#e5e7eb'}`,background:sel?'#eff3ff':'#fff',color:sel?'#1e2d7d':'#6b7280',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:sel?700:500,display:'flex',alignItems:'center',gap:5}}>
                                            {seg.label}
                                            <span style={{background:sel?'#1e2d7d':'#f3f4f6',color:sel?'#fff':'#6b7280',borderRadius:10,padding:'1px 6px',fontSize:10,fontWeight:700}}>{cnt}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {templates.length>0 && (
                            <div style={{marginBottom:14,padding:'10px 12px',background:'#f8fafc',borderRadius:8,border:'1px solid #e5e7eb'}}>
                                <div style={{fontSize:11,fontWeight:700,color:'#374151',marginBottom:6}}>📋 Вставити шаблон:</div>
                                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                                    {templates.map(t=>(
                                        <button key={t.id} onClick={()=>{setEditing(p=>({...p,subject:t.subject,body_html:t.body_html||t.body}));toast.success(`"${t.name}" застосовано`);}} style={{padding:'4px 10px',background:'#fff',border:'1px solid #d1d5db',borderRadius:6,cursor:'pointer',fontSize:11,color:'#374151'}}>{t.name}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5}}>
                                <label style={{fontSize:12,fontWeight:700,color:'#374151'}}>HTML тіло листа *</label>
                                <span style={{fontSize:10,color:'#9ca3af'}}>Змінні: {'{{email}}'} {'{{unsubscribe_url}}'}</span>
                            </div>
                            <textarea value={editing.body_html||''} onChange={e=>setEditing(p=>({...p,body_html:e.target.value}))} style={{...TS,minHeight:340}} placeholder="HTML код листа..."/>
                        </div>

                        <div style={{marginTop:14,padding:'12px 14px',background:'#fef3c7',border:'1px solid #fde68a',borderRadius:8,display:'flex',gap:8}}>
                            <AlertTriangle size={15} style={{color:'#d97706',flexShrink:0,marginTop:1}}/>
                            <div style={{fontSize:12,color:'#92400e'}}>
                                <strong>Потрібен Brevo API Key</strong> — Vercel → Settings → Environment Variables → додай <code style={{background:'rgba(0,0,0,.08)',padding:'1px 4px',borderRadius:3}}>BREVO_API_KEY</code>.
                                Безкоштовно 300 листів/день на <a href="https://brevo.com" target="_blank" style={{color:'#1e2d7d',fontWeight:600}}>brevo.com</a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Template modal */}
            {editTpl && (
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
                    <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:680,maxHeight:'90vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
                        <div style={{padding:'16px 20px',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <h2 style={{margin:0,fontSize:15,fontWeight:800}}>{isNewTpl?'Новий шаблон':'Редагувати шаблон'}</h2>
                            <button onClick={()=>setEditTpl(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af'}}><X size={18}/></button>
                        </div>
                        <div style={{flex:1,overflowY:'auto',padding:20}}>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                                <div>
                                    <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:4}}>Назва *</label>
                                    <input value={editTpl.name||''} onChange={e=>setEditTpl(p=>({...p,name:e.target.value}))} placeholder="напр. Акційний лист" style={IS}/>
                                </div>
                                <div>
                                    <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:4}}>Тема *</label>
                                    <input value={editTpl.subject||''} onChange={e=>setEditTpl(p=>({...p,subject:e.target.value}))} placeholder="Тема листа" style={IS}/>
                                </div>
                            </div>
                            <div>
                                <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:4}}>HTML *</label>
                                <textarea value={editTpl.body||''} onChange={e=>setEditTpl(p=>({...p,body:e.target.value}))} style={{...TS,minHeight:280}}/>
                            </div>
                        </div>
                        <div style={{padding:'14px 20px',borderTop:'1px solid #e5e7eb',display:'flex',justifyContent:'flex-end',gap:8}}>
                            <Btn outline color='#6b7280' onClick={()=>setEditTpl(null)}>Скасувати</Btn>
                            <Btn onClick={saveTemplate}><Save size={13}/> Зберегти</Btn>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview modal */}
            {previewOpen && editing?.body_html && (
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
                    <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:660,maxHeight:'90vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
                        <div style={{padding:'14px 20px',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <div style={{fontWeight:700,fontSize:14}}>👁 {editing.subject}</div>
                            <button onClick={()=>setPreviewOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af'}}><X size={18}/></button>
                        </div>
                        <div style={{flex:1,overflow:'auto'}}>
                            <iframe srcDoc={editing.body_html.replace('{{unsubscribe_url}}','#').replace('{{email}}','example@email.com')} style={{width:'100%',minHeight:500,border:'none'}} title="Preview"/>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
