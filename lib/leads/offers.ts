/**
 * Personalized B2B offer emails by business type.
 *
 * Each lead's business_type maps to an offer that mirrors the value proposition
 * of the corresponding partner program (photographers / wedding agencies /
 * travel agencies / corporate). The manager can send these from the admin lead
 * inbox; the same templates can also be auto-sent on lead creation.
 */

export type LeadBusinessType =
    | 'photographer'
    | 'wedding_agency'
    | 'travel_agency'
    | 'corporate'
    | 'other';

export const BUSINESS_TYPE_LABELS: Record<LeadBusinessType, string> = {
    photographer: 'Фотограф',
    wedding_agency: 'Весільна агенція',
    travel_agency: 'Тревел-агенція',
    corporate: 'Компанія',
    other: 'Бізнес',
};

interface OfferContent {
    subject: string;
    /** Lead-in paragraph(s), plain text with \n between paragraphs. */
    body: (ctx: { name: string; landingUrl: string }) => string;
    /** Landing path on the site for this business type. */
    landingPath: string;
}

const SITE = 'https://touchmemories.com.ua';

export const OFFERS: Record<LeadBusinessType, OfferContent> = {
    photographer: {
        subject: 'Співпраця Touch.Memories для фотографів — знижка 10%',
        landingPath: '/photographers',
        body: ({ name }) =>
            `Вітаємо${name ? `, ${name}` : ''}!\n\n` +
            `Ми — Touch.Memories, студія друку фотокниг, журналів і тревелбуків. Пропонуємо фотографам партнерську співпрацю: постійну знижку 10% на фотокниги, глянцеві журнали, фотодрук і travel book.\n\n` +
            `Ваші клієнти отримують преміальну якість друку та збірки, а ви — зручний онлайн-конструктор для верстки й вигідні умови на кожне замовлення.\n\n` +
            `Розкажіть, чи цікаво — і ми поділимось деталями.`,
    },
    wedding_agency: {
        subject: 'Touch.Memories для весільних агенцій — книги побажань і газети',
        landingPath: '/wedding-agencies',
        body: ({ name }) =>
            `Вітаємо${name ? `, ${name}` : ''}!\n\n` +
            `Ми — Touch.Memories. Пропонуємо весільним агенціям партнерство: постійну знижку 10% на книги побажань і весільні газети — деталі, які підсилюють ваш весільний сервіс.\n\n` +
            `Швидке виготовлення під дати ваших подій і унікальні емоції для пар. Будемо раді обговорити співпрацю.`,
    },
    travel_agency: {
        subject: 'Touch.Memories для тревел-агенцій — тревелбуки для ваших клієнтів',
        landingPath: '/travel-agencies',
        body: ({ name }) =>
            `Вітаємо${name ? `, ${name}` : ''}!\n\n` +
            `Ми — Touch.Memories, робимо тревелбуки — книги спогадів про подорож. Пропонуємо тревел-агенціям кілька моделей співпраці: оптові подарункові сертифікати для клієнтів, реферальна винагорода, або co-branded тревелбуки під вашим брендом.\n\n` +
            `Ваші клієнти повертаються з подорожей із сотнями фото — допоможіть їм зберегти ці спогади, а ми зробимо це частиною вашого сервісу.`,
    },
    corporate: {
        subject: 'Touch.Memories для бізнесу — брендована поліграфія та подарунки',
        landingPath: '/corporate',
        body: ({ name }) =>
            `Вітаємо${name ? `, ${name}` : ''}!\n\n` +
            `Ми — Touch.Memories. Виготовляємо брендований мерч і поліграфію для компаній: стаканчики, кружки, візитки, флаєри, брошури та преміальні фотоподарунки.\n\n` +
            `Складемо для вас комерційну пропозицію під ваші задачі та тираж. Розкажіть, що вас цікавить.`,
    },
    other: {
        subject: 'Співпраця з Touch.Memories',
        landingPath: '/',
        body: ({ name }) =>
            `Вітаємо${name ? `, ${name}` : ''}!\n\n` +
            `Ми — Touch.Memories, студія персоналізованих фотопродуктів. Будемо раді обговорити співпрацю, яка підійде саме вашому бізнесу.`,
    },
};

/** Build the full offer (subject + html) for a lead. */
export function buildOfferEmail(
    businessType: LeadBusinessType,
    leadName: string,
): { subject: string; html: string; text: string } {
    const offer = OFFERS[businessType] || OFFERS.other;
    const landingUrl = `${SITE}${offer.landingPath}`;
    const text = offer.body({ name: leadName, landingUrl });

    const paragraphs = text.split('\n\n').map(p => p.replace(/\n/g, '<br>')).join('</p><p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#374151">');

    const html = `
        <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto">
          <div style="background:#263A99;padding:24px 28px;text-align:center">
            <span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:.1em">TOUCH.MEMORIES</span>
          </div>
          <div style="padding:32px 28px;background:#fff;border:1px solid #e2e8f0">
            <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#374151">${paragraphs}</p>
            <a href="${landingUrl}" style="display:inline-block;margin-top:10px;padding:12px 24px;background:#263A99;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Дізнатись більше →</a>
            <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">Touch.Memories · touchmemories.com.ua<br>Якщо ви не зацікавлені — просто проігноруйте цей лист.</p>
          </div>
        </div>`;

    return { subject: offer.subject, html, text };
}
