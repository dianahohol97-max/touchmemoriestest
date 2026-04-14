/**
 * /api/upload — general-purpose image upload to Supabase Storage.
 * Previously used local filesystem (BROKEN on Vercel). Now uses Supabase Storage bucket 'uploads'.
 * Bucket must exist and be set to public in Supabase dashboard.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'uploads';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('file') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const uploadedUrls: string[] = [];

    for (const file of files) {
      // Validation
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        return NextResponse.json({ error: 'Only JPG, PNG and WEBP images are allowed' }, { status: 400 });
      }
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 });
      }

      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `general/${uniqueSuffix}-${safeName}`;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

      if (error) {
        console.error('[Upload] Supabase storage error:', error.message);
        return NextResponse.json({ error: `Storage upload failed: ${error.message}` }, { status: 500 });
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      uploadedUrls.push(urlData.publicUrl);
    }

    return NextResponse.json({ success: true, urls: uploadedUrls });
  } catch (error) {
    console.error('[Upload] Unexpected error:', error);
    return NextResponse.json({ error: 'Upload process failed' }, { status: 500 });
  }
}
