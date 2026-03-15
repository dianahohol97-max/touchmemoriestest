'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { Loader2, Plus, Edit2, Trash2, GripVertical, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import ConstructorTypeForm from './ConstructorTypeForm';

export default function ConstructorTypesPage() {
    const [types, setTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<any>(null);

    useEffect(() => {
        fetchTypes();
    }, []);

    const fetchTypes = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/constructor-types');
            if (res.ok) {
                const data = await res.json();
                setTypes(data);
            }
        } catch (error) {
            toast.error('Невдалося завантажити типи');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (type: any) => {
        setSelectedType(type);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Ви впевнені, що хочете видалити цей тип?')) return;
        try {
            const res = await fetch(`/api/admin/constructor-types/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Тип видалено');
                fetchTypes();
            }
        } catch (error) {
            toast.error('Помилка при видаленні');
        }
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#263A99' }}>Типи конструктора</h1>
                    <p style={{ color: '#64748b' }}>Керуйте різними типами продуктів та їх правилами в конструкторі.</p>
                </div>
                <button
                    onClick={() => { setSelectedType(null); setIsFormOpen(true); }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '12px 24px', backgroundColor: '#263A99',
                        color: 'white', borderRadius: '12px', border: 'none',
                        fontWeight: 700, cursor: 'pointer'
                    }}
                >
                    <Plus size={20} /> Додати тип
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                    <Loader2 className="animate-spin" size={40} color="#64748b" />
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    {types.map((type) => (
                        <div key={type.id} style={{
                            backgroundColor: 'white', padding: '24px', borderRadius: '20px',
                            border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '24px',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
                        }}>
                            <div style={{ fontSize: '32px' }}>{type.icon || '📦'}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{type.name}</h3>
                                    <span style={{
                                        fontSize: '11px', fontWeight: 800, padding: '4px 8px',
                                        borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#64748b'
                                    }}>
                                        {type.slug}
                                    </span>
                                    {type.is_active ? (
                                        <Badge status="active">Активний</Badge>
                                    ) : (
                                        <Badge status="draft">Чернетка</Badge>
                                    )}
                                </div>
                                <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px', maxWidth: '600px' }}>
                                    {type.description}
                                </p>
                                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '13px', color: '#94a3b8' }}>
                                    <span>Стор: {type.min_pages}-{type.max_pages}</span>
                                    <span>•</span>
                                    <span>Форматів: {type.available_formats?.length || 0}</span>
                                    <span>•</span>
                                    <span>Базова ціна: {type.base_price} ₴</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => handleEdit(type)}
                                    style={actionBtnStyle}
                                >
                                    <Edit2 size={18} />
                                </button>
                                <button
                                    onClick={() => handleDelete(type.id)}
                                    style={{ ...actionBtnStyle, color: '#dc2626' }}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {types.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '80px', background: '#f8fafc', borderRadius: '24px', color: '#94a3b8' }}>
                            Немає створених типів конструктора
                        </div>
                    )}
                </div>
            )}

            {isFormOpen && (
                <ConstructorTypeForm
                    typeId={selectedType?.id}
                    onClose={() => setIsFormOpen(false)}
                    onSuccess={() => { setIsFormOpen(false); fetchTypes(); }}
                />
            )}
        </div>
    );
}

function Badge({ children, status }: { children: any, status: 'active' | 'draft' }) {
    const colors = {
        active: { bg: '#dcfce7', text: '#15803d' },
        draft: { bg: '#f1f5f9', text: '#64748b' }
    };
    return (
        <span style={{
            fontSize: '11px', fontWeight: 800, padding: '4px 10px',
            borderRadius: '20px', backgroundColor: colors[status].bg, color: colors[status].text,
            display: 'flex', alignItems: 'center', gap: '4px'
        }}>
            {status === 'active' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {children}
        </span>
    );
}

const actionBtnStyle = {
    padding: '10px', borderRadius: '12px', backgroundColor: '#f8fafc',
    border: 'none', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s'
};
