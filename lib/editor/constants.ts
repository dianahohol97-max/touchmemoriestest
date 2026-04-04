import type { LayoutDef } from './types';

// ── Layout definitions ───────────────────────────────────────────────────────

export const LAYOUTS: LayoutDef[] = [
  // 1 фото
  { id: 'p-full',         label: 'На всю сторінку',  slots: 1, group: '1 фото' },
  { id: 'p-center',       label: 'По центру',         slots: 1, group: '1 фото' },
  { id: 'p-top',          label: 'Зверху',            slots: 1, group: '1 фото' },
  { id: 'p-bottom',       label: 'Знизу',             slots: 1, group: '1 фото' },
  { id: 'p-left',         label: 'Ліворуч',           slots: 1, group: '1 фото' },
  { id: 'p-right',        label: 'Праворуч',          slots: 1, group: '1 фото' },
  // 2 фото
  { id: 'p-2-v',          label: '2 вертикально',     slots: 2, group: '2 фото' },
  { id: 'p-2-h',          label: '2 горизонтально',   slots: 2, group: '2 фото' },
  { id: 'p-2-big-top',    label: 'Велике зверху',     slots: 2, group: '2 фото' },
  { id: 'p-2-big-bottom', label: 'Велике знизу',      slots: 2, group: '2 фото' },
  { id: 'p-2-big-left',   label: 'Велике ліворуч',    slots: 2, group: '2 фото' },
  { id: 'p-2-big-right',  label: 'Велике праворуч',   slots: 2, group: '2 фото' },
  { id: 'p-2-diag',       label: 'Діагональ',         slots: 2, group: '2 фото' },
  // 3 фото
  { id: 'p-3-row',        label: '3 в рядок',         slots: 3, group: '3 фото' },
  { id: 'p-3-col',        label: '3 в стовпець',      slots: 3, group: '3 фото' },
  { id: 'p-3-top2',       label: '2 зверху + 1',      slots: 3, group: '3 фото' },
  { id: 'p-3-bot2',       label: '1 + 2 знизу',       slots: 3, group: '3 фото' },
  { id: 'p-3-left2',      label: '2 ліво + 1',        slots: 3, group: '3 фото' },
  { id: 'p-3-right2',     label: '1 + 2 право',       slots: 3, group: '3 фото' },
  { id: 'p-3-hero-top',   label: 'Велике + 2 знизу',  slots: 3, group: '3 фото' },
  { id: 'p-3-hero-left',  label: 'Велике + 2 право',  slots: 3, group: '3 фото' },
  // 4 фото
  { id: 'p-4-grid',       label: '4 рівно',           slots: 4, group: '4 фото' },
  { id: 'p-4-hero-top',   label: 'Велике + 3 знизу',  slots: 4, group: '4 фото' },
  { id: 'p-4-hero-left',  label: 'Велике + 3 право',  slots: 4, group: '4 фото' },
  { id: 'p-4-strip-h',    label: '4 горизонт смуга',  slots: 4, group: '4 фото' },
  { id: 'p-4-strip-v',    label: '4 вертик смуга',    slots: 4, group: '4 фото' },
  { id: 'p-4-l-shape',    label: 'Г-подібний',        slots: 4, group: '4 фото' },
  // 5 фото
  { id: 'p-5-hero',       label: 'Велике + 4',        slots: 5, group: '5 фото' },
  { id: 'p-5-grid',       label: '5 сітка',           slots: 5, group: '5 фото' },
  { id: 'p-5-strip',      label: '1 + 4 смуга',       slots: 5, group: '5 фото' },
  // 6 фото
  { id: 'p-6-grid',       label: '6 рівно (2×3)',     slots: 6, group: '6 фото' },
  { id: 'p-6-3x2',        label: '6 рівно (3×2)',     slots: 6, group: '6 фото' },
  { id: 'p-6-hero',       label: 'Велике + 5',        slots: 6, group: '6 фото' },
  // 7-9 фото
  { id: 'p-7-grid',       label: '7 сітка',           slots: 7, group: '7–9 фото' },
  { id: 'p-8-grid',       label: '8 сітка',           slots: 8, group: '7–9 фото' },
  { id: 'p-9-grid',       label: '9 рівно (3×3)',     slots: 9, group: '7–9 фото' },
  // Текст
  { id: 'p-text',         label: 'Тільки текст',      slots: 0, group: 'Текст' },
  { id: 'p-text-top',     label: 'Фото + текст знизу', slots: 1, group: 'Текст' },
  { id: 'p-text-bottom',  label: 'Текст + фото знизу', slots: 1, group: 'Текст' },
];

// ── Page proportions ─────────────────────────────────────────────────────────

export const PAGE_PROPORTIONS: Record<string, { w: number; h: number }> = {
  '20x20': { w: 200, h: 200 }, '20×20': { w: 200, h: 200 },
  '25x25': { w: 250, h: 250 }, '25×25': { w: 250, h: 250 },
  '20x30': { w: 200, h: 300 }, '20×30': { w: 200, h: 300 },
  '30x20': { w: 300, h: 200 }, '30×20': { w: 300, h: 200 },
  '30x30': { w: 300, h: 300 }, '30×30': { w: 300, h: 300 },
  'A4': { w: 210, h: 297 },
  '23x23': { w: 230, h: 230 }, '23×23': { w: 230, h: 230 },
  'magazine-A4': { w: 210, h: 297 },
  'travelbook': { w: 300, h: 200 },
};

// ── Color maps (single source of truth) ──────────────────────────────────────

export const VELOUR_COLORS: Record<string, string> = {
  'Молочний':'#F0EAD6','Бежевий':'#D9C8B0','Таупе':'#A89880','Рожевий':'#E8B4B8',
  'Бордо':'#7A2838','Сірий перловий':'#9A9898','Лаванда':'#B8A8C8','Синій':'#1A2040',
  'Графітовий':'#3A3038','Бірюзовий':'#1A9090','Марсала':'#6E2840','Блакитно-сірий':'#607080',
  'Темно-зелений':'#1E3028','Жовтий':'#D4A020',
};

export const LEATHERETTE_COLORS: Record<string, string> = {
  'Білий':'#F5F5F0','Бежевий':'#D9C8B0','Пісочний':'#D4A76A','Рудий':'#C8844E',
  'Бордо темний':'#7A2838','Золотистий':'#C4A83A','Теракотовий':'#C25A3C','Жовтий':'#F0B820',
  'Рожевий ніжний':'#E8B4B8','Фуксія':'#D84080','Червоний насичений':'#A01030',
  'Коричневий':'#8E5038','Вишневий':'#7A2020','Марсала':'#6E2840','Графітовий темний':'#3A3038',
  'Фіолетовий яскравий':'#8030A0','Фіолетовий темний':'#502060','Бірюзовий':'#4E9090',
  'Оливковий':'#A0A030','Темно-зелений':'#1E3028','Бірюзовий яскравий':'#00B0B0',
  'Блакитний яскравий':'#0088D0','Темно-синій':'#1A2040','Чорний':'#1A1A1A','Персиковий':'#E8A8A0',
};

export const FABRIC_COLORS: Record<string, string> = {
  'Бежевий/пісочний':'#C4AA88','Теракотовий/цегляний':'#A04838','Фуксія/пурпурний':'#B838A0',
  'Фіолетовий темний':'#582050','Марсала/бордо':'#602838','Коричневий':'#6E4830',
  'Сірий/графітовий':'#586058','Червоний яскравий':'#C02030','Оливковий/зелений':'#A0A020',
};

// ── Decoration variants ──────────────────────────────────────────────────────

export const ACRYLIC_VARIANTS: Record<string, string[]> = {
  '20x20':['100×100 мм','Ø145 мм'],
  '25x25':['100×100 мм','Ø145 мм'],
  '20x30':['100×100 мм','Ø145 мм'],
  '30x20':['100×100 мм','Ø145 мм'],
  '30x30':['100×100 мм','Ø145 мм','290×100 мм','215×290 мм'],
};

export const PHOTO_INSERT_VARIANTS: Record<string, string[]> = {
  '20x20':['100×100 мм'],'25x25':['100×100 мм'],
  '20x30':['100×100 мм'],'30x20':['100×100 мм'],
  '30x30':['197×197 мм','100×100 мм'],
};

export const METAL_VARIANTS: Record<string, string[]> = {
  '20x20':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний'],
  '25x25':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний'],
  '20x30':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний'],
  '30x20':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний','250×70 золотий','250×70 срібний'],
  '30x30':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний','250×70 золотий','250×70 срібний'],
};

export const FLEX_COLORS = [
  { label:'Золотий', value:'gold', color:'#D4AF37' },
  { label:'Срібний', value:'silver', color:'#C0C0C0' },
  { label:'Білий',   value:'white', color:'#FFFFFF' },
  { label:'Чорний',  value:'black', color:'#1A1A1A' },
];

export const METAL_COLORS = [
  { label:'Золотий', value:'gold',   color:'#D4AF37' },
  { label:'Срібний', value:'silver', color:'#C0C0C0' },
];

// ── Text colors palette ──────────────────────────────────────────────────────

export const TEXT_COLORS = [
  '#1e2d7d','#000000','#ffffff','#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899',
  '#6b7280','#92400e','#065f46','#1e3a5f','#7c2d12','#4c1d95',
];

// ── Font groups ──────────────────────────────────────────────────────────────

export const CYRILLIC_DECORATIVE_FONTS = [
  { label:'Marck Script', value:'Marck Script', style:'cursive' },
  { label:'Caveat', value:'Caveat', style:'cursive' },
  { label:'Comfortaa', value:'Comfortaa', style:'rounded' },
  { label:'Philosopher', value:'Philosopher', style:'serif' },
  { label:'Cormorant Garamond', value:'Cormorant Garamond', style:'elegant' },
  { label:'Montserrat', value:'Montserrat', style:'sans' },
  { label:'Lobster', value:'Lobster', style:'cursive' },
  { label:'Pacifico', value:'Pacifico', style:'cursive' },
  { label:'Rubik', value:'Rubik', style:'rounded' },
  { label:'Nunito', value:'Nunito', style:'rounded' },
  { label:'Ubuntu', value:'Ubuntu', style:'sans' },
];

// Each font has: name, cyrillic support flag
export const FONT_DATA: { name: string; cyr: boolean }[] = [
  // Сучасні (20)
  { name: 'Montserrat', cyr: true }, { name: 'Inter', cyr: true }, { name: 'Lato', cyr: true },
  { name: 'Raleway', cyr: true }, { name: 'Nunito', cyr: true }, { name: 'Poppins', cyr: true },
  { name: 'Oswald', cyr: true }, { name: 'Josefin Sans', cyr: false }, { name: 'Rubik', cyr: true },
  { name: 'Ubuntu', cyr: true }, { name: 'Exo 2', cyr: true }, { name: 'Jost', cyr: true },
  { name: 'Manrope', cyr: true }, { name: 'Roboto', cyr: true }, { name: 'Fira Sans', cyr: true },
  { name: 'Source Sans 3', cyr: true }, { name: 'Noto Sans', cyr: true }, { name: 'Outfit', cyr: false },
  { name: 'DM Sans', cyr: false }, { name: 'Plus Jakarta Sans', cyr: false },
  // Класичні (14)
  { name: 'Playfair Display', cyr: true }, { name: 'Cormorant Garamond', cyr: true },
  { name: 'EB Garamond', cyr: true }, { name: 'Libre Baskerville', cyr: false },
  { name: 'Lora', cyr: true }, { name: 'Merriweather', cyr: true },
  { name: 'PT Serif', cyr: true }, { name: 'Noto Serif', cyr: true },
  { name: 'Crimson Text', cyr: false }, { name: 'Cormorant', cyr: true },
  { name: 'Old Standard TT', cyr: true }, { name: 'Literata', cyr: true },
  { name: 'Bitter', cyr: true }, { name: 'Vollkorn', cyr: true },
  // Рукописні (22)
  { name: 'Dancing Script', cyr: false }, { name: 'Great Vibes', cyr: false },
  { name: 'Pacifico', cyr: true }, { name: 'Sacramento', cyr: false },
  { name: 'Satisfy', cyr: false }, { name: 'Caveat', cyr: true },
  { name: 'Marck Script', cyr: true }, { name: 'Bad Script', cyr: true },
  { name: 'Neucha', cyr: true }, { name: 'Pangolin', cyr: true },
  { name: 'Ruslan Display', cyr: true }, { name: 'Amatic SC', cyr: true },
  { name: 'Indie Flower', cyr: false }, { name: 'Kalam', cyr: false },
  { name: 'Patrick Hand', cyr: false }, { name: 'Shadows Into Light', cyr: false },
  { name: 'Permanent Marker', cyr: false }, { name: 'Handlee', cyr: false },
  { name: 'Architects Daughter', cyr: false }, { name: 'Reenie Beanie', cyr: false },
  { name: 'Comforter', cyr: true }, { name: 'Tektur', cyr: true },
  // NEW cyrillic handwriting
  { name: 'Cormorant Unicase', cyr: true }, { name: 'Podkova', cyr: true },
  { name: 'Seymour One', cyr: true }, { name: 'Shantell Sans', cyr: true },
  { name: 'Comforter Brush', cyr: true }, { name: 'Kyiv Type Sans', cyr: true },
  { name: 'Wix Madefor Text', cyr: true }, { name: 'Schibsted Grotesk', cyr: true },
  // Декоративні (30)
  { name: 'Abril Fatface', cyr: false }, { name: 'Cinzel', cyr: false },
  { name: 'Bebas Neue', cyr: false }, { name: 'Righteous', cyr: false },
  { name: 'Cormorant SC', cyr: true }, { name: 'Dela Gothic One', cyr: false },
  { name: 'Unbounded', cyr: true }, { name: 'Kelly Slab', cyr: true },
  { name: 'Philosopher', cyr: true }, { name: 'Russo One', cyr: true },
  { name: 'Comfortaa', cyr: true }, { name: 'Lobster', cyr: true },
  { name: 'Poiret One', cyr: true }, { name: 'Yeseva One', cyr: true },
  { name: 'Press Start 2P', cyr: true }, { name: 'Spectral', cyr: true },
  { name: 'Alegreya', cyr: true }, { name: 'Alegreya SC', cyr: true },
  { name: 'Open Sans', cyr: true }, { name: 'Kurale', cyr: true },
  { name: 'Tenor Sans', cyr: true }, { name: 'Forum', cyr: true },
  { name: 'Oranienbaum', cyr: true }, { name: 'Bellota', cyr: true },
  // NEW cyrillic decorative
  { name: 'Playfair Display SC', cyr: true }, { name: 'Prosto One', cyr: true },
  { name: 'Stalinist One', cyr: true }, { name: 'Underdog', cyr: true },
  { name: 'Gabriela', cyr: true }, { name: 'Cormorant Infant', cyr: true },
  { name: 'Cinzel Decorative', cyr: false }, { name: 'El Messiri', cyr: false },
  { name: 'Marmelad', cyr: true }, { name: 'Ledger', cyr: true },
];

export const FONT_GROUPS = [
  { group: 'Сучасні', fonts: ['Montserrat','Inter','Lato','Raleway','Nunito','Poppins','Oswald','Josefin Sans','Rubik','Ubuntu','Exo 2','Jost','Manrope','Roboto','Fira Sans','Source Sans 3','Noto Sans','Outfit','DM Sans','Plus Jakarta Sans'] },
  { group: 'Класичні', fonts: ['Playfair Display','Cormorant Garamond','EB Garamond','Libre Baskerville','Lora','Merriweather','PT Serif','Noto Serif','Crimson Text','Cormorant','Old Standard TT','Literata','Bitter','Vollkorn'] },
  { group: 'Рукописні', fonts: ['Dancing Script','Great Vibes','Pacifico','Sacramento','Satisfy','Caveat','Marck Script','Bad Script','Neucha','Pangolin','Ruslan Display','Amatic SC','Indie Flower','Kalam','Patrick Hand','Shadows Into Light','Permanent Marker','Handlee','Architects Daughter','Reenie Beanie','Comforter','Tektur','Cormorant Unicase','Podkova','Seymour One','Shantell Sans','Comforter Brush','Kyiv Type Sans','Wix Madefor Text','Schibsted Grotesk'] },
  { group: 'Декоративні', fonts: ['Abril Fatface','Cinzel','Bebas Neue','Righteous','Cormorant SC','Dela Gothic One','Unbounded','Kelly Slab','Philosopher','Russo One','Comfortaa','Lobster','Poiret One','Yeseva One','Alegreya','Alegreya SC','Press Start 2P','Spectral','Kurale','Tenor Sans','Forum','Oranienbaum','Bellota','Playfair Display SC','Prosto One','Stalinist One','Underdog','Gabriela','Cormorant Infant','Cinzel Decorative','El Messiri','Marmelad','Ledger'] },
];

// Google Fonts URL (single source — loaded once)
export const GOOGLE_FONTS_URL = (() => {
  const families = FONT_DATA.map(f => f.name.replace(/ /g, '+')).map(f => `family=${f}:ital,wght@0,400;0,700;1,400`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&subset=cyrillic,cyrillic-ext,latin&display=swap`;
})();

// ── Printed cover background presets ─────────────────────────────────────────

export const PRINTED_BG_PRESETS = [
  '#ffffff','#f1f5f9','#0a0e1a','#050a18','#1e2d7d','#263a99',
  '#fef3c7','#fce7f3','#f0fdf4','#fff7ed','#1a1a2e','#16213e',
];
