'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

type CartItem = {
    id: string;
    name: string;
    price: number;
    qty: number;
    image?: string;
    options?: any;
};

type CartContextType = {
    cart: CartItem[];
    addItem: (item: CartItem) => void;
    removeItem: (id: string) => void;
    clearCart: () => void;
    total: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [cart, setCart] = useState<CartItem[]>([]);

    useEffect(() => {
        const savedCart = localStorage.getItem('touch_cart');
        if (savedCart) {
            try {
                setCart(JSON.parse(savedCart));
            } catch (e) {
                console.error("Failed to load cart", e);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('touch_cart', JSON.stringify(cart));
    }, [cart]);

    const addItem = (item: CartItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + item.qty } : i);
            }
            return [...prev, item];
        });
    };

    const removeItem = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const clearCart = () => setCart([]);

    const total = cart.reduce((acc, item) => acc + item.price * item.qty, 0);

    return (
        <CartContext.Provider value={{ cart, addItem, removeItem, clearCart, total }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
