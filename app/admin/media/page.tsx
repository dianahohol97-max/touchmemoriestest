'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
    Upload,
    Trash2,
    Search,
    Folder,
    Image as ImageIcon,
    X,
    Copy,
    Check,
    Activity,
    Grid3x3,
    List,
    Tag,
    Download,
    Edit3
} from 'lucide-react';
import Image from 'next/image';

interface MediaFile {
    id: string;
    file_name: string;
    file_url: string;
    file_size: number;
    file_type: string;
    alt_text: string | null;
    caption: string | null;
    width: number | null;
    height: number | null;
    folder: string;
    tags: string[];
    is_active: boolean;
    created_at: string;
}

export default function MediaLibraryPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [media, setMedia] = useState<MediaFile[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);
    const [editingMedia, setEditingMedia] = useState<MediaFile | null>(null);
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

    const [editForm, setEditForm] = useState({
        alt_text: '',
        caption: '',
        folder: 'uncategorized',
        tags: [] as string[]
    });

    const [tagInput, setTagInput] = useState('');

    useEffect(() => {
        fetchMedia();
    }, [selectedFolder]);

    async function fetchMedia() {
        setLoading(true);
        try {
            let query = supabase
                .from('media_library')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (selectedFolder !== 'all') {
                query = query.eq('folder', selectedFolder);
            }

            const { data, error } = await query;

            if (error) throw error;
            setMedia(data || []);
        } catch (error) {
            console.error('Error fetching media:', error);
            toast.error('Помилка завантаження медіафайлів');
        } finally {
            setLoading(false);
        }
    }

    async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);

        try {
            for (const file of Array.from(files)) {
                // Upload to Supabase Storage
                const fileName = `${Date.now()}_${file.name}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('media')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('media')
                    .getPublicUrl(fileName);

                // Get image dimensions
                const img = new window.Image();
                img.src = URL.createObjectURL(file);
                await new Promise((resolve) => {
                    img.onload = resolve;
                });

                // Save to database
                const { error: dbError } = await supabase
                    .from('media_library')
                    .insert([
                        {
                            file_name: file.name,
                            file_url: urlData.publicUrl,
                            file_size: file.size,
                            file_type: file.type,
                            width: img.width,
                            height: img.height,
                            folder: selectedFolder === 'all' ? 'uncategorized' : selectedFolder,
                            tags: []
                        }
                    ]);

                if (dbError) throw dbError;

                URL.revokeObjectURL(img.src);
            }

            toast.success(`Завантажено файлів: ${files.length}`);
            await fetchMedia();
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error('Помилка завантаження: ' + error.message);
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    }

    async function deleteMedia(id: string) {
        if (!confirm('Видалити файл назавжди?')) return;

        try {
            const { error } = await supabase
                .from('media_library')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success('Файл видалено');
            setMedia(media.filter((m) => m.id !== id));
            setSelectedMedia(null);
        } catch (error: any) {
            console.error('Delete error:', error);
            toast.error('Помилка видалення');
        }
    }

    function startEdit(mediaFile: MediaFile) {
        setEditingMedia(mediaFile);
        setEditForm({
            alt_text: mediaFile.alt_text || '',
            caption: mediaFile.caption || '',
            folder: mediaFile.folder,
            tags: mediaFile.tags || []
        });
    }

    async function saveEdit() {
        if (!editingMedia) return;

        try {
            const { error } = await supabase
                .from('media_library')
                .update({
                    alt_text: editForm.alt_text,
                    caption: editForm.caption,
                    folder: editForm.folder,
                    tags: editForm.tags
                })
                .eq('id', editingMedia.id);

            if (error) throw error;

            toast.success('Збережено');
            setEditingMedia(null);
            await fetchMedia();
        } catch (error: any) {
            console.error('Save error:', error);
            toast.error('Помилка збереження');
        }
    }

    function addTag() {
        if (!tagInput.trim()) return;
        if (editForm.tags.includes(tagInput.trim())) {
            toast.error('Тег вже додано');
            return;
        }
        setEditForm({
            ...editForm,
            tags: [...editForm.tags, tagInput.trim()]
        });
        setTagInput('');
    }

    function removeTag(tag: string) {
        setEditForm({
            ...editForm,
            tags: editForm.tags.filter((t) => t !== tag)
        });
    }

    function copyToClipboard(url: string) {
        navigator.clipboard.writeText(url);
        setCopiedUrl(url);
        toast.success('URL скопійовано в буфер обміну');
        setTimeout(() => setCopiedUrl(null), 2000);
    }

    const filteredMedia = media.filter((m) =>
        m.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.alt_text?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const folders = Array.from(new Set(media.map((m) => m.folder)));
    const totalSize = media.reduce((sum, m) => sum + m.file_size, 0);

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Медіатека</h1>
                <p className="text-gray-600">
                    Завантажуйте та керуйте зображеннями для сайту ({media.length} файлів, {(totalSize / 1024 / 1024).toFixed(2)} MB)
                </p>
            </div>

            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Upload size={20} />
                        Завантажити файли
                    </h2>
                    <label className="flex items-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#162159] cursor-pointer transition-colors">
                        {uploading ? (
                            <>
                                <Activity className="animate-spin" size={18} />
                                Завантаження...
                            </>
                        ) : (
                            <>
                                <Upload size={18} />
                                Вибрати файли
                            </>
                        )}
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleFileUpload}
                            disabled={uploading}
                            className="hidden"
                        />
                    </label>
                </div>
                <p className="text-sm text-gray-500">
                    Підтримуються формати: JPG, PNG, GIF, WebP. Рекомендований розмір: до 5 MB на файл.
                </p>
            </div>

            {/* Filters and Search */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Пошук за назвою або alt-текстом..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                        />
                    </div>

                    {/* Folder Filter */}
                    <select
                        value={selectedFolder}
                        onChange={(e) => setSelectedFolder(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                    >
                        <option value="all">Всі папки</option>
                        <option value="uncategorized">Без категорії</option>
                        {folders.filter(f => f !== 'uncategorized').map((folder) => (
                            <option key={folder} value={folder}>
                                {folder}
                            </option>
                        ))}
                        <option value="products">Продукти</option>
                        <option value="blog">Блог</option>
                        <option value="hero">Головна сторінка</option>
                        <option value="banners">Банери</option>
                    </select>

                    {/* View Mode Toggle */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg border ${
                                viewMode === 'grid'
                                    ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]'
                                    : 'bg-white text-gray-600 border-gray-300'
                            }`}
                        >
                            <Grid3x3 size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg border ${
                                viewMode === 'list'
                                    ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]'
                                    : 'bg-white text-gray-600 border-gray-300'
                            }`}
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Media Grid/List */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Activity className="animate-spin" size={48} color="#263A99" />
                </div>
            ) : filteredMedia.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                    <ImageIcon size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 font-medium">Файлів не знайдено</p>
                    <p className="text-sm text-gray-400 mt-1">Завантажте зображення для початку роботи</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredMedia.map((file) => (
                        <div
                            key={file.id}
                            className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-[#1e2d7d] hover:shadow-lg transition-all cursor-pointer"
                            onClick={() => setSelectedMedia(file)}
                        >
                            <div className="aspect-square relative bg-gray-100">
                                <Image
                                    src={file.file_url}
                                    alt={file.alt_text || file.file_name}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <div className="p-3">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {file.file_name}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {(file.file_size / 1024).toFixed(0)} KB • {file.width}×{file.height}
                                </p>
                            </div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        copyToClipboard(file.file_url);
                                    }}
                                    className="p-1.5 bg-white rounded shadow-md hover:bg-gray-50"
                                    title="Копіювати URL"
                                >
                                    {copiedUrl === file.file_url ? (
                                        <Check size={14} className="text-green-600" />
                                    ) : (
                                        <Copy size={14} className="text-gray-600" />
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Прев'ю</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Назва файлу</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Розмір</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Розміри</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Папка</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Дії</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMedia.map((file) => (
                                <tr key={file.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="w-12 h-12 relative bg-gray-100 rounded">
                                            <Image
                                                src={file.file_url}
                                                alt={file.alt_text || file.file_name}
                                                fill
                                                className="object-cover rounded"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-sm font-medium text-gray-900">{file.file_name}</p>
                                        {file.alt_text && (
                                            <p className="text-xs text-gray-500 mt-1">{file.alt_text}</p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {(file.file_size / 1024).toFixed(0)} KB
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {file.width}×{file.height}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                            <Folder size={12} />
                                            {file.folder}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => startEdit(file)}
                                                className="p-1.5 text-gray-600 hover:text-[#1e2d7d] hover:bg-gray-100 rounded"
                                                title="Редагувати"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={() => copyToClipboard(file.file_url)}
                                                className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-gray-100 rounded"
                                                title="Копіювати URL"
                                            >
                                                <Copy size={16} />
                                            </button>
                                            <button
                                                onClick={() => deleteMedia(file.id)}
                                                className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded"
                                                title="Видалити"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Detail Modal */}
            {selectedMedia && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedMedia(null)}
                >
                    <div
                        className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Деталі файлу</h3>
                            <button
                                onClick={() => setSelectedMedia(null)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                                        <Image
                                            src={selectedMedia.file_url}
                                            alt={selectedMedia.alt_text || selectedMedia.file_name}
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => copyToClipboard(selectedMedia.file_url)}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                        >
                                            {copiedUrl === selectedMedia.file_url ? (
                                                <>
                                                    <Check size={16} className="text-green-600" />
                                                    Скопійовано
                                                </>
                                            ) : (
                                                <>
                                                    <Copy size={16} />
                                                    Копіювати URL
                                                </>
                                            )}
                                        </button>
                                        <a
                                            href={selectedMedia.file_url}
                                            download
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                        >
                                            <Download size={16} />
                                        </a>
                                    </div>
                                </div>
                                <div>
                                    <dl className="space-y-4">
                                        <div>
                                            <dt className="text-sm font-semibold text-gray-600 mb-1">Назва файлу</dt>
                                            <dd className="text-sm text-gray-900">{selectedMedia.file_name}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-semibold text-gray-600 mb-1">URL</dt>
                                            <dd className="text-xs text-gray-900 break-all bg-gray-50 p-2 rounded">
                                                {selectedMedia.file_url}
                                            </dd>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <dt className="text-sm font-semibold text-gray-600 mb-1">Розмір файлу</dt>
                                                <dd className="text-sm text-gray-900">
                                                    {(selectedMedia.file_size / 1024).toFixed(2)} KB
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-sm font-semibold text-gray-600 mb-1">Розміри</dt>
                                                <dd className="text-sm text-gray-900">
                                                    {selectedMedia.width}×{selectedMedia.height}px
                                                </dd>
                                            </div>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-semibold text-gray-600 mb-1">Тип</dt>
                                            <dd className="text-sm text-gray-900">{selectedMedia.file_type}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-semibold text-gray-600 mb-1">Папка</dt>
                                            <dd className="text-sm text-gray-900 flex items-center gap-1">
                                                <Folder size={14} />
                                                {selectedMedia.folder}
                                            </dd>
                                        </div>
                                        {selectedMedia.alt_text && (
                                            <div>
                                                <dt className="text-sm font-semibold text-gray-600 mb-1">Alt-текст</dt>
                                                <dd className="text-sm text-gray-900">{selectedMedia.alt_text}</dd>
                                            </div>
                                        )}
                                        {selectedMedia.caption && (
                                            <div>
                                                <dt className="text-sm font-semibold text-gray-600 mb-1">Підпис</dt>
                                                <dd className="text-sm text-gray-900">{selectedMedia.caption}</dd>
                                            </div>
                                        )}
                                        {selectedMedia.tags.length > 0 && (
                                            <div>
                                                <dt className="text-sm font-semibold text-gray-600 mb-1">Теги</dt>
                                                <dd className="flex flex-wrap gap-2">
                                                    {selectedMedia.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                                                        >
                                                            <Tag size={12} />
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </dd>
                                            </div>
                                        )}
                                        <div>
                                            <dt className="text-sm font-semibold text-gray-600 mb-1">Дата завантаження</dt>
                                            <dd className="text-sm text-gray-900">
                                                {new Date(selectedMedia.created_at).toLocaleString('uk-UA')}
                                            </dd>
                                        </div>
                                    </dl>
                                    <div className="mt-6 pt-6 border-t border-gray-200 flex gap-3">
                                        <button
                                            onClick={() => {
                                                startEdit(selectedMedia);
                                                setSelectedMedia(null);
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#162159] transition-colors"
                                        >
                                            <Edit3 size={16} />
                                            Редагувати
                                        </button>
                                        <button
                                            onClick={() => {
                                                deleteMedia(selectedMedia.id);
                                                setSelectedMedia(null);
                                            }}
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                            Видалити
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingMedia && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={() => setEditingMedia(null)}
                >
                    <div
                        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Редагувати файл</h3>
                            <button
                                onClick={() => setEditingMedia(null)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Alt-текст</label>
                                    <input
                                        type="text"
                                        value={editForm.alt_text}
                                        onChange={(e) => setEditForm({ ...editForm, alt_text: e.target.value })}
                                        placeholder="Опис зображення для доступності"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Підпис</label>
                                    <textarea
                                        value={editForm.caption}
                                        onChange={(e) => setEditForm({ ...editForm, caption: e.target.value })}
                                        placeholder="Підпис під зображенням"
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Папка</label>
                                    <select
                                        value={editForm.folder}
                                        onChange={(e) => setEditForm({ ...editForm, folder: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                    >
                                        <option value="uncategorized">Без категорії</option>
                                        <option value="products">Продукти</option>
                                        <option value="blog">Блог</option>
                                        <option value="hero">Головна сторінка</option>
                                        <option value="banners">Банери</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Теги</label>
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addTag();
                                                }
                                            }}
                                            placeholder="Додати тег"
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                        />
                                        <button
                                            type="button"
                                            onClick={addTag}
                                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                        >
                                            Додати
                                        </button>
                                    </div>
                                    {editForm.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {editForm.tags.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                                                >
                                                    <Tag size={12} />
                                                    {tag}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeTag(tag)}
                                                        className="ml-1 hover:text-red-600"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-200 flex gap-3">
                                <button
                                    onClick={() => setEditingMedia(null)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Скасувати
                                </button>
                                <button
                                    onClick={saveEdit}
                                    className="flex-1 px-4 py-2 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#162159] transition-colors"
                                >
                                    Зберегти
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
