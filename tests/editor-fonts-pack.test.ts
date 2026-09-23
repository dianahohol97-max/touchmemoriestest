import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { FONT_DATA, FONTS_NOT_ON_GOOGLE, EDITOR_FONTS_CSS_URL } from '@/lib/editor/constants';
import { FONTS_WITH_CYRILLIC } from '@/lib/editor/font-scripts';

/**
 * Локальний пакет шрифтів для друку мусить покривати всю підбірку конструктора.
 *
 * Це і є «механізм для нових шрифтів». Шрифт, доданий у `FONT_DATA` без запуску
 * `scripts/build-editor-fonts.py`, зупиняється тут, до деплою. Без цього тесту
 * він доїхав би до друку і виявив себе рівно один раз — надрукованою книжкою в
 * чужому накресленні, бо `/print` більше нікуди по нього не піде, а сторож у
 * рендер-сервісі скаже «шрифт не завантажився» вже після того, як клієнт
 * оформив замовлення.
 *
 * Тест читає ФАЙЛИ на диску, а не мережу: він має працювати і в CI без виходу
 * назовні, і сенс його саме в тому, щоб мережі тут більше не було.
 */

const PACK = join(process.cwd(), 'public', 'editor-fonts');

type Manifest = {
  families: Record<string, { subset: string; file: string; unicodeRange: string }[]>;
  notOnGoogle: string[];
  bytes: number;
};

const manifest: Manifest = JSON.parse(readFileSync(join(PACK, 'manifest.json'), 'utf8'));
const css = readFileSync(join(PACK, 'fonts.css'), 'utf8');

describe('локальний пакет шрифтів конструктора', () => {
  it('має файли для кожної родини з FONT_DATA', () => {
    const missing = FONT_DATA
      .map(f => f.name)
      .filter(name => !FONTS_NOT_ON_GOOGLE.has(name))
      .filter(name => !(manifest.families[name]?.length > 0));
    expect(missing, 'запусти python3 scripts/build-editor-fonts.py').toEqual([]);
  });

  it('не тягне зайвих родин, яких у підбірці вже немає', () => {
    const known = new Set(FONT_DATA.map(f => f.name));
    const extra = Object.keys(manifest.families).filter(name => !known.has(name));
    expect(extra).toEqual([]);
  });

  it('кожен файл із маніфесту справді лежить на диску', () => {
    const absent = Object.values(manifest.families)
      .flat()
      .map(face => face.file)
      .filter(file => !existsSync(join(PACK, 'files', file)));
    expect(absent).toEqual([]);
  });

  it('CSS посилається лише на файли, які є', () => {
    const referenced = [...css.matchAll(/url\(\/editor-fonts\/files\/([^)]+)\)/g)].map(m => m[1]);
    expect(referenced.length).toBeGreaterThan(0);
    const absent = referenced.filter(file => !existsSync(join(PACK, 'files', file)));
    expect(absent).toEqual([]);
  });

  it('кожна грань лишається 400 normal — бо саме так малюється жирний сьогодні', () => {
    // css2 на голий `family=Name` віддає одну грань 400/normal навіть для
    // змінних шрифтів, тож жирне і курсивне накреслення в книжці СИНТЕЗУЄ
    // браузер. Покласти сюди справжню грань 700 означало б змінити вигляд
    // кожного жирного підпису в усіх збережених макетах.
    const weights = [...css.matchAll(/font-weight:\s*([^;]+);/g)].map(m => m[1].trim());
    const styles = [...css.matchAll(/font-style:\s*([^;]+);/g)].map(m => m[1].trim());
    expect([...new Set(weights)]).toEqual(['400']);
    expect([...new Set(styles)]).toEqual(['normal']);
  });

  it('кожна грань має unicode-range — інакше перша ж родина перекрила б решту', () => {
    // Без unicode-range браузер вважає, що грань покриває всі символи, і
    // перестає качати інші підмножини тієї ж родини: кирилиця тоді малюється
    // латинським файлом, тобто нічим.
    const faces = [...css.matchAll(/@font-face \{([^}]*)\}/g)].map(m => m[1]);
    expect(faces.length).toBeGreaterThan(300);
    const withoutRange = faces.filter(face => !/unicode-range:/.test(face));
    expect(withoutRange).toEqual([]);
  });

  it('font-scripts.ts перелічує рівно ті родини, у яких у пакеті є кирилиця', () => {
    // Згенерований файл і маніфест мусять казати одне й те саме: це та мапа,
    // на яку спирається попередження «шрифт X не має кирилиці» і в конструкторі,
    // і в адмінці. Розійдеться — попередження або замовкне, або почне кричати
    // на справні макети.
    const fromManifest = Object.entries(manifest.families)
      .filter(([, faces]) => faces.some(f => f.subset === 'cyrillic'))
      .map(([name]) => name)
      .sort();
    expect([...FONTS_WITH_CYRILLIC].sort()).toEqual(fromManifest);
  });

  it('сторінка друку підключає саме цей файл', () => {
    expect(EDITOR_FONTS_CSS_URL).toBe('/editor-fonts/fonts.css');
    const printPage = readFileSync(
      join(process.cwd(), 'app', '[locale]', 'print', '[projectId]', 'page.tsx'),
      'utf8',
    );
    expect(printPage).toContain('EDITOR_FONTS_CSS_URL');
    // Друкований макет НЕ ходить у мережу по шрифти — у цьому вся зміна.
    expect(printPage).not.toContain('GOOGLE_FONTS_URL');
  });

  it('конструктори беруть шрифти з того самого файлу, що й друк', () => {
    // Екран і друк мусять читати ОДНЕ джерело: доти, доки конструктор ходив у
    // Google, а `/print` у нас, розійтися їм було на чому — і саме це
    // розходження коштувало б надрукованої книжки не тим шрифтом.
    for (const file of [
      ['components', 'BookLayoutEditor.tsx'],
      ['components', 'StarMapConstructor.tsx'],
      ['components', 'CityMapConstructor.tsx'],
      ['components', 'PosterConstructor.tsx'],
      ['components', 'DeskCalendarConstructor.tsx'],
      ['components', 'CalendarPrintPage.tsx'],
    ]) {
      const src = readFileSync(join(process.cwd(), ...file), 'utf8');
      expect(src, file.join('/')).toContain('EDITOR_FONTS_CSS_URL');
      expect(src, file.join('/')).not.toContain('https://fonts.googleapis.com');
    }
  });

  it('нових посилань на Google Fonts не з’являється', () => {
    // Сторож тієї самої породи, що й порожній пошук `api.brevo.com` поза
    // `lib/email/brevo.ts`: перелік нижче — це те, що лишилося НЕ переведеним, і
    // він мусить лише коротшати. Кожен із цих файлів просить родини поза
    // підбіркою (CoverEditor — Pinyon Script, Alex Brush, Italianno) або тягне
    // сам файл шрифта для Satori з параметром `&text=`, що наш пакет не
    // замінює. Новий рядок тут означає, що хтось повернув мережу в шлях, з
    // якого її прибрали.
    const allowed = [
      'app/[locale]/constructor/guestbook/GuestbookConstructor.tsx',
      'app/[locale]/constructor/photoalbum/PhotoalbumConstructor.tsx',
      'app/admin/orders/[id]/page.tsx',
      'components/CoverEditor.tsx',
      'components/PhotoPrintConstructor.tsx',
      'components/ui/InscriptionDesigner.tsx',
      'lib/print/wishbook-cover.tsx',   // Satori тягне сам файл, не таблицю стилів
      'lib/seo/og-font.ts',             // те саме для картинок OG
    ].sort();
    const found = execSync(
      "grep -rl 'https://fonts.googleapis.com' --include=*.ts --include=*.tsx app components lib || true",
      { cwd: process.cwd(), encoding: 'utf8' },
    ).split('\n').filter(Boolean).sort();
    expect(found).toEqual(allowed);
  });
});
