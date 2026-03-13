import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { v4 as uuidv4 } from 'uuid';

interface WishlistItem {
    id: string; // Internal UUID
    product_id: string;
    added_at: string;
}

interface WishlistState {
    items: WishlistItem[];
    sessionId: string;
    toggleItem: (productId: string) => Promise<void>;
    isInWishlist: (productId: string) => boolean;
    syncWithSupabase: (customerId?: string) => Promise<void>;
    initialize: () => void;
}

export const useWishlistStore = create<WishlistState>()(
    persist(
        (set, get) => ({
            items: [],
            sessionId: '',

            initialize: () => {
                if (!get().sessionId) {
                    set({ sessionId: uuidv4() });
                }
            },

            toggleItem: async (productId) => {
                const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
                const { data: userData } = await supabase.auth.getUser();
                const user = userData.user;
                const items = get().items;
                const exists = items.find(i => i.product_id === productId);

                if (exists) {
                    // Remove
                    const newItems = items.filter(i => i.product_id !== productId);
                    set({ items: newItems });

                    if (user) {
                        // Delete from Supabase
                        await supabase
                            .from('wishlists')
                            .delete()
                            .eq('product_id', productId)
                            .or(`customer_id.in.(SELECT id FROM customers WHERE auth_user_id = '${user.id}'),session_id.eq.${get().sessionId}`);
                    }
                } else {
                    // Add
                    const newItem: WishlistItem = {
                        id: uuidv4(),
                        product_id: productId,
                        added_at: new Date().toISOString()
                    };
                    set({ items: [...items, newItem] });

                    if (user) {
                        // Save to Supabase
                        const { data: customer } = await supabase
                            .from('customers')
                            .select('id')
                            .eq('auth_user_id', user.id)
                            .single();

                        if (customer) {
                            await supabase.from('wishlists').insert({
                                product_id: productId,
                                customer_id: customer.id
                            });
                        }
                    } else {
                        // Anonymous save
                        await supabase.from('wishlists').insert({
                            product_id: productId,
                            session_id: get().sessionId
                        });
                    }
                }
            },

            isInWishlist: (productId) => {
                return get().items.some(i => i.product_id === productId);
            },

            syncWithSupabase: async (customerId) => {
                const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
                const sessionId = get().sessionId;

                let query = supabase.from('wishlists').select('id, product_id, added_at');

                if (customerId) {
                    query = query.eq('customer_id', customerId);
                } else if (sessionId) {
                    query = query.eq('session_id', sessionId);
                }

                const { data } = await query;
                if (data) {
                    set({ items: data });
                }
            }
        }),
        {
            name: 'touch-wishlist-storage',
        }
    )
);
