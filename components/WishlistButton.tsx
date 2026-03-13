'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useWishlistStore } from '@/store/wishlist-store';

interface WishlistButtonProps {
    productId: string;
    variant?: 'minimal' | 'full';
    className?: string;
}

export default function WishlistButton({ productId, variant = 'minimal', className = '' }: WishlistButtonProps) {
    const { toggleItem, isInWishlist, initialize } = useWishlistStore();
    const [isClient, setIsClient] = useState(false);
    const [isBeating, setIsBeating] = useState(false);

    useEffect(() => {
        setIsClient(true);
        initialize();
    }, []);

    if (!isClient) return null;

    const active = isInWishlist(productId);

    const handleToggle = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!active) {
            setIsBeating(true);
            setTimeout(() => setIsBeating(false), 600);
        }

        await toggleItem(productId);
    };

    if (variant === 'full') {
        return (
            <button
                onClick={handleToggle}
                className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all duration-300 ${active
                        ? 'bg-red-50 text-red-500 border-2 border-red-100'
                        : 'bg-slate-50 text-slate-600 border-2 border-slate-100 hover:border-slate-200'
                    } ${className}`}
            >
                <motion.div
                    animate={isBeating ? { scale: [1, 1.4, 1] } : {}}
                    transition={{ duration: 0.4 }}
                >
                    <Heart size={20} fill={active ? "currentColor" : "none"} />
                </motion.div>
                {active ? 'У вибраному' : 'В обране'}
            </button>
        );
    }

    return (
        <button
            onClick={handleToggle}
            className={`flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-all duration-300 ${active
                    ? 'bg-white text-red-500'
                    : 'bg-white/80 backdrop-blur-md text-slate-400 hover:text-red-400'
                } ${className}`}
            style={{ border: 'none', cursor: 'pointer' }}
        >
            <motion.div
                animate={isBeating ? { scale: [1, 1.5, 1] } : {}}
                transition={{ duration: 0.4 }}
            >
                <Heart size={20} fill={active ? "currentColor" : "none"} />
            </motion.div>
        </button>
    );
}
