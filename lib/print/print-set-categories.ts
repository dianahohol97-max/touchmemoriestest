/**
 * Категорії «друк-наборів» — товарів, чиї готові відбитки клієнт складає в
 * конструкторі фотодруку і які друкуються окремими файлами чи аркушами, а не
 * книжковими розворотами.
 *
 * ЄДИНИЙ список для всіх споживачів. Він уже жив двома копіями — в
 * generate-sheets (аркуші) і на сторінці замовлення в адмінці (розділення
 * «Макет для друку» від «Фотодрук — готові відбитки», TM-001208) — а копії
 * списків у цьому проєкті двічі закінчувались розсинхроном і реальними
 * грошима. Додаєш новий друк-набір у PhotoPrintConstructor — додай категорію
 * СЮДИ, і аркуші, адмінське розділення та обидва ZIP підхоплять її разом.
 */
export const PRINT_SET_CATEGORIES = ['photo-print', 'polaroid-print', 'photomagnets'] as const;

export type PrintSetCategory = (typeof PRINT_SET_CATEGORIES)[number];

export function isPrintSetCategory(category: string | null | undefined): boolean {
    return PRINT_SET_CATEGORIES.includes(String(category || '').toLowerCase() as PrintSetCategory);
}
