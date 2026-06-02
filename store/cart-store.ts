import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
    id: string;
    name: string;
    price: number;
    qty: number;
    image?: string;
    options?: any;
    selected_attributes?: { [key: string]: boolean | string | number }; // Custom attributes
    product_id?: string;
    category_slug?: string;
    slug?: string;
    personalization_note?: string;
    min_qty?: number; // minimum orderable quantity for this item (default 1)
    /** Structured per-item data that must survive to the order (e.g. a gift
     * certificate's recipient name/email/message/face amount). Stored as-is in
     * orders.items and read by the payment webhook to auto-issue the cert. */
    metadata?: Record<string, any>;
    /** Product-level payment mode pulled from products.payment_mode.
     * Affects which payment options are offered at checkout (full only,
     * or full / split 50%). If missing, checkout falls back to 'full_only'. */
    payment_mode?: 'full_only' | 'full_or_split' | 'full_only_if_alone';
}

interface CartState {
    items: CartItem[];
    isDrawerOpen: boolean;
    addItem: (item: CartItem) => void;
    addItems: (items: CartItem[]) => void;
    removeItem: (id: string | number) => void;
    updateQuantity: (id: string | number, qty: number) => void;
    clearCart: () => void;
    getTotal: () => number;
    openDrawer: () => void;
    closeDrawer: () => void;
    toggleDrawer: () => void;
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            isDrawerOpen: false,
            addItem: (item) => set((state) => {
                const existingItem = state.items.find((i) => i.id === item.id);
                if (existingItem) {
                    return {
                        items: state.items.map((i) =>
                            i.id === item.id ? { ...i, qty: i.qty + item.qty } : i
                        ),
                        isDrawerOpen: true
                    };
                }
                return { items: [...state.items, item], isDrawerOpen: true };
            }),
            addItems: (newItems) => set((state) => {
                const currentItems = [...state.items];

                newItems.forEach(newItem => {
                    const existingIndex = currentItems.findIndex(i => i.id === newItem.id);
                    if (existingIndex >= 0) {
                        currentItems[existingIndex] = {
                            ...currentItems[existingIndex],
                            qty: currentItems[existingIndex].qty + newItem.qty
                        };
                    } else {
                        currentItems.push(newItem);
                    }
                });

                return { items: currentItems, isDrawerOpen: true };
            }),
            removeItem: (id) => set((state) => ({
                items: state.items.filter((i) => i.id !== id),
            })),
            updateQuantity: (id, qty) => set((state) => ({
                items: state.items.map((i) =>
                    i.id === id ? { ...i, qty: Math.max(i.min_qty ?? 1, qty) } : i
                ),
            })),
            clearCart: () => set({ items: [] }),
            getTotal: () => {
                return get().items.reduce((total, item) => total + item.price * item.qty, 0);
            },
            openDrawer: () => set({ isDrawerOpen: true }),
            closeDrawer: () => set({ isDrawerOpen: false }),
            toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
        }),
        {
            name: 'touch-cart-storage',
            partialize: (state) => ({ items: state.items }), // Only persist items, not UI state
        }
    )
);
