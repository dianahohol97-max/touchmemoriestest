/**
 * Сторінки товарів, на які веде внутрішня перелінковка з описовим анкором.
 *
 * Навіщо окремий список. Внутрішнє посилання каже пошуковику дві речі: що
 * сторінка важлива і про що вона. Друге він читає з тексту посилання, тож
 * «тут» і «детальніше» не кажуть нічого, а назва товару в картці каталогу
 * («Полароїд») не збігається з тим, як цю річ шукають («друк фото полароїд»).
 * Блок нижче — це кілька посилань із анкором, написаним мовою запиту.
 *
 * Список короткий навмисно. Якщо зробити його переліком усього каталогу,
 * кожне посилання важитиме стільки ж, скільки решта, і сенс зникне. Сюди
 * потрапляють тільки сторінки під запити з відчутною кількістю показів у
 * Search Console, які при цьому ще не в топі — станом на вересень 2026 це
 * альбоми для вклеювання, книги побажань і друк полароїд.
 *
 * Слаги перевіряються під час рендера: посилання показується лише тоді, коли
 * товар існує й активний. Тож перейменований або прихований товар просто
 * зникає з блоку, а не перетворюється на посилання в 404.
 */
export interface KeyProductLink {
  /** products.slug */
  slug: string;
  /** Текст посилання — так, як цю річ шукають, а не як вона названа в базі. */
  anchor: Record<string, string>;
}

export const KEY_PRODUCT_LINKS: KeyProductLink[] = [
  {
    slug: 'scrapbook-white-pages',
    anchor: {
      uk: 'фотоальбом для вклеювання фото',
      en: 'photo album for glueing in photos',
      ro: 'album foto pentru lipit fotografii',
      pl: 'album na wklejane zdjęcia',
      de: 'Fotoalbum zum Einkleben',
    },
  },
  {
    slug: 'wishbook',
    anchor: {
      uk: 'книга побажань на весілля',
      en: 'wedding guest book',
      ro: 'carte de urări pentru nuntă',
      pl: 'księga życzeń na wesele',
      de: 'Gästebuch zur Hochzeit',
    },
  },
  {
    slug: 'guestbook-kids',
    anchor: {
      uk: 'книга побажань на 1 рік дитини',
      en: 'baby first birthday guest book',
      ro: 'carte de urări pentru primul an',
      pl: 'księga życzeń na roczek',
      de: 'Gästebuch zum ersten Geburtstag',
    },
  },
  {
    slug: 'polaroid-print',
    anchor: {
      uk: 'друк фото полароїд',
      en: 'polaroid style photo printing',
      ro: 'printare foto în stil polaroid',
      pl: 'druk zdjęć w stylu polaroid',
      de: 'Fotodruck im Polaroid-Stil',
    },
  },
  {
    slug: 'velour-album-200',
    anchor: {
      uk: 'велюровий фотоальбом на 200 фото',
      en: 'velour photo album for 200 photos',
      ro: 'album foto din velur pentru 200 de fotografii',
      pl: 'welurowy album na 200 zdjęć',
      de: 'Velours-Fotoalbum für 200 Fotos',
    },
  },
  {
    slug: 'druk-na-polotni',
    anchor: {
      uk: 'друк фото на полотні',
      en: 'photo printing on canvas',
      ro: 'printare foto pe pânză',
      pl: 'druk zdjęć na płótnie',
      de: 'Fotodruck auf Leinwand',
    },
  },
];

/** Текст посилання для локалі, з українською як запасним варіантом. */
export function keyLinkAnchor(link: KeyProductLink, locale: string): string {
  return link.anchor[locale] || link.anchor.uk;
}
