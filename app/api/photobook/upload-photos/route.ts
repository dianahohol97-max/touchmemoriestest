import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const BUCKET = 'photobook-uploads';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const orderId = formData.get('orderId') as string;
    const photoId = formData.get('photoId') as string;
    const photoName = formData.get('photoName') as string;
    const productType = (formData.get('productType') as string) || 'photobook';
    const fileCategory = (formData.get('fileCategory') as string) || 'photo-upload';

    if (!file || !orderId || !photoId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Ensure bucket exists (private — only accessible via service role)
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    if (!buckets?.find(b => b.name === BUCKET)) {
      await supabaseAdmin.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 52428800, // 50MB per file
      });
    }

    // Path: photobook-uploads/{userId}/{orderId}/{photoId}_{originalName}
    const ext = (photoName || file.name).split('.').pop()?.toLowerCase() || 'jpg';
    const safeName = (photoName || file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${user.id}/${orderId}/${photoId}_${safeName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, file, {
        cacheControl: '31536000', // 1 year — originals don't change
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });

    if (uploadError) throw uploadError;

    // Create record in order_files so the admin /admin/orders/[id]/files
    // page can show this upload with the correct product_type badge and
    // category tag. The orderId may be either a real order UUID (post-
    // checkout) or a temporary placeholder used by BookPhotoUpload before
    // the order exists; the row is best-effort and a failure here must
    // not block the storage upload, since the file is already saved.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    if (isUuid) {
      const { error: recordError } = await supabaseAdmin
        .from('order_files')
        .insert({
          order_id: orderId,
          file_path: filePath,
          file_name: photoName || file.name,
          file_type: 'upload',
          file_category: fileCategory,
          product_type: productType,
          bucket_name: BUCKET,
          file_size: file.size,
          mime_type: file.type || 'image/jpeg',
        });
      if (recordError) {
        // Storage upload succeeded; just log so the client gets its URL.
        console.error('[photobook upload] order_files insert failed:', recordError);
      }
    }

    // Signed URL valid for 7 days (for manager to download)
    const { data: signedData } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    return NextResponse.json({
      success: true,
      path: filePath,
      signedUrl: signedData?.signedUrl || null,
    });
  } catch (error: any) {
    console.error('[photobook upload]', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}

// Get signed URLs for all photos of an order (for admin/manager)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: files } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(`${user.id}/${orderId}`, { limit: 500 });

    if (!files?.length) return NextResponse.json({ files: [] });

    const paths = files.map(f => `${user.id}/${orderId}/${f.name}`);
    const { data: urls } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrls(paths, 60 * 60 * 24 * 7);

    return NextResponse.json({ files: urls || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
