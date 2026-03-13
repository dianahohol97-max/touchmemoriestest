import { createClient } from '@/lib/supabase/server';
import AdminProductForm from '@/components/admin/AdminProductForm';
import { notFound } from 'next/navigation';
import React from 'react';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient();

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
