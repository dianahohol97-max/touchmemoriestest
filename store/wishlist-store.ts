import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClient } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';

const getSupabase = () => createClient();

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
                const supabase = getSupabase();
                const { data: userData } = await supabase.auth.getUser();
                const user = userData.user;
                const items = get().items;
                const exists = items.find(i => i.product_id === productId);

                // Resolve the customer row for a logged-in user. Many customer
                // rows have a null auth_user_id (created at checkout, before
                // auth linkage), so the auth_user_id lookup alone silently
                // fails and the wishlist gets saved under session_id instead
                // of customer_id — which the account page never reads. Fall
                // back to email and backfill auth_user_id so it self-heals.
                const resolveCustomerId = async (): Promise<string | null> => {
                    if (!user) return null;
                    const byAuth = await supabase
                        .from('customers').select('id').eq('auth_user_id', user.id).maybeSingle();
                    if (byAuth.data?.id) return byAuth.data.id;
                    if (!user.email) return null;
                    const byEmail = await supabase
                        .from('customers').select('id').eq('email', user.email).maybeSingle();
                    if (byEmail.data?.id) {
                        // Backfill the linkage so future lookups are direct.
                        await supabase.from('customers')
                            .update({ auth_user_id: user.id }).eq('id', byEmail.data.id);
                        return byEmail.data.id;
                    }
                    return null;
                };

                if (exists) {
                    // Remove
                    const newItems = items.filter(i => i.product_id !== productId);
                    set({ items: newItems });

                    const customerId = await resolveCustomerId();
                    if (customerId) {
                        await supabase.from('wishlists').delete()
                            .eq('product_id', productId).eq('customer_id', customerId);
                    } else {
                        await supabase.from('wishlists').delete()
                            .eq('product_id', productId).eq('session_id', get().sessionId);
                    }
                } else {
                    // Add
                    const newItem: WishlistItem = {
                        id: uuidv4(),
                        product_id: productId,
                        added_at: new Date().toISOString()
                    };
                    set({ items: [...items, newItem] });

                    const customerId = await resolveCustomerId();
                    if (customerId) {
                        await supabase.from('wishlists').insert({
                            product_id: productId,
                            customer_id: customerId
                        });
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
                const supabase = getSupabase();
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
