const VERSION = "v2.0.0";
const CACHE_NAME = `vouchervault-${VERSION}`;
const RUNTIME_CACHE = `vouchervault-runtime-${VERSION}`;
const DATA_CACHE = `vouchervault-data-${VERSION}`;
const PAGE_CACHE = `vouchervault-pages-${VERSION}`;

// Static assets to cache on install (only truly static assets, not dynamic pages)
const STATIC_CACHE_URLS = [
    '/offline/',
    '/en/offline/',
    '/de/offline/',
    '/fr/offline/',
    '/it/offline/',
    '/es/offline/',
    '/pt/offline/',
    '/nl/offline/',
    '/pl/offline/',
    '/ru/offline/',
    '/zh/offline/',
    '/ja/offline/',
    '/ko/offline/',
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
    /\/(en|de|fr|it|es|pt|nl|pl|ru|zh|ja|ko)\/dashboard$/,
    /\/dashboard$/,
    /\/(en|de|fr|it|es|pt|nl|pl|ru|zh|ja|ko)\/shared-items/,
    /\/shared-items/,
    /\/(en|de|fr|it|es|pt|nl|pl|ru|zh|ja|ko)\/items\/view\/.+/,
    /\/items\/view\/.+/,
    /\/(en|de|fr|it|es|pt|nl|pl|ru|zh|ja|ko)\/items\/edit\/.+/,
    /\/items\/edit\/.+/,
    /\/(en|de|fr|it|es|pt|nl|pl|ru|zh|ja|ko)\/items\/view-image\/.+/,
    /\/items\/view-image\/.+/,
    /^\/(en|de|fr|it|es|pt|nl|pl|ru|zh|ja|ko)\/?$/,
    /^\/$/
];

// Pages that should always be cached when visited
const CACHE_PAGE_PATTERNS = [
    /\/(en|de|fr|it|es|pt|nl|pl|ru|zh|ja|ko)\/items\//,
    /\/items\//,
    /\/(en|de|fr|it|es|pt|nl|pl|ru|zh|ja|ko)\/dashboard/,
    /\/dashboard/,
    /\/(en|de|fr|it|es|pt|nl|pl|ru|zh|ja|ko)\/shared-items/,
    /\/shared-items/,
    /^\/(en|de|fr|it|es|pt|nl|pl|ru|zh|ja|ko)\/?$/,
    /^\/$/
];

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

    // CRITICAL: Skip caching for OIDC authentication URLs to preserve session state
    // OIDC flow requires server-side session state which breaks with cached responses
    if (url.pathname.includes('/oidc/') || 
        url.pathname.includes('/accounts/login') || 
        url.pathname.includes('/accounts/logout')) {
        console.log('[ServiceWorker] Bypassing cache for auth URL:', url.pathname);
        // Let the request go through normally without service worker intervention
        return;
    }

    // Handle API requests and page data - Network First, persistent cache fallback
    if (API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Cache ONLY if successful (replaces old cache)
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(DATA_CACHE).then(cache => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Network failed - serve from cache (no expiration)
                    return caches.match(request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                console.log('[ServiceWorker] Serving from cache (offline):', url.pathname);
                                return cachedResponse;
                            }
                            if (request.mode === 'navigate') {
                                return caches.match('/offline/');
                            }
                            return new Response('Offline', { status: 503 });
                        });
                })
        );
        return;
    }

    // Handle navigation requests - Cache First with Network Update
    if (request.mode === 'navigate') {
        console.log('[ServiceWorker] Navigation request:', url.pathname + url.search);
        
        event.respondWith(
            // Try to match with full URL (including query params)
            caches.match(request.url).then(cachedResponse => {
                if (cachedResponse) {
                    console.log('[ServiceWorker] ✓ Found in cache:', url.pathname + url.search);
                    return cachedResponse;
                }
                
                console.log('[ServiceWorker] ✗ Not in cache:', url.pathname + url.search);
                
                // If URL has trailing ? with no params, try without it
                if (request.url.endsWith('?')) {
                    const urlWithoutQuestion = request.url.slice(0, -1);
                    console.log('[ServiceWorker] Trying without trailing ?:', urlWithoutQuestion);
                    return caches.match(urlWithoutQuestion).then(alt => {
                        if (alt) {
                            console.log('[ServiceWorker] ✓ Found alternative in cache');
                            return alt;
                        }
                        return null;
                    });
                }
                
                // For root page requests, check language-specific roots too
                if (url.pathname === '/' || url.pathname === '') {
                    console.log('[ServiceWorker] Root page requested, searching for language-specific root...');
                    
                    const langCodes = ['de', 'en', 'fr', 'it', 'es', 'pt', 'nl', 'pl', 'ru', 'zh', 'ja', 'ko'];
                    const langPromises = langCodes.map(lang => 
                        caches.match(`/${lang}/`).then(res => ({ lang, res }))
                    );
                    
                    return Promise.all(langPromises).then(results => {
                        const cached = results.find(r => r.res);
                        if (cached) {
                            console.log('[ServiceWorker] ✓ Found cached language root:', `/${cached.lang}/`);
                            return cached.res;
                        }
                        return null;
                    });
                }
                
                return null;
            }).then(cachedResponse => {
                // Try network with timeout, but return cache immediately if available
                const networkPromise = Promise.race([
                    fetch(request)
                        .then(response => {
                            // Cache successful navigation responses using URL string
                            // BUT skip caching create/edit pages
                            if (response && response.status === 200) {
                                const skipPaths = ['/items/create', '/items/edit'];
                                const shouldCache = !skipPaths.some(path => url.pathname.includes(path));
                                
                                if (shouldCache) {
                                    const responseClone = response.clone();
                                    caches.open(PAGE_CACHE).then(cache => {
                                        cache.put(request.url, responseClone);
                                    });
                                    console.log('[ServiceWorker] ✓ Updated cache:', url.pathname + url.search);
                                } else {
                                    console.log('[ServiceWorker] ⊘ Skipped caching (create/edit page):', url.pathname);
                                }
                            }
                            return response;
                        }),
                    // Timeout after 3 seconds
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), 3000)
                    )
                ]).catch(error => {
                    console.log('[ServiceWorker] Network failed/timeout:', error.message);
                    return null;
                });

                // If we have cache, return it immediately and update in background
                if (cachedResponse) {
                    console.log('[ServiceWorker] ✓ Serving from cache:', url.pathname + url.search);
                    // Update cache in background (don't wait)
                    networkPromise;
                    return cachedResponse;
                }

                // No cache - must wait for network
                console.log('[ServiceWorker] No cache, waiting for network:', url.pathname + url.search);
                return networkPromise.then(response => {
                    if (response) {
                        return response;
                    }
                    
                    // Network failed and no cache - show offline page  
                    console.log('[ServiceWorker] ✗ No cached page, showing offline page');
                    
                    // Try to get language-specific offline page first
                    const langMatch = url.pathname.match(/^\/(en|de|fr|it|es|pt|nl|pl|ru|zh|ja|ko)/);
                    const offlineUrl = langMatch ? `/${langMatch[1]}/offline/` : '/offline/';
                    
                    return caches.match(offlineUrl).then(offlinePage => {
                        if (offlinePage) {
                            console.log('[ServiceWorker] ✓ Serving offline page:', offlineUrl);
                            return offlinePage;
                        }
                        // Try generic offline page as fallback
                        return caches.match('/offline/').then(genericOffline => {
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
                        });
                    });
                });
            })
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

    // Default: Network First with cache fallback
    event.respondWith(
        fetch(request)
            .then(response => response)
            .catch(() => {
                return caches.match(request).then(cached => {
                    if (cached) {
                        return cached;
                    }
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
