'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Plus,
    Search,
    MoreVertical,
    Edit,
    Trash2,
    ChevronUp,
    ChevronDown,
    Eye,
    EyeOff,
    HelpCircle
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function AdminFaqPage() {
    const supabase = createClient();
    const [faqs, setFaqs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchFaqs();
    }, []);

    const fetchFaqs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('faqs')
            .select('*')
            .order('sort_order', { ascending: true });

        if (data) setFaqs(data);
        setLoading(false);
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('faqs')
            .update({ is_active: !currentStatus })
            .eq('id', id);

        if (!error) {
            setFaqs(faqs.map(f => f.id === id ? { ...f, is_active: !currentStatus } : f));
            toast.success('Статус оновлено');
        }
    };

    const deleteFaq = async (id: string) => {
        if (!confirm('Ви впевнені, що хочете видалити це питання?')) return;

        const { error } = await supabase
            .from('faqs')
            .delete()
            .eq('id', id);

        if (!error) {
            setFaqs(faqs.filter(f => f.id !== id));
            toast.success('Видалено');
        }
    };

    const moveItem = async (index: number, direction: 'up' | 'down') => {
        const newFaqs = [...faqs];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= faqs.length) return;

        // Swap items locally
        const temp = newFaqs[index];
        newFaqs[index] = newFaqs[targetIndex];
        newFaqs[targetIndex] = temp;

        // Update sort_order locally
        const updatedFaqs = newFaqs.map((f, i) => ({ ...f, sort_order: i + 1 }));
        setFaqs(updatedFaqs);

        // Update DB
        const updates = updatedFaqs.map((f, i) =>
            supabase.from('faqs').update({ sort_order: i + 1 }).eq('id', f.id)
        );
        await Promise.all(updates);
    };

    const filteredFaqs = faqs.filter(f =>
        f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div style={{ padding: '0 0 80px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900, marginBottom: '8px' }}>Часті Питання (FAQ)</h1>
                    <p style={{ color: '#64748b' }}>Керуйте базою знань для ваших клієнтів</p>
                </div>
                <Link href="/admin/faq/new" style={addBtnStyle}>
                    <Plus size={20} /> Додати питання
                </Link>
            </div>

            <div style={cardStyle}>
                <div style={{ marginBottom: '32px', position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                    <input
                        type="text"
                        placeholder="Пошук питань за текстом або категорією..."
                        style={searchInputStyle}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px', color: '#64748b' }}>Завантаження...</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filteredFaqs.map((faq, index) => (
                            <div key={faq.id} style={{
                                ...faqRowStyle,
                                opacity: faq.is_active ? 1 : 0.6,
                                borderLeft: faq.is_active ? '4px solid var(--primary)' : '4px solid #cbd5e1'
                            }}>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <button onClick={() => moveItem(index, 'up')} disabled={index === 0} style={sortBtnStyle}><ChevronUp size={14} /></button>
                                        <button onClick={() => moveItem(index, 'down')} disabled={index === filteredFaqs.length - 1} style={sortBtnStyle}><ChevronDown size={14} /></button>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                                            <span style={categoryBadgeStyle}>{faq.category}</span>
                                            {!faq.is_active && <span style={{ ...categoryBadgeStyle, backgroundColor: '#f1f5f9', color: '#64748b' }}>Приховано</span>}
                                        </div>
                                        <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>{faq.question}</h3>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => toggleStatus(faq.id, faq.is_active)} style={actionBtnStyle} title={faq.is_active ? "Приховати" : "Опублікувати"}>
                                        {faq.is_active ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                    <Link href={`/admin/faq/${faq.id}/edit`} style={actionBtnStyle} title="Редагувати">
                                        <Edit size={18} />
                                    </Link>
                                    <button onClick={() => deleteFaq(faq.id)} style={{ ...actionBtnStyle, color: '#ef4444' }} title="Видалити">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {filteredFaqs.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '60px', borderRadius: '3px', backgroundColor: '#f8fafc', border: '1px dashed #e2e8f0' }}>
                                <HelpCircle size={40} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                                <p style={{ color: '#64748b', fontWeight: 600 }}>Нічого не знайдено</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const cardStyle = { backgroundColor: 'white', padding: '32px', borderRadius: '3px', boxShadow: '0 4px 25px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9' };
const addBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#263A99', color: 'white', borderRadius: '3px', textDecoration: 'none', fontWeight: 700, fontSize: '15px', transition: 'all 0.2s' };
const searchInputStyle = { width: '100%', padding: '14px 16px 14px 48px', borderRadius: '3px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px' };
const faqRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', backgroundColor: '#fcfcfc', borderRadius: '3px', border: '1.5px solid #f1f5f9', transition: 'all 0.2s' };
const categoryBadgeStyle = { fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' as any, padding: '2px 8px', borderRadius: '3px', backgroundColor: '#fff1f2', color: '#ef4444', letterSpacing: '0.05em' };
const actionBtnStyle = { width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px', border: '1.5px solid #f1f5f9', backgroundColor: 'white', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s' };
const sortBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', padding: '2px' };
