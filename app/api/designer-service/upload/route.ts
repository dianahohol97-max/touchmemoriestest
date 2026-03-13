import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updatePhotosMetadata } from '@/lib/designer-service/brief-helpers';
import type { PhotoMetadata } from '@/lib/types/designer-service';

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

    const supabase = await createClient();

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `design-briefs/${orderId}/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('design-briefs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('design-briefs')
      .getPublicUrl(filePath);

    // Create photo metadata
    const photoMetadata: PhotoMetadata = {
      id: crypto.randomUUID(),
      filename: file.name,
      url: urlData.publicUrl,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };

    // Get current photos metadata
    const { data: brief } = await supabase
      .from('design_briefs')
      .select('photos_metadata')
      .eq('token', token)
      .single();

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

    const supabase = await createClient();

    // Get current photos
    const { data: brief } = await supabase
      .from('design_briefs')
      .select('photos_metadata, photos_folder')
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

    // Delete from storage
    const filePath = photoToDelete.url.split('/').slice(-3).join('/'); // Extract path from URL
    await supabase.storage.from('design-briefs').remove([filePath]);

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
