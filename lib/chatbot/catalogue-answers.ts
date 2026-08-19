import { getAdminClient } from '@/lib/supabase/admin';
import { engravingRefusalReason } from '@/lib/products/decoration-rules';

/**
 * What the shop actually sells, answered from the catalogue.
 *
 * Diana, 2026-08-20: «софія ж має доступ до супабейз, всієї бази даних, сайту і
 * абсолютно всього, і вона точно може відповідати на такі запитання». The
 * trigger was Оксана asking whether engraving is available on a photobook with
 * a fabric cover, and Софія answering that she does not know the details and
 * they should ask the girls — while the answer sits in four tables she can read.
 *
 * The rule this module follows: say what the catalogue says, name where it came
 * from, and never round a silence up into a yes. A confident wrong answer about
 * what can be produced costs a reprint.
 */

export type CatalogueAnswer = { text: string } | null;

const DECOR_WORDS = /(оздобл|гравіюв|гравірув|акрил|метал|фотовставк|флекс|друк\s+кольором|тисн)/iu;
const OPTION_WORDS = /(покритт|ламінац|формат|розмір|сторінок|обкладинк|калька|опці|варіант|колір\s+сторінок)/iu;
const ASKING = /(чи|який|яка|які|скільки|можна|доступн|є\s|маємо|робимо|існу)/iu;

/** Cover materials as the customer picks them, normalised for matching. */
const COVER_SYNONYMS: Record<string, RegExp> = {
    'Тканина': /тканин/iu,
    'Велюр': /велюр/iu,
    'Шкірзамінник': /шкірзам|шкірзамін|екошкір|шкіра/iu,
    'Друкована': /друкован|фотодрук\s+обкладин|printed/iu,
};

function mentionedCover(question: string): string | null {
    for (const [name, re] of Object.entries(COVER_SYNONYMS)) {
        if (re.test(question)) return name;
    }
    return null;
}

/**
 * Decoration availability: «чи можна гравіювання на тканинній обкладинці?»
 *
 * Two different shapes live behind one word «оздоблення», and conflating them
 * is what produced the unhelpful answer. Акрил, металева вставка and
 * фотовставка are VARIANT-based: the exact sizes are listed per cover material
 * and per book format in decoration_variants, so the answer can be precise.
 * Гравірування and друк кольором are inscription METHODS with no variant rows
 * at all — the constructor offers them on every cover except the printed one.
 */
async function answerDecoration(question: string): Promise<CatalogueAnswer> {
    const admin = getAdminClient();
    const cover = mentionedCover(question);
    const asksEngraving = /(гравіюв|гравірув)/iu.test(question);
    const asksFlex = /(флекс|друк\s+кольором)/iu.test(question);

    if (asksEngraving) {
        // Diana's production rule, 2026-08-20, held in one shared module so the
        // constructor and this answer can never disagree.
        if (cover) {
            const reason = engravingRefusalReason(cover);
            return {
                text: reason
                    ? `Ні, на обкладинці «${cover}» гравіювання не робимо — ${reason}. Замість нього там друк кольором.`
                    : `Так, на обкладинці «${cover}» гравіювання робимо. Напис коштує 180 грн, спосіб обирається в конструкторі.`,
            };
        }
        return {
            text: 'Гравіювання робимо тільки на велюрі. На тканині та шкірзаміннику його немає, там лишається друк кольором, а на друкованій обкладинці напис іде частиною макета.',
        };
    }

    if (asksFlex) {
        const onCover = cover ? ` на обкладинці «${cover}»` : '';
        return {
            text: `Друк кольором${onCover} доступний на всіх обкладинках, крім друкованої, — і на велюрі, і на тканині, і на шкірзаміннику. Напис коштує 180 грн.`,
        };
    }

    // Variant-based decorations: answer from the rows.
    const { data: rows } = await admin
        .from('decoration_variants')
        .select('surcharge, variant_name, decoration_types(name), cover_types(name), photobook_sizes(name)');

    const flat = (rows || []).map((r: any) => ({
        decoration: r.decoration_types?.name || '—',
        cover: r.cover_types?.name || null,
        size: r.photobook_sizes?.name || null,
        variant: r.variant_name,
        surcharge: Number(r.surcharge) || 0,
    }));
    if (!flat.length) return null;

    const wanted = flat.filter(r => {
        if (cover && r.cover && r.cover !== cover) return false;
        if (/акрил/iu.test(question)) return r.decoration === 'Акрил';
        if (/метал/iu.test(question)) return r.decoration === 'Металева вставка';
        if (/фотовставк/iu.test(question)) return r.decoration === 'Фотовставка';
        return true;
    });

    if (!wanted.length) {
        const covers = Array.from(new Set(flat.map(r => r.cover).filter(Boolean)));
        return {
            text: `Такого поєднання в каталозі немає. Оздоблення з варіантами прописані лише для обкладинок ${covers.join(', ')}.`,
        };
    }

    const byDecor = new Map<string, typeof wanted>();
    for (const r of wanted) {
        if (!byDecor.has(r.decoration)) byDecor.set(r.decoration, [] as any);
        (byDecor.get(r.decoration) as any).push(r);
    }

    const lines: string[] = [];
    for (const [decoration, list] of byDecor) {
        const covers = Array.from(new Set(list.map(r => r.cover).filter(Boolean)));
        const sizes = Array.from(new Set(list.map(r => r.size).filter(Boolean)));
        const variants = Array.from(new Set(list.map(r => r.variant)));
        const extra = list.filter(r => r.surcharge > 0);
        lines.push(
            `${decoration}: обкладинка ${covers.join(', ') || 'будь-яка'}, формати ${sizes.join(', ') || 'без прив’язки'}, ` +
            `варіанти — ${variants.join(', ')}${extra.length ? `. Доплата є за ${extra.map(e => `${e.variant} (${e.surcharge} грн)`).join(', ')}` : '. Без доплати'}.`,
        );
    }
    return { text: lines.join('\n') };
}

/** Product options: «які покриття є у фотодруку», «які формати полароїда». */
async function answerProductOptions(question: string): Promise<CatalogueAnswer> {
    const admin = getAdminClient();
    const { data: products } = await admin
        .from('products')
        .select('name, slug, options')
        .eq('is_active', true)
        .not('options', 'is', null);

    const words = question.toLowerCase();
    const scored = (products || [])
        .map((p: any) => {
            const name = String(p.name || '').toLowerCase();
            // Match on the distinctive part of the product name, so «полароїд»
            // finds «Полароїд» without «фото» dragging in every product.
            const tokens = name.split(/[^\p{L}\d]+/u).filter(t => t.length >= 5);
            const hits = tokens.filter(t => words.includes(t.slice(0, 6))).length;
            return { p, hits };
        })
        .filter(x => x.hits > 0)
        .sort((a, b) => b.hits - a.hits);

    if (!scored.length) return null;

    const { p } = scored[0];
    const groups: any[] = Array.isArray(p.options) ? p.options : [];
    if (!groups.length) return { text: `У товару «${p.name}» у каталозі немає жодної опції.` };

    const lines = [`«${p.name}» — що можна обрати:`];
    for (const g of groups) {
        const values = Array.isArray(g?.options)
            ? g.options.map((o: any) => String(o?.label ?? o?.value ?? '')).filter(Boolean)
            : [];
        if (!values.length) continue;
        const shown = values.length > 12
            ? `${values.slice(0, 12).join(', ')} і ще ${values.length - 12}`
            : values.join(', ');
        lines.push(`${g?.name || 'Опція'}: ${shown}.`);
    }
    return { text: lines.join('\n') };
}

/**
 * The entry point. Returns null when the question is not about the catalogue,
 * so the router can carry on to the handlers that follow.
 */
export async function answerCatalogueQuestion(question: string): Promise<string | null> {
    const text = String(question || '');
    if (!ASKING.test(text)) return null;

    try {
        if (DECOR_WORDS.test(text)) {
            const decor = await answerDecoration(text);
            if (decor) return decor.text;
        }
        if (OPTION_WORDS.test(text)) {
            const opts = await answerProductOptions(text);
            if (opts) return opts.text;
        }
    } catch (e) {
        console.error('[catalogue-answers] failed:', e);
    }
    return null;
}
