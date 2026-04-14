import type { Metadata } from 'next';
import CatalogClient from './CatalogClient';

export const revalidate = 3600;

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

export default function CatalogPage() {
  return <CatalogClient />;
}
