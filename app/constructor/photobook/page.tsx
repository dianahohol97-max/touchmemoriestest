'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import Image from 'next/image';
import {
  Upload, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  RotateCw, Trash2, Save, ShoppingCart, Image as ImageIcon,
  Grid, Palette, Sparkles, Frame, Settings, Plus, Minus
} from 'lucide-react';

// ═══════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════

type CoverType = 'printed' | 'velour' | 'leather' | 'fabric';
type SizeId = '20×20' | '25×25' | '20×30' | '30×20' | '30×30';
type LayoutId = '1-full' | '2-split' | '3-left-full' | '4-grid' | 'left-only' | 'right-only';

interface ConstructorConfig {
  productType: 'photobook' | 'magazine';
  coverType?: CoverType;
  coverTypeLabel?: string;
  size: SizeId;
  pages: number;
  totalPrice: number;
}

interface PhotoFile {
  id: string;
  file: File;
  preview: string;
}

interface PhotoSlot {
  id: string;
  photo: PhotoFile | null;
  zoom: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
}

interface Spread {
  id: number;
  label: string;
  layout: LayoutId;
  slots: PhotoSlot[];
  background?: string;
}

const SIZES = {
  '20×20': { w: 20, h: 20, ratio: 1, spreadRatio: 2, label: '20×20 см' },
  '25×25': { w: 25, h: 25, ratio: 1, spreadRatio: 2, label: '25×25 см' },
  '20×30': { w: 20, h: 30, ratio: 20/30, spreadRatio: 40/30, label: '20×30 см' },
  '30×20': { w: 30, h: 20, ratio: 30/20, spreadRatio: 60/20, label: '30×20 см' },
  '30×30': { w: 30, h: 30, ratio: 1, spreadRatio: 2, label: '30×30 см' },
};

const LAYOUTS: Record<LayoutId, { name: string; icon: string; slots: number }> = {
  '1-full': { name: 'Повний розворот', icon: '▭', slots: 1 },
  '2-split': { name: '2 фото', icon: '▯▯', slots: 2 },
  '3-left-full': { name: '3 фото', icon: '▯▫▫', slots: 3 },
  '4-grid': { name: '4 фото (сітка)', icon: '▫▫▫▫', slots: 4 },
  'left-only': { name: 'Тільки ліва', icon: '▯', slots: 1 },
  'right-only': { name: 'Тільки права', icon: '▯', slots: 1 },
};

// ═══════════════════════════════════════════════════════
// CONFIG MODAL COMPONENT
// ═══════════════════════════════════════════════════════

function ConfigModal({ onSubmit }: { onSubmit: (config: ConstructorConfig) => void }) {
  const [size, setSize] = useState<SizeId>('20×20');
  const [pages, setPages] = useState(20);

  const handleSubmit = () => {
    const config: ConstructorConfig = {
      productType: 'photobook',
      size,
      pages,
      totalPrice: 950, // Base price
    };
    sessionStorage.setItem('constructorConfig', JSON.stringify(config));
    onSubmit(config);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Налаштування фотокниги</h2>

        {/* Size Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Формат</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(SIZES) as SizeId[]).map((sizeId) => (
              <button
                key={sizeId}
                onClick={() => setSize(sizeId)}
                className={`p-3 rounded-lg border-2 font-semibold text-sm transition ${
                  size === sizeId
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:border-blue-300 text-gray-700'
                }`}
              >
                {SIZES[sizeId].label}
              </button>
            ))}
          </div>
        </div>

        {/* Pages Input */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Кількість сторінок</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPages(Math.max(20, pages - 2))}
              className="p-2 rounded-lg border-2 border-gray-200 hover:border-blue-300 transition"
            >
              <Minus className="w-5 h-5" />
            </button>
            <input
              type="number"
              min={20}
              step={2}
              value={pages}
              onChange={(e) => setPages(Math.max(20, parseInt(e.target.value) || 20))}
              className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-200 font-bold text-center text-lg focus:border-blue-600 focus:outline-none"
            />
            <button
              onClick={() => setPages(pages + 2)}
              className="p-2 rounded-lg border-2 border-gray-200 hover:border-blue-300 transition"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Мінімум 20 сторінок, тільки парні числа</p>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition"
        >
          Відкрити редактор
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN EDITOR COMPONENT
// ═══════════════════════════════════════════════════════

export default function PhotobookConstructorPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load config from sessionStorage or show modal
  const [config, setConfig] = useState<ConstructorConfig | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = sessionStorage.getItem('constructorConfig');
    return stored ? JSON.parse(stored) : null;
  });

  // Initialize spreads based on config
  const [spreads, setSpreads] = useState<Spread[]>(() => {
    if (!config) return [];

    const numSpreads = Math.ceil((config.pages + 2) / 2); // +2 for cover
    return Array.from({ length: numSpreads }, (_, i) => ({
      id: i,
      label: i === 0 ? 'Обкладинка' : `Стор. ${i * 2 - 1}–${i * 2}`,
      layout: '1-full',
      slots: [
        { id: `${i}-left-0`, photo: null, zoom: 100, rotation: 0, offsetX: 0, offsetY: 0 }
      ],
    }));
  });

  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [draggingPhoto, setDraggingPhoto] = useState<PhotoFile | null>(null);
  const [leftPanel, setLeftPanel] = useState<'images' | 'layouts' | 'backgrounds' | 'cliparts' | 'masks' | 'frames' | 'options'>('images');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [canvasZoom, setCanvasZoom] = useState(100);

  // If no config, show modal
  if (!config) {
    return (
      <>
        <Navigation />
        <ConfigModal onSubmit={setConfig} />
      </>
    );
  }

  const currentSpread = spreads[currentSpreadIndex];
  const sizeConfig = SIZES[config.size];

  // ═══════════════════════════════════════════════════════
  // PHOTO HANDLING
  // ═══════════════════════════════════════════════════════

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === photoId);
      if (photo) URL.revokeObjectURL(photo.preview);
      return prev.filter(p => p.id !== photoId);
    });

    // Remove from all spreads
    setSpreads(prev => prev.map(spread => ({
      ...spread,
      slots: spread.slots.map(slot =>
        slot.photo?.id === photoId
          ? { ...slot, photo: null }
          : slot
      ),
    })));
  };

  const handleDragStart = (photo: PhotoFile) => {
    setDraggingPhoto(photo);
  };

  const handleDragEnd = () => {
    setDraggingPhoto(null);
  };

  const handleSlotDrop = (slotId: string) => {
    if (!draggingPhoto) return;

    setSpreads(prev => prev.map(spread => {
      if (spread.id !== currentSpreadIndex) return spread;

      return {
        ...spread,
        slots: spread.slots.map(slot =>
          slot.id === slotId
            ? { ...slot, photo: draggingPhoto, zoom: 100, rotation: 0, offsetX: 0, offsetY: 0 }
            : slot
        ),
      };
    }));

    setDraggingPhoto(null);
  };

  const handleSlotClick = (slotId: string) => {
    setSelectedSlot(slotId);
  };

  const handleRemoveFromSlot = (slotId: string) => {
    setSpreads(prev => prev.map(spread => {
      if (spread.id !== currentSpreadIndex) return spread;

      return {
        ...spread,
        slots: spread.slots.map(slot =>
          slot.id === slotId
            ? { ...slot, photo: null }
            : slot
        ),
      };
    }));
    setSelectedSlot(null);
  };

  // ═══════════════════════════════════════════════════════
  // LAYOUT CHANGE
  // ═══════════════════════════════════════════════════════

  const changeLayout = (layoutId: LayoutId) => {
    const layoutDef = LAYOUTS[layoutId];

    setSpreads(prev => prev.map(spread => {
      if (spread.id !== currentSpreadIndex) return spread;

      // Preserve existing photos
      const existingPhotos = spread.slots.map(s => s.photo).filter(Boolean);

      // Create new slots
      const newSlots: PhotoSlot[] = Array.from({ length: layoutDef.slots }, (_, i) => ({
        id: `${spread.id}-slot-${i}`,
        photo: existingPhotos[i] || null,
        zoom: 100,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
      }));

      return {
        ...spread,
        layout: layoutId,
        slots: newSlots,
      };
    }));
  };

  // ═══════════════════════════════════════════════════════
  // AUTO-FILL PHOTOS
  // ═══════════════════════════════════════════════════════

  const autoFillPhotos = () => {
    let photoIndex = 0;

    setSpreads(prev => prev.map(spread => ({
      ...spread,
      slots: spread.slots.map(slot => {
        if (photoIndex < photos.length) {
          const photo = photos[photoIndex++];
          return { ...slot, photo, zoom: 100, rotation: 0, offsetX: 0, offsetY: 0 };
        }
        return slot;
      }),
    })));
  };

  // ═══════════════════════════════════════════════════════
  // RENDER CANVAS
  // ═══════════════════════════════════════════════════════

  const renderCanvas = () => {
    if (!currentSpread) return null;

    const layout = currentSpread.layout;

    // Calculate canvas dimensions
    const canvasStyle: React.CSSProperties = {
      aspectRatio: sizeConfig.spreadRatio,
      maxHeight: 'calc(100vh - 200px)',
      maxWidth: '100%',
      width: 'auto',
      height: 'calc(100vh - 200px)',
      transform: `scale(${canvasZoom / 100})`,
      transformOrigin: 'center center',
      transition: 'transform 0.2s',
    };

    return (
      <div className="relative bg-white shadow-2xl rounded-sm mx-auto" style={canvasStyle}>
        {/* Center spine line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-300 z-10" />

        {/* Render slots based on layout */}
        {layout === '1-full' && (
          <Slot
            slot={currentSpread.slots[0]}
            style={{ position: 'absolute', inset: 0 }}
            onDrop={() => handleSlotDrop(currentSpread.slots[0].id)}
            onClick={() => handleSlotClick(currentSpread.slots[0].id)}
            onRemove={() => handleRemoveFromSlot(currentSpread.slots[0].id)}
            isSelected={selectedSlot === currentSpread.slots[0].id}
          />
        )}

        {layout === '2-split' && (
          <>
            <Slot
              slot={currentSpread.slots[0]}
              style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%' }}
              onDrop={() => handleSlotDrop(currentSpread.slots[0].id)}
              onClick={() => handleSlotClick(currentSpread.slots[0].id)}
              onRemove={() => handleRemoveFromSlot(currentSpread.slots[0].id)}
              isSelected={selectedSlot === currentSpread.slots[0].id}
            />
            <Slot
              slot={currentSpread.slots[1]}
              style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%' }}
              onDrop={() => handleSlotDrop(currentSpread.slots[1].id)}
              onClick={() => handleSlotClick(currentSpread.slots[1].id)}
              onRemove={() => handleRemoveFromSlot(currentSpread.slots[1].id)}
              isSelected={selectedSlot === currentSpread.slots[1].id}
            />
          </>
        )}

        {layout === '3-left-full' && (
          <>
            <Slot
              slot={currentSpread.slots[0]}
              style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%' }}
              onDrop={() => handleSlotDrop(currentSpread.slots[0].id)}
              onClick={() => handleSlotClick(currentSpread.slots[0].id)}
              onRemove={() => handleRemoveFromSlot(currentSpread.slots[0].id)}
              isSelected={selectedSlot === currentSpread.slots[0].id}
            />
            <Slot
              slot={currentSpread.slots[1]}
              style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '50%' }}
              onDrop={() => handleSlotDrop(currentSpread.slots[1].id)}
              onClick={() => handleSlotClick(currentSpread.slots[1].id)}
              onRemove={() => handleRemoveFromSlot(currentSpread.slots[1].id)}
              isSelected={selectedSlot === currentSpread.slots[1].id}
            />
            <Slot
              slot={currentSpread.slots[2]}
              style={{ position: 'absolute', bottom: 0, right: 0, width: '50%', height: '50%' }}
              onDrop={() => handleSlotDrop(currentSpread.slots[2].id)}
              onClick={() => handleSlotClick(currentSpread.slots[2].id)}
              onRemove={() => handleRemoveFromSlot(currentSpread.slots[2].id)}
              isSelected={selectedSlot === currentSpread.slots[2].id}
            />
          </>
        )}

        {layout === '4-grid' && (
          <>
            {currentSpread.slots.map((slot, i) => {
              const positions = [
                { top: 0, left: 0 },
                { top: 0, right: 0 },
                { bottom: 0, left: 0 },
                { bottom: 0, right: 0 },
              ];
              const pos = positions[i];

              return (
                <Slot
                  key={slot.id}
                  slot={slot}
                  style={{ position: 'absolute', ...pos, width: '50%', height: '50%' }}
                  onDrop={() => handleSlotDrop(slot.id)}
                  onClick={() => handleSlotClick(slot.id)}
                  onRemove={() => handleRemoveFromSlot(slot.id)}
                  isSelected={selectedSlot === slot.id}
                />
              );
            })}
          </>
        )}

        {layout === 'left-only' && (
          <>
            <Slot
              slot={currentSpread.slots[0]}
              style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%' }}
              onDrop={() => handleSlotDrop(currentSpread.slots[0].id)}
              onClick={() => handleSlotClick(currentSpread.slots[0].id)}
              onRemove={() => handleRemoveFromSlot(currentSpread.slots[0].id)}
              isSelected={selectedSlot === currentSpread.slots[0].id}
            />
            <div className="absolute top-0 right-0 w-1/2 h-full bg-white" />
          </>
        )}

        {layout === 'right-only' && (
          <>
            <div className="absolute top-0 left-0 w-1/2 h-full bg-white" />
            <Slot
              slot={currentSpread.slots[0]}
              style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%' }}
              onDrop={() => handleSlotDrop(currentSpread.slots[0].id)}
              onClick={() => handleSlotClick(currentSpread.slots[0].id)}
              onRemove={() => handleRemoveFromSlot(currentSpread.slots[0].id)}
              isSelected={selectedSlot === currentSpread.slots[0].id}
            />
          </>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <>
      <Navigation />

      <div className="h-screen flex flex-col bg-gray-100 mt-16">
        {/* TOP TOOLBAR */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-gray-900">
              Фотокнига {sizeConfig.label} · {config.pages} стор.
            </h1>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
            >
              <Upload className="w-4 h-4" />
              Завантажити фото
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            {photos.length > 0 && (
              <button
                onClick={autoFillPhotos}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-semibold transition"
              >
                Автозаповнення
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Zoom Controls */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setCanvasZoom(Math.max(50, canvasZoom - 10))}
                className="p-2 hover:bg-white rounded transition"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold px-2">{canvasZoom}%</span>
              <button
                onClick={() => setCanvasZoom(Math.min(150, canvasZoom + 10))}
                className="p-2 hover:bg-white rounded transition"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <button className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition">
              <ShoppingCart className="w-4 h-4" />
              Оформити
            </button>
          </div>
        </div>

        {/* MAIN EDITOR */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT SIDEBAR */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            {/* Tab Buttons */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setLeftPanel('images')}
                className={`flex-1 py-3 text-sm font-semibold transition ${
                  leftPanel === 'images'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ImageIcon className="w-4 h-4 mx-auto mb-1" />
                Фото
              </button>
              <button
                onClick={() => setLeftPanel('layouts')}
                className={`flex-1 py-3 text-sm font-semibold transition ${
                  leftPanel === 'layouts'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Grid className="w-4 h-4 mx-auto mb-1" />
                Шаблони
              </button>
              <button
                onClick={() => setLeftPanel('backgrounds')}
                className={`flex-1 py-3 text-sm font-semibold transition ${
                  leftPanel === 'backgrounds'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Palette className="w-4 h-4 mx-auto mb-1" />
                Фони
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {leftPanel === 'images' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-700">
                      Ваші фото ({photos.length})
                    </h3>
                  </div>

                  {photos.length === 0 ? (
                    <div className="text-center py-12">
                      <ImageIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-sm text-gray-500">Немає завантажених фото</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
                      >
                        Завантажити
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {photos.map((photo) => (
                        <div
                          key={photo.id}
                          draggable
                          onDragStart={() => handleDragStart(photo)}
                          onDragEnd={handleDragEnd}
                          className="relative group cursor-move aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-400 transition"
                        >
                          <Image
                            src={photo.preview}
                            alt="Photo"
                            fill
                            className="object-cover"
                          />
                          <button
                            onClick={() => handleRemovePhoto(photo.id)}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {leftPanel === 'layouts' && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">Шаблони розкладок</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(LAYOUTS) as LayoutId[]).map((layoutId) => (
                      <button
                        key={layoutId}
                        onClick={() => changeLayout(layoutId)}
                        className={`p-4 rounded-lg border-2 transition ${
                          currentSpread?.layout === layoutId
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="text-2xl mb-2">{LAYOUTS[layoutId].icon}</div>
                        <div className="text-xs font-semibold text-gray-700">
                          {LAYOUTS[layoutId].name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {leftPanel === 'backgrounds' && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">Фони</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {['#ffffff', '#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af', '#6b7280'].map((color) => (
                      <button
                        key={color}
                        className="aspect-square rounded-lg border-2 border-gray-200 hover:border-blue-400 transition"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CENTER CANVAS */}
          <div className="flex-1 bg-gray-100 flex flex-col items-center justify-center p-8 overflow-auto">
            {/* Canvas size label */}
            <div className="text-center text-sm text-gray-600 mb-3">
              {sizeConfig.label} · Розворот {currentSpreadIndex + 1} з {spreads.length}
            </div>

            {/* Canvas */}
            {renderCanvas()}

            {/* Spread Navigation */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setCurrentSpreadIndex(Math.max(0, currentSpreadIndex - 1))}
                disabled={currentSpreadIndex === 0}
                className="p-2 rounded-lg bg-white border border-gray-300 hover:border-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="px-4 py-2 bg-white rounded-lg border border-gray-300 font-semibold text-sm">
                {currentSpread?.label}
              </div>

              <button
                onClick={() => setCurrentSpreadIndex(Math.min(spreads.length - 1, currentSpreadIndex + 1))}
                disabled={currentSpreadIndex === spreads.length - 1}
                className="p-2 rounded-lg bg-white border border-gray-300 hover:border-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* RIGHT SIDEBAR - Spread Thumbnails */}
          <div className="w-64 bg-white border-l border-gray-200 overflow-y-auto p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Сторінки</h3>
            <div className="space-y-2">
              {spreads.map((spread, index) => (
                <button
                  key={spread.id}
                  onClick={() => setCurrentSpreadIndex(index)}
                  className={`w-full p-3 rounded-lg border-2 text-left transition ${
                    currentSpreadIndex === index
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="text-xs font-semibold text-gray-700 mb-1">
                    {spread.label}
                  </div>
                  <div
                    className="w-full bg-gray-100 rounded"
                    style={{ aspectRatio: sizeConfig.spreadRatio }}
                  >
                    {/* Mini preview */}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
// SLOT COMPONENT
// ═══════════════════════════════════════════════════════

interface SlotProps {
  slot: PhotoSlot;
  style: React.CSSProperties;
  onDrop: () => void;
  onClick: () => void;
  onRemove: () => void;
  isSelected: boolean;
}

function Slot({ slot, style, onDrop, onClick, onRemove, isSelected }: SlotProps) {
  return (
    <div
      style={style}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragOver={(e) => e.preventDefault()}
      onClick={onClick}
      className={`bg-gray-50 cursor-pointer hover:bg-blue-50/30 transition overflow-hidden group relative ${
        isSelected ? 'ring-4 ring-blue-500' : ''
      }`}
    >
      {slot.photo ? (
        <>
          <Image
            src={slot.photo.preview}
            alt="Photo"
            fill
            className="object-cover"
            style={{
              transform: `scale(${slot.zoom / 100}) rotate(${slot.rotation}deg)`,
              objectPosition: `${slot.offsetX}% ${slot.offsetY}%`,
            }}
          />
          {isSelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-400">
          <div className="text-center text-gray-400">
            <ImageIcon className="w-8 h-8 mx-auto mb-2" />
            <p className="text-xs">Перетягніть фото</p>
          </div>
        </div>
      )}
    </div>
  );
}
