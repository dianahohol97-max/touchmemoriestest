import type { Metadata } from 'next';
import B2bRegisterPage from '@/components/b2b/B2bRegisterPage';
import { getCanonicalUrl, getAlternateLanguages, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';

const TITLE = 'Заявка фотографа — Touch.Memories';
const DESCRIPTION = 'Подайте заявку фотографа з портфоліо: після схвалення у вашому кабінеті увімкнуться знижка 10% на друк і заробіток з рекомендацій.';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    return {
        title: TITLE,
        description: DESCRIPTION,
        alternates: {
            canonical: getCanonicalUrl(locale, '/photographers/apply'),
            languages: getAlternateLanguages('/photographers/apply'),
        },
        openGraph: {
            title: TITLE,
            description: DESCRIPTION,
            url: getCanonicalUrl(locale, '/photographers/apply'),
            siteName: 'Touch.Memories',
            locale: OG_LOCALE_MAP[locale],
            type: 'website',
        },
    };
}

/**
 * The moderated photographer application, split out of /photographers per
 * Diana's ask: the parent page is now a two-button chooser (увійти /
 * зареєструватися), and this route owns the form.
 */
export default function PhotographerApplyPage() {
    return (
        <B2bRegisterPage
            role="photographer"
            title="Заявка фотографа"
            subtitle="Вкажіть портфоліо або офіційну сторінку — заявка розглядається вручну. Після схвалення у вашому кабінеті увімкнуться знижка 10% на друк і заробіток з рекомендацій."
            benefits={[
                'Постійна знижка 10% на фотокниги, глянцеві журнали, фотодрук і travel book — діє автоматично після підтвердження заявки',
                'Заробіток з рекомендацій: клієнт за вашим посиланням отримує знижку 5%, а ви — відсоток з кожного його оплаченого замовлення, з виплатою на карту від 500 ₴',
                'Онлайн-галереї для передачі фото клієнтам: особисте посилання, зберігання 30 днів, ZIP-завантаження',
                'Власна сторінка-візитка з портфоліо, прайсом, контактами і онлайн-записом — оптимізована під Google',
                'Якісний друк і збірка для ваших клієнтських проєктів',
                'Зручний онлайн-конструктор для верстки фотокниг',
            ]}
            portfolioLabel="Портфоліо або офіційна сторінка"
            portfolioPlaceholder="Instagram, сайт, Behance — де можна побачити ваші роботи"
            discountPercent={10}
            cabinetLink={{
                text: 'Вже маєте кабінет фотографа? Увійти →',
                href: '/uk/photographer/cabinet',
            }}
        />
    );
}
