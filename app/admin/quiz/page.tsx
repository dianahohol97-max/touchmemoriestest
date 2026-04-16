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
    Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

interface Product {
    id: string;
    name: string;
    slug: string;
}

interface QuizRecommendation {
    id: string;
    q1_answer: string;
    q2_answers: string[];
    product_ids: string[];
    label: string;
    updated_at: string;
}

const Q1_OPTIONS = [
    { label: "Дитина (0-12)", value: "child" },
    { label: "Підліток (13-18)", value: "teen" },
    { label: "Молодь (19-35)", value: "young" },
    { label: "Дорослі (36-60)", value: "adult" },
    { label: "60+", value: "senior" }
];

const Q2_OPTIONS = [
    { label: "Подорожі та пригоди", value: "travel" },
    { label: "Сім'я та дім", value: "family" },
    { label: "Стиль та естетика", value: "style" },
    { label: "Спогади та історія", value: "memories" },
    { label: "Кар'єра та досягнення", value: "career" }
];

export default function QuizAdminPage() {
    const supabase = createClient();

    const [recommendations, setRecommendations] = useState<QuizRecommendation[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        q1_answer: '',
        q2_answers: [] as string[],
        product_ids: [] as string[],
        label: ''
    });

    // Delete modal state
    const [deleteModal, setDeleteModal] = useState<{
        isOpen: boolean;
        id: string | null;
        label: string;
    }>({
        isOpen: false,
        id: null,
        label: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        await Promise.all([fetchRecommendations(), fetchProducts()]);
        setLoading(false);
    }

    async function fetchRecommendations() {
        const { data, error } = await supabase
            .from('quiz_recommendations')
            .select('*')
            .order('updated_at', { ascending: false });

        if (data) setRecommendations(data);
        if (error) toast.error('Помилка завантаження рекомендацій');
    }

    async function fetchProducts() {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, slug')
            .eq('is_active', true)
            .order('name');

        if (data) setProducts(data);
        if (error) toast.error('Помилка завантаження продуктів');
    }

    const openAddModal = () => {
        setEditingId(null);
        setFormData({
            q1_answer: '',
            q2_answers: [],
            product_ids: [],
            label: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = (rec: QuizRecommendation) => {
        setEditingId(rec.id);
        setFormData({
            q1_answer: rec.q1_answer,
            q2_answers: rec.q2_answers || [],
            product_ids: rec.product_ids || [],
            label: rec.label
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.q1_answer || formData.q2_answers.length === 0 || formData.product_ids.length === 0) {
            toast.error('Заповніть усі обов\'язкові поля');
            return;
        }

        const tid = toast.loading(editingId ? 'Оновлення...' : 'Створення...');

        const payload = {
            q1_answer: formData.q1_answer,
            q2_answers: formData.q2_answers,
            product_ids: formData.product_ids,
            label: formData.label || `${formData.q1_answer} + ${formData.q2_answers.join(', ')}`
        };

        let error;

        if (editingId) {
            const result = await supabase
                .from('quiz_recommendations')
                .update(payload)
                .eq('id', editingId);
            error = result.error;
        } else {
            const result = await supabase
                .from('quiz_recommendations')
                .insert([payload]);
            error = result.error;
        }

        if (!error) {
            toast.success(editingId ? 'Оновлено' : 'Створено', { id: tid });
            setIsModalOpen(false);
            fetchRecommendations();
        } else {
            toast.error('Помилка збереження', { id: tid });
        }
    };

    const handleDelete = async () => {
        if (!deleteModal.id) return;

        const tid = toast.loading('Видалення...');
        const { error } = await supabase
            .from('quiz_recommendations')
            .delete()
            .eq('id', deleteModal.id);

        if (!error) {
            toast.success('Видалено', { id: tid });
            setDeleteModal({ isOpen: false, id: null, label: '' });
            fetchRecommendations();
        } else {
            toast.error('Помилка видалення', { id: tid });
        }
    };

    const toggleQ2Answer = (value: string) => {
        if (formData.q2_answers.includes(value)) {
            setFormData({
                ...formData,
                q2_answers: formData.q2_answers.filter(v => v !== value)
            });
        } else {
            setFormData({
                ...formData,
                q2_answers: [...formData.q2_answers, value]
            });
        }
    };

    const toggleProduct = (id: string) => {
        if (formData.product_ids.includes(id)) {
            setFormData({
                ...formData,
                product_ids: formData.product_ids.filter(pid => pid !== id)
            });
        } else {
            setFormData({
                ...formData,
                product_ids: [...formData.product_ids, id]
            });
        }
    };

    const getQ1Label = (value: string) => Q1_OPTIONS.find(o => o.value === value)?.label || value;
    const getQ2Labels = (values: string[]) => values.map(v => Q2_OPTIONS.find(o => o.value === v)?.label || v).join(', ');
    const getProductNames = (ids: string[]) => ids.map(id => products.find(p => p.id === id)?.name || 'N/A').join(', ');

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
                        <Sparkles className="text-amber-500" size={32} />
                        Налаштування Квізу
                    </h1>
                    <p className="text-stone-600 mt-2">
                        Керуйте рекомендаціями продуктів для різних комбінацій відповідей у квізі подарунків
                    </p>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all"
                >
                    <Plus size={20} /> Додати комбінацію
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-6 rounded-xl border border-stone-200">
                    <div className="text-stone-500 text-sm mb-1">Всього комбінацій</div>
                    <div className="text-3xl font-bold text-stone-900">{recommendations.length}</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-stone-200">
                    <div className="text-stone-500 text-sm mb-1">Активних продуктів</div>
                    <div className="text-3xl font-bold text-stone-900">{products.length}</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-stone-200">
                    <div className="text-stone-500 text-sm mb-1">Останнє оновлення</div>
                    <div className="text-sm font-semibold text-stone-700">
                        {recommendations.length > 0
                            ? new Date(recommendations[0].updated_at).toLocaleDateString('uk-UA')
                            : 'N/A'}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-stone-50 border-b border-stone-200">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-stone-700 uppercase tracking-wider">
                                Вік (Q1)
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-stone-700 uppercase tracking-wider">
                                Інтереси (Q2)
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-stone-700 uppercase tracking-wider">
                                Рекомендовані продукти
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-stone-700 uppercase tracking-wider">
                                Мітка
                            </th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-stone-700 uppercase tracking-wider">
                                Дії
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                        {recommendations.map((rec) => (
                            <tr key={rec.id} className="hover:bg-stone-50 transition-colors">
                                <td className="px-6 py-4 text-sm font-semibold text-stone-900">
                                    {getQ1Label(rec.q1_answer)}
                                </td>
                                <td className="px-6 py-4 text-sm text-stone-600">
                                    {getQ2Labels(rec.q2_answers)}
                                </td>
                                <td className="px-6 py-4 text-sm text-stone-600">
                                    {getProductNames(rec.product_ids)}
                                </td>
                                <td className="px-6 py-4 text-sm text-stone-500 italic">
                                    {rec.label}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => openEditModal(rec)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button
                                            onClick={() =>
                                                setDeleteModal({ isOpen: true, id: rec.id, label: rec.label })
                                            }
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {recommendations.length === 0 && (
                    <div className="text-center py-12 text-stone-500">
                        <Sparkles size={48} className="mx-auto mb-4 text-stone-300" />
                        <p>Ще немає комбінацій. Додайте першу!</p>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-stone-900">
                                    {editingId ? 'Редагувати комбінацію' : 'Додати комбінацію'}
                                </h2>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Q1 Selection */}
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-stone-700 mb-3">
                                    Вік отримувача (Q1) <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {Q1_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => setFormData({ ...formData, q1_answer: option.value })}
                                            className={`p-3 rounded-lg border-2 text-left font-semibold transition-all ${
                                                formData.q1_answer === option.value
                                                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                                                    : 'border-stone-200 hover:border-amber-300'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Q2 Multi-Selection */}
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-stone-700 mb-3">
                                    Інтереси (Q2) - можна обрати декілька <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {Q2_OPTIONS.map((option) => {
                                        const isSelected = formData.q2_answers.includes(option.value);
                                        return (
                                            <button
                                                key={option.value}
                                                onClick={() => toggleQ2Answer(option.value)}
                                                className={`p-3 rounded-lg border-2 text-left font-semibold transition-all flex items-center justify-between ${
                                                    isSelected
                                                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                                                        : 'border-stone-200 hover:border-amber-300'
                                                }`}
                                            >
                                                {option.label}
                                                {isSelected && <Check size={20} className="text-amber-600" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Product Multi-Selection */}
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-stone-700 mb-3">
                                    Рекомендовані продукти <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                                    {products.map((product) => {
                                        const isSelected = formData.product_ids.includes(product.id);
                                        return (
                                            <button
                                                key={product.id}
                                                onClick={() => toggleProduct(product.id)}
                                                className={`p-3 rounded-lg border-2 text-left font-semibold transition-all flex items-center justify-between ${
                                                    isSelected
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                        : 'border-stone-200 hover:border-blue-300'
                                                }`}
                                            >
                                                <span className="text-sm">{product.name}</span>
                                                {isSelected && <Check size={18} className="text-blue-600" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Label (Optional) */}
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-stone-700 mb-3">
                                    Мітка (опціонально)
                                </label>
                                <input
                                    type="text"
                                    value={formData.label}
                                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                    placeholder="Наприклад: Молодь + Подорожі"
                                    className="w-full px-4 py-3 border-2 border-stone-200 rounded-lg focus:border-amber-500 focus:outline-none"
                                />
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
                                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                                >
                                    {editingId ? 'Зберегти' : 'Створити'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            {/* Delete Confirmation Modal */}
            {deleteModal.isOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-md w-full p-8"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                                    <AlertTriangle size={32} className="text-red-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-stone-900 mb-2">Видалити комбінацію?</h3>
                                <p className="text-stone-600 mb-6">
                                    Ви впевнені, що хочете видалити комбінацію <strong>"{deleteModal.label}"</strong>?
                                    Цю дію не можна скасувати.
                                </p>
                                <div className="flex items-center gap-3 w-full">
                                    <button
                                        onClick={() => setDeleteModal({ isOpen: false, id: null, label: '' })}
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
                        </div>
                    </div>
                )}
        </div>
    );
}
