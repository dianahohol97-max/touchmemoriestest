import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('file') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const uploadedUrls: string[] = [];
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    
    // Ensure directory exists
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {
      // Directory might already exist, ignore error if it's not fatal
    }

    for (const file of files) {
      // Validation matching front-end
      if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
        return NextResponse.json({ error: 'Only JPG and PNG images are allowed' }, { status: 400 });
      }
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      // Clean up filename to prevent path traversal or weird bugs
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${uniqueSuffix}-${safeName}`;
      const filepath = join(uploadDir, filename);

      await writeFile(filepath, buffer);
      
      // Return public URL path
      uploadedUrls.push(`/uploads/${filename}`);
    }

    return NextResponse.json({ success: true, urls: uploadedUrls });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload process failed' }, { status: 500 });
  }
}
