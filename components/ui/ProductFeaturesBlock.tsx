'use client';
import { useState } from 'react';
import Image from 'next/image';

//  Types 

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

//  Photobook cover data 

const COVER_TYPES: CoverType[] = [
  {
    id: 'velour',
    label: 'Велюр',
    emoji: '',
    description: 'М\'яка оксамитова поверхня, приємна на дотик. 14 кольорів. Ідеальна для ніжних, романтичних альбомів.',
    swatchColors: [
      '#F0EAD6','#D9C8B0','#A89880','#E8B4B8', // Молочний, Бежевий, Таупе, Рожевий
      '#7A2838','#9A9898','#B8A8C8','#1A2040', // Бордо, Сірий перловий, Лаванда, Синій
      '#3A3038','#1A9090','#6E2840','#607080', // Графітовий, Бірюзовий, Марсала, Блакитно-сірий
      '#1E3028','#D4A020',                     // Темно-зелений, Жовтий
    ],
    decorations: [
      { id: 'none',         label: 'Без оздоблення', imageUrl: '' },
      { id: 'acryl',        label: 'Акрил',           imageUrl: '/decorations/acryl.jpg' },
      { id: 'photovstavka', label: 'Фотовставка',     imageUrl: '/decorations/photovstavka.jpg' },
      { id: 'flex',         label: 'Друк кольором',   imageUrl: '/decorations/flex.jpg' },
      { id: 'metal',        label: 'Металева вставка',           imageUrl: '/decorations/metal.jpg' },
      { id: 'graviruvannya', label: 'Гравіювання',     imageUrl: '/decorations/graviruvannya.jpg' },
    ],
  },
  {
    id: 'leatherette',
    label: 'Шкірзамінник',
    emoji: '',
    description: 'Текстурована поверхня під шкіру. Виглядає солідно та елегантно. 24 кольори.',
    swatchColors: [
      '#F5F5F0','#D9C8B0','#D4A76A','#C8844E', // Білий, Бежевий, Пісочний, Рудий
      '#7A2838','#C4A83A','#C25A3C','#F0B820', // Бордо темний, Золотистий, Теракотовий, Жовтий
      '#E8B4B8','#D84080','#A01030','#8E5038', // Рожевий ніжний, Фуксія, Червоний насичений, Коричневий
      '#7A2020','#6E2840','#3A3038','#8030A0', // Вишневий, Марсала, Графітовий темний, Фіолетовий яскравий
      '#502060','#4E9090','#A0A030','#1E3028', // Фіолетовий темний, Бірюзовий, Оливковий, Темно-зелений
      '#00B0B0','#0088D0','#1A2040','#1A1A1A', // Бірюзовий яскравий, Блакитний яскравий, Темно-синій, Чорний
    ],
    decorations: [
      { id: 'none',         label: 'Без оздоблення', imageUrl: '' },
      { id: 'acryl',        label: 'Акрил',           imageUrl: '/decorations/acryl.jpg' },
      { id: 'photovstavka', label: 'Фотовставка',     imageUrl: '/decorations/photovstavka.jpg' },
      { id: 'flex',         label: 'Друк кольором',   imageUrl: '/decorations/flex.jpg' },
      { id: 'metal',        label: 'Металева вставка', imageUrl: '/decorations/metal.jpg' },
    ],
  },
  {
    id: 'fabric',
    label: 'Тканина',
    emoji: '',
    description: 'Натуральна текстура тканини, легка та тепла. 9 кольорів. Відмінно підходить для сімейних альбомів.',
    swatchColors: [
      '#C4AA88','#A04838','#B838A0', // Бежевий/пісочний, Теракотовий/цегляний, Фуксія/пурпурний
      '#582050','#602838','#6E4830', // Фіолетовий темний, Марсала/бордо, Коричневий
      '#586058','#C02030','#A0A020', // Сірий/графітовий, Червоний яскравий, Оливковий/зелений
    ],
    decorations: [
      { id: 'none',         label: 'Без оздоблення', imageUrl: '' },
      { id: 'acryl',        label: 'Акрил',           imageUrl: '/decorations/acryl.jpg' },
      { id: 'photovstavka', label: 'Фотовставка',     imageUrl: '/decorations/photovstavka.jpg' },
      { id: 'flex',         label: 'Друк кольором',       imageUrl: '/decorations/flex.jpg' },
    ],
  },
  {
    id: 'printed',
    label: 'Друкована',
    emoji: '',
    description: 'Повноколірний друк вашого фото прямо на обкладинці. Найбільш персоналізований варіант.',
    laminationTypes: [
      { id: 'glossy', label: 'Глянцева', imageUrl: '/lamination/glossy.jpg' },
      { id: 'matte',  label: 'Матова',  imageUrl: '/lamination/matte.jpg' },
    ],
  },
];

//  Cover selector component 

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
            {c.label}
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
            {cover.label}
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


//  Journal cover comparison 

function JournalCoversSection() {
  const [activeTab, setActiveTab] = useState<'soft' | 'hard'>('soft');

  const covers = {
    soft: {
      label: "М'яка обкладинка",
      emoji: "",
      color: '#f0f3ff',
      border: '#1e2d7d',
      features: [
        { icon: '', title: 'Легша та тонша', text: 'Обкладинка з картону 300г, ламінована. Зручно брати з собою в дорогу.' },
        { icon: '', title: 'Доступніша ціна', text: 'Відмінний вибір для великих тиражів — весільних газет, корпоративних журналів.' },
        { icon: '', title: 'Формат А4', text: 'Стандартний журнальний формат. Ламінація: глянцева.' },
        { icon: '', title: 'Скоба або клей', text: 'До 44 сторінок — скоба, понад 44 — термоклей. Лежить рівно.' },
      ],
      badgeText: 'Глянцева ламінація',
      bgGradient: 'linear-gradient(135deg, #f0f3ff 0%, #e8ecff 100%)',
    },
    hard: {
      label: 'Тверда обкладинка',
      emoji: '',
      color: '#f0fdf4',
      border: '#15803d',
      features: [
        { icon: '', title: 'Міцна та довговічна', text: 'Обкладинка з твердого картону 2 мм, покрита друкованою поверхнею.' },
        { icon: '', title: 'Преміальний вигляд', text: 'Ідеальна для фотожурналів, портфоліо, корпоративних видань що мають зберігатись роками.' },
        { icon: '', title: 'Формат А4', text: 'Стандартний журнальний формат А4. Тримає форму без деформацій.' },
        { icon: '', title: 'Книжкова палітурка', text: 'Клейова палітурка на термоклей. Сторінки не випадають, лежить рівно.' },
      ],
      badgeText: 'Преміальна серія',
      bgGradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    },
  };

  const active = covers[activeTab];

  return (
    <div style={{ marginTop: 64, marginBottom: 32 }}>
      <h2 style={{ fontSize: 28, fontWeight: 900, color: '#1e2d7d', marginBottom: 8, textAlign: 'center' }}>
        М'яка vs Тверда обкладинка
      </h2>
      <p style={{ textAlign: 'center', color: '#64748b', fontSize: 15, marginBottom: 32 }}>
        Оберіть тип обкладинки щоб дізнатись більше
      </p>

      {/* Toggle */}
      <div style={{ display: 'flex', gap: 0, justifyContent: 'center', marginBottom: 32,
        border: '1.5px solid #e2e8f0', borderRadius: 12, width: 'fit-content', margin: '0 auto 32px', overflow: 'hidden' }}>
        {(['soft', 'hard'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '12px 32px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
              background: activeTab === tab ? '#1e2d7d' : '#fff',
              color: activeTab === tab ? '#fff' : '#374151',
              transition: 'all 0.2s' }}>
            {tab === 'soft' ? "М'яка" : 'Тверда'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start',
        maxWidth: 1000, margin: '0 auto' }}>

        {/* Left — visual mockup */}
        <div style={{ borderRadius: 16, padding: 40, background: active.bgGradient,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 320, position: 'relative' }}>
          {/* Book mockup */}
          <div style={{ position: 'relative', width: 180 }}>
            {/* Cover */}
            <div style={{
              width: 160, height: 220, borderRadius: activeTab === 'hard' ? '2px 10px 10px 2px' : '2px 6px 6px 2px',
              background: activeTab === 'hard'
                ? 'linear-gradient(135deg, #1e2d7d, #3b4fc5)'
                : 'linear-gradient(135deg, #475569, #64748b)',
              boxShadow: activeTab === 'hard'
                ? '4px 4px 20px rgba(30,45,125,0.4), -2px 0 6px rgba(0,0,0,0.2)'
                : '3px 3px 15px rgba(0,0,0,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Spine */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: activeTab === 'hard' ? 16 : 8,
                background: 'rgba(0,0,0,0.3)', borderRadius: '2px 0 0 2px' }}/>
              {/* Content */}
              <div style={{ textAlign: 'center', color: '#fff', padding: '0 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', opacity: 0.9 }}>
                  ФОТОЖУРНАЛ
                </div>
              </div>
              {/* Pages edge */}
              <div style={{ position: 'absolute', right: -6, top: 4, bottom: 4,
                width: 6, background: 'linear-gradient(to right, #e2e8f0, #fff)',
                borderRadius: '0 2px 2px 0' }}/>
            </div>
          </div>
          {/* Badge */}
          <div style={{ marginTop: 20, padding: '6px 16px', background: 'rgba(255,255,255,0.9)',
            borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#374151',
            border: `1.5px solid ${active.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            {active.badgeText}
          </div>
        </div>

        {/* Right — features */}
        <div>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: '#1e2d7d', marginBottom: 6 }}>
            {active.label}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
            {active.features.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start',
                padding: '14px 16px', background: '#fff', borderRadius: 10,
                border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1e2d7d', marginBottom: 3 }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{f.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

//  Features grid 

interface ProductFeaturesBlockProps {
  features?: Feature[];
  isPhotobook?: boolean;
  isJournal?: boolean;
}

export function ProductFeaturesBlock({ features, isPhotobook, isJournal }: ProductFeaturesBlockProps) {
  const hasFeatures = features && features.length > 0;
  const showCovers = isPhotobook;
  const showJournalCovers = isJournal;

  if (!hasFeatures && !showCovers && !showJournalCovers) return null;

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
                      <span style={{ fontSize: 48 }}></span>
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

      {/* Journal cover comparison */}
      {showJournalCovers && <JournalCoversSection />}
    </div>
  );
}
