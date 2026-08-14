import type { getAdminClient } from '@/lib/supabase/admin';

type Admin = ReturnType<typeof getAdminClient>;

/**
 * Recover the storage path of a saved design's photos.
 *
 * Why this exists (TM-001185, Diana 2026-08-14: «Немає ні фото ні макета» — 22
 * blank white pages in the print folder):
 *
 * `projects.uploaded_photos` stores each photo as metadata plus a `path` into
 * the photobook-uploads bucket. Everything downstream — /api/print/[projectId],
 * the Railway render, the admin layout view — resolves the photo through that
 * path. When the path is missing there is no image to draw, and the render
 * happily produces a correctly sized, perfectly empty page: the pipeline cannot
 * tell "the customer left this slot empty" from "we lost the pointer".
 *
 * The pointer is lost in the editor, not at upload time. The originals ARE in
 * storage under `drafts/{user}/{draft}/{photoId}.jpg` — in TM-001185 all 74 of
 * them, uploaded minutes before checkout. But `storagePath` lives only on the
 * in-memory photo object; when the editor is reopened and the photos are
 * rehydrated without it (their preview is long gone, so nothing can be
 * re-uploaded), every later save writes them back path-less, and the last such
 * save is the one checkout links to the order.
 *
 * Rather than trusting the browser to keep a pointer, this rebuilds it from the
 * files themselves: the photo id IS the file name, so the storage listing of
 * the owner's folders is a complete id → path index.
 */

const BUCKET = 'photobook-uploads';
const MAX_FOLDERS = 40;    // draft folders per owner to walk (a heavy user has a handful)
const MAX_ENTRIES = 1000;  // storage list page size

export type PhotoMeta = { id?: string; path?: string; bucket?: string; [key: string]: any };

export type ProjectLike = {
    id?: string;
    user_id?: string | null;
    cart_payload?: any;
    uploaded_photos?: any;
    pages_data?: any;
    cover_data?: any;
    overlays_data?: any;
};

/** `<photoId>.jpg` → photoId. The editor names every upload after the photo id. */
function idFromPath(path: string): string {
    const base = path.split('/').pop() || '';
    return base.replace(/\.[a-z0-9]+$/i, '');
}

async function listFolder(admin: Admin, prefix: string): Promise<any[]> {
    try {
        const { data } = await admin.storage.from(BUCKET).list(prefix, { limit: MAX_ENTRIES });
        return (data || []) as any[];
    } catch {
        return [];
    }
}

/**
 * id → storage path for every original this owner has in the bucket.
 *
 * Two roots, matching the two places the editor uploads to: the signed-in
 * draft folder (`drafts/{user}/{draft}/…`) and the guest order folder
 * (`guest/{cartItemId}/originals/…`).
 */
export async function buildPhotoPathIndex(
    admin: Admin,
    owner: { userId?: string | null; cartId?: string | null },
): Promise<Map<string, string>> {
    const index = new Map<string, string>();
    const roots: string[] = [];
    if (owner.userId) roots.push(`drafts/${owner.userId}`);
    if (owner.cartId) roots.push(`guest/${owner.cartId}/originals`);

    for (const root of roots) {
        const entries = await listFolder(admin, root);
        // Supabase marks folders with a null id; files carry one.
        for (const e of entries) {
            if (e?.id && e?.name) {
                const path = `${root}/${e.name}`;
                const id = idFromPath(path);
                if (id && !index.has(id)) index.set(id, path);
            }
        }
        const folders = entries.filter(e => e && !e.id && e.name).slice(0, MAX_FOLDERS);
        for (const folder of folders) {
            const inner = await listFolder(admin, `${root}/${folder.name}`);
            for (const e of inner) {
                if (!e?.id || !e?.name) continue;
                const path = `${root}/${folder.name}/${e.name}`;
                const id = idFromPath(path);
                if (id && !index.has(id)) index.set(id, path);
            }
        }
    }
    return index;
}

/**
 * Fill in `path` for every photo that lacks one. Returns the photo array to
 * store (unchanged when nothing was missing) plus how many are still unresolved
 * — a caller that is about to print cares about the second number.
 */
export async function resolveMissingPhotoPaths(
    admin: Admin,
    project: ProjectLike,
): Promise<{ photos: PhotoMeta[]; recovered: number; unresolved: number; changed: boolean }> {
    const photos: PhotoMeta[] = Array.isArray(project.uploaded_photos) ? project.uploaded_photos : [];
    const lacking = photos.filter(p => p && !p.path);
    if (!lacking.length) return { photos, recovered: 0, unresolved: 0, changed: false };

    const cartId = project?.cart_payload?.id ? String(project.cart_payload.id) : null;
    const index = await buildPhotoPathIndex(admin, { userId: project.user_id ?? null, cartId });
    if (!index.size) {
        return { photos, recovered: 0, unresolved: lacking.length, changed: false };
    }

    let recovered = 0;
    const next = photos.map(p => {
        if (!p || p.path || !p.id) return p;
        const found = index.get(String(p.id));
        if (!found) return p;
        recovered++;
        return { ...p, path: found, bucket: p.bucket || BUCKET };
    });

    const unresolved = next.filter(p => p && !p.path).length;
    return { photos: next, recovered, unresolved, changed: recovered > 0 };
}

/**
 * Every photo id the design actually places — template slots, free slots and
 * the cover. A book can carry photos the customer uploaded and never used, and
 * those must not count as a missing print file.
 */
export function referencedPhotoIds(project: ProjectLike): Set<string> {
    const ids = new Set<string>();
    const add = (value: any) => { if (value) ids.add(String(value)); };

    const pages = Array.isArray(project.pages_data) ? project.pages_data : [];
    for (const page of pages) {
        for (const slot of (Array.isArray(page?.slots) ? page.slots : [])) add(slot?.photoId);
    }

    const free = (project as any)?.overlays_data?.freeSlots;
    if (free && typeof free === 'object') {
        for (const list of Object.values(free)) {
            for (const slot of (Array.isArray(list) ? list : [])) add((slot as any)?.photoId);
        }
    }

    add((project as any)?.cover_data?.photoId);
    return ids;
}

/**
 * How many PLACED photos have no file behind them. Zero means the render will
 * draw what the customer built; anything else means blank areas on paper.
 */
export function countUnprintablePhotos(project: ProjectLike, photos: PhotoMeta[]): number {
    const referenced = referencedPhotoIds(project);
    if (!referenced.size) return 0;
    const byId = new Map<string, PhotoMeta>();
    for (const p of photos || []) if (p?.id) byId.set(String(p.id), p);

    let missing = 0;
    for (const id of referenced) {
        const photo = byId.get(id);
        if (!photo || !photo.path) missing++;
    }
    return missing;
}
