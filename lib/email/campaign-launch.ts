/**
 * The letter that announces the new site to the KeyCRM customer base.
 *
 * Text approved by Diana on 2026-08-19, after two rounds of shortening and two
 * corrections from her: it must not narrow the shop down to books, and it must
 * not say «майбутній розворот». Change the wording here and nowhere else — the
 * campaign sender and the test send both read this builder, so a preview she
 * approved is the letter that actually goes out.
 *
 * The promo code is a parameter rather than a constant because the campaign
 * runs as a slow drip of fifty letters a day, and each send day has its own
 * seven-day code (see /api/cron/daily-promo-code).
 */

const NAVY = '#1e2d7d';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';

/** Goods the campaign discount never covers — named in the letter's fine print. */
export const PROMO_EXCLUSIONS_TEXT =
    'Промокод не діє на фотоапарати Fujifilm Instax та картриджі до них.';

export function launchEmailSubject(): string {
    return 'У нас нарешті свій сайт, і для вас є знижка';
}

export function buildLaunchEmail({ name, code }: { name?: string | null; code: string }): string {
    // A greeting has to work when the CRM row has no usable name — «Добрий
    // день!» reads fine, «Добрий день, !» does not.
    const clean = String(name || '').trim();
    const greeting = clean && clean.length > 1 && !/^клієнт/i.test(clean)
        ? `Добрий день, ${escapeHtml(clean)}!`
        : 'Добрий день!';

    return `
<div style="margin:0;padding:24px 12px;background:#f6f7fb">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px 28px;
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
              font-size:16px;line-height:1.65;color:#1f2937">

    <p style="margin:0 0 20px">${greeting}</p>

    <p style="margin:0 0 20px">
      Ви колись довірили нам свої спогади, і ми це памʼятаємо. У touch.memories зʼявився власний
      сайт, і тепер усе зібралося в одному місці: фотокниги і тревел-буки, глянцеві журнали,
      календарі, постери, пазли, магніти, полароїди та звичайний фотодрук, книги побажань і
      фотоальбоми. Те, що складається з ваших фотографій, ви збираєте самі в конструкторі просто
      в браузері й одразу бачите ціну та результат.
    </p>

    <p style="margin:0 0 24px">
      Щоб відсвяткувати це разом з вами, даруємо промокод
      <strong style="color:${NAVY}">${escapeHtml(code)}</strong>*&nbsp;— десять відсотків на
      будь-яке замовлення, діє сім днів і спрацьовує один раз.
    </p>

    <p style="margin:0 0 28px;text-align:center">
      <a href="${SITE_URL}" style="display:inline-block;padding:14px 34px;border-radius:9999px;
         background:${NAVY};color:#ffffff;text-decoration:none;font-weight:700;font-size:16px">
        Перейти на сайт
      </a>
    </p>

    <p style="margin:0 0 6px">Дякуємо, що ви з нами.</p>
    <p style="margin:0 0 24px">З теплом, команда touch.memories</p>

    <p style="margin:0;padding-top:18px;border-top:1px solid #e9edf5;color:#8b95a5;font-size:13px;line-height:1.55">
      *&nbsp;${PROMO_EXCLUSIONS_TEXT}
    </p>
  </div>
</div>`;
}

function escapeHtml(s: string): string {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
