'use client';
import { useState, useMemo } from 'react';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ShoppingCart, Edit3, Plus, Minus, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import GiftHintModal from '@/components/GiftHintModal';
import WishlistButton from '@/components/WishlistButton';
import { Heart } from 'lucide-react';
import { logCartEvent } from '@/lib/analytics';
import ProductAttributeSelector from './ProductAttributeSelector';
import { CustomAttribute, AttributePriceModifiers, SelectedAttributes } from '@/lib/types/product';


interface ProductOptionsProps {
    product: {
        id: string;
        name: string;
        price: number | string;
        price_per_page?: number;
        min_pages?: number;
        max_pages?: number;
        format_options?: any[];
        cover_options?: any[];
        images: string[];
        slug: string;
        categories?: { slug: string; name: string } | any;
        custom_attributes?: CustomAttribute[];
        attribute_price_modifiers?: AttributePriceModifiers;
    };
}

export function ProductOptions({ product }: ProductOptionsProps) {
    const router = useRouter();
    const addItem = useCartStore((state) => state.addItem);

    const formats = product.format_options || [];
    const covers = product.cover_options || [];
    const isPhotoBook = product.categories?.slug === 'photobooks' || product.name.toLowerCase().includes('фотокнига');

    const [selectedFormat, setSelectedFormat] = useState(formats[0] || null);
    const [selectedCover, setSelectedCover] = useState(covers[0] || null);
    const [pageCount, setPageCount] = useState(product.min_pages || 24);
    const [quantity, setQuantity] = useState(1);
    const [isHintModalOpen, setIsHintModalOpen] = useState(false);
    const [selectedAttributes, setSelectedAttributes] = useState<SelectedAttributes>({});
    const [attributePriceModifier, setAttributePriceModifier] = useState(0);

    const totalPrice = useMemo(() => {
        let base = Number(product.price);

        // Add format extra cost if any
        if (selectedFormat?.price_extra) {
            base += Number(selectedFormat.price_extra);
        }

        // Add cover extra cost if any
        if (selectedCover?.price_extra) {
            base += Number(selectedCover.price_extra);
        }

        // Add extra pages cost
        if (isPhotoBook && product.price_per_page && pageCount > (product.min_pages || 0)) {
            const extraPages = pageCount - (product.min_pages || 0);
            base += extraPages * Number(product.price_per_page);
        }

        // Add custom attributes price modifier
        base += attributePriceModifier;

        return base * quantity;
    }, [product, selectedFormat, selectedCover, pageCount, quantity, isPhotoBook, attributePriceModifier]);

    const handleAddToCart = () => {
        // Generate unique ID including selected attributes
        const attrId = Object.entries(selectedAttributes)
            .map(([k, v]) => `${k}:${v}`)
            .join('-');
        const uniqueId = `${product.id}-${selectedFormat?.name || 'def'}-${selectedCover?.name || 'def'}-${pageCount}-${attrId}`;

        addItem({
            id: uniqueId,
            product_id: product.id,
            name: product.name,
            price: totalPrice / quantity,
            qty: quantity,
            image: product.images[0],
            options: {
                format: selectedFormat?.name,
                cover: selectedCover?.name,
                pages: isPhotoBook ? pageCount : undefined
            },
            selected_attributes: Object.keys(selectedAttributes).length > 0 ? selectedAttributes : undefined,
            category_slug: product.categories?.slug,
            slug: product.slug
        });
        toast.success('Товар додано в кошик!');
        logCartEvent('add_to_cart', product.id);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* Format Selection */}
            {formats.length > 0 && (
                <div>
                    <h4 style={labelStyle}>Формат</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        {formats.map((f, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedFormat(f)}
                                style={{
                                    ...optionBtnStyle,
                                    borderColor: selectedFormat?.name === f.name ? 'var(--primary)' : '#e2e8f0',
                                    backgroundColor: selectedFormat?.name === f.name ? '#f8fafc' : 'white',
                                    color: selectedFormat?.name === f.name ? 'var(--primary)' : '#444',
                                }}
                            >
                                {f.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Cover Selection */}
            {covers.length > 0 && (
                <div>
                    <h4 style={labelStyle}>Обкладинка</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        {covers.map((c, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedCover(c)}
                                style={{
                                    ...optionBtnStyle,
                                    borderColor: selectedCover?.name === c.name ? 'var(--primary)' : '#e2e8f0',
                                    backgroundColor: selectedCover?.name === c.name ? '#f8fafc' : 'white',
                                    color: selectedCover?.name === c.name ? 'var(--primary)' : '#444',
                                }}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Page Count (Photo Books only) */}
            {isPhotoBook && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ ...labelStyle, margin: 0 }}>Кількість сторінок</h4>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>{pageCount} стор.</span>
                    </div>
                    <input
                        type="range"
                        min={product.min_pages || 24}
                        max={product.max_pages || 100}
                        step={2}
                        value={pageCount}
                        onChange={(e) => setPageCount(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: '#888' }}>
                        <span>мін: {product.min_pages}</span>
                        <span>макс: {product.max_pages}</span>
                    </div>
                </div>
            )}

            {/* Custom Attributes */}
            {product.custom_attributes && product.custom_attributes.length > 0 && (
                <ProductAttributeSelector
                    attributes={product.custom_attributes}
                    priceModifiers={product.attribute_price_modifiers || {}}
                    onSelectionChange={(selected, modifier) => {
                        setSelectedAttributes(selected);
                        setAttributePriceModifier(modifier);
                    }}
                />
            )}

            {/* Quantity & Summary */}
            <div style={{ marginTop: '16px', padding: '32px', backgroundColor: '#f8fafc', borderRadius: "3px", border: '1px solid #eef2f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'white', padding: '8px', borderRadius: "3px", border: '1px solid #e2e8f0' }}>
                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={qtyBtnStyle}><Minus size={18} /></button>
                        <span style={{ fontWeight: 800, minWidth: '24px', textAlign: 'center' }}>{quantity}</span>
                        <button onClick={() => setQuantity(quantity + 1)} style={qtyBtnStyle}><Plus size={18} /></button>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Підсумок</div>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--primary)' }}>{totalPrice} ₴</div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        onClick={handleAddToCart}
                        style={{ ...actionBtnStyle, backgroundColor: 'var(--primary)', color: 'white' }}
                        className="hover-lift"
                    >
                        <ShoppingCart size={20} /> Додати у кошик
                    </button>

                    {isPhotoBook && (
                        <button
                            onClick={() => router.push(`/book-constructor?product=${product.id}`)}
                            style={{ ...actionBtnStyle, backgroundColor: 'white', color: 'var(--primary)', border: '2px solid var(--primary)', padding: '14px 28px' }}
                            className="hover-glow"
                        >
                            <Edit3 size={20} /> Створити в конструкторі
                        </button>
                    )}

                    <button
                        onClick={() => setIsHintModalOpen(true)}
                        style={{ ...actionBtnStyle, backgroundColor: 'transparent', color: '#64748b', border: '2px solid #e2e8f0' }}
                        className="hover-lift"
                    >
                        💝 Натякнути близьким
                    </button>

                    <WishlistButton productId={product.id} variant="full" className="w-full" />
                </div>
            </div>

            <GiftHintModal
                isOpen={isHintModalOpen}
                onClose={() => setIsHintModalOpen(false)}
                product={{
                    id: product.id,
                    name: product.name,
                    price: Number(totalPrice / quantity),
                    image: product.images[0]
                }}
            />

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '16px', backgroundColor: '#f0f9ff', borderRadius: "3px", color: '#263A99', fontSize: '14px' }}>
                <Info size={18} />
                <span>Термін виготовлення: 3-5 робочих днів</span>
            </div>

        </div>
    );
}

const labelStyle = { fontSize: '14px', fontWeight: 800, textTransform: 'uppercase' as any, letterSpacing: '0.05em', color: '#888', marginBottom: '16px' };
const optionBtnStyle = {
    padding: '12px 24px',
    borderRadius: "3px",
    border: '2px solid',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
};
const qtyBtnStyle = {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#64748b'
};
const actionBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '16px 32px',
    borderRadius: "3px",
    border: 'none',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s'
};
