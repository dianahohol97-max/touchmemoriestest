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
    photoRecommendation: string;
    totalPrice: number;
    selectedCoverType?: string;
    selectedCoverColor?: string;
    selectedDecorationType?: string | null;
    selectedDecorationVariant?: string | null;
    decorationSurcharge?: number;
    selectedLamination?: string | null;
    selectedPageLamination?: string | null;
}

// Print dimensions in mm for quality checking (at 300 DPI)
const PRINT_DIMENSIONS: Record<string, { width: number; height: number }> = {
    // Photobooks - using spread dimensions
    '20×20': { width: 405, height: 203 },
    '25×25': { width: 500, height: 254 },
    '20×30': { width: 420, height: 305 },
    '30×20': { width: 610, height: 203 },
    '30×30': { width: 610, height: 305 },
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

        const newPhotos: PhotoFile[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;

            // Check max 500 photos limit
            if (photos.length + newPhotos.length >= 500) {
                toast.error(t('photo_upload.max_photos'));
                break;
            }

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
        const dpi = 300;
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

    const handleContinue = () => {
        if (photos.length === 0) {
            toast.error(t('photo_upload.add_photo_first'));
            return;
        }

        // Convert photos to base64 so they survive page navigation
        // (blob URLs are revoked on unmount and would be invalid in the editor)
        Promise.all(photos.map(p => new Promise<{ id: string; preview: string; width: number; height: number; name: string; size: number }>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve({
                id: p.id,
                preview: e.target?.result as string, // base64 data URL — survives navigation
                width: p.width,
                height: p.height,
                name: p.file.name,
                size: p.file.size
            });
            reader.readAsDataURL(p.file);
        }))).then(photosData => {
            sessionStorage.setItem('bookConstructorPhotos', JSON.stringify(photosData));
            navigatingForward.current = true;
            // Navigate to layout editor (Phase 3) — preserve all URL params
            const currentParams = new URLSearchParams(window.location.search);
            currentParams.set('product', config?.productSlug || '');
            router.push(`/editor/book/layout?${currentParams.toString()}`);
        });
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
    const recommendedRange = config.photoRecommendation || '';

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
                                const lamCost = pages > 0 ? pages * 5 : 0;
                                return <p>• {t('photo_upload.lamination_pages')} {config.selectedPageLamination}{lamCost > 0 ? ` (+${lamCost} ₴)` : ''}</p>;
                            })()}
                            {recommendedRange && <p>• {t('photo_upload.recommended_count')} <b>{recommendedRange}</b></p>}
                            {(() => {
                                const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
                                const textLayout = params.get('text_layout');
                                return (
                                    <>
                                        {textLayout && <p>• {textLayout === 'with' ? t('photo_upload.with_text_layout') : t('photo_upload.without_text')}</p>}
                                    </>
                                );
                            })()}
                            <p>• {t('photo_upload.estimated_price')} {config.totalPrice} ₴</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Photo Counter */}
            <div className={`mb-6 p-4 rounded-lg ${photos.length === 0 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
                <div className="flex items-center justify-between">
                    <div></div>
                    {lowQualityCount > 0 && (
                        <div className="flex items-center gap-2 text-yellow-700">
                            <AlertTriangle className="w-5 h-5" />
                            <span className="text-sm font-medium">{t('photo_upload.low_quality_photos').replace('{n}', String(lowQualityCount))}</span>
                        </div>
                    )}
                </div>
            </div>

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
                    disabled={photos.length === 0}
                    className={`w-full sm:flex-1 flex items-center justify-center gap-2 px-6 py-3 sm:py-4 rounded-lg font-semibold transition-colors text-base sm:text-lg ${
                        photos.length > 0
                            ? 'bg-[#1e2d7d] text-white hover:bg-[#263a99]'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    {t('photo_upload.continue_editor')}
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
