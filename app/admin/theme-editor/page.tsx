'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Save, Settings2, Layers, Type, Paintbrush, Image as ImageIcon, Loader2, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

export default function ThemeEditorPage() {
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);

    // States
    const [theme, setTheme] = useState<Record<string, any>>({});
    const [blocks, setBlocks] = useState<any[]>([]);
    const [content, setContent] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [personalizedProducts, setPersonalizedProducts] = useState<any[]>([]);
    const [calcConfig, setCalcConfig] = useState<any>({ products: [] });
    const [testimonials, setTestimonials] = useState<any[]>([]);

    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [themeRes, blocksRes, contentRes, categoriesRes, productsRes] = await Promise.all([
                    supabase.from('theme_settings').select('*').limit(1).single(),
                    supabase.from('site_blocks').select('*').order('position_order', { ascending: true }),
                    supabase.from('site_content').select('*'),
                    supabase.from('categories').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
                    supabase.from('products').select('*').eq('is_personalized', true).eq('is_active', true).order('name', { ascending: true })
                ]);

                if (themeRes.data) setTheme(themeRes.data);
                if (blocksRes.data) setBlocks(blocksRes.data);
                if (contentRes.data) {
                    setContent(contentRes.data);
                    const calcItem = contentRes.data.find((p: any) => p.key === 'calculator_config');
                    if (calcItem && calcItem.value) {
                        try { setCalcConfig(JSON.parse(calcItem.value)); } catch (e) { console.error('Failed to parse calc config', e); }
                    }
                    const testItem = contentRes.data.find((p: any) => p.key === 'testimonials_json');
                    if (testItem && testItem.value) {
                        try { setTestimonials(JSON.parse(testItem.value)); } catch (e) { console.error('Failed to parse testimonials', e); }
                    }
                }
                if (categoriesRes.data) setCategories(categoriesRes.data);
                if (productsRes?.data) setPersonalizedProducts(productsRes.data);
            } catch (error) {
                console.error('Failed to load theme data:', error);
                toast.error('Помилка завантаження даних');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Sync with Live Preview Iframe
    useEffect(() => {
        if (!loading && iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'VISUAL_PREVIEW_UPDATE',
                theme,
                blocks,
                content
            }, '*');
        }
    }, [theme, blocks, content, loading]);

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Theme
            if (theme.id) {
                await supabase.from('theme_settings').update(theme).eq('id', theme.id);
            } else {
                await supabase.from('theme_settings').insert(theme);
            }

            // 2. Blocks
            for (const block of blocks) {
                await supabase.from('site_blocks').update({
                    is_visible: block.is_visible,
                    position_order: block.position_order,
                    style_metadata: block.style_metadata
                }).eq('id', block.id);
            }

            // 3. Content - handle new items
            const toUpdate = [];
            const toInsert = [];
            for (const item of content) {
                if (item.id) toUpdate.push(item);
                else toInsert.push({ key: item.key, value: String(item.value) });
            }

            for (const item of toUpdate) {
                await supabase.from('site_content').update({ value: String(item.value) }).eq('id', item.id);
            }
            if (toInsert.length > 0) {
                await supabase.from('site_content').insert(toInsert);
            }

            // 4. Trigger Revalidation
            await fetch('/api/admin/revalidate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: '/' })
            });

            toast.success('Зміни успішно збережено!');
        } catch (error) {
            toast.error('Помилка збереження');
        } finally {
            setSaving(false);
        }
    };

    const handleContentChange = (key: string, value: string) => {
        setContent(prev => {
            const exists = prev.find(p => p.key === key);
            if (exists) return prev.map(p => p.key === key ? { ...p, value } : p);
            return [...prev, { key, value }];
        });
    };

    const getContentValue = (key: string) => {
        const item = content.find(p => p.key === key);
        return item ? item.value : '';
    };

    const handleCalcConfigChange = (newConfig: any) => {
        setCalcConfig(newConfig);
        handleContentChange('calculator_config', JSON.stringify(newConfig));
    };

    const handleTestimonialsChange = (newTestimonials: any[]) => {
        setTestimonials(newTestimonials);
        handleContentChange('testimonials_json', JSON.stringify(newTestimonials));
    };

    const handleImageUpload = async (key: string, file: File) => {
        setUploading(key);
        try {
            const ext = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
            const { error } = await supabaseAdmin.storage.from('products').upload(`site/${fileName}`, file);
            if (error) throw error;

            const { data } = supabase.storage.from('products').getPublicUrl(`site/${fileName}`);
            handleContentChange(key, data.publicUrl);
            toast.success('Фото завантажено!');
        } catch (error) {
            toast.error('Помилка завантаження фото');
        } finally {
            setUploading(null);
        }
    };

    const moveBlock = (id: string, direction: 'up' | 'down') => {
        setBlocks(prev => {
            const sorted = [...prev].sort((a, b) => (a.position_order || 0) - (b.position_order || 0));
            const index = sorted.findIndex(b => b.id === id);
            if (index === -1) return prev;

            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= sorted.length) return prev;

            const result = [...sorted];
            const [removed] = result.splice(index, 1);
            result.splice(newIndex, 0, removed);

            // Re-assign position_order as sequential (10, 20, 30...) to avoid collisions
            return result.map((b, i) => ({ ...b, position_order: (i + 1) * 10 }));
        });
    };

    if (loading) return <div style={{ padding: '40px', color: '#64748b' }}>Завантаження редактора...</div>;

    const accordionStyle = { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px' };
    const summaryStyleWrapper = { padding: '14px 16px', backgroundColor: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderBottom: '1px solid #e2e8f0', margin: 0 };
    const contentStyle = { padding: '16px', display: 'flex', flexDirection: 'column' as const, gap: '16px' };
    const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' as const };
    const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' };

    const renderInput = (key: string, label: string, type: 'text' | 'textarea' = 'text') => (
        <div>
            <label style={labelStyle}>{label}</label>
            {type === 'text' ? (
                <input type="text" value={getContentValue(key)} onChange={e => handleContentChange(key, e.target.value)} style={inputStyle} />
            ) : (
                <textarea rows={3} value={getContentValue(key)} onChange={e => handleContentChange(key, e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
            )}
        </div>
    );

    const renderImageInput = (key: string, label: string) => (
        <div>
            <label style={labelStyle}>{label}</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {getContentValue(key) && (
                    <img src={getContentValue(key)} alt="" style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} />
                )}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#263A99', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    {uploading === key ? <Loader2 size={16} className="spin" /> : <ImageIcon size={16} />}
                    {uploading === key ? 'Завантаження...' : 'Завантажити нове'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(key, e.target.files[0]) }} />
                </label>
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 64px)', margin: '-24px', backgroundColor: '#f1f5f9' }}>
            {/* Left Sidebar Controls */}
            <div style={{ width: '380px', flexShrink: 0, borderRight: '1px solid #e2e8f0', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' }}>
                    <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Paintbrush size={20} color="#263A99" /> Редактор</h1>
                    <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', backgroundColor: '#263A99', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Save size={16} /> {saving ? 'Збереження...' : 'Зберегти'}
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Paintbrush size={16} color="#263A99" /> Стиль карток</summary>
                        <div style={contentStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={labelStyle}>Заокруглення (px)</label>
                                <input type="text" value={theme.card_settings?.card_border_radius || '12px'} onChange={(e) => setTheme({ ...theme, card_settings: { ...theme.card_settings, card_border_radius: e.target.value } })} style={{ ...inputStyle, width: '80px' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={labelStyle}>Фон картки</label>
                                <input type="color" value={theme.card_settings?.card_bg_color || '#ffffff'} onChange={(e) => setTheme({ ...theme, card_settings: { ...theme.card_settings, card_bg_color: e.target.value } })} style={{ width: '30px', height: '30px', border: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={labelStyle}>Текст картки</label>
                                <input type="color" value={theme.card_settings?.card_text_color || '#263A99'} onChange={(e) => setTheme({ ...theme, card_settings: { ...theme.card_settings, card_text_color: e.target.value } })} style={{ width: '30px', height: '30px', border: 'none' }} />
                            </div>
                        </div>
                    </details>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Type size={16} color="#263A99" /> Типографія</summary>
                        <div style={contentStyle}>
                            <div>
                                <label style={labelStyle}>Шрифт заголовків</label>
                                <select value={theme.typography?.heading_font || 'Montserrat'} onChange={e => setTheme({ ...theme, typography: { ...theme.typography, heading_font: e.target.value } })} style={inputStyle}>
                                    <option value="Montserrat">Montserrat</option>
                                    <option value="Open Sans">Open Sans</option>
                                    <option value="Playfair Display">Playfair Display</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Шрифт тексту (Основний)</label>
                                <select value={theme.typography?.body_font || 'Open Sans'} onChange={e => setTheme({ ...theme, typography: { ...theme.typography, body_font: e.target.value } })} style={inputStyle}>
                                    <option value="Open Sans">Open Sans</option>
                                    <option value="Inter">Inter</option>
                                    <option value="Manrope">Manrope</option>
                                    <option value="TouchMemories Main">TouchMemories Main (Наш шрифт)</option>
                                </select>
                            </div>
                        </div>
                    </details>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Settings2 size={16} color="#263A99" /> Глобальні кнопки</summary>
                        <div style={contentStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={labelStyle}>Заокруглення (px)</label>
                                <input type="text" value={theme.button_settings?.button_radius || '16px'} onChange={(e) => setTheme({ ...theme, button_settings: { ...theme.button_settings, button_radius: e.target.value } })} style={{ ...inputStyle, width: '80px' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={labelStyle}>Тінь (CSS shadow)</label>
                                <input type="text" value={theme.button_settings?.button_shadow || 'none'} onChange={(e) => setTheme({ ...theme, button_settings: { ...theme.button_settings, button_shadow: e.target.value } })} style={{ ...inputStyle, width: '150px' }} />
                            </div>
                        </div>
                    </details>

                    <h3 style={{ fontSize: '12px', fontWeight: 700, margin: '24px 0 12px 0', color: '#94a3b8', textTransform: 'uppercase' }}>Порядок та Видимість</h3>

                    <details style={accordionStyle} open>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Секції Головної</summary>
                        <div style={contentStyle}>
                            {blocks.sort((a, b) => a.position_order - b.position_order).map((block) => {
                                const labels: Record<string, string> = {
                                    hero: 'Головний екран',
                                    how_it_works: 'Як це працює',
                                    social_proof: 'Відгуки та соцмережі',
                                    final_cta: 'Заклик в підвалі (Footer CTA)',
                                    featured_products: 'Популярні товари',
                                    categories: 'Категорії (Всі)',
                                    categories_books: 'Категорії: Фотокниги',
                                    categories_magazines: 'Категорії: Журнали',
                                    travel: 'Travel Book (Подорожі)',
                                    price_calculator: 'Калькулятор ціни',
                                    blog: 'Блог: Останні статті',
                                    promo_special: 'Акція (Спеціальна)',
                                    promo_holiday: 'Акція (Святкова)',
                                    promo_new_arrival: 'Акція (Новинка)',
                                    promo_sale: 'Акція (Розпродаж)',
                                    photo_print: 'Замовити фотодрук',
                                    custom_book: 'Замовити книгу побажань',
                                    footer: 'Підвал (Footer)'
                                };
                                return (
                                    <div key={block.id} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', backgroundColor: '#f8fafc', borderBottom: block.expanded ? '1px solid #e2e8f0' : 'none' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{labels[block.block_name] || block.block_name}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <button onClick={() => moveBlock(block.id, 'up')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: 0.6 }} title="Вгору">
                                                        <ArrowUp size={14} />
                                                    </button>
                                                    <button onClick={() => moveBlock(block.id, 'down')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: 0.6 }} title="Вниз">
                                                        <ArrowDown size={14} />
                                                    </button>
                                                </div>
                                                <button onClick={() => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, expanded: !b.expanded } : b))} style={{ fontSize: '11px', color: '#263A99', background: 'none', border: 'none', cursor: 'pointer' }}>Едіт стилю</button>
                                                <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={block.is_visible} onChange={e => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, is_visible: e.target.checked } : b))} />
                                                    Вкл
                                                </label>
                                                <input type="number" value={block.position_order} onChange={e => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, position_order: parseInt(e.target.value) || 0 } : b))} style={{ width: '40px', padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', textAlign: 'center', fontSize: '11px' }} />
                                            </div>
                                        </div>
                                        {block.expanded && (
                                            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <label style={{ fontSize: '12px' }}>Фон секції</label>
                                                    <input type="color" value={block.style_metadata?.bg_color || '#ffffff'} onChange={e => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, style_metadata: { ...b.style_metadata, bg_color: e.target.value } } : b))} style={{ width: '20px', height: '20px', border: 'none' }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <label style={{ fontSize: '12px' }}>Колір тексту</label>
                                                    <input type="color" value={block.style_metadata?.text_color || '#000000'} onChange={e => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, style_metadata: { ...b.style_metadata, text_color: e.target.value } } : b))} style={{ width: '20px', height: '20px', border: 'none' }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <label style={{ fontSize: '12px' }}>Колір заголовків</label>
                                                    <input type="color" value={block.style_metadata?.heading_color || '#000000'} onChange={e => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, style_metadata: { ...b.style_metadata, heading_color: e.target.value } } : b))} style={{ width: '20px', height: '20px', border: 'none' }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <label style={{ fontSize: '12px' }}>Фон кнопок</label>
                                                    <input type="color" value={block.style_metadata?.button_bg || '#000000'} onChange={e => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, style_metadata: { ...b.style_metadata, button_bg: e.target.value } } : b))} style={{ width: '20px', height: '20px', border: 'none' }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <label style={{ fontSize: '12px' }}>Колір тексту кнопок</label>
                                                    <input type="color" value={block.style_metadata?.button_text || '#ffffff'} onChange={e => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, style_metadata: { ...b.style_metadata, button_text: e.target.value } } : b))} style={{ width: '20px', height: '20px', border: 'none' }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <label style={{ fontSize: '12px' }}>Заокруглення (px)</label>
                                                    <input type="number" value={parseInt(block.style_metadata?.border_radius) || 0} onChange={e => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, style_metadata: { ...b.style_metadata, border_radius: e.target.value + 'px' } } : b))} style={{ width: '50px', padding: '2px', border: '1px solid #e2e8f0' }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <label style={{ fontSize: '12px' }}>Паддінг (вверх/вниз px)</label>
                                                    <input type="number" value={parseInt(block.style_metadata?.padding_y) || 40} onChange={e => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, style_metadata: { ...b.style_metadata, padding_y: e.target.value + 'px' } } : b))} style={{ width: '50px', padding: '2px', border: '1px solid #e2e8f0' }} />
                                                </div>
                                                {block.block_name === 'hero' && (
                                                    <>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <label style={{ fontSize: '12px' }}>Фон малих кнопок Hero</label>
                                                            <input type="color" value={block.style_metadata?.hero_btn_bg || '#ffffff'} onChange={e => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, style_metadata: { ...b.style_metadata, hero_btn_bg: e.target.value } } : b))} style={{ width: '20px', height: '20px', border: 'none' }} />
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <label style={{ fontSize: '12px' }}>Текст малих кнопок Hero</label>
                                                            <input type="color" value={block.style_metadata?.hero_btn_text || '#000000'} onChange={e => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, style_metadata: { ...b.style_metadata, hero_btn_text: e.target.value } } : b))} style={{ width: '20px', height: '20px', border: 'none' }} />
                                                        </div>
                                                    </>
                                                )}
                                                {block.block_name === 'price_calculator' && (
                                                    <>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <label style={{ fontSize: '12px' }}>Фон картки</label>
                                                            <input type="color" value={block.style_metadata?.card_bg || '#ffffff'} onChange={e => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, style_metadata: { ...b.style_metadata, card_bg: e.target.value } } : b))} style={{ width: '20px', height: '20px', border: 'none' }} />
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <label style={{ fontSize: '12px' }}>Тінь картки</label>
                                                            <input type="text" value={block.style_metadata?.card_shadow || '0 20px 50px rgba(0,0,0,0.05)'} onChange={e => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, style_metadata: { ...b.style_metadata, card_shadow: e.target.value } } : b))} style={{ width: '100px', fontSize: '11px', padding: '2px' }} />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </details>

                    <h3 style={{ fontSize: '12px', fontWeight: 700, margin: '24px 0 12px 0', color: '#94a3b8', textTransform: 'uppercase' }}>Контент Секцій</h3>

                    {/* Promos */}
                    {[
                        { id: 'promo_special', label: 'Акція (Спеціальна)' },
                        { id: 'promo_holiday', label: 'Акція (Святкова)' },
                        { id: 'promo_new_arrival', label: 'Акція (Новинка)' },
                        { id: 'promo_sale', label: 'Акція (Розпродаж)' }
                    ].map(promo => (
                        <details key={promo.id} style={accordionStyle}>
                            <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> {promo.label}</summary>
                            <div style={contentStyle}>
                                {renderInput(`${promo.id}_title`, 'Заголовок')}
                                {renderInput(`${promo.id}_subtitle`, 'Підзаголовок', 'textarea')}
                                {renderInput(`${promo.id}_button`, 'Текст кнопки')}
                                {renderImageInput(`${promo.id}_image_url`, 'Фото')}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                    <label style={labelStyle}>Реверс (фото справа)</label>
                                    <input type="checkbox" checked={blocks.find(b => b.block_name === promo.id)?.style_metadata?.reverse} onChange={e => setBlocks(prev => prev.map(b => b.block_name === promo.id ? { ...b, style_metadata: { ...b.style_metadata, reverse: e.target.checked } } : b))} />
                                </div>
                            </div>
                        </details>
                    ))}

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Головний екран (Hero)</summary>
                        <div style={contentStyle}>
                            {renderInput('hero_overline', 'Надзаголовок (малий текст)')}
                            {renderInput('hero_title', 'Головний заголовок', 'textarea')}
                            {renderInput('hero_subtitle', 'Підзаголовок', 'textarea')}
                            {renderInput('hero_button_text', 'Текст кнопки')}
                            {renderImageInput('hero_image_url', 'Фонове фото секції')}
                        </div>
                    </details>


                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Популярні Товари</summary>
                        <div style={contentStyle}>
                            {renderInput('featured_title', 'Заголовок')}
                            {renderInput('featured_subtitle', 'Підзаголовок')}
                        </div>
                    </details>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Категорії: Фотокниги (Books)</summary>
                        <div style={contentStyle}>
                            {renderInput('categories_books_title', 'Заголовок')}
                            {renderInput('categories_books_subtitle', 'Підзаголовок')}
                            <div style={{ marginTop: '12px' }}>
                                <label style={labelStyle}>Категорія</label>
                                <select
                                    value={getContentValue('categories_books_slug')}
                                    onChange={e => handleContentChange('categories_books_slug', e.target.value)}
                                    style={inputStyle}
                                >
                                    <option value="">Оберіть категорію</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.slug}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginTop: '12px' }}>
                                {renderImageInput('categories_books_image', 'Фото')}
                                {renderInput('categories_books_embed', 'Embed (iframe)', 'textarea')}
                            </div>
                        </div>
                    </details>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Категорії: Журнали (Magazines)</summary>
                        <div style={contentStyle}>
                            {renderInput('categories_magazines_title', 'Заголовок')}
                            {renderInput('categories_magazines_subtitle', 'Підзаголовок')}
                            <div style={{ marginTop: '12px' }}>
                                <label style={labelStyle}>Категорія</label>
                                <select
                                    value={getContentValue('categories_magazines_slug')}
                                    onChange={e => handleContentChange('categories_magazines_slug', e.target.value)}
                                    style={inputStyle}
                                >
                                    <option value="">Оберіть категорію</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.slug}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginTop: '12px' }}>
                                {renderImageInput('categories_magazines_image', 'Фото')}
                                {renderInput('categories_magazines_embed', 'Embed (iframe)', 'textarea')}
                            </div>
                        </div>
                    </details>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Як це працює</summary>
                        <div style={contentStyle}>
                            {renderInput('how_title', 'Заголовок секції')}
                            {renderInput('how_subtitle', 'Підзаголовок секції')}
                            <hr style={{ borderColor: '#f1f5f9', width: '100%', margin: '12px 0' }} />
                            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '8px 0', color: '#263A99' }}>Крок 1</h4>
                            {renderInput('how_step1_title', 'Заголовок кроку 1')}
                            {renderInput('how_step1_text', 'Опис кроку 1', 'textarea')}
                            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '8px 0', color: '#263A99' }}>Крок 2</h4>
                            {renderInput('how_step2_title', 'Заголовок кроку 2')}
                            {renderInput('how_step2_text', 'Опис кроку 2', 'textarea')}
                            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '8px 0', color: '#263A99' }}>Крок 3</h4>
                            {renderInput('how_step3_title', 'Заголовок кроку 3')}
                            {renderInput('how_step3_text', 'Опис кроку 3', 'textarea')}
                        </div>
                    </details>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Відгуки</summary>
                        <div style={contentStyle}>
                            {renderInput('testimonials_title', 'Заголовок секції')}
                            {renderInput('testimonials_subtitle', 'Підзаголовок секції')}
                            <hr style={{ borderColor: '#f1f5f9', width: '100%', margin: '12px 0' }} />
                            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '8px 0', color: '#263A99' }}>Список відгуків</h4>
                            {testimonials.map((test: any, tIdx: number) => (
                                <div key={tIdx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '12px', backgroundColor: '#fcfcfc' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <input
                                            value={test.name}
                                            onChange={e => {
                                                const newTests = [...testimonials];
                                                newTests[tIdx].name = e.target.value;
                                                handleTestimonialsChange(newTests);
                                            }}
                                            placeholder="Ім'я"
                                            style={{ ...inputStyle, width: '70%', fontWeight: 700 }}
                                        />
                                        <button
                                            onClick={() => {
                                                const newTests = testimonials.filter((_, i) => i !== tIdx);
                                                handleTestimonialsChange(newTests);
                                            }}
                                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                        >
                                            Видалити
                                        </button>
                                    </div>
                                    <textarea
                                        value={test.text}
                                        onChange={e => {
                                            const newTests = [...testimonials];
                                            newTests[tIdx].text = e.target.value;
                                            handleTestimonialsChange(newTests);
                                        }}
                                        placeholder="Текст відгуку"
                                        style={{ ...inputStyle, height: '60px', marginBottom: '8px' }}
                                    />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <input
                                            value={test.city}
                                            onChange={e => {
                                                const newTests = [...testimonials];
                                                newTests[tIdx].city = e.target.value;
                                                handleTestimonialsChange(newTests);
                                            }}
                                            placeholder="Місто"
                                            style={inputStyle}
                                        />
                                        <input
                                            type="number"
                                            min="1"
                                            max="5"
                                            value={test.rating}
                                            onChange={e => {
                                                const newTests = [...testimonials];
                                                newTests[tIdx].rating = Number(e.target.value);
                                                handleTestimonialsChange(newTests);
                                            }}
                                            placeholder="Рейтинг (1-5)"
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => {
                                    const newTest = { name: 'Новий відгук', text: '', city: '', rating: 5 };
                                    handleTestimonialsChange([...testimonials, newTest]);
                                }}
                                style={{ width: '100%', padding: '10px', backgroundColor: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#475569', fontWeight: 600, cursor: 'pointer', marginTop: '8px' }}
                            >
                                + Додати відгук
                            </button>
                        </div>
                    </details>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Travel Book / Top Locations</summary>
                        <div style={contentStyle}>
                            {renderInput('travel_title', 'Заголовок секції')}
                            {renderInput('travel_subtitle', 'Підзаголовок секції')}
                            <hr style={{ borderColor: '#f1f5f9', width: '100%', margin: '12px 0' }} />
                            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '8px 0', color: '#263A99' }}>Опис Travel Book</h4>
                            {renderInput('travel_text', 'Текст опису', 'textarea')}
                            {renderInput('travel_button_text', 'Текст кнопки')}
                            {renderImageInput('travel_image_url', 'Фото')}
                            <hr style={{ borderColor: '#f1f5f9', width: '100%', margin: '12px 0' }} />
                            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '8px 0', color: '#263A99' }}>Top Locations Block</h4>
                            {renderInput('travel_locations_title', 'Заголовок локацій')}
                            {renderInput('travel_locations_desc', 'Опис локацій', 'textarea')}
                            {renderInput('travel_embed', 'Embed (iframe)', 'textarea')}
                        </div>
                    </details>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Калькулятор цін</summary>
                        <div style={contentStyle}>
                            {renderInput('calc_title', 'Заголовок')}
                            {renderInput('calc_subtitle', 'Підзаголовок')}
                            {renderInput('calc_embed', 'Embed (iframe)', 'textarea')}

                            <hr style={{ borderColor: '#f1f5f9', width: '100%', margin: '12px 0' }} />
                            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '8px 0', color: '#263A99' }}>Товари в калькуляторі</h4>

                            {personalizedProducts.map(prod => {
                                const config = (calcConfig?.products || []).find((p: any) => p.id === prod.id) || { id: prod.id, isActive: false, productionTime: '3-5 робочих днів' };

                                const handleUpdate = (updates: any) => {
                                    const newProds = [...(calcConfig?.products || [])];
                                    const existingIdx = newProds.findIndex((p: any) => p.id === prod.id);
                                    if (existingIdx >= 0) {
                                        newProds[existingIdx] = { ...newProds[existingIdx], ...updates };
                                    } else {
                                        newProds.push({ id: prod.id, ...updates });
                                    }
                                    handleCalcConfigChange({ ...calcConfig, products: newProds });
                                };

                                return (
                                    <div key={prod.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '12px', backgroundColor: '#fcfcfc' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: config.isActive ? '12px' : '0' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={config.isActive}
                                                    onChange={e => handleUpdate({ isActive: e.target.checked, productionTime: config.productionTime || '3-5 робочих днів' })}
                                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                />
                                                <span style={{ fontWeight: 700, fontSize: '14px' }}>{prod.name}</span>
                                            </div>
                                        </div>

                                        {config.isActive && (
                                            <div>
                                                <label style={labelStyle}>Термін виготовлення</label>
                                                <input
                                                    value={config.productionTime || ''}
                                                    onChange={e => handleUpdate({ productionTime: e.target.value, isActive: true })}
                                                    placeholder="Напр. 3-5 робочих днів"
                                                    style={inputStyle}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </details>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Блог</summary>
                        <div style={contentStyle}>
                            {renderInput('blog_title', 'Заголовок')}
                            {renderInput('blog_subtitle', 'Підзаголовок')}
                        </div>
                    </details>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Замовити фотодрук (Photo Print Promo)</summary>
                        <div style={contentStyle}>
                            {renderInput('photoprint_title', 'Заголовок')}
                            {renderInput('photoprint_subtitle', 'Підзаголовок', 'textarea')}
                            {renderInput('photoprint_button_text', 'Текст кнопки')}
                            {renderInput('photoprint_button_url', 'URL кнопки')}
                            {renderInput('photoprint_embed', 'Embed (iframe)', 'textarea')}
                            {renderImageInput('photoprint_image_url', 'Фото')}
                        </div>
                    </details>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Замовити книгу побажань (Custom Book Promo)</summary>
                        <div style={contentStyle}>
                            {renderInput('custombook_title', 'Заголовок')}
                            {renderInput('custombook_subtitle', 'Підзаголовок', 'textarea')}
                            {renderInput('custombook_button_text', 'Текст кнопки')}
                            {renderInput('custombook_button_url', 'URL кнопки')}
                            {renderInput('custombook_embed', 'Embed (iframe)', 'textarea')}
                            {renderImageInput('custombook_image_url', 'Фото')}
                        </div>
                    </details>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Підвал (Footer CTA)</summary>
                        <div style={contentStyle}>
                            {renderInput('cta_title', 'Головний заклик')}
                            {renderInput('cta_subtitle', 'Підзаголовок', 'textarea')}
                            {renderInput('cta_button_text', 'Кнопка')}
                        </div>
                    </details>


                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Social Proof / Instagram</summary>
                        <div style={contentStyle}>
                            {renderInput('social_proof_title', 'Заголовок')}
                            {renderInput('social_proof_subtitle', 'Підзаголовок', 'textarea')}
                            {renderInput('social_proof_handle', 'Instagram Handle (@...)')}
                        </div>
                    </details>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Final CTA (Перед підвалом)</summary>
                        <div style={contentStyle}>
                            {renderInput('final_cta_title', 'Заголовок')}
                            {renderInput('final_cta_subtitle', 'Підзаголовок', 'textarea')}
                            {renderInput('final_cta_button', 'Текст кнопки')}
                            {renderInput('final_cta_url', 'URL за посиланням')}
                            {renderInput('final_cta_embed', 'Embed (iframe)', 'textarea')}
                        </div>
                    </details>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Політика та Оферта (Юридичний контент)</summary>
                        <div style={contentStyle}>
                            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '8px 0', color: '#263A99' }}>Політика конфіденційності</h4>
                            {renderInput('privacy_policy', 'Текст (HTML доступний)', 'textarea')}

                            <hr style={{ borderColor: '#f1f5f9', width: '100%', margin: '16px 0' }} />
                            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '8px 0', color: '#263A99' }}>Публічна оферта</h4>
                            {renderInput('public_offer', 'Текст (HTML доступний)', 'textarea')}
                        </div>
                    </details>

                    <details style={accordionStyle}>
                        <summary style={summaryStyleWrapper}><Layers size={16} color="#263A99" /> Футер (Footer Content)</summary>
                        <div style={contentStyle}>
                            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '8px 0', color: '#263A99' }}>Бренд та Опис</h4>
                            {renderInput('footer_brand_name', 'Назва бренду')}
                            {renderInput('footer_brand_desc', 'Опис бренду', 'textarea')}
                            {renderInput('footer_copyright', 'Копірайт текст')}

                            <hr style={{ borderColor: '#f1f5f9', width: '100%', margin: '16px 0' }} />
                            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '8px 0', color: '#263A99' }}>Контакти</h4>
                            {renderInput('footer_phone', 'Телефон')}
                            {renderInput('footer_email', 'Email')}
                            {renderInput('footer_address', 'Адреса')}

                            <hr style={{ borderColor: '#f1f5f9', width: '100%', margin: '16px 0' }} />
                            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '8px 0', color: '#263A99' }}>Соцмережі (URL)</h4>
                            {renderInput('footer_social_insta', 'Instagram')}
                            {renderInput('footer_social_fb', 'Facebook')}
                            {renderInput('footer_social_tg', 'Telegram')}
                            {renderInput('footer_social_tiktok', 'TikTok')}
                            {renderInput('footer_social_pinterest', 'Pinterest')}
                            {renderInput('footer_social_threads', 'Threads')}

                            <hr style={{ borderColor: '#f1f5f9', width: '100%', margin: '16px 0' }} />
                            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '8px 0', color: '#263A99' }}>Посилання на продукти (JSON)</h4>
                            <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>{'Формат: [{"label": "Назва", "href": "/посилання"}]'}</p>
                            {renderInput('footer_product_links', 'Користувацькі посилання', 'textarea')}
                        </div>
                    </details>

                </div>
            </div>

            {/* Right Live Preview iframe */}
            <div style={{ flex: 1, padding: '24px', display: 'flex', justifyContent: 'center', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                <div style={{ width: '100%', maxWidth: '1280px', height: '100%', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ backgroundColor: '#f1f5f9', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#cbd5e1' }} />
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#cbd5e1' }} />
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#cbd5e1' }} />
                        <span style={{ marginLeft: '16px', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Live Preview (Головна сторінка)</span>
                    </div>
                    <iframe
                        ref={iframeRef}
                        src="/"
                        style={{ width: '100%', flex: 1, border: 'none' }}
                        title="Live Preview"
                    />
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}} />
        </div>
    );
}
