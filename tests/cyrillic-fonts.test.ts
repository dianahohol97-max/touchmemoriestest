import { describe, it, expect } from 'vitest';
import {
  hasCyrillic,
  fontHasCyrillic,
  textFallsBackFromFont,
  collectCyrillicFallbacks,
  collectPosterFallbacks,
  cyrillicFallbackLine,
  describeCyrillicFallback,
  fallbackReason,
  fontInPack,
} from '@/lib/editor/cyrillic-fonts';
import { FONT_DATA } from '@/lib/editor/constants';
import { FONTS_WITH_CYRILLIC } from '@/lib/editor/font-scripts';

/**
 * Шрифт без кирилиці під українським текстом.
 *
 * Lato, Poppins і Schibsted Grotesk стояли в підбірці з
 * прапорцем кирилиці, не маючи жодного кириличного гліфа. Дванадцять
 * збережених макетів несуть Lato, чотири Poppins, і весь цей час український
 * текст у них малювався системним шрифтом — на екрані одним, у друці іншим.
 * Підставити нічого не можна, тож лікування тут розмовне, і саме тому межа
 * («про що сказати, а про що мовчати») вартує тесту: зайве попередження
 * навчить клієнта не читати попереджень, а пропущене доїде до друкарні.
 */

describe('прапорець кирилиці', () => {
  it('cyr: true в FONT_DATA не буває без кириличних файлів', () => {
    // Односторонньо навмисне: прибрати шрифт із підбірки — рішення про товар,
    // і воно може бути будь-яким. Сьогодні обидві сторони все одно збігаються,
    // бо три останні розбіжності (Great Vibes, Dela Gothic One, El Messiri)
    // виправлені після перевірки в Chromium — див. тест нижче.
    const lying = FONT_DATA.filter(f => f.cyr && !FONTS_WITH_CYRILLIC.has(f.name)).map(f => f.name);
    expect(lying, 'ці шрифти обіцяють кирилицю, якої в їхніх файлах немає').toEqual([]);
  });

  it('три родини, через які це почалося, кирилиці справді не мають', () => {
    for (const name of ['Lato', 'Poppins', 'Schibsted Grotesk']) {
      expect(FONTS_WITH_CYRILLIC.has(name), name).toBe(false);
      expect(FONT_DATA.find(f => f.name === name)?.cyr, name).toBe(false);
    }
  });

  it('назви з переліку не прибрані — старий макет має відкриватися', () => {
    for (const name of ['Lato', 'Poppins', 'Schibsted Grotesk']) {
      expect(FONT_DATA.some(f => f.name === name), name).toBe(true);
    }
  });

  it('три родини, які кирилицю мають, повернуті в підбірку', () => {
    // Перевірено в Chromium на рядку без латиниці й пробілів: ширина не
    // збігається з `serif`, тобто малюють вони ВЛАСНИМИ гліфами, а не фолбеком.
    // Контроль у тому ж прогоні — Lato і Poppins дали ширину `serif` до
    // десятої пікселя, тобто метод відрізняє одне від одного.
    for (const name of ['Great Vibes', 'Dela Gothic One', 'El Messiri']) {
      expect(FONTS_WITH_CYRILLIC.has(name), name).toBe(true);
      expect(FONT_DATA.find(f => f.name === name)?.cyr, name).toBe(true);
    }
  });

  it('Kyiv Type Sans прибрана зовсім — її не існує на Google і немає в жодному макеті', () => {
    // Решта трьох лишається, бо їхні файли є і збережені макети на них стоять.
    // Ця ж не мала файлів ніколи: окремий запит на неї віддає «400: Font family
    // not found», а в спільному Google мовчки викидав назву і віддавав 97
    // родин замість 98.
    expect(FONT_DATA.some(f => f.name === 'Kyiv Type Sans')).toBe(false);
    expect(FONTS_WITH_CYRILLIC.has('Kyiv Type Sans')).toBe(false);
  });
});

describe('коли текст надрукується не тим шрифтом', () => {
  it('українські літери в родині без кирилиці', () => {
    expect(textFallsBackFromFont('Lato', 'Привіт')).toBe(true);
    expect(textFallsBackFromFont('Poppins', 'Наша подорож')).toBe(true);
  });

  it('латинський підпис у тій самій родині мовчить', () => {
    // Він виходить рівно таким, яким його видно на екрані.
    expect(textFallsBackFromFont('Lato', 'Our trip 2026')).toBe(false);
  });

  it('родина з кирилицею мовчить на будь-якому тексті', () => {
    expect(textFallsBackFromFont('Montserrat', 'Привіт Hello')).toBe(false);
    expect(textFallsBackFromFont('Marck Script', 'Наша подорож')).toBe(false);
  });

  it('порожнє поле шрифту — це «за замовчуванням», не наша справа', () => {
    expect(textFallsBackFromFont('', 'Привіт')).toBe(false);
  });

  it('українські ї, є, ґ і наголос рахуються кирилицею', () => {
    for (const ch of 'їєґІ') expect(hasCyrillic(ch), ch).toBe(true);
    expect(hasCyrillic('Hello 123')).toBe(false);
  });

  it('лапки навколо назви родини не роблять її іншою', () => {
    expect(fontHasCyrillic('"Montserrat"')).toBe(true);
    expect(fontHasCyrillic("'Lato'")).toBe(false);
  });
});

describe('родина поза нашим набором', () => {
  it('Georgia не входить у пакет, тож підміняється ЦІЛКОМ, а не частиною', () => {
    // Це системний шрифт Windows, якого в контейнері Railway немає. Кирилиця й
    // латиниця в ньому друкуються однаково чужою зарубкою, тому попередження
    // спрацьовує і на «Our trip», де про кирилицю не йдеться зовсім.
    expect(fontInPack('Georgia')).toBe(false);
    expect(fallbackReason('Georgia', 'Привіт')).toBe('not-in-pack');
    expect(fallbackReason('Georgia', 'Our trip 2026')).toBe('not-in-pack');
  });

  it('наша родина без кирилиці — це інший випадок і інші слова', () => {
    expect(fontInPack('Lato')).toBe(true);
    expect(fallbackReason('Lato', 'Привіт')).toBe('no-cyrillic');
    expect(fallbackReason('Lato', 'Our trip')).toBeNull();
  });

  it('порожній напис не має шрифту, тож і попередження не має', () => {
    expect(fallbackReason('Georgia', '   ')).toBeNull();
    expect(fallbackReason('Georgia', '')).toBeNull();
  });

  it('стек шрифтів читається за першою родиною', () => {
    expect(fontInPack('Montserrat, sans-serif')).toBe(true);
    expect(fallbackReason("'Georgia', serif", 'Привіт')).toBe('not-in-pack');
  });

  it('кожна причина каже своє', () => {
    expect(describeCyrillicFallback('Georgia', 'Привіт', 'not-in-pack'))
      .toBe('шрифт Georgia не входить у наш набір — ці рядки («Привіт») надрукуються системним шрифтом');
    expect(describeCyrillicFallback('Lato', 'Привіт', 'no-cyrillic'))
      .toBe('шрифт Lato не має кирилиці — ці рядки («Привіт») надрукуються іншим шрифтом');
  });
});

describe('обхід збереженого макета', () => {
  const pages = [
    { textBlocks: [{ id: 'cover-ignored', fontFamily: 'Lato', text: 'Привіт' }] }, // обкладинка — свій редактор
    { textBlocks: [
      { id: 'b1', fontFamily: 'Lato', text: 'Наша подорож' },
      { id: 'b2', fontFamily: 'Montserrat', text: 'Наша подорож' },
      { id: 'b3', fontFamily: 'Lato', text: 'Summer 2026' },
    ] },
    { textBlocks: [{ id: 'b4', fontFamily: 'Poppins', text: 'Київ' }] },
  ];
  const cover = {
    textFontFamily: 'Lato',
    decoText: 'Мандри',
    printedTextBlocks: [{ id: 'p1', fontFamily: 'Poppins', text: 'Разом' }],
    backCoverTexts: [{ id: 'bk1', fontFamily: 'Montserrat', text: 'Разом' }],
    extraTexts: [{ id: 'e1', text: 'Назавжди' }],
  };

  it('бере лише те, що справді підміниться', () => {
    const found = collectCyrillicFallbacks(pages, cover);
    expect(found.map(f => f.blockId).sort()).toEqual(['b1', 'b4', 'cover-deco', 'e1', 'p1'].sort());
  });

  it('нульова сторінка pages_data пропускається — обкладинка йде своїми полями', () => {
    const found = collectCyrillicFallbacks(pages, cover);
    expect(found.some(f => f.blockId === 'cover-ignored')).toBe(false);
  });

  it('напис обкладинки без власного шрифту бере шрифт обкладинки', () => {
    const found = collectCyrillicFallbacks([], cover);
    expect(found.find(f => f.blockId === 'e1')?.family).toBe('Lato');
  });

  it('порожній або зіпсований макет не ламає обхід', () => {
    expect(collectCyrillicFallbacks(null, null)).toEqual([]);
    expect(collectCyrillicFallbacks('щось', 42)).toEqual([]);
    expect(collectCyrillicFallbacks([{}, { textBlocks: null }], {})).toEqual([]);
  });

  it('рядок для адмінки групує по родині й каже, скількох написів це стосується', () => {
    const line = cyrillicFallbackLine(collectCyrillicFallbacks(pages, cover))!;
    expect(line).toContain('Lato');
    expect(line).toContain('Poppins');
    expect(line).toContain('і так у 2 написах');
  });

  it('без знахідок рядка немає зовсім', () => {
    expect(cyrillicFallbackLine([])).toBeNull();
  });

  it('формулювання дослівне — воно однакове в конструкторі й в адмінці', () => {
    expect(describeCyrillicFallback('Lato', 'Наша подорож'))
      .toBe('шрифт Lato не має кирилиці — ці рядки («Наша подорож») надрукуються іншим шрифтом');
  });

  it('Georgia в макеті книжки потрапляє в той самий перелік', () => {
    // Збережені макети з нею мають відкриватися й рендеритися, тож прибрати її
    // з підбірки — це пів справи; друга половина в тому, щоб такий макет сказав
    // про себе сам.
    const found = collectCyrillicFallbacks(
      [{}, { textBlocks: [{ id: 'g1', fontFamily: 'Georgia', text: 'Our trip' }] }],
      null,
    );
    expect(found).toHaveLength(1);
    expect(found[0].reason).toBe('not-in-pack');
    expect(cyrillicFallbackLine(found)).toContain('не входить у наш набір');
  });
});

/**
 * Постер лежить у тій самій колонці, що й книга, але іншою формою: увесь виріб —
 * один об'єкт конфігурації в `pages_data[0]`. Книжковий обхід нульову сторінку
 * пропускає навмисно, і через це перевірка макетів мовчала про постери весь час
 * свого існування, хоча обидві збережені зоряні карти з Georgia лежали в базі з
 * серпня. Друкарський файл постера складає браузер клієнта, повз /print і повз
 * сторож рендер-сервісу, тож інших очей у цих макетів немає взагалі.
 */
describe('шрифт у макеті постера', () => {
  it('один шрифт на весь виріб береться з конфігурації, а написи — з її полів', () => {
    const found = collectPosterFallbacks([{
      fontFamily: 'Georgia',
      headline: 'Час коли перейшов на заслужену пенсію',
      subtitle: '12 грудня 2022 р., Винники',
      dedication: '',
      // Не друкується: колір, розмір аркуша і назва товару на постер не йдуть.
      textColor: '#0a0e1a',
      size: 'A4 (21×29.7 см)',
      productType: 'Постер',
    }]);
    expect(found.map(f => f.blockId).sort()).toEqual(['headline', 'subtitle']);
    expect(found.every(f => f.reason === 'not-in-pack')).toBe(true);
  });

  it('текстові блоки постера мають кожен свій шрифт', () => {
    const found = collectPosterFallbacks([{
      textBlocks: [
        { id: 't1', fontFamily: 'Lato', text: 'Наша подорож' },
        { id: 't2', fontFamily: 'Lato', text: 'Summer 2026' },
        { id: 't3', fontFamily: 'Playfair Display', text: 'Наша подорож' },
      ],
    }]);
    expect(found.map(f => f.blockId)).toEqual(['t1']);
    expect(found[0].reason).toBe('no-cyrillic');
  });

  it('родина з пакета і з кирилицею мовчить', () => {
    expect(collectPosterFallbacks([{ fontFamily: 'Playfair Display', headline: 'Наша подорож' }])).toEqual([]);
  });

  it('книжковий макет через цей обхід нічого не додає', () => {
    // Обхід безпечно бігає по будь-якому макету: у книги ні `textBlocks`, ні
    // `fontFamily` на нульовій сторінці не буває, і саме тому тут не треба
    // питати про тип виробу.
    const book = [{ cover: true }, { textBlocks: [{ id: 'b1', fontFamily: 'Lato', text: 'Київ' }] }];
    expect(collectPosterFallbacks(book)).toEqual([]);
  });

  it('порожній або зіпсований макет не ламає обхід', () => {
    expect(collectPosterFallbacks(null)).toEqual([]);
    expect(collectPosterFallbacks([])).toEqual([]);
    expect(collectPosterFallbacks('щось')).toEqual([]);
    expect(collectPosterFallbacks([{ textBlocks: null, fontFamily: null }])).toEqual([]);
  });
});
