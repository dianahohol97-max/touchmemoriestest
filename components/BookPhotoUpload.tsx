'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, X, AlertTriangle, ChevronRight, GripVertical, Info } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import { toast } from 'sonner';

interface PhotoFile {
    id: string;
    file: File;
    preview: string;
    width: number;
    height: number;
}

interface BookConfig {
    productSlug: string;
    productName: string;
    selectedSize?: string;
    selectedPageCount: string;
    photoRecommendation: { mixed: string; collage: string } | string | null;
    totalPrice: number;
    selectedCoverType?: string;
    selectedCoverColor?: string;
    selectedDecorationType?: string | null;
    selectedDecorationVariant?: string | null;
    decorationSurcharge?: number;
    selectedLamination?: string | null;
    selectedPageLamination?: string | null;
}

// Print dimensions in mm for quality checking (single page)
const PRINT_DIMENSIONS: Record<string, { width: number; height: number }> = {
    // Photobooks - single page dimensions
    '20×20': { width: 200, height: 200 },
    '25×25': { width: 250, height: 250 },
    '20×30': { width: 200, height: 300 },
    '30×20': { width: 300, height: 200 },
    '30×30': { width: 300, height: 300 },
    // Magazines and Travel Book - A4
    'A4': { width: 210, height: 297 },
    'default': { width: 210, height: 297 }
};

export default function BookPhotoUpload() {
    const t = useT();
    const router = useRouter();
    const [config, setConfig] = useState<BookConfig | null>(null);
    const [photos, setPhotos] = useState<PhotoFile[]>([]);
    const [dragging, setDragging] = useState(false);
    const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Load configuration from sessionStorage
        const configJson = sessionStorage.getItem('bookConstructorConfig');
        if (configJson) {
            try {
                const loadedConfig = JSON.parse(configJson);
                setConfig(loadedConfig);
            } catch (error) {
                console.error('Failed to parse book config:', error);
                toast.error(t('photo_upload.upload_error'));
                router.push('/order/book');
            }
        } else {
            toast.error(t('photo_upload.choose_config_first'));
            router.push('/order/book');
        }
    }, [router]);

    const handleFileSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        // There is no per-product photo cap in the constructor — only the
        // technical 500 hard limit below. The customer arranges the book
        // themselves, so they may upload as many photos as they like.
        const newPhotos: PhotoFile[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;

            // Check max 500 photos limit (hard upper bound for any product)
            if (photos.length + newPhotos.length >= 500) {
                toast.error(t('photo_upload.max_photos'));
                break;
            }
            // NOTE: the per-product "recommended max" cap (130% of the
            // recommended count) was removed — in the constructor the
            // customer may upload as many photos as they like. The
            // recommendation is shown as guidance only; the minimum
            // (one photo per page) is still enforced before they can
            // continue. The 500 hard limit above is just a technical
            // safety bound.

            const preview = URL.createObjectURL(file);

            // Get image dimensions
            try {
                const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                    const image = new window.Image();
                    image.onload = () => resolve(image);
                    image.onerror = reject;
                    image.src = preview;
                });

                newPhotos.push({
                    id: Math.random().toString(36).substring(7),
                    file,
                    preview,
                    width: img.width,
                    height: img.height
                });
            } catch (error) {
                URL.revokeObjectURL(preview);
                console.error('Error loading image:', error);
            }
        }

        setPhotos(prev => [...prev, ...newPhotos]);
        if (newPhotos.length > 0) {
            toast.success(t('photo_upload.photos_uploaded').replace('{n}', String(newPhotos.length)));
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        await handleFileSelect(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(true);
    };

    const handleDragLeave = () => {
        setDragging(false);
    };

    const removePhoto = (id: string) => {
        const photo = photos.find(p => p.id === id);
        if (photo) {
            URL.revokeObjectURL(photo.preview);
        }
        setPhotos(photos.filter(p => p.id !== id));
    };

    // Drag and drop reordering
    const handlePhotoGroupDragStart = (e: React.DragEvent, photoId: string) => {
        setDraggedPhotoId(photoId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handlePhotoGroupDragOver = (e: React.DragEvent, photoId: string) => {
        e.preventDefault();
        if (!draggedPhotoId || draggedPhotoId === photoId) return;

        const draggedIndex = photos.findIndex(p => p.id === draggedPhotoId);
        const targetIndex = photos.findIndex(p => p.id === photoId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const newPhotos = [...photos];
        const [draggedPhoto] = newPhotos.splice(draggedIndex, 1);
        newPhotos.splice(targetIndex, 0, draggedPhoto);

        setPhotos(newPhotos);
    };

    const handlePhotoGroupDragEnd = () => {
        setDraggedPhotoId(null);
    };

    const checkPhotoQuality = (photo: PhotoFile): { ok: boolean; message: string } => {
        if (!config?.selectedSize) {
            // For products without size selector, use default A4
            const dims = PRINT_DIMENSIONS['A4'];
            return checkDimensions(photo, dims.width, dims.height);
        }

        // Extract size from config (e.g., "20×20 см" -> "20×20")
        const sizeKey = config.selectedSize.split(' ')[0];
        const dims = PRINT_DIMENSIONS[sizeKey] || PRINT_DIMENSIONS['default'];

        return checkDimensions(photo, dims.width, dims.height);
    };

    const checkDimensions = (photo: PhotoFile, widthMM: number, heightMM: number): { ok: boolean; message: string } => {
        const dpi = 150; // 150 DPI is acceptable for photobook printing
        const requiredWidth = (widthMM / 25.4) * dpi; // Convert mm to inches, then to pixels
        const requiredHeight = (heightMM / 25.4) * dpi;

        if (photo.width < requiredWidth || photo.height < requiredHeight) {
            return {
                ok: false,
                message: t('photo_upload.low_res_warning').replace('{w}', String(Math.round(requiredWidth))).replace('{h}', String(Math.round(requiredHeight)))
            };
        }

        return { ok: true, message: t('photo_upload.quality_ok') };
    };

    const navigatingForward = useRef(false);
    // Processing state shown while the photos are being prepared for the
    // editor. Without this the page froze for minutes on big uploads
    // (53 professional photos × ~10 MB each = ~700 MB of base64 strings
    // when readAsDataURL fired on all of them at once via Promise.all).
    const [processing, setProcessing] = useState(false);
    const [processed, setProcessed] = useState(0);
    const [processTotal, setProcessTotal] = useState(0);

    const handleContinue = async () => {
        if (photos.length === 0) {
            toast.error(t('photo_upload.add_photo_first'));
            return;
        }
        // Block the customer from moving to the editor with fewer photos
        // than the journal has pages. The editor places one photo per
        // page slot by default, so going in with 5 photos for a 12-page
        // journal would leave half the journal blank. Better to stop
        // them here with a clear message than to let them discover the
        // problem in the editor.
        const pageCountFromConfig = parseInt(config?.selectedPageCount?.match(/\d+/)?.[0] || '0', 10);
        if (pageCountFromConfig > 0 && photos.length < pageCountFromConfig) {
            const missing = pageCountFromConfig - photos.length;
            toast.error(
                `Завантажте ще щонайменше ${missing} фото — для ${pageCountFromConfig} сторінок потрібно мінімум ${pageCountFromConfig} фото, інакше частина сторінок буде порожня`,
                { duration: 6000 }
            );
            return;
        }
        if (processing) return; // prevent double-fire from impatient clicking

        // Photo handoff to editor.
        //
        // The original implementation did Promise.all(photos.map(prepareForEditor))
        // which kicked off readAsDataUrl + img.decode for every file
        // simultaneously. With 50+ professional photos (10 MB each) the
        // page froze for 2-3 minutes because the browser was holding
        // ~700 MB of base64 strings in memory while decoding every
        // image at the same time on the main thread.
        //
        // This version processes one photo at a time, yielding to the
        // browser between each so the UI stays responsive, and shows
        // a "Обробка X з Y" indicator on the button.
        setProcessing(true);
        setProcessed(0);
        setProcessTotal(photos.length);

        const PRINT_MAX = 5000;

        // Fast path: most modern phone photos are 4032×3024 (iPhone) or
        // ~4080×3060 (Samsung) — well under PRINT_MAX. For those we can
        // skip base64 conversion entirely and pass the original File's
        // blob URL straight to the editor. createObjectURL is essentially
        // free (returns a reference, not a copy) — that's the difference
        // between a few seconds for 50 photos and a few minutes.
        //
        // We already have `photo.preview` (a blob URL) created during
        // upload, so for photos that fit print size we just reuse it.
        // Photos larger than 5000px on the long edge still go through
        // the canvas downscale path.
        const prepareForEditor = async (photo: PhotoFile): Promise<string> => {
            // photo.width / photo.height are set on upload via the
            // probe Image — check them first to decide whether we even
            // need to decode + downscale.
            if (photo.width <= PRINT_MAX && photo.height <= PRINT_MAX) {
                // Already small enough — just keep the blob URL.
                return photo.preview;
            }
            // Need to downscale. Use createImageBitmap (decodes off the
            // main thread on modern browsers) instead of new Image().
            const bitmap = typeof createImageBitmap === 'function'
                ? await createImageBitmap(photo.file)
                : await new Promise<HTMLImageElement>((resolve, reject) => {
                    const im = new window.Image();
                    im.onload = () => resolve(im);
                    im.onerror = () => reject(new Error('decode failed'));
                    im.src = URL.createObjectURL(photo.file);
                });
            const ow = (bitmap as { width: number }).width;
            const oh = (bitmap as { height: number }).height;
            const ratio = ow >= oh ? PRINT_MAX / ow : PRINT_MAX / oh;
            const w = Math.round(ow * ratio);
            const h = Math.round(oh * ratio);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
            if ('close' in bitmap) {
                try { (bitmap as ImageBitmap).close(); } catch {}
            }
            // For downscaled photos, the canvas IS the new preview. We
            // still produce a blob URL rather than a base64 string so
            // we don't pay the 33% size penalty in memory.
            const blob = await new Promise<Blob | null>(resolve => {
                const isPng = (photo.file.type || '').toLowerCase() === 'image/png';
                canvas.toBlob(b => resolve(b), isPng ? 'image/png' : 'image/jpeg', 0.92);
            });
            if (!blob) {
                // Fallback to base64 if toBlob returns null (rare)
                return canvas.toDataURL('image/jpeg', 0.92);
            }
            return URL.createObjectURL(blob);
        };

        // Yield to the event loop so React can paint the progress
        // update and the button stays interactive.
        const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

        try {
            const photosData: Array<{
                id: string; preview: string; width: number; height: number; name: string; size: number;
            }> = [];

            for (let i = 0; i < photos.length; i++) {
                const p = photos[i];
                try {
                    const preview = await prepareForEditor(p);
                    photosData.push({
                        id: p.id,
                        preview,
                        width: p.width,
                        height: p.height,
                        name: p.file.name,
                        size: p.file.size,
                    });
                } catch (err) {
                    console.warn(`prepareForEditor failed for ${p.file.name}:`, err);
                    // Skip the broken photo but keep going — losing one
                    // out of 50 photos is better than hanging the whole
                    // batch.
                }
                setProcessed(i + 1);
                // Every photo we yield to let the browser paint and the
                // GC reclaim the previous base64. Without this, after
                // 5-6 big files the browser is sitting on hundreds of
                // megabytes of base64 it could otherwise release.
                await yieldToBrowser();
            }

            try {
                (window as unknown as { __bookPhotoOriginals?: typeof photosData }).__bookPhotoOriginals = photosData;
            } catch { /* ignore */ }

            // Storage strategy:
            // photosData[i].preview is either a `blob:` URL (fast path
            // for fits-print-size photos — reuses the File object) or a
            // `blob:` URL pointing at a downscaled blob we just made.
            // Either way the URL itself is tiny but tied to the
            // current page session — a hard refresh invalidates them.
            //
            // For refresh-recovery, we kick off a background task that
            // produces 1800px JPEG @ 0.85 base64 strings and writes
            // those to sessionStorage. This used to be inline (and
            // doubled the freeze time on big uploads); now it runs
            // AFTER navigation so the user is already in the editor by
            // the time it finishes.
            try {
                // Stash blob-URL refs in sessionStorage anyway — useful
                // when the user navigates back & forth within the same
                // session without refresh.
                sessionStorage.setItem('bookConstructorPhotos', JSON.stringify(photosData));
            } catch {
                // Quota exceeded — write metadata stubs.
                try {
                    const meta = photosData.map(p => ({ ...p, preview: '' }));
                    sessionStorage.setItem('bookConstructorPhotos', JSON.stringify(meta));
                } catch { /* give up */ }
            }

            // Background refresh-recovery: produce 1800px base64 fallback
            // so a hard refresh in the editor doesn't lose the photos.
            // Runs AFTER navigation — see comment above.
            (async () => {
                const reduced: typeof photosData = [];
                for (const p of photosData) {
                    try {
                        const out = await new Promise<typeof p>(res => {
                            const im = new window.Image();
                            im.onload = () => {
                                const M = 1800;
                                let w = im.width, h = im.height;
                                if (w > M || h > M) {
                                    if (w >= h) { h = Math.round(h * M / w); w = M; }
                                    else { w = Math.round(w * M / h); h = M; }
                                }
                                const cv = document.createElement('canvas');
                                cv.width = w; cv.height = h;
                                const c2 = cv.getContext('2d')!;
                                c2.imageSmoothingEnabled = true;
                                c2.imageSmoothingQuality = 'high';
                                c2.drawImage(im, 0, 0, w, h);
                                res({ ...p, preview: cv.toDataURL('image/jpeg', 0.85) });
                            };
                            im.onerror = () => res(p);
                            im.src = p.preview;
                        });
                        reduced.push(out);
                    } catch { reduced.push(p); }
                    await yieldToBrowser();
                }
                try {
                    sessionStorage.setItem('bookConstructorPhotos', JSON.stringify(reduced));
                } catch { /* keep metadata-only stub */ }
            })();

            navigatingForward.current = true;
            const currentParams = new URLSearchParams(window.location.search);
            currentParams.set('product', config?.productSlug || '');
            router.push(`/editor/book/layout?${currentParams.toString()}`);
        } catch (err) {
            console.error('handleContinue error:', err);
            toast.error('Помилка при переході в редактор. Спробуйте ще раз.');
            setProcessing(false);
        }
    };

    // Cleanup blob URLs only when navigating back (not forward to editor)
    useEffect(() => {
        return () => {
            if (!navigatingForward.current) {
                photos.forEach(photo => URL.revokeObjectURL(photo.preview));
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!config) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">{t('photo_upload.loading')}</div>
            </div>
        );
    }

    const lowQualityCount = photos.filter(p => !checkPhotoQuality(p).ok).length;
    // photoRecommendation can be the new object form {mixed, collage} or the
    // legacy string from older saved configs. Handle both shapes.
    const photoRec = config.photoRecommendation;
    const recommendedRange: { mixed: string; collage: string } | string | null = photoRec || null;

    // In the constructor there is NO maximum photo cap — the customer may
    // upload as many photos as they like (only the technical 500 hard
    // limit in the upload handler applies). The recommendation range is
    // shown purely as guidance.

    return (
        <div className="max-w-6xl mx-auto px-4 py-4 sm:py-8">
            {/* Header */}
            <div className="mb-4 sm:mb-8">
                <h1 className="text-xl sm:text-3xl font-bold text-[#1e2d7d] mb-1 sm:mb-2">{config.productName}</h1>
                <p className="text-gray-600">{t('photo_upload.step2_title')}</p>
            </div>

            {/* Configuration Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-900 mb-1">{t('photo_upload.selected_config')}</p>
                        <div className="text-sm text-blue-700 space-y-1">
                            {config.selectedSize && <p>• {t('photo_upload.size_label')} {config.selectedSize}</p>}
                            <p>• {config.selectedPageCount}</p>
                            {config.selectedCoverType && <p>• {t('photo_upload.cover_label')} {config.selectedCoverType}{config.selectedCoverColor ? ` · ${config.selectedCoverColor}` : ''}</p>}
                            {config.selectedDecorationType && config.selectedDecorationType !== 'none' && (
                                <p>• {t('photo_upload.decoration_label')} {config.selectedDecorationType}{config.selectedDecorationVariant ? ` · ${config.selectedDecorationVariant}` : ''}{config.decorationSurcharge ? ` (+${config.decorationSurcharge} ₴)` : ''}</p>
                            )}
                            {config.selectedLamination && <p>• {t('photo_upload.lamination_cover')} {config.selectedLamination}</p>}
                            {config.selectedPageLamination && config.selectedPageLamination !== 'Без ламінації' && (() => {
                                const pages = parseInt(config.selectedPageCount?.match(/\d+/)?.[0] || '0');
                                const lamCost = pages > 0 ? pages * 7 : 0;
                                return <p>• {t('photo_upload.lamination_pages')} {config.selectedPageLamination}{lamCost > 0 ? ` (+${lamCost} ₴)` : ''}</p>;
                            })()}
                            {(config as any).enableKalka && (
                                <p>• Калька перед першою сторінкою: <b>так</b> (+300 ₴)</p>
                            )}
                            {(config as any).enableEndpaper && (
                                <p>• Друк на форзаці: <b>так</b> (+100 ₴)</p>
                            )}
                            {recommendedRange && (
                                typeof recommendedRange === 'string'
                                    ? <p>• {t('photo_upload.recommended_count')} <b>{recommendedRange}</b></p>
                                    : recommendedRange.collage
                                        ? <>
                                            <p>• {t('photo_upload.recommended_count')} <b>{recommendedRange.mixed}</b> (великі + колажі)</p>
                                            <p>• {t('photo_upload.recommended_count')} <b>{recommendedRange.collage}</b> (багато колажів)</p>
                                          </>
                                        // Magazines / travelbooks / hard-cover journals only have a
                                        // single "mixed" recommendation — no separate collage
                                        // strategy — so just show one line without the "+ колажі"
                                        // suffix that confuses customers.
                                        : <p>• {t('photo_upload.recommended_count')} <b>{recommendedRange.mixed}</b></p>
                            )}
                            {(() => {
                                const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
                                const textLayout = params.get('text_layout');
                                // 'Верстка тексту' values from DB:
                                //   none     → no text
                                //   own      → customer writes own text in the editor (+195 ₴)
                                //   with     → legacy value, treated like 'own'
                                //   we-basic / we-premium → we write the text, customer is in the
                                //     anketа flow, never reaches this constructor
                                const withText = textLayout === 'with' || textLayout === 'own';
                                const noText = textLayout === 'none' || !textLayout;
                                return (
                                    <>
                                        {withText && <p>• {t('photo_upload.with_text_layout')}</p>}
                                        {noText && textLayout === 'none' && <p>• {t('photo_upload.without_text')}</p>}
                                    </>
                                );
                            })()}
                            <p>• {t('photo_upload.estimated_price')} {config.totalPrice} ₴</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Photo Counter */}
            {(() => {
                const pageCountReq = parseInt(config?.selectedPageCount?.match(/\d+/)?.[0] || '0', 10);
                const meetsMinimum = pageCountReq > 0 ? photos.length >= pageCountReq : photos.length > 0;
                const remaining = pageCountReq > 0 ? Math.max(0, pageCountReq - photos.length) : 0;
                // Product-aware noun so a photobook doesn't read "журналу".
                const slugLc = (config?.productSlug || '').toLowerCase();
                const productNoun = /magazine|zhurnal|journal/.test(slugLc)
                    ? 'журналу'
                    : /travel/.test(slugLc)
                        ? 'тревелбука'
                        : 'фотокниги';
                // Two meaningful states in the constructor: short of the
                // page-count minimum (red), or at/above it (green). There is
                // NO upper cap here — the customer lays the book out
                // themselves and may upload as many photos as they like.
                const bg = photos.length === 0
                    ? 'bg-orange-50 border-orange-200'
                    : !meetsMinimum
                        ? 'bg-red-50 border-red-200'
                        : 'bg-green-50 border-green-200';
                const counterText = photos.length === 0
                    ? 'Завантажте свої фото'
                    : !meetsMinimum
                        ? `Завантажено ${photos.length} з ${pageCountReq} — потрібно ще ${remaining} ${remaining === 1 ? 'фото' : 'фото'}`
                        : `Завантажено ${photos.length} фото${pageCountReq ? ` (мінімум ${pageCountReq})` : ''}`;
                return (
                    <div className={`mb-6 p-4 rounded-lg border ${bg}`}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="text-sm font-semibold text-[#1e2d7d]">
                                {counterText}
                            </div>
                            {lowQualityCount > 0 && (
                                <div className="flex items-center gap-2 text-yellow-700">
                                    <AlertTriangle className="w-5 h-5" />
                                    <span className="text-sm font-medium">{t('photo_upload.low_quality_photos').replace('{n}', String(lowQualityCount))}</span>
                                </div>
                            )}
                        </div>
                        {!meetsMinimum && photos.length > 0 && pageCountReq > 0 && (
                            // Explanation of why we require minimum=pages.
                            // Customers expect to fill every page with at least
                            // one photo, so we tell them upfront here.
                            <div className="text-xs text-red-700 mt-2">
                                Для {productNoun} на {pageCountReq} сторінок потрібно мінімум {pageCountReq} фото, інакше частина сторінок буде порожня.
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Upload Zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-6 sm:p-12 text-center transition-colors cursor-pointer mb-4 sm:mb-8 ${
                    dragging
                        ? 'border-[#1e2d7d] bg-[#dbeafe]'
                        : 'border-gray-300 bg-[#f8f9fc] hover:border-[#1e2d7d] hover:bg-[#f0f2f8]'
                }`}
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload className="w-8 h-8 sm:w-12 sm:h-12 text-[#1e2d7d] mx-auto mb-3" />
                <p className="text-base sm:text-lg font-semibold text-[#1e2d7d] mb-1 sm:mb-2">
                    {t('photo_upload.drag_photos')}
                </p>
                <p className="text-sm text-gray-500 mb-4">
                    {t('photo_upload.or_drag')}
                </p>
                <button
                    className="px-6 py-3 bg-[#1e2d7d] text-white rounded-lg font-semibold hover:bg-[#263a99] transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                    }}
                >
                    {t('photo_upload.my_devices')}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="hidden"
                />
                <p className="text-xs text-gray-400 mt-4">
                    JPG, PNG, HEIC
                </p>
            </div>

            {/* Photo Thumbnail Grid with Drag & Drop Reordering */}
            {photos.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">
                            {t('photo_upload.uploaded_photos')} ({photos.length})
                        </h3>
                        <p className="text-sm text-gray-500">
                            {t('photo_upload.drag_to_reorder')}
                        </p>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4 max-h-[40vh] sm:max-h-[600px] overflow-y-auto p-1 sm:p-2">
                        {photos.map((photo, index) => {
                            const quality = checkPhotoQuality(photo);
                            return (
                                <div
                                    key={photo.id}
                                    draggable
                                    onDragStart={(e) => handlePhotoGroupDragStart(e, photo.id)}
                                    onDragOver={(e) => handlePhotoGroupDragOver(e, photo.id)}
                                    onDragEnd={handlePhotoGroupDragEnd}
                                    className={`relative group cursor-move ${
                                        draggedPhotoId === photo.id ? 'opacity-50' : ''
                                    }`}
                                >
                                    {/* Photo Number Badge */}
                                    <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10">
                                        {index + 1}
                                    </div>

                                    {/* Drag Handle */}
                                    <div className="absolute top-2 right-10 bg-black/70 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <GripVertical className="w-4 h-4" />
                                    </div>

                                    {/* Photo Thumbnail */}
                                    <div className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                                        quality.ok ? 'border-gray-200 hover:border-[#1e2d7d]' : 'border-yellow-400'
                                    }`}>
                                        <img
                                            src={photo.preview}
                                            alt={`Photo ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    {/* Quality Warning */}
                                    {!quality.ok && (
                                        <div className="absolute bottom-2 left-2 bg-yellow-500 rounded-full p-1" title={quality.message}>
                                            <AlertTriangle className="w-3 h-3 text-white" />
                                        </div>
                                    )}

                                    {/* Remove Button */}
                                    <button
                                        onClick={() => removePhoto(photo.id)}
                                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>

                                    {/* Photo Info on Hover */}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <p className="text-white text-xs truncate">
                                            {photo.width}×{photo.height}px
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Help Text */}
            {photos.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('photo_upload.tips_title')}</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                        <li>{t('photo_upload.tip_drag')}</li>
                        <li>{t('photo_upload.tip_yellow')}</li>
                        <li>{t('photo_upload.tip_dpi')}</li>

                    </ul>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-4">
                <button
                    onClick={() => {
                        // Restore bookConfig draft so configurator shows previous selections
                        const cfg = sessionStorage.getItem('bookConstructorConfig');
                        if (cfg) {
                            try {
                                const c = JSON.parse(cfg);
                                const slug = c.productSlug;
                                if (slug) {
                                    // Restore the config draft so selections are preserved
                                    sessionStorage.setItem(`bookConfig_${slug}`, JSON.stringify({
                                        selectedSize: c.selectedSize,
                                        selectedCoverType: c.selectedCoverType,
                                        selectedPageCount: c.selectedPageCount,
                                        selectedCopies: c.selectedCopies,
                                        enableEndpaper: c.enableEndpaper,
                                        enableKalka: c.enableKalka,
                                        selectedDecorationType: c.selectedDecorationType,
                                        selectedDecorationVariant: c.selectedDecorationVariant,
                                        selectedLamination: c.selectedLamination,
                                        selectedCoverColor: c.selectedCoverColor,
                                    }));
                                    router.push(`/catalog/${slug}`);
                                    return;
                                }
                            } catch {}
                        }
                        router.back();
                    }}
                    className="w-full sm:flex-1 px-6 py-3 sm:py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors text-base sm:text-lg"
                >
                    {t('photo_upload.back_to_config')}
                </button>
                <button
                    onClick={handleContinue}
                    disabled={photos.length === 0 || processing}
                    className={`w-full sm:flex-1 flex items-center justify-center gap-2 px-6 py-3 sm:py-4 rounded-lg font-semibold transition-colors text-base sm:text-lg ${
                        photos.length > 0 && !processing
                            ? 'bg-[#1e2d7d] text-white hover:bg-[#263a99]'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    {processing ? (
                        <>
                            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Обробка {processed} з {processTotal}…
                        </>
                    ) : (
                        <>
                            {t('photo_upload.continue_editor')}
                            <ChevronRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
