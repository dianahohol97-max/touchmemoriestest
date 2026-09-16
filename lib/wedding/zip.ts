// Потоковий ZIP без стиснення.
//
// НАВІЩО СВІЙ, КОЛИ В ПРОЄКТІ Є jszip. jszip збирає весь архів у памʼяті, перш
// ніж віддати бодай байт. Пів тисячі весільних знімків — це близько 500 МБ, і
// стільки памʼяті у функції на Vercel просто немає: вона впала б, причому на
// найбільшому весіллі, тобто саме там, де архів найпотрібніший. Тут натомість у
// памʼяті лежить рівно одне фото за раз, а решта одразу тече до браузера.
//
// БЕЗ СТИСНЕННЯ (метод STORE) — теж свідомо. JPEG уже стиснений, deflate
// відбирає в нього відсоток-другий обсягу і купу процесорного часу. Архів тут
// потрібен як спосіб віддати багато файлів одним завантаженням, а не як спосіб
// зменшити їхню вагу.
//
// Zip64 не реалізовано, і його межі нас не торкаються: пакет обмежений згори
// кількістю файлів у порції, а 4 ГБ на один архів ми не наберемо.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  /** Назва файлу всередині архіву. Кирилиця дозволена. */
  name: string;
  data: Uint8Array;
  /** Дата файлу в архіві. */
  modified: Date;
}

interface CentralRecord {
  nameBytes: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  dosTime: number;
  dosDate: number;
}

/** ZIP зберігає час у форматі MS-DOS: секунди з кроком у дві, роки від 1980. */
function dosStamp(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    dosDate: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * Перетворює послідовність файлів на потік байтів архіву.
 *
 * Джерело — асинхронний перебір, тобто файли можна тягнути з бакета по одному
 * саме тоді, коли до них дійшла черга, і не тримати в памʼяті нічого зайвого.
 */
export function zipStream(entries: AsyncIterable<ZipEntry>): ReadableStream<Uint8Array> {
  const central: CentralRecord[] = [];
  let offset = 0;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const iterator = entries[Symbol.asyncIterator]();
        for (;;) {
          const next = await iterator.next();
          if (next.done) break;
          const { name, data, modified } = next.value;

          const nameBytes = new TextEncoder().encode(name);
          const crc = crc32(data);
          const { dosTime, dosDate } = dosStamp(modified);

          const header = new DataView(new ArrayBuffer(30));
          header.setUint32(0, 0x04034b50, true); // підпис локального заголовка
          header.setUint16(4, 20, true); // потрібна версія
          // Прапорець 0x0800 каже, що назва у UTF-8. Без нього імена гостей
          // кирилицею перетворюються на кракозябри в провіднику Windows.
          header.setUint16(6, 0x0800, true);
          header.setUint16(8, 0, true); // метод STORE
          header.setUint16(10, dosTime, true);
          header.setUint16(12, dosDate, true);
          header.setUint32(14, crc, true);
          header.setUint32(18, data.length, true); // стиснений розмір
          header.setUint32(22, data.length, true); // початковий розмір
          header.setUint16(26, nameBytes.length, true);
          header.setUint16(28, 0, true); // додаткове поле

          controller.enqueue(new Uint8Array(header.buffer));
          controller.enqueue(nameBytes);
          controller.enqueue(data);

          central.push({ nameBytes, crc, size: data.length, offset, dosTime, dosDate });
          offset += 30 + nameBytes.length + data.length;
        }

        // Центральний каталог — зміст архіву, який читач розпаковує першим.
        const centralStart = offset;
        for (const rec of central) {
          const cd = new DataView(new ArrayBuffer(46));
          cd.setUint32(0, 0x02014b50, true);
          cd.setUint16(4, 20, true); // версія, якою створено
          cd.setUint16(6, 20, true); // потрібна версія
          cd.setUint16(8, 0x0800, true);
          cd.setUint16(10, 0, true); // метод STORE
          cd.setUint16(12, rec.dosTime, true);
          cd.setUint16(14, rec.dosDate, true);
          cd.setUint32(16, rec.crc, true);
          cd.setUint32(20, rec.size, true);
          cd.setUint32(24, rec.size, true);
          cd.setUint16(28, rec.nameBytes.length, true);
          cd.setUint16(30, 0, true); // додаткове поле
          cd.setUint16(32, 0, true); // коментар
          cd.setUint16(34, 0, true); // номер диска
          cd.setUint16(36, 0, true); // внутрішні атрибути
          cd.setUint32(38, 0, true); // зовнішні атрибути
          cd.setUint32(42, rec.offset, true);

          controller.enqueue(new Uint8Array(cd.buffer));
          controller.enqueue(rec.nameBytes);
          offset += 46 + rec.nameBytes.length;
        }

        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true);
        end.setUint16(4, 0, true); // номер диска
        end.setUint16(6, 0, true); // диск із каталогом
        end.setUint16(8, central.length, true);
        end.setUint16(10, central.length, true);
        end.setUint32(12, offset - centralStart, true);
        end.setUint32(16, centralStart, true);
        end.setUint16(20, 0, true); // коментар архіву
        controller.enqueue(new Uint8Array(end.buffer));

        controller.close();
      } catch (e) {
        // Обрив посеред архіву неминуче дає пошкоджений файл — цілого вже не
        // склеїти. Але помилку треба підняти, щоб браузер показав перерване
        // завантаження, а не тихо зберіг недоладний архів.
        controller.error(e);
      }
    },
  });
}
