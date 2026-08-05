/**
 * Спільні довідники для оформлення ліда партнером.
 *
 * Лежить окремо від роутів, бо ті самі значення потрібні і кабінету
 * менеджера, і адмінці: якщо вони розʼїдуться, менеджер подасть заявку на
 * один вид партнера, а адміністратор побачить інший.
 */

/** Види, які підтримує agency_partners. */
export const PARTNER_KINDS = ['travel_agency', 'travel_blogger', 'photographer'] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];

export const PARTNER_KIND_LABELS: Record<PartnerKind, string> = {
  travel_agency: 'Агенція',
  travel_blogger: 'Блогер',
  photographer: 'Фотограф',
};

/**
 * Тип бізнесу в ліді → вид партнера.
 *
 * Весільні агенції та компанії стають travel_agency: механіка коду, знижки й
 * комісій у них однакова, різниця лише в назві. Окремий вид довелося б
 * додавати в agency_partners, у кабінет партнера й у листи — заради самого
 * лише слова.
 */
export function leadTypeToPartnerKind(businessType: string | null | undefined): PartnerKind {
  if (businessType === 'photographer') return 'photographer';
  return 'travel_agency';
}
