/**
 * export-utils.ts
 * Client-side 300 DPI export utilities for print-ready file generation.
 * All processing runs in the browser — no server uploads of raw canvas data.
 */

import { createClient } from '@/lib/supabase/client'

const DPI = 300
const SCREEN_DPI = 96
export const SCALE = DPI / SCREEN_DPI // 3.125

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderFileRecord {
  order_id: string
  file_path: string
  file_name: string
  file_type: 'upload' | 'export'
  file_category?: string
  bucket_name: string
  page_number?: number
  file_size?: number
  mime_type?: string
}

export type ProgressCallback = (current: number, total: number, label?: string) => void

// ─── Canvas Export ─────────────────────────────────────────────────────────────

/**
 * Exports a canvas element at 300 DPI by scaling it up 3.125×.
 * Returns a PNG Blob at full print resolution.
 */
export async function exportCanvasAt300DPI(
  sourceCanvas: HTMLCanvasElement,
  targetWidthPx?: number,
  targetHeightPx?: number
): Promise<Blob> {
  const w = targetWidthPx ?? Math.round(sourceCanvas.width * SCALE)
  const h = targetHeightPx ?? Math.round(sourceCanvas.height * SCALE)

  // Use OffscreenCanvas if available, fall back to DOM canvas
  let exportCanvas: HTMLCanvasElement | OffscreenCanvas
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null

  if (typeof OffscreenCanvas !== 'undefined') {
    exportCanvas = new OffscreenCanvas(w, h)
    ctx = exportCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null
  } else {
    exportCanvas = document.createElement('canvas')
    ;(exportCanvas as HTMLCanvasElement).width = w
    ;(exportCanvas as HTMLCanvasElement).height = h
    ctx = (exportCanvas as HTMLCanvasElement).getContext('2d')
  }

  if (!ctx) throw new Error('Could not get canvas 2D context')

  ctx.imageSmoothingEnabled = true
  ;(ctx as CanvasRenderingContext2D).imageSmoothingQuality = 'high'
  ctx.drawImage(sourceCanvas, 0, 0, w, h)

  if (exportCanvas instanceof OffscreenCanvas) {
    return await exportCanvas.convertToBlob({ type: 'image/png' })
  } else {
    return await new Promise<Blob>((resolve, reject) => {
      ;(exportCanvas as HTMLCanvasElement).toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/png'
      )
    })
  }
}

/**
 * Calculate pixel dimensions from mm at 300 DPI.
 */
export function mmToPixels300dpi(mm: number): number {
  return Math.round((mm / 25.4) * DPI)
}

// ─── Supabase Storage Upload ───────────────────────────────────────────────────

/**
 * Uploads a Blob to Supabase Storage.
 * Returns the public URL and byte size.
 */
export async function uploadOrderFile(
  bucket: string,
  path: string,
  blob: Blob
): Promise<{ url: string; size: number }> {
  const supabase = createClient()

  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type || 'image/png',
    upsert: true,
  })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, size: blob.size }
}

// ─── DB Record Creation ────────────────────────────────────────────────────────

/**
 * Inserts a record into the order_files table.
 */
export async function createOrderFileRecord(record: OrderFileRecord): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('order_files').insert(record)
  if (error) throw new Error(`order_files insert failed: ${error.message}`)
}

/**
 * Insert multiple order_files at once.
 */
export async function createOrderFileRecords(records: OrderFileRecord[]): Promise<void> {
  if (records.length === 0) return
  const supabase = createClient()
  const { error } = await supabase.from('order_files').insert(records)
  if (error) throw new Error(`order_files bulk insert failed: ${error.message}`)
}

// ─── High-Level Helpers ────────────────────────────────────────────────────────

/**
 * Export a single canvas and upload it, reporting progress.
 */
export async function exportAndUploadCanvas(opts: {
  canvas: HTMLCanvasElement
  bucket: string
  path: string
  fileName: string
  orderId: string
  fileCategory?: string
  pageNumber?: number
  onProgress?: ProgressCallback
  current?: number
  total?: number
}): Promise<void> {
  const { canvas, bucket, path, fileName, orderId, fileCategory, pageNumber, onProgress, current = 1, total = 1 } = opts

  onProgress?.(current, total, fileName)

  const blob = await exportCanvasAt300DPI(canvas)
  const { size } = await uploadOrderFile(bucket, path, blob)

  await createOrderFileRecord({
    order_id: orderId,
    file_path: path,
    file_name: fileName,
    file_type: 'export',
    file_category: fileCategory,
    bucket_name: bucket,
    page_number: pageNumber,
    file_size: size,
    mime_type: 'image/png',
  })
}

/**
 * Register an already-uploaded file (photo print / photo magnets)
 * as an export record in order_files.
 */
export async function registerUploadedFile(opts: {
  orderId: string
  bucket: string
  path: string
  fileName: string
  fileSize?: number
  mimeType?: string
}): Promise<void> {
  await createOrderFileRecord({
    order_id: opts.orderId,
    file_path: opts.path,
    file_name: opts.fileName,
    file_type: 'upload',
    bucket_name: opts.bucket,
    file_size: opts.fileSize,
    mime_type: opts.mimeType ?? 'image/jpeg',
  })
}
