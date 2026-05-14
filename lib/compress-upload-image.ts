// Client-side image compression for large file uploads.
//
// Why: the order form accepts JPG/PNG/HEIC from customers' phones. Modern
// iPhones produce 4-8 MB JPEGs and 12-20 MB HEIC files; Android phones in
// HDR mode can produce 10-15 MB. With 30-50 photos per order the total
// often blows past the 200 MB Vercel body limit, and even when it fits the
// upload takes 5-10 minutes on mobile data — customers abandon.
//
// Strategy: keep the displayed "200 MB" limit (the message), but compress
// any image that's actually larger than COMPRESS_THRESHOLD before the
// upload starts. End quality is still good enough for print at 300 DPI
// because we only resize images that are larger than MAX_LONG_EDGE px —
// a 4032×3024 phone photo becomes 4000×3000 (still fine for 20×30 cm
// photobook printing at 250+ DPI), and at JPEG quality 0.88 the file size
// drops from 5 MB to ~1 MB.
//
// Files that are already small (<COMPRESS_THRESHOLD) pass through
// untouched. ZIP, HEIC, and non-image types pass through untouched (we
// don't try to decode HEIC client-side — the server handles those).

// Anything above this gets compressed.
export const COMPRESS_THRESHOLD = 2 * 1024 * 1024; // 2 MB

// Resize the image so neither dimension is bigger than this. Keeps phone
// photos well above what's needed for print quality without producing
// 25 MB blobs.
export const MAX_LONG_EDGE = 4000;

// JPEG quality target. 0.88 is "indistinguishable from original" at print
// size for most photos; 0.85 starts showing very faint blocking artefacts
// in flat sky areas; 0.92+ barely changes file size vs 0.88.
export const JPEG_QUALITY = 0.88;

export interface CompressionResult {
    file: File;        // either the compressed file or the original passthrough
    originalSize: number;
    finalSize: number;
    compressed: boolean;
}

/**
 * Compress one image file if it exceeds the threshold. Returns the
 * original file untouched if it's already small enough, isn't an image,
 * or compression fails for any reason — never throws, so the order flow
 * isn't blocked by a malformed image.
 */
export async function compressImageFile(file: File): Promise<CompressionResult> {
    const originalSize = file.size;

    // Pass through small files and anything that isn't a recognised
    // browser-decodable image (HEIC, ZIP, etc.)
    const canDecode = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp';
    if (!canDecode || originalSize <= COMPRESS_THRESHOLD) {
        return { file, originalSize, finalSize: originalSize, compressed: false };
    }

    try {
        const dataUrl = await readFileAsDataURL(file);
        const img = await loadImage(dataUrl);

        // Determine target dimensions while preserving aspect ratio.
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const longEdge = Math.max(w, h);
        if (longEdge > MAX_LONG_EDGE) {
            const ratio = MAX_LONG_EDGE / longEdge;
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            // Canvas allocation can fail on memory-constrained devices —
            // fall back to the original file rather than blocking upload.
            return { file, originalSize, finalSize: originalSize, compressed: false };
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        const blob: Blob | null = await new Promise(resolve =>
            canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
        );
        if (!blob || blob.size >= originalSize) {
            // Sometimes a tiny PNG compresses to a bigger JPEG (alpha or
            // already-optimised). Keep the original in that case.
            return { file, originalSize, finalSize: originalSize, compressed: false };
        }

        // Preserve the original name but switch the extension to .jpg
        // since we wrote JPEG bytes.
        const baseName = file.name.replace(/\.(png|webp|jpe?g)$/i, '');
        const compressed = new File([blob], `${baseName}.jpg`, {
            type: 'image/jpeg',
            lastModified: file.lastModified,
        });
        return { file: compressed, originalSize, finalSize: compressed.size, compressed: true };
    } catch {
        // Decode failure (corrupt file, weird PNG, browser memory). The
        // caller will let the server handle whatever was actually
        // selected.
        return { file, originalSize, finalSize: originalSize, compressed: false };
    }
}

/**
 * Compress a list of files. Runs them in series to avoid memory spikes on
 * mobile Safari (parallel canvas allocations on 8+ MB photos crash the
 * page on older iPhones).
 */
export async function compressImageFiles(files: File[]): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    for (const f of files) {
        results.push(await compressImageFile(f));
    }
    return results;
}

//  Helpers

function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(file);
    });
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = src;
    });
}
