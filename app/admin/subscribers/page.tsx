'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
    Download, Mail, Search, RefreshCw, Send, ChevronDown, ChevronUp,
    Users, CheckCircle, XCircle, Eye, X, Loader2, History
} from 'lucide-react';

interface Subscriber {
    id: string; email: string; is_active: boolean;
    subscribed_at: string; source: string | null; promo_code: string | null;
}
interface Campaign {
    id: string; subject: string; status: string;
    recipients_count: number; sent_count: number; failed_count: number;
    sent_at: string | null; created_at: string;
}

const S = { width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' as const };

export default function SubscribersPage() {
    const supabase = createClient();
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [filtered, setFiltered] = useState<Subscriber[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
    const [showCampaign, setShowCampaign] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [sending, setSending] = useState(false);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [subject, setSubject] = useState('');
    const [bodyText, setBodyText] = useState('');
    const [target, setTarget] = useState<'all' | 'active'>('active');

    useEffect(() => { fetchSubscribers(); }, []);

    useEffect(() => {
        let result = [...subscribers];
        if (filterActive === 'active') result = result.filter(s => s.is_active);
        if (filterActive === 'inactive') result = result.filter(s => !s.is_active);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(s =>
                s.email.toLowerCase().includes(q) ||
                s.source?.toLowerCase().includes(q) ||
                s.promo_code?.toLowerCase().includes(q)
            );
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
        const res = await fetch('/api/admin/send-campaign');
        if (res.ok) { const d = await res.json(); setCampaigns(d.campaigns || []); }
    }

    function textToHtml(text: string): string {
        return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a1a2e;background:#fff}p{line-height:1.7;margin:0 0 16px;color:#374151}.footer{margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af}a{color:#1e2d7d}</style></head><body>${text.split('\n\n').map(p => p.trim() ? `<p>${p.replace(/\n/g, '<br>')}</p>` : '').join('')}<div class="footer"><p>З любов'ю, команда <strong>Touch.Memories</strong> 💙<br>Ви отримали цей лист, бо підписалися на розсилку. <a href="#">Відписатися</a></p></div></body></html>`;
    }

    async function sendCampaign() {
        if (!subject.trim()) { toast.error('Введіть тему листа'); return; }
        if (!bodyText.trim()) { toast.error('Введіть текст листа'); return; }
        const recipientCount = target === 'active' ? subscribers.filter(s => s.is_active).length : subscribers.length;
        if (recipientCount === 0) { toast.error('Немає підписників'); return; }
        if (!confirm(`Надіслати "${subject}" для ${recipientCount} підписників?`)) return;
        setSending(true);
        try {
            const res = await fetch('/api/admin/send-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject, body_html: textToHtml(bodyText), body_text: bodyText, target }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error || 'Помилка відправки'); return; }
            if (data.demo) {
                toast.success(`✅ Демо-режим: ${data.sent} листів (RESEND_API_KEY не налаштовано)`);
            } else {
                toast.success(`✅ Надіслано ${data.sent} листів${data.failed ? `, помилок: ${data.failed}` : ''}`);
            }
            setSubject(''); setBodyText(''); setShowCampaign(false); fetchCampaigns();
        } catch (e: any) {
            toast.error(e.message);
        } finally { setSending(false); }
    }

    function exportCSV() {
        const rows = filtered.map(s => [s.email, s.source || '', s.promo_code || '',
            s.subscribed_at ? new Date(s.subscribed_at).toLocaleString('uk-UA') : '', s.is_active ? 'Так' : 'Ні']);
        const csv = [['Email','Джерело','Промокод','Дата підписки','Активний'].join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `subscribers_${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url);
    }

    const activeCount = subscribers.filter(s => s.is_active).length;
    const inactiveCount = subscribers.filter(s => !s.is_active).length;
    const recipientCount = target === 'active' ? activeCount : subscribers.length;

    return (
        <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto' }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}`}</style>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div>
                    <h1 style={{ fontSize:26, fontWeight:800, color:'#1e2d7d', display:'flex', alignItems:'center', gap:10, margin:0 }}>
                        <Mail size={26}/> Підписники
                    </h1>
                    <p style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>
                        Всього: {subscribers.length} | Активних: {activeCount} | Неактивних: {inactiveCount}
                    </p>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                    <button onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchCampaigns(); }}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, color:'#374151' }}>
                        <History size={15}/> Історія
                    </button>
                    <button onClick={fetchSubscribers}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, color:'#374151' }}>
                        <RefreshCw size={15}/> Оновити
                    </button>
                    <button onClick={exportCSV}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', border:'none', borderRadius:8, background:'#374151', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                        <Download size={15}/> CSV
                    </button>
                    <button onClick={() => setShowCampaign(!showCampaign)}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', border:'none', borderRadius:8, background:'#1e2d7d', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                        <Send size={15}/> Розсилка
                        {showCampaign ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </button>
                </div>
            </div>

            {/* Campaign Panel */}
            {showCampaign && (
                <div style={{ background:'#f8f9ff', border:'1.5px solid #c7d2fe', borderRadius:12, padding:24, margin:'20px 0' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                        <div>
                            <div style={{ fontWeight:800, fontSize:16, color:'#1e2d7d' }}>✉️ Нова розсилка</div>
                            <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Листи надсилаються через Resend API</div>
                        </div>
                        <button onClick={() => setShowCampaign(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}><X size={18}/></button>
                    </div>

                    {/* Recipients */}
                    <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center' }}>
                        {(['active','all'] as const).map(t => (
                            <button key={t} onClick={() => setTarget(t)}
                                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600,
                                    background:target===t?'#1e2d7d':'#fff', color:target===t?'#fff':'#374151', border:target===t?'1.5px solid #1e2d7d':'1.5px solid #d1d5db' }}>
                                <Users size={13}/>
                                {t==='active' ? `Активні (${activeCount})` : `Всі (${subscribers.length})`}
                            </button>
                        ))}
                        <div style={{ marginLeft:'auto', fontSize:13, color:'#6b7280', display:'flex', alignItems:'center', gap:5 }}>
                            <Users size={13}/> Отримувачів: <strong style={{ color:'#1e2d7d' }}>{recipientCount}</strong>
                        </div>
                    </div>

                    {/* Subject */}
                    <div style={{ marginBottom:14 }}>
                        <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:6, textTransform:'uppercase', letterSpacing:'.5px' }}>Тема листа *</label>
                        <input value={subject} onChange={e => setSubject(e.target.value)}
                            placeholder="Наприклад: 🎁 Знижка 15% на фотокниги цього тижня"
                            style={{ ...S, fontSize:15, fontWeight:500 }}/>
                    </div>

                    {/* Body */}
                    <div style={{ marginBottom:16 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                            <label style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'.5px' }}>Текст листа *</label>
                            <button onClick={() => setShowPreview(!showPreview)}
                                style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#1e2d7d', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                                <Eye size={13}/> {showPreview ? 'Сховати preview' : 'Показати preview'}
                            </button>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:showPreview?'1fr 1fr':'1fr', gap:12 }}>
                            <textarea value={bodyText} onChange={e => setBodyText(e.target.value)}
                                placeholder={`Привіт!\n\nПишіть текст листа тут. Кожен подвійний Enter — новий абзац.\n\nЗ любов'ю,\nКоманда Touch.Memories`}
                                style={{ ...S, minHeight:200, resize:'vertical', fontFamily:'monospace', fontSize:13, lineHeight:1.6 }}/>
                            {showPreview && (
                                <div style={{ border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden', background:'#fff' }}>
                                    <div style={{ background:'#f3f4f6', padding:'7px 14px', fontSize:11, fontWeight:600, color:'#6b7280', borderBottom:'1px solid #e5e7eb' }}>PREVIEW</div>
                                    <iframe srcDoc={bodyText ? textToHtml(bodyText) : '<p style="color:#9ca3af;padding:20px;font-family:sans-serif">Почніть вводити текст...</p>'}
                                        style={{ width:'100%', height:200, border:'none' }} title="preview"/>
                                </div>
                            )}
                        </div>
                        <div style={{ fontSize:11, color:'#9ca3af', marginTop:5 }}>💡 Подвійний Enter = новий абзац. Текст автоматично конвертується в HTML.</div>
                    </div>

                    {/* Actions */}
                    <div style={{ display:'flex', justifyContent:'flex-end', gap:10, paddingTop:16, borderTop:'1px solid #e5e7eb' }}>
                        <button onClick={() => setShowCampaign(false)}
                            style={{ padding:'10px 20px', borderRadius:8, border:'1px solid #d1d5db', background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, color:'#374151' }}>
                            Скасувати
                        </button>
                        <button onClick={sendCampaign} disabled={sending || !subject.trim() || !bodyText.trim()}
                            style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 24px', borderRadius:8, border:'none',
                                background:sending||!subject.trim()||!bodyText.trim()?'#d1d5db':'#1e2d7d',
                                color:'#fff', cursor:sending?'wait':'pointer', fontSize:13, fontWeight:700 }}>
                            {sending ? <Loader2 size={15} className="spin"/> : <Send size={15}/>}
                            {sending ? 'Надсилаємо...' : `Надіслати ${recipientCount} підписникам`}
                        </button>
                    </div>
                </div>
            )}

            {/* History */}
            {showHistory && (
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, marginBottom:20 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid #e5e7eb' }}>
                        <div style={{ fontWeight:700, color:'#1e2d7d' }}>📋 Історія розсилок</div>
                        <button onClick={() => setShowHistory(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}><X size={16}/></button>
                    </div>
                    {campaigns.length === 0 ? (
                        <div style={{ padding:24, textAlign:'center', color:'#9ca3af', fontSize:13 }}>Ще немає розсилок</div>
                    ) : campaigns.map(c => (
                        <div key={c.id} style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto', alignItems:'center', gap:16, padding:'12px 20px', borderBottom:'1px solid #f3f4f6' }}>
                            <div>
                                <div style={{ fontWeight:600, fontSize:14 }}>{c.subject}</div>
                                <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
                                    {c.created_at ? new Date(c.created_at).toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'}
                                </div>
                            </div>
                            <div style={{ fontSize:12, color:'#6b7280', display:'flex', alignItems:'center', gap:4 }}><Users size={12}/> {c.recipients_count}</div>
                            <div style={{ fontSize:12, color:'#10b981', display:'flex', alignItems:'center', gap:4 }}><CheckCircle size={12}/> {c.sent_count}</div>
                            <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                                background:c.status==='sent'?'#dcfce7':c.status==='failed'?'#fee2e2':'#fef9c3',
                                color:c.status==='sent'?'#16a34a':c.status==='failed'?'#dc2626':'#ca8a04' }}>
                                {c.status==='sent'?'Надіслано':c.status==='failed'?'Помилка':'В процесі'}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
                <div style={{ position:'relative', flex:1, minWidth:240 }}>
                    <Search size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}/>
                    <input type="text" placeholder="Пошук за email, джерелом або промокодом..." value={search}
                        onChange={e => setSearch(e.target.value)} style={{ ...S, paddingLeft:38 }}/>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                    {(['all','active','inactive'] as const).map(f => (
                        <button key={f} onClick={() => setFilterActive(f)}
                            style={{ padding:'8px 16px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer',
                                background:filterActive===f?'#1e2d7d':'#fff', color:filterActive===f?'#fff':'#374151',
                                border:filterActive===f?'1px solid #1e2d7d':'1px solid #d1d5db' }}>
                            {f==='all'?`Всі (${subscribers.length})`:f==='active'?`Активні (${activeCount})`:`Неактивні (${inactiveCount})`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div style={{ display:'flex', justifyContent:'center', padding:48 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', border:'3px solid #e5e7eb', borderTopColor:'#1e2d7d' }} className="spin"/>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign:'center', padding:48, color:'#9ca3af' }}>
                    {search ? `Нічого не знайдено за "${search}"` : 'Немає підписників'}
                </div>
            ) : (
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
                    <table style={{ width:'100%', fontSize:13, borderCollapse:'collapse' }}>
                        <thead>
                            <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                                {['Email','Джерело','Промокод','Дата підписки','Статус'].map(h => (
                                    <th key={h} style={{ textAlign:h==='Статус'?'center':'left', padding:'10px 16px', fontWeight:700, color:'#374151', whiteSpace:'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(sub => (
                                <tr key={sub.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                                    <td style={{ padding:'11px 16px', fontWeight:600, color:'#111' }}>{sub.email}</td>
                                    <td style={{ padding:'11px 16px', color:'#6b7280' }}>{sub.source || '—'}</td>
                                    <td style={{ padding:'11px 16px' }}>
                                        {sub.promo_code ? (
                                            <span style={{ background:'#f3e8ff', color:'#7c3aed', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{sub.promo_code}</span>
                                        ) : '—'}
                                    </td>
                                    <td style={{ padding:'11px 16px', color:'#6b7280' }}>
                                        {sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'}
                                    </td>
                                    <td style={{ padding:'11px 16px', textAlign:'center' }}>
                                        <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                                            background:sub.is_active?'#dcfce7':'#fee2e2', color:sub.is_active?'#16a34a':'#dc2626' }}>
                                            {sub.is_active ? 'Активний' : 'Неактивний'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ padding:'10px 16px', background:'#f9fafb', borderTop:'1px solid #e5e7eb', fontSize:12, color:'#9ca3af' }}>
                        Показано {filtered.length} з {subscribers.length} підписників
                    </div>
                </div>
            )}
        </div>
    );
}
