import type { Metadata } from 'next';
import B2bRegisterPage from '@/components/b2b/B2bRegisterPage';
import { getCanonicalUrl, getAlternateLanguages, type Locale } from '@/lib/seo/locales';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    return {
        title: 'Заявка весільної агенції — Touch.Memories',
        description: 'Подайте заявку весільної агенції: після схвалення діятиме постійна знижка 7% на книги побажань та весільні газети.',
        alternates: {
            canonical: getCanonicalUrl(locale as Locale, '/wedding-agencies/apply'),
            languages: getAlternateLanguages('/wedding-agencies/apply'),
        },
    };
}

/** The moderated wedding-agency application, split out of /wedding-agencies —
 *  the landing is now a two-button chooser, same workflow as the photographer
 *  and travel partner pages. */
export default function WeddingApplyPage() {
    return (
        <B2bRegisterPage
            role="wedding_agency"
            title="Заявка весільної агенції"
            subtitle="Вкажіть сайт або сторінку агенції — заявка розглядається вручну. Після схвалення діятиме постійна знижка 7% на книги побажань та весільні газети."
            benefits={[
                'Постійна знижка 7% на книги побажань та весільні газети',
                'Знижка діє автоматично — нічого вводити не потрібно',
                'Унікальні деталі, які підсилюють ваш весільний сервіс',
                'Швидке виготовлення під дати ваших подій',
            ]}
            portfolioLabel="Сайт або сторінка агенції"
            portfolioPlaceholder="Instagram або вебсайт агенції"
            discountPercent={7}
            cabinetLink={{
                text: 'Вже маєте кабінет агенції? Увійти →',
                href: '/uk/wedding-agency/cabinet',
            }}
        />
    );
}
