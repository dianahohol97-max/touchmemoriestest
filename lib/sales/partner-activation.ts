/**
 * Спільні довідники для оформлення ліда партнером.
 *
 * Лежить окремо від роутів, бо ті самі значення потрібні і кабінету
 * менеджера, і адмінці: якщо вони розʼїдуться, менеджер подасть заявку на
 * один вид партнера, а адміністратор побачить інший.
 */

/** Види, які підтримує agency_partners. */
export const PARTNER_KINDS = ['travel_agency', 'wedding_agency', 'travel_blogger', 'photographer'] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];

export const PARTNER_KIND_LABELS: Record<PartnerKind, string> = {
  travel_agency: 'Тревел-агенція',
  wedding_agency: 'Весільна агенція',
  travel_blogger: 'Блогер',
  photographer: 'Фотограф',
};

/**
 * Тип бізнесу в ліді → вид партнера.
 *
 * Весільна агенція — окремий вид (Diana, 2026-08-06): механіка коду, знижки й
 * комісії ті самі, але в списку партнерів і у звітах її має бути видно як
 * весільну, а не «агенцію взагалі». Компанії (corporate) та «інше» ідуть як
 * travel_agency — для них окремого виду поки не існує.
 */
export function leadTypeToPartnerKind(businessType: string | null | undefined): PartnerKind {
  if (businessType === 'photographer') return 'photographer';
  if (businessType === 'wedding_agency') return 'wedding_agency';
  return 'travel_agency';
}
