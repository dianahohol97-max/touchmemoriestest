'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
    Target, RefreshCw, Mail, Phone, Globe, MapPin, Send, Plus, X,
    Loader2, ChevronRight, Building2, Instagram, Trash2,
} from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
    photographer: 'Фотограф',
    wedding_agency: 'Весільна агенція',
    travel_agency: 'Тревел-агенція',
    corporate: 'Компанія',
    other: 'Інше',
};

const STATUS_OPTS = [
    { value: 'new', label: 'Новий', color: '#d97706' },
    { value: 'contacted', label: 'Написали', color: '#3d56d6' },
    { value: 'replied', label: 'Відповів', color: '#7c3aed' },
    { value: 'qualified', label: 'Кваліфікований', color: '#0891b2' },
    { value: 'won', label: 'Угода', color: '#16a34a' },
    { value: 'lost', label: 'Втрачено', color: '#dc2626' },
];
const statusMeta = (s: string) => STATUS_OPTS.find(o => o.value === s) || STATUS_OPTS[0];

interface Lead {
    id: string; business_type: string; business_name: string; contact_name: string | null;
    email: string | null; phone: string | null; website: string | null; instagram: string | null;
    city: string | null; source: string; status: string; offer_sent_at: string | null;
    notes: string | null; created_at: string;
}
interface Message {
    id: string; direction: string; subject: string | null; body: string | null;
    from_email: string | null; to_email: string | null; created_at: string;
}

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [search, setSearch] = useState('');

    const [selected, setSelected] = useState<Lead | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [threadLoading, setThreadLoading] = useState(false);

    const [showAdd, setShowAdd] = useState(false);

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterStatus !== 'all') params.set('status', filterStatus);
            if (filterType !== 'all') params.set('type', filterType);
            if (search) params.set('q', search);
            const res = await fetch(`/api/admin/leads?${params}`);
            const data = await res.json();
            if (res.ok) { setLeads(data.leads || []); setCounts(data.counts || {}); }
            else toast.error(data.error || 'Помилка');
        } catch { toast.error('Помилка завантаження'); }
        setLoading(false);
    }, [filterStatus, filterType, search]);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    const openLead = async (lead: Lead) => {
        setSelected(lead);
        setThreadLoading(true);
        setMessages([]);
        try {
            const res = await fetch(`/api/admin/leads/${lead.id}`);
            const data = await res.json();
            if (res.ok) { setSelected(data.lead); setMessages(data.messages || []); }
        } catch { /* ignore */ }
        setThreadLoading(false);
    };

    const updateStatus = async (status: string) => {
        if (!selected) return;
        await fetch(`/api/admin/leads/${selected.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        setSelected({ ...selected, status });
        fetchLeads();
    };

    return (
        <div style={{ padding: '24px', maxWidth: 1280, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e2d7d', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Target size={24} /> Ліди (B2B)
                    </h1>
                    <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0' }}>Пошук через Google + ручне додавання · персональні пропозиції · переписка</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setShowAdd(true)} style={primaryBtn}><Plus size={16} /> Додати ліда</button>
                    <button onClick={fetchLeads} style={ghostBtn}><RefreshCw size={15} /> Оновити</button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук за назвою, email, містом…"
                    style={{ flex: 1, minWidth: 200, padding: '9px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }} />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
                    <option value="all">Усі статуси</option>
                    {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
                    <option value="all">Усі типи</option>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
            </div>

            {/* Two-pane layout */}
            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.3fr' : '1fr', gap: 16, alignItems: 'start' }}>
                {/* List */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}><Loader2 size={22} className="animate-spin" /></div>
                    ) : leads.length === 0 ? (
                        <div style={{ padding: 50, textAlign: 'center', color: '#94a3b8' }}>
                            <Target size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                            <p>Лідів немає. Додайте вручну або налаштуйте збір через Google.</p>
                        </div>
                    ) : (
                        <div>
                            {leads.map(lead => {
                                const sm = statusMeta(lead.status);
                                const isSel = selected?.id === lead.id;
                                return (
                                    <button key={lead.id} onClick={() => openLead(lead)}
                                        style={{ width: '100%', textAlign: 'left', padding: '14px 16px', border: 'none', borderBottom: '1px solid #f1f5f9', background: isSel ? '#f5f7ff' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                                <span style={{ fontWeight: 700, fontSize: 14, color: '#1e2d7d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.business_name}</span>
                                                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '1px 7px', borderRadius: 8, whiteSpace: 'nowrap' }}>{TYPE_LABELS[lead.business_type] || lead.business_type}</span>
                                            </div>
                                            <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {lead.email || lead.phone || lead.city || lead.website || '—'}
                                            </div>
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: sm.color, whiteSpace: 'nowrap' }}>{sm.label}</span>
                                        <ChevronRight size={15} color="#cbd5e1" />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Detail + thread */}
                {selected && (
                    <LeadDetail
                        lead={selected}
                        messages={messages}
                        threadLoading={threadLoading}
                        onClose={() => setSelected(null)}
                        onStatus={updateStatus}
                        onSent={() => openLead(selected)}
                        onChanged={fetchLeads}
                    />
                )}
            </div>

            {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); fetchLeads(); }} />}
        </div>
    );
}

function LeadDetail({ lead, messages, threadLoading, onClose, onStatus, onSent, onChanged }: {
    lead: Lead; messages: Message[]; threadLoading: boolean;
    onClose: () => void; onStatus: (s: string) => void; onSent: () => void; onChanged: () => void;
}) {
    const [mode, setMode] = useState<'offer' | 'custom'>('offer');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);

    const send = async () => {
        setSending(true);
        try {
            const payload = mode === 'offer'
                ? { mode: 'offer' }
                : { mode: 'custom', subject, body };
            const res = await fetch(`/api/admin/leads/${lead.id}/send`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Лист надіслано');
                setSubject(''); setBody('');
                onSent(); onChanged();
            } else {
                toast.error(data.message || data.error || 'Не вдалося надіслати');
            }
        } catch { toast.error('Помилка'); }
        setSending(false);
    };

    return (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 22, position: 'sticky', top: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 19, fontWeight: 800, color: '#1e2d7d', margin: '0 0 4px' }}>{lead.business_name}</h2>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#3d56d6', background: '#eef3ff', padding: '2px 10px', borderRadius: 10 }}>{TYPE_LABELS[lead.business_type] || lead.business_type}</span>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>

            {/* Contacts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, fontSize: 13, color: '#475569' }}>
                {lead.contact_name && <Row icon={<Building2 size={14} />}>{lead.contact_name}</Row>}
                {lead.email && <Row icon={<Mail size={14} />}>{lead.email}</Row>}
                {lead.phone && <Row icon={<Phone size={14} />}>{lead.phone}</Row>}
                {lead.website && <Row icon={<Globe size={14} />}><a href={lead.website} target="_blank" rel="noopener noreferrer" style={{ color: '#3d56d6' }}>{lead.website}</a></Row>}
                {lead.instagram && <Row icon={<Instagram size={14} />}>{lead.instagram}</Row>}
                {lead.city && <Row icon={<MapPin size={14} />}>{lead.city}</Row>}
            </div>

            {/* Status pipeline */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {STATUS_OPTS.map(s => (
                    <button key={s.value} onClick={() => onStatus(s.value)}
                        style={{ padding: '5px 11px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                            background: lead.status === s.value ? s.color : '#fff', color: lead.status === s.value ? '#fff' : '#64748b', borderColor: lead.status === s.value ? s.color : '#e2e8f0' }}>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Thread */}
            <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Переписка</div>
                {threadLoading ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}><Loader2 size={18} className="animate-spin" /></div>
                ) : messages.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#94a3b8', padding: '12px 0' }}>Ще немає повідомлень. Надішліть першу пропозицію нижче.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
                        {messages.map(m => (
                            <div key={m.id} style={{
                                alignSelf: m.direction === 'out' ? 'flex-end' : 'flex-start',
                                maxWidth: '85%', background: m.direction === 'out' ? '#eef3ff' : '#f8fafc',
                                border: '1px solid', borderColor: m.direction === 'out' ? '#c7d2fe' : '#e2e8f0',
                                borderRadius: 10, padding: '10px 13px',
                            }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: m.direction === 'out' ? '#3d56d6' : '#64748b', marginBottom: 3 }}>
                                    {m.direction === 'out' ? '→ Ми' : '← Лід'} · {new Date(m.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </div>
                                {m.subject && <div style={{ fontSize: 13, fontWeight: 700, color: '#1e2d7d', marginBottom: 3 }}>{m.subject}</div>}
                                <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.body}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Composer */}
            {!lead.email ? (
                <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
                    У цього ліда немає email — додайте його, щоб надіслати пропозицію.
                </div>
            ) : (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <button onClick={() => setMode('offer')} style={tabBtn(mode === 'offer')}>Готова пропозиція</button>
                        <button onClick={() => setMode('custom')} style={tabBtn(mode === 'custom')}>Свій лист</button>
                    </div>
                    {mode === 'offer' ? (
                        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
                            Буде надіслано персональну пропозицію для типу «{TYPE_LABELS[lead.business_type]}» — з відповідними перевагами та посиланням на лендинг.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Тема листа"
                                style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }} />
                            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Текст листа…" rows={5}
                                style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
                        </div>
                    )}
                    <button onClick={send} disabled={sending || (mode === 'custom' && (!subject.trim() || !body.trim()))}
                        style={{ ...primaryBtn, width: '100%', justifyContent: 'center', opacity: sending ? 0.7 : 1 }}>
                        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        {sending ? 'Надсилається…' : 'Надіслати'}
                    </button>
                </div>
            )}
        </div>
    );
}

function AddLeadModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
    const [form, setForm] = useState({
        business_type: 'photographer', business_name: '', contact_name: '',
        email: '', phone: '', website: '', instagram: '', city: '', source: 'instagram',
    });
    const [saving, setSaving] = useState(false);
    const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

    const save = async () => {
        if (!form.business_name.trim()) { toast.error('Вкажіть назву бізнесу'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/admin/leads', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (res.ok) { toast.success('Ліда додано'); onAdded(); }
            else toast.error(data.error || 'Помилка');
        } catch { toast.error('Помилка'); }
        setSaving(false);
    };

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <h2 style={{ fontSize: 19, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>Новий лід</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <L label="Тип бізнесу">
                        <select value={form.business_type} onChange={e => set('business_type', e.target.value)} style={fieldStyle}>
                            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </L>
                    <L label="Назва бізнесу *"><input value={form.business_name} onChange={e => set('business_name', e.target.value)} style={fieldStyle} /></L>
                    <L label="Контактна особа"><input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} style={fieldStyle} /></L>
                    <L label="Email"><input value={form.email} onChange={e => set('email', e.target.value)} style={fieldStyle} /></L>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <L label="Телефон"><input value={form.phone} onChange={e => set('phone', e.target.value)} style={fieldStyle} /></L>
                        <L label="Місто"><input value={form.city} onChange={e => set('city', e.target.value)} style={fieldStyle} /></L>
                    </div>
                    <L label="Сайт"><input value={form.website} onChange={e => set('website', e.target.value)} style={fieldStyle} /></L>
                    <L label="Instagram"><input value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@username" style={fieldStyle} /></L>
                    <button onClick={save} disabled={saving} style={{ ...primaryBtn, justifyContent: 'center', marginTop: 6 }}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Додати
                    </button>
                </div>
            </div>
        </div>
    );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#94a3b8' }}>{icon}</span>{children}</div>;
}
function L({ label, children }: { label: string; children: React.ReactNode }) {
    return <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</label>{children}</div>;
}

const primaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: '#263A99', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const selectStyle: React.CSSProperties = { padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, background: '#fff' };
const fieldStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
const tabBtn = (active: boolean): React.CSSProperties => ({ flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid', background: active ? '#263A99' : '#fff', color: active ? '#fff' : '#475569', borderColor: active ? '#263A99' : '#e2e8f0' });
