'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Download, Mail, Search, RefreshCw, Send, X, ChevronDown, CheckCircle, Clock, AlertCircle, Users, FileText, History } from 'lucide-react';

interface Subscriber {
    id: string; email: string; is_active: boolean;
    subscribed_at: string; segments: string[] | null;
    source: string | null; promo_code: string | null;
}
interface Campaign {
    id: string; subject: string; segment: string; status: string;
    sent_count: number; failed_count: number; recipients_count: number;
    created_at: string; sent_at: string | null;
}

const TEMPLATES = [
    { id: 't1', name: '🎁 Акція / знижка', subject: '🎁 Спеціальна пропозиція від Touch.Memories',
      body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a"><h2 style="color:#1e2d7d">Привіт! 👋</h2><p>У нас для тебе особлива пропозиція:</p><div style="background:#f0f3ff;border-left:4px solid #1e2d7d;padding:16px;border-radius:8px;margin:16px 0"><strong>🔥 Знижка 20% на всі фотокниги до кінця тижня!</strong></div><p>Скористайся промокодом: <strong style="color:#1e2d7d">MEMORIES20</strong></p><a href="https://touchmemories1.vercel.app/catalog" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1e2d7d;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Перейти до каталогу →</a></div>` },
    { id: 't2', name: '📸 Новий продукт', subject: '✨ Новинка в Touch.Memories!',
      body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a"><h2 style="color:#1e2d7d">Новинка вже тут! ✨</h2><p>Ми додали новий продукт, який тебе точно здивує.</p><p><strong>[Назва продукту]</strong> — [короткий опис]</p><a href="https://touchmemories1.vercel.app/catalog" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1e2d7d;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Дізнатись більше →</a></div>` },
    { id: 't3', name: '💌 Просто привітання', subject: '💌 Touch.Memories вітає тебе!',
      body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a"><h2 style="color:#1e2d7d">Привіт від Touch.Memories! 💙</h2><p>Дякуємо, що ти з нами. Ми постійно вдосконалюємо наш сервіс і раді бачити тебе серед наших підписників.</p><p>Якщо маєш питання або побажання — просто відповідай на цей лист 🙂</p></div>` },
];

const statusColor = (s: string) => s === 'sent' ? '#16a34a' : s === 'sending' ? '#d97706' : s === 'failed' ? '#dc2626' : '#6b7280';
const statusLabel = (s: string) => s === 'sent' ? 'Надіслано' : s === 'sending' ? 'Надсилається' : s === 'failed' ? 'Помилка' : 'Чернетка';

export default function SubscribersPage() {
    const supabase = createClient();
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [filtered, setFiltered] = useState<Subscriber[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

    const [showCompose, setShowCompose] = useState(false);
    const [subject, setSubject] = useState('');
    const [bodyHtml, setBodyHtml] = useState('');
    const [segment, setSegment] = useState('all');
    const [sending, setSending] = useState(false);
    const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(false);

    useEffect(() => { fetchSubscribers(); }, []);

    useEffect(() => {
        let result = [...subscribers];
        if (filterActive === 'active') result = result.filter(s => s.is_active);
        if (filterActive === 'inactive') result = result.filter(s => !s.is_active);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(s => s.email.toLowerCase().includes(q) || s.source?.toLowerCase().includes(q) || s.promo_code?.toLowerCase().includes(q));
        }
        setFiltered(result);
    }, [subscribers, search, filterActive]);

    async function fetchSubscribers() {
        setLoading(true);
        const { data } = await supabase.from('subscribers').select('*').order('subscribed_at', { ascending: false });
        setSubscribers(data || []);
        setLoading(false);
    }

    async function fetchCampaigns() {
        setLoadingCampaigns(true);
        try {
            const res = await fetch('/api/admin/send-newsletter');
            const json = await res.json();
            setCampaigns(json.campaigns || []);
        } catch { /* ignore */ }
        setLoadingCampaigns(false);
    }

    async function sendCampaign() {
        if (!subject.trim()) { toast.error('Введи тему листа'); return; }
        if (!bodyHtml.trim()) { toast.error('Введи текст листа'); return; }
        if (!confirm(`Надіслати "${subject}" для ${recipientCount} підписників?`)) return;
        setSending(true);
        try {
            const res = await fetch('/api/admin/send-newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject, body_html: bodyHtml, segment }),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.error || 'Помилка'); return; }
            toast.success(`✅ Надіслано ${json.sent} з ${json.total}${json.failed > 0 ? `, помилок: ${json.failed}` : ''}`);
            setSubject(''); setBodyHtml('');
            setActiveTab('history'); fetchCampaigns();
        } catch (e: any) { toast.error(e.message); }
        finally { setSending(false); }
    }

    function exportCSV() {
        const csv = [['Email','Джерело','Промокод','Дата','Активний'].join(','),
            ...filtered.map(s => [s.email,s.source||'',s.promo_code||'',
                s.subscribed_at?new Date(s.subscribed_at).toLocaleString('uk-UA'):'',
                s.is_active?'Так':'Ні'].map(v=>`"${v}"`).join(','))].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
        a.download = `subscribers_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    }

    const activeCount = subscribers.filter(s => s.is_active).length;
    const inactiveCount = subscribers.filter(s => !s.is_active).length;
    const sources = [...new Set(subscribers.map(s => s.source).filter(Boolean))] as string[];
    const recipientCount = subscribers.filter(s => s.is_active && (segment === 'all' || s.source === segment)).length;

    const S = { input: { width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' as const } };

    return (
        <div style={{ display:'flex', height:'100%', minHeight:'100vh', background:'#f8fafc' }}>
            {/* LEFT — subscriber list */}
            <div style={{ flex:1, padding:24, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                    <div>
                        <h1 style={{ fontSize:22, fontWeight:800, color:'#1e2d7d', display:'flex', alignItems:'center', gap:8 }}>
                            <Mail size={22}/> Підписники
                        </h1>
                        <p style={{ color:'#6b7280', fontSize:13, marginTop:3 }}>Всього: {subscribers.length} | Активних: {activeCount} | Неактивних: {inactiveCount}</p>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                        <button onClick={fetchSubscribers} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:13, cursor:'pointer' }}>
                            <RefreshCw size={14}/> Оновити
                        </button>
                        <button onClick={exportCSV} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', border:'none', borderRadius:8, background:'#f0f3ff', color:'#1e2d7d', fontSize:13, cursor:'pointer', fontWeight:600 }}>
                            <Download size={14}/> CSV
                        </button>
                        <button onClick={() => { setShowCompose(true); }}
                            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', border:'none', borderRadius:8, background:'#1e2d7d', color:'#fff', fontSize:13, cursor:'pointer', fontWeight:700 }}>
                            <Send size={14}/> Розсилка
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                    <div style={{ position:'relative', flex:1, minWidth:200 }}>
                        <Search size={15} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}/>
                        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Пошук за email, джерелом або промокодом..."
                            style={{ ...S.input, paddingLeft:34 }}/>
                    </div>
                    {(['all','active','inactive'] as const).map(f=>(
                        <button key={f} onClick={()=>setFilterActive(f)}
                            style={{ padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', border: filterActive===f?'none':'1px solid #d1d5db', background:filterActive===f?'#1e2d7d':'#fff', color:filterActive===f?'#fff':'#374151' }}>
                            {f==='all'?`Всі (${subscribers.length})`:f==='active'?`Активні (${activeCount})`:`Неактивні (${inactiveCount})`}
                        </button>
                    ))}
                </div>

                {/* Table */}
                {loading ? (
                    <div style={{ display:'flex', justifyContent:'center', padding:48 }}>
                        <div style={{ width:32, height:32, borderRadius:'50%', border:'3px solid #e5e7eb', borderTopColor:'#1e2d7d', animation:'spin .8s linear infinite' }}/>
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    </div>
                ) : (
                    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                            <thead>
                                <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                                    {['Email','Джерело','Промокод','Дата підписки','Статус'].map(h=>(
                                        <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:12 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length===0?(
                                    <tr><td colSpan={5} style={{ padding:32, textAlign:'center', color:'#9ca3af' }}>
                                        {search?`Нічого не знайдено за "${search}"`:'Немає підписників'}
                                    </td></tr>
                                ):filtered.map(sub=>(
                                    <tr key={sub.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                                        <td style={{ padding:'10px 14px', fontWeight:600, color:'#111827' }}>{sub.email}</td>
                                        <td style={{ padding:'10px 14px', color:'#6b7280' }}>{sub.source||'—'}</td>
                                        <td style={{ padding:'10px 14px' }}>
                                            {sub.promo_code?<span style={{ background:'#f3e8ff', color:'#7c3aed', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700 }}>{sub.promo_code}</span>:'—'}
                                        </td>
                                        <td style={{ padding:'10px 14px', color:'#6b7280' }}>
                                            {sub.subscribed_at?new Date(sub.subscribed_at).toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}
                                        </td>
                                        <td style={{ padding:'10px 14px', textAlign:'center' }}>
                                            <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:sub.is_active?'#dcfce7':'#fee2e2', color:sub.is_active?'#16a34a':'#dc2626' }}>
                                                {sub.is_active?'Активний':'Неактивний'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ padding:'10px 14px', background:'#f9fafb', borderTop:'1px solid #e5e7eb', fontSize:12, color:'#6b7280' }}>
                            Показано {filtered.length} з {subscribers.length} підписників
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT — compose panel */}
            {showCompose && (
                <div style={{ width:480, borderLeft:'1px solid #e5e7eb', background:'#fff', display:'flex', flexDirection:'column', flexShrink:0 }}>
                    <div style={{ padding:'14px 18px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', gap:0, background:'#f3f4f6', borderRadius:8, padding:3 }}>
                            {[{id:'compose',icon:<Send size={12}/>,label:'Розсилка'},{id:'history',icon:<History size={12}/>,label:'Історія'}].map(t=>(
                                <button key={t.id} onClick={()=>{setActiveTab(t.id as any); if(t.id==='history') fetchCampaigns();}}
                                    style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background:activeTab===t.id?'#fff':'transparent', color:activeTab===t.id?'#1e2d7d':'#6b7280', boxShadow:activeTab===t.id?'0 1px 3px rgba(0,0,0,.1)':'none' }}>
                                    {t.icon}{t.label}
                                </button>
                            ))}
                        </div>
                        <button onClick={()=>setShowCompose(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280' }}>
                            <X size={18}/>
                        </button>
                    </div>

                    {activeTab==='compose'?(
                        <div style={{ flex:1, overflowY:'auto', padding:18, display:'flex', flexDirection:'column', gap:14 }}>
                            {/* Segment */}
                            <div>
                                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>
                                    <Users size={11} style={{ display:'inline', marginRight:3 }}/>Аудиторія
                                </label>
                                <div style={{ position:'relative' }}>
                                    <select value={segment} onChange={e=>setSegment(e.target.value)}
                                        style={{ width:'100%', padding:'9px 32px 9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, appearance:'none', outline:'none', cursor:'pointer', background:'#fff' }}>
                                        <option value="all">Всі активні ({activeCount})</option>
                                        {sources.map(s=><option key={s} value={s}>{s} ({subscribers.filter(sub=>sub.is_active&&sub.source===s).length})</option>)}
                                    </select>
                                    <ChevronDown size={13} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', pointerEvents:'none' }}/>
                                </div>
                                <p style={{ fontSize:11, color:'#6b7280', marginTop:3 }}>Отримувачів: <strong style={{ color:'#1e2d7d' }}>{recipientCount}</strong></p>
                            </div>

                            {/* Templates */}
                            <div>
                                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>
                                    <FileText size={11} style={{ display:'inline', marginRight:3 }}/>Шаблони
                                </label>
                                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                                    {TEMPLATES.map(t=>(
                                        <button key={t.id} onClick={()=>{setSubject(t.subject);setBodyHtml(t.body);}}
                                            style={{ padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8, background:'#f9fafb', cursor:'pointer', textAlign:'left', fontSize:12, color:'#374151', fontWeight:500 }}>
                                            {t.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Subject */}
                            <div>
                                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>Тема <span style={{ color:'#ef4444' }}>*</span></label>
                                <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Введи тему листа..." style={S.input}/>
                                <p style={{ fontSize:11, color:subject.length>70?'#ef4444':'#9ca3af', marginTop:2 }}>{subject.length}/70</p>
                            </div>

                            {/* Body */}
                            <div>
                                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>Текст (HTML) <span style={{ color:'#ef4444' }}>*</span></label>
                                <textarea value={bodyHtml} onChange={e=>setBodyHtml(e.target.value)} placeholder="<p>Текст листа...</p>"
                                    style={{ width:'100%', minHeight:160, padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:12, outline:'none', resize:'vertical', fontFamily:'monospace', boxSizing:'border-box' }}/>
                            </div>

                            {/* Preview */}
                            {bodyHtml&&(
                                <div>
                                    <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>Попередній перегляд</label>
                                    <div style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:14, background:'#fafafa', maxHeight:160, overflowY:'auto', fontSize:13 }}
                                        dangerouslySetInnerHTML={{__html:bodyHtml}}/>
                                </div>
                            )}

                            {/* Send */}
                            <button onClick={sendCampaign} disabled={sending||recipientCount===0}
                                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px 20px', background:sending||recipientCount===0?'#9ca3af':'#1e2d7d', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:sending||recipientCount===0?'not-allowed':'pointer' }}>
                                {sending?<><div style={{ width:15,height:15,borderRadius:'50%',border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',animation:'spin .8s linear infinite' }}/>Надсилаємо...</>
                                    :<><Send size={14}/>Надіслати ({recipientCount})</>}
                            </button>
                            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                        </div>
                    ):(
                        /* History */
                        <div style={{ flex:1, overflowY:'auto', padding:18 }}>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                                <h3 style={{ fontSize:14, fontWeight:700, color:'#1e2d7d', margin:0 }}>Останні розсилки</h3>
                                <button onClick={fetchCampaigns} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280' }}><RefreshCw size={14}/></button>
                            </div>
                            {loadingCampaigns?(
                                <div style={{ display:'flex', justifyContent:'center', padding:32 }}>
                                    <div style={{ width:24, height:24, borderRadius:'50%', border:'2px solid #e5e7eb', borderTopColor:'#1e2d7d', animation:'spin .8s linear infinite' }}/>
                                </div>
                            ):campaigns.length===0?(
                                <div style={{ textAlign:'center', padding:32, color:'#9ca3af', fontSize:13 }}>Розсилок ще не було</div>
                            ):campaigns.map(c=>(
                                <div key={c.id} style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:12, marginBottom:8 }}>
                                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
                                        <div style={{ flex:1, minWidth:0 }}>
                                            <div style={{ fontWeight:600, fontSize:13, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.subject}</div>
                                            <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>
                                                {c.sent_at?new Date(c.sent_at).toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}
                                                {' · '}{c.segment==='all'?'Всі підписники':c.segment}
                                            </div>
                                        </div>
                                        <span style={{ fontSize:11, fontWeight:700, color:statusColor(c.status), flexShrink:0 }}>{statusLabel(c.status)}</span>
                                    </div>
                                    {(c.sent_count>0||c.failed_count>0)&&(
                                        <div style={{ display:'flex', gap:10, marginTop:7 }}>
                                            <span style={{ fontSize:11, color:'#16a34a', fontWeight:600 }}>✓ {c.sent_count}</span>
                                            {c.failed_count>0&&<span style={{ fontSize:11, color:'#dc2626', fontWeight:600 }}>✗ {c.failed_count}</span>}
                                            <span style={{ fontSize:11, color:'#9ca3af' }}>з {c.recipients_count}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
