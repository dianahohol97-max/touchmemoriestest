import { describe, expect, it } from 'vitest';
import {
  PART_LIMIT_BYTES, archiveName, partLimitFor, chooseZipMethod, detectZipDevice, formatBytes,
  planZipParts, uniqueZipNames, zipEntryOverhead, type ZipFile,
} from '@/lib/photographers/zip-plan';
import { parseZipAttemptFinish, parseZipAttemptStart } from '@/lib/photographers/zip-attempt';

const MB = 1024 * 1024;

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  instagramIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 345.0.0.0 (iPhone15,2; iOS 17_5; uk_UA)',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.0.0 Mobile Safari/537.36 Instagram 345.0.0.0 Android',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0]',
  chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
};

describe('detectZipDevice', () => {
  it('розпізнає телефони, планшет і комп\'ютер', () => {
    expect(detectZipDevice(UA.iphone)).toBe('ios');
    expect(detectZipDevice(UA.android)).toBe('android');
    expect(detectZipDevice(UA.chromeWin)).toBe('desktop');
  });

  it('iPad, що прикидається Mac, — це ios за сенсорним екраном', () => {
    expect(detectZipDevice(UA.ipadDesktopMode, 5)).toBe('ios');
    expect(detectZipDevice(UA.ipadDesktopMode, 0)).toBe('desktop');
  });

  it('вбудований браузер Інстаграма й Фейсбука перемагає платформу', () => {
    expect(detectZipDevice(UA.instagramIos)).toBe('in-app');
    expect(detectZipDevice(UA.instagramAndroid)).toBe('in-app');
    expect(detectZipDevice(UA.facebook)).toBe('in-app');
  });

  it('порожній UA — комп\'ютер, а не помилка', () => {
    expect(detectZipDevice('')).toBe('desktop');
  });
});

describe('PART_LIMIT_BYTES', () => {
  it('iPhone 300 МБ, Android 500 МБ — рішення Діани від 2026-09-24', () => {
    expect(PART_LIMIT_BYTES.ios).toBe(300 * MB);
    expect(PART_LIMIT_BYTES.android).toBe(500 * MB);
    expect(PART_LIMIT_BYTES['in-app']).toBeLessThanOrEqual(PART_LIMIT_BYTES.ios);
  });
});

describe('partLimitFor', () => {
  it('після збою частини не більші за 500 МБ навіть на комп\'ютері', () => {
    expect(partLimitFor('desktop', false)).toBe(1024 * MB);
    expect(partLimitFor('desktop', true)).toBe(500 * MB);
    expect(partLimitFor('ios', true)).toBe(300 * MB);
  });
});

describe('chooseZipMethod', () => {
  // Галерея Ірини Владової: 280 фото, 3,66 ГБ.
  const irina = 3.66 * 1024 * MB;

  it('Chrome/Edge на комп\'ютері пише один архів на диск', () => {
    expect(chooseZipMethod({ device: 'desktop', canStreamToDisk: true, totalBytes: irina })).toBe('stream');
  });

  it('телефон ніколи не отримує stream, навіть якщо браузер щось оголосив', () => {
    expect(chooseZipMethod({ device: 'android', canStreamToDisk: true, totalBytes: irina })).toBe('parts');
    expect(chooseZipMethod({ device: 'ios', canStreamToDisk: true, totalBytes: irina })).toBe('parts');
  });

  it('мала галерея вміщується в один архів, велика йде частинами', () => {
    expect(chooseZipMethod({ device: 'ios', canStreamToDisk: false, totalBytes: 70 * MB })).toBe('single');
    expect(chooseZipMethod({ device: 'ios', canStreamToDisk: false, totalBytes: 300 * MB })).toBe('single');
    expect(chooseZipMethod({ device: 'ios', canStreamToDisk: false, totalBytes: 300 * MB + 1 })).toBe('parts');
    expect(chooseZipMethod({ device: 'desktop', canStreamToDisk: false, totalBytes: irina })).toBe('parts');
  });
});

describe('planZipParts', () => {
  const file = (i: number, mb: number): ZipFile => ({ id: String(i), name: `IMG_${i}.jpg`, size: mb * MB });

  it('жодна частина не перевищує ліміт разом із накладними витратами ZIP', () => {
    const files = Array.from({ length: 280 }, (_, i) => file(i, 13 + (i % 9)));
    const limit = PART_LIMIT_BYTES.ios;
    const { parts, separate } = planZipParts(files, limit);
    expect(separate).toHaveLength(0);
    for (const p of parts) {
      const used = p.reduce((s, f) => s + f.size + zipEntryOverhead(f.name), 0);
      expect(used).toBeLessThanOrEqual(limit);
    }
  });

  it('зберігає порядок і не губить і не дублює жодного файлу', () => {
    const files = Array.from({ length: 50 }, (_, i) => file(i, 40));
    const { parts } = planZipParts(files, 300 * MB);
    expect(parts.flat().map(f => f.id)).toEqual(files.map(f => f.id));
  });

  it('файл, важчий за частину, йде окремим посиланням', () => {
    const files = [file(1, 10), file(2, 1200), file(3, 10)];
    const { parts, separate } = planZipParts(files, 500 * MB);
    expect(separate.map(f => f.id)).toEqual(['2']);
    expect(parts).toEqual([[files[0], files[2]]]);
  });

  it('невідомий розмір рахується як нуль, а файл не губиться', () => {
    const files = [{ id: 'a', name: 'a.jpg', size: 0 }, { id: 'b', name: 'b.jpg', size: NaN as any }];
    expect(planZipParts(files, MB).parts.flat()).toHaveLength(2);
  });

  it('порожня галерея — нуль частин', () => {
    expect(planZipParts([], MB)).toEqual({ parts: [], separate: [] });
  });

  it('межа точна: рівно в ліміт — одна частина, на байт більше — дві', () => {
    const over = zipEntryOverhead('a.jpg');
    const a = { id: 'a', name: 'a.jpg', size: 1000 - over };
    const b = { id: 'b', name: 'a.jpg', size: 1000 - over };
    expect(planZipParts([a, b], 2000).parts).toHaveLength(1);
    expect(planZipParts([a, b], 1999).parts).toHaveLength(2);
  });
});

describe('uniqueZipNames', () => {
  it('збіг отримує суфікс, а не заміняє файл', () => {
    const names = uniqueZipNames([
      { file_name: 'IMG_0001.jpg' }, { file_name: 'IMG_0001.jpg' }, { file_name: 'IMG_0001.jpg' },
    ]);
    expect(names).toEqual(['IMG_0001.jpg', 'IMG_0001 (2).jpg', 'IMG_0001 (3).jpg']);
  });

  it('порівнює без регістру, як Windows і macOS', () => {
    expect(uniqueZipNames([{ file_name: 'IMG_1.JPG' }, { file_name: 'img_1.jpg' }]))
      .toEqual(['IMG_1.JPG', 'img_1 (2).jpg']);
  });

  it('не зіштовхується з іменем, що вже виглядає як суфікс', () => {
    expect(uniqueZipNames([{ file_name: 'a (2).jpg' }, { file_name: 'a.jpg' }, { file_name: 'a.jpg' }]))
      .toEqual(['a (2).jpg', 'a.jpg', 'a (3).jpg']);
  });

  it('ім\'я без розширення і порожнє ім\'я', () => {
    expect(uniqueZipNames([{ file_name: 'scan' }, { file_name: 'scan' }])).toEqual(['scan', 'scan (2)']);
    expect(uniqueZipNames([
      { file_name: '', media_type: 'photo' }, { file_name: null, media_type: 'video' },
    ])).toEqual(['photo_1.jpg', 'video_2.mp4']);
  });

  it('скісні риски й небезпечні символи не створюють папок чи шляхів назовні', () => {
    const [a, b, c] = uniqueZipNames([
      { file_name: '../../etc/passwd' }, { file_name: 'a/b\\c:d*?.jpg' }, { file_name: 'кінець. ' },
    ]);
    expect(a).not.toMatch(/[/\\]/);
    expect(a.startsWith('.')).toBe(false);
    expect(b).toBe('a_b_c_d_.jpg');
    expect(c).toBe('кінець');
  });

  it('кирилиця лишається як є', () => {
    expect(uniqueZipNames([{ file_name: 'Весілля_001.jpg' }])).toEqual(['Весілля_001.jpg']);
  });

  it('дублікати тестової галереї «Молдова фото» дають 26 різних імен замість 21', () => {
    const src = [
      ...Array.from({ length: 21 }, (_, i) => ({ file_name: `f${i}.jpg` })),
      ...Array.from({ length: 5 }, (_, i) => ({ file_name: `f${i}.jpg` })),
    ];
    expect(new Set(uniqueZipNames(src).map(n => n.toLowerCase())).size).toBe(26);
  });
});

describe('archiveName', () => {
  it('назва галереї без розділових знаків і з підписом частини', () => {
    expect(archiveName('Вінчання... Надія та Філіпп...')).toBe('Вінчання Надія та Філіпп.zip');
    expect(archiveName('Вінчання', 'Частина 2 з 8')).toBe('Вінчання - Частина 2 з 8.zip');
    expect(archiveName('???')).toBe('gallery.zip');
  });
});

describe('formatBytes', () => {
  it('мегабайти до гігабайта, далі гігабайти з однією цифрою', () => {
    expect(formatBytes(290 * MB, ['МБ', 'ГБ'], 'uk-UA')).toBe('290 МБ');
    expect(formatBytes(3.66 * 1024 * MB, ['МБ', 'ГБ'], 'uk-UA')).toBe('3,7 ГБ');
    expect(formatBytes(10, ['MB', 'GB'], 'en-GB')).toBe('1 MB');
  });
});

describe('zip-attempt: у журнал потрапляє лише дозволене', () => {
  it('start приймає пристрій, спосіб і числа, решту відкидає', () => {
    const row = parseZipAttemptStart({
      device: 'ios', method: 'parts', part_index: 2, parts_total: 13, files_total: 22, bytes_total: 300 * MB,
      ip: '1.2.3.4', user_agent: UA.iphone, email: 'x@y.z',
    });
    expect(row).toEqual({ device: 'ios', method: 'parts', part_index: 2, parts_total: 13, files_total: 22, bytes_total: 300 * MB });
  });

  it('start відхиляє невідомі значення і частину поза набором', () => {
    expect(parseZipAttemptStart({ device: 'tv', method: 'parts', files_total: 1, bytes_total: 1 })).toBeNull();
    expect(parseZipAttemptStart({ device: 'ios', method: 'zip', files_total: 1, bytes_total: 1 })).toBeNull();
    expect(parseZipAttemptStart({ device: 'ios', method: 'parts', part_index: 3, parts_total: 2, files_total: 1, bytes_total: 1 })).toBeNull();
    expect(parseZipAttemptStart({ device: 'ios', method: 'single', files_total: -1, bytes_total: 1 })).toBeNull();
    expect(parseZipAttemptStart({ device: 'ios', method: 'single', files_total: 1.5, bytes_total: 1 })).toBeNull();
  });

  it('для stream і single номер частини не зберігається', () => {
    expect(parseZipAttemptStart({ device: 'desktop', method: 'stream', part_index: 1, parts_total: 1, files_total: 280, bytes_total: 1 }))
      .toMatchObject({ part_index: null, parts_total: null });
  });

  it('finish обрізає причину і перевіряє id', () => {
    const id = '3619b2a9-6a4a-4778-9921-ec48344ba9af';
    const fin = parseZipAttemptFinish({ id, outcome: 'failed', files_via_proxy: 3, error: 'x'.repeat(500) });
    expect(fin?.error).toHaveLength(200);
    expect(fin?.all_parts_done).toBe(false);
    expect(parseZipAttemptFinish({ id: 'not-a-uuid', outcome: 'completed' })).toBeNull();
    expect(parseZipAttemptFinish({ id, outcome: 'done' })).toBeNull();
    expect(parseZipAttemptFinish({ id, outcome: 'completed', all_parts_done: 'yes' })?.all_parts_done).toBe(false);
  });
});
