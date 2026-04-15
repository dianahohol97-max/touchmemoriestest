'use client';
import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Save, GripVertical, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function TagsSettingsPage() {
    const [tags, setTags] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // New tag form
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#263A99');
    const [newIcon, setNewIcon] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        fetchTags();
    }, []);

    const fetchTags = async () => {
        try {
            const res = await fetch('/api/admin/tags');
            if (res.ok) {
                const data = await res.json();
                setTags(data);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newName.trim() || !newIcon.trim()) return;
        setIsAdding(true);
        const res = await fetch('/api/admin/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: newName,
                color: newColor,
                icon: newIcon,
                sort_order: tags.length
            })
        });

        if (res.ok) {
            toast.success('Тег додано');
            setNewName('');
            fetchTags();
        } else {
            toast.error('Помилка додавання');
        }
        setIsAdding(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Видалити цей тег? Він також буде видалений з усіх замовлень.')) return;

        const res = await fetch(`/api/admin/tags/${id}`, { method: 'DELETE' });
        if (res.ok) {
            toast.success('Тег видалено');
            setTags(tags.filter(t => t.id !== id));
        } else {
            toast.error('Помилка видалення');
        }
    };

    const moveTag = (index: number, direction: 'up' | 'down') => {
        const newTags = [...tags];
        if (direction === 'up' && index > 0) {
            [newTags[index], newTags[index - 1]] = [newTags[index - 1], newTags[index]];
        } else if (direction === 'down' && index < newTags.length - 1) {
            [newTags[index], newTags[index + 1]] = [newTags[index + 1], newTags[index]];
        }

        // Update sort_orders locally
        const updated = newTags.map((t, i) => ({ ...t, sort_order: i }));
        setTags(updated);
    };

    const saveOrder = async () => {
        setSaving(true);
        const res = await fetch('/api/admin/tags', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags })
        });

        if (res.ok) {
            toast.success('Порядок збережено');
        } else {
            toast.error('Помилка збереження');
        }
        setSaving(false);
    };

    if (loading) return <div style={{ padding: '100px', textAlign: 'center' }}><Loader2 className="animate-spin" size={32} /></div>;

    return (
        <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#263A99', marginBottom: '8px' }}>Управління тегами </h1>
                    <p style={{ color: '#64748b' }}>Налаштуйте теги для швидкої категоризації замовлень</p>
                </div>
            </div>

            <div style={{ background: 'white', borderRadius: "3px", padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', marginBottom: '32px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Додати новий тег</h2>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Назва</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="Напр. Терміново"
                            style={{ width: '100%', padding: '10px', borderRadius: "3px", border: '1px solid #e2e8f0', outline: 'none' }}
                        />
                    </div>
                    <div style={{ width: '80px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Колір</label>
                        <input
                            type="color"
                            value={newColor}
                            onChange={e => setNewColor(e.target.value)}
                            style={{ width: '100%', height: '40px', padding: '2px', borderRadius: "3px", border: '1px solid #e2e8f0', cursor: 'pointer' }}
                        />
                    </div>
                    <div style={{ width: '80px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Іконка</label>
                        <input
                            type="text"
                            value={newIcon}
                            onChange={e => setNewIcon(e.target.value)}
                            maxLength={2}
                            style={{ width: '100%', padding: '10px', borderRadius: "3px", border: '1px solid #e2e8f0', outline: 'none', textAlign: 'center' }}
                        />
                    </div>
                    <button
                        onClick={handleAdd}
                        disabled={isAdding || !newName.trim()}
                        style={{ padding: '0 24px', height: '40px', borderRadius: "3px", border: 'none', background: '#263A99', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {isAdding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                        Додати
                    </button>
                </div>
            </div>

            <div style={{ background: 'white', borderRadius: "3px", padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Активні теги</h2>
                    <button
                        onClick={saveOrder}
                        disabled={saving}
                        style={{ padding: '8px 16px', borderRadius: "3px", border: '1px solid #e2e8f0', background: 'white', color: '#263A99', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Зберегти порядок
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tags.map((tag, index) => (
                        <div key={tag.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: "3px", border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '16px' }}>
                                <button onClick={() => moveTag(index, 'up')} disabled={index === 0} style={{ border: 'none', background: 'transparent', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 1, padding: 0 }}></button>
                                <button onClick={() => moveTag(index, 'down')} disabled={index === tags.length - 1} style={{ border: 'none', background: 'transparent', cursor: index === tags.length - 1 ? 'default' : 'pointer', opacity: index === tags.length - 1 ? 0.3 : 1, padding: 0 }}></button>
                            </div>

                            <div style={{ padding: '4px 10px', borderRadius: "3px", backgroundColor: `${tag.color}15`, color: tag.color, fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{tag.icon}</span>
                                {tag.name}
                            </div>

                            <div style={{ flex: 1 }} />

                            <div style={{ fontSize: '13px', color: '#64748b', marginRight: '24px' }}>
                                Використано: <strong>{tag.usage_count || 0}</strong>
                            </div>

                            <button onClick={() => handleDelete(tag.id)} style={{ padding: '6px', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: "3px" }}>
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                    {tags.length === 0 && (
                        <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Немає створених тегів</div>
                    )}
                </div>
            </div>
        </div>
    );
}
