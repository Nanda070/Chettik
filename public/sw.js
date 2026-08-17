const CACHE = 'chettik-stage-4-v1'
const APP_SHELL = ['/', '/index.html', '/logo.svg', '/manifest.webmanifest']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)))
})

self.addEventListener('push', event => {
  const data = event.data?.json?.() || { title: 'Chettik', body: 'You have a new message.' }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/logo.svg', badge: '/logo.svg', tag: 'chettik-message' }))
})
