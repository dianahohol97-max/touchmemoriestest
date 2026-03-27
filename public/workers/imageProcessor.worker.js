/**
 * Image Processor Web Worker
 * Handles: pHash duplicate detection, quality filtering, EXIF sorting, auto-layout
 * All processing is client-side using Canvas API (OffscreenCanvas)
 */

// ---- Blockhash pHash (pure canvas, no dependencies) ----
function blockhash(imageData, bits) {
  const even = bits % 2 === 0;
  const evenX = even;
  const evenY = even;
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const blocks = bits * bits;
  const blockWidth = width / bits;
  const blockHeight = height / bits;
  const result = new Array(blocks).fill(0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // luminance
      const value = (r * 299 + g * 587 + b * 114) / 1000;

      const blockX = Math.floor(x / blockWidth);
      const blockY = Math.floor(y / blockHeight);
      const blockIndex = Math.min(blockY, bits - 1) * bits + Math.min(blockX, bits - 1);
      result[blockIndex] += value;
    }
  }

  const pixels = blockWidth * blockHeight;
  for (let i = 0; i < blocks; i++) {
    result[i] /= pixels;
  }

  // median
  const sorted = result.slice().sort((a, b) => a - b);
  const medianIndex = Math.floor(blocks / 2);
  const median =
    blocks % 2 === 0
      ? (sorted[medianIndex - 1] + sorted[medianIndex]) / 2
      : sorted[medianIndex];

  const hash = result.map((v) => (v >= median ? 1 : 0));
  return hash;
}

function hammingDistance(h1, h2) {
  let dist = 0;
  for (let i = 0; i < h1.length; i++) {
    if (h1[i] !== h2[i]) dist++;
  }
  return dist;
}

function hashSimilarity(h1, h2) {
  const maxDist = h1.length;
  return 1 - hammingDistance(h1, h2) / maxDist;
}

// ---- Blur detection (Laplacian variance) ----
function detectBlur(imageData) {
  const { data, width, height } = imageData;
  const kernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let val = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx2 = ((y + ky) * width + (x + kx)) * 4;
          const lum = data[idx2] * 0.299 + data[idx2 + 1] * 0.587 + data[idx2 + 2] * 0.114;
          val += lum * kernel[(ky + 1) * 3 + (kx + 1)];
        }
      }
      sum += val;
      sumSq += val * val;
      count++;
    }
  }

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return variance; // higher = sharper
}

// ---- Parse date from filename ----
function parseDateFromFilename(name) {
  // IMG_20240115, 20240115, 2024-01-15, 2024_01_15
  const patterns = [
    /(\d{4})[-_]?(\d{2})[-_]?(\d{2})/,
  ];
  for (const p of patterns) {
    const m = name.match(p);
    if (m) {
      const d = new Date(`${m[1]}-${m[2]}-${m[3]}`);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

// ---- EXIF extraction without exifr (manual parsing of JPEG EXIF) ----
async function extractExifDate(arrayBuffer) {
  try {
    const view = new DataView(arrayBuffer);
    // look for EXIF DateTimeOriginal
    const bytes = new Uint8Array(arrayBuffer);
    const exifMarker = [0x45, 0x78, 0x69, 0x66]; // "Exif"
    for (let i = 0; i < bytes.length - 20; i++) {
      if (
        bytes[i] === exifMarker[0] &&
        bytes[i + 1] === exifMarker[1] &&
        bytes[i + 2] === exifMarker[2] &&
        bytes[i + 3] === exifMarker[3]
      ) {
        // Search for DateTimeOriginal tag (0x9003)
        for (let j = i; j < Math.min(i + 50000, bytes.length - 10); j++) {
          if (bytes[j] === 0x90 && bytes[j + 1] === 0x03) {
            // found tag, value should be around j+8
            const valueOffset = view.getUint32(j + 8, bytes[i + 6] === 0x49); // little endian check
            const dateStr = String.fromCharCode(...bytes.slice(j + 20, j + 40)).replace(/\0/g, '').trim();
            if (/^\d{4}:\d{2}:\d{2}/.test(dateStr)) {
              const normalized = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
              return new Date(normalized);
            }
          }
        }
        break;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

// ---- Auto-Layout Algorithm ----
function computeAutoLayout(photos, productType) {
  // productType: 'photobook' | 'magazine' | 'travelbook'
  const maxPerSpread = productType === 'magazine' ? 4 : 3;
  const pages = [];
  let i = 0;

  while (i < photos.length) {
    const remaining = photos.length - i;
    // Avoid orphan on last page
    let count;
    if (remaining <= maxPerSpread) {
      count = remaining;
    } else if (remaining === maxPerSpread + 1) {
      // split evenly to avoid orphan
      count = Math.ceil((maxPerSpread + 1) / 2);
    } else {
      count = Math.floor(Math.random() * maxPerSpread) + 1;
      count = Math.max(1, Math.min(count, remaining));
    }

    const spread = photos.slice(i, i + count);
    let layout;
    if (count === 1) layout = 'full';
    else if (count === 2) layout = 'half';
    else layout = 'thirds';

    pages.push({ photos: spread, layout });
    i += count;
  }

  return pages;
}

// ---- Main message handler ----
self.onmessage = async function (e) {
  const { type, files, productType, thresholds } = e.data;

  if (type !== 'PROCESS_IMAGES') return;

  const BITS = 8;
  const DUPE_THRESHOLD = thresholds?.dupeSimilarity ?? 0.90;
  const BLUR_THRESHOLD = thresholds?.blurMin ?? 100; // min variance to keep
  const MIN_WIDTH = thresholds?.minWidth ?? 800;
  const MIN_HEIGHT = thresholds?.minHeight ?? 600;

  const total = files.length;
  const results = [];

  // STAGE 1: Read & hash all images
  self.postMessage({ type: 'STAGE', stage: 1, label: 'Визначення дублікатів', progress: 0 });

  const hashes = [];
  const imageDatas = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    self.postMessage({ type: 'FILE_PROGRESS', index: i, total });

    try {
      const bitmap = await createImageBitmap(file, { resizeWidth: 200, resizeHeight: 200 });
      const canvas = new OffscreenCanvas(200, 200);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, 200, 200);
      const imgData = ctx.getImageData(0, 0, 200, 200);
      bitmap.close();

      const hash = blockhash(imgData, BITS);
      hashes.push(hash);
      imageDatas.push(imgData);
    } catch (err) {
      hashes.push(null);
      imageDatas.push(null);
    }

    self.postMessage({ type: 'STAGE', stage: 1, label: 'Визначення дублікатів', progress: Math.round(((i + 1) / total) * 100) });
  }

  // Find duplicates
  const isDuplicate = new Array(total).fill(false);
  for (let i = 0; i < total; i++) {
    if (!hashes[i] || isDuplicate[i]) continue;
    for (let j = i + 1; j < total; j++) {
      if (!hashes[j] || isDuplicate[j]) continue;
      const sim = hashSimilarity(hashes[i], hashes[j]);
      if (sim >= DUPE_THRESHOLD) {
        isDuplicate[j] = true;
      }
    }
  }

  // STAGE 2: Quality filter
  self.postMessage({ type: 'STAGE', stage: 2, label: 'Перевірка якості', progress: 0 });

  const isLowQuality = new Array(total).fill(false);
  const qualityReasons = new Array(total).fill(null);

  for (let i = 0; i < total; i++) {
    if (isDuplicate[i]) continue;
    const file = files[i];
    try {
      const bitmap = await createImageBitmap(file);
      const w = bitmap.width;
      const h = bitmap.height;
      bitmap.close();

      if (w < MIN_WIDTH || h < MIN_HEIGHT) {
        isLowQuality[i] = true;
        qualityReasons[i] = 'low_resolution';
        continue;
      }

      // Blur detection on small version
      if (imageDatas[i]) {
        const blurScore = detectBlur(imageDatas[i]);
        if (blurScore < BLUR_THRESHOLD) {
          isLowQuality[i] = true;
          qualityReasons[i] = 'blurry';
        }
      }
    } catch (e) {
      isLowQuality[i] = true;
      qualityReasons[i] = 'error';
    }

    self.postMessage({ type: 'STAGE', stage: 2, label: 'Перевірка якості', progress: Math.round(((i + 1) / total) * 100) });
  }

  // STAGE 3: Chronological sort
  self.postMessage({ type: 'STAGE', stage: 3, label: 'Хронологічне сортування', progress: 0 });

  const keptIndices = [];
  const removedItems = [];

  for (let i = 0; i < total; i++) {
    if (isDuplicate[i]) {
      removedItems.push({ index: i, reason: 'duplicate', file: files[i] });
    } else if (isLowQuality[i]) {
      removedItems.push({ index: i, reason: qualityReasons[i] || 'low_quality', file: files[i] });
    } else {
      keptIndices.push(i);
    }
  }

  // Extract dates for kept photos
  const datesMap = new Map();
  for (let ki = 0; ki < keptIndices.length; ki++) {
    const i = keptIndices[ki];
    const file = files[i];

    // Try EXIF
    let date = null;
    try {
      const buf = await file.arrayBuffer();
      date = await extractExifDate(buf);
    } catch (e) {}

    // Fallback: filename
    if (!date) {
      date = parseDateFromFilename(file.name);
    }

    // Fallback: file modification date
    if (!date && file.lastModified) {
      date = new Date(file.lastModified);
    }

    datesMap.set(i, date);
    self.postMessage({ type: 'STAGE', stage: 3, label: 'Хронологічне сортування', progress: Math.round(((ki + 1) / keptIndices.length) * 100) });
  }

  // Sort kept indices by date (ascending = oldest first)
  keptIndices.sort((a, b) => {
    const da = datesMap.get(a);
    const db = datesMap.get(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.getTime() - db.getTime();
  });

  // STAGE 4: Auto-layout
  self.postMessage({ type: 'STAGE', stage: 4, label: 'Авторозкладка сторінок', progress: 0 });

  const keptFiles = keptIndices.map((i) => files[i]);
  const layout = computeAutoLayout(
    keptFiles.map((f, idx) => ({ file: f, index: idx })),
    productType || 'photobook'
  );

  self.postMessage({ type: 'STAGE', stage: 4, label: 'Авторозкладка сторінок', progress: 100 });

  // Return results
  self.postMessage({
    type: 'DONE',
    keptFiles,
    keptIndices,
    removedItems: removedItems.map(({ index, reason, file }) => ({
      originalIndex: index,
      reason,
      fileName: file.name,
      // We can't transfer File objects — send the index so the caller can look up the File
    })),
    layout,
    stats: {
      total,
      kept: keptFiles.length,
      duplicates: removedItems.filter((r) => r.reason === 'duplicate').length,
      lowQuality: removedItems.filter((r) => r.reason !== 'duplicate').length,
      recommendedPages: layout.length,
    },
  });
};
