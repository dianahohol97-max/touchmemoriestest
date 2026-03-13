import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const supabase = getAdminClient();
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const bucket = formData.get('bucket') as string || 'products';

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fileName, buffer, {
                contentType: file.type,
                upsert: false
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName);

        return NextResponse.json({ url: publicUrl });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
