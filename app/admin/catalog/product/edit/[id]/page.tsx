import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import AdminProductForm from '@/components/admin/AdminProductForm';
import { notFound } from 'next/navigation';
import React from 'react';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
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
                    } catch (error) {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );

    const resolvedParams = await params;
    const { id } = resolvedParams;

    const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

    if (!product) {
        notFound();
    }

    return (
        <div style={{ padding: '0 0 80px' }}>
            <AdminProductForm initialData={product} isEditing={true} />
        </div>
    );
}
