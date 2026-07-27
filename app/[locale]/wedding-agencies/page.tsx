import type { Metadata } from 'next';
import B2bRegisterPage from '@/components/b2b/B2bRegisterPage';
import { getCanonicalUrl, getAlternateLanguages, type Locale } from '@/lib/seo/locales';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    return {
        title: 'Для весільних агенцій — Touch.Memories',
        description: 'Партнерська програма для весільних агенцій: постійна знижка 7% на книги побажань та весільні газети для ваших клієнтів.',
        alternates: {
            canonical: getCanonicalUrl(locale as Locale, '/wedding-agencies'),
            languages: getAlternateLanguages('/wedding-agencies'),
        },
    };
}

export default function WeddingAgenciesPage() {
    return (
        <B2bRegisterPage
            role="wedding_agency"
            title="Для весільних агенцій"
            subtitle="Партнерська програма для весільних агенцій: додайте до своїх послуг книги побажань і весільні газети — і отримуйте постійну знижку 7% на ці товари."
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
