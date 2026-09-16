import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { zipStream, type ZipEntry } from '@/lib/wedding/zip';

async function collect(entries: ZipEntry[]): Promise<Uint8Array> {
    async function* source() {
        for (const e of entries) yield e;
    }
    const chunks: Uint8Array[] = [];
    const reader = zipStream(source()).getReader();
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) { out.set(c, at); at += c.length; }
    return out;
}

const bytes = (s: string) => new TextEncoder().encode(s);
const MODIFIED = new Date('2026-10-10T18:30:00Z');

describe('zipStream', () => {
    it('архів починається локальним заголовком і закінчується записом кінця каталогу', async () => {
        const zip = await collect([
            { name: 'a.txt', data: bytes('hello'), modified: MODIFIED },
        ]);
        const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
        expect(view.getUint32(0, true)).toBe(0x04034b50);
        expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    });

    it('кількість записів у каталозі збігається з кількістю файлів', async () => {
        const zip = await collect([
            { name: 'a.txt', data: bytes('one'), modified: MODIFIED },
            { name: 'b.txt', data: bytes('two'), modified: MODIFIED },
            { name: 'c.txt', data: bytes('three'), modified: MODIFIED },
        ]);
        const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
        expect(view.getUint16(zip.length - 22 + 8, true)).toBe(3);
        expect(view.getUint16(zip.length - 22 + 10, true)).toBe(3);
    });

    it('CRC32 рахується за стандартом', async () => {
        // Контрольна сума рядка «hello» відома і дорівнює 0x3610A686. Якщо
        // таблиця чи порядок байтів колись поїдуть, архів лишиться зовні
        // цілим, а розпакувальник скаже «файл пошкоджено» — цей рядок ловить
        // саме такий випадок.
        const zip = await collect([{ name: 'a.txt', data: bytes('hello'), modified: MODIFIED }]);
        const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
        expect(view.getUint32(14, true)).toBe(0x3610a686);
    });

    it('назва кирилицею позначена прапорцем UTF-8', async () => {
        // Без прапорця 0x0800 «Марічка» стає кракозябрами у провіднику Windows.
        const zip = await collect([
            { name: 'Марічка.jpg', data: bytes('x'), modified: MODIFIED },
        ]);
        const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
        expect(view.getUint16(6, true) & 0x0800).toBe(0x0800);
    });

    it('порожній архів лишається валідним', async () => {
        const zip = await collect([]);
        expect(zip.length).toBe(22);
        const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
        expect(view.getUint32(0, true)).toBe(0x06054b50);
        expect(view.getUint16(8, true)).toBe(0);
    });

    it('готовий архів лягає на диск для зовнішньої перевірки', async () => {
        // Цей файл читає окремий скрипт справжнім розпакувальником: перевірити
        // ZIP по-справжньому можна лише тим, що його відкриває чужий код.
        const zip = await collect([
            { name: '2026-10-10_0001_Марічка.jpg', data: bytes('photo-one'), modified: MODIFIED },
            { name: '2026-10-10_0002.jpg', data: bytes('photo-two'), modified: MODIFIED },
        ]);
        mkdirSync('/tmp/wedding-zip-check', { recursive: true });
        writeFileSync('/tmp/wedding-zip-check/sample.zip', zip);
        expect(zip.length).toBeGreaterThan(22);
    });
});
