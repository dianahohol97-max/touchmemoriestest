'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { ArrowLeft, Upload, Check, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Google Fonts embedded
const GoogleFontsStyle = () => (
  <style jsx global>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;400i;700&family=Cormorant+Garamond:wght@300;300i;400;400i;600&family=Great+Vibes&family=Montserrat:wght@300;400;600&family=EB+Garamond:wght@400;400i&display=swap');
  `}</style>
);

// ============================================================================
// TYPESCRIPT INTERFACES
// ============================================================================

interface TextBlock {
  id: string;
  label: string;
  content: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: 'left' | 'center' | 'right';
  letterSpacing?: number;
  fontWeight?: number;
  italic?: boolean;
}

interface PhotoZone {
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
  borderRadius?: number;
}

interface CoverTemplate {
  id: string;
  name: string;
  category: 'wedding' | 'birthday' | 'baby' | 'corporate';
  bgColor: string;
  textBlocks: TextBlock[];
  photoZone?: PhotoZone;
  hasDecorations?: boolean;
}

interface CanvasState {
  selectedTemplate: string;
  textValues: Record<string, string>;
  uploadedPhoto: string | null;
  bgColor: string;
}

// ============================================================================
// TEMPLATE DATA - ALL 16 TEMPLATES
// ============================================================================

const COVER_TEMPLATES: CoverTemplate[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // GROUP 1: ВЕСІЛЛЯ (Wedding) - 5 templates
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'wedding-classic',
    name: 'Класична весільна',
    category: 'wedding',
    bgColor: '#faf8f5',
    hasDecorations: true,
    textBlocks: [
      {
        id: 'couple',
        label: 'Імена молодих',
        content: 'Марія & Олександр',
        x: 50,
        y: 280,
        width: 460,
        fontSize: 56,
        fontFamily: 'Great Vibes',
        color: '#3d3631',
        align: 'center',
        letterSpacing: 2
      },
      {
        id: 'date',
        label: 'Дата весілля',
        content: '15 Червня 2024',
        x: 50,
        y: 380,
        width: 460,
        fontSize: 20,
        fontFamily: 'Cormorant Garamond',
        color: '#6b6157',
        align: 'center',
        letterSpacing: 3,
        fontWeight: 300
      },
      {
        id: 'wishes',
        label: 'Заголовок',
        content: 'Книга побажань',
        x: 50,
        y: 520,
        width: 460,
        fontSize: 18,
        fontFamily: 'Cormorant Garamond',
        color: '#6b6157',
        align: 'center',
        letterSpacing: 6,
        fontWeight: 300,
        italic: true
      }
    ]
  },
  {
    id: 'wedding-floral',
    name: 'Весільна з орнаментом',
    category: 'wedding',
    bgColor: '#f5f0eb',
    hasDecorations: true,
    textBlocks: [
      {
        id: 'title',
        label: 'Заголовок',
        content: 'Наше весілля',
        x: 50,
        y: 240,
        width: 460,
        fontSize: 22,
        fontFamily: 'Cormorant Garamond',
        color: '#8b7355',
        align: 'center',
        letterSpacing: 4,
        italic: true
      },
      {
        id: 'couple',
        label: 'Імена молодих',
        content: 'Анна & Дмитро',
        x: 50,
        y: 340,
        width: 460,
        fontSize: 48,
        fontFamily: 'Cormorant Garamond',
        color: '#3d3631',
        align: 'center',
        letterSpacing: 2,
        italic: true,
        fontWeight: 400
      },
      {
        id: 'date',
        label: 'Дата',
        content: '22.08.2024',
        x: 50,
        y: 430,
        width: 460,
        fontSize: 20,
        fontFamily: 'Cormorant Garamond',
        color: '#8b7355',
        align: 'center',
        letterSpacing: 3,
        fontWeight: 300
      },
      {
        id: 'subtitle',
        label: 'Підзаголовок',
        content: 'Ваші побажання',
        x: 50,
        y: 540,
        width: 460,
        fontSize: 16,
        fontFamily: 'Cormorant Garamond',
        color: '#8b7355',
        align: 'center',
        letterSpacing: 5,
        italic: true
      }
    ]
  },
  {
    id: 'wedding-dark',
    name: 'Темна весільна з фото',
    category: 'wedding',
    bgColor: '#1e1a17',
    photoZone: { x: 0, y: 0, w: 100, h: 100, opacity: 0.45 },
    textBlocks: [
      {
        id: 'couple',
        label: 'Імена молодих',
        content: 'Софія & Максим',
        x: 50,
        y: 320,
        width: 460,
        fontSize: 62,
        fontFamily: 'Great Vibes',
        color: '#d4af37',
        align: 'center',
        letterSpacing: 2
      },
      {
        id: 'date',
        label: 'Дата',
        content: '12 Вересня 2024',
        x: 50,
        y: 430,
        width: 460,
        fontSize: 18,
        fontFamily: 'Cormorant Garamond',
        color: '#f5f5dc',
        align: 'center',
        letterSpacing: 4,
        fontWeight: 300
      },
      {
        id: 'wishes',
        label: 'Текст',
        content: 'Книга побажань гостей',
        x: 50,
        y: 580,
        width: 460,
        fontSize: 16,
        fontFamily: 'Cormorant Garamond',
        color: '#d4af37',
        align: 'center',
        letterSpacing: 5,
        italic: true
      }
    ]
  },
  {
    id: 'wedding-gold',
    name: 'Золота весільна',
    category: 'wedding',
    bgColor: '#0d0b08',
    hasDecorations: true,
    textBlocks: [
      {
        id: 'couple',
        label: 'Імена',
        content: 'Олена & Ігор',
        x: 50,
        y: 300,
        width: 460,
        fontSize: 54,
        fontFamily: 'Cormorant Garamond',
        color: '#d4af37',
        align: 'center',
        letterSpacing: 3,
        fontWeight: 400
      },
      {
        id: 'date',
        label: 'Дата',
        content: '05.10.2024',
        x: 50,
        y: 400,
        width: 460,
        fontSize: 22,
        fontFamily: 'Cormorant Garamond',
        color: '#c9a961',
        align: 'center',
        letterSpacing: 4,
        fontWeight: 300
      },
      {
        id: 'subtitle',
        label: 'Підпис',
        content: 'Гостьова книга',
        x: 50,
        y: 520,
        width: 460,
        fontSize: 16,
        fontFamily: 'Cormorant Garamond',
        color: '#8b7355',
        align: 'center',
        letterSpacing: 6,
        italic: true
      }
    ]
  },
  {
    id: 'wedding-photo-soft',
    name: 'М\'яка з фото зверху',
    category: 'wedding',
    bgColor: '#f0ebe4',
    photoZone: { x: 5, y: 5, w: 90, h: 60 },
    textBlocks: [
      {
        id: 'couple',
        label: 'Імена',
        content: 'Катерина & Андрій',
        x: 50,
        y: 560,
        width: 460,
        fontSize: 52,
        fontFamily: 'Great Vibes',
        color: '#3d3631',
        align: 'center',
        letterSpacing: 2
      },
      {
        id: 'date',
        label: 'Дата',
        content: '18.07.2024',
        x: 50,
        y: 650,
        width: 460,
        fontSize: 18,
        fontFamily: 'Cormorant Garamond',
        color: '#6b6157',
        align: 'center',
        letterSpacing: 4,
        fontWeight: 300
      }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────────
  // GROUP 2: ДНІ НАРОДЖЕННЯ (Birthday) - 4 templates
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'birthday-elegant',
    name: 'Елегантна',
    category: 'birthday',
    bgColor: '#fdfcfa',
    textBlocks: [
      {
        id: 'name',
        label: 'Ім\'я іменинника',
        content: 'Марина',
        x: 50,
        y: 280,
        width: 460,
        fontSize: 72,
        fontFamily: 'Cormorant Garamond',
        color: '#2d2520',
        align: 'center',
        letterSpacing: 1,
        italic: true,
        fontWeight: 400
      },
      {
        id: 'age',
        label: 'Вік',
        content: '30',
        x: 50,
        y: 400,
        width: 460,
        fontSize: 48,
        fontFamily: 'Cormorant Garamond',
        color: '#8b6f47',
        align: 'center',
        letterSpacing: 2,
        fontWeight: 300
      },
      {
        id: 'subtitle',
        label: 'Підзаголовок',
        content: 'Книга побажань',
        x: 50,
        y: 520,
        width: 460,
        fontSize: 18,
        fontFamily: 'Cormorant Garamond',
        color: '#a0896d',
        align: 'center',
        letterSpacing: 5,
        italic: true
      }
    ]
  },
  {
    id: 'birthday-photo',
    name: 'З фото в центрі',
    category: 'birthday',
    bgColor: '#2a2622',
    photoZone: { x: 10, y: 12, w: 80, h: 52 },
    textBlocks: [
      {
        id: 'name',
        label: 'Ім\'я',
        content: 'Олексій',
        x: 50,
        y: 580,
        width: 460,
        fontSize: 56,
        fontFamily: 'Great Vibes',
        color: '#f5e6d3',
        align: 'center',
        letterSpacing: 2
      },
      {
        id: 'age',
        label: 'Вік',
        content: '40 років',
        x: 50,
        y: 680,
        width: 460,
        fontSize: 20,
        fontFamily: 'Cormorant Garamond',
        color: '#d4c5b0',
        align: 'center',
        letterSpacing: 4,
        fontWeight: 300
      }
    ]
  },
  {
    id: 'birthday-pastel',
    name: 'Пастельна з круглим фото',
    category: 'birthday',
    bgColor: '#e8d5f2',
    photoZone: { x: 25, y: 15, w: 50, h: 50, borderRadius: 50 },
    textBlocks: [
      {
        id: 'name',
        label: 'Ім\'я',
        content: 'Дарина',
        x: 50,
        y: 560,
        width: 460,
        fontSize: 48,
        fontFamily: 'Great Vibes',
        color: '#4a2c5e',
        align: 'center',
        letterSpacing: 2
      },
      {
        id: 'age',
        label: 'Вік',
        content: '25',
        x: 50,
        y: 640,
        width: 460,
        fontSize: 32,
        fontFamily: 'Cormorant Garamond',
        color: '#6b4d7a',
        align: 'center',
        letterSpacing: 3,
        fontWeight: 600
      },
      {
        id: 'wishes',
        label: 'Побажання',
        content: 'Ваші побажання',
        x: 50,
        y: 720,
        width: 460,
        fontSize: 16,
        fontFamily: 'Cormorant Garamond',
        color: '#8b6d9b',
        align: 'center',
        letterSpacing: 4,
        italic: true
      }
    ]
  },
  {
    id: 'birthday-bold',
    name: 'Сміливий дизайн',
    category: 'birthday',
    bgColor: '#1a1614',
    photoZone: { x: 0, y: 0, w: 100, h: 100, opacity: 0.3 },
    textBlocks: [
      {
        id: 'age-bg',
        label: 'Вік (великий)',
        content: '50',
        x: 50,
        y: 200,
        width: 460,
        fontSize: 160,
        fontFamily: 'Montserrat',
        color: '#ffffff',
        align: 'center',
        letterSpacing: -2,
        fontWeight: 600
      },
      {
        id: 'name',
        label: 'Ім\'я',
        content: 'Петро',
        x: 50,
        y: 480,
        width: 460,
        fontSize: 44,
        fontFamily: 'Montserrat',
        color: '#ffffff',
        align: 'center',
        letterSpacing: 2,
        fontWeight: 400
      },
      {
        id: 'subtitle',
        label: 'Текст',
        content: 'років радості',
        x: 50,
        y: 560,
        width: 460,
        fontSize: 18,
        fontFamily: 'Montserrat',
        color: '#cccccc',
        align: 'center',
        letterSpacing: 4,
        fontWeight: 300
      }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────────
  // GROUP 3: ХРЕСТИНИ (Baby/Christening) - 3 templates
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'baby-soft',
    name: 'Ніжна дитяча',
    category: 'baby',
    bgColor: '#f5f8fc',
    photoZone: { x: 10, y: 8, w: 80, h: 45 },
    textBlocks: [
      {
        id: 'name',
        label: 'Ім\'я дитини',
        content: 'Софійка',
        x: 50,
        y: 480,
        width: 460,
        fontSize: 52,
        fontFamily: 'Great Vibes',
        color: '#5a7ba6',
        align: 'center',
        letterSpacing: 2
      },
      {
        id: 'event',
        label: 'Подія',
        content: 'Хрестини',
        x: 50,
        y: 570,
        width: 460,
        fontSize: 20,
        fontFamily: 'Cormorant Garamond',
        color: '#7a93b8',
        align: 'center',
        letterSpacing: 4,
        fontWeight: 300,
        italic: true
      },
      {
        id: 'date',
        label: 'Дата',
        content: '12.05.2024',
        x: 50,
        y: 630,
        width: 460,
        fontSize: 18,
        fontFamily: 'Cormorant Garamond',
        color: '#a0b3cd',
        align: 'center',
        letterSpacing: 3
      }
    ]
  },
  {
    id: 'baby-minimal',
    name: 'Мінімалістична',
    category: 'baby',
    bgColor: '#f9f6f1',
    textBlocks: [
      {
        id: 'name',
        label: 'Ім\'я',
        content: 'Максимко',
        x: 50,
        y: 280,
        width: 460,
        fontSize: 64,
        fontFamily: 'Cormorant Garamond',
        color: '#4a4035',
        align: 'center',
        letterSpacing: 2,
        italic: true,
        fontWeight: 400
      },
      {
        id: 'event',
        label: 'Подія',
        content: 'Перший рік',
        x: 50,
        y: 400,
        width: 460,
        fontSize: 24,
        fontFamily: 'Cormorant Garamond',
        color: '#8b7d6a',
        align: 'center',
        letterSpacing: 3,
        fontWeight: 300
      },
      {
        id: 'subtitle',
        label: 'Підпис',
        content: 'Побажання від гостей',
        x: 50,
        y: 520,
        width: 460,
        fontSize: 16,
        fontFamily: 'Cormorant Garamond',
        color: '#a89f8e',
        align: 'center',
        letterSpacing: 5,
        italic: true
      }
    ]
  },
  {
    id: 'baby-stars',
    name: 'Зоряна',
    category: 'baby',
    bgColor: '#1f2937',
    hasDecorations: true,
    textBlocks: [
      {
        id: 'name',
        label: 'Ім\'я',
        content: 'Марійка',
        x: 50,
        y: 300,
        width: 460,
        fontSize: 56,
        fontFamily: 'Great Vibes',
        color: '#ffd700',
        align: 'center',
        letterSpacing: 2
      },
      {
        id: 'event',
        label: 'Подія',
        content: 'Хрестини',
        x: 50,
        y: 400,
        width: 460,
        fontSize: 22,
        fontFamily: 'Cormorant Garamond',
        color: '#e8d4a0',
        align: 'center',
        letterSpacing: 4,
        fontWeight: 300
      },
      {
        id: 'date',
        label: 'Дата',
        content: '20.06.2024',
        x: 50,
        y: 500,
        width: 460,
        fontSize: 18,
        fontFamily: 'Cormorant Garamond',
        color: '#c4b68a',
        align: 'center',
        letterSpacing: 3
      }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────────
  // GROUP 4: КОРПОРАТИВ (Corporate/Universal) - 4 templates
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'corp-minimal',
    name: 'Корпоративна мінімал',
    category: 'corporate',
    bgColor: '#f8f9fa',
    textBlocks: [
      {
        id: 'company',
        label: 'Назва компанії',
        content: 'TECH CORP',
        x: 50,
        y: 280,
        width: 460,
        fontSize: 42,
        fontFamily: 'Montserrat',
        color: '#1f2937',
        align: 'center',
        letterSpacing: 6,
        fontWeight: 600
      },
      {
        id: 'event',
        label: 'Подія',
        content: 'Річниця компанії',
        x: 50,
        y: 380,
        width: 460,
        fontSize: 22,
        fontFamily: 'Montserrat',
        color: '#6b7280',
        align: 'center',
        letterSpacing: 2,
        fontWeight: 300
      },
      {
        id: 'year',
        label: 'Рік',
        content: '2024',
        x: 50,
        y: 460,
        width: 460,
        fontSize: 48,
        fontFamily: 'Montserrat',
        color: '#374151',
        align: 'center',
        letterSpacing: 4,
        fontWeight: 400
      },
      {
        id: 'subtitle',
        label: 'Підпис',
        content: 'Гостьова книга',
        x: 50,
        y: 600,
        width: 460,
        fontSize: 14,
        fontFamily: 'Montserrat',
        color: '#9ca3af',
        align: 'center',
        letterSpacing: 6,
        fontWeight: 300
      }
    ]
  },
  {
    id: 'corp-dark',
    name: 'Темна корпоративна',
    category: 'corporate',
    bgColor: '#111827',
    photoZone: { x: 0, y: 0, w: 100, h: 100, opacity: 0.25 },
    textBlocks: [
      {
        id: 'company',
        label: 'Компанія',
        content: 'INNOVATION LAB',
        x: 50,
        y: 320,
        width: 460,
        fontSize: 38,
        fontFamily: 'Montserrat',
        color: '#ffffff',
        align: 'center',
        letterSpacing: 8,
        fontWeight: 600
      },
      {
        id: 'event',
        label: 'Подія',
        content: 'Корпоративна вечірка',
        x: 50,
        y: 420,
        width: 460,
        fontSize: 20,
        fontFamily: 'Montserrat',
        color: '#d1d5db',
        align: 'center',
        letterSpacing: 3,
        fontWeight: 300
      },
      {
        id: 'date',
        label: 'Дата',
        content: '15.12.2024',
        x: 50,
        y: 500,
        width: 460,
        fontSize: 18,
        fontFamily: 'Montserrat',
        color: '#9ca3af',
        align: 'center',
        letterSpacing: 4
      }
    ]
  },
  {
    id: 'universal-light',
    name: 'Універсальна світла',
    category: 'corporate',
    bgColor: '#ffffff',
    photoZone: { x: 8, y: 8, w: 84, h: 55 },
    textBlocks: [
      {
        id: 'title',
        label: 'Заголовок',
        content: 'Святкування',
        x: 50,
        y: 560,
        width: 460,
        fontSize: 46,
        fontFamily: 'Cormorant Garamond',
        color: '#1f2937',
        align: 'center',
        letterSpacing: 2,
        fontWeight: 400
      },
      {
        id: 'date',
        label: 'Дата',
        content: '2024',
        x: 50,
        y: 650,
        width: 460,
        fontSize: 24,
        fontFamily: 'Cormorant Garamond',
        color: '#6b7280',
        align: 'center',
        letterSpacing: 4,
        fontWeight: 300
      }
    ]
  },
  {
    id: 'universal-dark',
    name: 'Універсальна темна',
    category: 'corporate',
    bgColor: '#0a0a0a',
    photoZone: { x: 0, y: 0, w: 100, h: 100, opacity: 0.35 },
    textBlocks: [
      {
        id: 'title',
        label: 'Заголовок події',
        content: 'Особлива подія',
        x: 50,
        y: 320,
        width: 460,
        fontSize: 52,
        fontFamily: 'Playfair Display',
        color: '#ffffff',
        align: 'center',
        letterSpacing: 1,
        fontWeight: 700
      },
      {
        id: 'subtitle',
        label: 'Підзаголовок',
        content: 'Книга відгуків',
        x: 50,
        y: 420,
        width: 460,
        fontSize: 20,
        fontFamily: 'Playfair Display',
        color: '#d1d5db',
        align: 'center',
        letterSpacing: 5,
        italic: true
      },
      {
        id: 'date',
        label: 'Дата',
        content: '2024',
        x: 50,
        y: 520,
        width: 460,
        fontSize: 18,
        fontFamily: 'Montserrat',
        color: '#9ca3af',
        align: 'center',
        letterSpacing: 6,
        fontWeight: 300
      }
    ]
  }
];

// Background color swatches
const BG_COLORS = [
  { name: 'Бежевий', hex: '#faf8f5' },
  { name: 'Білий', hex: '#ffffff' },
  { name: 'Крем', hex: '#f5f0eb' },
  { name: 'Блакитний', hex: '#f5f8fc' },
  { name: 'Рожевий', hex: '#fdf5f8' },
  { name: 'Темний', hex: '#1e1a17' },
  { name: 'Графіт', hex: '#2a2622' },
  { name: 'Чорний', hex: '#0d0b08' }
];

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  wedding: 'Весілля',
  birthday: 'Дні народження',
  baby: 'Хрестини / Дитячі',
  corporate: 'Корпоратив / Універсальні'
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatUAH = (amount: number) => `${amount.toLocaleString('uk-UA')} ₴`;

const getTemplatePrice = (template: CoverTemplate): number => {
  // Base pricing logic
  if (template.category === 'wedding') return 450;
  if (template.category === 'birthday') return 380;
  if (template.category === 'baby') return 400;
  return 350; // corporate/universal
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GuestbookConstructor() {
  const router = useRouter();

  // Canvas state
  const [selectedTemplate, setSelectedTemplate] = useState<string>('wedding-classic');
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState<string>('#faf8f5');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get current template
  const currentTemplate = COVER_TEMPLATES.find(t => t.id === selectedTemplate) || COVER_TEMPLATES[0];

  // Initialize text values when template changes
  useEffect(() => {
    const initialValues: Record<string, string> = {};
    currentTemplate.textBlocks.forEach(block => {
      initialValues[block.id] = block.content;
    });
    setTextValues(initialValues);
    setBgColor(currentTemplate.bgColor);
    setUploadedPhoto(null);
  }, [selectedTemplate]);

  // Handle photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedPhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle text change
  const handleTextChange = (blockId: string, value: string) => {
    setTextValues(prev => ({ ...prev, [blockId]: value }));
  };

  // Save to session storage and navigate to order page
  const handleOrder = () => {
    const orderData = {
      type: 'guestbook',
      template: currentTemplate.name,
      category: currentTemplate.category,
      textValues,
      bgColor,
      hasPhoto: !!uploadedPhoto,
      price: getTemplatePrice(currentTemplate),
      timestamp: new Date().toISOString()
    };

    sessionStorage.setItem('guestbook_order', JSON.stringify(orderData));
    router.push('/order/guestbook');
  };

  // Group templates by category
  const groupedTemplates = COVER_TEMPLATES.reduce((acc, template) => {
    if (!acc[template.category]) acc[template.category] = [];
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, CoverTemplate[]>);

  return (
    <>
      <GoogleFontsStyle />
      <Navigation />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 pt-24 pb-16">
        {/* Header */}
        <div className="max-w-[1400px] mx-auto px-6 mb-8">
          <button
            onClick={() => router.push('/catalog')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад до каталогу
          </button>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">
                Конструктор обкладинки
              </div>
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                Гостьова книга
              </h1>
              <p className="text-gray-600 mt-2">
                Формат: 23×23 см • Створіть унікальну обкладинку для вашої гостьової книги
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Ціна від</div>
              <div className="text-3xl font-black text-gray-900">
                {formatUAH(getTemplatePrice(currentTemplate))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Layout: 3 columns */}
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="grid grid-cols-12 gap-6">

            {/* ================================================================ */}
            {/* LEFT PANEL - Templates, Photos, Text, Background (260px) */}
            {/* ================================================================ */}
            <div className="col-span-3 space-y-6">

              {/* SECTION 1: Templates */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 border-b border-gray-200">
                  <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                    Шаблони
                  </h3>
                </div>

                <div className="p-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                  {Object.entries(groupedTemplates).map(([category, templates]) => (
                    <div key={category} className="mb-6 last:mb-0">
                      <div className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3 px-1">
                        {CATEGORY_LABELS[category]}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {templates.map(template => {
                          const isSelected = selectedTemplate === template.id;
                          return (
                            <button
                              key={template.id}
                              onClick={() => setSelectedTemplate(template.id)}
                              className={`relative group rounded-xl overflow-hidden transition-all ${
                                isSelected
                                  ? 'ring-2 ring-blue-600 shadow-lg'
                                  : 'hover:ring-2 hover:ring-gray-300'
                              }`}
                            >
                              {/* Mini preview */}
                              <div
                                className="aspect-[5/7] relative"
                                style={{ backgroundColor: template.bgColor }}
                              >
                                {/* Simplified preview rendering */}
                                {template.photoZone && (
                                  <div
                                    className="absolute bg-gray-300"
                                    style={{
                                      left: `${template.photoZone.x}%`,
                                      top: `${template.photoZone.y}%`,
                                      width: `${template.photoZone.w}%`,
                                      height: `${template.photoZone.h}%`,
                                      borderRadius: template.photoZone.borderRadius ? '50%' : '0',
                                      opacity: 0.4
                                    }}
                                  />
                                )}

                                {template.textBlocks.slice(0, 2).map((block, idx) => (
                                  <div
                                    key={idx}
                                    className="absolute text-center text-[5px] font-bold px-1"
                                    style={{
                                      left: '10%',
                                      top: `${30 + idx * 20}%`,
                                      width: '80%',
                                      color: block.color,
                                      opacity: 0.7
                                    }}
                                  >
                                    {block.content}
                                  </div>
                                ))}
                              </div>

                              {/* Selection indicator */}
                              {isSelected && (
                                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                </div>
                              )}

                              {/* Template name on hover */}
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="text-white text-[9px] font-bold text-center leading-tight">
                                  {template.name}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 2: Photo Upload */}
              {currentTemplate.photoZone && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-5 py-4 border-b border-gray-200">
                    <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                      Фото
                    </h3>
                  </div>

                  <div className="p-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
                    >
                      <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      <div className="text-sm font-bold text-gray-600 group-hover:text-blue-600">
                        {uploadedPhoto ? 'Змінити фото' : 'Завантажити фото'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        JPG, PNG до 10MB
                      </div>
                    </button>

                    {uploadedPhoto && (
                      <button
                        onClick={() => setUploadedPhoto(null)}
                        className="w-full mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Видалити фото
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 3: Text Fields */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-5 py-4 border-b border-gray-200">
                  <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                    Текст
                  </h3>
                </div>

                <div className="p-4 space-y-4">
                  {currentTemplate.textBlocks.map(block => (
                    <div key={block.id}>
                      <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                        {block.label}
                      </label>
                      <input
                        type="text"
                        value={textValues[block.id] || ''}
                        onChange={(e) => handleTextChange(block.id, e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        placeholder={block.content}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 4: Background Color */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 border-b border-gray-200">
                  <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                    Фон
                  </h3>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-4 gap-2">
                    {BG_COLORS.map(color => (
                      <button
                        key={color.hex}
                        onClick={() => setBgColor(color.hex)}
                        className={`aspect-square rounded-lg border-2 transition-all ${
                          bgColor === color.hex
                            ? 'border-blue-600 shadow-md scale-110'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* ================================================================ */}
            {/* CENTER PANEL - Live Preview Canvas (560×792px) */}
            {/* ================================================================ */}
            <div className="col-span-6 flex items-start justify-center">
              <div className="sticky top-6">
                <div className="bg-white rounded-2xl shadow-2xl p-6">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 text-center">
                    Попередній перегляд
                  </div>

                  {/* Canvas container */}
                  <div className="relative" style={{ width: '560px', height: '792px' }}>
                    <div
                      className="absolute inset-0 rounded-lg overflow-hidden shadow-inner"
                      style={{ backgroundColor: bgColor }}
                    >
                      {/* Photo zone */}
                      {currentTemplate.photoZone && uploadedPhoto && (
                        <div
                          className="absolute bg-cover bg-center"
                          style={{
                            left: `${currentTemplate.photoZone.x}%`,
                            top: `${currentTemplate.photoZone.y}%`,
                            width: `${currentTemplate.photoZone.w}%`,
                            height: `${currentTemplate.photoZone.h}%`,
                            backgroundImage: `url(${uploadedPhoto})`,
                            opacity: currentTemplate.photoZone.opacity || 1,
                            borderRadius: currentTemplate.photoZone.borderRadius
                              ? `${currentTemplate.photoZone.borderRadius}%`
                              : '0'
                          }}
                        />
                      )}

                      {/* Decorative elements */}
                      {currentTemplate.hasDecorations && (
                        <>
                          {/* Horizontal rules for classic wedding */}
                          {currentTemplate.id === 'wedding-classic' && (
                            <>
                              <div
                                className="absolute h-px bg-current"
                                style={{
                                  left: '15%',
                                  top: '45%',
                                  width: '70%',
                                  opacity: 0.2,
                                  color: currentTemplate.textBlocks[0].color
                                }}
                              />
                              <div
                                className="absolute h-px bg-current"
                                style={{
                                  left: '15%',
                                  top: '58%',
                                  width: '70%',
                                  opacity: 0.2,
                                  color: currentTemplate.textBlocks[0].color
                                }}
                              />
                            </>
                          )}

                          {/* Floral ornaments */}
                          {currentTemplate.id === 'wedding-floral' && (
                            <>
                              <div
                                className="absolute text-4xl"
                                style={{
                                  left: '20%',
                                  top: '42%',
                                  color: currentTemplate.textBlocks[0].color,
                                  opacity: 0.3
                                }}
                              >
                                ❧
                              </div>
                              <div
                                className="absolute text-4xl"
                                style={{
                                  right: '20%',
                                  top: '42%',
                                  color: currentTemplate.textBlocks[0].color,
                                  opacity: 0.3
                                }}
                              >
                                ❧
                              </div>
                            </>
                          )}

                          {/* Gold ornaments */}
                          {currentTemplate.id === 'wedding-gold' && (
                            <>
                              <div
                                className="absolute text-2xl"
                                style={{
                                  left: '50%',
                                  top: '37%',
                                  transform: 'translateX(-50%)',
                                  color: '#d4af37',
                                  opacity: 0.4
                                }}
                              >
                                ◆
                              </div>
                              <div
                                className="absolute text-2xl"
                                style={{
                                  left: '50%',
                                  top: '61%',
                                  transform: 'translateX(-50%)',
                                  color: '#d4af37',
                                  opacity: 0.4
                                }}
                              >
                                ◆
                              </div>
                            </>
                          )}

                          {/* Stars for baby-stars */}
                          {currentTemplate.id === 'baby-stars' && (
                            <>
                              {[...Array(8)].map((_, i) => (
                                <div
                                  key={i}
                                  className="absolute text-xl"
                                  style={{
                                    left: `${15 + Math.random() * 70}%`,
                                    top: `${10 + Math.random() * 80}%`,
                                    color: '#ffd700',
                                    opacity: 0.2 + Math.random() * 0.3,
                                    fontSize: `${12 + Math.random() * 12}px`
                                  }}
                                >
                                  ✦
                                </div>
                              ))}
                            </>
                          )}
                        </>
                      )}

                      {/* Text blocks */}
                      {currentTemplate.textBlocks.map(block => (
                        <div
                          key={block.id}
                          className="absolute px-4"
                          style={{
                            left: `${(block.x / 560) * 100}%`,
                            top: `${(block.y / 792) * 100}%`,
                            width: `${(block.width / 560) * 100}%`,
                            fontSize: `${block.fontSize}px`,
                            fontFamily: block.fontFamily,
                            color: block.color,
                            textAlign: block.align,
                            letterSpacing: `${block.letterSpacing || 0}px`,
                            fontWeight: block.fontWeight || 400,
                            fontStyle: block.italic ? 'italic' : 'normal',
                            lineHeight: 1.2
                          }}
                        >
                          {textValues[block.id] || block.content}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ================================================================ */}
            {/* RIGHT PANEL - Order Summary (280px) */}
            {/* ================================================================ */}
            <div className="col-span-3">
              <div className="sticky top-6 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl overflow-hidden text-white">
                <div className="p-6 border-b border-gray-700">
                  <h3 className="text-lg font-bold uppercase tracking-wider">
                    Ваше замовлення
                  </h3>
                </div>

                <div className="p-6 space-y-4">
                  {/* Template info */}
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Шаблон
                    </div>
                    <div className="text-sm font-medium text-gray-200">
                      {currentTemplate.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {CATEGORY_LABELS[currentTemplate.category]}
                    </div>
                  </div>

                  {/* Format */}
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Формат
                    </div>
                    <div className="text-sm font-medium text-gray-200">
                      23×23 см (квадрат)
                    </div>
                  </div>

                  {/* Text preview */}
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Ваш текст
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                      {currentTemplate.textBlocks.map(block => (
                        <div key={block.id} className="text-xs">
                          <span className="text-gray-500">{block.label}:</span>
                          <span className="text-gray-300 ml-2">
                            {textValues[block.id] || block.content}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Photo status */}
                  {currentTemplate.photoZone && (
                    <div>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                        Фото
                      </div>
                      <div className={`text-sm font-medium ${uploadedPhoto ? 'text-green-400' : 'text-gray-500'}`}>
                        {uploadedPhoto ? '✓ Завантажено' : 'Не завантажено'}
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  <div className="h-px bg-gray-700 my-6" />

                  {/* Price */}
                  <div className="bg-gray-800/50 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Вартість
                    </div>
                    <div className="text-3xl font-black text-white tracking-tight">
                      {formatUAH(getTemplatePrice(currentTemplate))}
                    </div>
                  </div>

                  {/* Order button */}
                  <button
                    onClick={handleOrder}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl uppercase tracking-wider transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-2 mt-6"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Замовити
                  </button>

                  {/* Info */}
                  <div className="text-center text-xs text-gray-500 mt-4">
                    Дизайн обкладинки включено в ціну
                  </div>
                  <div className="text-center text-xs text-gray-500">
                    Термін виготовлення: 7-10 днів
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </>
  );
}
