import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import AdminFaqForm from '@/components/admin/AdminFaqForm';
import { notFound } from 'next/navigation';

export default async function EditFaqPage({ params }: { params: { id: string } }) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll().map((cookie: any) => ({
                        name: cookie.name,
                        value: cookie.value,
                    }));
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch (error) { }
                },
            },
        }
    );

    const { data: faq } = await supabase
        .from('faqs')
        .select('*')
        .eq('id', params.id)
        .single();

    if (!faq) {
        notFound();
    }

    return (
        <div style={{ padding: '0 0 80px' }}>
            <AdminFaqForm initialData={faq} isEditing={true} />
        </div>
    );
}
