'use client';
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Type, Image as ImageIcon } from 'lucide-react';

// Google Fonts
const GoogleFontsStyle = () => (
  <style jsx global>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;400i;700&family=Cormorant+Garamond:wght@300;300i;400;400i;600&family=Great+Vibes&family=Montserrat:wght@300;400;600&family=EB+Garamond:wght@400;400i&family=Lora:wght@400;400i;600&family=Raleway:wght@300;400;700&display=swap');
  `}</style>
);

// TypeScript interfaces
interface TextBlock {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number | string;
  fontStyle?: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  zIndex: number;
}

interface PhotoZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: string;
  opacity?: number;
  zIndex: number;
}

interface CoverTemplate {
  id: string;
  name: string;
  category: string;
  bgColor: string;
  bgGradient?: string;
  textBlocks: TextBlock[];
  photoZones: PhotoZone[];
  decorativeElements?: Array<{
    type: 'circle' | 'rect' | 'line';
    x: number;
    y: number;
    width?: number;
    height?: number;
    radius?: number;
    color: string;
    opacity?: number;
    zIndex: number;
  }>;
}

interface PhotoAlbumState {
  selectedTemplate: string;
  textValues: Record<string, string>;
  uploadedPhoto: string | null;
}

interface Format {
  label: string;
  canvasW: number;
  canvasH: number;
}

// Formats
const FORMATS: Record<string, Format> = {
  '20x20': { label: '20×20', canvasW: 560, canvasH: 560 },
  '25x25': { label: '25×25', canvasW: 560, canvasH: 560 },
  '20x30': { label: '20×30', canvasW: 420, canvasH: 560 },
  '30x30': { label: '30×30', canvasW: 560, canvasH: 560 },
};

// Cover Templates
const TEMPLATES: CoverTemplate[] = [
  // Family Group
  {
    id: 'family-warm',
    name: 'Тепла Сім\'я',
    category: 'Сімейні',
    bgColor: '#f5f1ea',
    bgGradient: 'linear-gradient(135deg, #f5f1ea 0%, #e8dcc8 100%)',
    textBlocks: [
      {
        id: 'title',
        text: 'Our Family',
        x: 10,
        y: 15,
        width: 80,
        height: 15,
        fontSize: 48,
        fontFamily: 'Playfair Display',
        fontWeight: 700,
        color: '#4a3828',
        textAlign: 'center',
        zIndex: 20,
      },
      {
        id: 'subtitle',
        text: 'Memories Together',
        x: 10,
        y: 32,
        width: 80,
        height: 8,
        fontSize: 18,
        fontFamily: 'Montserrat',
        fontWeight: 400,
        color: '#7a6855',
        textAlign: 'center',
        zIndex: 20,
      },
    ],
    photoZones: [
      {
        id: 'photo1',
        x: 15,
        y: 45,
        width: 70,
        height: 45,
        borderRadius: '8px',
        zIndex: 10,
      },
    ],
    decorativeElements: [],
  },
  {
    id: 'family-minimal',
    name: 'Мінімалістична Сім\'я',
    category: 'Сімейні',
    bgColor: '#ffffff',
    textBlocks: [
      {
        id: 'title',
        text: 'Family',
        x: 10,
        y: 35,
        width: 80,
        height: 15,
        fontSize: 56,
        fontFamily: 'Montserrat',
        fontWeight: 300,
        color: '#1a1a1a',
        textAlign: 'center',
        zIndex: 20,
      },
      {
        id: 'year',
        text: '2026',
        x: 10,
        y: 52,
        width: 80,
        height: 8,
        fontSize: 20,
        fontFamily: 'Montserrat',
        fontWeight: 400,
        color: '#666666',
        textAlign: 'center',
        zIndex: 20,
      },
    ],
    photoZones: [
      {
        id: 'photo1',
        x: 65,
        y: 8,
        width: 30,
        height: 22,
        borderRadius: '4px',
        zIndex: 10,
      },
    ],
    decorativeElements: [],
  },
  {
    id: 'family-dark-photo',
    name: 'Темна з Фото',
    category: 'Сімейні',
    bgColor: '#2a2a2a',
    textBlocks: [
      {
        id: 'title',
        text: 'Our Story',
        x: 10,
        y: 40,
        width: 80,
        height: 20,
        fontSize: 64,
        fontFamily: 'Playfair Display',
        fontWeight: 700,
        color: '#ffffff',
        textAlign: 'center',
        zIndex: 30,
      },
    ],
    photoZones: [
      {
        id: 'photo1',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        opacity: 0.4,
        zIndex: 5,
      },
    ],
    decorativeElements: [
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        color: '#000000',
        opacity: 0.3,
        zIndex: 10,
      },
    ],
  },
  {
    id: 'family-split',
    name: 'Розділена Сім\'я',
    category: 'Сімейні',
    bgColor: '#ffffff',
    textBlocks: [
      {
        id: 'title',
        text: 'Family Album',
        x: 5,
        y: 35,
        width: 35,
        height: 30,
        fontSize: 52,
        fontFamily: 'Cormorant Garamond',
        fontWeight: 600,
        color: '#9d174d',
        textAlign: 'center',
        zIndex: 20,
      },
    ],
    photoZones: [
      {
        id: 'photo1',
        x: 40,
        y: 0,
        width: 60,
        height: 100,
        zIndex: 10,
      },
    ],
    decorativeElements: [
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: 40,
        height: 100,
        color: '#fdf2f8',
        zIndex: 5,
      },
    ],
  },

  // Children Group
  {
    id: 'kids-pastel',
    name: 'Пастельні Моменти',
    category: 'Дитячі',
    bgColor: '#fef9e7',
    textBlocks: [
      {
        id: 'title',
        text: 'Little Moments',
        x: 10,
        y: 12,
        width: 80,
        height: 12,
        fontSize: 56,
        fontFamily: 'Great Vibes',
        fontWeight: 400,
        color: '#d97706',
        textAlign: 'center',
        zIndex: 20,
      },
      {
        id: 'name',
        text: 'Name',
        x: 10,
        y: 75,
        width: 80,
        height: 8,
        fontSize: 24,
        fontFamily: 'Montserrat',
        fontWeight: 400,
        color: '#92400e',
        textAlign: 'center',
        zIndex: 20,
      },
    ],
    photoZones: [
      {
        id: 'photo1',
        x: 25,
        y: 30,
        width: 50,
        height: 50,
        borderRadius: '50%',
        zIndex: 10,
      },
    ],
    decorativeElements: [],
  },
  {
    id: 'kids-circle',
    name: 'Коло Зростання',
    category: 'Дитячі',
    bgColor: '#ffffff',
    textBlocks: [
      {
        id: 'title',
        text: 'Growing Up',
        x: 10,
        y: 8,
        width: 80,
        height: 10,
        fontSize: 44,
        fontFamily: 'Raleway',
        fontWeight: 400,
        color: '#1e293b',
        textAlign: 'center',
        zIndex: 20,
      },
    ],
    photoZones: [
      {
        id: 'photo1',
        x: 20,
        y: 25,
        width: 60,
        height: 60,
        borderRadius: '50%',
        zIndex: 10,
      },
    ],
    decorativeElements: [
      {
        type: 'circle',
        x: 10,
        y: 15,
        radius: 4,
        color: '#fbbf24',
        opacity: 0.6,
        zIndex: 5,
      },
      {
        type: 'circle',
        x: 85,
        y: 20,
        radius: 6,
        color: '#60a5fa',
        opacity: 0.5,
        zIndex: 5,
      },
      {
        type: 'circle',
        x: 15,
        y: 85,
        radius: 5,
        color: '#f472b6',
        opacity: 0.5,
        zIndex: 5,
      },
      {
        type: 'circle',
        x: 82,
        y: 78,
        radius: 7,
        color: '#a78bfa',
        opacity: 0.4,
        zIndex: 5,
      },
    ],
  },
  {
    id: 'kids-dark-fun',
    name: 'Темні Пригоди',
    category: 'Дитячі',
    bgColor: '#1e3a8a',
    textBlocks: [
      {
        id: 'title',
        text: 'Childhood Adventures',
        x: 10,
        y: 15,
        width: 80,
        height: 12,
        fontSize: 40,
        fontFamily: 'Montserrat',
        fontWeight: 600,
        color: '#ffffff',
        textAlign: 'center',
        zIndex: 20,
      },
      {
        id: 'name',
        text: 'Name',
        x: 10,
        y: 75,
        width: 80,
        height: 10,
        fontSize: 32,
        fontFamily: 'Playfair Display',
        fontWeight: 400,
        color: '#fbbf24',
        textAlign: 'center',
        zIndex: 20,
      },
    ],
    photoZones: [
      {
        id: 'photo1',
        x: 17.5,
        y: 32,
        width: 65,
        height: 38,
        borderRadius: '12px',
        zIndex: 10,
      },
    ],
    decorativeElements: [],
  },
  {
    id: 'kids-minimal',
    name: 'Мінімалістична Історія',
    category: 'Дитячі',
    bgColor: '#fafaf9',
    textBlocks: [
      {
        id: 'title',
        text: 'My Story',
        x: 10,
        y: 25,
        width: 80,
        height: 15,
        fontSize: 48,
        fontFamily: 'EB Garamond',
        fontWeight: 400,
        color: '#374151',
        textAlign: 'center',
        zIndex: 20,
      },
    ],
    photoZones: [
      {
        id: 'photo1',
        x: 10,
        y: 65,
        width: 35,
        height: 30,
        borderRadius: '4px',
        zIndex: 10,
      },
    ],
    decorativeElements: [],
  },

  // Wedding/Romance Group
  {
    id: 'wedding-album-soft',
    name: 'М\'яке Весілля',
    category: 'Весілля',
    bgColor: '#fdf2f8',
    bgGradient: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
    textBlocks: [
      {
        id: 'title',
        text: 'Our Wedding',
        x: 10,
        y: 12,
        width: 80,
        height: 12,
        fontSize: 52,
        fontFamily: 'Playfair Display',
        fontWeight: 400,
        fontStyle: 'italic',
        color: '#9f1239',
        textAlign: 'center',
        zIndex: 20,
      },
      {
        id: 'date',
        text: 'Date',
        x: 10,
        y: 75,
        width: 80,
        height: 8,
        fontSize: 20,
        fontFamily: 'Cormorant Garamond',
        fontWeight: 400,
        color: '#be123c',
        textAlign: 'center',
        zIndex: 20,
      },
    ],
    photoZones: [
      {
        id: 'photo1',
        x: 22.5,
        y: 30,
        width: 55,
        height: 40,
        borderRadius: '8px',
        zIndex: 10,
      },
    ],
    decorativeElements: [],
  },
  {
    id: 'wedding-album-dark',
    name: 'Темне Весілля',
    category: 'Весілля',
    bgColor: '#881337',
    textBlocks: [
      {
        id: 'title',
        text: 'Forever',
        x: 10,
        y: 15,
        width: 80,
        height: 15,
        fontSize: 64,
        fontFamily: 'Great Vibes',
        fontWeight: 400,
        color: '#fbbf24',
        textAlign: 'center',
        zIndex: 20,
      },
      {
        id: 'subtitle',
        text: 'Names & Date',
        x: 10,
        y: 72,
        width: 80,
        height: 8,
        fontSize: 22,
        fontFamily: 'EB Garamond',
        fontWeight: 400,
        color: '#fef3c7',
        textAlign: 'center',
        zIndex: 20,
      },
    ],
    photoZones: [
      {
        id: 'photo1',
        x: 20,
        y: 35,
        width: 60,
        height: 32,
        borderRadius: '6px',
        zIndex: 10,
      },
    ],
    decorativeElements: [],
  },
  {
    id: 'wedding-album-gold',
    name: 'Золоте Весілля',
    category: 'Весілля',
    bgColor: '#faf8f3',
    textBlocks: [
      {
        id: 'title',
        text: 'Wedding Album',
        x: 10,
        y: 25,
        width: 80,
        height: 12,
        fontSize: 48,
        fontFamily: 'Playfair Display',
        fontWeight: 700,
        color: '#92400e',
        textAlign: 'center',
        zIndex: 20,
      },
    ],
    photoZones: [
      {
        id: 'photo1',
        x: 25,
        y: 45,
        width: 50,
        height: 40,
        borderRadius: '4px',
        zIndex: 10,
      },
    ],
    decorativeElements: [
      {
        type: 'rect',
        x: 8,
        y: 8,
        width: 84,
        height: 0.5,
        color: '#d97706',
        zIndex: 5,
      },
      {
        type: 'rect',
        x: 8,
        y: 91.5,
        width: 84,
        height: 0.5,
        color: '#d97706',
        zIndex: 5,
      },
      {
        type: 'rect',
        x: 8,
        y: 8,
        width: 0.5,
        height: 84,
        color: '#d97706',
        zIndex: 5,
      },
      {
        type: 'rect',
        x: 91.5,
        y: 8,
        width: 0.5,
        height: 84,
        color: '#d97706',
        zIndex: 5,
      },
    ],
  },
  {
    id: 'anniversary',
    name: 'Річниця',
    category: 'Весілля',
    bgColor: '#f9fafb',
    textBlocks: [
      {
        id: 'title',
        text: 'Years Together',
        x: 10,
        y: 20,
        width: 80,
        height: 12,
        fontSize: 42,
        fontFamily: 'Lora',
        fontWeight: 400,
        fontStyle: 'italic',
        color: '#1f2937',
        textAlign: 'center',
        zIndex: 20,
      },
      {
        id: 'names',
        text: 'Names',
        x: 10,
        y: 70,
        width: 80,
        height: 8,
        fontSize: 24,
        fontFamily: 'Montserrat',
        fontWeight: 400,
        color: '#4b5563',
        textAlign: 'center',
        zIndex: 20,
      },
    ],
    photoZones: [
      {
        id: 'photo1',
        x: 15,
        y: 38,
        width: 70,
        height: 25,
        borderRadius: '6px',
        zIndex: 10,
      },
    ],
    decorativeElements: [],
  },

  // Minimal/Editorial Group
  {
    id: 'editorial-light',
    name: 'Світлий Редакційний',
    category: 'Мінімалізм',
    bgColor: '#ffffff',
    textBlocks: [
      {
        id: 'title',
        text: 'Photo Album',
        x: 10,
        y: 35,
        width: 80,
        height: 15,
        fontSize: 60,
        fontFamily: 'Raleway',
        fontWeight: 300,
        color: '#0f172a',
        textAlign: 'center',
        zIndex: 20,
      },
    ],
    photoZones: [
      {
        id: 'photo1',
        x: 65,
        y: 68,
        width: 30,
        height: 28,
        borderRadius: '4px',
        zIndex: 10,
      },
    ],
    decorativeElements: [
      {
        type: 'rect',
        x: 15,
        y: 52,
        width: 70,
        height: 0.4,
        color: '#d97706',
        zIndex: 15,
      },
    ],
  },
  {
    id: 'editorial-dark',
    name: 'Темний Редакційний',
    category: 'Мінімалізм',
    bgColor: '#0a0a0a',
    textBlocks: [
      {
        id: 'title',
        text: 'Album',
        x: 10,
        y: 38,
        width: 80,
        height: 18,
        fontSize: 72,
        fontFamily: 'Raleway',
        fontWeight: 300,
        color: '#ffffff',
        textAlign: 'center',
        zIndex: 20,
      },
      {
        id: 'year',
        text: 'Year',
        x: 10,
        y: 58,
        width: 80,
        height: 8,
        fontSize: 18,
        fontFamily: 'Raleway',
        fontWeight: 300,
        color: '#9ca3af',
        textAlign: 'center',
        zIndex: 20,
      },
    ],
    photoZones: [
      {
        id: 'photo1',
        x: 10,
        y: 10,
        width: 45,
        height: 25,
        borderRadius: '4px',
        zIndex: 10,
      },
    ],
    decorativeElements: [],
  },
  {
    id: 'minimal-type',
    name: 'Чиста Типографіка',
    category: 'Мінімалізм',
    bgColor: '#f8fafc',
    textBlocks: [
      {
        id: 'title',
        text: 'ALBUM',
        x: 10,
        y: 40,
        width: 80,
        height: 20,
        fontSize: 80,
        fontFamily: 'Montserrat',
        fontWeight: 700,
        color: '#1e293b',
        textAlign: 'center',
        zIndex: 20,
      },
    ],
    photoZones: [],
    decorativeElements: [],
  },
  {
    id: 'bold-contrast',
    name: 'Жирний Контраст',
    category: 'Мінімалізм',
    bgColor: '#000000',
    textBlocks: [
      {
        id: 'title',
        text: 'PHOTO\nALBUM',
        x: 10,
        y: 38,
        width: 80,
        height: 24,
        fontSize: 56,
        fontFamily: 'Raleway',
        fontWeight: 700,
        color: '#ffffff',
        textAlign: 'center',
        zIndex: 20,
      },
    ],
    photoZones: [
      {
        id: 'photo1',
        x: 30,
        y: 30,
        width: 40,
        height: 40,
        borderRadius: '8px',
        zIndex: 10,
      },
    ],
    decorativeElements: [
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: 50,
        height: 100,
        color: '#000000',
        zIndex: 5,
      },
      {
        type: 'rect',
        x: 50,
        y: 0,
        width: 50,
        height: 100,
        color: '#ffffff',
        zIndex: 5,
      },
    ],
  },
];

export default function PhotoAlbumConstructor() {
  const router = useRouter();
  const [selectedFormat, setSelectedFormat] = useState<string>('20x20');
  const [state, setState] = useState<PhotoAlbumState>({
    selectedTemplate: TEMPLATES[0].id,
    textValues: {},
    uploadedPhoto: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFormat = FORMATS[selectedFormat];
  const selectedTemplateObj = TEMPLATES.find(t => t.id === state.selectedTemplate) || TEMPLATES[0];

  // Photo upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setState(prev => ({ ...prev, uploadedPhoto: url }));
    }
  };

  // Template selection
  const handleTemplateSelect = (templateId: string) => {
    setState(prev => ({ ...prev, selectedTemplate: templateId, textValues: {}, uploadedPhoto: null }));
  };

  // Text editing
  const handleTextChange = (blockId: string, value: string) => {
    setState(prev => ({
      ...prev,
      textValues: { ...prev.textValues, [blockId]: value },
    }));
  };

  // Continue to photobook
  const handleContinue = () => {
    const config = {
      productType: 'photobook',
      coverTemplate: state.selectedTemplate,
      format: selectedFormat,
      coverTextValues: state.textValues,
      hasPhoto: !!state.uploadedPhoto,
    };
    sessionStorage.setItem('constructorConfig', JSON.stringify(config));
    router.push('/constructor/photobook');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <GoogleFontsStyle />

      {/* Top Bar */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <h1 className="text-xl font-bold text-gray-900">Конструктор Фотоальбому</h1>
        <button
          onClick={() => router.push('/catalog')}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Закрити
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Templates */}
        <div className="w-[260px] bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Оберіть шаблон</h2>
            <div className="space-y-2">
              {TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className={`w-full p-2 rounded border text-left ${
                    state.selectedTemplate === template.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-xs font-medium text-gray-900">{template.name}</div>
                  <div className="text-xs text-gray-500">{template.category}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
          <div
            className="relative bg-white shadow-2xl"
            style={{
              width: `${currentFormat.canvasW}px`,
              height: `${currentFormat.canvasH}px`,
            }}
          >
            {/* Render template background */}
            <div
              className="absolute inset-0"
              style={{
                background: selectedTemplateObj.bgGradient || selectedTemplateObj.bgColor,
              }}
            />

            {/* Render decorative elements */}
            {selectedTemplateObj.decorativeElements?.map((el, idx) => (
              <div
                key={idx}
                className="absolute"
                style={{
                  left: `${el.x}%`,
                  top: `${el.y}%`,
                  width: el.width ? `${el.width}%` : el.radius ? `${el.radius}%` : undefined,
                  height: el.height ? `${el.height}%` : el.radius ? `${el.radius}%` : undefined,
                  backgroundColor: el.color,
                  opacity: el.opacity || 1,
                  zIndex: el.zIndex,
                  borderRadius: el.type === 'circle' ? '50%' : undefined,
                }}
              />
            ))}

            {/* Render photo zones */}
            {selectedTemplateObj.photoZones.map(zone => (
              <div
                key={zone.id}
                className="absolute"
                style={{
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                  borderRadius: zone.borderRadius || '0',
                  opacity: zone.opacity || 1,
                  zIndex: zone.zIndex,
                  overflow: 'hidden',
                  backgroundColor: state.uploadedPhoto ? 'transparent' : 'rgba(0,0,0,0.05)',
                  border: state.uploadedPhoto ? 'none' : '2px dashed rgba(0,0,0,0.2)',
                }}
              >
                {state.uploadedPhoto && (
                  <img
                    src={state.uploadedPhoto}
                    alt="Uploaded"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            ))}

            {/* Render text blocks */}
            {selectedTemplateObj.textBlocks.map(block => (
              <div
                key={block.id}
                className="absolute"
                style={{
                  left: `${block.x}%`,
                  top: `${block.y}%`,
                  width: `${block.width}%`,
                  height: `${block.height}%`,
                  zIndex: block.zIndex,
                }}
              >
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTextChange(block.id, e.currentTarget.textContent || '')}
                  className="w-full h-full outline-none cursor-text whitespace-pre-wrap"
                  style={{
                    fontSize: `${block.fontSize}px`,
                    fontFamily: block.fontFamily,
                    fontWeight: block.fontWeight,
                    fontStyle: block.fontStyle || 'normal',
                    color: block.color,
                    textAlign: block.textAlign,
                  }}
                >
                  {state.textValues[block.id] || block.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Format + Controls */}
        <div className="w-[280px] bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Format Selector */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Формат</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(FORMATS).map(([key, fmt]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedFormat(key)}
                    className={`px-3 py-2 rounded border text-sm font-medium ${
                      selectedFormat === key
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Photo Upload */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Фото</h3>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <Upload size={16} />
                {state.uploadedPhoto ? 'Замінити фото' : 'Завантажити фото'}
              </button>
            </div>

            {/* Continue Button */}
            <button
              onClick={handleContinue}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700"
            >
              Продовжити до фотокниги →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
