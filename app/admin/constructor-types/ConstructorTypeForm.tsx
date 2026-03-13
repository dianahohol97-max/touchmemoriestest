'use client';
import { useState, useEffect } from 'react';
import { Loader2, Save, X, Info, Plus, Trash2, Layout, Image as ImageIcon, Type, Palette, Sparkles, CircleDollarSign, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { TEMPLATES } from '@/utils/templates';

interface ConstructorTypeFormProps {
    typeId?: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ConstructorTypeForm({ typeId, onClose, onSuccess }: ConstructorTypeFormProps) {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [products, setProducts] = useState<any[]>([]);

    const [formData, setFormData] = useState<any>({
        name: '',
        slug: '',
        description: '',
        product_id: null,
        icon: '📚',
        is_active: true,
        sort_order: 0,
        min_pages: 10,
        max_pages: 100,
        page_step: 2,
        default_pages: 20,
        has_cover: true,
        has_back_cover: true,
        cover_is_separate: true,
        spread_mode: true,
        first_page_solo: true,
        background_color: '#FFFFFF',
        allowed_backgrounds: [],
        show_page_numbers: true,
        page_number_position: 'bottom-center',
        available_formats: [
            { id: "15x15", label: "15×15 см", width_mm: 150, height_mm: 150, canvas_width_px: 1800, canvas_height_px: 1800 },
            { id: "20x20", label: "20×20 см", width_mm: 200, height_mm: 200, canvas_width_px: 2400, canvas_height_px: 2400 }
        ],
        default_format_id: '20x20',
        available_covers: [
            { id: "soft", label: "М'яка обкладинка", price_modifier: 0 },
            { id: "hard", label: "Тверда обкладинка", price_modifier: 150 }
        ],
        margin_mm: 5,
        ai_caption_prompt: '',
        ai_intro_prompt: '',
        base_price: 0,
        price_per_page: 0,
        pricing_note: '',
        template_ids: [] // For constructor_product_templates
    });

    useEffect(() => {
        fetchProducts();
        if (typeId) {
            fetchType();
        }
    }, [typeId]);

    const fetchProducts = async () => {
        const { data } = await supabase.from('products').select('id, name').order('name');
        if (data) setProducts(data);
    };

    const fetchType = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/constructor-types/${typeId}`);
            if (res.ok) {
                const data = await res.json();
                // Map joined templates back to IDs
                const templateIds = data.constructor_product_templates?.map((t: any) => t.template_id) || [];
                setFormData({ ...data, template_ids: templateIds });
            }
        } catch (error) {
            toast.error('Невдалося завантажити дані');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { template_ids, constructor_product_templates, ...payload } = formData;

            const method = typeId ? 'PUT' : 'POST';
            const url = typeId ? `/api/admin/constructor-types/${typeId}` : '/api/admin/constructor-types';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const savedType = await res.json();
                const typeIdToUse = savedType.id;

                // Update Templates (simple clear and re-insert)
                await supabase.from('constructor_product_templates').delete().eq('constructor_type_id', typeIdToUse);
                if (template_ids.length > 0) {
                    const templateInserts = template_ids.map((tid: string, idx: number) => ({
                        constructor_type_id: typeIdToUse,
                        template_id: tid,
                        sort_order: idx
                    }));
                    await supabase.from('constructor_product_templates').insert(templateInserts);
                }

                toast.success('Налаштування збережено');
                onSuccess();
            }
        } catch (error) {
            toast.error('Помилка при збереженні');
        } finally {
            setSaving(false);
        }
    };

    const toggleTemplate = (id: string) => {
        const current = [...formData.template_ids];
        if (current.includes(id)) {
            setFormData({ ...formData, template_ids: current.filter(tid => tid !== id) });
        } else {
            setFormData({ ...formData, template_ids: [...current, id] });
        }
    };

    if (loading) return <div style={overlayStyle}><Loader2 className="animate-spin" /></div>;

    const tabs = [
        { id: 'general', label: 'Основне', icon: <Settings2 size={16} /> },
        { id: 'pages', label: 'Сторінки', icon: <Layout size={16} /> },
        { id: 'formats', label: 'Формати', icon: <ImageIcon size={16} /> },
        { id: 'covers', label: 'Обкладинки', icon: <ImageIcon size={16} /> },
        { id: 'templates', label: 'Шаблони', icon: <Layout size={16} /> },
        { id: 'styles', label: 'Стилі', icon: <Palette size={16} /> },
        { id: 'ai', label: 'AI', icon: <Sparkles size={16} /> },
        { id: 'pricing', label: 'Ціна', icon: <CircleDollarSign size={16} /> },
    ];

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <div style={headerStyle}>
                    <h2 style={{ margin: 0 }}>{typeId ? 'Редагувати тип' : 'Створити новий тип'}</h2>
                    <button onClick={onClose} style={closeBtnStyle}><X size={20} /></button>
                </div>

                <div style={sidebarContainerStyle}>
                    <div style={sidebarStyle}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    ...tabBtnStyle,
                                    backgroundColor: activeTab === tab.id ? '#1e293b' : 'transparent',
                                    color: activeTab === tab.id ? 'white' : '#64748b'
                                }}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    <div style={contentStyle}>
                        {activeTab === 'general' && (
                            <div style={tabPanelStyle}>
                                <div style={fieldGroup}>
                                    <label style={labelStyle}>Назва</label>
                                    <input
                                        style={inputStyle}
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Наприклад: Фотокнига Преміум"
                                    />
                                </div>
                                <div style={fieldGroup}>
                                    <label style={labelStyle}>Slug (ID в URL)</label>
                                    <input
                                        style={inputStyle}
                                        value={formData.slug}
                                        onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                        placeholder="photobook-premium"
                                    />
                                </div>
                                <div style={fieldRow}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Іконка (Emoji)</label>
                                        <input
                                            style={inputStyle}
                                            value={formData.icon}
                                            onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Сортування</label>
                                        <input
                                            type="number"
                                            style={inputStyle}
                                            value={formData.sort_order}
                                            onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div style={fieldGroup}>
                                    <label style={labelStyle}>Прив'язаний товар у магазині</label>
                                    <select
                                        style={inputStyle}
                                        value={formData.product_id || ''}
                                        onChange={e => setFormData({ ...formData, product_id: e.target.value || null })}
                                    >
                                        <option value="">Не вибрано</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '16px' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                    />
                                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Активний</span>
                                </label>
                            </div>
                        )}

                        {activeTab === 'pages' && (
                            <div style={tabPanelStyle}>
                                <div style={fieldRow}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Мін. сторінок</label>
                                        <input type="number" style={inputStyle} value={formData.min_pages} onChange={e => setFormData({ ...formData, min_pages: parseInt(e.target.value) })} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Макс. сторінок</label>
                                        <input type="number" style={inputStyle} value={formData.max_pages} onChange={e => setFormData({ ...formData, max_pages: parseInt(e.target.value) })} />
                                    </div>
                                </div>
                                <div style={fieldRow}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Крок (парне число)</label>
                                        <input type="number" style={inputStyle} value={formData.page_step} onChange={e => setFormData({ ...formData, page_step: parseInt(e.target.value) })} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Дефолтно сторінок</label>
                                        <input type="number" style={inputStyle} value={formData.default_pages} onChange={e => setFormData({ ...formData, default_pages: parseInt(e.target.value) })} />
                                    </div>
                                </div>
                                <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '20px', paddingTop: '20px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <label style={checkLabel}>
                                            <input type="checkbox" checked={formData.has_cover} onChange={e => setFormData({ ...formData, has_cover: e.target.checked })} />
                                            Є окрема обкладинка
                                        </label>
                                        <label style={checkLabel}>
                                            <input type="checkbox" checked={formData.has_back_cover} onChange={e => setFormData({ ...formData, has_back_cover: e.target.checked })} />
                                            Є задня обкладинка
                                        </label>
                                        <label style={checkLabel}>
                                            <input type="checkbox" checked={formData.cover_is_separate} onChange={e => setFormData({ ...formData, cover_is_separate: e.target.checked })} />
                                            Обкладинка редагується окремо
                                        </label>
                                        <label style={checkLabel}>
                                            <input type="checkbox" checked={formData.spread_mode} onChange={e => setFormData({ ...formData, spread_mode: e.target.checked })} />
                                            Режим розвороту (2 стор поруч)
                                        </label>
                                        <label style={checkLabel}>
                                            <input type="checkbox" checked={formData.first_page_solo} onChange={e => setFormData({ ...formData, first_page_solo: e.target.checked })} />
                                            Перша сторінка одна (не розворот)
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'formats' && (
                            <div style={tabPanelStyle}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {formData.available_formats.map((f: any, idx: number) => (
                                        <div key={idx} style={cardItemStyle}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 800 }}>{f.label}</div>
                                                <div style={{ fontSize: '11px', color: '#64748b' }}>{f.width_mm}x{f.height_mm}mm • {f.canvas_width_px}x{f.canvas_height_px}px</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                                    <input
                                                        type="radio"
                                                        name="default_format"
                                                        checked={formData.default_format_id === f.id}
                                                        onChange={() => setFormData({ ...formData, default_format_id: f.id })}
                                                    /> Дефолт
                                                </label>
                                                <button
                                                    onClick={() => {
                                                        const fresh = [...formData.available_formats];
                                                        fresh.splice(idx, 1);
                                                        setFormData({ ...formData, available_formats: fresh });
                                                    }}
                                                    style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => {
                                            const name = prompt('Назва формату (напр. 30x30 см)');
                                            const w = prompt('Ширина в мм');
                                            const h = prompt('Висота в мм');
                                            if (name && w && h) {
                                                const cw = Math.round(parseInt(w) * 300 / 25.4);
                                                const ch = Math.round(parseInt(h) * 300 / 25.4);
                                                setFormData({
                                                    ...formData,
                                                    available_formats: [...formData.available_formats, {
                                                        id: name.replace(/\s+/g, '-').toLowerCase(),
                                                        label: name,
                                                        width_mm: parseInt(w),
                                                        height_mm: parseInt(h),
                                                        canvas_width_px: cw,
                                                        canvas_height_px: ch
                                                    }]
                                                });
                                            }
                                        }}
                                        style={addMoreBtn}
                                    >
                                        <Plus size={16} /> Додати формат
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'covers' && (
                            <div style={tabPanelStyle}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {formData.available_covers.map((c: any, idx: number) => (
                                        <div key={idx} style={cardItemStyle}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 800 }}>{c.label}</div>
                                                <div style={{ fontSize: '11px', color: '#64748b' }}>Доплата: {c.price_modifier} ₴</div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const fresh = [...formData.available_covers];
                                                    fresh.splice(idx, 1);
                                                    setFormData({ ...formData, available_covers: fresh });
                                                }}
                                                style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => {
                                            const label = prompt('Назва обкладинки');
                                            const price = prompt('Доплата (грн)');
                                            if (label && price) {
                                                setFormData({
                                                    ...formData,
                                                    available_covers: [...formData.available_covers, {
                                                        id: label.replace(/\s+/g, '-').toLowerCase(),
                                                        label,
                                                        price_modifier: parseInt(price)
                                                    }]
                                                });
                                            }
                                        }}
                                        style={addMoreBtn}
                                    >
                                        <Plus size={16} /> Додати обкладинку
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'templates' && (
                            <div style={tabPanelStyle}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                                    {TEMPLATES.map(t => (
                                        <div
                                            key={t.id}
                                            onClick={() => toggleTemplate(t.id)}
                                            style={{
                                                padding: '12px', borderRadius: '12px', border: '2px solid',
                                                borderColor: formData.template_ids.includes(t.id) ? '#1e293b' : '#f1f5f9',
                                                cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                                                backgroundColor: formData.template_ids.includes(t.id) ? '#f8fafc' : 'white'
                                            }}
                                        >
                                            <div dangerouslySetInnerHTML={{ __html: t.thumbnailSVG }} style={{ width: '60px', height: '60px', margin: '0 auto 8px' }} />
                                            <div style={{ fontSize: '10px', fontWeight: 700, lineHeight: 1.2 }}>{t.name}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'styles' && (
                            <div style={tabPanelStyle}>
                                <div style={fieldGroup}>
                                    <label style={labelStyle}>Фон за замовчуванням</label>
                                    <input type="color" style={{ width: '100%', height: '40px', padding: '0', border: 'none', borderRadius: '10px' }} value={formData.background_color} onChange={e => setFormData({ ...formData, background_color: e.target.value })} />
                                </div>
                                <div style={fieldGroup}>
                                    <label style={labelStyle}>Дозволений відступ від краю (мм)</label>
                                    <input type="number" style={inputStyle} value={formData.margin_mm} onChange={e => setFormData({ ...formData, margin_mm: parseFloat(e.target.value) })} />
                                </div>
                                <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '20px', paddingTop: '20px' }}>
                                    <label style={checkLabel}>
                                        <input type="checkbox" checked={formData.show_page_numbers} onChange={e => setFormData({ ...formData, show_page_numbers: e.target.checked })} />
                                        Показувати номери сторінок
                                    </label>
                                    <div style={{ marginTop: '12px' }}>
                                        <label style={labelStyle}>Позиція номера</label>
                                        <select style={inputStyle} value={formData.page_number_position} onChange={e => setFormData({ ...formData, page_number_position: e.target.value })}>
                                            <option value="bottom-center">Знизу по центру</option>
                                            <option value="bottom-outside">Знизу зовні</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'ai' && (
                            <div style={tabPanelStyle}>
                                <div style={fieldGroup}>
                                    <label style={labelStyle}>Промпт для підписів до фото</label>
                                    <textarea
                                        style={{ ...inputStyle, height: '120px', resize: 'none' }}
                                        value={formData.ai_caption_prompt}
                                        onChange={e => setFormData({ ...formData, ai_caption_prompt: e.target.value })}
                                        placeholder="Look at this photo. Suggest 3 short, warm Ukrainian captions..."
                                    />
                                </div>
                                <div style={fieldGroup}>
                                    <label style={labelStyle}>Промпт для вступу (Dedication)</label>
                                    <textarea
                                        style={{ ...inputStyle, height: '120px', resize: 'none' }}
                                        value={formData.ai_intro_prompt}
                                        onChange={e => setFormData({ ...formData, ai_intro_prompt: e.target.value })}
                                        placeholder="Write a warm dedication text in Ukrainian for this photobook..."
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'pricing' && (
                            <div style={tabPanelStyle}>
                                <div style={fieldRow}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Базова ціна (з дефолтними стор)</label>
                                        <input type="number" style={inputStyle} value={formData.base_price} onChange={e => setFormData({ ...formData, base_price: parseFloat(e.target.value) })} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Ціна за дод. сторінку</label>
                                        <input type="number" style={inputStyle} value={formData.price_per_page} onChange={e => setFormData({ ...formData, price_per_page: parseFloat(e.target.value) })} />
                                    </div>
                                </div>
                                <div style={fieldGroup}>
                                    <label style={labelStyle}>Примітка про ціну (для клієнта)</label>
                                    <input style={inputStyle} value={formData.pricing_note} onChange={e => setFormData({ ...formData, pricing_note: e.target.value })} placeholder="Ціна включає тверду обкладинку..." />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={footerStyle}>
                    <button onClick={onClose} style={cancelBtnStyle}>Скасувати</button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={saveBtnStyle}
                    >
                        {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                        Зберегти налаштування
                    </button>
                </div>
            </div>
        </div>
    );
}

// Styles
const overlayStyle: any = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' };
const modalStyle: any = { backgroundColor: 'white', width: '900px', maxWidth: '95vw', height: '80vh', borderRadius: '32px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' };
const headerStyle: any = { padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const sidebarContainerStyle: any = { flex: 1, display: 'flex', overflow: 'hidden' };
const sidebarStyle: any = { width: '220px', borderRight: '1px solid #f1f5f9', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: '#fcfcfd' };
const contentStyle: any = { flex: 1, padding: '32px', overflowY: 'auto', backgroundColor: '#fff' };
const footerStyle: any = { padding: '20px 32px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#fcfcfd' };
const tabBtnStyle: any = { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '12px', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '14px', fontWeight: 700, transition: 'all 0.2s' };
const tabPanelStyle: any = { display: 'flex', flexDirection: 'column', gap: '20px' };
const fieldGroup: any = { display: 'flex', flexDirection: 'column', gap: '8px' };
const fieldRow: any = { display: 'flex', gap: '20px' };
const labelStyle: any = { fontSize: '13px', fontWeight: 800, color: '#1e293b' };
const inputStyle: any = { padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '15px', outline: 'none', width: '100%', transition: 'border-color 0.2s' };
const checkLabel: any = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' };
const cardItemStyle: any = { display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9' };
const addMoreBtn: any = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', border: '1.5px dashed #cbd5e1', borderRadius: '12px', background: 'none', color: '#64748b', fontSize: '13px', fontWeight: 700, cursor: 'pointer', justifyContent: 'center' };
const saveBtnStyle: any = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 800, cursor: 'pointer' };
const cancelBtnStyle: any = { padding: '12px 24px', borderRadius: '12px', border: 'none', backgroundColor: 'transparent', color: '#64748b', fontWeight: 700, cursor: 'pointer' };
const closeBtnStyle: any = { padding: '8px', borderRadius: '10px', backgroundColor: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer' };
