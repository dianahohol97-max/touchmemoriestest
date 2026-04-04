'use client';
import { useT } from '@/lib/i18n/context';
import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';

interface Props {
    productId: string;
    productSlug: string;
    productName: string;
    productImage?: string;
    productPrice: number;
    size?: 'sm' | 'md';
}

function getSessionId() {
    if (typeof window === 'undefined') return '';
    let id = localStorage.getItem('tm_session');
    if (!id) { id = Math.random().toString(36).slice(2); localStorage.setItem('tm_session', id); }
    return id;
}

export default function WishlistButton({ productId, productSlug, productName, productImage, productPrice, size = 'md' }: Props) {
      const t = useT();
  const [inWishlist, setInWishlist] = useState(false);
    const [loading, setLoading] = useState(false);
    const [bounce, setBounce] = useState(false);

    useEffect(() => {
        const sessionId = getSessionId();
        fetch(`/api/wishlist?session_id=${sessionId}`)
            .then(r => r.json())
            .then(data => setInWishlist((data || []).some((w: any) => w.product_id === productId)));
    }, [productId]);

    const toggle = async () => {
        if (loading) return;
        setLoading(true);
        const sessionId = getSessionId();
        const res = await fetch('/api/wishlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId, product_slug: productSlug, product_name: productName, product_image: productImage, product_price: productPrice, session_id: sessionId })
        });
        const data = await res.json();
        setInWishlist(data.action === 'added');
        if (data.action === 'added') { setBounce(true); setTimeout(() => setBounce(false), 400); }
        setLoading(false);
    };

    const isSmall = size === 'sm';
    return (
        <button
            onClick={toggle}
            title={inWishlist ? 'Видалити з бажаного' : 'Додати до бажаного'}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: isSmall ? '0' : '7px',
                padding: isSmall ? '8px' : '12px 20px',
                backgroundColor: inWishlist ? '#fef2f2' : 'white',
                color: inWishlist ? '#ef4444' : '#94a3b8',
                border: `1.5px solid ${inWishlist ? '#fca5a5' : '#e2e8f0'}`,
                borderRadius: '10px',
                fontWeight: 700, fontSize: isSmall ? '14px' : '14px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                transform: bounce ? 'scale(1.15)' : 'scale(1)',
                width: isSmall ? 'auto' : '100%',
            }}
        >
            <Heart
                size={isSmall ? 18 : 16}
                fill={inWishlist ? '#ef4444' : 'none'}
                color={inWishlist ? '#ef4444' : '#94a3b8'}
            />
            {!isSmall && (inWishlist ? t('ui.wishlist_in') : t('ui.wishlist_add'))}
        </button>
    );
}
