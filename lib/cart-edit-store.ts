// Durable storage for "edit this cart item" design snapshots.
//
// The book editor saves a self-contained snapshot (config + draft + photos) when
// an item is added to the cart, so the customer can reopen THAT item later and
// keep editing. This used to live in sessionStorage, which has two problems:
//  1. it is cleared when the browsing session ends (the cart itself persists in
//     localStorage, so an item added in a previous session lost its snapshot and
//     showed no "Редагувати" button), and
//  2. its ~5 MB quota is easily exhausted by one large photobook (50 photos /
//     34 pages), so a second book added afterwards couldn't save its snapshot.
//
// IndexedDB has a much larger quota and persists like localStorage, so every
// book in the cart stays editable. Every function fails soft: on any error it
// resolves to a safe default and the cart simply falls back to "not editable"
// for that item (the item still orders fine).

const DB_NAME = 'tmCartEditDB';
const STORE = 'snapshots';
const VERSION = 1;

function hasIDB(): boolean {
    return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
        if (!hasIDB()) { resolve(null); return; }
        try {
            const req = indexedDB.open(DB_NAME, VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        } catch { resolve(null); }
    });
}

export async function saveCartEditSnapshot(id: string, snap: unknown): Promise<void> {
    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
        try {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(snap, id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
            tx.onabort = () => resolve();
        } catch { resolve(); }
    });
}

export async function getCartEditSnapshot(id: string): Promise<any | null> {
    const db = await openDb();
    if (!db) return null;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(id);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => resolve(null);
        } catch { resolve(null); }
    });
}

export async function listCartEditSnapshotIds(): Promise<string[]> {
    const db = await openDb();
    if (!db) return [];
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).getAllKeys();
            req.onsuccess = () => resolve((req.result as IDBValidKey[]).map((k) => String(k)));
            req.onerror = () => resolve([]);
        } catch { resolve([]); }
    });
}

export async function deleteCartEditSnapshot(id: string): Promise<void> {
    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
        try {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
            tx.onabort = () => resolve();
        } catch { resolve(); }
    });
}
