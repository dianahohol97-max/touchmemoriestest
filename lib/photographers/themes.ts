/**
 * Landing themes for photographer pages. Each theme is a full design system
 * slice — palette, typography, alignment, portfolio grid and geometry — not
 * just a palette swap, so the six options feel genuinely different:
 *
 *   classic   — тепла світла класика, згруповано по центру, перший кадр 2×2
 *   noir      — глибокий чорний, фото «світяться», драматичний настрій
 *   editorial — крем + серіф, вирівнювання ліворуч, портретна сітка 4:5 (журнал)
 *   film      — пісочно-кавова «тепла плівка», м'які великі радіуси
 *   studio    — галерейний мінімалізм: сірий/чорний, гострі кути, капс
 *   blush     — ніжний рожево-кремовий для весільних і сімейних зйомок
 *
 * Tokens are consumed as inline styles (Tailwind can't see runtime-generated
 * class names, so dynamic theming must not rely on JIT classes).
 */

export interface LandingTheme {
  key: string;
  label: string;
  tagline: string;
  dark: boolean;
  // palette
  bg: string;
  ink: string;
  muted: string;
  faint: string;
  card: string;
  border: string;
  divider: string;
  accent: string;      // primary CTA background
  accentInk: string;   // primary CTA text
  chipBorder: string;
  chipBg: string;
  ctaBandBg: string;
  ctaBandInk: string;
  ctaBandMuted: string;
  tileBg: string;
  // shape & type
  radius: number;              // tiles/cards base radius, px
  pill: boolean;               // pill buttons vs rectangular
  headingFont: string;
  headingWeight: number;
  headingTransform: 'uppercase' | 'none';
  headingSpacing: string;      // h1 letter-spacing
  labelSpacing: string;        // uppercase kicker letter-spacing
  heroAlign: 'center' | 'left';
  grid: 'feature' | 'uniform' | 'portrait';
  heroBackdrop: boolean;       // blurred first portfolio shot behind the hero
}

const MONTSERRAT = "var(--font-montserrat), Montserrat, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

export const LANDING_THEMES: LandingTheme[] = [
  {
    key: 'classic',
    label: 'Класика',
    tagline: 'Тепла світла база — пасує всім',
    dark: false,
    bg: '#faf8f5', ink: '#1c1917', muted: '#57534e', faint: '#a8a29e',
    card: '#ffffff', border: '#e7e5e4', divider: '#f5f5f4',
    accent: '#1c1917', accentInk: '#faf8f5',
    chipBorder: '#d6d3d1', chipBg: 'rgba(255,255,255,0.7)',
    ctaBandBg: '#1c1917', ctaBandInk: '#faf8f5', ctaBandMuted: '#d6d3d1',
    tileBg: '#e7e5e4',
    radius: 12, pill: true,
    headingFont: MONTSERRAT, headingWeight: 800, headingTransform: 'none', headingSpacing: '-0.02em',
    labelSpacing: '0.28em',
    heroAlign: 'center', grid: 'feature', heroBackdrop: true,
  },
  {
    key: 'noir',
    label: 'Нуар',
    tagline: 'Темний і драматичний — фото сяють',
    dark: true,
    bg: '#0c0a09', ink: '#fafaf9', muted: '#d6d3d1', faint: '#78716c',
    card: '#1c1917', border: '#292524', divider: '#292524',
    accent: '#fafaf9', accentInk: '#0c0a09',
    chipBorder: '#44403c', chipBg: 'rgba(28,25,23,0.7)',
    ctaBandBg: '#1c1917', ctaBandInk: '#fafaf9', ctaBandMuted: '#a8a29e',
    tileBg: '#1c1917',
    radius: 10, pill: true,
    headingFont: MONTSERRAT, headingWeight: 800, headingTransform: 'none', headingSpacing: '-0.02em',
    labelSpacing: '0.3em',
    heroAlign: 'center', grid: 'feature', heroBackdrop: true,
  },
  {
    key: 'editorial',
    label: 'Едиторіал',
    tagline: 'Серіф і повітря — як розворот журналу',
    dark: false,
    bg: '#f7f5f0', ink: '#292524', muted: '#57534e', faint: '#a29a8c',
    card: '#fffdf9', border: '#e5e0d5', divider: '#efe9dd',
    accent: '#292524', accentInk: '#f7f5f0',
    chipBorder: '#d5cec0', chipBg: 'rgba(255,253,249,0.8)',
    ctaBandBg: '#292524', ctaBandInk: '#f7f5f0', ctaBandMuted: '#c9c2b3',
    tileBg: '#e5e0d5',
    radius: 4, pill: false,
    headingFont: SERIF, headingWeight: 700, headingTransform: 'none', headingSpacing: '0',
    labelSpacing: '0.24em',
    heroAlign: 'left', grid: 'portrait', heroBackdrop: false,
  },
  {
    key: 'film',
    label: 'Тепла плівка',
    tagline: 'Пісок і кава — вінтажний настрій',
    dark: false,
    bg: '#f5ede2', ink: '#43302b', muted: '#7d6a5d', faint: '#a9968a',
    card: '#fdf8f1', border: '#e6d9c8', divider: '#efe4d4',
    accent: '#6f4e37', accentInk: '#fdf8f1',
    chipBorder: '#d9c8b2', chipBg: 'rgba(253,248,241,0.75)',
    ctaBandBg: '#5b4032', ctaBandInk: '#f5ede2', ctaBandMuted: '#cdb9a6',
    tileBg: '#e6d9c8',
    radius: 20, pill: true,
    headingFont: MONTSERRAT, headingWeight: 800, headingTransform: 'none', headingSpacing: '-0.01em',
    labelSpacing: '0.26em',
    heroAlign: 'center', grid: 'uniform', heroBackdrop: true,
  },
  {
    key: 'studio',
    label: 'Студія',
    tagline: 'Галерейний мінімалізм, гострі кути',
    dark: false,
    bg: '#f4f4f5', ink: '#09090b', muted: '#3f3f46', faint: '#a1a1aa',
    card: '#ffffff', border: '#d4d4d8', divider: '#e4e4e7',
    accent: '#09090b', accentInk: '#ffffff',
    chipBorder: '#a1a1aa', chipBg: '#ffffff',
    ctaBandBg: '#09090b', ctaBandInk: '#fafafa', ctaBandMuted: '#a1a1aa',
    tileBg: '#e4e4e7',
    radius: 0, pill: false,
    headingFont: MONTSERRAT, headingWeight: 900, headingTransform: 'uppercase', headingSpacing: '0.06em',
    labelSpacing: '0.34em',
    heroAlign: 'left', grid: 'uniform', heroBackdrop: false,
  },
  {
    key: 'blush',
    label: 'Романтик',
    tagline: 'Ніжний блаш — весілля та сімʼї',
    dark: false,
    bg: '#fdf6f4', ink: '#4c3a3d', muted: '#8c7276', faint: '#bfa6aa',
    card: '#fffbfa', border: '#f2dfdb', divider: '#f8ebe8',
    accent: '#b76e79', accentInk: '#fffbfa',
    chipBorder: '#e6cdc9', chipBg: 'rgba(255,251,250,0.8)',
    ctaBandBg: '#8d5a63', ctaBandInk: '#fdf6f4', ctaBandMuted: '#e3c4c0',
    tileBg: '#f2dfdb',
    radius: 16, pill: true,
    headingFont: SERIF, headingWeight: 700, headingTransform: 'none', headingSpacing: '0',
    labelSpacing: '0.26em',
    heroAlign: 'center', grid: 'feature', heroBackdrop: true,
  },
];

export const DEFAULT_THEME_KEY = 'classic';

export function getLandingTheme(key?: string | null): LandingTheme {
  return LANDING_THEMES.find(t => t.key === key) || LANDING_THEMES[0];
}

export function isValidThemeKey(key: unknown): key is string {
  return typeof key === 'string' && LANDING_THEMES.some(t => t.key === key);
}
