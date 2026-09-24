/**
 * Перевірка тіла запиту до /api/gallery/[token]/zip-attempt. Окремо від
 * маршруту, щоб тести бачили, що саме потрапляє в gallery_zip_attempts:
 * лише перелічені значення й невід'ємні цілі числа. Усе інше — зокрема будь-
 * які поля про людину — відкидається мовчки, бо в рядок ми його не копіюємо.
 */

import type { ZipDevice, ZipMethod } from './zip-plan';

const DEVICES: ZipDevice[] = ['ios', 'android', 'desktop', 'in-app'];
const METHODS: ZipMethod[] = ['stream', 'parts', 'single'];
const OUTCOMES = ['completed', 'failed', 'cancelled'] as const;
export type ZipOutcome = typeof OUTCOMES[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function count(v: unknown, max: number): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max || Math.floor(n) !== n) return null;
  return n;
}

export interface ZipAttemptStartRow {
  device: ZipDevice;
  method: ZipMethod;
  part_index: number | null;
  parts_total: number | null;
  files_total: number;
  bytes_total: number;
}

export function parseZipAttemptStart(body: any): ZipAttemptStartRow | null {
  const device = DEVICES.find(d => d === body?.device);
  const method = METHODS.find(m => m === body?.method);
  const files = count(body?.files_total, 100_000);
  // 2000 файлів по 2 ГБ — верхня межа галереї; більше не буває.
  const bytes = count(body?.bytes_total, 4_000 * 1024 ** 3);
  if (!device || !method || files === null || bytes === null) return null;
  let part_index: number | null = null;
  let parts_total: number | null = null;
  if (method === 'parts') {
    part_index = count(body?.part_index, 10_000);
    parts_total = count(body?.parts_total, 10_000);
    if (!part_index || !parts_total || part_index > parts_total) return null;
  }
  return { device, method, part_index, parts_total, files_total: files, bytes_total: bytes };
}

export interface ZipAttemptFinish {
  id: string;
  outcome: ZipOutcome;
  files_via_proxy: number;
  error: string | null;
  all_parts_done: boolean;
}

export function parseZipAttemptFinish(body: any): ZipAttemptFinish | null {
  const id = typeof body?.id === 'string' && UUID.test(body.id) ? body.id : null;
  const outcome = OUTCOMES.find(o => o === body?.outcome);
  const via = count(body?.files_via_proxy ?? 0, 100_000);
  if (!id || !outcome || via === null) return null;
  const error = typeof body?.error === 'string' && body.error.trim()
    ? body.error.trim().slice(0, 200)
    : null;
  return { id, outcome, files_via_proxy: via, error, all_parts_done: body?.all_parts_done === true };
}
