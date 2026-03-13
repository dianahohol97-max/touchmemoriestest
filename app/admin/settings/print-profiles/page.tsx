'use client';
import { useState, useEffect } from 'react';
import { Loader2, Plus, Printer, Edit2, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import PrintProfileForm from './PrintProfileForm';

export default function PrintProfilesPage() {
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingProfile, setEditingProfile] = useState<any>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);

    useEffect(() => {
        fetchProfiles();
    }, []);

    const fetchProfiles = async () => {
        try {
            const res = await fetch('/api/admin/print-profiles');
            if (res.ok) {
                const data = await res.json();
                setProfiles(data);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Видалити цей профіль друку?')) return;
        const res = await fetch(`/api/admin/print-profiles/${id}`, { method: 'DELETE' });
        if (res.ok) {
            toast.success('Профіль видалено');
            setProfiles(profiles.filter(p => p.id !== id));
        } else {
            toast.error('Помилка видалення');
        }
    };

    const handleEdit = (profile: any) => {
        setEditingProfile(profile);
        setIsFormOpen(true);
    };

    const handleCreate = () => {
        setEditingProfile(null);
        setIsFormOpen(true);
    };

    if (loading) return <div style={{ padding: '100px', textAlign: 'center' }}><Loader2 className="animate-spin" size={32} /></div>;

    return (
        <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>Профілі друку 🖨️</h1>
                    <p style={{ color: '#64748b' }}>Налаштуйте технічні параметри для генерації файлів під різні типи продукції</p>
                </div>
                <button
                    onClick={handleCreate}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '12px',
                        border: 'none',
                        background: '#3b82f6',
                        color: 'white',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
                    }}
                >
                    <Plus size={20} />
                    Створити профіль
                </button>
            </div>

            <div style={{ display: 'grid', gap: '16px' }}>
                {profiles.map(profile => (
                    <div key={profile.id} style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '20px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: '#f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#3b82f6'
                            }}>
                                <Printer size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>{profile.name}</h3>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                                    <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: '#e2e8f0', color: '#475569' }}>
                                        {profile.output_format.toUpperCase()}
                                    </span>
                                    <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: '#e2e8f0', color: '#475569' }}>
                                        {profile.color_mode.toUpperCase()}
                                    </span>
                                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                                        {profile.page_width_mm}x{profile.page_height_mm} mm @ {profile.dpi} DPI
                                    </span>
                                </div>
                                {profile.products && (
                                    <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        📦 {profile.products.name}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => handleEdit(profile)}
                                style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#475569' }}
                                title="Редагувати"
                            >
                                <Edit2 size={18} />
                            </button>
                            <button
                                onClick={() => handleDelete(profile.id)}
                                style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#ef4444' }}
                                title="Видалити"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}

                {profiles.length === 0 && (
                    <div style={{ padding: '60px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
                        <Printer size={48} style={{ color: '#94a3b8', marginBottom: '16px' }} />
                        <h3 style={{ color: '#475569', fontWeight: 600 }}>Профілів друку ще не створено</h3>
                        <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '8px' }}>Створіть свій перший профіль для автоматичної генерації файлів</p>
                    </div>
                )}
            </div>

            {isFormOpen && (
                <PrintProfileForm
                    profile={editingProfile}
                    onClose={() => setIsFormOpen(false)}
                    onSuccess={() => {
                        setIsFormOpen(false);
                        fetchProfiles();
                    }}
                />
            )}
        </div>
    );
}
