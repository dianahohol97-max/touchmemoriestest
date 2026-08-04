import type { Metadata } from 'next';
import B2bRegisterPage from '@/components/b2b/B2bRegisterPage';
import { getCanonicalUrl, getAlternateLanguages, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';

const TITLE = 'Для фотографів — Touch.Memories';
const DESCRIPTION = 'Партнерська програма для фотографів: знижка 10% на друк, заробіток з рекомендацій, онлайн-галереї для передачі фото клієнтам і сторінка-візитка з портфоліо.';

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

/**
 * The MODERATED photographer application (Diana's decision, 2026-08-04 second
 * pass — an instant-signup version lived here for a few hours and was
 * reverted). The application carries a portfolio link and is reviewed by hand;
 * approval unlocks the two money-bearing perks — the 10% buying discount and
 * the referral earnings — in the photographer cabinet. The cabinet itself
 * (galleries + landing) stays open self-service at /gallery-for-photographers.
 */
export default function PhotographersPage() {
    return (
        <B2bRegisterPage
            role="photographer"
            title="Для фотографів"
            subtitle="Партнерська програма для фотографів: знижка 10% на друк, заробіток з рекомендацій вашим клієнтам, онлайн-галереї для передачі фото та власна сторінка-візитка з портфоліо і прайсом. Заявка розглядається вручну — вкажіть портфоліо або офіційну сторінку."
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
