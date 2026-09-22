/**
 * Якого типу цей макет — одна відповідь на весь проєкт.
 *
 * ЧОМУ ОДНА. Значення `projects.product_type` писали два різні місця, і вони
 * розходилися. Конструктор (`persistDraft` у BookLayoutEditor) клав глянцевий
 * журнал як `journal`, а оформлення (checkout → `/api/projects/save-design`)
 * той самий товар під тим самим slug — як `magazine`. У базі станом на
 * 22.09.2026 це 130 рядків одного написання і 15 іншого, причому обидва
 * походять від тих самих двох slug: `personalized-glossy-magazine` і
 * `fotozhurnal-tverd-obkladynka`.
 *
 * ЩО ЦЕ ЗЛАМАЛО. Кнопка «Поставити на замовлення» відбирала замінюване за
 * `product_type` і на TM-001352 не знайшла збігу — `journal` проти `magazine`,
 * — тож замість заміни дописала другий виріб. Ту кнопку вже полагоджено
 * окремо (lib/orders/layout-replacement.ts бере ключ позиції кошика), але
 * розбіжність лишалася і чекала наступного читача, який порівняє це поле
 * точним збігом.
 *
 * ЧОГО ЦЕ НЕ ЛАМАЛО, і це варто знати перед наступною правкою: ціна, правила
 * форзаців і сам рендер до цього поля не звертаються. Ціна рахується з опцій і
 * slug (`lib/products.ts`), форзаци — з `productSlug` і в редакторі, і в
 * сервісі рендеру, а сервіс бере `config.productSlug`. Решта читачів
 * (`RAILWAY_RENDERABLE`, `WISHBOOK`, `resolveProjectSizeKey`) дивляться
 * регулярками, які розпізнають обидва написання. Єдиний читач, що порівнює
 * точним збігом, — вкладки на `/admin/projects`, але той екран читає таблицю
 * `customer_projects`, а в ній НУЛЬ рядків, тож живого наслідку розбіжність
 * уже не має.
 *
 * ЗНАЧЕННЯ ДЛЯ ЖУРНАЛУ — `journal` (рішення Діани, 22.09.2026). Старі рядки
 * навмисно не мігрували: усі живі читачі розуміють обидва написання, а
 * міграція 1280 рядків заради косметики — це ризик без виграшу. Тобто в базі
 * `magazine` ще довго лишатиметься, і читач, який порівнює це поле ТОЧНИМ
 * ЗБІГОМ, мусить враховувати обидва.
 */

/** Значення, які ця функція може повернути. */
export type ProjectType = 'travelbook' | 'journal' | 'wishbook' | 'planner' | 'photobook';

/**
 * Тип макета за slug товару.
 *
 * Порядок перевірок значущий і повторює той, що був у обох записувачів:
 * тревелбук, потім сімейство журналів, потім книга побажань, потім планер, а
 * все інше — фотокнига. `fotozhurnal` містить `zhurnal`, тож окремої гілки не
 * потребує; `travelbook` містить `travel` із тієї ж причини.
 */
export function resolveProjectType(slug: unknown): ProjectType {
    const s = String(slug ?? '').toLowerCase();
    if (s.includes('travel')) return 'travelbook';
    if (s.includes('magazine') || s.includes('zhurnal') || s.includes('fotozhurnal') || s.includes('journal')) {
        return 'journal';
    }
    if (s.includes('wish') || s.includes('pobazhan') || s.includes('guest')) return 'wishbook';
    if (s.includes('planner')) return 'planner';
    return 'photobook';
}
