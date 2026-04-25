'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import {
    DndContext,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Star,
    Save,
    AlertTriangle,
    Activity,
    GripVertical,
    Image as ImageIcon,
    Package,
    Search,
    X,
    Plus,
    Minus
} from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

interface Product {
    id: string;
    name: string;
    price: number;
    images: string[];
    is_popular: boolean;
    popular_order: number | null;
    category_id: string | null;
    is_active: boolean;
}

interface Category {
    id: string;
    name: string;
}

const MAX_POPULAR_PRODUCTS = 8;

export default function PopularProductsPage() {
    const supabase = createClient();

    const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
    const [popularProducts, setPopularProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [showInactive, setShowInactive] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const [productsRes, categoriesRes] = await Promise.all([
                supabase
                    .from('products')
                    .select('id, name, price, images, is_popular, popular_order, category_id, is_active')
                    .order('name'),
                supabase
                    .from('categories')
                    .select('id, name')
                    .order('name')
            ]);

            if (categoriesRes.data) setCategories(categoriesRes.data);

            if (productsRes.data) {
                const popular = productsRes.data
                    .filter(p => p.is_popular)
                    .sort((a, b) => (a.popular_order || 0) - (b.popular_order || 0));

                const available = productsRes.data.filter(p => !p.is_popular);

                setPopularProducts(popular);
                setAvailableProducts(available);
                setHasChanges(false);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            toast.error('Помилка завантаження продуктів');
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeProduct = [...availableProducts, ...popularProducts].find(p => p.id === active.id);
        if (!activeProduct) return;

        const isMovingToPopular = over.id === 'popular-droppable' || popularProducts.some(p => p.id === over.id);
        const isMovingToAvailable = over.id === 'available-droppable' || availableProducts.some(p => p.id === over.id);

        // Moving from available to popular
        if (!activeProduct.is_popular && isMovingToPopular) {
            if (popularProducts.length >= MAX_POPULAR_PRODUCTS) {
                toast.error(`Максимум ${MAX_POPULAR_PRODUCTS} популярних товарів`);
                return;
            }

            setAvailableProducts(prev => prev.filter(p => p.id !== activeProduct.id));
            setPopularProducts(prev => [...prev, { ...activeProduct, is_popular: true }]);
            setHasChanges(true);
        }
        // Moving from popular to available
        else if (activeProduct.is_popular && isMovingToAvailable) {
            setPopularProducts(prev => prev.filter(p => p.id !== activeProduct.id));
            setAvailableProducts(prev => [...prev, { ...activeProduct, is_popular: false, popular_order: null }]);
            setHasChanges(true);
        }
        // Reordering within popular
        else if (activeProduct.is_popular && isMovingToPopular && active.id !== over.id) {
            const oldIndex = popularProducts.findIndex(p => p.id === active.id);
            const newIndex = popularProducts.findIndex(p => p.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newPopular = [...popularProducts];
                const [movedItem] = newPopular.splice(oldIndex, 1);
                newPopular.splice(newIndex, 0, movedItem);
                setPopularProducts(newPopular);
                setHasChanges(true);
            }
        }
    };

    const saveChanges = async () => {
        setSaving(true);
        try {
            // Update popular products with order
            const popularUpdates = popularProducts.map((product, index) =>
                supabase
                    .from('products')
                    .update({
                        is_popular: true,
                        popular_order: index + 1
                    })
                    .eq('id', product.id)
            );

            // Update available products (remove from popular)
            const availableUpdates = availableProducts
                .filter(p => p.is_popular) // Only update if they were previously popular
                .map(product =>
                    supabase
                        .from('products')
                        .update({
                            is_popular: false,
                            popular_order: null
                        })
                        .eq('id', product.id)
                );

            await Promise.all([...popularUpdates, ...availableUpdates]);

            toast.success('Популярні товари збережено');
            setHasChanges(false);
            await fetchProducts();
        } catch (error) {
            console.error('Error saving:', error);
            toast.error('Помилка збереження');
        } finally {
            setSaving(false);
        }
    };

    const addToPopular = (product: Product) => {
        if (popularProducts.length >= MAX_POPULAR_PRODUCTS) {
            toast.error(`Максимум ${MAX_POPULAR_PRODUCTS} популярних товарів`);
            return;
        }
        setAvailableProducts(prev => prev.filter(p => p.id !== product.id));
        setPopularProducts(prev => [...prev, { ...product, is_popular: true }]);
        setHasChanges(true);
    };

    const removeFromPopular = (product: Product) => {
        setPopularProducts(prev => prev.filter(p => p.id !== product.id));
        setAvailableProducts(prev => [...prev, { ...product, is_popular: false, popular_order: null }].sort((a, b) => a.name.localeCompare(b.name)));
        setHasChanges(true);
    };

    const filteredAvailable = availableProducts.filter(p => {
        if (!showInactive && !p.is_active) return false;
        if (selectedCategory !== 'all' && p.category_id !== selectedCategory) return false;
        if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const activeProduct = activeId
        ? [...availableProducts, ...popularProducts].find(p => p.id === activeId)
        : null;

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
                <Activity className="animate-spin" size={48} color="#263A99" />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1800px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                        Популярні товари
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '16px' }}>
                        Управління товарами в розділі "Найпопулярніші товари" на головній сторінці
                    </p>
                </div>

                <button
                    onClick={saveChanges}
                    disabled={!hasChanges || saving}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        backgroundColor: hasChanges ? '#22c55e' : '#e2e8f0',
                        color: hasChanges ? 'white' : '#94a3b8',
                        border: 'none',
                        borderRadius: '3px',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: hasChanges ? 'pointer' : 'not-allowed'
                    }}
                >
                    {saving ? (
                        <>
                            <Activity className="animate-spin" size={18} />
                            Збереження...
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            {hasChanges ? 'Зберегти зміни' : 'Збережено'}
                        </>
                    )}
                </button>
            </div>

            {/* Info Banner */}
            <div style={{
                padding: '16px 20px',
                backgroundColor: '#eef0fb',
                border: '1px solid #263A99',
                borderRadius: '3px',
                marginBottom: '32px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
            }}>
                <Star size={20} color="#263A99" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                    <p style={{ fontSize: '14px', color: '#1e293b', marginBottom: '4px', fontWeight: 600 }}>
                        Натисніть + щоб додати товар, або перетягніть для зміни порядку
                    </p>
                    <p style={{ fontSize: '13px', color: '#475569' }}>
                        Максимум {MAX_POPULAR_PRODUCTS} популярних товарів. Вони відображаються в карусельній секції на головній сторінці.
                    </p>
                </div>
            </div>

            {/* Limit Warning */}
            {popularProducts.length >= MAX_POPULAR_PRODUCTS && (
                <div style={{
                    padding: '16px 20px',
                    backgroundColor: '#fef3c7',
                    border: '2px solid #f59e0b',
                    borderRadius: '3px',
                    marginBottom: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <AlertTriangle size={20} color="#f59e0b" />
                    <p style={{ fontSize: '14px', color: '#92400e', fontWeight: 600 }}>
                        Досягнуто ліміт: {popularProducts.length} / {MAX_POPULAR_PRODUCTS} товарів
                    </p>
                </div>
            )}

            {/* Drag and Drop Area */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {/* Available Products Column */}
                    <DroppableColumn
                        id="available-droppable"
                        title="Доступні товари"
                        subtitle={`${filteredAvailable.length} з ${availableProducts.length}`}
                        icon={<Package size={20} color="#64748b" />}
                        backgroundColor="#f8fafc"
                    >
                        {/* Filter bar */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    type="text"
                                    placeholder="Пошук за назвою..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 32px 8px 32px',
                                        borderRadius: '6px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '14px',
                                        outline: 'none'
                                    }}
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', flex: 1, minWidth: '150px', cursor: 'pointer' }}
                                >
                                    <option value="all">Всі категорії</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer', padding: '0 8px' }}>
                                    <input
                                        type="checkbox"
                                        checked={showInactive}
                                        onChange={(e) => setShowInactive(e.target.checked)}
                                    />
                                    Показати неактивні
                                </label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '70vh', overflowY: 'auto' }}>
                            {filteredAvailable.map(product => (
                                // @ts-ignore
                                <DraggableProductCard key={product.id} product={product} onAdd={() => addToPopular(product)} canAdd={popularProducts.length < MAX_POPULAR_PRODUCTS} />
                            ))}
                            {filteredAvailable.length === 0 && (
                                <div style={{
                                    padding: '40px',
                                    textAlign: 'center',
                                    color: '#94a3b8',
                                    fontSize: '14px',
                                    fontStyle: 'italic'
                                }}>
                                    {availableProducts.length === 0 ? 'Всі товари додано до популярних' : 'Нічого не знайдено за цим фільтром'}
                                </div>
                            )}
                        </div>
                    </DroppableColumn>

                    {/* Popular Products Column */}
                    <DroppableColumn
                        id="popular-droppable"
                        title="Популярні товари"
                        subtitle={`${popularProducts.length} / ${MAX_POPULAR_PRODUCTS} товарів`}
                        icon={<Star size={20} color="#f59e0b" />}
                        backgroundColor="#fef3c7"
                    >
                        <SortableContext
                            items={popularProducts.map(p => p.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {popularProducts.map((product, index) => (
                                    <SortableProductCard
            // @ts-ignore
                                        key={product.id}
                                        product={product}
                                        index={index}
                                        onRemove={() => removeFromPopular(product)}
                                    />
                                ))}
                                {popularProducts.length === 0 && (
                                    <div style={{
                                        padding: '40px',
                                        textAlign: 'center',
                                        color: '#92400e',
                                        fontSize: '14px',
                                        fontStyle: 'italic'
                                    }}>
                                        Перетягніть товари сюди
                                    </div>
                                )}
                            </div>
                        </SortableContext>
                    </DroppableColumn>
                </div>

                <DragOverlay>
                    {activeProduct ? <ProductCard product={activeProduct} isDragging /> : null}
                </DragOverlay>
            </DndContext>

            {/* Unsaved Changes Warning */}
            {hasChanges && mounted && createPortal(
              <div style={{
                    position: 'fixed',
                    bottom: '32px',
                    right: '32px',
                    padding: '16px 24px',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    borderRadius: '3px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    fontSize: '14px',
                    fontWeight: 600,
                    zIndex: 100
                }}>
                     Є незбережені зміни
                </div>,
              document.body
            )}
        </div>
    );
}

// Droppable Column Component
function DroppableColumn({
    id,
    title,
    subtitle,
    icon,
    backgroundColor,
    children
}: {
    id: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    backgroundColor: string;
    children: React.ReactNode;
}) {
    return (
        <div
            id={id}
            style={{
                padding: '24px',
                backgroundColor: 'white',
                borderRadius: '3px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                minHeight: '600px'
            }}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                paddingBottom: '16px',
                borderBottom: '2px solid #f1f5f9'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {icon}
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                            {title}
                        </h2>
                        <p style={{ fontSize: '13px', color: '#64748b' }}>
                            {subtitle}
                        </p>
                    </div>
                </div>
            </div>
            {children}
        </div>
    );
}

// Sortable Product Card Component
function SortableProductCard({ product, index, onRemove }: { product: Product; index: number; onRemove?: () => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: product.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    return (
        <div ref={setNodeRef} style={style}>
            <ProductCard product={product} index={index} dragHandleProps={{ ...attributes, ...listeners }} onRemove={onRemove} />
        </div>
    );
}

// Draggable Product Card Component
function DraggableProductCard({ product, onAdd, canAdd }: { product: Product; onAdd?: () => void; canAdd?: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: product.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    return (
        <div ref={setNodeRef} style={style}>
            <ProductCard product={product} dragHandleProps={{ ...attributes, ...listeners }} onAdd={onAdd} canAdd={canAdd} />
        </div>
    );
}

// Product Card Component
function ProductCard({
    product,
    index,
    isDragging,
    dragHandleProps,
    onAdd,
    onRemove,
    canAdd = true
}: {
    product: Product;
    index?: number;
    isDragging?: boolean;
    dragHandleProps?: any;
    onAdd?: () => void;
    onRemove?: () => void;
    canAdd?: boolean;
}) {
    const imageUrl = product.images && product.images.length > 0
        ? product.images[0]
        : null;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                backgroundColor: 'white',
                border: isDragging ? '2px solid #263A99' : '1px solid #e2e8f0',
                borderRadius: '3px',
                cursor: isDragging ? 'grabbing' : 'grab',
                boxShadow: isDragging ? '0 8px 32px rgba(38,58,153,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.2s'
            }}
            {...dragHandleProps}
        >
            {/* Order Number (for popular products) */}
            {typeof index === 'number' && (
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '3px',
                    backgroundColor: '#263A99',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 700,
                    flexShrink: 0
                }}>
                    {index + 1}
                </div>
            )}

            {/* Drag Handle */}
            <div style={{ color: '#94a3b8', flexShrink: 0 }}>
                <GripVertical size={20} />
            </div>

            {/* Product Image */}
            <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '3px',
                backgroundColor: '#f1f5f9',
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={product.name}
                        width={60}
                        height={60}
                        style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                    />
                ) : (
                    <ImageIcon size={24} color="#cbd5e1" />
                )}
            </div>

            {/* Product Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#0f172a',
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {product.name}
                    {!product.is_active && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8', fontWeight: 500, padding: '2px 6px', backgroundColor: '#f1f5f9', borderRadius: 3 }}>
                            неактивний
                        </span>
                    )}
                </h3>
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#263A99' }}>
                    ₴{product.price.toLocaleString('uk-UA')}
                </p>
            </div>

            {/* Action Button */}
            {onAdd && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onAdd(); }}
                    disabled={!canAdd}
                    title={canAdd ? 'Додати до популярних' : 'Досягнуто ліміт'}
                    style={{
                        flexShrink: 0,
                        width: 36, height: 36, borderRadius: 6,
                        backgroundColor: canAdd ? '#263A99' : '#e2e8f0',
                        color: canAdd ? 'white' : '#94a3b8',
                        border: 'none',
                        cursor: canAdd ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <Plus size={18} />
                </button>
            )}
            {onRemove && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    title="Прибрати з популярних"
                    style={{
                        flexShrink: 0,
                        width: 36, height: 36, borderRadius: 6,
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <Minus size={18} />
                </button>
            )}
        </div>
    );
}
