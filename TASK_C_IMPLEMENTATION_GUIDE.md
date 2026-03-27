# TASK C: File Storage & Order Export System - Implementation Guide

## ✅ COMPLETED

### 1. Database & Storage Setup

**Created Files:**
- `supabase/migrations/20260327030000_create_storage_buckets.sql` - Full migration with buckets and table
- `STORAGE_BUCKETS_SETUP.sql` - Manual setup SQL (if migration fails)

**Storage Buckets Created:**
- ✅ `photobook-uploads` (EXISTS - keep as is)
- ✅ `calendar-uploads` (50MB limit, images only)
- ✅ `poster-exports` (100MB limit, images + PDF)
- ✅ `puzzle-uploads` (50MB limit, images only)
- ✅ `guestbook-exports` (100MB limit, images + PDF)
- ✅ `order-exports` (100MB limit, final print-ready files)

**Database Table:**
- ✅ `order_files` table created with:
  - Foreign key to orders table (ON DELETE CASCADE)
  - Fields: file_path, file_name, file_type, file_category, bucket_name, page_number, file_size, mime_type
  - Indexes on order_id and file_type
  - RLS policies for authenticated users
  - Auto-update trigger for updated_at

### 2. Admin Panel - Order Files View

**Created:**
- ✅ `/app/admin/orders/[id]/files/page.tsx` - Complete admin UI

**Features:**
- Displays uploaded customer photos (thumbnails)
- Displays exported print-ready files
- Download button for each file
- "Download All as ZIP" button (using jszip + file-saver)
- Delete file functionality
- Image preview for image files
- File info (size, category, page number)
- Separate sections for uploads vs exports
- Responsive grid layout
- Empty state when no files

**Packages Installed:**
- ✅ `jszip` - ZIP file creation
- ✅ `file-saver` - Client-side file download
- ✅ `@types/file-saver` - TypeScript types

### 3. Upload Helper Library

**Created:**
- ✅ `lib/upload-order-files.ts` - Reusable upload functions

**Functions:**
- `uploadOrderFile()` - Upload single file to storage + create DB record
- `uploadOrderFilesBatch()` - Upload multiple files in parallel
- `canvasToBlob()` - Convert canvas to blob for upload
- `generateHighResExport()` - Generate 300 DPI export from canvas

**Usage Example:**
```typescript
import { uploadOrderFile, generateHighResExport } from '@/lib/upload-order-files';

// Upload customer photo
const result = await uploadOrderFile({
    orderId: 'uuid-here',
    file: photoFile,
    fileName: 'page-1.jpg',
    bucketName: 'puzzle-uploads',
    fileType: 'upload',
    fileCategory: 'photo',
    pageNumber: 1
});

// Generate and upload high-res export
const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
const highResBlob = await generateHighResExport(canvas, 200, 300); // 200mm × 300mm at 300 DPI
await uploadOrderFile({
    orderId: 'uuid-here',
    file: highResBlob,
    fileName: 'export-final.jpg',
    bucketName: 'order-exports',
    fileType: 'export',
    fileCategory: 'final-export'
});
```

---

## 🚧 TODO: Update Constructors

### Constructors to Update:

1. **PhotoPuzzleConstructor** (`components/PhotoPuzzleConstructor.tsx`)
   - Upload photos to `puzzle-uploads` bucket
   - Generate final puzzle layout at 300 DPI
   - Save to `order-exports` bucket

2. **StarMapConstructor** (`components/StarMapConstructor.tsx`)
   - Export canvas as high-res PNG (300 DPI)
   - Save to `poster-exports` bucket
   - File naming: `{orderId}/starmap-{size}.png`

3. **CityMapConstructor** (`components/CityMapConstructor.tsx`)
   - Export Leaflet map as high-res PNG/PDF
   - Save to `poster-exports` bucket
   - File naming: `{orderId}/citymap-{location}.png`

4. **CalendarConstructor** (`components/CalendarConstructor.tsx`)
   - Upload photos to `calendar-uploads` bucket
   - Export each page at 300 DPI
   - Save to `order-exports` bucket
   - File naming: `{orderId}/calendar-page-{pageNumber}.jpg`

5. **GuestBookConfigModal/Constructor** (`components/GuestBookConfigModal.tsx`)
   - Export final design to `guestbook-exports` bucket
   - File naming: `{orderId}/guestbook-cover.png`

### Implementation Pattern:

```typescript
// In constructor component
import { uploadOrderFile, generateHighResExport } from '@/lib/upload-order-files';

const handleAddToCart = async () => {
    // 1. Create order first (or get order ID)
    const orderId = '...'; // From cart or order creation

    // 2. Upload customer photos
    for (let i = 0; i < photos.length; i++) {
        await uploadOrderFile({
            orderId,
            file: photos[i].file,
            fileName: `photo-${i + 1}.jpg`,
            bucketName: 'puzzle-uploads', // or calendar-uploads, etc.
            fileType: 'upload',
            fileCategory: 'photo',
            pageNumber: i + 1
        });
    }

    // 3. Generate high-res export
    const canvas = canvasRef.current;
    if (canvas) {
        const highResBlob = await generateHighResExport(
            canvas,
            300, // width in mm
            400, // height in mm
            'image/jpeg',
            0.95
        );

        await uploadOrderFile({
            orderId,
            file: highResBlob,
            fileName: 'final-export.jpg',
            bucketName: 'order-exports',
            fileType: 'export',
            fileCategory: 'final-export'
        });
    }

    // 4. Add to cart with orderId reference
    addItem({...itemData, orderId});
};
```

---

## 📋 Manual Setup Steps

### Step 1: Run Database Migration

**Option A: Via Supabase CLI**
```bash
npx supabase db push
```

**Option B: Via Supabase Dashboard**
1. Go to SQL Editor in Supabase Dashboard
2. Copy entire content from `STORAGE_BUCKETS_SETUP.sql`
3. Paste and run
4. Verify with: `SELECT * FROM storage.buckets;`

### Step 2: Create Storage Buckets (If SQL Fails)

If storage bucket creation via SQL doesn't work, create manually:

1. Go to **Storage** section in Supabase Dashboard
2. Click **"New bucket"** for each:

**calendar-uploads:**
- Name: `calendar-uploads`
- Public: `false`
- File size limit: `50MB`
- Allowed MIME types: `image/jpeg, image/jpg, image/png, image/heic, image/webp`

**poster-exports:**
- Name: `poster-exports`
- Public: `false`
- File size limit: `100MB`
- Allowed MIME types: `image/jpeg, image/jpg, image/png, application/pdf`

**puzzle-uploads:**
- Name: `puzzle-uploads`
- Public: `false`
- File size limit: `50MB`
- Allowed MIME types: `image/jpeg, image/jpg, image/png, image/heic, image/webp`

**guestbook-exports:**
- Name: `guestbook-exports`
- Public: `false`
- File size limit: `100MB`
- Allowed MIME types: `image/jpeg, image/jpg, image/png, application/pdf`

**order-exports:**
- Name: `order-exports`
- Public: `false`
- File size limit: `100MB`
- Allowed MIME types: `image/jpeg, image/jpg, image/png, application/pdf`

3. After creating buckets, run RLS policies from SQL file

### Step 3: Verify Setup

```sql
-- Check buckets
SELECT * FROM storage.buckets
WHERE name IN ('calendar-uploads', 'poster-exports', 'puzzle-uploads', 'guestbook-exports', 'order-exports');

-- Check order_files table
SELECT COUNT(*) FROM order_files;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'order_files';
```

### Step 4: Test File Upload

1. Go to any constructor (e.g., `/order/puzzles`)
2. Upload a photo
3. Add to cart and create order
4. Go to `/admin/orders/[order-id]/files`
5. Verify files appear in admin panel
6. Test download and ZIP download

---

## 🎨 High-Resolution Export Specs

### 300 DPI Calculation

Formula: `pixels = (mm / 25.4) * 300`

**Common Sizes:**

| Product | Size (mm) | 300 DPI (px) |
|---------|-----------|--------------|
| Poster 30×40 | 300 × 400 | 3543 × 4724 |
| Poster 50×70 | 500 × 700 | 5906 × 8268 |
| Calendar A4 | 210 × 297 | 2480 × 3508 |
| Puzzle 30×40 | 300 × 400 | 3543 × 4724 |
| Star Map 40×50 | 400 × 500 | 4724 × 5906 |

### Export Quality Settings

```typescript
const quality = 0.95; // JPEG quality (95%)
const mimeType = 'image/jpeg'; // or 'image/png' for lossless
const DPI = 300; // Print standard
```

---

## 🔗 File Naming Convention

All files stored in Supabase Storage follow this pattern:

```
{bucket_name}/{order_id}/{filename}

Examples:
- calendar-uploads/abc123/photo-1.jpg
- calendar-uploads/abc123/photo-2.jpg
- order-exports/abc123/calendar-page-1.jpg
- order-exports/abc123/calendar-page-2.jpg
- poster-exports/def456/starmap-30x40.png
- puzzle-uploads/ghi789/puzzle-photo.jpg
- order-exports/ghi789/puzzle-final-300dpi.jpg
```

**Benefits:**
- Easy to identify order files
- Automatic cleanup when order deleted (CASCADE)
- Admin panel groups by order
- ZIP downloads organized by order

---

## 📦 Admin Panel Access

**Route:** `/admin/orders/[order-id]/files`

**From Order Detail Page:**
Add link to files view:
```tsx
<Link href={`/admin/orders/${order.id}/files`}>
    📁 Переглянути файли замовлення
</Link>
```

---

## ✨ Next Steps

1. ✅ Database migration complete
2. ✅ Admin panel complete
3. ✅ Helper library complete
4. 🚧 Update PhotoPuzzleConstructor
5. 🚧 Update StarMapConstructor
6. 🚧 Update CityMapConstructor
7. 🚧 Update CalendarConstructor
8. 🚧 Update GuestBookConstructor

All infrastructure is ready. Now update each constructor to use the new upload system.
