'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import BlogPostEditor from '@/components/admin/BlogPostEditor';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function EditBlogPostPage() {
    const params = useParams();
    const id = params.id as string;
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        if (!id) return;
        supabase.from('blog_posts').select('*').eq('id', id).single().then(({ data, error }) => {
            if (data) {
                setData(data);
            }
            setLoading(false);
        });
    }, [id, supabase]);

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="animate-spin" size={32} /></div>;
    if (!data) return <div style={{ textAlign: 'center', padding: '100px' }}>Статтю не знайдено</div>;

    return <BlogPostEditor initialData={data} isEditMode={true} />;
}
