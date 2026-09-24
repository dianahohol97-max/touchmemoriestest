import type { Metadata } from 'next';
import { getCanonicalUrl, getAlternateLanguages, OG_LOCALE_MAP, getBaseUrl, type Locale } from '@/lib/seo/locales';
import { serializeJsonLd } from '@/lib/seo/jsonld';
import { GALLERY_PLANS } from '@/lib/photographers/plans';
import SignupForm from './SignupForm';

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

const TITLE = 'Онлайн-галерея для фотографів — передавайте фото клієнтам красиво';
const DESCRIPTION = 'Безкоштовна онлайн-галерея для фотографів: завантажуйте фото клієнтів, діліться посиланням, фото зберігаються 30 днів.';

const FAQ = [
  {
    q: 'Скільки коштує галерея для фотографа?',
    a: 'Кабінет і галереї безкоштовні на тарифі з 4 ГБ місця. Якщо потрібно більше місця, довший термін зберігання чи відео, є платні тарифи від 149 гривень на місяць, які оплачуються карткою прямо в кабінеті. Разом із партнерською програмою ви також отримуєте знижку 10% на фотокниги, журнали та фотодрук.',
  },
  {
    q: 'Як довго зберігаються фото в галереї?',
    a: 'На безкоштовному тарифі галерея зберігається 30 днів від створення, без продовження. На платних тарифах термін ви обираєте самі, 30, 60 або 90 днів, і за потреби продовжуєте його в кабінеті. Клієнт бачить лічильник днів і може завантажити всі фото одним ZIP-архівом або поштучно.',
  },
  {
    q: 'Як клієнт отримує свої фото?',
    a: 'Ви створюєте галерею в кабінеті, завантажуєте фото і надсилаєте клієнту особисте посилання. Реєстрація клієнту не потрібна — галерея відкривається одразу, з вашим логотипом і контактами.',
  },
  {
    q: 'Чи безпечно зберігати фото клієнтів?',
    a: 'Кожна галерея доступна лише за особистим невгадуваним посиланням і не індексується пошуковиками. Після завершення терміну файли автоматично видаляються з серверів.',
  },
  {
    q: 'Як почати користуватися?',
    a: 'Створіть кабінет прямо на цій сторінці — потрібні лише імʼя, email і пароль. Галереї запрацюють одразу, без модерації. Знижка 10% на друк і заробіток з рекомендацій живуть у цьому ж кабінеті й вмикаються після схвалення заявки фотографа з портфоліо, яку ми розглядаємо вручну.',
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
    name: 'Онлайн-галерея для фотографів',
    description: DESCRIPTION,
    provider: { '@type': 'Organization', name: 'Touch.Memories', url: getBaseUrl() },
    areaServed: 'UA',
    audience: { '@type': 'Audience', audienceType: 'Фотографи' },
    // One Offer per storage plan, the same catalogue /photographers shows.
    offers: GALLERY_PLANS.map(p => ({
      '@type': 'Offer',
      name: `${p.name} — ${p.storageGb} ГБ`,
      price: String(p.priceUah),
      priceCurrency: 'UAH',
      description: p.blurb,
    })),
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqLd) }} />

      {/* Hero */}
      <section style={{ textAlign: 'center', marginBottom: 56 }}>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: '#1e2d7d', lineHeight: 1.25, marginBottom: 14 }}>
          Онлайн-галерея для фотографів
        </h1>
        <p style={{ fontSize: 17, color: '#475569', maxWidth: 640, margin: '0 auto 24px', lineHeight: 1.6 }}>
          Передавайте клієнтам фото красиво: брендована галерея за особистим посиланням,
          зберігання від 30 до 90 днів залежно від тарифу, завантаження одним архівом.
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
            { icon: '', title: 'Галереї для клієнтів', text: 'Створюйте галерею на кожну зйомку, завантажуйте до 2000 фото і діліться особистим посиланням. Клієнт дивиться у лайтбоксі й качає ZIP-архівом.' },
            { icon: '', title: 'Термін зберігання', text: 'На безкоштовному тарифі галерея живе 30 днів, на платних ви обираєте 30, 60 або 90 днів і можете продовжити термін. Далі файли видаляються автоматично, тож диск не переповнюється.' },
            { icon: '', title: 'Ваш бренд', text: 'Ваш логотип і контакти клієнт бачить у кожній галереї, тож після зйомки йому легко знову вас знайти.' },
            { icon: '', title: 'Приватність', text: 'Кожна галерея — за невгадуваним посиланням, закрита від пошуковиків. Бачить лише той, кому ви надіслали лінк.' },
            { icon: '', title: 'Знижка 10% на товари', text: 'Після підтвердження заявки — постійна знижка 10% на фотокниги, журнали, фотодрук і travel book для клієнтських проєктів.' },
            { icon: '', title: 'Безкоштовний старт', text: 'Кабінет і галереї безкоштовні на тарифі з 4 ГБ місця. Коли зйомок стає більше, платні тарифи від 149 гривень на місяць дають до 500 ГБ, довший термін зберігання і відео.' },
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
            'Додайте логотип і контакти в розділі «Ваші дані», і клієнт побачить їх у кожній галереї.',
            'Після зйомки створіть галерею, завантажте фото й надішліть клієнту посилання, і на цьому все.',
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
        </div>
      </section>
    </div>
  );
}
