/**
 * Gallery storage plans for photographers (Diana, 2026-08-04).
 *
 * Pricing is set against Cloudflare R2 costs: storage is $0.015/GB-month
 * (~0.62 ₴) and egress is free, so the only real cost is the space actually
 * occupied — the margins below assume a photographer fills their cap, which
 * is the worst case (in practice people use 30–50%).
 *
 *   free    4 GB   —      cost ≈ 2.5 ₴
 *   start  50 GB   149 ₴  cost ≈ 31 ₴   margin 79%
 *   pro   250 GB   329 ₴  cost ≈ 155 ₴  margin 53%
 *   studio 500 GB  599 ₴  cost ≈ 311 ₴  margin 48%
 *
 * For comparison Pixieset charges ~830 ₴ for 100 GB, so every tier here is
 * several times cheaper per gigabyte.
 */

export type PlanId = 'free' | 'start' | 'pro' | 'studio';

export interface GalleryPlan {
  id: PlanId;
  name: string;
  priceUah: number;
  storageGb: number;
  /** One line under the price in the pricing table. */
  blurb: string;
  perks: string[];
}

export const GALLERY_PLANS: GalleryPlan[] = [
  {
    id: 'free',
    name: 'Безкоштовно',
    priceUah: 0,
    storageGb: 4,
    blurb: 'Щоб спробувати сервіс на кількох зйомках',
    perks: [
      'Галереї для передачі фото клієнтам',
      'Повний конструктор дизайну і десять мов',
      'Термін зберігання 30 днів',
    ],
  },
  {
    id: 'start',
    name: 'Старт',
    priceUah: 149,
    storageGb: 50,
    blurb: 'Для фотографа з регулярними зйомками',
    perks: [
      'Приблизно 50 галерей одночасно',
      'Термін зберігання до 90 днів',
      'Завантаження відео в галерею',
    ],
  },
  {
    id: 'pro',
    name: 'Про',
    priceUah: 329,
    storageGb: 250,
    blurb: 'Для активного сезону і великих зйомок',
    perks: [
      'Місця вистачає навіть на оригінали без стиснення',
      'Термін зберігання до 90 днів',
      'Пріоритет у виробництві друку',
    ],
  },
  {
    id: 'studio',
    name: 'Студія',
    priceUah: 599,
    storageGb: 500,
    blurb: 'Для студії з кількома фотографами',
    perks: [
      'Найбільший обсяг для командної роботи',
      'Термін зберігання до 90 днів',
      'Пріоритетна підтримка',
    ],
  },
];

export const DEFAULT_PLAN: PlanId = 'free';

export function getPlan(id?: string | null): GalleryPlan {
  return GALLERY_PLANS.find(p => p.id === id) || GALLERY_PLANS[0];
}

/** Storage cap in bytes for a plan id. */
export function planLimitBytes(id?: string | null): number {
  return getPlan(id).storageGb * 1024 * 1024 * 1024;
}

/** Human-readable size for the cabinet (GB with one decimal under 10 GB). */
export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb < 1) return `${Math.round(bytes / 1024 / 1024)} МБ`;
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} ГБ`;
}
