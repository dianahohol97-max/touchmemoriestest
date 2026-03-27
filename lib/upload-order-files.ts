import { createClient } from '@/lib/supabase/client';

export interface UploadOrderFileParams {
    orderId: string;
    file: File | Blob;
    fileName: string;
    bucketName: string;
    fileType: 'upload' | 'export';
    fileCategory?: string;
    pageNumber?: number;
}

/**
 * Uploads a file to Supabase Storage and creates a record in order_files table
 * @param params Upload parameters
 * @returns Promise with file path or error
 */
export async function uploadOrderFile(params: UploadOrderFileParams): Promise<{ success: boolean; filePath?: string; error?: string }> {
    const { orderId, file, fileName, bucketName, fileType, fileCategory, pageNumber } = params;
    const supabase = createClient();

    try {
        // Construct file path: orderId/fileName
        const filePath = `${orderId}/${fileName}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true // Overwrite if exists
            });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return { success: false, error: uploadError.message };
        }

        // Get file size and mime type
        const fileSize = file.size;
        const mimeType = file instanceof File ? file.type : 'application/octet-stream';

        // Create record in order_files table
        const { error: dbError } = await supabase
            .from('order_files')
            .insert({
                order_id: orderId,
                file_path: filePath,
                file_name: fileName,
                file_type: fileType,
                file_category: fileCategory,
                bucket_name: bucketName,
                page_number: pageNumber,
                file_size: fileSize,
                mime_type: mimeType
            });

        if (dbError) {
            console.error('Database insert error:', dbError);
            // Try to delete uploaded file from storage
            await supabase.storage.from(bucketName).remove([filePath]);
            return { success: false, error: dbError.message };
        }

        return { success: true, filePath };
    } catch (error: any) {
        console.error('Upload error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Uploads multiple files in batch
 * @param files Array of upload parameters
 * @returns Promise with results array
 */
export async function uploadOrderFilesBatch(files: UploadOrderFileParams[]): Promise<Array<{ success: boolean; fileName: string; filePath?: string; error?: string }>> {
    const results = await Promise.all(
        files.map(async (fileParams) => {
            const result = await uploadOrderFile(fileParams);
            return {
                fileName: fileParams.fileName,
                ...result
            };
        })
    );

    return results;
}

/**
 * Helper to convert canvas to blob for upload
 * @param canvas HTML Canvas element
 * @param mimeType Image mime type (default: image/jpeg)
 * @param quality Image quality 0-1 (default: 0.95)
 * @returns Promise with Blob
 */
export async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string = 'image/jpeg', quality: number = 0.95): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to convert canvas to blob'));
                }
            },
            mimeType,
            quality
        );
    });
}

/**
 * Generate high-resolution export from canvas (300 DPI)
 * @param canvas Source canvas
 * @param targetWidthMM Target width in millimeters
 * @param targetHeightMM Target height in millimeters
 * @param mimeType Output mime type (default: image/jpeg)
 * @param quality Image quality 0-1 (default: 0.95)
 * @returns Promise with high-res Blob
 */
export async function generateHighResExport(
    canvas: HTMLCanvasElement,
    targetWidthMM: number,
    targetHeightMM: number,
    mimeType: string = 'image/jpeg',
    quality: number = 0.95
): Promise<Blob> {
    // Calculate 300 DPI dimensions
    const DPI = 300;
    const MM_PER_INCH = 25.4;
    const targetWidthPx = Math.round((targetWidthMM / MM_PER_INCH) * DPI);
    const targetHeightPx = Math.round((targetHeightMM / MM_PER_INCH) * DPI);

    // Create high-res canvas
    const highResCanvas = document.createElement('canvas');
    highResCanvas.width = targetWidthPx;
    highResCanvas.height = targetHeightPx;

    const ctx = highResCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    // Draw source canvas scaled to high-res dimensions
    ctx.drawImage(canvas, 0, 0, targetWidthPx, targetHeightPx);

    // Convert to blob
    return canvasToBlob(highResCanvas, mimeType, quality);
}
