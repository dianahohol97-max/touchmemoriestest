#!/usr/bin/env node
/**
 * Одноразова перевірка: чи лишилися в R2 файли галерей, які база вже вважає
 * очищеними (photographer_galleries.files_purged_at is not null).
 *
 * Навіщо. До 24.09.2026 крон cleanup-galleries читав щонайбільше тисячу фото
 * галереї, стирав зі сховища лише їх, а потім видаляв з бази всі рядки. Крім
 * того, removeFiles() мовчки пропускав R2-ключі, коли R2 не був налаштований,
 * і не читав поле Errors у відповіді DeleteObjects. Усе, що так пропустили,
 * лежить у R2 без рядка в базі, і знайти це можна лише за префіксом шляху
 * {photographer_id}/{gallery_id}/.
 *
 * ТІЛЬКИ ЧИТАННЯ: ListObjectsV2 і SELECT. Нічого не видаляє.
 *
 * Запуск (Node 20+), з кореня репозиторію, де лежить .env.local із ключами:
 *   node --env-file=.env.local scripts/r2-orphans-purged-galleries.mjs
 *
 * Потрібні змінні: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 * (і R2_JURISDICTION, якщо бакет створено з юрисдикцією, наприклад eu).
 */
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const need = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
const missing = need.filter(k => !(process.env[k] || '').trim());
if (missing.length) {
  console.error(`Не задано: ${missing.join(', ')}`);
  process.exit(2);
}

// Та сама нормалізація, що й у lib/photographers/storage.ts.
const accountId = process.env.R2_ACCOUNT_ID.trim()
  .replace(/^https?:\/\//i, '')
  .split('/')[0]
  .replace(/\.(eu|fedramp)?\.?r2\.cloudflarestorage\.com$/i, '')
  .toLowerCase();
const jurisdiction = (process.env.R2_JURISDICTION || '').trim().toLowerCase();
const endpoint = `https://${jurisdiction ? `${accountId}.${jurisdiction}` : accountId}.r2.cloudflarestorage.com`;
const bucket = process.env.R2_BUCKET.trim();

const s3 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
  },
});
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function purgedGalleries() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('photographer_galleries')
      .select('id, photographer_id, title, files_purged_at')
      .not('files_purged_at', 'is', null)
      .order('files_purged_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

async function listPrefix(prefix) {
  let count = 0;
  let bytes = 0;
  const sample = [];
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    for (const o of res.Contents || []) {
      count++;
      bytes += o.Size || 0;
      if (sample.length < 3) sample.push(o.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return { count, bytes, sample };
}

const mb = b => (b / 1024 / 1024).toFixed(1);

const galleries = await purgedGalleries();
console.log(`Бакет: ${bucket} (${endpoint})`);
console.log(`Очищених галерей у базі: ${galleries.length}\n`);

let totalCount = 0;
let totalBytes = 0;
for (const g of galleries) {
  const prefix = `${g.photographer_id}/${g.id}/`;
  const r = await listPrefix(prefix);
  totalCount += r.count;
  totalBytes += r.bytes;
  const mark = r.count ? 'СИРОТИ' : 'чисто ';
  console.log(`${mark}  ${prefix}  файлів: ${r.count}, ${mb(r.bytes)} МБ  (очищено ${g.files_purged_at}, «${g.title}»)`);
  for (const k of r.sample) console.log(`          напр. ${k}`);
}

console.log(`\nРазом сиріт: ${totalCount} файлів, ${mb(totalBytes)} МБ`);
