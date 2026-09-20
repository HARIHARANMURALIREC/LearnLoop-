// Minimal service worker: makes the app installable and keeps the shell available offline.
// It never touches cross-origin requests (Supabase, fonts), so auth and AI calls are unaffected.
const CACHE = 'learnloop-v1'
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/icon-192.png']))); self.skipWaiting() })
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin) return
  if (req.mode === 'navigate') { // network first so deploys show up immediately; offline falls back to the cached shell
    e.respondWith(fetch(req).then((r) => { caches.open(CACHE).then((c) => c.put('/', r.clone())); return r }).catch(() => caches.match('/')))
  } else if (url.pathname.startsWith('/assets/')) { // hashed build files never change: cache first
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { caches.open(CACHE).then((c) => c.put(req, r.clone())); return r })))
  }
})
