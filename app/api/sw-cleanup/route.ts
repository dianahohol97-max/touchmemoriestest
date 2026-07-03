import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

// Kill-switch served in place of any stale /sw.<hash>.js from old deployments.
// It takes over immediately, wipes the SW caches, unregisters itself and
// reloads open tabs onto the plain network — after one visit the browser
// stops requesting the dead file.
const KILL_SWITCH = `
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(
    (async function () {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      } catch (err) {}
      try { await self.registration.unregister(); } catch (err) {}
      try {
        const clientsList = await self.clients.matchAll({ type: 'window' });
        clientsList.forEach(function (c) { c.navigate(c.url); });
      } catch (err) {}
    })()
  );
});
`;

export async function GET() {
    return new NextResponse(KILL_SWITCH, {
        status: 200,
        headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'public, max-age=0, must-revalidate',
            'Service-Worker-Allowed': '/',
        },
    });
}
