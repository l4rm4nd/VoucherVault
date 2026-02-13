const VERSION = "v2.0.0";
const CACHE_NAME = `vouchervault-${VERSION}`;
const RUNTIME_CACHE = `vouchervault-runtime-${VERSION}`;
const DATA_CACHE = `vouchervault-data-${VERSION}`;
const PAGE_CACHE = `vouchervault-pages-${VERSION}`;

// Cache expiration settings
const CACHE_DURATION = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
const CACHE_KEY = 'offline_cache_timestamp';

// Static assets to cache on install (only truly static assets, not dynamic pages)
const SUPPORTED_LANGS = ['en', 'de', 'fr', 'it'];

const STATIC_CACHE_URLS = [
    '/offline/',
    ...SUPPORTED_LANGS.map(lang => `/${lang}/offline/`),
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
    '/static/assets/img/manifest-icon-512.png',
    '/static/assets/js/offline-sync.js',
    '/static/assets/js/page-cache-helper.js',
    '/static/assets/js/manual-cache.js',
    '/static/assets/js/main.js',
    '/static/assets/vendor/bootstrap/css/bootstrap.min.css',
    '/static/assets/vendor/bootstrap-icons/bootstrap-icons.css',
    '/static/assets/vendor/bootstrap/js/bootstrap.bundle.min.js',
    '/static/assets/vendor/boxicons/css/boxicons.min.css',
    '/static/assets/vendor/simple-datatables/simple-datatables.js',
    '/static/assets/vendor/simple-datatables/style.css'
];

// Dynamic pages will be cached when visited via navigation handler

// API endpoints and pages to cache
const API_CACHE_PATTERNS = [
    /\/api\/get\/stats/,
    /\/api\//,
    /\/(en|de|fr|it)\/dashboard$/,
    /\/dashboard$/,
    /\/(en|de|fr|it)\/shared-items/,
    /\/shared-items/,
    /\/(en|de|fr|it)\/items\/view\/.+/, 
    /\/items\/view\/.+/,
    /\/(en|de|fr|it)\/items\/edit\/.+/, 
    /\/items\/edit\/.+/,
    /\/(en|de|fr|it)\/items\/view-image\/.+/, 
    /\/items\/view-image\/.+/,
    /^\/(en|de|fr|it)\/?$/,
    /^\/$/
];

// Pages that should always be cached when visited
const CACHE_PAGE_PATTERNS = [
    /\/(en|de|fr|it)\/items\//,
    /\/items\//,
    /\/(en|de|fr|it)\/dashboard/,
    /\/dashboard/,
    /\/(en|de|fr|it)\/shared-items/,
    /\/shared-items/,
    /^\/(en|de|fr|it)\/?$/,
    /^\/$/
];

/**
 * Check if manual cache is expired by asking the client for the localStorage timestamp
 */
/**
 * Check if manual cache is expired by reading the timestamp from cached responses
 */
async function isCacheExpired() {
    try {
        const cache = await caches.open(PAGE_CACHE);
        const keys = await cache.keys();
        
        if (keys.length === 0) {
            console.log('[ServiceWorker] No cached pages found');
            return true; // No cache means it's "expired"
        }
        
        // Check the first cached response for the timestamp
        const firstResponse = await cache.match(keys[0]);
        if (!firstResponse) {
            console.log('[ServiceWorker] Could not read cached response');
            return true;
        }
        
        const cachedTime = firstResponse.headers.get('sw-cached-time');
        if (!cachedTime) {
            console.log('[ServiceWorker] No timestamp in cached response, assuming expired');
            return true;
        }
        
        const age = Date.now() - parseInt(cachedTime);
        const expired = age >= CACHE_DURATION;
        
        console.log(`[ServiceWorker] Cache age: ${Math.floor(age / 1000 / 60 / 60)}h ${Math.floor((age / 1000 / 60) % 60)}m, expired: ${expired}`);
        return expired;
    } catch (error) {
        console.error('[ServiceWorker] Error checking cache expiration:', error);
        return false; // Conservative: assume not expired on error
    }
}

/**
 * Clear expired page caches
 */
async function clearExpiredCache() {
    try {
        console.log('[ServiceWorker] Clearing expired cache...');
        const deleted = await caches.delete(PAGE_CACHE);
        if (deleted) {
            console.log('[ServiceWorker] ✓ Expired cache cleared');
        }
    } catch (error) {
        console.error('[ServiceWorker] Error clearing expired cache:', error);
    }
}

// Install event - cache static assets
self.addEventListener("install", event => {
    console.log('[ServiceWorker] Installing v' + VERSION);
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[ServiceWorker] Caching static assets and pages');
                return Promise.allSettled(
                    STATIC_CACHE_URLS.map(url => 
                        cache.add(url).catch(err => {
                            console.warn('[ServiceWorker] Failed to cache:', url, err);
                        })
                    )
                );
            })
            .then(() => {
                console.log('[ServiceWorker] Installation complete');
            })
            .catch(err => {
                console.error('[ServiceWorker] Cache installation failed:', err);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[ServiceWorker] Activating v' + VERSION);
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cacheName => {
                        return cacheName.startsWith('vouchervault-') || 
                               cacheName.startsWith('django-pwa-');
                    })
                    .filter(cacheName => {
                        return cacheName !== CACHE_NAME && 
                               cacheName !== RUNTIME_CACHE && 
                               cacheName !== DATA_CACHE &&
                               cacheName !== PAGE_CACHE;
                    })
                    .map(cacheName => {
                        console.log('[ServiceWorker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
            );
        })
    );
    return self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener("fetch", event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Only handle GET requests for caching
    if (request.method !== 'GET') {
        event.respondWith(fetch(request));
        return;
    }

    // CRITICAL: Skip caching for OIDC authentication URLs to preserve session state
    // OIDC flow requires server-side session state which breaks with cached responses
    if (url.pathname.includes('/oidc/') ||
        url.pathname.includes('/accounts/login') ||
        url.pathname.includes('/accounts/logout')) {
        console.log('[ServiceWorker] Bypassing cache for auth URL:', url.pathname);
        event.respondWith(fetch(request));
        return;
    }

    // Manual cache requests should always hit the network (fresh data)
    if (request.headers.get('X-Manual-Cache') === '1') {
        event.respondWith(fetch(request));
        return;
    }

    // Connectivity check: always go to network and never serve from cache
    const isPingPath = /^(\/((en|de|fr|it))\/)?ping\/$/.test(url.pathname);
    if (isPingPath || url.searchParams.has('ping')) {
        event.respondWith(
            fetch(request).catch(() => new Response('', {
                status: 503,
                statusText: 'Service Unavailable'
            }))
        );
        return;
    }

    const skipCachePaths = [
        '/items/create',
        '/items/edit',
        '/items/duplicate',
        '/items/delete',
        '/items/toggle_status',
        '/items/share',
        '/items/unshare',
        '/transactions/delete',
        '/user/edit/notifications',
        '/user/edit/preferences',
        '/verify-apprise-urls',
        '/download',
        '/logout',
        '/post-logout'
    ];

    const shouldSkipCache = skipCachePaths.some(path => url.pathname.includes(path));

    // Handle API requests and page data - Cache First (but check expiration)
    if (API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
        event.respondWith(
            (async () => {
                // Check if cache is expired
                const expired = await isCacheExpired();
                
                if (expired) {
                    console.log('[ServiceWorker] Cache expired, clearing and fetching fresh data:', url.pathname + url.search);
                    await clearExpiredCache();
                    
                    // Go straight to network
                    try {
                        return await fetch(request);
                    } catch (error) {
                        // Network failed, fall back to offline page for navigation
                        if (request.mode === 'navigate') {
                            return caches.match('/offline/') || new Response('Offline', { status: 503 });
                        }
                        return new Response('Offline', { status: 503 });
                    }
                }

                // Cache is still valid, use it
                const cachedResponse = await caches.match(request);
                if (cachedResponse) {
                    console.log('[ServiceWorker] ✓ Serving API/page from cache:', url.pathname + url.search);
                    return cachedResponse;
                }

                // No cache, go to network
                try {
                    return await fetch(request);
                } catch (error) {
                    if (request.mode === 'navigate') {
                        return caches.match('/offline/') || new Response('Offline', { status: 503 });
                    }
                    return new Response('Offline', { status: 503 });
                }
            })()
        );
        return;
    }

    // Handle navigation requests - Cache First (but check expiration)
    if (request.mode === 'navigate') {
        console.log('[ServiceWorker] Navigation request:', url.pathname + url.search);

        const bypassCache = url.searchParams.has('sw-bypass');
        const normalizedUrl = (() => {
            const normalized = new URL(request.url);
            normalized.searchParams.delete('sw-bypass');
            const normalizedString = normalized.toString();
            return normalizedString.endsWith('?') ? normalizedString.slice(0, -1) : normalizedString;
        })();

        if (bypassCache) {
            event.respondWith(
                fetch(request).then(response => {
                    return response;
                }).catch(() => {
                    return caches.match(normalizedUrl).then(cachedResponse => {
                        if (cachedResponse) {
                            console.log('[ServiceWorker] ✓ Bypass fallback to cache:', url.pathname + url.search);
                            return cachedResponse;
                        }
                        const langMatch = url.pathname.match(/^\/(en|de|fr|it)/);
                        const offlineUrl = langMatch ? `/${langMatch[1]}/offline/` : '/offline/';
                        return caches.match(offlineUrl);
                    });
                })
            );
            return;
        }

        event.respondWith(
            (async () => {
                // Check if cache is expired
                const expired = await isCacheExpired();
                
                if (expired) {
                    console.log('[ServiceWorker] Cache expired for navigation, clearing:', url.pathname + url.search);
                    await clearExpiredCache();
                    
                    // Try network first since cache is expired
                    try {
                        return await fetch(request);
                    } catch (error) {
                        console.log('[ServiceWorker] ✗ Network failed and cache expired, showing offline page');
                        const langMatch = url.pathname.match(/^\/(en|de|fr|it)/);
                        const offlineUrl = langMatch ? `/${langMatch[1]}/offline/` : '/offline/';
                        return caches.match(offlineUrl) || new Response(
                            '<html><body><h1>Offline</h1><p>You are currently offline and the cache has expired.</p></body></html>',
                            {
                                status: 503,
                                statusText: 'Service Unavailable',
                                headers: new Headers({ 'Content-Type': 'text/html' })
                            }
                        );
                    }
                }

                // Cache is still valid, try to use it
                // Try to match with full URL (including query params)
                let cachedResponse = await caches.match(request.url);
                
                if (cachedResponse) {
                    const isRedirect = cachedResponse.type === 'opaqueredirect' || (cachedResponse.status >= 300 && cachedResponse.status < 400);
                    if (!isRedirect) {
                        console.log('[ServiceWorker] ✓ Found in cache:', url.pathname + url.search);
                        return cachedResponse;
                    }
                    console.log('[ServiceWorker] ⊘ Ignoring cached redirect:', url.pathname + url.search);
                    cachedResponse = null;
                }

                console.log('[ServiceWorker] ✗ Not in cache:', url.pathname + url.search);

                // If URL has trailing ? with no params, try without it
                if (request.url.endsWith('?')) {
                    const urlWithoutQuestion = request.url.slice(0, -1);
                    console.log('[ServiceWorker] Trying without trailing ?:', urlWithoutQuestion);
                    const alt = await caches.match(urlWithoutQuestion);
                    if (alt) {
                        console.log('[ServiceWorker] ✓ Found alternative in cache');
                        return alt;
                    }
                }

                // For root page requests, check language-specific roots too
                if (url.pathname === '/' || url.pathname === '') {
                    console.log('[ServiceWorker] Root page requested, searching for language-specific root...');

                    const langCodes = [...SUPPORTED_LANGS];
                    const langPromises = langCodes.map(lang =>
                        caches.match(`/${lang}/`).then(res => ({ lang, res }))
                    );

                    const results = await Promise.all(langPromises);
                    const cached = results.find(r => r.res);
                    if (cached) {
                        console.log('[ServiceWorker] ✓ Found cached language root:', `/${cached.lang}/`);
                        return cached.res;
                    }
                }

                // No cache found, try network
                try {
                    return await fetch(request);
                } catch (error) {
                    console.log('[ServiceWorker] ✗ No cached page, showing offline page');

                    // Try to get language-specific offline page first
                    const langMatch = url.pathname.match(/^\/(en|de|fr|it)/);
                    const offlineUrl = langMatch ? `/${langMatch[1]}/offline/` : '/offline/';

                    const offlinePage = await caches.match(offlineUrl);
                    if (offlinePage) {
                        console.log('[ServiceWorker] ✓ Serving offline page:', offlineUrl);
                        return offlinePage;
                    }
                    
                    // Try generic offline page as fallback
                    const genericOffline = await caches.match('/offline/');
                    if (genericOffline) {
                        console.log('[ServiceWorker] ✓ Serving generic offline page');
                        return genericOffline;
                    }
                    
                    // Last resort: return a basic offline response
                    console.log('[ServiceWorker] ✗ No offline page cached, using fallback HTML');
                    return new Response(
                        '<html><body><h1>Offline</h1><p>You are currently offline and this page is not cached.</p></body></html>',
                        {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({ 'Content-Type': 'text/html' })
                        }
                    );
                }
            })()
        );
        return;
    }

    // Handle static assets - Cache First strategy
    if (request.destination === 'style' || 
        request.destination === 'script' || 
        request.destination === 'image' ||
        request.destination === 'font') {
        event.respondWith(
            caches.match(request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(request)
                        .then(response => {
                            // Cache the fetched resource (never expires)
                            const responseClone = response.clone();
                            caches.open(RUNTIME_CACHE).then(cache => {
                                cache.put(request, responseClone);
                            });
                            return response;
                        })
                        .catch(() => {
                            // Return a fallback for images
                            if (request.destination === 'image') {
                                return caches.match('/static/assets/img/logo.png');
                            }
                        });
                })
        );
        return;
    }

    // Default: Cache First with network fallback
    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) {
                return cached;
            }
            return fetch(request).then(response => {
                return response;
            }).catch(() => {
                // Return a basic 503 response for uncached resources when offline
                console.log('[ServiceWorker] Resource not cached and offline:', url.pathname);
                return new Response('', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            });
        })
    );
});

// Background sync for offline changes
self.addEventListener('sync', event => {
    console.log('[ServiceWorker] Background sync triggered:', event.tag);
    
    if (event.tag === 'sync-offline-changes') {
        event.waitUntil(syncOfflineChanges());
    }
});

// Handle messages from clients
self.addEventListener('message', event => {
    console.log('[ServiceWorker] Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => cacheName.startsWith('vouchervault-'))
                        .map(cacheName => caches.delete(cacheName))
                );
            })
        );
    }
});

// Function to sync offline changes
async function syncOfflineChanges() {
    try {
        console.log('[ServiceWorker] Syncing offline changes...');
        return Promise.resolve();
    } catch (error) {
        console.error('[ServiceWorker] Sync failed:', error);
        return Promise.reject(error);
    }
}
