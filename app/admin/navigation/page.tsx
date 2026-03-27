'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
    Save,
    Plus,
    Trash2,
    GripVertical,
    Activity,
    Link as LinkIcon,
    Menu
} from 'lucide-react';

interface NavigationLink {
    id: string;
    link_text: string;
    link_url: string;
    display_order: number;
    is_active: boolean;
    parent_id: string | null;
}

interface FooterSection {
    id: string;
    section_name: string;
    section_title: string;
    display_order: number;
    is_active: boolean;
}

interface FooterLink {
    id: string;
    section_id: string;
    link_text: string;
    link_url: string;
    display_order: number;
    is_active: boolean;
}

export default function NavigationManagementPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'navigation' | 'footer'>('navigation');

    // Navigation state
    const [navLinks, setNavLinks] = useState<NavigationLink[]>([]);

    // Footer state
    const [footerSections, setFooterSections] = useState<FooterSection[]>([]);
    const [footerLinks, setFooterLinks] = useState<FooterLink[]>([]);
    const [selectedSection, setSelectedSection] = useState<string | null>(null);

    useEffect(() => {
        fetchAllData();
    }, []);

    async function fetchAllData() {
        setLoading(true);
        try {
            // Fetch navigation links
            const { data: navData } = await supabase
                .from('navigation_links')
                .select('*')
                .order('display_order');
            if (navData) setNavLinks(navData);

            // Fetch footer sections
            const { data: sectionsData } = await supabase
                .from('footer_sections')
                .select('*')
                .order('display_order');
            if (sectionsData) {
                setFooterSections(sectionsData);
                if (sectionsData.length > 0 && !selectedSection) {
                    setSelectedSection(sectionsData[0].id);
                }
            }

            // Fetch footer links
            const { data: linksData } = await supabase
                .from('footer_links')
                .select('*')
                .order('display_order');
            if (linksData) setFooterLinks(linksData);

        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Помилка завантаження даних');
        } finally {
            setLoading(false);
        }
    }

    // ==================== NAVIGATION LINK FUNCTIONS ====================

    async function addNavLink() {
        try {
            const maxOrder = Math.max(...navLinks.map(l => l.display_order), 0);
            const { data, error } = await supabase
                .from('navigation_links')
                .insert({
                    link_text: 'Нове посилання',
                    link_url: '/catalog',
                    display_order: maxOrder + 1,
                    is_active: true,
                    parent_id: null
                })
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setNavLinks([...navLinks, data]);
                toast.success('Посилання додано');
            }
        } catch (error) {
            console.error('Error adding nav link:', error);
            toast.error('Помилка додавання посилання');
        }
    }

    async function updateNavLink(id: string, field: keyof NavigationLink, value: any) {
        const updated = navLinks.map(link =>
            link.id === id ? { ...link, [field]: value } : link
        );
        setNavLinks(updated);
    }

    async function saveNavLinks() {
        setSaving(true);
        try {
            for (const link of navLinks) {
                const { error } = await supabase
                    .from('navigation_links')
                    .update({
                        link_text: link.link_text,
                        link_url: link.link_url,
                        display_order: link.display_order,
                        is_active: link.is_active
                    })
                    .eq('id', link.id);

                if (error) throw error;
            }
            toast.success('Навігаційні посилання збережено');
        } catch (error) {
            console.error('Error saving nav links:', error);
            toast.error('Помилка збереження');
        } finally {
            setSaving(false);
        }
    }

    async function deleteNavLink(id: string) {
        try {
            const { error } = await supabase
                .from('navigation_links')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setNavLinks(navLinks.filter(l => l.id !== id));
            toast.success('Посилання видалено');
        } catch (error) {
            console.error('Error deleting nav link:', error);
            toast.error('Помилка видалення');
        }
    }

    // ==================== FOOTER SECTION FUNCTIONS ====================

    async function addFooterSection() {
        try {
            const maxOrder = Math.max(...footerSections.map(s => s.display_order), 0);
            const { data, error } = await supabase
                .from('footer_sections')
                .insert({
                    section_name: `section_${Date.now()}`,
                    section_title: 'Нова секція',
                    display_order: maxOrder + 1,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setFooterSections([...footerSections, data]);
                toast.success('Секцію додано');
            }
        } catch (error) {
            console.error('Error adding footer section:', error);
            toast.error('Помилка додавання секції');
        }
    }

    async function updateFooterSection(id: string, field: keyof FooterSection, value: any) {
        const updated = footerSections.map(section =>
            section.id === id ? { ...section, [field]: value } : section
        );
        setFooterSections(updated);
    }

    async function saveFooterSections() {
        setSaving(true);
        try {
            for (const section of footerSections) {
                const { error } = await supabase
                    .from('footer_sections')
                    .update({
                        section_title: section.section_title,
                        display_order: section.display_order,
                        is_active: section.is_active
                    })
                    .eq('id', section.id);

                if (error) throw error;
            }
            toast.success('Секції збережено');
        } catch (error) {
            console.error('Error saving footer sections:', error);
            toast.error('Помилка збереження');
        } finally {
            setSaving(false);
        }
    }

    async function deleteFooterSection(id: string) {
        try {
            const { error } = await supabase
                .from('footer_sections')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setFooterSections(footerSections.filter(s => s.id !== id));
            setFooterLinks(footerLinks.filter(l => l.section_id !== id));
            if (selectedSection === id) {
                setSelectedSection(footerSections[0]?.id || null);
            }
            toast.success('Секцію видалено');
        } catch (error) {
            console.error('Error deleting footer section:', error);
            toast.error('Помилка видалення');
        }
    }

    // ==================== FOOTER LINK FUNCTIONS ====================

    async function addFooterLink() {
        if (!selectedSection) {
            toast.error('Оберіть секцію');
            return;
        }

        try {
            const sectionLinks = footerLinks.filter(l => l.section_id === selectedSection);
            const maxOrder = Math.max(...sectionLinks.map(l => l.display_order), 0);
            const { data, error } = await supabase
                .from('footer_links')
                .insert({
                    section_id: selectedSection,
                    link_text: 'Нове посилання',
                    link_url: '#',
                    display_order: maxOrder + 1,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setFooterLinks([...footerLinks, data]);
                toast.success('Посилання додано');
            }
        } catch (error) {
            console.error('Error adding footer link:', error);
            toast.error('Помилка додавання посилання');
        }
    }

    async function updateFooterLink(id: string, field: keyof FooterLink, value: any) {
        const updated = footerLinks.map(link =>
            link.id === id ? { ...link, [field]: value } : link
        );
        setFooterLinks(updated);
    }

    async function saveFooterLinks() {
        setSaving(true);
        try {
            const currentSectionLinks = footerLinks.filter(l => l.section_id === selectedSection);
            for (const link of currentSectionLinks) {
                const { error } = await supabase
                    .from('footer_links')
                    .update({
                        link_text: link.link_text,
                        link_url: link.link_url,
                        display_order: link.display_order,
                        is_active: link.is_active
                    })
                    .eq('id', link.id);

                if (error) throw error;
            }
            toast.success('Посилання збережено');
        } catch (error) {
            console.error('Error saving footer links:', error);
            toast.error('Помилка збереження');
        } finally {
            setSaving(false);
        }
    }

    async function deleteFooterLink(id: string) {
        try {
            const { error } = await supabase
                .from('footer_links')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setFooterLinks(footerLinks.filter(l => l.id !== id));
            toast.success('Посилання видалено');
        } catch (error) {
            console.error('Error deleting footer link:', error);
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

    const currentSectionLinks = footerLinks.filter(l => l.section_id === selectedSection);

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Управління навігацією</h1>
                <p className="text-gray-600">Редагуйте посилання навігації та футера</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('navigation')}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                        activeTab === 'navigation'
                            ? 'border-[#1e2d7d] text-[#1e2d7d]'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <Menu size={18} />
                        Навігація
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('footer')}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                        activeTab === 'footer'
                            ? 'border-[#1e2d7d] text-[#1e2d7d]'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <LinkIcon size={18} />
                        Футер
                    </div>
                </button>
            </div>

            {/* Navigation Tab */}
            {activeTab === 'navigation' && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-gray-900">Навігаційні посилання</h2>
                        <button
                            onClick={addNavLink}
                            className="flex items-center gap-2 px-4 py-2 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#162159] transition-colors"
                        >
                            <Plus size={18} />
                            Додати посилання
                        </button>
                    </div>

                    <div className="space-y-4">
                        {navLinks.map((link, index) => (
                            <div key={link.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Текст посилання
                                        </label>
                                        <input
                                            type="text"
                                            value={link.link_text}
                                            onChange={(e) => updateNavLink(link.id, 'link_text', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            URL посилання
                                        </label>
                                        <input
                                            type="text"
                                            value={link.link_url}
                                            onChange={(e) => updateNavLink(link.id, 'link_url', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Порядок відображення
                                        </label>
                                        <input
                                            type="number"
                                            value={link.display_order}
                                            onChange={(e) => updateNavLink(link.id, 'display_order', parseInt(e.target.value))}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-4">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={link.is_active}
                                            onChange={(e) => updateNavLink(link.id, 'is_active', e.target.checked)}
                                            className="w-4 h-4 text-[#1e2d7d] border-gray-300 rounded focus:ring-[#1e2d7d]"
                                        />
                                        <label className="text-sm font-medium text-gray-700">
                                            Активне
                                        </label>
                                    </div>

                                    <button
                                        onClick={() => deleteNavLink(link.id)}
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
                        onClick={saveNavLinks}
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
                                Зберегти всі посилання
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Footer Tab */}
            {activeTab === 'footer' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Footer Sections */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-gray-900">Секції футера</h2>
                            <button
                                onClick={addFooterSection}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#1e2d7d] text-white text-sm rounded-lg hover:bg-[#162159] transition-colors"
                            >
                                <Plus size={16} />
                                Додати
                            </button>
                        </div>

                        <div className="space-y-3">
                            {footerSections.map((section) => (
                                <div
                                    key={section.id}
                                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                                        selectedSection === section.id
                                            ? 'border-[#1e2d7d] bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                    onClick={() => setSelectedSection(section.id)}
                                >
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={section.section_title}
                                            onChange={(e) => updateFooterSection(section.id, 'section_title', e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                        />
                                        <div className="flex items-center justify-between">
                                            <input
                                                type="number"
                                                value={section.display_order}
                                                onChange={(e) => updateFooterSection(section.id, 'display_order', parseInt(e.target.value))}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                            />
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteFooterSection(section.id);
                                                }}
                                                className="text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={saveFooterSections}
                            disabled={saving}
                            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#1e2d7d] text-white text-sm rounded-lg hover:bg-[#162159] disabled:opacity-50 transition-colors"
                        >
                            {saving ? (
                                <Activity className="animate-spin" size={16} />
                            ) : (
                                <>
                                    <Save size={16} />
                                    Зберегти секції
                                </>
                            )}
                        </button>
                    </div>

                    {/* Footer Links */}
                    <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-gray-900">
                                Посилання: {footerSections.find(s => s.id === selectedSection)?.section_title || 'Оберіть секцію'}
                            </h2>
                            <button
                                onClick={addFooterLink}
                                disabled={!selectedSection}
                                className="flex items-center gap-2 px-4 py-2 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#162159] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Plus size={18} />
                                Додати посилання
                            </button>
                        </div>

                        <div className="space-y-4">
                            {currentSectionLinks.map((link) => (
                                <div key={link.id} className="border border-gray-200 rounded-lg p-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Текст посилання
                                            </label>
                                            <input
                                                type="text"
                                                value={link.link_text}
                                                onChange={(e) => updateFooterLink(link.id, 'link_text', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                URL посилання
                                            </label>
                                            <input
                                                type="text"
                                                value={link.link_url}
                                                onChange={(e) => updateFooterLink(link.id, 'link_url', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Порядок
                                            </label>
                                            <input
                                                type="number"
                                                value={link.display_order}
                                                onChange={(e) => updateFooterLink(link.id, 'display_order', parseInt(e.target.value))}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-4">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={link.is_active}
                                                onChange={(e) => updateFooterLink(link.id, 'is_active', e.target.checked)}
                                                className="w-4 h-4 text-[#1e2d7d] border-gray-300 rounded focus:ring-[#1e2d7d]"
                                            />
                                            <label className="text-sm font-medium text-gray-700">
                                                Активне
                                            </label>
                                        </div>

                                        <button
                                            onClick={() => deleteFooterLink(link.id)}
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
                            onClick={saveFooterLinks}
                            disabled={saving || !selectedSection}
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
                                    Зберегти посилання
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
