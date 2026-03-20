/**
 * Cart Store using Zustand
 * Manages shopping cart state with localStorage persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Cart Item Interface
 */
export interface CartItem {
  id: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  options?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Cart State Interface
 */
interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
}

/**
 * Cart Actions Interface
 */
interface CartActions {
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

/**
 * Complete Cart Store Interface
 */
interface CartStore extends CartState, CartActions {
  drawerOpen: boolean;
}

/**
 * Calculate totals from items
 */
const calculateTotals = (items: CartItem[]): Pick<CartState, 'totalItems' | 'totalPrice'> => {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { totalItems, totalPrice };
};

/**
 * Zustand Cart Store with Persist Middleware
 */
export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // Initial State
      items: [],
      totalItems: 0,
      totalPrice: 0,
      drawerOpen: false,

      // Actions
      addItem: (item: CartItem) => {
        const { items } = get();

        // Check if item already exists in cart
        const existingItemIndex = items.findIndex((i) => i.id === item.id);

        let newItems: CartItem[];

        if (existingItemIndex > -1) {
          // Item exists - update quantity
          newItems = items.map((i, index) =>
            index === existingItemIndex
              ? { ...i, quantity: i.quantity + (item.quantity || 1) }
              : i
          );
        } else {
          // Item doesn't exist - add new item
          newItems = [...items, { ...item, quantity: item.quantity || 1 }];
        }

        const totals = calculateTotals(newItems);

        set({
          items: newItems,
          ...totals,
        });
      },

      removeItem: (id: string) => {
        const { items } = get();
        const newItems = items.filter((item) => item.id !== id);
        const totals = calculateTotals(newItems);

        set({
          items: newItems,
          ...totals,
        });
      },

      updateQuantity: (id: string, quantity: number) => {
        const { items } = get();

        if (quantity <= 0) {
          // Remove item if quantity is 0 or negative
          get().removeItem(id);
          return;
        }

        const newItems = items.map((item) =>
          item.id === id ? { ...item, quantity } : item
        );

        const totals = calculateTotals(newItems);

        set({
          items: newItems,
          ...totals,
        });
      },

      clearCart: () => {
        set({
          items: [],
          totalItems: 0,
          totalPrice: 0,
        });
      },

      openDrawer: () => {
        set({ drawerOpen: true });
      },

      closeDrawer: () => {
        set({ drawerOpen: false });
      },
    }),
    {
      name: 'tm-cart', // localStorage key
      storage: createJSONStorage(() => localStorage),
      // Only persist cart items and totals, not drawer state
      partialize: (state) => ({
        items: state.items,
        totalItems: state.totalItems,
        totalPrice: state.totalPrice,
      }),
    }
  )
);

/**
 * Selector hooks for optimized re-renders
 */
export const useCartItems = () => useCartStore((state) => state.items);
export const useCartTotalItems = () => useCartStore((state) => state.totalItems);
export const useCartTotalPrice = () => useCartStore((state) => state.totalPrice);
export const useCartDrawer = () => useCartStore((state) => state.drawerOpen);

/**
 * Export types for external use
 */
export type { CartStore, CartState, CartActions };
