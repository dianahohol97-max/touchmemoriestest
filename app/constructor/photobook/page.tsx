'use client';

import React, { useState, useRef, useEffect, useReducer } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { submitConstructorOrder } from '@/lib/submitOrder';

// ═══════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════

type CoverType = 'printed' | 'velour' | 'leather' | 'fabric';
type SizeId = '20×20' | '25×25' | '20×30' | '30×20' | '30×30' | 'A4';
type LayoutId = '1-full' | '2-side' | '2-stack' | '3-main' | '4-grid' | '1-left' | '1-right' | 'blank';
type LeftPanelId = 'images' | 'layouts' | 'backgrounds' | 'cliparts' | 'frames' | 'options';

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
  name: string;
  usedCount: number;
}

interface PhotoSlot {
  id: string;
  photo: PhotoFile | null;
  zoom: number;
  rotation: number;
  position: string;
}

interface Spread {
  id: number;
  label: string;
  layout: LayoutId;
  slots: PhotoSlot[];
  background: string;
}

// ═══════════════════════════════════════════════════════
// EDITOR STATE & REDUCER (with undo/redo history)
// ═══════════════════════════════════════════════════════

interface EditorState {
  spreads: Spread[];
  photos: PhotoFile[];
  history: { spreads: Spread[]; photos: PhotoFile[] }[];
  historyIndex: number;
}

type EditorAction =
  | { type: 'SET_SPREADS'; payload: Spread[] }
  | { type: 'SET_PHOTOS'; payload: PhotoFile[] }
  | { type: 'UPDATE_SPREAD'; payload: { index: number; spread: Spread } }
  | { type: 'ADD_SPREAD'; payload: Spread }
  | { type: 'REMOVE_LAST_SPREAD' }
  | { type: 'ADD_PHOTOS'; payload: PhotoFile[] }
  | { type: 'REMOVE_PHOTO'; payload: string }
  | { type: 'DROP_PHOTO_ON_SLOT'; payload: { spreadIndex: number; slotId: string; photo: PhotoFile } }
  | { type: 'REMOVE_PHOTO_FROM_SLOT'; payload: { spreadIndex: number; slotId: string } }
  | { type: 'APPLY_LAYOUT'; payload: { spreadIndex: number; layoutId: LayoutId; existingPhotos: PhotoFile[] } }
  | { type: 'AUTO_FILL'; payload: PhotoFile[] }
  | { type: 'SET_BACKGROUND'; payload: { spreadIndex: number; color: string } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'INIT'; payload: { spreads: Spread[]; photos: PhotoFile[] } };

// Helper: push to history (trim future if branching)
function pushHistory(state: EditorState): EditorState {
  const snapshot = {
    spreads: JSON.parse(JSON.stringify(state.spreads)),
    photos: JSON.parse(JSON.stringify(state.photos)),
  };
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  return {
    ...state,
    history: [...newHistory, snapshot].slice(-30), // keep last 30
    historyIndex: Math.min(newHistory.length, 29),
  };
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'INIT': {
      const initial = {
        spreads: action.payload.spreads,
        photos: action.payload.photos,
        history: [{
          spreads: JSON.parse(JSON.stringify(action.payload.spreads)),
          photos: JSON.parse(JSON.stringify(action.payload.photos)),
        }],
        historyIndex: 0,
      };
      return initial;
    }

    case 'SET_SPREADS': {
      const newState = { ...state, spreads: action.payload };
      return pushHistory(newState);
    }

    case 'SET_PHOTOS': {
      const newState = { ...state, photos: action.payload };
      return pushHistory(newState);
    }

    case 'UPDATE_SPREAD': {
      const newSpreads = [...state.spreads];
      newSpreads[action.payload.index] = action.payload.spread;
      const newState = { ...state, spreads: newSpreads };
      return pushHistory(newState);
    }

    case 'ADD_SPREAD': {
      const newState = { ...state, spreads: [...state.spreads, action.payload] };
      return pushHistory(newState);
    }

    case 'REMOVE_LAST_SPREAD': {
      if (state.spreads.length <= 2) return state;
      const newState = { ...state, spreads: state.spreads.slice(0, -1) };
      return pushHistory(newState);
    }

    case 'ADD_PHOTOS': {
      const newState = { ...state, photos: [...state.photos, ...action.payload] };
      return pushHistory(newState);
    }

    case 'REMOVE_PHOTO': {
      const photoId = action.payload;
      const newPhotos = state.photos.filter(p => p.id !== photoId);
      const newSpreads = state.spreads.map(spread => ({
        ...spread,
        slots: spread.slots.map(slot =>
          slot.photo?.id === photoId ? { ...slot, photo: null } : slot
        ),
      }));
      const newState = { ...state, photos: newPhotos, spreads: newSpreads };
      return pushHistory(newState);
    }

    case 'DROP_PHOTO_ON_SLOT': {
      const { spreadIndex, slotId, photo } = action.payload;
      const newSpreads = state.spreads.map((spread, idx) => {
        if (idx !== spreadIndex) return spread;
        const newSlots = spread.slots.map(s => {
          if (s.id === slotId) {
            return { ...s, photo };
          }
          if (s.photo?.id === photo.id) {
            return { ...s, photo: null };
          }
          return s;
        });
        return { ...spread, slots: newSlots };
      });
      const newState = { ...state, spreads: newSpreads };
      return pushHistory(newState);
    }

    case 'REMOVE_PHOTO_FROM_SLOT': {
      const { spreadIndex, slotId } = action.payload;
      const newSpreads = state.spreads.map((spread, idx) => {
        if (idx !== spreadIndex) return spread;
        return {
          ...spread,
          slots: spread.slots.map(s =>
            s.id === slotId ? { ...s, photo: null } : s
          ),
        };
      });
      const newState = { ...state, spreads: newSpreads };
      return pushHistory(newState);
    }

    case 'APPLY_LAYOUT': {
      const { spreadIndex, layoutId, existingPhotos } = action.payload;
      const newSpreads = state.spreads.map((spread, idx) => {
        if (idx !== spreadIndex) return spread;
        const newPositions = SLOT_POSITIONS[layoutId];
        const allPositions = [...newPositions.left, ...newPositions.right];
        const newSlots: PhotoSlot[] = allPositions.map((pos, i) => ({
          id: `${idx}-${pos.id}`,
          photo: existingPhotos[i] || null,
          zoom: 100,
          rotation: 0,
          position: 'center',
        }));
        return { ...spread, layout: layoutId, slots: newSlots };
      });
      const newState = { ...state, spreads: newSpreads };
      return pushHistory(newState);
    }

    case 'AUTO_FILL': {
      let photoIndex = 0;
      const photos = action.payload;
      const newSpreads = state.spreads.map(spread => ({
        ...spread,
        slots: spread.slots.map(slot => {
          if (photoIndex >= photos.length) return slot;
          const photo = photos[photoIndex++];
          return { ...slot, photo };
        }),
      }));
      const newState = { ...state, spreads: newSpreads };
      return pushHistory(newState);
    }

    case 'SET_BACKGROUND': {
      const { spreadIndex, color } = action.payload;
      const newSpreads = state.spreads.map((spread, idx) => {
        if (idx !== spreadIndex) return spread;
        return { ...spread, background: color };
      });
      const newState = { ...state, spreads: newSpreads };
      return pushHistory(newState);
    }

    case 'UNDO': {
      if (state.historyIndex <= 0) return state;
      const prev = state.history[state.historyIndex - 1];
      return {
        ...state,
        spreads: JSON.parse(JSON.stringify(prev.spreads)),
        photos: JSON.parse(JSON.stringify(prev.photos)),
        historyIndex: state.historyIndex - 1,
      };
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;
      const next = state.history[state.historyIndex + 1];
      return {
        ...state,
        spreads: JSON.parse(JSON.stringify(next.spreads)),
        photos: JSON.parse(JSON.stringify(next.photos)),
        historyIndex: state.historyIndex + 1,
      };
    }

    default:
      return state;
  }
}

const CANVAS_CONFIGS = {
  // PHOTOBOOKS
  '20×20': {
    label: 'Фотокнига 20×20 см',
    ratio: 1 / 1,
    spreadRatio: 2 / 1,
    orientation: 'square' as const,
    widthCm: 20,
    heightCm: 20,
  },
  '25×25': {
    label: 'Фотокнига 25×25 см',
    ratio: 1 / 1,
    spreadRatio: 2 / 1,
    orientation: 'square' as const,
    widthCm: 25,
    heightCm: 25,
  },
  '20×30': {
    label: 'Фотокнига 20×30 см (портрет)',
    ratio: 2 / 3,
    spreadRatio: 4 / 3,
    orientation: 'portrait' as const,
    widthCm: 20,
    heightCm: 30,
  },
  '30×20': {
    label: 'Фотокнига 30×20 см (альбом)',
    ratio: 3 / 2,
    spreadRatio: 3 / 1,
    orientation: 'landscape' as const,
    widthCm: 30,
    heightCm: 20,
  },
  '30×30': {
    label: 'Фотокнига 30×30 см',
    ratio: 1 / 1,
    spreadRatio: 2 / 1,
    orientation: 'square' as const,
    widthCm: 30,
    heightCm: 30,
  },
  // MAGAZINE
  'A4': {
    label: 'Журнал A4 (21×29.7 см)',
    ratio: 21 / 29.7,
    spreadRatio: 42 / 29.7,
    orientation: 'portrait' as const,
    widthCm: 21,
    heightCm: 29.7,
  },
};

const PANELS = [
  { id: 'images' as LeftPanelId, icon: '🖼', label: 'Фото' },
  { id: 'layouts' as LeftPanelId, icon: '⊞', label: 'Макети' },
  { id: 'backgrounds' as LeftPanelId, icon: '🎨', label: 'Фони' },
  { id: 'cliparts' as LeftPanelId, icon: '✦', label: 'Декор' },
  { id: 'frames' as LeftPanelId, icon: '▢', label: 'Рамки' },
  { id: 'options' as LeftPanelId, icon: '⚙', label: 'Опції' },
];

const LAYOUTS = [
  { id: '1-full' as LayoutId, label: '1 фото', icon: '▭' },
  { id: '2-side' as LayoutId, label: '2 фото (рядок)', icon: '▯▯' },
  { id: '2-stack' as LayoutId, label: '2 фото (стопка)', icon: '▭▭' },
  { id: '3-main' as LayoutId, label: '3 фото', icon: '▯▫▫' },
  { id: '4-grid' as LayoutId, label: '4 фото (сітка)', icon: '▫▫▫▫' },
  { id: '1-left' as LayoutId, label: '1 фото (ліва)', icon: '▯' },
  { id: '1-right' as LayoutId, label: '1 фото (права)', icon: '▯' },
  { id: 'blank' as LayoutId, label: 'Порожня', icon: '◻' },
];

const BACKGROUNDS = [
  '#FFFFFF', '#F8F5F0', '#F5F0E8', '#EDE8E0',
  '#E8E0D5', '#D5CEC4', '#C4BDB3', '#1A1A1A',
  '#2C3E50', '#34495E', '#7F8C8D', '#95A5A6',
  '#ECF0F1', '#BDC3C7', '#E8D5C4', '#D4B8A0',
];

// Slot positions for each layout type
const SLOT_POSITIONS: Record<LayoutId, { left: any[]; right: any[] }> = {
  '1-full': {
    left: [{ id: 'L', top: '0%', left: '0%', w: '100%', h: '100%' }],
    right: [{ id: 'R', top: '0%', left: '0%', w: '100%', h: '100%' }],
  },
  '2-side': {
    left: [{ id: 'L', top: '0%', left: '0%', w: '100%', h: '100%' }],
    right: [{ id: 'R', top: '0%', left: '0%', w: '100%', h: '100%' }],
  },
  '2-stack': {
    left: [
      { id: 'LT', top: '0%', left: '0%', w: '100%', h: '50%' },
      { id: 'LB', top: '50%', left: '0%', w: '100%', h: '50%' },
    ],
    right: [
      { id: 'RT', top: '0%', left: '0%', w: '100%', h: '50%' },
      { id: 'RB', top: '50%', left: '0%', w: '100%', h: '50%' },
    ],
  },
  '3-main': {
    left: [{ id: 'L', top: '0%', left: '0%', w: '100%', h: '100%' }],
    right: [
      { id: 'RT', top: '0%', left: '0%', w: '100%', h: '50%' },
      { id: 'RB', top: '50%', left: '0%', w: '100%', h: '50%' },
    ],
  },
  '4-grid': {
    left: [
      { id: 'LT', top: '0%', left: '0%', w: '100%', h: '50%' },
      { id: 'LB', top: '50%', left: '0%', w: '100%', h: '50%' },
    ],
    right: [
      { id: 'RT', top: '0%', left: '0%', w: '100%', h: '50%' },
      { id: 'RB', top: '50%', left: '0%', w: '100%', h: '50%' },
    ],
  },
  '1-left': {
    left: [{ id: 'L', top: '0%', left: '0%', w: '100%', h: '100%' }],
    right: [],
  },
  '1-right': {
    left: [],
    right: [{ id: 'R', top: '0%', left: '0%', w: '100%', h: '100%' }],
  },
  'blank': { left: [], right: [] },
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
      totalPrice: 950,
    };
    sessionStorage.setItem('constructorConfig', JSON.stringify(config));
    onSubmit(config);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Налаштування фотокниги</h2>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Формат</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(CANVAS_CONFIGS).filter(k => k !== 'A4') as SizeId[]).map((sizeId) => (
              <button
                key={sizeId}
                onClick={() => setSize(sizeId)}
                className={`px-3 py-2 rounded-lg border-2 font-semibold text-xs transition ${
                  size === sizeId
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:border-blue-300 text-gray-700'
                }`}
              >
                {sizeId}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Кількість сторінок</label>
          <input
            type="number"
            min={20}
            step={2}
            value={pages}
            onChange={(e) => setPages(Math.max(20, parseInt(e.target.value) || 20))}
            className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 font-bold text-center text-lg focus:border-blue-600 focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-2">Мінімум 20 сторінок, тільки парні числа</p>
        </div>

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
// WELCOME MODAL
// ═══════════════════════════════════════════════════════

function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">👋 Привіт!</h3>
        <p className="text-gray-500 mb-4 text-sm">
          Перетягуйте фото з лівої панелі на сторінки книги.<br />
          Оберіть макет розвороту, щоб змінити розташування фото.
        </p>
        <div className="bg-gray-50 rounded-xl p-4 mb-4 text-left text-sm text-gray-600 space-y-2">
          <p>🖼 <strong>Фото</strong> — завантажте ваші знімки</p>
          <p>⊞ <strong>Макети</strong> — оберіть розташування фото</p>
          <p>🎨 <strong>Фони</strong> — змініть колір сторінки</p>
          <p>⬇ <strong>Знизу</strong> — всі сторінки книги</p>
        </div>
        <button
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Зрозуміло, починаємо! 👌
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PRE-CHECKOUT MODAL
// ═══════════════════════════════════════════════════════

function PreCheckoutModal({ onAddMore, onFinalize }: { onAddMore: () => void; onFinalize: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
        <div className="text-4xl mb-4">🛍️</div>
        <h2 className="text-xl font-bold mb-2">Бажаєте додати щось ще?</h2>
        <p className="text-gray-500 text-sm mb-8">
          Ви можете повернутись до каталогу та обрати інші товари, або одразу оформити замовлення.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onAddMore}
            className="w-full border-2 border-orange-400 text-orange-500 font-semibold py-3 rounded-xl hover:bg-orange-50 transition-colors"
          >
            Так, перейти до каталогу
          </button>
          <button
            onClick={onFinalize}
            className="w-full bg-orange-500 text-white font-semibold py-3 rounded-xl hover:bg-orange-600 transition-colors"
          >
            Ні, оформити зараз →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ORDER FORM MODAL
// ═══════════════════════════════════════════════════════

interface OrderFormData {
  name: string;
  phone: string;
  email: string;
  delivery: 'nova_poshta' | 'ukrposhta' | 'pickup';
  payment: 'cash' | 'card_on_delivery' | 'card_transfer';
  notes: string;
}

function OrderFormModal({
  config,
  spreads,
  photos,
  onClose,
}: {
  config: ConstructorConfig;
  spreads: Spread[];
  photos: PhotoFile[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<OrderFormData>({
    name: '',
    phone: '',
    email: '',
    delivery: 'nova_poshta',
    payment: 'card_on_delivery',
    notes: '',
  });
  const [errors, setErrors] = useState<Partial<OrderFormData>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = (): boolean => {
    const newErrors: Partial<OrderFormData> = {};
    if (!form.name.trim()) newErrors.name = "Вкажіть ім'я";
    if (!form.phone.trim()) newErrors.phone = 'Вкажіть телефон';
    else if (!/^\+?380\d{9}$/.test(form.phone.replace(/[\s\-()]/g, '')))
      newErrors.phone = 'Формат: +380XXXXXXXXX';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const orderData = {
        product_type: config.productType,
        product_size: config.size,
        pages: config.pages,
        total_price: config.totalPrice,
        cover_type: config.coverType || null,
        photo_count: photos.length,
        customer_name: form.name.trim(),
        customer_phone: form.phone.trim(),
        customer_email: form.email.trim() || null,
        delivery_method: form.delivery,
        payment_method: form.payment,
        notes: form.notes.trim() || null,
        status: 'new',
        constructor_data: JSON.stringify(spreads),
      };

      await submitConstructorOrder(orderData);
      setSuccess(true);
    } catch (err) {
      console.error('Order submission error:', err);
      alert('Помилка при відправці. Спробуйте ще раз.');
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-10 max-w-md w-full mx-4 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-3">Замовлення прийнято!</h2>
          <p className="text-gray-500 mb-6">
            Ми зв'яжемося з вами найближчим часом за номером {form.phone}
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-orange-500 text-white font-semibold px-8 py-3 rounded-xl hover:bg-orange-600"
          >
            На головну
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Оформлення замовлення</h2>
            <p className="text-sm text-gray-500 mt-1">
              {config.productType} {config.size} · {config.pages} стор. · {config.totalPrice} ₴
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>

        {/* Form fields */}
        <div className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Ім'я *</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Ваше ім'я"
              className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                errors.name ? 'border-red-400' : 'border-gray-200'
              }`}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Телефон *</label>
            <input
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="+380XXXXXXXXX"
              type="tel"
              className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                errors.phone ? 'border-red-400' : 'border-gray-200'
              }`}
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
            <input
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
              type="email"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Delivery */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Доставка</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'nova_poshta', label: 'Нова Пошта' },
                { value: 'ukrposhta', label: 'Укрпошта' },
                { value: 'pickup', label: 'Самовивіз' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, delivery: opt.value as any })}
                  className={`py-2 text-sm rounded-lg border-2 transition-colors ${
                    form.delivery === opt.value
                      ? 'border-orange-500 bg-orange-50 text-orange-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-orange-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Оплата</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'cash', label: 'Готівкою' },
                { value: 'card_on_delivery', label: 'Картою при отриманні' },
                { value: 'card_transfer', label: 'На карту' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, payment: opt.value as any })}
                  className={`py-2 px-1 text-xs rounded-lg border-2 transition-colors ${
                    form.payment === opt.value
                      ? 'border-orange-500 bg-orange-50 text-orange-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-orange-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Коментар</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Побажання, уточнення..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full mt-6 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl text-base transition-colors"
        >
          {submitting ? '⏳ Надсилаємо...' : `✅ Підтвердити замовлення · ${config.totalPrice} ₴`}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SLOT COMPONENT
// ═══════════════════════════════════════════════════════

interface SlotProps {
  slot: PhotoSlot;
  position: { top: string; left: string; w: string; h: string };
  onDrop: () => void;
  onClick: () => void;
  onRemove: () => void;
}

function Slot({ slot, position, onDrop, onClick, onRemove }: SlotProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        width: position.w,
        height: position.h,
      }}
      className="overflow-hidden group"
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragOver={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {slot.photo ? (
        <div className="relative w-full h-full group">
          <Image
            src={slot.photo.preview}
            alt="Photo"
            fill
            className="object-cover"
            style={{ objectPosition: slot.position || 'center' }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="bg-white rounded-full w-7 h-7 text-xs shadow-md flex items-center justify-center hover:bg-red-50"
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 text-gray-300 text-xs gap-1 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all">
          <span className="text-2xl">📷</span>
          <span>Перетягніть фото</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN EDITOR COMPONENT
// ═══════════════════════════════════════════════════════

export default function PhotobookConstructorPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load config from sessionStorage
  const [config, setConfig] = useState<ConstructorConfig | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = sessionStorage.getItem('constructorConfig');
    return stored ? JSON.parse(stored) : null;
  });

  // Welcome modal
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !sessionStorage.getItem('editorWelcomeSeen');
  });

  // Initialize editor state with useReducer (for undo/redo)
  const initialSpreads: Spread[] = (() => {
    if (!config) return [];
    const numSpreads = Math.ceil(config.pages / 2) + 1; // +1 for cover
    return Array.from({ length: numSpreads }, (_, i) => ({
      id: i,
      label: i === 0 ? 'Обкладинка' : `Стор. ${i * 2 - 1}–${i * 2}`,
      layout: '1-full' as LayoutId,
      slots: [
        { id: `${i}-L`, photo: null, zoom: 100, rotation: 0, position: 'center' },
        { id: `${i}-R`, photo: null, zoom: 100, rotation: 0, position: 'center' },
      ],
      background: '#FFFFFF',
    }));
  })();

  const [editorState, dispatch] = useReducer(editorReducer, {
    spreads: initialSpreads,
    photos: [],
    history: [{ spreads: JSON.parse(JSON.stringify(initialSpreads)), photos: [] }],
    historyIndex: 0,
  });

  const spreads = editorState.spreads;
  const photos = editorState.photos;

  const [currentSpread, setCurrentSpread] = useState(0);
  const [draggingPhoto, setDraggingPhoto] = useState<PhotoFile | null>(null);
  const [leftPanel, setLeftPanel] = useState<LeftPanelId>('images');
  const [savedStatus, setSavedStatus] = useState('Не збережено');

  if (!config) {
    return <ConfigModal onSubmit={setConfig} />;
  }

  const sizeConfig = CANVAS_CONFIGS[config.size];

  // ═══════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS (Undo/Redo)
  // ═══════════════════════════════════════════════════════

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ═══════════════════════════════════════════════════════
  // PHOTO HANDLERS
  // ═══════════════════════════════════════════════════════

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos: PhotoFile[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      usedCount: 0,
    }));
    dispatch({ type: 'ADD_PHOTOS', payload: newPhotos });
  };

  const removePhoto = (photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (photo) URL.revokeObjectURL(photo.preview);
    dispatch({ type: 'REMOVE_PHOTO', payload: photoId });
  };

  const handleDropToGallery = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const newPhotos: PhotoFile[] = imageFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      usedCount: 0,
    }));
    dispatch({ type: 'ADD_PHOTOS', payload: newPhotos });
  };

  const handleDropOnSlot = (slotId: string) => {
    if (!draggingPhoto) return;

    dispatch({
      type: 'DROP_PHOTO_ON_SLOT',
      payload: { spreadIndex: currentSpread, slotId, photo: draggingPhoto },
    });

    setDraggingPhoto(null);
    setSavedStatus('Не збережено');
  };

  const removePhotoFromSlot = (slotId: string) => {
    dispatch({
      type: 'REMOVE_PHOTO_FROM_SLOT',
      payload: { spreadIndex: currentSpread, slotId },
    });
    setSavedStatus('Не збережено');
  };

  // ═══════════════════════════════════════════════════════
  // LAYOUT CHANGE
  // ═══════════════════════════════════════════════════════

  const applyLayout = (layoutId: LayoutId) => {
    const spread = spreads[currentSpread];
    const existingPhotos = spread.slots.map(s => s.photo).filter(Boolean) as PhotoFile[];

    dispatch({
      type: 'APPLY_LAYOUT',
      payload: { spreadIndex: currentSpread, layoutId, existingPhotos },
    });
    setSavedStatus('Не збережено');
  };

  // ═══════════════════════════════════════════════════════
  // AUTO-FILL
  // ═══════════════════════════════════════════════════════

  const handleAutoFill = () => {
    dispatch({ type: 'AUTO_FILL', payload: photos });
    setSavedStatus('Не збережено');
  };

  // ═══════════════════════════════════════════════════════
  // SPREAD MANAGEMENT
  // ═══════════════════════════════════════════════════════

  const addSpread = () => {
    const newId = spreads.length;
    const newSpread: Spread = {
      id: newId,
      label: `Стор. ${newId * 2 - 1}–${newId * 2}`,
      layout: '1-full',
      slots: [
        { id: `${newId}-L`, photo: null, zoom: 100, rotation: 0, position: 'center' },
        { id: `${newId}-R`, photo: null, zoom: 100, rotation: 0, position: 'center' },
      ],
      background: '#FFFFFF',
    };
    dispatch({ type: 'ADD_SPREAD', payload: newSpread });
  };

  const removeLastSpread = () => {
    if (spreads.length <= 2) return;
    dispatch({ type: 'REMOVE_LAST_SPREAD' });
    if (currentSpread >= spreads.length - 1) {
      setCurrentSpread(spreads.length - 2);
    }
  };

  const setSpreadBackground = (color: string) => {
    dispatch({
      type: 'SET_BACKGROUND',
      payload: { spreadIndex: currentSpread, color },
    });
  };

  // ═══════════════════════════════════════════════════════
  // ORDER HANDLING
  // ═══════════════════════════════════════════════════════

  const [showPreCheckoutModal, setShowPreCheckoutModal] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);

  const handleOrder = () => {
    // Step 1: Check for empty spreads (skip cover)
    const emptySpreads = spreads.slice(1).filter(s =>
      s.slots.every(slot => slot.photo === null)
    );

    if (emptySpreads.length > 0) {
      const confirmed = window.confirm(
        `⚠ ${emptySpreads.length} розворот(ів) без фото. Продовжити?`
      );
      if (!confirmed) return;
    }

    // Step 2: Show pre-checkout modal
    setShowPreCheckoutModal(true);
  };

  const handleContinueToOrder = () => {
    setShowPreCheckoutModal(false);
    setShowOrderForm(true);
  };

  const handleBackToCatalog = () => {
    // Save pending order state
    sessionStorage.setItem('pendingOrder', JSON.stringify({
      type: 'photobook',
      config,
      spreads: spreads.map(s => ({
        id: s.id,
        label: s.label,
        layout: s.layout,
        background: s.background,
        slots: s.slots.map(slot => ({
          id: slot.id,
          photoId: slot.photo?.id || null,
        })),
      })),
    }));
    router.push('/catalog');
  };

  const handlePreview = () => {
    alert('Функція перегляду буде додана');
  };

  const undo = () => {
    dispatch({ type: 'UNDO' });
    setSavedStatus('Не збережено');
  };

  const redo = () => {
    dispatch({ type: 'REDO' });
    setSavedStatus('Не збережено');
  };

  // ═══════════════════════════════════════════════════════
  // RENDER CANVAS
  // ═══════════════════════════════════════════════════════

  const renderCanvas = () => {
    const spread = spreads[currentSpread];
    if (!spread) return null;

    const leftPositions = SLOT_POSITIONS[spread.layout].left;
    const rightPositions = SLOT_POSITIONS[spread.layout].right;
    const allPositions = [...leftPositions, ...rightPositions];

    return (
      <div
        className="relative bg-white shadow-2xl rounded-sm mx-auto"
        style={{
          aspectRatio: sizeConfig.spreadRatio,
          height: 'min(calc(100% - 48px), calc(100vh - 240px))',
          maxHeight: 'calc(100vh - 240px)',
          backgroundColor: spread.background,
        }}
      >
        {/* Spine line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-300 z-10 shadow-[1px_0_3px_rgba(0,0,0,0.1)]" />

        {/* LEFT PAGE */}
        <div className="absolute top-0 left-0 w-1/2 h-full overflow-hidden">
          {leftPositions.map((pos, idx) => (
            <Slot
              key={`left-${idx}`}
              slot={spread.slots[idx] || { id: `${spread.id}-L${idx}`, photo: null, zoom: 100, rotation: 0, position: 'center' }}
              position={pos}
              onDrop={() => handleDropOnSlot(spread.slots[idx]?.id || `${spread.id}-L${idx}`)}
              onClick={() => {}}
              onRemove={() => removePhotoFromSlot(spread.slots[idx]?.id || `${spread.id}-L${idx}`)}
            />
          ))}
        </div>

        {/* RIGHT PAGE */}
        <div className="absolute top-0 right-0 w-1/2 h-full overflow-hidden">
          {rightPositions.map((pos, idx) => {
            const slotIdx = leftPositions.length + idx;
            return (
              <Slot
                key={`right-${idx}`}
                slot={spread.slots[slotIdx] || { id: `${spread.id}-R${idx}`, photo: null, zoom: 100, rotation: 0, position: 'center' }}
                position={pos}
                onDrop={() => handleDropOnSlot(spread.slots[slotIdx]?.id || `${spread.id}-R${idx}`)}
                onClick={() => {}}
                onRemove={() => removePhotoFromSlot(spread.slots[slotIdx]?.id || `${spread.id}-R${idx}`)}
              />
            );
          })}
        </div>

        {/* SIZE LABEL */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-400 whitespace-nowrap">
          {sizeConfig.label} · {spread.label}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════
  // RENDER SPREAD THUMBNAIL
  // ═══════════════════════════════════════════════════════

  const SpreadThumbnail = ({ spread }: { spread: Spread }) => {
    const leftPositions = SLOT_POSITIONS[spread.layout].left;
    const rightPositions = SLOT_POSITIONS[spread.layout].right;

    return (
      <div className="relative w-full h-full bg-gray-50" style={{ backgroundColor: spread.background }}>
        {/* Spine */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-200" />

        {/* Left slots */}
        <div className="absolute top-0 left-0 w-1/2 h-full">
          {leftPositions.map((pos, idx) => {
            const slot = spread.slots[idx];
            return (
              <div
                key={`thumb-l-${idx}`}
                className="absolute"
                style={{ top: pos.top, left: pos.left, width: pos.w, height: pos.h }}
              >
                {slot?.photo ? (
                  <div className="relative w-full h-full">
                    <Image src={slot.photo.preview} alt="" fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-gray-100" />
                )}
              </div>
            );
          })}
        </div>

        {/* Right slots */}
        <div className="absolute top-0 right-0 w-1/2 h-full">
          {rightPositions.map((pos, idx) => {
            const slotIdx = leftPositions.length + idx;
            const slot = spread.slots[slotIdx];
            return (
              <div
                key={`thumb-r-${idx}`}
                className="absolute"
                style={{ top: pos.top, left: pos.left, width: pos.w, height: pos.h }}
              >
                {slot?.photo ? (
                  <div className="relative w-full h-full">
                    <Image src={slot.photo.preview} alt="" fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-gray-100" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-100 overflow-hidden">
      {/* WELCOME MODAL */}
      {showWelcome && (
        <WelcomeModal
          onClose={() => {
            setShowWelcome(false);
            sessionStorage.setItem('editorWelcomeSeen', 'true');
          }}
        />
      )}

      {/* PRE-CHECKOUT MODAL */}
      {showPreCheckoutModal && (
        <PreCheckoutModal
          onAddMore={handleBackToCatalog}
          onFinalize={handleContinueToOrder}
        />
      )}

      {/* ORDER FORM MODAL */}
      {showOrderForm && (
        <OrderFormModal
          config={config}
          spreads={spreads}
          photos={photos}
          onClose={() => setShowOrderForm(false)}
        />
      )}

      {/* TOP BAR */}
      <div className="flex items-center px-4 gap-4 h-14 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        {/* Left: back + logo */}
        <button
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-700 mr-2 text-sm"
        >
          ← Каталог
        </button>
        <span className="text-sm font-semibold text-gray-800">Touch.Memories</span>

        {/* Undo / Redo */}
        <div className="flex gap-1 ml-4">
          <button
            onClick={undo}
            disabled={editorState.historyIndex <= 0}
            title="Скасувати"
            className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30"
          >
            ↩
          </button>
          <button
            onClick={redo}
            disabled={editorState.historyIndex >= editorState.history.length - 1}
            title="Повторити"
            className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30"
          >
            ↪
          </button>
        </div>

        {/* Center: project info */}
        <div className="flex-1 text-center">
          <p className="text-sm font-medium text-gray-700">
            Фотокнига · {config.size} · {config.pages} стор.
          </p>
          <p className="text-xs text-gray-400">{savedStatus}</p>
        </div>

        {/* Right: actions */}
        <button
          onClick={handlePreview}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
        >
          Перегляд
        </button>
        <button
          onClick={handleOrder}
          className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
        >
          Оформити замовлення →
        </button>
      </div>

      {/* MAIN AREA */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT ICON STRIP */}
        <div className="w-16 flex-shrink-0 bg-gray-900 flex flex-col">
          {PANELS.map(panel => (
            <button
              key={panel.id}
              onClick={() => setLeftPanel(panel.id)}
              className={`w-full flex flex-col items-center py-3 gap-1 text-xs transition-colors ${
                leftPanel === panel.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-xl">{panel.icon}</span>
              <span className="text-[10px]">{panel.label}</span>
            </button>
          ))}
        </div>

        {/* LEFT PANEL (expanded) */}
        <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
          {/* PANEL: IMAGES */}
          {leftPanel === 'images' && (
            <div className="p-3 flex flex-col gap-3 h-full">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Ваші фото
              </p>

              {/* Upload buttons */}
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50 text-sm text-gray-600">
                <span>🖥</span> З комп'ютера
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                />
              </label>

              {/* Drag & drop zone */}
              <div
                onDrop={handleDropToGallery}
                onDragOver={e => e.preventDefault()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center text-xs text-gray-400 min-h-[80px] flex items-center justify-center"
              >
                або перетягніть сюди
              </div>

              {/* Photo count */}
              {photos.length > 0 && (
                <p className="text-xs text-gray-500">Завантажено: {photos.length} фото</p>
              )}

              {/* Thumbnail grid */}
              <div className="grid grid-cols-2 gap-1.5 overflow-y-auto flex-1">
                {photos.map(photo => (
                  <div
                    key={photo.id}
                    draggable
                    onDragStart={() => setDraggingPhoto(photo)}
                    onDragEnd={() => setDraggingPhoto(null)}
                    className="relative aspect-square rounded-md overflow-hidden cursor-grab active:cursor-grabbing group"
                  >
                    <Image src={photo.preview} alt={photo.name} fill className="object-cover" />
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PANEL: LAYOUTS */}
          {leftPanel === 'layouts' && (
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Макет розвороту</p>
              <div className="grid grid-cols-2 gap-2">
                {LAYOUTS.map(layout => (
                  <button
                    key={layout.id}
                    onClick={() => applyLayout(layout.id)}
                    className={`border-2 rounded-lg p-3 aspect-[2/1] relative overflow-hidden transition ${
                      spreads[currentSpread]?.layout === layout.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{layout.icon}</div>
                    <p className="text-[10px] text-gray-500 text-center">{layout.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PANEL: BACKGROUNDS */}
          {leftPanel === 'backgrounds' && (
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Фон</p>
              <div className="grid grid-cols-4 gap-2">
                {BACKGROUNDS.map(color => (
                  <button
                    key={color}
                    onClick={() => setSpreadBackground(color)}
                    className="w-10 h-10 rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-colors"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* PANEL: OPTIONS */}
          {leftPanel === 'options' && (
            <div className="p-4 space-y-3 text-sm">
              <h3 className="font-bold text-gray-700">Налаштування</h3>
              <div className="space-y-2 text-gray-600">
                {config.coverTypeLabel && <p>Тип обкладинки: {config.coverTypeLabel}</p>}
                <p>Розмір: {config.size}</p>
                <p>Сторінок: {config.pages}</p>
                <p className="font-semibold text-gray-900">Ціна: {config.totalPrice} ₴</p>
                <p className="text-xs text-gray-400">Менеджер підтвердить фінальну вартість</p>
              </div>
              <button
                onClick={addSpread}
                className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold"
              >
                + Додати 2 сторінки
              </button>
              <button
                onClick={removeLastSpread}
                disabled={spreads.length <= 2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-30"
              >
                − Видалити останній розворот
              </button>
            </div>
          )}

          {/* PANEL: CLIPARTS */}
          {leftPanel === 'cliparts' && (
            <div className="p-4 text-center text-gray-400 text-sm">
              Функція декорування буде додана
            </div>
          )}

          {/* PANEL: FRAMES */}
          {leftPanel === 'frames' && (
            <div className="p-4 text-center text-gray-400 text-sm">
              Функція рамок буде додана
            </div>
          )}
        </div>

        {/* CANVAS AREA */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden relative">
            <div className="flex-1 flex items-center justify-center p-6 bg-gray-200 overflow-hidden h-full">
              {renderCanvas()}
            </div>
          </div>

          {/* BOTTOM FILMSTRIP */}
          <div className="h-28 flex-shrink-0 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] flex flex-col">
            {/* Controls row */}
            <div className="flex items-center px-4 py-1.5 gap-3 border-b border-gray-100">
              <span className="text-xs text-gray-500">
                {spreads[currentSpread]?.label} · {spreads.length} розворотів
              </span>
              <div className="flex-1" />
              <button
                onClick={handleAutoFill}
                className="text-xs text-blue-600 hover:underline"
              >
                Авто-заповнення
              </button>
              <button
                onClick={addSpread}
                className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
              >
                + Розворот
              </button>
              <button
                onClick={removeLastSpread}
                disabled={spreads.length <= 2}
                className="text-xs px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-30"
              >
                − Розворот
              </button>
            </div>

            {/* Thumbnails strip */}
            <div className="flex-1 flex items-center gap-2 px-4 overflow-x-auto">
              {spreads.map((spread, i) => (
                <button
                  key={spread.id}
                  onClick={() => setCurrentSpread(i)}
                  className="flex-shrink-0 flex flex-col items-center gap-1 group"
                >
                  <div
                    className={`relative bg-white border-2 rounded-sm overflow-hidden transition-all shadow-sm ${
                      currentSpread === i
                        ? 'border-blue-500 shadow-md'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    style={{
                      width: `${48 * sizeConfig.spreadRatio}px`,
                      height: '48px',
                    }}
                  >
                    <SpreadThumbnail spread={spread} />
                  </div>
                  <span className="text-[10px] text-gray-400 max-w-[64px] truncate">
                    {spread.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-64 flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Властивості</h3>
          <div className="text-sm text-gray-500">
            <p>Натисніть на елемент для редагування</p>
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-400">
                Макет: {LAYOUTS.find(l => l.id === spreads[currentSpread]?.layout)?.label}
              </p>
              <button
                onClick={() => setLeftPanel('layouts')}
                className="text-xs text-blue-600 hover:underline"
              >
                Змінити макет
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
