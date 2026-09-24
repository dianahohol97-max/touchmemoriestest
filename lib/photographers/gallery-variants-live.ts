import { getAdminClient } from '@/lib/supabase/admin';
import { putFileTo, readFile, removeFiles } from './storage';
import { renderGalleryVariants } from './gallery-variants-render';
import type { GalleryVariantDeps } from './gallery-variants';

/** Справжні залежності черги копій: адмін-клієнт, сховище галерей і sharp. */
export function liveVariantDeps(): GalleryVariantDeps {
  return {
    db: getAdminClient(),
    readOriginal: readFile,
    put: (path, body, provider) => putFileTo(path, body, 'image/jpeg', provider === 'r2' ? 'r2' : 'supabase'),
    removeFiles,
    render: renderGalleryVariants,
  };
}
