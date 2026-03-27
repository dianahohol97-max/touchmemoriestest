'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Activity, Eye, Calendar } from 'lucide-react';

interface Banner {
    id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    link_url: string | null;
    link_text: string;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    display_location: string;
    display_order: number;
    background_color: string;
    text_color: string;
}

export default function BannersManagementPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [banners, setBanners] = useState<Banner[]>([]);

    useEffect(() => {
        fetchBanners();
    }, []);

    async function fetchBanners() {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('promotional_banners')
                .select('*')
                .order('display_order');

            if (data) setBanners(data);
        } catch (error) {
            console.error('Error fetching banners:', error);
            toast.error('Помилка завантаження банерів');
        } finally {
            setLoading(false);
        }
    }

    async function addBanner() {
        try {
            const maxOrder = Math.max(...banners.map(b => b.display_order), 0);
            const { data, error } = await supabase
                .from('promotional_banners')
                .insert({
                    title: 'Новий банер',
                    description: 'Опис банера',
                    link_text: 'Дізнатися більше',
                    display_order: maxOrder + 1,
                    is_active: false,
                    display_location: 'homepage',
                    background_color: '#f3f4f6',
                    text_color: '#1f2937'
                })
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setBanners([...banners, data]);
                toast.success('Банер додано');
            }
        } catch (error) {
            console.error('Error adding banner:', error);
            toast.error('Помилка додавання банера');
        }
    }

    function updateBanner(id: string, field: keyof Banner, value: any) {
        setBanners(banners.map(b => b.id === id ? { ...b, [field]: value } : b));
    }

    async function saveBanner(id: string) {
        setSaving(true);
        try {
            const banner = banners.find(b => b.id === id);
            if (!banner) return;

            const { error } = await supabase
                .from('promotional_banners')
                .update({
                    title: banner.title,
                    description: banner.description,
                    image_url: banner.image_url,
                    link_url: banner.link_url,
                    link_text: banner.link_text,
                    start_date: banner.start_date,
                    end_date: banner.end_date,
                    is_active: banner.is_active,
                    display_location: banner.display_location,
                    display_order: banner.display_order,
                    background_color: banner.background_color,
                    text_color: banner.text_color
                })
                .eq('id', id);

            if (error) throw error;
            toast.success('Банер збережено');
        } catch (error) {
            console.error('Error saving banner:', error);
            toast.error('Помилка збереження');
        } finally {
            setSaving(false);
        }
    }

    async function deleteBanner(id: string) {
        try {
            const { error } = await supabase
                .from('promotional_banners')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setBanners(banners.filter(b => b.id !== id));
            toast.success('Банер видалено');
        } catch (error) {
            console.error('Error deleting banner:', error);
            toast.error('Помилка видалення');
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Activity className="animate-spin" size={48} color="#263A99" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Управління банерами</h1>
                <p className="text-gray-600">Створюйте та керуйте рекламними банерами з розкладом показу</p>
            </div>

            <div className="flex justify-end mb-6">
                <button
                    onClick={addBanner}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#162159] transition-colors"
                >
                    <Plus size={18} />
                    Додати банер
                </button>
            </div>

            <div className="space-y-6">
                {banners.map((banner) => (
                    <div key={banner.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Заголовок
                                </label>
                                <input
                                    type="text"
                                    value={banner.title}
                                    onChange={(e) => updateBanner(banner.id, 'title', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Опис
                                </label>
                                <textarea
                                    value={banner.description || ''}
                                    onChange={(e) => updateBanner(banner.id, 'description', e.target.value)}
                                    rows={2}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    URL зображення
                                </label>
                                <input
                                    type="text"
                                    value={banner.image_url || ''}
                                    onChange={(e) => updateBanner(banner.id, 'image_url', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Посилання
                                </label>
                                <input
                                    type="text"
                                    value={banner.link_url || ''}
                                    onChange={(e) => updateBanner(banner.id, 'link_url', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Текст кнопки
                                </label>
                                <input
                                    type="text"
                                    value={banner.link_text}
                                    onChange={(e) => updateBanner(banner.id, 'link_text', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Розташування
                                </label>
                                <select
                                    value={banner.display_location}
                                    onChange={(e) => updateBanner(banner.id, 'display_location', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]"
                                >
                                    <option value="homepage">Головна сторінка</option>
                                    <option value="catalog">Каталог</option>
                                    <option value="checkout">Оформлення замовлення</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                    <Calendar size={16} />
                                    Дата початку
                                </label>
                                <input
                                    type="datetime-local"
                                    value={banner.start_date ? new Date(banner.start_date).toISOString().slice(0, 16) : ''}
                                    onChange={(e) => updateBanner(banner.id, 'start_date', e.target.value || null)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                    <Calendar size={16} />
                                    Дата завершення
                                </label>
                                <input
                                    type="datetime-local"
                                    value={banner.end_date ? new Date(banner.end_date).toISOString().slice(0, 16) : ''}
                                    onChange={(e) => updateBanner(banner.id, 'end_date', e.target.value || null)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={banner.is_active}
                                        onChange={(e) => updateBanner(banner.id, 'is_active', e.target.checked)}
                                        className="w-4 h-4 text-[#1e2d7d] border-gray-300 rounded"
                                    />
                                    <label className="text-sm font-medium text-gray-700">
                                        <Eye size={16} className="inline mr-1" />
                                        Активний
                                    </label>
                                </div>
                                <div>
                                    <input
                                        type="number"
                                        value={banner.display_order}
                                        onChange={(e) => updateBanner(banner.id, 'display_order', parseInt(e.target.value))}
                                        className="w-20 px-3 py-1 text-sm border border-gray-300 rounded-lg"
                                        placeholder="Порядок"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => saveBanner(banner.id)}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#162159] disabled:opacity-50"
                                >
                                    {saving ? (
                                        <Activity className="animate-spin" size={16} />
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            Зберегти
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => deleteBanner(banner.id)}
                                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                                >
                                    <Trash2 size={16} />
                                    Видалити
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {banners.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                        <Calendar size={48} className="mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600 font-medium">Банери не додано</p>
                        <p className="text-sm text-gray-500 mt-1">Натисніть "Додати банер" для створення першого банера</p>
                    </div>
                )}
            </div>
        </div>
    );
}
