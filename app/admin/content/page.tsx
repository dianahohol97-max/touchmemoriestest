'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
 Save,
    Plus,
    Trash2,
    GripVertical,
    Eye,
    EyeOff,
    FileText,
    Image as ImageIcon,
    Link as LinkIcon,
    Activity
} from 'lucide-react';

interface HeroContent {
    id: string;
    overline_text: string;
    title_line1: string;
    title_line2: string;
    subtitle: string;
    background_image_url: string;
    is_active: boolean;
}

interface HeroButton {
    id: string;
    button_text: string;
    button_url: string;
    display_order: number;
    row_number: number;
    is_active: boolean;
}

interface FeatureCard {
    id: string;
    title: string;
    description: string;
    icon_name: string | null;
    display_order: number;
    is_active: boolean;
}

interface SectionContent {
    id: string;
    section_name: string;
    heading: string | null;
    subheading: string | null;
    body_text: string | null;
    cta_text: string | null;
    cta_url: string | null;
    image_url: string | null;
    is_active: boolean;
    metadata: any;
}

export default function ContentManagementPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'hero' | 'buttons' | 'features' | 'sections'>('hero');

    // Hero content
    const [heroContent, setHeroContent] = useState<HeroContent | null>(null);
    const [heroButtons, setHeroButtons] = useState<HeroButton[]>([]);
    const [featureCards, setFeatureCards] = useState<FeatureCard[]>([]);
    const [sectionContent, setSectionContent] = useState<SectionContent[]>([]);
    const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

    useEffect(() => {
        fetchAllContent();
    }, []);

    async function fetchAllContent() {
        setLoading(true);
        try {
            // Fetch hero content
            const { data: heroData } = await supabase
                .from('hero_content')
                .select('*')
                .single();
            if (heroData) setHeroContent(heroData);

            // Fetch hero buttons
            const { data: buttonsData } = await supabase
                .from('hero_buttons')
                .select('*')
                .order('display_order');
            if (buttonsData) setHeroButtons(buttonsData);

            // Fetch feature cards
            const { data: cardsData } = await supabase
                .from('why_choose_us_cards')
                .select('*')
                .order('display_order');
            if (cardsData) setFeatureCards(cardsData);

            // Fetch section content
            const { data: sectionsData } = await supabase
                .from('section_content')
                .select('*')
                .order('section_name');
            if (sectionsData) setSectionContent(sectionsData);

        } catch (error) {
            console.error('Error fetching content:', error);
            toast.error('Помилка завантаження контенту');
        } finally {
            setLoading(false);
        }
    }

    async function saveHeroContent() {
        if (!heroContent) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('hero_content')
                .update({
                    overline_text: heroContent.overline_text,
                    title_line1: heroContent.title_line1,
                    title_line2: heroContent.title_line2,
                    subtitle: heroContent.subtitle,
                    background_image_url: heroContent.background_image_url,
                    is_active: heroContent.is_active
                })
                .eq('id', heroContent.id);

            if (error) throw error;
            toast.success('Hero секцію збережено');
        } catch (error) {
            console.error('Error saving hero content:', error);
            toast.error('Помилка збереження');
        } finally {
            setSaving(false);
        }
    }

    async function saveHeroButtons() {
        setSaving(true);
        try {
            for (const button of heroButtons) {
                const { error } = await supabase
                    .from('hero_buttons')
                    .update({
                        button_text: button.button_text,
                        button_url: button.button_url,
                        display_order: button.display_order,
                        row_number: button.row_number,
                        is_active: button.is_active
                    })
                    .eq('id', button.id);

                if (error) throw error;
            }
            toast.success('Кнопки збережено');
        } catch (error) {
            console.error('Error saving buttons:', error);
            toast.error('Помилка збереження кнопок');
        } finally {
            setSaving(false);
        }
    }

    async function saveFeatureCards() {
        setSaving(true);
        try {
            for (const card of featureCards) {
                const { error } = await supabase
                    .from('why_choose_us_cards')
                    .update({
                        title: card.title,
                        description: card.description,
                        display_order: card.display_order,
                        is_active: card.is_active
                    })
                    .eq('id', card.id);

                if (error) throw error;
            }
            toast.success('Картки збережено');
        } catch (error) {
            console.error('Error saving cards:', error);
            toast.error('Помилка збереження карток');
        } finally {
            setSaving(false);
        }
    }

    async function addHeroButton() {
        try {
            const maxOrder = Math.max(...heroButtons.map(b => b.display_order), 0);
            const { data, error } = await supabase
                .from('hero_buttons')
                .insert({
                    button_text: 'Нова кнопка',
                    button_url: '/catalog',
                    display_order: maxOrder + 1,
                    row_number: 1,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setHeroButtons([...heroButtons, data]);
                toast.success('Кнопку додано');
            }
        } catch (error) {
            console.error('Error adding button:', error);
            toast.error('Помилка додавання кнопки');
        }
    }

    async function deleteHeroButton(id: string) {
        try {
            const { error } = await supabase
                .from('hero_buttons')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setHeroButtons(heroButtons.filter(b => b.id !== id));
            toast.success('Кнопку видалено');
        } catch (error) {
            console.error('Error deleting button:', error);
            toast.error('Помилка видалення кнопки');
        }
    }

    async function deleteFeatureCard(id: string) {
        try {
            const { error } = await supabase
                .from('why_choose_us_cards')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setFeatureCards(featureCards.filter(c => c.id !== id));
            toast.success('Картку видалено');
        } catch (error) {
            console.error('Error deleting card:', error);
            toast.error('Помилка видалення картки');
        }
    }

    async function addFeatureCard() {
        try {
            const maxOrder = Math.max(...featureCards.map(c => c.display_order), 0);
            const { data, error } = await supabase
                .from('why_choose_us_cards')
                .insert({
                    title: 'Нова перевага',
                    description: 'Опис переваги',
                    display_order: maxOrder + 1,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setFeatureCards([...featureCards, data]);
                toast.success('Картку додано');
            }
        } catch (error) {
            console.error('Error adding card:', error);
            toast.error('Помилка додавання картки');
        }
    }

    async function saveSectionContent(sectionId: string) {
        setSaving(true);
        try {
            const section = sectionContent.find(s => s.id === sectionId);
            if (!section) return;

            const { error } = await supabase
                .from('section_content')
                .update({
                    heading: section.heading,
                    subheading: section.subheading,
                    body_text: section.body_text,
                    cta_text: section.cta_text,
                    cta_url: section.cta_url,
                    image_url: section.image_url,
                    is_active: section.is_active,
                    metadata: section.metadata
                })
                .eq('id', sectionId);

            if (error) throw error;
            toast.success('Секцію збережено');
            setEditingSectionId(null);
        } catch (error) {
            console.error('Error saving section:', error);
            toast.error('Помилка збереження секції');
        } finally {
            setSaving(false);
        }
    }

    function updateSectionField(sectionId: string, field: keyof SectionContent, value: any) {
        setSectionContent(sectionContent.map(section =>
            section.id === sectionId
                ? { ...section, [field]: value }
                : section
        ));
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
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Управління контентом</h1>
                <p className="text-gray-600">Редагуйте всі тексти та зображення на сайті</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('hero')}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                        activeTab === 'hero'
                            ? 'border-[#1e2d7d] text-[#1e2d7d]'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                >
                    Hero секція
                </button>
                <button
                    onClick={() => setActiveTab('buttons')}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                        activeTab === 'buttons'
                            ? 'border-[#1e2d7d] text-[#1e2d7d]'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                >
                    Hero кнопки
                </button>
                <button
                    onClick={() => setActiveTab('features')}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                        activeTab === 'features'
                            ? 'border-[#1e2d7d] text-[#1e2d7d]'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                >
                    Чому обрати нас
                </button>
                <button
                    onClick={() => setActiveTab('sections')}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                        activeTab === 'sections'
                            ? 'border-[#1e2d7d] text-[#1e2d7d]'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                >
                    Інші секції
                </button>
            </div>

            {/* Hero Content Tab */}
            {activeTab === 'hero' && heroContent && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Верхній текст (Overline)
                            </label>
                            <input
                                type="text"
                                value={heroContent.overline_text}
                                onChange={(e) => setHeroContent({ ...heroContent, overline_text: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Заголовок (Рядок 1)
                            </label>
                            <input
                                type="text"
                                value={heroContent.title_line1}
                                onChange={(e) => setHeroContent({ ...heroContent, title_line1: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Заголовок (Рядок 2)
                            </label>
                            <input
                                type="text"
                                value={heroContent.title_line2}
                                onChange={(e) => setHeroContent({ ...heroContent, title_line2: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Підзаголовок
                            </label>
                            <textarea
                                value={heroContent.subtitle}
                                onChange={(e) => setHeroContent({ ...heroContent, subtitle: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                URL фонового зображення
                            </label>
                            <input
                                type="text"
                                value={heroContent.background_image_url}
                                onChange={(e) => setHeroContent({ ...heroContent, background_image_url: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                            />
                            {heroContent.background_image_url && (
                                <img
                                    src={heroContent.background_image_url}
                                    alt="Preview"
                                    className="mt-2 w-full h-48 object-cover rounded-lg"
                                />
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={heroContent.is_active}
                                onChange={(e) => setHeroContent({ ...heroContent, is_active: e.target.checked })}
                                className="w-4 h-4 text-[#1e2d7d] border-gray-300 rounded focus:ring-[#1e2d7d]"
                            />
                            <label className="text-sm font-medium text-gray-700">
                                Активна секція
                            </label>
                        </div>

                        <button
                            onClick={saveHeroContent}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#162159] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {saving ? (
                                <>
                                    <Activity className="animate-spin" size={18} />
                                    Збереження...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Зберегти
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Hero Buttons Tab */}
            {activeTab === 'buttons' && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-gray-900">Кнопки категорій в Hero</h2>
                        <button
                            onClick={addHeroButton}
                            className="flex items-center gap-2 px-4 py-2 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#162159] transition-colors"
                        >
                            <Plus size={18} />
                            Додати кнопку
                        </button>
                    </div>

                    <div className="space-y-4">
                        {heroButtons.map((button, index) => (
                            <div key={button.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Текст кнопки
                                        </label>
                                        <input
                                            type="text"
                                            value={button.button_text}
                                            onChange={(e) => {
                                                const updated = [...heroButtons];
                                                updated[index].button_text = e.target.value;
                                                setHeroButtons(updated);
                                            }}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            URL посилання
                                        </label>
                                        <input
                                            type="text"
                                            value={button.button_url}
                                            onChange={(e) => {
                                                const updated = [...heroButtons];
                                                updated[index].button_url = e.target.value;
                                                setHeroButtons(updated);
                                            }}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Номер рядка (1, 2, 3)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="5"
                                            value={button.row_number}
                                            onChange={(e) => {
                                                const updated = [...heroButtons];
                                                updated[index].row_number = parseInt(e.target.value);
                                                setHeroButtons(updated);
                                            }}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Порядок відображення
                                        </label>
                                        <input
                                            type="number"
                                            value={button.display_order}
                                            onChange={(e) => {
                                                const updated = [...heroButtons];
                                                updated[index].display_order = parseInt(e.target.value);
                                                setHeroButtons(updated);
                                            }}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-4">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={button.is_active}
                                            onChange={(e) => {
                                                const updated = [...heroButtons];
                                                updated[index].is_active = e.target.checked;
                                                setHeroButtons(updated);
                                            }}
                                            className="w-4 h-4 text-[#1e2d7d] border-gray-300 rounded focus:ring-[#1e2d7d]"
                                        />
                                        <label className="text-sm font-medium text-gray-700">
                                            Активна
                                        </label>
                                    </div>

                                    <button
                                        onClick={() => deleteHeroButton(button.id)}
                                        className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={16} />
                                        Видалити
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={saveHeroButtons}
                        disabled={saving}
                        className="mt-6 flex items-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#162159] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? (
                            <>
                                <Activity className="animate-spin" size={18} />
                                Збереження...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Зберегти всі кнопки
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Feature Cards Tab */}
            {activeTab === 'features' && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-gray-900">Картки "Чому обрати нас"</h2>
                        <button
                            onClick={addFeatureCard}
                            className="flex items-center gap-2 px-4 py-2 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#162159] transition-colors"
                        >
                            <Plus size={18} />
                            Додати картку
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {featureCards.map((card, index) => (
                            <div key={card.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Заголовок
                                        </label>
                                        <input
                                            type="text"
                                            value={card.title}
                                            onChange={(e) => {
                                                const updated = [...featureCards];
                                                updated[index].title = e.target.value;
                                                setFeatureCards(updated);
                                            }}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Опис
                                        </label>
                                        <textarea
                                            value={card.description}
                                            onChange={(e) => {
                                                const updated = [...featureCards];
                                                updated[index].description = e.target.value;
                                                setFeatureCards(updated);
                                            }}
                                            rows={3}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Порядок відображення
                                        </label>
                                        <input
                                            type="number"
                                            value={card.display_order}
                                            onChange={(e) => {
                                                const updated = [...featureCards];
                                                updated[index].display_order = parseInt(e.target.value);
                                                setFeatureCards(updated);
                                            }}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={card.is_active}
                                                onChange={(e) => {
                                                    const updated = [...featureCards];
                                                    updated[index].is_active = e.target.checked;
                                                    setFeatureCards(updated);
                                                }}
                                                className="w-4 h-4 text-[#1e2d7d] border-gray-300 rounded focus:ring-[#1e2d7d]"
                                            />
                                            <label className="text-sm font-medium text-gray-700">
                                                Активна
                                            </label>
                                        </div>

                                        <button
                                            onClick={() => deleteFeatureCard(card.id)}
                                            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                            Видалити
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={saveFeatureCards}
                        disabled={saving}
                        className="mt-6 flex items-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#162159] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? (
                            <>
                                <Activity className="animate-spin" size={18} />
                                Збереження...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Зберегти всі картки
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Section Content Tab */}
            {activeTab === 'sections' && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Контент інших секцій</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Редагуйте заголовки, описи та CTA для всіх секцій на головній сторінці
                    </p>

                    <div className="space-y-6">
                        {sectionContent.map((section) => {
                            const isEditing = editingSectionId === section.id;

                            return (
                                <div key={section.id} className={`border rounded-lg p-6 ${isEditing ? 'border-[#1e2d7d] bg-blue-50/30' : 'border-gray-200'}`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="font-semibold text-gray-900 text-lg">{section.section_name}</h3>
                                            <p className="text-xs text-gray-500 mt-1">ID: {section.id.slice(0, 8)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={section.is_active}
                                                    onChange={(e) => updateSectionField(section.id, 'is_active', e.target.checked)}
                                                    className="w-4 h-4 text-[#1e2d7d] border-gray-300 rounded focus:ring-[#1e2d7d]"
                                                />
                                                <label className="text-sm font-medium text-gray-700">
                                                    Активна
                                                </label>
                                            </div>
                                            {!isEditing ? (
                                                <button
                                                    onClick={() => setEditingSectionId(section.id)}
                                                    className="flex items-center gap-2 px-3 py-2 text-[#1e2d7d] hover:bg-[#1e2d7d]/10 rounded-lg transition-colors"
                                                >
                                                    <FileText size={16} />
                                                    Редагувати
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>

                                    {isEditing ? (
                                        <div className="space-y-4">
                                            {/* Heading */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Заголовок
                                                </label>
                                                <input
                                                    type="text"
                                                    value={section.heading || ''}
                                                    onChange={(e) => updateSectionField(section.id, 'heading', e.target.value)}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                                    placeholder="Введіть заголовок секції"
                                                />
                                            </div>

                                            {/* Subheading */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Підзаголовок
                                                </label>
                                                <input
                                                    type="text"
                                                    value={section.subheading || ''}
                                                    onChange={(e) => updateSectionField(section.id, 'subheading', e.target.value)}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                                    placeholder="Введіть підзаголовок"
                                                />
                                            </div>

                                            {/* Body Text */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Основний текст
                                                </label>
                                                <textarea
                                                    value={section.body_text || ''}
                                                    onChange={(e) => updateSectionField(section.id, 'body_text', e.target.value)}
                                                    rows={4}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                                    placeholder="Введіть основний текст секції"
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* CTA Text */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Текст кнопки (CTA)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={section.cta_text || ''}
                                                        onChange={(e) => updateSectionField(section.id, 'cta_text', e.target.value)}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                                        placeholder="Наприклад: Дізнатись більше"
                                                    />
                                                </div>

                                                {/* CTA URL */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Посилання кнопки (CTA URL)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={section.cta_url || ''}
                                                        onChange={(e) => updateSectionField(section.id, 'cta_url', e.target.value)}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                                        placeholder="/catalog"
                                                    />
                                                </div>
                                            </div>

                                            {/* Image URL */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    URL зображення
                                                </label>
                                                <input
                                                    type="text"
                                                    value={section.image_url || ''}
                                                    onChange={(e) => updateSectionField(section.id, 'image_url', e.target.value)}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                                    placeholder="https://example.com/image.jpg"
                                                />
                                                {section.image_url && (
                                                    <img
                                                        src={section.image_url}
                                                        alt="Preview"
                                                        className="mt-2 w-full max-w-md h-48 object-cover rounded-lg border border-gray-200"
                                                    />
                                                )}
                                            </div>

                                            {/* Metadata (JSON Editor) */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Metadata (JSON)
                                                </label>
                                                <textarea
                                                    value={section.metadata ? JSON.stringify(section.metadata, null, 2) : ''}
                                                    onChange={(e) => {
                                                        try {
                                                            const parsed = e.target.value ? JSON.parse(e.target.value) : null;
                                                            updateSectionField(section.id, 'metadata', parsed);
                                                        } catch (err) {
                                                            // Invalid JSON - just update the raw value for now
                                                            // User will see error when they try to save
                                                        }
                                                    }}
                                                    rows={6}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent font-mono text-sm"
                                                    placeholder='{"key": "value"}'
                                                />
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Metadata для секції (наприклад, steps, features, quiz_enabled)
                                                </p>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-3 pt-4">
                                                <button
                                                    onClick={() => saveSectionContent(section.id)}
                                                    disabled={saving}
                                                    className="flex items-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#162159] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    {saving ? (
                                                        <>
                                                            <Activity className="animate-spin" size={18} />
                                                            Збереження...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Save size={18} />
                                                            Зберегти секцію
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingSectionId(null);
                                                        fetchAllContent(); // Reset to original values
                                                    }}
                                                    disabled={saving}
                                                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    Скасувати
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {section.heading && (
                                                <div>
                                                    <span className="text-xs font-medium text-gray-500 uppercase">Заголовок:</span>
                                                    <p className="text-gray-900 mt-1">{section.heading}</p>
                                                </div>
                                            )}
                                            {section.subheading && (
                                                <div>
                                                    <span className="text-xs font-medium text-gray-500 uppercase">Підзаголовок:</span>
                                                    <p className="text-gray-700 mt-1">{section.subheading}</p>
                                                </div>
                                            )}
                                            {section.cta_text && (
                                                <div>
                                                    <span className="text-xs font-medium text-gray-500 uppercase">CTA:</span>
                                                    <p className="text-gray-700 mt-1">
                                                        {section.cta_text} → <span className="text-[#1e2d7d]">{section.cta_url}</span>
                                                    </p>
                                                </div>
                                            )}
                                            {section.metadata && (
                                                <div>
                                                    <span className="text-xs font-medium text-gray-500 uppercase">Metadata:</span>
                                                    <pre className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded overflow-x-auto">
                                                        {JSON.stringify(section.metadata, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {sectionContent.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <FileText size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Немає секцій для відображення</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
