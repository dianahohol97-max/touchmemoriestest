import { createClient } from '@/lib/supabase/server';

// Approved customer text reviews (no photo) — complements the image gallery
// (SocialProof) on the homepage. RLS already restricts to approved + active.
export async function TextReviews() {
    let reviews: any[] = [];
    try {
        const supabase = await createClient();
        const { data } = await supabase
            .from('reviews')
            .select('id, author, caption, rating, created_at')
            .eq('is_active', true)
            .is('image_url', null)
            .not('caption', 'is', null)
            .order('created_at', { ascending: false })
            .limit(9);
        reviews = (data || []).filter((r) => r.caption && r.caption.trim().length > 0);
    } catch {
        reviews = [];
    }

    if (reviews.length === 0) return null;

    return (
        <section style={{ padding: '60px 20px', maxWidth: 1200, margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 900, textAlign: 'center', marginBottom: 40 }}>
                Відгуки клієнтів
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                {reviews.map((r) => (
                    <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px 22px', background: '#fff' }}>
                        {r.rating ? (
                            <div style={{ color: '#f0a500', fontSize: 16, letterSpacing: 2, marginBottom: 10 }}>
                                {'★'.repeat(Math.round(r.rating))}{'☆'.repeat(Math.max(0, 5 - Math.round(r.rating)))}
                            </div>
                        ) : null}
                        <p style={{ fontSize: 15, color: '#334155', lineHeight: 1.6, margin: '0 0 12px' }}>{r.caption}</p>
                        {r.author && <div style={{ fontSize: 14, fontWeight: 700, color: '#1e2d7d' }}>{r.author}</div>}
                    </div>
                ))}
            </div>
        </section>
    );
}
