'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Plus,
    Edit,
    Trash2,
    X,
    Check,
    AlertTriangle,
    Upload,
    ArrowUp,
    ArrowDown,
    Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface Review {
    id: string;
    image_url: string;
    caption: string | null;
    author: string | null;
    category: string | null;
    is_active: boolean;
    sort_order: number;
    created_at: string;
}

export default function ReviewsAdminPage() {
    const supabase = createClient();

    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        image_url: '',
        caption: '',
        author: '',
        category: '',
        is_active: true
    });
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    // Delete modal state
    const [deleteModal, setDeleteModal] = useState<{
        isOpen: boolean;
        id: string | null;
        author: string;
    }>({
        isOpen: false,
        id: null,
        author: ''
    });

    useEffect(() => {
        fetchReviews();
    }, []);

    async function fetchReviews() {
        setLoading(true);
        const { data, error } = await supabase
            .from('reviews')
            .select('*')
            .order('sort_order', { ascending: true });

        if (data) {
            setReviews(data);
        } else if (error) {
            console.error('Error fetching reviews:', error);
            // Show empty state instead of error - table might not exist yet
            setReviews([]);
        }
        setLoading(false);
    }

    const openAddModal = () => {
        setEditingId(null);
        setFormData({
            image_url: '',
            caption: '',
            author: '',
            category: '',
            is_active: true
        });
        setUploadedFile(null);
        setIsModalOpen(true);
    };

    const openEditModal = (review: Review) => {
        setEditingId(review.id);
        setFormData({
            image_url: review.image_url,
            caption: review.caption || '',
            author: review.author || '',
            category: review.category || '',
            is_active: review.is_active
        });
        setUploadedFile(null);
        setIsModalOpen(true);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Оберіть файл зображення');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Файл занадто великий (макс. 5MB)');
            return;
        }

        setUploadedFile(file);
        setUploading(true);

        try {
            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `reviews/${fileName}`;

            const { data, error } = await supabase.storage
                .from('public')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('public')
                .getPublicUrl(filePath);

            setFormData({ ...formData, image_url: publicUrl });
            toast.success('Зображення завантажено');
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.message || 'Помилка завантаження');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.image_url) {
            toast.error('Завантажте зображення');
            return;
        }

        const tid = toast.loading(editingId ? 'Оновлення...' : 'Створення...');

        const payload = {
            image_url: formData.image_url,
            caption: formData.caption || null,
            author: formData.author || null,
            category: formData.category || null,
            is_active: formData.is_active
        };

        let error;

        if (editingId) {
            const result = await supabase
                .from('reviews')
                .update(payload)
                .eq('id', editingId);
            error = result.error;
        } else {
            // Get max sort_order
            const { data: maxData } = await supabase
                .from('reviews')
                .select('sort_order')
                .order('sort_order', { ascending: false })
                .limit(1)
                .single();

            const newSortOrder = (maxData?.sort_order || 0) + 1;

            const result = await supabase
                .from('reviews')
                .insert([{ ...payload, sort_order: newSortOrder }]);
            error = result.error;
        }

        if (!error) {
            toast.success(editingId ? 'Оновлено' : 'Створено', { id: tid });
            setIsModalOpen(false);
            fetchReviews();
        } else {
            toast.error('Помилка збереження', { id: tid });
        }
    };

    const handleDelete = async () => {
        if (!deleteModal.id) return;

        const tid = toast.loading('Видалення...');
        const { error } = await supabase
            .from('reviews')
            .delete()
            .eq('id', deleteModal.id);

        if (!error) {
            toast.success('Видалено', { id: tid });
            setDeleteModal({ isOpen: false, id: null, author: '' });
            fetchReviews();
        } else {
            toast.error('Помилка видалення', { id: tid });
        }
    };

    const toggleActive = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('reviews')
            .update({ is_active: !currentStatus })
            .eq('id', id);

        if (!error) {
            setReviews(reviews.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r));
            toast.success('Статус оновлено');
        } else {
            toast.error('Помилка оновлення');
        }
    };

    const moveSortOrder = async (id: string, direction: 'up' | 'down') => {
        const currentIndex = reviews.findIndex(r => r.id === id);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= reviews.length) return;

        const current = reviews[currentIndex];
        const target = reviews[targetIndex];

        // Swap sort_order values
        const tid = toast.loading('Зміна порядку...');

        const { error: error1 } = await supabase
            .from('reviews')
            .update({ sort_order: target.sort_order })
            .eq('id', current.id);

        const { error: error2 } = await supabase
            .from('reviews')
            .update({ sort_order: current.sort_order })
            .eq('id', target.id);

        if (!error1 && !error2) {
            toast.success('Порядок змінено', { id: tid });
            fetchReviews();
        } else {
            toast.error('Помилка зміни порядку', { id: tid });
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-stone-900 flex items-center gap-3">
                        <ImageIcon className="text-amber-500" size={32} />
                        Відгуки (Instagram Stories)
                    </h1>
                    <p className="text-stone-600 mt-2">
                        Керуйте відгуками клієнтів у форматі Instagram Stories (9:16)
                    </p>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all"
                >
                    <Plus size={20} /> Додати відгук
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-6 rounded-xl border border-stone-200">
                    <div className="text-stone-500 text-sm mb-1">Всього відгуків</div>
                    <div className="text-3xl font-bold text-stone-900">{reviews.length}</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-stone-200">
                    <div className="text-stone-500 text-sm mb-1">Активні</div>
                    <div className="text-3xl font-bold text-green-600">
                        {reviews.filter(r => r.is_active).length}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-stone-200">
                    <div className="text-stone-500 text-sm mb-1">Неактивні</div>
                    <div className="text-3xl font-bold text-stone-400">
                        {reviews.filter(r => !r.is_active).length}
                    </div>
                </div>
            </div>

            {/* Reviews Grid (9:16 aspect ratio) */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
                {reviews.length === 0 ? (
                    <div className="text-center py-16 text-stone-500">
                        <ImageIcon size={64} className="mx-auto mb-4 text-stone-300" />
                        <h3 className="text-xl font-bold text-stone-700 mb-2">Ще немає відгуків</h3>
                        <p className="mb-6">Додайте перший відгук клієнта в форматі Instagram Story (9:16)</p>
                        <button
                            onClick={openAddModal}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all"
                        >
                            <Plus size={20} /> Додати перший відгук
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {reviews.map((review, index) => (
                            <div key={review.id} className="relative group">
                                {/* 9:16 Image Container */}
                                <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-stone-100 border-2 border-stone-200">
                                    <Image
                                        src={review.image_url}
                                        alt={review.author || 'Review'}
                                        fill
                                        className="object-cover"
                                    />
                                    {/* Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                                    {/* Author */}
                                    <div className="absolute bottom-2 left-2 right-2">
                                        <p className="text-white text-xs font-bold truncate">
                                            {review.author || 'N/A'}
                                        </p>
                                        {review.category && (
                                            <p className="text-white/70 text-[10px] truncate">
                                                {review.category}
                                            </p>
                                        )}
                                    </div>
                                    {/* Active Status Badge */}
                                    <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${review.is_active ? 'bg-green-500' : 'bg-stone-400'}`} />
                                </div>

                                {/* Hover Actions */}
                                <div className="absolute inset-0 bg-black/80 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 p-2">
                                    {/* Sort Order Controls */}
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => moveSortOrder(review.id, 'up')}
                                            disabled={index === 0}
                                            className="p-1.5 bg-white rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ArrowUp size={14} className="text-stone-700" />
                                        </button>
                                        <button
                                            onClick={() => moveSortOrder(review.id, 'down')}
                                            disabled={index === reviews.length - 1}
                                            className="p-1.5 bg-white rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ArrowDown size={14} className="text-stone-700" />
                                        </button>
                                    </div>

                                    {/* Active Toggle */}
                                    <button
                                        onClick={() => toggleActive(review.id, review.is_active)}
                                        className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-colors ${
                                            review.is_active
                                                ? 'bg-green-500 text-white hover:bg-green-600'
                                                : 'bg-stone-400 text-white hover:bg-stone-500'
                                        }`}
                                    >
                                        {review.is_active ? 'Активний' : 'Неактивний'}
                                    </button>

                                    {/* Edit/Delete */}
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => openEditModal(review)}
                                            className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                        >
                                            <Edit size={14} />
                                        </button>
                                        <button
                                            onClick={() =>
                                                setDeleteModal({
                                                    isOpen: true,
                                                    id: review.id,
                                                    author: review.author || 'Unnamed'
                                                })
                                            }
                                            className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-stone-900">
                                    {editingId ? 'Редагувати відгук' : 'Додати відгук'}
                                </h2>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Image Upload */}
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-stone-700 mb-3">
                                    Зображення (9:16 - Instagram Story) <span className="text-red-500">*</span>
                                </label>

                                {formData.image_url ? (
                                    <div className="relative max-w-xs mx-auto">
                                        <div className="aspect-[9/16] rounded-xl overflow-hidden border-2 border-stone-200">
                                            <Image
                                                src={formData.image_url}
                                                alt="Preview"
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                        <button
                                            onClick={() => setFormData({ ...formData, image_url: '' })}
                                            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="block border-2 border-dashed border-stone-300 rounded-xl p-12 text-center cursor-pointer hover:border-amber-500 hover:bg-amber-50/50 transition-all">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                            disabled={uploading}
                                        />
                                        <Upload size={48} className="mx-auto mb-4 text-stone-400" />
                                        <p className="text-stone-600 font-semibold mb-1">
                                            {uploading ? 'Завантаження...' : 'Оберіть зображення'}
                                        </p>
                                        <p className="text-stone-500 text-sm">
                                            Рекомендований розмір: 1080×1920px (макс. 5MB)
                                        </p>
                                    </label>
                                )}
                            </div>

                            {/* Author */}
                            <div className="mb-4">
                                <label className="block text-sm font-bold text-stone-700 mb-2">
                                    Автор (Instagram)
                                </label>
                                <input
                                    type="text"
                                    value={formData.author}
                                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                    placeholder="@username"
                                    className="w-full px-4 py-3 border-2 border-stone-200 rounded-lg focus:border-amber-500 focus:outline-none"
                                />
                            </div>

                            {/* Category */}
                            <div className="mb-4">
                                <label className="block text-sm font-bold text-stone-700 mb-2">
                                    Категорія
                                </label>
                                <input
                                    type="text"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    placeholder="Travel Book, Весільна книга, тощо"
                                    className="w-full px-4 py-3 border-2 border-stone-200 rounded-lg focus:border-amber-500 focus:outline-none"
                                />
                            </div>

                            {/* Caption */}
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-stone-700 mb-2">
                                    Підпис (опціонально)
                                </label>
                                <textarea
                                    value={formData.caption}
                                    onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                                    placeholder="Короткий опис або коментар..."
                                    rows={3}
                                    className="w-full px-4 py-3 border-2 border-stone-200 rounded-lg focus:border-amber-500 focus:outline-none resize-none"
                                />
                            </div>

                            {/* Active Checkbox */}
                            <div className="mb-6">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-5 h-5 text-amber-500 rounded focus:ring-amber-500"
                                    />
                                    <span className="text-stone-700 font-semibold">Активний (показувати на сайті)</span>
                                </label>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-3 border-2 border-stone-200 rounded-xl font-bold text-stone-700 hover:bg-stone-50 transition-colors"
                                >
                                    Скасувати
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={uploading}
                                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {editingId ? 'Зберегти' : 'Створити'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteModal.isOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl max-w-md w-full p-8"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                                    <AlertTriangle size={32} className="text-red-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-stone-900 mb-2">Видалити відгук?</h3>
                                <p className="text-stone-600 mb-6">
                                    Ви впевнені, що хочете видалити відгук <strong>{deleteModal.author}</strong>?
                                    Цю дію не можна скасувати.
                                </p>
                                <div className="flex items-center gap-3 w-full">
                                    <button
                                        onClick={() => setDeleteModal({ isOpen: false, id: null, author: '' })}
                                        className="flex-1 px-6 py-3 border-2 border-stone-200 rounded-xl font-bold text-stone-700 hover:bg-stone-50 transition-colors"
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
                                    >
                                        Видалити
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
