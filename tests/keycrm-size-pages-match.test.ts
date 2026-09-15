import { describe, expect, it } from 'vitest';
import { linkPastedId } from '@/lib/automation/keycrm-catalogue';

/**
 * Кількість розворотів не має плутатися з числом у розмірі.
 *
 * Підпис позиції в KeyCRM виглядає як «Розмір: 20х20 Кількість сторінок: 22».
 * Пошук двадцяти розворотів знаходив двадцятку всередині самого «20х20», тож
 * під умову підпадали УСІ позиції того розміру, спрацьовувало правило «збіг
 * має бути один», і варіант лишався незвʼязаним, хоч позиція в CRM є.
 *
 * На 15.09.2026 так загубилося 22 рядки зі 101 незвʼязаного — рівно ті, де
 * кількість розворотів збігається з числом у розмірі: 20 для 20х20 і 20х30,
 * 30 для 30х30 і 30х20.
 */
const offers = [18, 20, 22].map(pages => ({
    offer_id: `4${pages}`,
    product_id: 'premium',
    name: 'Фотокнига преміум',
    variant_label: `Розмір: 20х20 Кількість сторінок: ${pages}`,
    sku: '',
    price: 1000,
    purchased_price: 0,
    quantity: 0,
})) as any[];

const siteProducts = [18, 20, 22].map(pages => ({
    slug: 'photobook-velour',
    variant: `20x20-${pages}`,
    variantLabel: `20×20 см, ${pages} стор.`,
    name: `Фотокнига з велюровою обкладинкою 20×20 ${pages} сторінок`,
})) as any[];

describe('зіставлення за розміром і кількістю розворотів', () => {
    it('знаходить позицію, коли розворотів рівно стільки ж, скільки в розмірі', async () => {
        const { rows } = await linkPastedId({
            pasted: 'premium',
            siteSlug: 'photobook-velour',
            targetVariant: '20x20-20',
            note: null,
            offers,
            siteProducts,
        });

        const twenty = rows.find(r => r.site_variant === '20x20-20');
        expect(twenty).toBeDefined();
        expect(twenty.keycrm_offer_id).toBe('420');
    });

    it('не плутає сусідні кількості розворотів між собою', async () => {
        const { rows } = await linkPastedId({
            pasted: 'premium',
            siteSlug: 'photobook-velour',
            note: null,
            offers,
            siteProducts,
        });

        const byVariant = Object.fromEntries(rows.map(r => [r.site_variant, r.keycrm_offer_id]));
        expect(byVariant['20x20-18']).toBe('418');
        expect(byVariant['20x20-20']).toBe('420');
        expect(byVariant['20x20-22']).toBe('422');
    });
});
