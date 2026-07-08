import { redirect } from 'next/navigation';

/**
 * This standalone travelbook constructor was an unreachable MOCKUP: its
 * "Оформити замовлення" showed a success screen without creating an order,
 * uploading files or taking payment ("here you would send the order to your
 * backend"). Zero links pointed here, but anyone landing via an old/direct
 * URL would have "ordered" into the void. The real travelbook flow lives on
 * the product page → book editor (PARIS-style templates, real pricing,
 * payment). Found during the 08.07 pricing audit.
 */
export default async function TravelbookConstructorRedirect({
    params,
}: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    redirect(`/${locale}/catalog/travelbook-20x30`);
}
