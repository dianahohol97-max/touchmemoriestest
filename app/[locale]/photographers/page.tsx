import type { Metadata } from 'next';
import B2bRegisterPage from '@/components/b2b/B2bRegisterPage';
import { getCanonicalUrl, getAlternateLanguages, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';

const TITLE = 'Для фотографів — Touch.Memories';
const DESCRIPTION = 'Партнерська програма для фотографів: знижка 10%, онлайн-галереї для передачі фото клієнтам і власна сторінка-візитка з портфоліо та прайсом.';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    return {
        title: TITLE,
        description: DESCRIPTION,
        alternates: {
            canonical: getCanonicalUrl(locale, '/photographers'),
            languages: getAlternateLanguages('/photographers'),
        },
        openGraph: {
            title: TITLE,
            description: DESCRIPTION,
            url: getCanonicalUrl(locale, '/photographers'),
            siteName: 'Touch.Memories',
            locale: OG_LOCALE_MAP[locale],
            type: 'website',
        },
    };
}

export default function PhotographersPage() {
    return (
        <B2bRegisterPage
            role="photographer"
            title="Для фотографів"
            subtitle="Партнерська програма для фотографів: знижка 10% на фотокниги й журнали, онлайн-галереї для передачі фото клієнтам і власна сторінка-візитка з портфоліо та прайсом."
            benefits={[
                'Постійна знижка 10% на фотокниги, глянцеві журнали, фотодрук і travel book',
                'Знижка діє автоматично — нічого вводити не потрібно',
                'Онлайн-галереї для передачі фото клієнтам: особисте посилання, зберігання 30 днів, ZIP-завантаження',
                'Власна сторінка-візитка з портфоліо, прайсом і контактами — оптимізована під Google',
                'Якісний друк і збірка для ваших клієнтських проєктів',
                'Зручний онлайн-конструктор для верстки фотокниг',
            ]}
            portfolioLabel="Посилання на портфоліо"
            portfolioPlaceholder="Instagram, сайт або Behance"
            discountPercent={10}
            altLink={{
                text: 'Не потрібна знижка? Створіть лише кабінет галерей і візитку — без заявки →',
                href: '/uk/gallery-for-photographers#signup',
            }}
            cabinetLink={{
                text: 'Вже маєте кабінет фотографа? Увійти →',
                href: '/uk/photographer/cabinet',
            }}
        />
    );
}
