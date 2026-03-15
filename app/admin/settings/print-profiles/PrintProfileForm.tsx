'use client';
import { useState, useEffect } from 'react';
import { Loader2, Save, X, Info } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface PrintProfileFormProps {
    profile?: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function PrintProfileForm({ profile, onClose, onSuccess }: PrintProfileFormProps) {
    const supabase = createClient();
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        name: profile?.name || '',
        product_id: profile?.product_id || '',
        output_format: profile?.output_format || 'pdf',
        color_mode: profile?.color_mode || 'cmyk',
        dpi: profile?.dpi || 300,
        page_width_mm: profile?.page_width_mm || 200,
        page_height_mm: profile?.page_height_mm || 200,
        bleed_top_mm: profile?.bleed_top_mm || 3,
        bleed_right_mm: profile?.bleed_right_mm || 3,
        bleed_bottom_mm: profile?.bleed_bottom_mm || 3,
        bleed_left_mm: profile?.bleed_left_mm || 3,
        safe_zone_mm: profile?.safe_zone_mm || 5,
        spine_width_mm: profile?.spine_width_mm || 0,
        output_pages: profile?.output_pages || 'single',
        notes: profile?.notes || ''
    });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        const { data } = await supabase.from('products').select('id, name').order('name');
        if (data) {
            setProducts(data);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const method = profile ? 'PUT' : 'POST';
        const url = profile ? `/api/admin/print-profiles/${profile.id}` : '/api/admin/print-profiles';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success(profile ? 'Профіль оновлено' : 'Профіль створено');
                onSuccess();
            } else {
                toast.error('Помилка збереження');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) : value
        }));
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: '24px', right: '24px', border: 'none', background: '#f1f5f9', color: '#64748b', padding: '8px', borderRadius: '12px', cursor: 'pointer' }}>
                    <X size={20} />
                </button>

                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', marginBottom: '24px' }}>
                    {profile ? 'Редагувати профіль друку' : 'Створити профіль друку'}
                </h2>

                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Назва профілю</label>
                            <input name="name" value={formData.name} onChange={handleChange} required placeholder="Напр. Фотокнига 20х20" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Прив'язаний товар</label>
                            <select name="product_id" value={formData.product_id} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <option value="">Загальний / Не вказано</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Формат</label>
                            <select name="output_format" value={formData.output_format} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <option value="pdf">PDF</option>
                                <option value="jpg">JPG</option>
                                <option value="png">PNG</option>
                                <option value="tiff">TIFF</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Колірна модель</label>
                            <select name="color_mode" value={formData.color_mode} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <option value="cmyk">CMYK (Друк)</option>
                                <option value="rgb">RGB (Екран)</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>DPI</label>
                            <input type="number" name="dpi" value={formData.dpi} onChange={handleChange} required style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                        </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📏 Розміри та відступи (у міліметрах)
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Ширина сторінки</label>
                                <input type="number" name="page_width_mm" value={formData.page_width_mm} onChange={handleChange} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Висота сторінки</label>
                                <input type="number" name="page_height_mm" value={formData.page_height_mm} onChange={handleChange} required style={{ width: '100', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Обріз Top</label>
                                <input type="number" name="bleed_top_mm" value={formData.bleed_top_mm} onChange={handleChange} required style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Обріз Right</label>
                                <input type="number" name="bleed_right_mm" value={formData.bleed_right_mm} onChange={handleChange} required style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Обріз Bottom</label>
                                <input type="number" name="bleed_bottom_mm" value={formData.bleed_bottom_mm} onChange={handleChange} required style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Обріз Left</label>
                                <input type="number" name="bleed_left_mm" value={formData.bleed_left_mm} onChange={handleChange} required style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Безпечна зона (Safe Zone)</label>
                                <input type="number" name="safe_zone_mm" value={formData.safe_zone_mm} onChange={handleChange} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Корінець (Spine)</label>
                                <input type="number" name="spine_width_mm" value={formData.spine_width_mm} onChange={handleChange} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Режим виведення сторінок</label>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                                    <input type="radio" name="output_pages" value="all" checked={formData.output_pages === 'all'} onChange={handleChange} /> Кожна окремо
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                                    <input type="radio" name="output_pages" value="spread" checked={formData.output_pages === 'spread'} onChange={handleChange} /> Розворотами
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                                    <input type="radio" name="output_pages" value="single" checked={formData.output_pages === 'single'} onChange={handleChange} /> Один файл (PDF)
                                </label>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Технічні примітки</label>
                        <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} placeholder="Додаткові вимоги друкарні..." style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', resize: 'vertical' }} />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '16px',
                            borderRadius: '16px',
                            border: 'none',
                            background: '#3b82f6',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)',
                            transition: 'transform 0.2s'
                        }}
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                        {profile ? 'Зберегти зміни' : 'Створити профіль'}
                    </button>
                </form>
            </div>
        </div>
    );
}
