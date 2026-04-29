import { NextRequest, NextResponse } from 'next/server';
import { updatePhotosMetadata } from '@/lib/designer-service/brief-helpers';
import { supabaseAdmin, getAdminClient } from '@/lib/supabase/admin';
import type { PhotoMetadata } from '@/lib/types/designer-service';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_EXT_RE = /^[a-zA-Z0-9]{1,8}$/;

// design-briefs bucket is private; signed URLs expire in this window.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days — long enough for designer review pass

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const token = formData.get('token') as string;
    const orderId = formData.get('orderId') as string;

    if (!file || !token || !orderId) {
      return NextResponse.json(
        { error: 'File, token, and orderId are required' },
        { status: 400 }
      );
    }

    // Validate inputs to prevent path traversal & PostgREST filter abuse.
    if (!TOKEN_RE.test(token) || !UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'Invalid token or orderId' }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
    }
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 });
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      return NextResponse.json({ error: 'Only image files allowed' }, { status: 400 });
    }

    const admin = getAdminClient();

    // Cross-validate: the supplied token must actually belong to the
    // supplied orderId. Without this check, a customer with a brief token
    // for order A could upload photos that get attached to order B by
    // passing orderId=B (the actual file goes into design-briefs/B/...).
    const { data: brief } = await admin
      .from('design_briefs')
      .select('order_id, photos_metadata')
      .eq('token', token)
      .maybeSingle();
    if (!brief || brief.order_id !== orderId) {
      return NextResponse.json({ error: 'Token does not match orderId' }, { status: 403 });
    }

    // Generate unique filename — file extension is sanity-checked, the rest
    // is a UUID so users can't influence the storage path.
    const rawExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fileExt = SAFE_EXT_RE.test(rawExt) ? rawExt : 'jpg';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `design-briefs/${orderId}/${fileName}`;

    // Upload to Supabase Storage (private bucket)
    const { error: uploadError } = await supabaseAdmin.storage
      .from('design-briefs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Generate a signed URL — bucket is private, so getPublicUrl would fail.
    const { data: signed, error: signedErr } = await supabaseAdmin.storage
      .from('design-briefs')
      .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

    if (signedErr || !signed?.signedUrl) {
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 });
    }

    // Create photo metadata
    const photoMetadata: PhotoMetadata = {
      id: crypto.randomUUID(),
      filename: file.name,
      url: signed.signedUrl,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };

    const currentPhotos = (brief?.photos_metadata as PhotoMetadata[]) || [];
    const updatedPhotos = [...currentPhotos, photoMetadata];

    // Update brief with new photo
    await updatePhotosMetadata(token, updatedPhotos);

    return NextResponse.json({
      success: true,
      photo: photoMetadata,
      totalPhotos: updatedPhotos.length,
    });
  } catch (error: any) {
    console.error('Error uploading photo:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload photo' },
      { status: 500 }
    );
  }
}

// Delete photo
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const photoId = searchParams.get('photoId');

    if (!token || !photoId) {
      return NextResponse.json(
        { error: 'Token and photoId are required' },
        { status: 400 }
      );
    }

    if (!TOKEN_RE.test(token)) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const admin = getAdminClient();

    // Get current photos via service-role admin client.
    // (design_briefs RLS no longer permits anon access by token.)
    const { data: brief } = await admin
      .from('design_briefs')
      .select('order_id, photos_metadata, photos_folder')
      .eq('token', token)
      .single();

    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }

    const currentPhotos = (brief.photos_metadata as PhotoMetadata[]) || [];
    const photoToDelete = currentPhotos.find((p) => p.id === photoId);

    if (!photoToDelete) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      );
    }

    // The stored `url` may now be a signed URL (long path with ?token= query
    // string). Reconstruct the storage path from order_id and the trailing
    // filename portion of the URL path, ignoring the query string.
    let filePath: string | null = null;
    try {
      const u = new URL(photoToDelete.url);
      const parts = u.pathname.split('/');
      const fileName = parts[parts.length - 1];
      // Only proceed if filename looks like our UUID.ext pattern — anything
      // else and we don't risk deleting an unintended path.
      if (fileName && /^[0-9a-f-]{36}\.[a-zA-Z0-9]{1,8}$/i.test(fileName)) {
        filePath = `design-briefs/${brief.order_id}/${fileName}`;
      }
    } catch { /* ignore — fall through and skip storage delete */ }

    if (filePath) {
      const { error: storageError } = await supabaseAdmin.storage.from('design-briefs').remove([filePath]);
      if (storageError) {
        console.error('Storage delete error (non-fatal):', storageError.message);
        // Continue — still remove from metadata even if file deletion fails
      }
    }

    // Update metadata
    const updatedPhotos = currentPhotos.filter((p) => p.id !== photoId);
    await updatePhotosMetadata(token, updatedPhotos);

    return NextResponse.json({
      success: true,
      totalPhotos: updatedPhotos.length,
    });
  } catch (error: any) {
    console.error('Error deleting photo:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete photo' },
      { status: 500 }
    );
  }
}
