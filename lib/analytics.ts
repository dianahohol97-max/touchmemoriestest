import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function logCartEvent(eventType: 'add_to_cart' | 'begin_checkout' | 'purchase', productId?: string) {
    try {
        // Get or create session ID from localStorage
        let sessionId = localStorage.getItem('tm_session_id');
        if (!sessionId) {
            sessionId = Math.random().toString(36).substring(2, 15);
            localStorage.setItem('tm_session_id', sessionId);
        }

        await supabase.from('cart_events').insert({
            event_type: eventType,
            product_id: productId,
            session_id: sessionId
        });
    } catch (e) {
        console.error('Failed to log cart event', e);
    }
}
