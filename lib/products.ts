// Constants mapping specific features of TouchMemories product catalog

export interface PhotoBookPriceTable {
  [pages: number]: {
    '20x20': number | null;
    '25x25': number | null;
    '20x30_30x20': number | null;
    '30x30': number | null;
  };
}

export interface PhotoBookTier {
  name: string;
  description: string;
  productionTime: string;
  coverDesign: string;
  prices: PhotoBookPriceTable;
}

export interface PhotoBookProduct {
  id: string;
  name: string;
  description: string;
  formats: {
    id: string;
    name: string;
    canvasDimensions: string;
    priceKey: '20x20' | '25x25' | '20x30_30x20' | '30x30';
  }[];
  pagesAvailable: number[];
  extras: {
    name: string;
    priceFlat: number;
    unit: string;
  }[];
  tiers: {
    standard: PhotoBookTier;
    premium: PhotoBookTier;
  };
}

export interface TravelBookProduct {
  id: string;
  name: string;
  description: string;
  format: string;
  canvasDimensions: string;
  productionTime: string;
  pagesAvailable: number[];
  prices: Record<number, number>;
  extras: Record<string, string | number>;
}

export interface PhotoJournalProduct {
  id: string;
  name: string;
  description: string;
  format: string;
  canvasDimensions: string;
  productionTime: string;
  binding?: string;
  pagesAvailable: number[];
  prices: Record<number, number>;
  extras: Record<string, string | number>;
}

export interface PhotoPrintsProduct {
  id: string;
  name: string;
  description: string;
  equipment: string;
  papers: string[];
  minimumOrder: number;
  discount: string;
  fileRequirements: string[];
  productionTime: string;
  classicSizes: {
    size: string;
    price: number;
    notes?: string;
  }[];
  nonStandardSizes: {
    size: string;
    price: number;
    multipleOf: number;
    notes?: string;
  }[];
  polaroid: {
    size: string;
    price: number;
    multipleOf: number;
    notes?: string;
  }[];
  photoStrips: {
    description: string;
    pricePerSet: number;
    photosTotal: number;
  };
}

export interface PosterProduct {
  id: string;
  name: string;
  sizes: {
    size: string;
    price: number;
  }[];
  designTypes: string[];
  optional: string;
}

export interface PhotoMagnetProduct {
  id: string;
  name: string;
  material: string;
  productionTime: string;
  pricePerSet: number;
  sets: {
    size: string;
    magnetsPerSet: number;
  }[];
}

export interface PuzzleProduct {
  id: string;
  name: string;
  productionTime: string;
  description: string;
  options: {
    size: string;
    pieces: number;
    price: number;
  }[];
}

export interface CalendarProduct {
  id: string;
  name: string;
  productionTime: string;
  optionalExtra: string;
  options: {
    type: string;
    details: string;
    price: number | string;
  }[];
}

export interface WishBookProduct {
  id: string;
  name: string;
  description: string;
  pages: number;
  productionTime: string;
  coverDesign: string;
  sizes: {
    size: string;
    canvasDimensions: string;
  }[];
  coverTypes: string[];
  pageColors: string[];
  prices: {
    size: string;
    coverType: string;
    pageColor: string;
    price: number;
  }[];
  accessories: {
    name: string;
    price: number;
  }[];
}

export const PHOTO_BOOKS: PhotoBookProduct = {
  id: 'photo_books',
  name: 'PHOTO BOOKS (Фотокниги)',
  description: 'Hard pages, photographic lab print, 180° lay-flat rotation.',
  formats: [
    { id: '20x20', name: '20×20 cm', canvasDimensions: '2362×2362 px', priceKey: '20x20' },
    { id: '25x25', name: '25×25 cm', canvasDimensions: '2953×2953 px', priceKey: '25x25' },
    { id: '20x30', name: '20×30 cm', canvasDimensions: '2362×3543 px', priceKey: '20x30_30x20' },
    { id: '30x20', name: '30×20 cm', canvasDimensions: '3543×2362 px', priceKey: '20x30_30x20' },
    { id: '30x30', name: '30×30 cm', canvasDimensions: '3543×3543 px', priceKey: '30x30' },
  ],
  pagesAvailable: [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50],
  extras: [
    { name: 'Tracing paper pages (калька)', priceFlat: 300, unit: 'UAH flat' },
  ],
  tiers: {
    standard: {
      name: 'Standard (Printed Cover)',
      description: 'Printed cover (Друкована обкладинка)',
      productionTime: '10–14 business days',
      coverDesign: 'FREE',
      prices: {
        6: { '20x20': 450, '25x25': null, '20x30_30x20': null, '30x30': null },
        8: { '20x20': 500, '25x25': 700, '20x30_30x20': null, '30x30': null },
        10: { '20x20': 550, '25x25': 770, '20x30_30x20': 740, '30x30': null },
        12: { '20x20': 600, '25x25': 845, '20x30_30x20': 815, '30x30': null },
        14: { '20x20': 650, '25x25': 995, '20x30_30x20': 890, '30x30': null },
        16: { '20x20': 700, '25x25': 1070, '20x30_30x20': 965, '30x30': 1105 },
        18: { '20x20': 750, '25x25': 1145, '20x30_30x20': 1040, '30x30': 1190 },
        20: { '20x20': 800, '25x25': 1220, '20x30_30x20': 1115, '30x30': 1275 },
        22: { '20x20': 850, '25x25': 1295, '20x30_30x20': 1190, '30x30': 1360 },
        24: { '20x20': 900, '25x25': 1370, '20x30_30x20': 1265, '30x30': 1445 },
        26: { '20x20': 950, '25x25': 1445, '20x30_30x20': 1340, '30x30': 1530 },
        28: { '20x20': 1000, '25x25': 1520, '20x30_30x20': 1415, '30x30': 1615 },
        30: { '20x20': 1050, '25x25': 1595, '20x30_30x20': 1490, '30x30': 1700 },
        32: { '20x20': 1110, '25x25': 1670, '20x30_30x20': 1565, '30x30': 1785 },
        34: { '20x20': 1170, '25x25': 1745, '20x30_30x20': 1640, '30x30': 1870 },
        36: { '20x20': 1230, '25x25': 1820, '20x30_30x20': 1715, '30x30': 1960 },
        38: { '20x20': 1290, '25x25': 1895, '20x30_30x20': 1790, '30x30': 2050 },
        40: { '20x20': 1350, '25x25': 1970, '20x30_30x20': 1865, '30x30': 2140 },
        42: { '20x20': 1410, '25x25': 2045, '20x30_30x20': 1940, '30x30': 2230 },
        44: { '20x20': 1470, '25x25': 2120, '20x30_30x20': 2015, '30x30': 2320 },
        46: { '20x20': 1530, '25x25': 2195, '20x30_30x20': 2090, '30x30': 2410 },
        48: { '20x20': 1590, '25x25': 2270, '20x30_30x20': 2165, '30x30': 2500 },
        50: { '20x20': 1650, '25x25': 2345, '20x30_30x20': 2240, '30x30': 2590 }
      }
    },
    premium: {
      name: 'Premium',
      description: 'Velour / Leatherette / Fabric cover (Велюр, Шкірзам, Тканина)',
      productionTime: '14 days',
      coverDesign: 'FREE',
      prices: {
        6: { '20x20': 1050, '25x25': null, '20x30_30x20': null, '30x30': null },
        8: { '20x20': 1100, '25x25': 1290, '20x30_30x20': null, '30x30': null },
        10: { '20x20': 1150, '25x25': 1365, '20x30_30x20': 1235, '30x30': null },
        12: { '20x20': 1200, '25x25': 1445, '20x30_30x20': 1365, '30x30': null },
        14: { '20x20': 1250, '25x25': 1525, '20x30_30x20': 1430, '30x30': null },
        16: { '20x20': 1300, '25x25': 1605, '20x30_30x20': 1495, '30x30': 1700 },
        18: { '20x20': 1350, '25x25': 1685, '20x30_30x20': 1560, '30x30': 1790 },
        20: { '20x20': 1400, '25x25': 1765, '20x30_30x20': 1625, '30x30': 1880 },
        22: { '20x20': 1450, '25x25': 1840, '20x30_30x20': 1690, '30x30': 1970 },
        24: { '20x20': 1500, '25x25': 1925, '20x30_30x20': 1755, '30x30': 2060 },
        26: { '20x20': 1550, '25x25': 2010, '20x30_30x20': 1840, '30x30': 2150 },
        28: { '20x20': 1600, '25x25': 2095, '20x30_30x20': 1920, '30x30': 2240 },
        30: { '20x20': 1650, '25x25': 2175, '20x30_30x20': 2000, '30x30': 2330 },
        32: { '20x20': 1700, '25x25': 2255, '20x30_30x20': 2080, '30x30': 2420 },
        34: { '20x20': 1750, '25x25': 2335, '20x30_30x20': 2160, '30x30': 2510 },
        36: { '20x20': 1800, '25x25': 2415, '20x30_30x20': 2240, '30x30': 2600 },
        38: { '20x20': 1850, '25x25': 2495, '20x30_30x20': 2320, '30x30': 2690 },
        40: { '20x20': 1900, '25x25': 2575, '20x30_30x20': 2400, '30x30': 2780 },
        42: { '20x20': 1950, '25x25': 2655, '20x30_30x20': 2480, '30x30': 2875 },
        44: { '20x20': 2000, '25x25': 2735, '20x30_30x20': 2560, '30x30': 2970 },
        46: { '20x20': 2050, '25x25': 2820, '20x30_30x20': 2640, '30x30': 3065 },
        48: { '20x20': 2100, '25x25': 2905, '20x30_30x20': 2720, '30x30': 3160 },
        50: { '20x20': 2150, '25x25': 2990, '20x30_30x20': 2800, '30x30': 3255 }
      }
    }
  }
};

export const TRAVEL_BOOK: TravelBookProduct = {
  id: 'travel_book',
  name: 'TRAVEL BOOK (Тревел бук)',
  description: 'Hard cover, 170g glossy coated paper.',
  format: 'A4 (21×29.7 cm)',
  canvasDimensions: '2480×3508 px',
  productionTime: 'до 10 робочих днів',
  pagesAvailable: [12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 60, 72, 80],
  prices: {
    12: 550,
    16: 700,
    20: 850,
    24: 1000,
    28: 1150,
    32: 1300,
    36: 1450,
    40: 1600,
    44: 1750,
    48: 1900,
    52: 2025,
    60: 2225,
    72: 2525,
    80: 2775
  },
  extras: {
    'Lamination': '5 UAH/page',
    'Endpapers': '100 UAH',
    'QR code': '50 UAH',
    'Custom cover': '50 UAH'
  }
};

export const PHOTO_JOURNAL_SOFT: PhotoJournalProduct = {
  id: 'photo_journal_soft',
  name: 'PHOTO JOURNAL — SOFT COVER (Фотожурнал)',
  description: '115g glossy inner pages, soft cover.',
  format: 'A4',
  canvasDimensions: '2480×3508 px',
  productionTime: '4–8 business days',
  binding: 'staple ≤44 pages · glue/perfect binding >44 pages',
  pagesAvailable: [8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 60, 72, 80, 92, 100],
  prices: {
    8: 425,
    12: 475,
    16: 625,
    20: 775,
    24: 925,
    28: 1075,
    32: 1225,
    36: 1375,
    40: 1525,
    44: 1675,
    48: 1825,
    52: 1950,
    60: 2150,
    72: 2450,
    80: 2700,
    92: 2850,
    100: 3050
  },
  extras: {
    'Text typesetting': '175 UAH',
    'Urgent production': '+30%'
  }
};

export const PHOTO_JOURNAL_HARD: PhotoJournalProduct = {
  id: 'photo_journal_hard',
  name: 'PHOTO JOURNAL — HARD COVER (Фотожурнал з твердою обкладинкою)',
  description: 'Glossy coated paper, hard cover.',
  format: 'A4',
  canvasDimensions: '2480×3508 px',
  productionTime: '5–7 business days',
  pagesAvailable: [12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 60, 72, 80],
  prices: {
    12: 600,
    16: 750,
    20: 900,
    24: 1050,
    28: 1200,
    32: 1350,
    36: 1500,
    40: 1650,
    44: 1800,
    48: 1950,
    52: 2075,
    60: 2275,
    72: 2575,
    80: 2825
  },
  extras: {
    'Lamination': '5 UAH/page',
    'Endpapers': '100 UAH',
    'QR code': '50 UAH'
  }
};

export const PHOTO_PRINTS: PhotoPrintsProduct = {
  id: 'photo_prints',
  name: 'PHOTO PRINTS (Фотодрук)',
  description: 'High-quality photo prints.',
  equipment: 'Noritsu QSS 3202 Pro Digital',
  papers: ['Fuji Crystal Archive (matte)', 'Fuji Crystal Archive (glossy)'],
  minimumOrder: 20,
  discount: '7% off for orders of 200+ photos',
  fileRequirements: [
    'JPG only',
    'sRGB',
    '300 DPI',
    'Latin filenames only (no Cyrillic!)',
    'max 15 MB/file'
  ],
  productionTime: '1–3 business days',
  classicSizes: [
    { size: '9×13 cm', price: 8, notes: 'white frame 3mm OPTIONAL' },
    { size: '10×15 cm', price: 8, notes: 'white frame 3mm OPTIONAL' },
    { size: '13×18 cm', price: 18, notes: 'white frame 3mm OPTIONAL' },
    { size: '15×20 cm', price: 23, notes: 'white frame 3mm OPTIONAL' },
    { size: '20×30 cm', price: 44, notes: 'white frame 3mm OPTIONAL' }
  ],
  // NOTE: photo-prints catalog page uses sizes: 9×13=8₴, 10×15=8₴, 13×18=18₴, 15×20=23₴, 20×30=44₴
  nonStandardSizes: [
    { size: '5×7.5 cm', price: 7.5, multipleOf: 12, notes: 'white frame 3mm MANDATORY' },
    { size: '6×9 cm', price: 7.5, multipleOf: 10, notes: 'white frame 3mm MANDATORY' },
    { size: '7.5×10 cm', price: 7.5, multipleOf: 8, notes: 'white frame 3mm MANDATORY' },
    { size: '9×9 cm', price: 8, multipleOf: 6, notes: 'white frame 3mm MANDATORY' },
    { size: '10×10 cm', price: 8, multipleOf: 6, notes: 'white frame 3mm MANDATORY' }
  ],
  polaroid: [
    { size: '7.6×10.1 cm', price: 7.5, multipleOf: 8, notes: 'matte or glossy, no frame required' },
    { size: '8.6×5.4 cm', price: 7.5, multipleOf: 10, notes: 'matte or glossy, no frame required' }
  ],
  photoStrips: {
    description: '6×20 cm, 3 identical photos per strip',
    pricePerSet: 125,
    photosTotal: 15
  }
};

export const POSTERS: PosterProduct = {
  id: 'posters',
  name: 'POSTERS (Постери)',
  sizes: [
    { size: 'A4 (21×29.7 cm)', price: 350 },
    { size: 'A3 (29.7×42 cm)', price: 450 }
  ],
  designTypes: [
    'Star Map (карта зірок — shows exact night sky at any location+date)',
    'Custom Text/Inscription'
  ],
  optional: 'black frame (price on request, manager contacts client)'
};

export const PHOTO_MAGNETS: PhotoMagnetProduct = {
  id: 'photo_magnets',
  name: 'PHOTO MAGNETS (Фотомагніти)',
  material: 'magnetic film + matte Fuji Crystal Archive. Mandatory 3mm white border.',
  productionTime: '1–3 business days',
  pricePerSet: 215,
  sets: [
    { size: '5×7.5 cm', magnetsPerSet: 12 },
    { size: '6×9 cm', magnetsPerSet: 10 },
    { size: '7.5×10 cm', magnetsPerSet: 8 },
    { size: '9×9 cm', magnetsPerSet: 6 },
    { size: '10×10 cm', magnetsPerSet: 6 },
    { size: 'Polaroid 7.6×10.1 cm', magnetsPerSet: 8 },
    { size: 'Polaroid mini 8.6×5.4 cm', magnetsPerSet: 10 },
    { size: 'Photo strips 6×20 cm', magnetsPerSet: 15 } // 5 strips × 3 photos = 15 photos
  ]
};

export const PUZZLES: PuzzleProduct = {
  id: 'puzzles',
  name: 'PUZZLES (Пазли)',
  productionTime: '3–5 business days',
  description: 'Upload one photo — printed across the full puzzle.',
  options: [
    { size: '15×21 cm (A5)',    pieces: 35,  price: 249 },
    { size: '15×21 cm (A5)',    pieces: 60,  price: 249 },
    { size: '15×21 cm (A5)',    pieces: 110, price: 249 },
    { size: '21×15 cm (A5)',    pieces: 35,  price: 249 },
    { size: '21×15 cm (A5)',    pieces: 60,  price: 249 },
    { size: '21×15 cm (A5)',    pieces: 110, price: 249 },
    { size: '20×30 cm (A4)',    pieces: 60,  price: 349 },
    { size: '20×30 cm (A4)',    pieces: 110, price: 349 },
    { size: '20×30 cm (A4)',    pieces: 216, price: 349 },
    { size: '30×20 cm (A4)',    pieces: 60,  price: 349 },
    { size: '30×20 cm (A4)',    pieces: 110, price: 349 },
    { size: '30×20 cm (A4)',    pieces: 216, price: 349 },
    { size: '29.7×42 cm (A3)', pieces: 108, price: 499 },
    { size: '29.7×42 cm (A3)', pieces: 216, price: 499 },
    { size: '42×29.7 cm (A3)', pieces: 108, price: 499 },
    { size: '42×29.7 cm (A3)', pieces: 216, price: 499 },
  ]
};

export const CALENDARS: CalendarProduct = {
  id: 'calendars',
  name: 'CALENDARS (Фотокалендарі)',
  productionTime: '2–4 business days',
  optionalExtra: 'date circling (обведення дати) +10 UAH',
  options: [
    { type: 'Desk calendar on stand (На підставці)', details: '12 photo cards 10×15 cm on wooden easel', price: 325 },
    { type: 'Wall flip calendar A3', details: '13 pages, fits 12–26 photos, 6 cover options', price: 840 },
    { type: 'Wall flip calendar A4', details: '13 pages, fits 12–26 photos, 6 cover options', price: 740 }
  ]
};

export const WISH_BOOK: WishBookProduct = {
  id: 'wish_book',
  name: 'WISH BOOK & PHOTO ALBUM (Книга побажань / Альбом для вклейки фото)',
  description: '180° lay-flat opening.',
  pages: 32,
  productionTime: '10 business days',
  coverDesign: 'FREE',
  sizes: [
    { size: '23×23 cm', canvasDimensions: '5858×3071 px' },
    { size: '20×30 cm', canvasDimensions: '5551×3874 px' },
    { size: '30×20 cm', canvasDimensions: '7630×2870 px' }
  ],
  coverTypes: [
    'Printed cover (Друкована обкладинка)',
    'Velour / Leatherette / Fabric cover (Велюр, Шкірзам, Тканина)'
  ],
  pageColors: [
    'White pages (Білі сторінки)',
    'Black pages (Чорні сторінки)'
  ],
  prices: [
    { size: '23×23', coverType: 'Printed', pageColor: 'White', price: 559 },
    { size: '23×23', coverType: 'Printed', pageColor: 'Black', price: 859 },
    { size: '20×30', coverType: 'Printed', pageColor: 'White', price: 599 },
    { size: '20×30', coverType: 'Printed', pageColor: 'Black', price: 899 },
    { size: '30×20', coverType: 'Printed', pageColor: 'White', price: 599 },
    { size: '30×20', coverType: 'Printed', pageColor: 'Black', price: 899 },
    { size: '23×23', coverType: 'Velour', pageColor: 'White', price: 999 },
    { size: '23×23', coverType: 'Velour', pageColor: 'Black', price: 1299 },
    { size: '20×30', coverType: 'Velour', pageColor: 'White', price: 1059 },
    { size: '20×30', coverType: 'Velour', pageColor: 'Black', price: 1359 },
    { size: '30×20', coverType: 'Velour', pageColor: 'White', price: 1059 },
    { size: '30×20', coverType: 'Velour', pageColor: 'Black', price: 1359 }
  ],
  accessories: [
    { name: 'White marker', price: 45 },
    { name: 'Silver/gold marker', price: 45 },
    { name: 'Black marker', price: 35 },
    { name: 'Photo corners (black/white/kraft)', price: 45 },
    { name: 'Double-sided tape', price: 30 },
    { name: 'Stickers', price: 115 },
    { name: 'Hand & foot print kit', price: 185 },
    { name: 'Month cards (baby)', price: 109 }
  ]
};

export interface ProductCatalog {
  PHOTO_BOOKS: PhotoBookProduct;
  TRAVEL_BOOK: TravelBookProduct;
  PHOTO_JOURNAL_SOFT: PhotoJournalProduct;
  PHOTO_JOURNAL_HARD: PhotoJournalProduct;
  PHOTO_PRINTS: PhotoPrintsProduct;
  POSTERS: PosterProduct;
  PHOTO_MAGNETS: PhotoMagnetProduct;
  PUZZLES: PuzzleProduct;
  CALENDARS: CalendarProduct;
  WISH_BOOK: WishBookProduct;
}

export const PRODUCTS: ProductCatalog = {
  PHOTO_BOOKS,
  TRAVEL_BOOK,
  PHOTO_JOURNAL_SOFT,
  PHOTO_JOURNAL_HARD,
  PHOTO_PRINTS,
  POSTERS,
  PHOTO_MAGNETS,
  PUZZLES,
  CALENDARS,
  WISH_BOOK
};

// ====== MAGAZINE CONSTRUCTOR HELPERS ======

export const MAGAZINE_PRICES_WITHOUT_TYPESETTING = PHOTO_JOURNAL_SOFT.prices;
export const MAGAZINE_PRICES_WITH_TYPESETTING = {
  12: 650,
  16: 800,
  20: 950,
  24: 1100,
  28: 1350,
  32: 1400,
  36: 1550,
  40: 1700,
  44: 1850,
  48: 2000,
  52: 2125,
  60: 2225,
  72: 2625,
  80: 2875,
  92: 3025,
  100: 3225,
} as const;

export const TYPESETTING_PRICE = 175;
export const RETOUCHING_PRICE_PER_PHOTO = 7;
export const URGENT_MULTIPLIER = 0.3; // 30%

// Helper function to get exact magazine price for any page count
export function getMagazinePrice(pages: number, withTypesetting: boolean): number {
  const priceTable = withTypesetting ? MAGAZINE_PRICES_WITH_TYPESETTING : MAGAZINE_PRICES_WITHOUT_TYPESETTING;

  // If exact match exists, return it
  if (pages in priceTable) {
    return priceTable[pages as keyof typeof priceTable];
  }

  // Find the next higher page count in the table
  const availablePages = Object.keys(priceTable).map(Number).sort((a, b) => a - b);
  const nextHigher = availablePages.find(p => p >= pages);

  if (nextHigher) {
    return priceTable[nextHigher as keyof typeof priceTable];
  }

  // Fallback to highest price if pages exceed max
  return priceTable[100 as keyof typeof priceTable] || 3225;
}

export type BindingType = 'saddle-stitch' | 'perfect-binding';

export function getBindingType(pages: number): BindingType {
  return pages <= 44 ? 'saddle-stitch' : 'perfect-binding';
}

export function getBindingInfo(pages: number) {
  const type = getBindingType(pages);

  if (type === 'saddle-stitch') {
    return {
      type: 'saddle-stitch',
      icon: '',
      title: 'Скоба (Saddle-stitch)',
      description: 'Класична журнальна палітурка — ідеально до 44 сторінок. Аркуші складаються навпіл і скріплюються двома металевими скобами.',
      backgroundColor: '#F0F8FF',
      borderColor: '#3B82F6',
      displayName: 'Скоба',
    };
  }

  return {
    type: 'perfect-binding',
    icon: '',
    title: 'Клейова палітурка (Perfect binding)',
    description: 'Книжкова якість — для журналів від 46 сторінок. Сторінки приклеюються до корінця. Журнал виглядає як справжня книга.',
    backgroundColor: '#F0FFF4',
    borderColor: '#10B981',
    displayName: 'Клейова палітурка',
  };
}

export function getUsageHelper(pages: number): string {
  if (pages >= 12 && pages <= 20) {
    return ' Ідеально для: корпоративних буклетів, запрошень, портфоліо';
  }
  if (pages >= 21 && pages <= 32) {
    return ' Ідеально для: весільних журналів, шкільних газет, подієвих видань';
  }
  if (pages >= 33 && pages <= 60) {
    return ' Ідеально для: сімейних альбомів, спортивних журналів, фото-звітів';
  }
  return ' Ідеально для: великих корпоративних звітів, каталогів, книг';
}
