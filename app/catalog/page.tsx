import CatalogClient from './CatalogClient';

export const metadata = {
  title: 'Каталог товарів | Touch.Memories',
  description: 'Фотокниги, тревел-буки, журнали, календарі, магніти, пазли та фотодрук. Замовте онлайн з доставкою по Україні.',
};

export default function CatalogPage() {
  return <CatalogClient />;
}
