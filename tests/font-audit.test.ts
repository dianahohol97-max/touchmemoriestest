import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  auditSheetFonts,
  describeFontProblem,
  blockingFontReason,
  reportedFontNotes,
  parseUnicodeRange,
  rangesCover,
  normalizeFamily,
  isGenericFamily,
  isBlockingProblem,
  type DeclaredFace,
} from '@/lib/print/font-audit';
import { isTransientRenderFailure } from '@/lib/print/render-retry';

/**
 * Межа, яку пиняє цей тест: що вважати «шрифт не завантажився».
 *
 * З одного боку від неї — книжка, надрукована накресленням, якого клієнтка не
 * обирала, і дізнається вона про це з посилки. З другого — зупинений рендер
 * справного макета, тобто замовлення, яке не поїхало у друк через літеру, якої
 * в тому шрифті не було ніколи. Обидві помилки коштують дорого, і обидві
 * невидимі в коді, тому випадки розписані тут поіменно.
 */

// Справжні підмножини Google для двох родин — те, що сторож бачить у документі.
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+2122';
const CYRILLIC = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';

const PACK = ['Marck Script', 'Playfair Display', 'Lato', 'Montserrat'];

function faces(spec: Array<[string, string, DeclaredFace['status']]>): DeclaredFace[] {
  return spec.map(([family, unicodeRange, status]) => ({ family, unicodeRange, status }));
}

describe('розбір unicode-range', () => {
  it('читає одиночний кодпоінт, діапазон і шаблон', () => {
    expect(parseUnicodeRange('U+0301')).toEqual([[0x301, 0x301]]);
    expect(parseUnicodeRange('U+0400-045F')).toEqual([[0x400, 0x45f]]);
    expect(parseUnicodeRange('U+4??')).toEqual([[0x400, 0x4ff]]);
  });

  it('порожній рядок означає «покриває все» — саме так поводиться грань без range', () => {
    const all = parseUnicodeRange('');
    expect(rangesCover(all, 0x10000)).toBe(true);
  });

  it('кирилична підмножина покриває українські літери і не покриває латинських', () => {
    const cyr = parseUnicodeRange(CYRILLIC);
    for (const ch of 'їієґПривіт') expect(rangesCover(cyr, ch.codePointAt(0)!)).toBe(true);
    expect(rangesCover(cyr, 'H'.codePointAt(0)!)).toBe(false);
  });
});

describe('назви родин', () => {
  it('лапки, регістр і подвійні пробіли не роблять родину іншою', () => {
    expect(normalizeFamily('"Marck  Script"')).toBe('marck script');
    expect(normalizeFamily("'Playfair Display'")).toBe('playfair display');
  });

  it('узагальнені сімейства не є шрифтом і не перевіряються', () => {
    for (const g of ['serif', 'sans-serif', 'MONOSPACE', 'system-ui', 'cursive']) {
      expect(isGenericFamily(g)).toBe(true);
    }
    expect(isGenericFamily('Georgia')).toBe(false);
  });
});

describe('сторож шрифтів аркуша', () => {
  it('мовчить, коли всі потрібні грані завантажені', () => {
    const declared = faces([
      ['Marck Script', LATIN, 'loaded'],
      ['Marck Script', CYRILLIC, 'loaded'],
    ]);
    const problems = auditSheetFonts([{ family: 'Marck Script', text: 'Привіт Hello' }], declared, PACK);
    expect(problems).toEqual([]);
    expect(blockingFontReason(problems)).toBeNull();
  });

  it('ловить упалу кириличну грань при живій латинській — саме це сталося в досліді', () => {
    // Один FontFace error, сусідній loaded. Аркуш виходить наполовину
    // авторським, наполовину системним, і жодна наявна перевірка цього не бачить.
    const declared = faces([
      ['Marck Script', LATIN, 'loaded'],
      ['Marck Script', CYRILLIC, 'error'],
    ]);
    const problems = auditSheetFonts([{ family: 'Marck Script', text: 'Привіт Hello' }], declared, PACK);
    expect(problems.map(p => p.kind)).toEqual(['not-loaded']);
    expect(problems[0].chars).toBe('Привіт');
    const reason = blockingFontReason(problems);
    expect(reason).toContain('шрифт не завантажився: Marck Script');
  });

  it('ловить грань, яка ще не почала вантажитись', () => {
    const declared = faces([['Montserrat', CYRILLIC, 'unloaded'], ['Montserrat', LATIN, 'loaded']]);
    const problems = auditSheetFonts([{ family: 'Montserrat', text: 'Привіт' }], declared, PACK);
    expect(problems.map(p => p.kind)).toEqual(['not-loaded']);
  });

  it('порожній FontFaceSet — це «наш CSS не доїхав», а не «шрифта не існує»', () => {
    // Саме такий стан дав дослід із заблокованою таблицею стилів: жодної грані,
    // а document.fonts.check() відповідає true для будь-якої родини.
    const problems = auditSheetFonts([{ family: 'Playfair Display', text: 'Привіт' }], [], PACK);
    expect(problems.map(p => p.kind)).toEqual(['css-missing']);
    expect(blockingFontReason(problems)).toContain('Playfair Display');
  });

  it('родина поза нашим набором не зупиняє аркуш, але й не мовчить', () => {
    // Georgia зі старої панелі властивостей: системний шрифт, якого в контейнері
    // Railway немає. Повтор не допоможе ніколи, тож це звіт, а не відмова.
    const problems = auditSheetFonts([{ family: 'Georgia', text: 'Привіт' }], [], PACK);
    expect(problems.map(p => p.kind)).toEqual(['unknown-family']);
    expect(blockingFontReason(problems)).toBeNull();
    expect(reportedFontNotes(problems)[0]).toContain('Georgia');
  });

  it('кирилиця в Lato — звіт, а не відмова: гліфів немає ніде', () => {
    // У Lato кириличної підмножини не віддає ні Google, ні апстрім. Відмова тут
    // зробила б дванадцять збережених макетів недрукованими назавжди.
    const declared = faces([['Lato', LATIN, 'loaded']]);
    const problems = auditSheetFonts([{ family: 'Lato', text: 'Привіт Hello' }], declared, PACK);
    expect(problems.map(p => p.kind)).toEqual(['no-glyphs']);
    expect(problems[0].chars).toBe('Привіт');
    expect(blockingFontReason(problems)).toBeNull();
  });

  it('емодзі в підписі не валить аркуш', () => {
    const declared = faces([['Montserrat', LATIN, 'loaded']]);
    const problems = auditSheetFonts([{ family: 'Montserrat', text: 'Hi ❤️' }], declared, PACK);
    expect(blockingFontReason(problems)).toBeNull();
  });

  it('пробіли і переноси не вважаються ненамальованими', () => {
    const declared = faces([['Montserrat', CYRILLIC, 'loaded']]);
    const problems = auditSheetFonts([{ family: 'Montserrat', text: 'Привіт\n світ' }], declared, PACK);
    expect(problems).toEqual([]);
  });

  it('узагальнене сімейство пропускається цілком', () => {
    expect(auditSheetFonts([{ family: 'sans-serif', text: 'Привіт' }], [], PACK)).toEqual([]);
    expect(auditSheetFonts([{ family: '', text: 'Привіт' }], [], PACK)).toEqual([]);
  });

  it('одна родина на кількох блоках дає один висновок, а не десять', () => {
    const declared = faces([['Marck Script', LATIN, 'loaded'], ['Marck Script', CYRILLIC, 'error']]);
    const problems = auditSheetFonts([
      { family: 'Marck Script', text: 'Привіт' },
      { family: 'Marck Script', text: 'світ' },
      { family: '"Marck Script"', text: 'ще' },
    ], declared, PACK);
    expect(problems).toHaveLength(1);
    expect([...problems[0].chars].sort().join('')).toBe([...new Set('Привітсвітще')].sort().join(''));
  });

  it('причина називає писемність, а не набір літер', () => {
    // Перша спроба друкувала сам набір різних символів, і «Привіт світ» ставало
    // «Пвітср» — на вигляд одруківка, а не діагноз.
    const declared = faces([['Marck Script', LATIN, 'loaded'], ['Marck Script', CYRILLIC, 'error']]);
    const [problem] = auditSheetFonts([{ family: 'Marck Script', text: 'Привіт світ Hello' }], declared, PACK);
    expect(describeFontProblem(problem))
      .toBe('шрифт не завантажився: Marck Script — не приїхав файл, у якому кирилиця');
  });

  it('мішанину писемностей показує символами, бо інакше доведеться дивитися очима', () => {
    const declared = faces([['Montserrat', LATIN, 'loaded']]);
    const [problem] = auditSheetFonts([{ family: 'Montserrat', text: 'Привіт Ωμέγα' }], declared, PACK);
    expect(describeFontProblem(problem)).toContain('символи');
  });

  it('те, що зупиняє, стоїть у переліку першим', () => {
    const declared = faces([['Lato', LATIN, 'loaded'], ['Montserrat', CYRILLIC, 'error']]);
    const problems = auditSheetFonts([
      { family: 'Lato', text: 'Привіт' },
      { family: 'Montserrat', text: 'Привіт' },
    ], declared, PACK);
    expect(isBlockingProblem(problems[0].kind)).toBe(true);
  });
});

describe('звʼязок із наявним механізмом повтору', () => {
  it('причина «шрифт не завантажився» визнається обривом, який варто повторити', () => {
    // Без цього аркуш із невдалим шрифтом лишався б невдалим з першої спроби:
    // render-order повторює тільки те, що впізнає як зовнішній обрив.
    const declared = faces([['Marck Script', CYRILLIC, 'error']]);
    const reason = blockingFontReason(auditSheetFonts([{ family: 'Marck Script', text: 'Привіт' }], declared, PACK))!;
    expect(isTransientRenderFailure(reason)).toBe(true);
  });

  it('звіт без зупинки не тягне за собою повтору', () => {
    const problems = auditSheetFonts([{ family: 'Georgia', text: 'Привіт' }], [], PACK);
    expect(reportedFontNotes(problems).some(isTransientRenderFailure)).toBe(false);
  });
});

describe('дзеркало в render-service', () => {
  /**
   * `render-service` збирається окремим Docker-образом, який копіює тільки
   * `server.ts` і `tsconfig.json`, тож імпортувати з `lib/` не може, і копія
   * правила живе там. Копія, що розійшлася з оригіналом, означає або мовчазну
   * підміну шрифта в друці, або зупинений рендер справного макета — тож звіряємо
   * не «схоже», а поіменно: ті самі висновки, ті самі слова в причині.
   */
  const server = readFileSync(join(process.cwd(), 'render-service', 'server.ts'), 'utf8');

  it('несе ті самі чотири висновки', () => {
    for (const kind of ['css-missing', 'not-loaded', 'unknown-family', 'no-glyphs']) {
      expect(server, `у render-service немає висновку ${kind}`).toContain(`'${kind}'`);
    }
  });

  it('зупиняє рівно на тих самих двох', () => {
    expect(server).toContain("kind === 'css-missing' || kind === 'not-loaded'");
  });

  it('говорить ті самі слова, які впізнає повтор', () => {
    expect(server).toContain('шрифт не завантажився');
  });
});
