import type { Metadata } from 'next';
import CatalogClient from './CatalogClient';
import { getAdminClient } from '@/lib/supabase/admin';

export const revalidate = 60;

const CATALOG_META: Record<string, { title: string; description: string }> = {
  uk: { title: 'Каталог товарів | Touch.Memories', description: 'Фотокниги, журнали, книги побажань та фотодруки на замовлення. 34+ продукти від Touch.Memories у Тернополі.' },
  en: { title: 'Product Catalog | Touch.Memories', description: 'Photo books, journals, guest books and photo prints on demand. 34+ premium products from Touch.Memories.' },
  pl: { title: 'Katalog produktów | Touch.Memories', description: 'Fotoksiążki, albumy, księgi gości i odbitki na zamówienie. Ponad 34 produkty premium w Touch.Memories.' },
  de: { title: 'Produktkatalog | Touch.Memories', description: 'Fotobücher, Zeitschriften, Gästebücher und Fotodrucke auf Bestellung. Über 34 Premium-Produkte bei Touch.Memories.' },
  ro: { title: 'Catalog de produse | Touch.Memories', description: 'Cărți foto, reviste, cărți de urări și tipărituri foto la comandă. Peste 34 de produse premium de la Touch.Memories.' },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return CATALOG_META[locale] || CATALOG_META.uk;
}

export default async function CatalogPage() {
  // Prefetch server-side so client gets instant first paint
  let initialProducts: any[] = [];
  let initialCategories: any[] = [];
  try {
    const supabase = getAdminClient();
    if (supabase) {
      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase.from('categories').select('id, name, slug, cover_image, display_style, translations').eq('is_active', true).order('sort_order'),
        supabase.from('products').select('id, name, slug, price, price_from, short_description, images, is_popular, popular_order, category_id, translations').eq('is_active', true).order('sort_order'),
      ]);
      initialCategories = cats || [];
      initialProducts = prods || [];
    }
  } catch {}

  return <CatalogClient initialProducts={initialProducts} initialCategories={initialCategories} />;
}
