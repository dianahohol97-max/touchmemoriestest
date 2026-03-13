import { createClient } from '@/lib/supabase/server';
import AdminFaqForm from '@/components/admin/AdminFaqForm';
import { notFound } from 'next/navigation';

export default async function EditFaqPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: faq } = await supabase
        .from('faqs')
        .select('*')
        .eq('id', id)
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
