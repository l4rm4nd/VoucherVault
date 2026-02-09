var staticCacheName = "django-pwa-v" + new Date().getTime();
var filesToCache = [
    '/offline/',
    '/static/assets/css/dark-mode.css',
    '/static/assets/css/style.css',
    '/static/assets/img/apple-icon-180.png',
    '/static/assets/img/apple-touch-icon.png',
    '/static/assets/img/favicon.ico',
    '/static/assets/img/logo.png',
    '/static/assets/img/logo.svg',
    '/static/assets/img/manifest-icon-192.maskable.png',
    '/static/assets/img/manifest-icon-192.png',
    '/static/assets/img/manifest-icon-512.maskable.png',
    '/static/assets/img/manifest-icon-512.png'
];

// Cache on install
self.addEventListener("install", event => {
    this.skipWaiting();
    event.waitUntil(
        caches.open(staticCacheName)
            .then(cache => {
                return cache.addAll(filesToCache);
            })
    )
});

// Clear cache on activate
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cacheName => (cacheName.startsWith("django-pwa-")))
                    .filter(cacheName => (cacheName !== staticCacheName))
                    .map(cacheName => caches.delete(cacheName))
            );
        })
    );
});

// Serve from Cache
self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
            .catch(() => {
                return caches.match('/offline/');
            })
    )
});
