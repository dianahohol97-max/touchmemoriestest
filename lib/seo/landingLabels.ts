// Display labels for landing pages, shared by the homepage LandingLinks block
// and the per-landing "related pages" block.

export const CITY_NAMES: Record<string, string> = {
    kyiv: 'Київ',
    lviv: 'Львів',
    kharkiv: 'Харків',
    odesa: 'Одеса',
    dnipro: 'Дніпро',
    ternopil: 'Тернопіль',
    zaporizhzhia: 'Запоріжжя',
    vinnytsia: 'Вінниця',
    'ivano-frankivsk': 'Івано-Франківськ',
    rivne: 'Рівне',
    lutsk: 'Луцьк',
    khmelnytskyi: 'Хмельницький',
    chernivtsi: 'Чернівці',
    poltava: 'Полтава',
    zhytomyr: 'Житомир',
    uzhhorod: 'Ужгород',
};

export function geoCityLabel(occasion: string, h1?: string | null): string {
    return CITY_NAMES[occasion] || h1 || occasion;
}

export function clusterLabel(h1?: string | null, occasion?: string): string {
    return (h1 || '').replace(/\s+на замовлення$/i, '').trim() || occasion || '';
}
