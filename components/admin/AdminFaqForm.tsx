'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import {
    Upload,
    X,
    Save,
    ArrowLeft,
    Loader2,
    Check,
    Plus,
    HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface FaqFormProps {
    initialData?: any;
    isEditing?: boolean;
}

const CATEGORIES = ["Замовлення", "Доставка", "Конструктор", "Оплата", "Якість"];

export default function AdminFaqForm({ initialData, isEditing = false }: FaqFormProps) {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        question: initialData?.question || '',
        answer: initialData?.answer || '',
        category: initialData?.category || 'Замовлення',
        sort_order: initialData?.sort_order || 0,
        is_active: initialData?.is_active ?? true,
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isEditing) {
                const { error } = await supabase
                    .from('faqs')
                    .update(formData)
                    .eq('id', initialData.id);
                if (error) throw error;
                toast.success('Питання оновлено');
            } else {
                const { error } = await supabase
                    .from('faqs')
                    .insert([formData]);
                if (error) throw error;
                toast.success('Питання додано');
            }
            router.push('/admin/faq');
            router.refresh();
        } catch (error: any) {
            toast.error(error.message || 'Помилка при збереженні');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button type="button" onClick={() => router.back()} style={backBtnStyle}><ArrowLeft size={20} /></button>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 900 }}>
                        {isEditing ? 'Редагувати FAQ' : 'Додати FAQ'}
                    </h1>
                </div>
                <button type="submit" disabled={loading} style={saveBtnStyle}>
                    {loading ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                    Зберегти
                </button>
            </div>

            <div style={cardStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <label style={labelStyle}>Питання</label>
                        <input
                            type="text"
                            name="question"
                            value={formData.question}
                            onChange={handleInputChange}
                            style={inputStyle}
                            required
                            placeholder="Наприклад: Скільки часу займає доставка?"
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Відповідь (Rich Text)</label>
                        <textarea
                            name="answer"
                            value={formData.answer}
                            onChange={handleInputChange}
                            style={textareaStyle}
                            rows={6}
                            required
                            placeholder="Напишіть детальну відповідь..."
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={labelStyle}>Категорія</label>
                            <select name="category" value={formData.category} onChange={handleInputChange} style={selectStyle} required>
                                {CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Порядок сортування</label>
                            <input
                                type="number"
                                name="sort_order"
                                value={formData.sort_order}
                                onChange={handleInputChange}
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
                        <input
                            type="checkbox"
                            id="is_active"
                            name="is_active"
                            checked={formData.is_active}
                            onChange={(e) => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                            style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        <label htmlFor="is_active" style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>Активне (відображається на сайті)</label>
                    </div>
                </div>
            </div>

            <style jsx>{`
                input:focus, textarea:focus, select:focus {
                    border-color: var(--primary) !important;
                    box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.1) !important;
                }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </form>
    );
}

const cardStyle = { backgroundColor: 'white', padding: '32px', borderRadius: '32px', boxShadow: '0 4px 25px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9' };
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' as any, letterSpacing: '0.05em' };
const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', transition: 'all 0.2s', fontSize: '14px' };
const textareaStyle = { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', transition: 'all 0.2s', fontSize: '14px', fontFamily: 'inherit' };
const selectStyle = { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', backgroundColor: 'white' };
const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', cursor: 'pointer' };
const saveBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#10b981', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '15px' };
