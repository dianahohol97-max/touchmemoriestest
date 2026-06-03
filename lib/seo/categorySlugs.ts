// Keyword-rich Ukrainian public slugs for category pages, mapped to the
// unchanged DB `categories.slug`. We DON'T rename the DB slug because it's a
// functional key in 40+ places (constructor routing, pricing, images). Instead
// the /category route serves the UA slug and resolves it to the DB row, and old
// DB-slug URLs 301 to the UA slug. Entries where UA == DB are simply omitted.
export const UA_TO_DB_CATEGORY: Record<string, string> = {
  'fotoknygy': 'photobooks',
  'trevel-buky': 'travelbooks',
  'druk-foto': 'prints',
  'fotokalendari': 'calendars',
  'fotomahnity': 'photomagnets',
  'postery': 'posters',
  'pazly': 'puzzles',
  'knyha-pobazhan': 'guestbooks',
  'albomy-dlya-vkleyky': 'scrapbook-albums',
  'fotoalbomy': 'photoalbomy-failykovi',
  'dytyachi-fototovary': 'kids',
  'foto-podarunky': 'gifts',
  'aksesuary': 'accessories',
  'sertyfikaty': 'certificates',
  'vypuskni-knyhy': 'graduation-books',
  // hlyantsevi-zhurnaly already reads well in UA — kept as-is (no alias).
};

// DB slug -> UA slug (only where they differ).
export const DB_TO_UA_CATEGORY: Record<string, string> = Object.fromEntries(
  Object.entries(UA_TO_DB_CATEGORY).map(([ua, db]) => [db, ua])
);

/** Resolve an incoming /category/[slug] param to the real DB slug. */
export function toDbCategorySlug(slug: string): string {
  return UA_TO_DB_CATEGORY[slug] || slug;
}

/** Public (UA) slug for a DB category slug — used for links, canonicals, sitemap. */
export function toPublicCategorySlug(dbSlug: string): string {
  return DB_TO_UA_CATEGORY[dbSlug] || dbSlug;
}
