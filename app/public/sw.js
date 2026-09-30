/* App-shell service worker. Network-first so deploys show up; cache as fallback. */
const CACHE = 'lucid-v2'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'])).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

function serveAppShell() {
  return caches.match('/index.html').then((hit) => hit || fetch('/index.html'))
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Deep links like /dream/:id have no static file. If the network returns 404
  // (missing SPA rewrite) or is offline, fall back to the app shell so React Router can run.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => (res.ok ? res : serveAppShell()))
        .catch(() => serveAppShell()),
    )
    return
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        }
        return res
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html'))),
  )
})
