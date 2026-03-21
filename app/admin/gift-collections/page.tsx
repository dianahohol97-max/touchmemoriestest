'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'sonner';
import { ChevronUp, ChevronDown, X, Plus, Search, Gift } from 'lucide-react';
import Image from 'next/image';

type GiftCollection = {
    id: string;
    slug: string;
    label: string;
    label_uk: string;
    emoji: string | null;
    sort_order: number;
    is_active: boolean;
};

type Product = {
    id: string;
    name: string;
    slug: string;
    price: number;
    images: string[];
};

type CollectionItem = {
    id: string;
    product_id: string;
    sort_order: number;
    products: Product;
};

export default function GiftCollectionsAdminPage() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [collections, setCollections] = useState<GiftCollection[]>([]);
    const [selectedCollection, setSelectedCollection] = useState<GiftCollection | null>(null);
    const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

    // Fetch all collections
    const fetchCollections = async () => {
        const { data, error } = await supabase
            .from('gift_collections')
            .select('*')
            .order('sort_order');

        if (error) {
            toast.error('Помилка завантаження колекцій');
            console.error(error);
        } else {
            setCollections(data || []);
        }
        setLoading(false);
    };

    // Fetch products for selected collection
    const fetchCollectionItems = async (collectionId: string) => {
        const { data, error } = await supabase
            .from('gift_collection_items')
            .select(`
                id,
                product_id,
                sort_order,
                products (
                    id,
                    name,
                    slug,
                    price,
                    images
                )
            `)
            .eq('collection_id', collectionId)
            .order('sort_order');

        if (error) {
            toast.error('Помилка завантаження товарів');
            console.error(error);
        } else {
            setCollectionItems((data as any) || []);
        }
    };

    // Fetch all products for the picker
    const fetchAllProducts = async () => {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, slug, price, images')
            .eq('is_active', true)
            .order('name');

        if (error) {
            console.error(error);
        } else {
            setAllProducts(data || []);
        }
    };

    useEffect(() => {
        fetchCollections();
        fetchAllProducts();
    }, []);

    useEffect(() => {
        if (selectedCollection) {
            fetchCollectionItems(selectedCollection.id);
        }
    }, [selectedCollection]);

    // Toggle active status
    const toggleActive = async (collection: GiftCollection) => {
        const { error } = await supabase
            .from('gift_collections')
            .update({ is_active: !collection.is_active })
            .eq('id', collection.id);

        if (error) {
            toast.error('Помилка оновлення');
        } else {
            toast.success(collection.is_active ? 'Колекцію приховано' : 'Колекцію активовано');
            fetchCollections();
        }
    };

    // Move collection up/down
    const moveCollection = async (collection: GiftCollection, direction: 'up' | 'down') => {
        const currentIndex = collections.findIndex(c => c.id === collection.id);
        if (
            (direction === 'up' && currentIndex === 0) ||
            (direction === 'down' && currentIndex === collections.length - 1)
        ) {
            return;
        }

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        const otherCollection = collections[newIndex];

        // Swap sort_order values
        await supabase
            .from('gift_collections')
            .update({ sort_order: otherCollection.sort_order })
            .eq('id', collection.id);

        await supabase
            .from('gift_collections')
            .update({ sort_order: collection.sort_order })
            .eq('id', otherCollection.id);

        fetchCollections();
    };

    // Remove product from collection
    const removeProduct = async (itemId: string) => {
        const { error } = await supabase
            .from('gift_collection_items')
            .delete()
            .eq('id', itemId);

        if (error) {
            toast.error('Помилка видалення товару');
        } else {
            toast.success('Товар видалено з колекції');
            if (selectedCollection) {
                fetchCollectionItems(selectedCollection.id);
            }
        }
    };

    // Add products to collection
    const addProductsToCollection = async () => {
        if (!selectedCollection || selectedProducts.length === 0) return;

        // Get max sort_order
        const maxSortOrder = collectionItems.length > 0
            ? Math.max(...collectionItems.map(item => item.sort_order))
            : 0;

        const items = selectedProducts.map((productId, index) => ({
            collection_id: selectedCollection.id,
            product_id: productId,
            sort_order: maxSortOrder + index + 1
        }));

        const { error } = await supabase
            .from('gift_collection_items')
            .insert(items);

        if (error) {
            if (error.code === '23505') {
                toast.error('Деякі товари вже додані до цієї колекції');
            } else {
                toast.error('Помилка додавання товарів');
            }
        } else {
            toast.success(`Додано ${selectedProducts.length} товарів до колекції`);
            setShowProductPicker(false);
            setSelectedProducts([]);
            setSearchTerm('');
            fetchCollectionItems(selectedCollection.id);
        }
    };

    // Filter products for picker
    const filteredProducts = allProducts.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter out already assigned products
    const assignedProductIds = collectionItems.map(item => item.product_id);
    const availableProducts = filteredProducts.filter(
        product => !assignedProductIds.includes(product.id)
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-[#263a99] font-bold">Завантаження...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f9ff] p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-black text-[#263a99] mb-2">
                        Подарункові колекції
                    </h1>
                    <p className="text-stone-600">
                        Керуйте колекціями подарунків та призначайте товари для кожної категорії
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LEFT PANEL - Collections List */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
                        <h2 className="text-xl font-bold text-stone-900 mb-6">
                            Колекції ({collections.length})
                        </h2>

                        <div className="space-y-3">
                            {collections.map((collection, index) => (
                                <div
                                    key={collection.id}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                        selectedCollection?.id === collection.id
                                            ? 'border-[#263a99] bg-[#f0f3ff]'
                                            : 'border-stone-200 hover:border-stone-300'
                                    }`}
                                    onClick={() => setSelectedCollection(collection)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1">
                                            <span className="text-2xl">{collection.emoji || '🎁'}</span>
                                            <div className="flex-1">
                                                <div className="font-bold text-stone-900">
                                                    {collection.label_uk}
                                                </div>
                                                <div className="text-sm text-stone-500">
                                                    {collection.slug}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Active Toggle */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleActive(collection);
                                                }}
                                                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                                                    collection.is_active
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-stone-100 text-stone-500'
                                                }`}
                                            >
                                                {collection.is_active ? 'Активна' : 'Прихована'}
                                            </button>

                                            {/* Sort buttons */}
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        moveCollection(collection, 'up');
                                                    }}
                                                    disabled={index === 0}
                                                    className="p-1 hover:bg-stone-200 rounded disabled:opacity-30"
                                                >
                                                    <ChevronUp size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        moveCollection(collection, 'down');
                                                    }}
                                                    disabled={index === collections.length - 1}
                                                    className="p-1 hover:bg-stone-200 rounded disabled:opacity-30"
                                                >
                                                    <ChevronDown size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT PANEL - Products in Selected Collection */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
                        {selectedCollection ? (
                            <>
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-stone-900">
                                            Товари в колекції "{selectedCollection.label_uk}"
                                        </h2>
                                        <p className="text-sm text-stone-500 mt-1">
                                            {collectionItems.length} товарів
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowProductPicker(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#263a99] text-white font-bold rounded-md hover:bg-[#1a2966] transition-colors"
                                    >
                                        <Plus size={20} />
                                        Додати товари
                                    </button>
                                </div>

                                {collectionItems.length === 0 ? (
                                    <div className="text-center py-16 text-stone-400">
                                        <Gift size={64} className="mx-auto mb-4 opacity-20" />
                                        <p className="font-semibold">Товарів ще немає</p>
                                        <p className="text-sm">Додайте товари до цієї колекції</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {collectionItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center gap-4 p-3 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
                                            >
                                                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                                                    {item.products.images?.[0] ? (
                                                        <Image
                                                            src={item.products.images[0]}
                                                            alt={item.products.name}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-stone-300">
                                                            <Gift size={24} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-semibold text-stone-900">
                                                        {item.products.name}
                                                    </div>
                                                    <div className="text-sm text-stone-500">
                                                        {item.products.price} ₴
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeProduct(item.id)}
                                                    className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                                    title="Видалити з колекції"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-16 text-stone-400">
                                <p className="font-semibold">Оберіть колекцію</p>
                                <p className="text-sm">Виберіть колекцію зліва для редагування</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Product Picker Modal */}
            {showProductPicker && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-stone-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-2xl font-bold text-stone-900">
                                    Додати товари до колекції
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowProductPicker(false);
                                        setSelectedProducts([]);
                                        setSearchTerm('');
                                    }}
                                    className="p-2 hover:bg-stone-100 rounded-lg"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Пошук товарів..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#263a99]"
                                />
                            </div>

                            {selectedProducts.length > 0 && (
                                <div className="mt-3 text-sm text-stone-600">
                                    Обрано: {selectedProducts.length} товарів
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {availableProducts.map((product) => {
                                    const isSelected = selectedProducts.includes(product.id);
                                    return (
                                        <div
                                            key={product.id}
                                            onClick={() => {
                                                setSelectedProducts(prev =>
                                                    isSelected
                                                        ? prev.filter(id => id !== product.id)
                                                        : [...prev, product.id]
                                                );
                                            }}
                                            className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                                                isSelected
                                                    ? 'border-[#263a99] bg-[#f0f3ff]'
                                                    : 'border-stone-200 hover:border-stone-300'
                                            }`}
                                        >
                                            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                                                {product.images?.[0] ? (
                                                    <Image
                                                        src={product.images[0]}
                                                        alt={product.name}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                                                        <Gift size={24} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-stone-900 truncate">
                                                    {product.name}
                                                </div>
                                                <div className="text-sm text-stone-500">
                                                    {product.price} ₴
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="w-6 h-6 bg-[#263a99] text-white rounded-full flex items-center justify-center flex-shrink-0">
                                                    ✓
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {availableProducts.length === 0 && (
                                <div className="text-center py-16 text-stone-400">
                                    <p>Товарів не знайдено</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-stone-200">
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowProductPicker(false);
                                        setSelectedProducts([]);
                                        setSearchTerm('');
                                    }}
                                    className="flex-1 px-6 py-3 border-2 border-stone-300 text-stone-700 font-bold rounded-md hover:bg-stone-50 transition-colors"
                                >
                                    Скасувати
                                </button>
                                <button
                                    onClick={addProductsToCollection}
                                    disabled={selectedProducts.length === 0}
                                    className="flex-1 px-6 py-3 bg-[#263a99] text-white font-bold rounded-md hover:bg-[#1a2966] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Додати {selectedProducts.length > 0 && `(${selectedProducts.length})`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
