# Auto Build — план реалізації для TouchMemories

## Ідея (натхнення: SmartAlbums by Pixellu)

Кнопка "Auto Build" / "Магічна збірка" яка за один клік:
1. Аналізує завантажені фото (орієнтація, розміри)
2. Розраховує оптимальну кількість розворотів
3. Обирає layouts для кожного розвороту
4. Розставляє фото з урахуванням орієнтації
5. Додає розвороти якщо потрібно

## Архітектура

### Новий файл: `lib/editor/auto-build.ts`

```typescript
interface AutoBuildOptions {
  photos: PhotoData[];           // всі завантажені фото
  pageCount: number;             // базова кількість сторінок з конфігу
  minPages: number;              // мінімум сторінок
  maxPhotosPerSpread?: number;   // макс фото на розворот (default 4)
  variety: 'min' | 'medium' | 'max'; // повторюваність шаблонів
  coverPhotoId?: string | null;  // фото для обкладинки
  hasKalka?: boolean;
  hasEndpaper?: boolean;
}

interface AutoBuildResult {
  pages: Page[];                 // масив сторінок
  freeSlots: Record<number, FreeSlot[]>; // слоти з фото
  coverPhotoId: string | null;   // фото обкладинки
  addedSpreads: number;          // скільки розворотів додано
}

function autoBuild(options: AutoBuildOptions): AutoBuildResult
```

### Алгоритм (покроково)

#### Крок 1: Класифікація фото
```
for each photo:
  - orientation: 'landscape' | 'portrait' | 'square'
    (landscape: width/height > 1.2, portrait: height/width > 1.2, else square)
  - megapixels: width * height
  - quality: 'high' (>= 8MP) | 'medium' (3-8MP) | 'low' (<3MP)
```

#### Крок 2: Вибір фото для обкладинки
```
if no cover photo selected:
  - prefer landscape or square with highest megapixels
  - remove from pool
```

#### Крок 3: Групування фото в розвороти
SmartAlbums використовує "Smart Grouping" по часу/метадатам.
Ми спрощуємо — групуємо по орієнтації для кращих layouts:

```
groups = []
remaining = [...photos without cover]

Strategy "balanced" (default):
  - Target: 2-3 photos per spread (виглядає найкраще)
  - Розворот = 2 сторінки, кожна отримує свій layout
  
  while remaining.length > 0:
    // Скільки фото на цей розворот?
    // Залежить від залишку та variety
    photosForSpread = takeNext(remaining, 2-4)
    
    // Розділити між лівою та правою сторінкою
    leftPhotos = photosForSpread.slice(0, ceil(len/2))
    rightPhotos = photosForSpread.slice(ceil(len/2))
    
    groups.push({ left: leftPhotos, right: rightPhotos })
```

#### Крок 4: Вибір layouts для кожної сторінки
```
for each page with N photos:
  candidates = LAYOUTS.filter(l => l.slots === N)
  
  // Фільтр по орієнтації фото:
  // - Якщо всі портретні → prefer вертикальні layouts (p-2-v, p-3-col)
  // - Якщо всі ландшафтні → prefer горизонтальні (p-2-h, p-3-row)
  // - Мікс → prefer grid/hero layouts
  
  // Variety control:
  // - 'min': ніколи не повторювати layout підряд
  // - 'medium': не повторювати на сусідніх розворотах
  // - 'max': дозволяти повтори (consistent feel)
  
  selectedLayout = pickBest(candidates, orientations, usedLayouts, variety)
```

#### Крок 5: Створення FreeSlots з фото
```
for each page:
  slotDefs = getSlotDefs(selectedLayout, pageW, cH)
  freeSlots[pageIdx] = slotDefs.map((def, i) => ({
    id: 'free-' + Date.now() + '-' + i,
    x: def.s.left, y: def.s.top,
    w: def.s.width, h: def.s.height,
    shape: 'rect',
    photoId: assignedPhotos[i]?.id || null,
    cropX: 50, cropY: 50, zoom: 1,
  }))
```

#### Крок 6: Додавання розворотів якщо потрібно
```
requiredSpreads = groups.length
currentSpreads = (pages.length - 1) / 2

if requiredSpreads > currentSpreads:
  addSpreads(requiredSpreads - currentSpreads)
```

### Layout scoring (орієнтація → layout)

```typescript
const LAYOUT_SCORES: Record<string, {
  bestFor: ('landscape' | 'portrait' | 'square' | 'mixed')[],
  visualWeight: number, // 1-5, hero=5, grid=2
}> = {
  // 1 фото
  'p-full':    { bestFor: ['landscape', 'square'], visualWeight: 5 },
  'p-center':  { bestFor: ['portrait', 'square'],  visualWeight: 3 },
  'p-top':     { bestFor: ['landscape'],            visualWeight: 3 },
  'p-bottom':  { bestFor: ['landscape'],            visualWeight: 3 },
  'p-left':    { bestFor: ['portrait'],             visualWeight: 3 },
  'p-right':   { bestFor: ['portrait'],             visualWeight: 3 },
  
  // 2 фото
  'p-2-v':         { bestFor: ['portrait'],              visualWeight: 3 },
  'p-2-h':         { bestFor: ['landscape'],             visualWeight: 3 },
  'p-2-big-top':   { bestFor: ['landscape', 'mixed'],    visualWeight: 4 },
  'p-2-big-left':  { bestFor: ['portrait', 'mixed'],     visualWeight: 4 },
  'p-2-diag':      { bestFor: ['square', 'mixed'],       visualWeight: 4 },
  
  // 3 фото  
  'p-3-row':       { bestFor: ['portrait'],              visualWeight: 2 },
  'p-3-col':       { bestFor: ['landscape'],             visualWeight: 2 },
  'p-3-hero-top':  { bestFor: ['landscape', 'mixed'],    visualWeight: 4 },
  'p-3-hero-left': { bestFor: ['portrait', 'mixed'],     visualWeight: 4 },
  
  // 4 фото
  'p-4-grid':      { bestFor: ['mixed', 'square'],       visualWeight: 2 },
  'p-4-hero-top':  { bestFor: ['landscape', 'mixed'],    visualWeight: 4 },
  'p-4-hero-left': { bestFor: ['portrait', 'mixed'],     visualWeight: 4 },
};
```

### UI — модальне вікно Auto Build

```
┌──────────────────────────────────────┐
│  ✨ Автоматична збірка               │
│                                       │
│  Фото: 47 завантажено                │
│  Розвороти: ~12 (24 сторінки)        │
│                                       │
│  Фото на розворот:                    │
│  ○ 1-2 (мінімалістично)              │
│  ● 2-3 (збалансовано)                │
│  ○ 3-5 (максимум фото)              │
│                                       │
│  Різноманітність шаблонів:           │
│  [━━━━━━━━●━━━] medium               │
│                                       │
│  ☐ Перше фото на обкладинку          │
│  ☐ Додати розвороти якщо потрібно    │
│                                       │
│  [Скасувати]  [✨ Зібрати книгу]     │
└──────────────────────────────────────┘
```

### Інтеграція в BookLayoutEditor

1. **Кнопка** — замінити/доповнити існуючу "Авто" кнопку в topbar
2. **Модалка** — показати налаштування перед збіркою
3. **Виконання** — `autoBuild()` повертає нові pages + freeSlots
4. **Застосування** — `pushHistory()` → `setPages()` → `setFreeSlots()`
5. **Toast** — "Книгу зібрано! 24 сторінки, 47 фото"

### Файли які потрібно створити/змінити

| Файл | Дія |
|---|---|
| `lib/editor/auto-build.ts` | **NEW** — алгоритм Auto Build |
| `components/editor/AutoBuildModal.tsx` | **NEW** — UI модалка з налаштуваннями |
| `components/BookLayoutEditor.tsx` | **EDIT** — додати кнопку + виклик модалки |

### Оцінка часу
- `auto-build.ts` алгоритм: ~200 рядків
- `AutoBuildModal.tsx` UI: ~150 рядків  
- Інтеграція: ~30 рядків
- **Загалом: ~380 рядків, 1 сесія Claude**

### Порядок реалізації
1. Створити `auto-build.ts` з алгоритмом
2. Створити `AutoBuildModal.tsx` 
3. Підключити в BookLayoutEditor
4. Тестувати з різною кількістю фото (5, 20, 50, 100)
5. Налаштувати scoring таблицю

### Відмінність від SmartAlbums
SmartAlbums має:
- Smart Grouping по EXIF timestamp → ми не маємо EXIF (фото як base64)
- Metadata (ч/б detection) → можемо додати пізніше через canvas sampling
- Lightroom ratings → не релевантно

Наш підхід:
- Групування по орієнтації (portrait/landscape) — працює без EXIF
- Variety control як в SmartAlbums
- Layout scoring по орієнтації фото — SmartAlbums теж це робить
- Додавання розворотів автоматично — як SmartAlbums Auto Build
