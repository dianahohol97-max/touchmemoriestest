import type { Metadata } from 'next';
import { getCanonicalUrl, getAlternateLanguages, OG_LOCALE_MAP, getBaseUrl, type Locale } from '@/lib/seo/locales';
import SignupForm from './SignupForm';

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

const TITLE = 'Онлайн-галерея для фотографів — передавайте фото клієнтам красиво';
const DESCRIPTION = 'Безкоштовна онлайн-галерея для фотографів: завантажуйте фото клієнтів, діліться посиланням, фото зберігаються 30 днів. Плюс сторінка-візитка з портфоліо і прайсом.';

const FAQ = [
  {
    q: 'Скільки коштує галерея для фотографа?',
    a: 'Кабінет фотографа, галереї для клієнтів і сторінка-візитка з портфоліо та прайсом — безкоштовні. Разом із партнерською програмою ви також отримуєте знижку 10% на фотокниги, журнали та фотодрук. Платною є лише опція власного домену для вашої сторінки.',
  },
  {
    q: 'Як довго зберігаються фото в галереї?',
    a: 'Фото зберігаються 30 днів від створення галереї. Клієнт бачить лічильник днів і може завантажити всі фото одним ZIP-архівом або поштучно.',
  },
  {
    q: 'Як клієнт отримує свої фото?',
    a: 'Ви створюєте галерею в кабінеті, завантажуєте фото і надсилаєте клієнту особисте посилання. Реєстрація клієнту не потрібна — галерея відкривається одразу, з вашим логотипом і контактами.',
  },
  {
    q: 'Що таке сторінка-візитка фотографа?',
    a: 'Це ваша публічна сторінка: ім’я, спеціалізація, місто, портфоліо, прайс і контакти. Вона оптимізована під пошук Google (наприклад, «весільний фотограф Київ») і може працювати на вашому власному домені.',
  },
  {
    q: 'Чи безпечно зберігати фото клієнтів?',
    a: 'Кожна галерея доступна лише за особистим невгадуваним посиланням і не індексується пошуковиками. Після 30 днів файли автоматично видаляються з серверів.',
  },
  {
    q: 'Як почати користуватися?',
    a: 'Створіть кабінет прямо на цій сторінці — потрібні лише імʼя, email і пароль. Кабінет із галереями та сторінкою-візиткою доступний одразу, без заявок і модерації. Знижку 10% на товари можна оформити окремо — заявкою фотографа.',
  },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const path = '/gallery-for-photographers';
  return {
    title: `${TITLE} | Touch.Memories`,
    description: DESCRIPTION,
    alternates: { canonical: getCanonicalUrl(locale, path), languages: getAlternateLanguages(path) },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: getCanonicalUrl(locale, path),
      siteName: 'Touch.Memories',
      images: [{ url: `${getBaseUrl()}/og-image.jpg`, width: 1200, height: 630, alt: TITLE }],
      locale: OG_LOCALE_MAP[locale],
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  };
}

const h2: React.CSSProperties = { fontSize: 24, fontWeight: 800, color: '#1e2d7d', marginBottom: 16 };

export default async function GalleryForPhotographersPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const pageUrl = getCanonicalUrl(locale, '/gallery-for-photographers');

  const serviceLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': pageUrl,
    name: 'Онлайн-галерея та сторінка-візитка для фотографів',
    description: DESCRIPTION,
    provider: { '@type': 'Organization', name: 'Touch.Memories', url: getBaseUrl() },
    areaServed: 'UA',
    audience: { '@type': 'Audience', audienceType: 'Фотографи' },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'UAH', description: 'Кабінет, галереї та сторінка-візитка — безкоштовно; власний домен — платна опція.' },
  };
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  // Instant self-service signup lives right on this page (#signup); the 10%
  // discount application is a separate flow at /photographers.
  const registerUrl = '#signup';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 20px 90px', fontFamily: 'Arial, sans-serif', color: '#1f2937' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* Hero */}
      <section style={{ textAlign: 'center', marginBottom: 56 }}>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: '#1e2d7d', lineHeight: 1.25, marginBottom: 14 }}>
          Онлайн-галерея для фотографів<br />і ваша сторінка-візитка
        </h1>
        <p style={{ fontSize: 17, color: '#475569', maxWidth: 640, margin: '0 auto 24px', lineHeight: 1.6 }}>
          Передавайте клієнтам фото красиво: брендована галерея за особистим посиланням,
          зберігання 30 днів, завантаження одним архівом. А ще — власна сторінка з портфоліо
          і прайсом, яку знаходять у Google.
        </p>
        <a href={registerUrl} style={{ display: 'inline-block', background: '#1e2d7d', color: '#fff', borderRadius: 10, padding: '14px 28px', fontWeight: 800, textDecoration: 'none', fontSize: 16 }}>
          Отримати кабінет безкоштовно
        </a>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 10 }}>Кабінет — одразу, без заявок і модерації · знижка 10% — окремо, після підтвердження заявки</div>
        <div style={{ fontSize: 14, marginTop: 14 }}>
          <span style={{ color: '#94a3b8' }}>Вже маєте кабінет? </span>
          <a href={`/${locale}/photographer/cabinet`} style={{ color: '#1e2d7d', fontWeight: 700, textDecoration: 'none' }}>Увійти у свій кабінет →</a>
        </div>
      </section>

      {/* Benefits */}
      <section style={{ marginBottom: 56 }}>
        <h2 style={h2}>Що ви отримуєте</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
          {[
            { icon: '', title: 'Галереї для клієнтів', text: 'Створюйте галерею на кожну зйомку, завантажуйте до 500 фото і діліться особистим посиланням. Клієнт дивиться у лайтбоксі й качає ZIP-архівом.' },
            { icon: '', title: 'Зберігання 30 днів', text: 'Фото доступні місяць — достатньо, щоб клієнт усе забрав. Далі файли видаляються автоматично: жодних переповнених дисків.' },
            { icon: '', title: 'Сторінка-візитка', text: 'Ім’я, спеціалізація, місто, портфоліо, прайс і контакти — на власній сторінці, оптимізованій під Google.' },
            { icon: '', title: 'Ваш бренд', text: 'Логотип і контакти видно клієнту в кожній галереї. За бажанням — сторінка на вашому власному домені (платна опція).' },
            { icon: '', title: 'Приватність', text: 'Кожна галерея — за невгадуваним посиланням, закрита від пошуковиків. Бачить лише той, кому ви надіслали лінк.' },
            { icon: '', title: 'Знижка 10% на товари', text: 'Після підтвердження заявки — постійна знижка 10% на фотокниги, журнали, фотодрук і travel book для клієнтських проєктів.' },
            { icon: '', title: 'Безкоштовно', text: 'Кабінет, галереї та візитка не коштують нічого. Платити треба лише за власний домен, якщо він вам потрібен.' },
          ].map(b => (
            <div key={b.title} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 18 }}>
                            <div style={{ fontWeight: 800, marginBottom: 6 }}>{b.title}</div>
              <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.55 }}>{b.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ marginBottom: 56 }}>
        <h2 style={h2}>Як це працює</h2>
        <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
          {[
            'Створіть кабінет на цій сторінці (імʼя, email, пароль) — він доступний одразу, лист із посиланням прийде на пошту.',
            'Заповніть візитку: спеціалізація, місто, портфоліо, прайс — і ваша сторінка вже в каталозі фотографів.',
            'Після зйомки створіть галерею, завантажте фото й надішліть клієнту лінк. Готово!',
          ].map((step, i) => (
            <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px' }}>
              <span style={{ background: '#1e2d7d', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ lineHeight: 1.6 }}>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section style={{ marginBottom: 56 }}>
        <h2 style={h2}>Часті запитання</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {FAQ.map(f => (
            <details key={f.q} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px' }}>
              <summary style={{ fontWeight: 700, cursor: 'pointer' }}>{f.q}</summary>
              <p style={{ color: '#475569', lineHeight: 1.6, marginBottom: 0 }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Signup + internal links */}
      <section id="signup" style={{ background: '#eef2ff', borderRadius: 16, padding: '36px 20px', scrollMarginTop: 90 }}>
        <h2 style={{ ...h2, marginBottom: 8, textAlign: 'center' }}>Спробуйте — це безкоштовно</h2>
        <p style={{ color: '#475569', marginTop: 0, marginBottom: 20, textAlign: 'center' }}>Кабінет створюється за хвилину — без заявок і модерації.</p>
        <SignupForm locale={locale} />
        <div style={{ marginTop: 16, fontSize: 14, textAlign: 'center', display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`/${locale}/photographer/cabinet`} style={{ color: '#1e2d7d', fontWeight: 700 }}>Вже маєте кабінет? Увійти →</a>
          <a href={`/${locale}/photographer`} style={{ color: '#1e2d7d' }}>Подивитися каталог фотографів →</a>
        </div>
      </section>
    </div>
  );
}
