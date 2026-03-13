export interface ConstructorTemplate {
  id: string;
  name: string;
  thumbnailSVG: string;
}

export const TEMPLATES: ConstructorTemplate[] = [
  {
    id: 'classic-full',
    name: 'Класичний: Повний кадр',
    thumbnailSVG: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="80" height="80" fill="#f8fafc" stroke="#64748b" stroke-width="2" rx="4"/><rect x="18" y="18" width="64" height="64" fill="#cbd5e1" rx="2"/></svg>`
  },
  {
    id: 'classic-2-horiz',
    name: 'Класичний: 2 горизонтальних',
    thumbnailSVG: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="80" height="80" fill="#f8fafc" stroke="#64748b" stroke-width="2" rx="4"/><rect x="18" y="18" width="64" height="30" fill="#cbd5e1" rx="2"/><rect x="18" y="52" width="64" height="30" fill="#cbd5e1" rx="2"/></svg>`
  },
  {
    id: 'modern-3-collage',
    name: 'Модерн: Колаж на 3 фото',
    thumbnailSVG: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="80" height="80" fill="#f8fafc" stroke="#64748b" stroke-width="2" rx="4"/><rect x="18" y="18" width="30" height="30" fill="#cbd5e1" rx="2"/><rect x="52" y="18" width="30" height="30" fill="#cbd5e1" rx="2"/><rect x="18" y="52" width="64" height="30" fill="#cbd5e1" rx="2"/></svg>`
  },
  {
    id: 'minimal-grid-4',
    name: 'Мінімалізм: Сітка 4 фото',
    thumbnailSVG: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="80" height="80" fill="#f8fafc" stroke="#64748b" stroke-width="2" rx="4"/><rect x="18" y="18" width="30" height="30" fill="#cbd5e1" rx="2"/><rect x="52" y="18" width="30" height="30" fill="#cbd5e1" rx="2"/><rect x="18" y="52" width="30" height="30" fill="#cbd5e1" rx="2"/><rect x="52" y="52" width="30" height="30" fill="#cbd5e1" rx="2"/></svg>`
  }
];
