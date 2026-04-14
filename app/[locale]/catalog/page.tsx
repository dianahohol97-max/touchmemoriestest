export const revalidate = 3600;

import CatalogClient from './CatalogClient';

export const metadata = {
  title: 'Каталог товарів | Touch.Memories',
  description: 'Фотокниги, журнали, книги побажань та фотодруки на замовлення. 34+ продукти від Touch.Memories у Тернополі.',
};

export default function CatalogPage() {
  return <CatalogClient />;
}
