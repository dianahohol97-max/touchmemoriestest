'use client';
import { useState } from 'react';
import Image from 'next/image';

// ── Types ────────────────────────────────────────────────────────────────────

interface Feature {
  title: string;
  description: string;
  imageUrl?: string;
  imagePosition?: 'left' | 'right'; // alternating
}

interface CoverType {
  id: string;
  label: string;
  emoji: string;
  description: string;
  swatchColors?: string[];
  decorations?: Decoration[];
  laminationTypes?: LaminationType[];
  previewImage?: string;
}

interface Decoration {
  id: string;
  label: string;
  imageUrl: string;
}

interface LaminationType {
  id: string;
  label: string;
  imageUrl: string;
}

// ── Photobook cover data ─────────────────────────────────────────────────────

const COVER_TYPES: CoverType[] = [
  {
    id: 'velour',
    label: 'Велюр',
    emoji: '🟣',
    description: 'М\'яка оксамитова поверхня, приємна на дотик. 16 кольорів. Ідеальна для ніжних, романтичних альбомів.',
    swatchColors: ['#f3e8ff','#ddd6fe','#c4b5fd','#a78bfa','#7c3aed','#5b21b6','#fce7f3','#fbcfe8','#f472b6','#ec4899','#fef3c7','#fde68a','#f59e0b','#d97706','#f0fdf4','#86efac'],
    decorations: [
      { id: 'none',         label: 'Без оздоблення', imageUrl: '' },
      { id: 'acryl',        label: 'Акрил',           imageUrl: '/decorations/acryl.jpg' },
      { id: 'photovstavka', label: 'Фотовставка',     imageUrl: '/decorations/photovstavka.jpg' },
      { id: 'flex',         label: 'Фото Flex',       imageUrl: '/decorations/flex.jpg' },
      { id: 'metal',        label: 'Метал',           imageUrl: '/decorations/metal.jpg' },
      { id: 'graviruvannya',label: 'Гравіювання',     imageUrl: '/decorations/graviruvannya.jpg' },
    ],
  },
  {
    id: 'leatherette',
    label: 'Шкірзамінник',
    emoji: '🟤',
    description: 'Текстурована поверхня під шкіру. Виглядає солідно та елегантно. 12 кольорів.',
    swatchColors: ['#fafafa','#f5f0e8','#e8d5b7','#d4a96a','#c49a6c','#8b4513','#6b3a2a','#4a1e0f','#1a1a1a','#2d4a3e','#1e3a5f','#3b1f5e'],
    decorations: [
      { id: 'none',         label: 'Без оздоблення', imageUrl: '' },
      { id: 'acryl',        label: 'Акрил',           imageUrl: '/decorations/acryl.jpg' },
      { id: 'photovstavka', label: 'Фотовставка',     imageUrl: '/decorations/photovstavka.jpg' },
      { id: 'flex',         label: 'Фото Flex',       imageUrl: '/decorations/flex.jpg' },
      { id: 'metal',        label: 'Метал',           imageUrl: '/decorations/metal.jpg' },
      { id: 'graviruvannya',label: 'Гравіювання',     imageUrl: '/decorations/graviruvannya.jpg' },
    ],
  },
  {
    id: 'fabric',
    label: 'Тканина',
    emoji: '🟡',
    description: 'Натуральна текстура тканини, легка та тепла. 10 кольорів. Відмінно підходить для сімейних альбомів.',
    swatchColors: ['#fef9e7','#fef3c7','#fde68a','#fcd34d','#f0fdf4','#dcfce7','#bbf7d0','#86efac','#f0f9ff','#bae6fd','#7dd3fc','#38bdf8'],
    decorations: [
      { id: 'none',         label: 'Без оздоблення', imageUrl: '' },
      { id: 'acryl',        label: 'Акрил',           imageUrl: '/decorations/acryl.jpg' },
      { id: 'photovstavka', label: 'Фотовставка',     imageUrl: '/decorations/photovstavka.jpg' },
      { id: 'flex',         label: 'Фото Flex',       imageUrl: '/decorations/flex.jpg' },
    ],
  },
  {
    id: 'printed',
    label: 'Друкована',
    emoji: '🖨️',
    description: 'Повноколірний друк вашого фото прямо на обкладинці. Найбільш персоналізований варіант.',
    laminationTypes: [
      { id: 'glossy', label: 'Глянцева', imageUrl: '/lamination/glossy.jpg' },
      { id: 'matte',  label: 'Матова',  imageUrl: '/lamination/matte.jpg' },
    ],
  },
];

// ── Cover selector component ─────────────────────────────────────────────────

function PhotobookCoversSection() {
  const [activeCover, setActiveCover] = useState<string>('velour');
  const [activeDecoration, setActiveDecoration] = useState<string>('none');
  const [activeLamination, setActiveLamination] = useState<string>('glossy');

  const cover = COVER_TYPES.find(c => c.id === activeCover)!;

  return (
    <div style={{ marginTop: 64, marginBottom: 64 }}>
      <h2 style={{ fontSize: 28, fontWeight: 900, color: '#1e2d7d', marginBottom: 8, textAlign: 'center' }}>
        Типи обкладинок
      </h2>
      <p style={{ textAlign: 'center', color: '#64748b', fontSize: 15, marginBottom: 36 }}>
        Оберіть матеріал обкладинки щоб побачити приклади
      </p>

      {/* Cover type tabs */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 32, flexWrap: 'wrap' }}>
        {COVER_TYPES.map(c => (
          <button key={c.id} onClick={() => { setActiveCover(c.id); setActiveDecoration('none'); setActiveLamination('glossy'); }}
            style={{ padding: '10px 24px', borderRadius: 40, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
              background: activeCover === c.id ? '#1e2d7d' : '#f1f5f9',
              color: activeCover === c.id ? '#fff' : '#374151',
              transition: 'all 0.2s', boxShadow: activeCover === c.id ? '0 4px 12px rgba(30,45,125,0.25)' : 'none' }}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* Cover content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start', maxWidth: 1000, margin: '0 auto' }}>

        {/* Left — visual */}
        <div>
          {/* Cover preview placeholder */}
          <div style={{ aspectRatio: '4/3', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 16 }}>
            {cover.id !== 'printed' && activeDecoration !== 'none' && cover.decorations?.find(d => d.id === activeDecoration)?.imageUrl ? (
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <img
                  src={cover.decorations?.find(d => d.id === activeDecoration)?.imageUrl}
                  alt={activeDecoration} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : cover.id === 'printed' && cover.laminationTypes?.find(l => l.id === activeLamination)?.imageUrl ? (
              <img src={cover.laminationTypes?.find(l => l.id === activeLamination)?.imageUrl}
                alt={activeLamination} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 64, marginBottom: 12 }}>{cover.emoji}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1e2d7d', marginBottom: 4 }}>{cover.label}</div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Приклад буде після завантаження фото</div>
              </div>
            )}
          </div>

          {/* Swatch colors */}
          {cover.swatchColors && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Доступні кольори
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {cover.swatchColors.map((hex, i) => (
                  <div key={i} style={{ width: 24, height: 24, borderRadius: '50%', background: hex,
                    border: '1.5px solid rgba(0,0,0,0.1)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — options */}
        <div>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: '#1e2d7d', marginBottom: 8 }}>
            {cover.emoji} {cover.label}
          </h3>
          <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.7, marginBottom: 28 }}>
            {cover.description}
          </p>

          {/* Decorations (velour, leatherette, fabric) */}
          {cover.decorations && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Оздоблення обкладинки
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {cover.decorations.map(d => (
                  <button key={d.id} onClick={() => setActiveDecoration(d.id)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                      background: activeDecoration === d.id ? '#1e2d7d' : '#f1f5f9',
                      color: activeDecoration === d.id ? '#fff' : '#374151',
                      transition: 'all 0.15s', boxShadow: activeDecoration === d.id ? '0 2px 8px rgba(30,45,125,0.2)' : 'none' }}>
                    {d.label}
                  </button>
                ))}
              </div>
              {activeDecoration !== 'none' && (
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' }}>
                  Натисніть на оздоблення щоб побачити приклад на фото зліва
                </p>
              )}
            </div>
          )}

          {/* Lamination (printed only) */}
          {cover.laminationTypes && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Порівняння ламінації
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {cover.laminationTypes.map(l => (
                  <button key={l.id} onClick={() => setActiveLamination(l.id)}
                    style={{ padding: '16px', borderRadius: 10, border: activeLamination === l.id ? '2.5px solid #1e2d7d' : '1.5px solid #e2e8f0',
                      cursor: 'pointer', background: activeLamination === l.id ? '#f0f3ff' : '#fff',
                      transition: 'all 0.15s', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{l.id === 'glossy' ? '✨' : '🫧'}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: activeLamination === l.id ? '#1e2d7d' : '#374151' }}>
                      {l.label}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                      {l.id === 'glossy' ? 'Яскраві кольори, глянцевий блиск' : 'М\'який вигляд, без відблисків'}
                    </div>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' }}>
                Оберіть ламінацію щоб побачити порівняння зліва
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Features grid ────────────────────────────────────────────────────────────

interface ProductFeaturesBlockProps {
  features?: Feature[];
  isPhotobook?: boolean;
}

export function ProductFeaturesBlock({ features, isPhotobook }: ProductFeaturesBlockProps) {
  const hasFeatures = features && features.length > 0;
  const showCovers = isPhotobook;

  if (!hasFeatures && !showCovers) return null;

  return (
    <div style={{ paddingTop: 64, paddingBottom: 32 }}>

      {/* Characteristics section */}
      {hasFeatures && (
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: '#1e2d7d', marginBottom: 8, textAlign: 'center' }}>
            Характеристики
          </h2>
          <p style={{ textAlign: 'center', color: '#64748b', fontSize: 15, marginBottom: 48 }}>
            Деталі які роблять наш продукт особливим
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 64 }}>
            {features!.map((feat, i) => {
              const imgLeft = (i % 2 === 0) !== (feat.imagePosition === 'right');
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center',
                  ...(imgLeft ? {} : { direction: 'rtl' }) }}>
                  {/* Image */}
                  {feat.imageUrl ? (
                    <div style={{ borderRadius: 16, overflow: 'hidden', aspectRatio: '4/3', position: 'relative', direction: 'ltr' }}>
                      <img src={feat.imageUrl} alt={feat.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ borderRadius: 16, background: '#f1f5f9', aspectRatio: '4/3', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', direction: 'ltr' }}>
                      <span style={{ fontSize: 48 }}>📸</span>
                    </div>
                  )}
                  {/* Text */}
                  <div style={{ direction: 'ltr' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', marginBottom: 8,
                      textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <h3 style={{ fontSize: 22, fontWeight: 800, color: '#1e2d7d', marginBottom: 12, lineHeight: 1.3 }}>
                      {feat.title}
                    </h3>
                    <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.8 }}>
                      {feat.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Photobook covers section */}
      {showCovers && <PhotobookCoversSection />}
    </div>
  );
}
