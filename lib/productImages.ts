// lib/productImages.ts
export const PRODUCT_IMAGES: Record<string, string> = {
  photobook:         'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80',
  photobookStandard: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80',
  photobookPremium:  'https://images.unsplash.com/photo-1550399105-c4db5fb85c18?w=800&q=80',
  travelbook:        'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80',
  magazine:          'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80',
  photoJournalSoft:  'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=800&q=80',
  photoJournalHard:  'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=80',
  calendar:          'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&q=80',
  prints:            'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&q=80',
  photoPrints:       'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&q=80',
  magnets:           'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  puzzles:           'https://images.unsplash.com/photo-1569428034239-f9565e32e224?w=800&q=80',
  posters:           'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?w=800&q=80',
  canvas:            'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?w=800&q=80',
  wishbook:          'https://images.unsplash.com/photo-1472173148041-00294f0814a2?w=800&q=80',
  guestbook:         'https://images.unsplash.com/photo-1472173148041-00294f0814a2?w=800&q=80',
  photoalbum:        'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80',
  hero:              'https://images.unsplash.com/photo-1607462109225-6b64ae2dd3cb?w=1600&q=85',
  heroMobile:        'https://images.unsplash.com/photo-1607462109225-6b64ae2dd3cb?w=800&q=80',
  studio:            'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&q=80',
  placeholder:       'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=800&q=80',
};

export function getProductImage(productId: string): string {
  return PRODUCT_IMAGES[productId] ?? PRODUCT_IMAGES.placeholder;
}
