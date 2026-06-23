'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { normalizeImageFile } from '@/lib/heic-to-jpeg';
import { SectionLivePreview } from '@/components/admin/SectionLivePreview';
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

// Invalidate the ISR-cached homepage (revalidate 4h) so admin content edits
// appear immediately instead of after the cache window.
async function revalidateHome() {
    try {
        await fetch('/api/admin/revalidate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: '/[locale]', type: 'page' }),
        });
    } catch { /* non-fatal: content still updates on next revalidation */ }
}

export default function ContentManagementPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'hero' | 'buttons' | 'features' | 'sections' | 'articles'>('hero');

    // Hero content
    const [heroContent, setHeroContent] = useState<HeroContent | null>(null);
    const [heroButtons, setHeroButtons] = useState<HeroButton[]>([]);
    const [featureCards, setFeatureCards] = useState<FeatureCard[]>([]);
    const [sectionContent, setSectionContent] = useState<SectionContent[]>([]);
    const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [featuredArticles, setFeaturedArticles] = useState<any[]>([]);
    const [articlesLoaded, setArticlesLoaded] = useState(false);

    // Upload media to Storage. Large files (esp. homepage videos up to 200 MB)
    // cannot stream through the /api/admin/upload function — Vercel caps the
    // request body at ~4.5 MB (413). So we get a signed upload URL from the
    // server (no body) and upload the bytes DIRECTLY from the browser to
    // Storage, which honours the full bucket limit. The old server route stays
    // as a fallback for tiny files in case signed upload is unavailable.
    async function uploadToStorage(file: File, bucket: string, folder: string): Promise<string | null> {
        // iPhone HEIC photos can't render in <img> — convert to JPEG first.
        file = await normalizeImageFile(file);
        // 1) Preferred path: signed upload URL → direct browser → Storage.
        try {
            const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
            const signRes = await fetch('/api/admin/signed-upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bucket, folder, ext }),
            });
            const signJson = await signRes.json().catch(() => ({}));
            if (!signRes.ok) throw new Error(signJson.error || `HTTP ${signRes.status}`);
            const { error: upErr } = await supabase.storage
                .from(bucket)
                .uploadToSignedUrl(signJson.path, signJson.token, file, { contentType: file.type || undefined });
            if (upErr) throw upErr;
            return signJson.publicUrl as string;
        } catch (errSigned: any) {
            // 2) Fallback: stream through the server route. Only works under
            // ~4.5 MB, so surface the original error if this also fails.
            try {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('bucket', bucket);
                fd.append('folder', folder);
                const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
                return json.url as string;
            } catch (errRoute: any) {
                console.error('Upload error:', errSigned, errRoute);
                const big = file.size > 4.5 * 1024 * 1024;
                toast.error(big
                    ? `Помилка завантаження великого файлу: ${errSigned?.message || errSigned}`
                    : `Помилка завантаження: ${errRoute?.message || errRoute}`);
                return null;
            }
        }
    }

    async function handleHeroBgUpload(file: File) {
        if (!heroContent) return;
        setUploading(true);
        const toastId = toast.loading('Завантаження фото...');
        const url = await uploadToStorage(file, 'touch-memories-assets', 'content/hero');
        toast.dismiss(toastId);
        if (url) {
            setHeroContent({ ...heroContent, background_image_url: url });
            toast.success('Фото завантажено — не забудь зберегти');
        }
        setUploading(false);
    }

    async function handleSectionImageUpload(sectionId: string, file: File) {
        setUploading(true);
        const toastId = toast.loading('Завантаження фото...');
        const url = await uploadToStorage(file, 'touch-memories-assets', 'content/sections');
        toast.dismiss(toastId);
        if (url) {
            updateSectionField(sectionId, 'image_url', url);
            toast.success('Фото завантажено — збережіть секцію');
        }
        setUploading(false);
    }

    async function handleSectionCollageUpload(sectionId: string, index: number, file: File, metaKey: string = 'collage') {
        setUploading(true);
        const toastId = toast.loading('Завантаження фото...');
        const url = await uploadToStorage(file, 'touch-memories-assets', 'content/collage');
        toast.dismiss(toastId);
        if (url) {
            const section = sectionContent.find(s => s.id === sectionId);
            const md: any = { ...(section?.metadata || {}) };
            const arr: string[] = Array.isArray(md[metaKey]) ? [...md[metaKey]] : [];
            while (arr.length < 9) arr.push('');
            arr[index] = url;
            md[metaKey] = arr;
            updateSectionField(sectionId, 'metadata', md);
            toast.success('Фото завантажено — збережіть секцію');
        }
        setUploading(false);
    }

    async function handleSectionWeddingUpload(sectionId: string, key: 'guestbook' | 'newspaper' | 'photobook' | 'magazine', file: File) {
        setUploading(true);
        const toastId = toast.loading('Завантаження фото...');
        const url = await uploadToStorage(file, 'touch-memories-assets', 'content/wedding');
        toast.dismiss(toastId);
        if (url) {
            const section = sectionContent.find(s => s.id === sectionId);
            const md: any = { ...(section?.metadata || {}) };
            md.images = { ...(md.images || {}), [key]: url };
            updateSectionField(sectionId, 'metadata', md);
            toast.success('Фото завантажено — збережіть секцію');
        }
        setUploading(false);
    }

    async function handleSectionVideoUpload(sectionId: string, key: 'photobooks' | 'magazines', file: File) {
        setUploading(true);
        const toastId = toast.loading('Завантаження відео...');
        const url = await uploadToStorage(file, 'videos', 'content-videos');
        toast.dismiss(toastId);
        if (url) {
            const section = sectionContent.find(s => s.id === sectionId);
            const md: any = { ...(section?.metadata || {}) };
            md[key] = { ...(md[key] || {}), video_url: url, media_type: 'video' };
            updateSectionField(sectionId, 'metadata', md);
            toast.success('Відео завантажено — збережіть секцію');
        }
        setUploading(false);
    }

    // Photo of the editor itself (constructor screenshot). Shown as the video
    // poster and as the fallback image when there is no video.
    async function handleSectionEditorImageUpload(sectionId: string, key: 'photobooks' | 'magazines', file: File) {
        setUploading(true);
        const toastId = toast.loading('Завантаження фото редактора...');
        const url = await uploadToStorage(file, 'touch-memories-assets', 'content/editors');
        toast.dismiss(toastId);
        if (url) {
            const section = sectionContent.find(s => s.id === sectionId);
            const md: any = { ...(section?.metadata || {}) };
            md[key] = { ...(md[key] || {}), image_url: url, media_type: 'image' };
            updateSectionField(sectionId, 'metadata', md);
            toast.success('Фото редактора завантажено — збережіть секцію');
        }
        setUploading(false);
    }

    // Merge arbitrary fields into metadata[key] for the constructor section
    // (display choice, image focal point, video trim).
    // Real screenshot of the constructor that replaces the drawn SVG illustration
    // in the section. Stored per section key under metadata[key].mockup_image_url.
    async function handleSectionMockupUpload(sectionId: string, key: 'photobooks' | 'magazines', file: File) {
        setUploading(true);
        const toastId = toast.loading('Завантаження скріншота...');
        const url = await uploadToStorage(file, 'touch-memories-assets', 'content/mockups');
        toast.dismiss(toastId);
        if (url) {
            updateConstructorMeta(sectionId, key, { mockup_image_url: url, mockup_image_position: '50% 50%' });
            toast.success('Скріншот завантажено — збережіть секцію');
        }
        setUploading(false);
    }

    function updateConstructorMeta(sectionId: string, key: 'photobooks' | 'magazines', patch: Record<string, any>) {
        const section = sectionContent.find(s => s.id === sectionId);
        const md: any = { ...(section?.metadata || {}) };
        md[key] = { ...(md[key] || {}), ...patch };
        updateSectionField(sectionId, 'metadata', md);
    }

    useEffect(() => {
        fetchAllContent();
    }, []);

    // ---- Homepage articles ("Статті на головній" / featured_articles) ----
    async function fetchFeaturedArticles() {
        try {
            const res = await fetch('/api/admin/featured-articles?section=travel');
            const json = await res.json().catch(() => ({}));
            if (res.ok) { setFeaturedArticles(json.articles || []); setArticlesLoaded(true); }
            else toast.error(json.error || 'Не вдалося завантажити статті');
        } catch (e: any) { toast.error('Помилка: ' + (e.message || e)); }
    }
    function updateArticleField(id: string, field: string, value: any) {
        setFeaturedArticles(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    }
    async function saveArticle(a: any) {
        const res = await fetch('/api/admin/featured-articles', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) toast.success('Збережено'); else toast.error(json.error || 'Помилка збереження');
    }
    async function addArticle() {
        const res = await fetch('/api/admin/featured-articles', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section: 'travel', title: 'Нова стаття', description: '', category_label: '', link_url: '/blog', position: featuredArticles.length + 1, is_active: true }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.article) { setFeaturedArticles(prev => [...prev, json.article]); toast.success('Додано'); }
        else toast.error(json.error || 'Помилка');
    }
    async function deleteArticle(id: string) {
        if (!window.confirm('Видалити цю статтю з головної сторінки?')) return;
        const res = await fetch('/api/admin/featured-articles?id=' + id, { method: 'DELETE' });
        if (res.ok) { setFeaturedArticles(prev => prev.filter(a => a.id !== id)); toast.success('Видалено'); }
        else toast.error('Помилка видалення');
    }
    async function handleArticleImageUpload(id: string, file: File) {
        setUploading(true);
        const tId = toast.loading('Завантаження фото...');
        const url = await uploadToStorage(file, 'touch-memories-assets', 'content/articles');
        toast.dismiss(tId);
        if (url) { updateArticleField(id, 'image_url', url); toast.success('Фото завантажено — натисніть «Зберегти»'); }
        setUploading(false);
    }

    async function fetchAllContent() {
        setLoading(true);
        try {
            // Fetch hero content
            const { data: heroData } = await supabase
                .from('hero_content')
                .select('*')
                .single();
            if (heroData) setHeroContent(heroData);

            // Fetch hero buttons (live Hero reads text/url/sort_order; map to editor field names)
            const { data: buttonsData } = await supabase
                .from('hero_buttons')
                .select('*')
                .order('sort_order');
            if (buttonsData) setHeroButtons(buttonsData.map((b: any) => ({
                id: b.id,
                button_text: b.text ?? b.button_text ?? '',
                button_url: b.url ?? b.button_url ?? '',
                display_order: b.sort_order ?? b.display_order ?? 0,
                row_number: b.row_number ?? 1,
                is_active: b.is_active,
            })));

            // Fetch feature cards (the live "Чому обрати нас" / HowItWorks section reads feature_cards)
            const { data: cardsData } = await supabase
                .from('feature_cards')
                .select('*')
                .order('sort_order');
            if (cardsData) setFeatureCards(cardsData.map((c: any) => ({
                id: c.id,
                title: c.title || '',
                description: c.subtitle || '',
                icon_name: c.icon || null,
                display_order: c.sort_order || 0,
                is_active: c.is_active,
            })));

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
            await revalidateHome();
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
                        text: button.button_text,
                        button_text: button.button_text,
                        url: button.button_url,
                        button_url: button.button_url,
                        sort_order: button.display_order,
                        display_order: button.display_order,
                        row_number: button.row_number,
                        is_active: button.is_active
                    })
                    .eq('id', button.id);

                if (error) throw error;
            }
            await revalidateHome();
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
                    .from('feature_cards')
                    .update({
                        title: card.title,
                        subtitle: card.description,
                        sort_order: card.display_order,
                        is_active: card.is_active
                    })
                    .eq('id', card.id);

                if (error) throw error;
            }
            await revalidateHome();
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
                    text: 'Нова кнопка',
                    button_text: 'Нова кнопка',
                    url: '/catalog',
                    button_url: '/catalog',
                    variant: 'pill',
                    sort_order: maxOrder + 1,
                    display_order: maxOrder + 1,
                    row_number: 1,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setHeroButtons([...heroButtons, {
                    id: data.id,
                    button_text: data.text ?? data.button_text ?? '',
                    button_url: data.url ?? data.button_url ?? '',
                    display_order: data.sort_order ?? data.display_order ?? 0,
                    row_number: data.row_number ?? 1,
                    is_active: data.is_active,
                }]);
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
                .from('feature_cards')
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
                .from('feature_cards')
                .insert({
                    title: 'Нова перевага',
                    subtitle: 'Опис переваги',
                    icon: '✨',
                    sort_order: maxOrder + 1,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setFeatureCards([...featureCards, {
                    id: data.id,
                    title: data.title || '',
                    description: data.subtitle || '',
                    icon_name: data.icon || null,
                    display_order: data.sort_order || 0,
                    is_active: data.is_active,
                }]);
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
            await revalidateHome();
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
                <button
                    onClick={() => { setActiveTab('articles'); if (!articlesLoaded) fetchFeaturedArticles(); }}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                        activeTab === 'articles'
                            ? 'border-[#1e2d7d] text-[#1e2d7d]'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                >
                    Статті на головній
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
                            <div className="mt-2">
                                <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer text-sm font-medium text-gray-700 transition-colors">
                                    <ImageIcon size={16} />
                                    {uploading ? 'Завантаження...' : 'Завантажити / замінити фото'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        disabled={uploading}
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleHeroBgUpload(f); e.target.value = ''; }}
                                    />
                                </label>
                            </div>
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

                                    {/* Live preview — reflects the current (unsaved) edits */}
                                    <div className="mb-4">
                                        <SectionLivePreview section={section} />
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
                                                <div className="mt-2">
                                                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer text-sm font-medium text-gray-700 transition-colors">
                                                        <ImageIcon size={16} />
                                                        {uploading ? 'Завантаження...' : 'Завантажити / замінити фото'}
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            disabled={uploading}
                                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSectionImageUpload(section.id, f); e.target.value = ''; }}
                                                        />
                                                    </label>
                                                </div>
                                                {section.image_url && (
                                                    <img
                                                        src={section.image_url}
                                                        alt="Preview"
                                                        className="mt-2 w-full max-w-md h-48 object-cover rounded-lg border border-gray-200"
                                                    />
                                                )}
                                            </div>

                                            {section.section_name === 'photo_print' && (
                                                <div className="space-y-3 p-4 bg-blue-50/40 rounded-lg border border-blue-100">
                                                    <label className="block text-sm font-semibold text-gray-800">Колаж «Швидкий друк фото» (9 фото)</label>
                                                    <p className="text-xs text-gray-500">Порожня клітинка показує стандартне фото. Завантаж своє, щоб замінити саме його.</p>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {Array.from({ length: 9 }).map((_, i) => {
                                                            const url = (section.metadata as any)?.collage?.[i] || `/images/collage/${i + 1}.png`;
                                                            return (
                                                                <div key={i} className="space-y-1">
                                                                    <img src={url} alt={`Колаж ${i + 1}`} className="w-full h-24 object-cover rounded-md border border-gray-200" />
                                                                    <label className="block text-center text-[11px] px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer">
                                                                        {uploading ? '...' : `Фото ${i + 1}`}
                                                                        <input type="file" accept="image/*" className="hidden" disabled={uploading}
                                                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSectionCollageUpload(section.id, i, f); e.target.value = ''; }} />
                                                                    </label>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {section.section_name === 'wedding' && (
                                                <div className="space-y-3 p-4 bg-blue-50/40 rounded-lg border border-blue-100">
                                                    <label className="block text-sm font-semibold text-gray-800">Весільні картки (4 фото)</label>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {([['guestbook', 'Книга побажань'], ['newspaper', 'Весільна газета'], ['photobook', 'Весільна фотокнига'], ['magazine', 'Весільний журнал']] as const).map(([key, lbl]) => {
                                                            const url = (section.metadata as any)?.images?.[key] || `/images/wedding/${key}.png`;
                                                            return (
                                                                <div key={key} className="space-y-1">
                                                                    <div className="text-xs font-medium text-gray-700">{lbl}</div>
                                                                    <img src={url} alt={lbl} className="w-full h-28 object-cover rounded-md border border-gray-200" />
                                                                    <label className="block text-center text-[11px] px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer">
                                                                        {uploading ? '...' : 'Замінити фото'}
                                                                        <input type="file" accept="image/*" className="hidden" disabled={uploading}
                                                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSectionWeddingUpload(section.id, key, f); e.target.value = ''; }} />
                                                                    </label>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {section.section_name === 'final_cta' && (
                                                <div className="space-y-3 p-4 bg-blue-50/40 rounded-lg border border-blue-100">
                                                    <label className="block text-sm font-semibold text-gray-800">Сітка «Книга побажань» (9 фото)</label>
                                                    <p className="text-xs text-gray-500">Порожня клітинка показує градієнт. Завантаж фото, щоб замінити його.</p>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {Array.from({ length: 9 }).map((_, i) => {
                                                            const url = (section.metadata as any)?.tiles?.[i] || '';
                                                            return (
                                                                <div key={i} className="space-y-1">
                                                                    {url ? (
                                                                        <img src={url} alt={`Плитка ${i + 1}`} className="w-full h-24 object-cover rounded-md border border-gray-200" />
                                                                    ) : (
                                                                        <div className="w-full h-24 rounded-md border border-gray-200 bg-gradient-to-br from-[#1e2d7d] to-[#6b7cc9]" />
                                                                    )}
                                                                    <label className="block text-center text-[11px] px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer">
                                                                        {uploading ? '...' : `Фото ${i + 1}`}
                                                                        <input type="file" accept="image/*" className="hidden" disabled={uploading}
                                                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSectionCollageUpload(section.id, i, f, 'tiles'); e.target.value = ''; }} />
                                                                    </label>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {section.section_name === 'constructor_selection' && (
                                                <div className="space-y-3 p-4 bg-blue-50/40 rounded-lg border border-blue-100">
                                                    <label className="block text-sm font-semibold text-gray-800">Відео секції конструктора</label>
                                                    {(['photobooks', 'magazines'] as const).map((key) => {
                                                        const vurl = (section.metadata as any)?.[key]?.video_url || '';
                                                        const imgurl = (section.metadata as any)?.[key]?.image_url || '';
                                                        const mtype = (section.metadata as any)?.[key]?.media_type || (vurl ? 'video' : 'image');
                                                        const ipos = (section.metadata as any)?.[key]?.image_position || '50% 50%';
                                                        const vstart = (section.metadata as any)?.[key]?.video_start ?? '';
                                                        const vend = (section.metadata as any)?.[key]?.video_end ?? '';
                                                        return (
                                                            <div key={key} className="flex items-start gap-3 flex-wrap py-2 border-b border-blue-100 last:border-0">
                                                                <span className="text-sm text-gray-600 w-28 pt-2">{key === 'photobooks' ? 'Фотокниги' : 'Журнали'}:</span>
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="flex items-center gap-3 flex-wrap">
                                                                        <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg cursor-pointer text-sm font-medium text-gray-700 transition-colors">
                                                                            <ImageIcon size={16} />
                                                                            {uploading ? 'Завантаження...' : (vurl ? 'Замінити відео' : 'Завантажити відео')}
                                                                            <input type="file" accept="video/mp4,video/quicktime,video/x-msvideo,.mp4,.mov,.avi" className="hidden" disabled={uploading}
                                                                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSectionVideoUpload(section.id, key, f); e.target.value = ''; }} />
                                                                        </label>
                                                                        {vurl && <video src={vurl} muted className="h-16 rounded border border-gray-200" />}
                                                                    </div>
                                                                    <div className="flex items-center gap-3 flex-wrap">
                                                                        <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg cursor-pointer text-sm font-medium text-gray-700 transition-colors">
                                                                            <ImageIcon size={16} />
                                                                            {uploading ? 'Завантаження...' : (imgurl ? 'Замінити фото' : 'Завантажити фото')}
                                                                            <input type="file" accept="image/*" className="hidden" disabled={uploading}
                                                                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSectionEditorImageUpload(section.id, key, f); e.target.value = ''; }} />
                                                                        </label>
                                                                        {imgurl && <img src={imgurl} alt="" className="h-16 rounded border border-gray-200 object-cover" />}
                                                                        {imgurl && (
                                                                            <button type="button" onClick={() => updateConstructorMeta(section.id, key, { image_url: null, image_position: null, ...(vurl ? { media_type: 'video' } : {}) })}
                                                                                className="px-2.5 py-1 rounded text-xs font-semibold border border-red-200 bg-white text-red-600 hover:bg-red-50">Видалити фото</button>
                                                                        )}
                                                                    </div>

                                                                    {(vurl || imgurl) && (
                                                                        <div className="flex flex-col gap-2 pt-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-xs text-gray-600">Показувати на сайті:</span>
                                                                                <button type="button" disabled={!vurl}
                                                                                    onClick={() => updateConstructorMeta(section.id, key, { media_type: 'video' })}
                                                                                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${mtype === 'video' ? 'bg-[#263a99] text-white border-[#263a99]' : 'bg-white text-gray-700 border-gray-300'} ${!vurl ? 'opacity-40 cursor-not-allowed' : ''}`}>Відео</button>
                                                                                <button type="button" disabled={!imgurl}
                                                                                    onClick={() => updateConstructorMeta(section.id, key, { media_type: 'image' })}
                                                                                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${mtype === 'image' ? 'bg-[#263a99] text-white border-[#263a99]' : 'bg-white text-gray-700 border-gray-300'} ${!imgurl ? 'opacity-40 cursor-not-allowed' : ''}`}>Фото</button>
                                                                            </div>

                                                                            {mtype === 'video' && vurl && (
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    <span className="text-xs text-gray-600">Обрізати (сек):</span>
                                                                                    <input type="number" min="0" step="0.1" placeholder="початок" value={vstart}
                                                                                        onChange={(e) => updateConstructorMeta(section.id, key, { video_start: e.target.value === '' ? null : Number(e.target.value) })}
                                                                                        className="w-24 px-2 py-1 border border-gray-300 rounded text-xs" />
                                                                                    <span className="text-xs text-gray-400">→</span>
                                                                                    <input type="number" min="0" step="0.1" placeholder="кінець" value={vend}
                                                                                        onChange={(e) => updateConstructorMeta(section.id, key, { video_end: e.target.value === '' ? null : Number(e.target.value) })}
                                                                                        className="w-24 px-2 py-1 border border-gray-300 rounded text-xs" />
                                                                                </div>
                                                                            )}

                                                                            {mtype === 'image' && imgurl && (
                                                                                <div className="flex flex-col gap-1">
                                                                                    <span className="text-xs text-gray-600">Клікніть на фото, щоб обрати видиму область:</span>
                                                                                    <div className="relative w-40 cursor-crosshair rounded border border-gray-200 overflow-hidden" style={{ aspectRatio: '4 / 5' }}
                                                                                        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const x = Math.min(100, Math.max(0, Math.round((e.clientX - r.left) / r.width * 100))); const y = Math.min(100, Math.max(0, Math.round((e.clientY - r.top) / r.height * 100))); updateConstructorMeta(section.id, key, { image_position: `${x}% ${y}%` }); }}>
                                                                                        <img src={imgurl} alt="" className="w-full h-full object-cover" style={{ objectPosition: ipos }} />
                                                                                        <div className="absolute w-3 h-3 rounded-full bg-white border-2 border-[#263a99] pointer-events-none" style={{ left: ipos.split(' ')[0], top: ipos.split(' ')[1], transform: 'translate(-50%, -50%)' }} />
                                                                                    </div>
                                                                                    <span className="text-[11px] text-gray-400">Область: {ipos}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {(() => {
                                                                        const murl = (section.metadata as any)?.[key]?.mockup_image_url || '';
                                                                        const mpos = (section.metadata as any)?.[key]?.mockup_image_position || '50% 50%';
                                                                        return (
                                                                            <div className="flex flex-col gap-2 pt-2 mt-1 border-t border-blue-100">
                                                                                <div className="flex items-center gap-3 flex-wrap">
                                                                                    <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg cursor-pointer text-sm font-medium text-gray-700 transition-colors">
                                                                                        <ImageIcon size={16} />
                                                                                        {uploading ? 'Завантаження...' : (murl ? 'Замінити скріншот конструктора' : 'Скріншот конструктора (замість ілюстрації)')}
                                                                                        <input type="file" accept="image/*" className="hidden" disabled={uploading}
                                                                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSectionMockupUpload(section.id, key, f); e.target.value = ''; }} />
                                                                                    </label>
                                                                                    {murl && (
                                                                                        <button type="button" onClick={() => updateConstructorMeta(section.id, key, { mockup_image_url: null })}
                                                                                            className="px-2.5 py-1 rounded text-xs font-semibold border border-gray-300 bg-white text-gray-600 hover:bg-gray-50">Повернути ілюстрацію</button>
                                                                                    )}
                                                                                </div>
                                                                                {murl && (
                                                                                    <div className="flex flex-col gap-1">
                                                                                        <span className="text-xs text-gray-600">Клікніть, щоб обрати видиму область:</span>
                                                                                        <div className="relative w-56 cursor-crosshair rounded border border-gray-200 overflow-hidden" style={{ aspectRatio: '600 / 340' }}
                                                                                            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const x = Math.min(100, Math.max(0, Math.round((e.clientX - r.left) / r.width * 100))); const y = Math.min(100, Math.max(0, Math.round((e.clientY - r.top) / r.height * 100))); updateConstructorMeta(section.id, key, { mockup_image_position: `${x}% ${y}%` }); }}>
                                                                                            <img src={murl} alt="" className="w-full h-full object-cover" style={{ objectPosition: mpos }} />
                                                                                            <div className="absolute w-3 h-3 rounded-full bg-white border-2 border-[#263a99] pointer-events-none" style={{ left: mpos.split(' ')[0], top: mpos.split(' ')[1], transform: 'translate(-50%, -50%)' }} />
                                                                                        </div>
                                                                                        <span className="text-[11px] text-gray-400">Область: {mpos}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    <p className="text-xs text-gray-500">MP4 / MOV / AVI, до 200 МБ. Обери, що показувати — фото чи відео. Для фото можна вибрати видиму область, для відео — обрізати початок/кінець. «Скріншот конструктора» замінює намальовану ілюстрацію редактора на твоє реальне фото (порожньо — показується намальований мокап). Після змін натисніть «Зберегти секцію».</p>
                                                </div>
                                            )}

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

            {activeTab === 'articles' && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <div className="flex items-start justify-between mb-2">
                        <h2 className="text-2xl font-bold text-[#1e2d7d]">Статті на головній сторінці</h2>
                        <button
                            onClick={addArticle}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e2d7d] text-white font-medium hover:bg-[#162056] transition-colors"
                        >
                            <Plus size={18} /> Додати статтю
                        </button>
                    </div>
                    <p className="text-gray-500 mb-6">
                        Це картки в секції Travel на головній. Показуються активні статті за порядком (поле «Позиція»), перші дві. «Всі статті» веде в блог окремо.
                    </p>

                    {featuredArticles.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <FileText size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Поки немає статей. Натисніть «Додати статтю».</p>
                        </div>
                    )}

                    <div className="space-y-6">
                        {featuredArticles.map((a) => (
                            <div key={a.id} className="border border-gray-200 rounded-xl p-5">
                                <div className="flex flex-col md:flex-row gap-5">
                                    {/* Image */}
                                    <div className="md:w-64 flex-shrink-0">
                                        <div className="aspect-[4/3] w-full rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center mb-2">
                                            {a.image_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={a.image_url} alt={a.title || ''} className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon size={36} className="text-gray-300" />
                                            )}
                                        </div>
                                        <label className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium cursor-pointer hover:bg-gray-50 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                            <ImageIcon size={16} /> Завантажити фото
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                disabled={uploading}
                                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleArticleImageUpload(a.id, f); e.target.value = ''; }}
                                            />
                                        </label>
                                    </div>

                                    {/* Fields */}
                                    <div className="flex-1 space-y-3">
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Заголовок</label>
                                                <input
                                                    type="text"
                                                    value={a.title || ''}
                                                    onChange={(e) => updateArticleField(a.id, 'title', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#1e2d7d]"
                                                />
                                            </div>
                                            <div className="w-44">
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Бейдж (категорія)</label>
                                                <input
                                                    type="text"
                                                    value={a.category_label || ''}
                                                    placeholder="НАТХНЕННЯ"
                                                    onChange={(e) => updateArticleField(a.id, 'category_label', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#1e2d7d]"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Опис</label>
                                            <textarea
                                                value={a.description || ''}
                                                onChange={(e) => updateArticleField(a.id, 'description', e.target.value)}
                                                rows={2}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#1e2d7d] resize-y"
                                            />
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Посилання (куди веде «Читати статтю»)</label>
                                                <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg focus-within:border-[#1e2d7d]">
                                                    <LinkIcon size={14} className="text-gray-400 flex-shrink-0" />
                                                    <input
                                                        type="text"
                                                        value={a.link_url || ''}
                                                        placeholder="/blog/your-article-slug"
                                                        onChange={(e) => updateArticleField(a.id, 'link_url', e.target.value)}
                                                        className="w-full focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="w-28">
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Позиція</label>
                                                <input
                                                    type="number"
                                                    value={a.position ?? 0}
                                                    onChange={(e) => updateArticleField(a.id, 'position', parseInt(e.target.value || '0', 10))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#1e2d7d]"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-1">
                                            <button
                                                onClick={() => updateArticleField(a.id, 'is_active', !a.is_active)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${a.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                                            >
                                                {a.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                                                {a.is_active ? 'Активна' : 'Прихована'}
                                            </button>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => deleteArticle(a.id)}
                                                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50"
                                                >
                                                    <Trash2 size={16} /> Видалити
                                                </button>
                                                <button
                                                    onClick={() => saveArticle(a)}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e2d7d] text-white text-sm font-medium hover:bg-[#162056]"
                                                >
                                                    <Save size={16} /> Зберегти
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
