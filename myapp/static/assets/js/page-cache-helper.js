/**
 * Page Cache Helper
 * Ensures pages and their data are aggressively cached for offline use
 */

class PageCacheHelper {
    constructor() {
        this.setupPageCaching();
    }

    /**
     * Setup automatic page caching
     */
    setupPageCaching() {
        // DISABLED: All automatic caching disabled - users must manually cache via button
        // this.cacheCurrentPageData();
        // this.interceptNavigation();
        // this.cacheItemsList();
        // setTimeout(() => this.preCacheEssentialPages(), 2000);

        console.log('[PageCache] Initialized (manual caching mode - automatic caching disabled)');
    }

    /**
     * Cache data for the current page
     */
    async cacheCurrentPageData() {
        const path = window.location.pathname;
        
        // Strip language prefix for path checking
        const pathWithoutLang = path.replace(/^\/(en|de|fr|it|es|pt|nl|pl|ru|zh|ja|ko)\/?/, '/');

        // Dashboard
        if (path.includes('dashboard') || pathWithoutLang.includes('dashboard')) {
            await this.cacheDashboardData();
        }

        // Items list (root or inventory) - delay to ensure page is loaded
        if (pathWithoutLang === '/' || path.includes('items') || pathWithoutLang.includes('items')) {
            console.log('[PageCache] Detected items page, starting delayed cache...');
            setTimeout(() => this.cacheItemsListData(), 1500);
        }

        // Item detail page
        const itemViewMatch = path.match(/\/items\/view\/([^/]+)/);
        if (itemViewMatch) {
            await this.cacheItemDetailData(itemViewMatch[1]);
        }

        // Shared items - delay to ensure page is loaded
        if (path.includes('shared-items') || pathWithoutLang.includes('shared-items')) {
            console.log('[PageCache] Detected shared items page, starting delayed cache...');
            setTimeout(() => this.cacheSharedItemsData(), 1500);
        }
    }

    /**
     * Pre-cache essential navigation pages (dashboard, language root)
     */
    async preCacheEssentialPages() {
        if (!navigator.onLine) {
            console.log('[PageCache] Offline - skipping essential pages pre-cache');
            return;
        }
        
        // Wait for service worker to be ready
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.ready;
            } catch (e) {
                console.warn('[PageCache] Service worker not ready');
                return;
            }
        }
        
        console.log('[PageCache] Pre-caching essential navigation pages...');
        
        // Detect current language from URL
        const langMatch = window.location.pathname.match(/^\/(en|de|fr|it|es|pt|nl|pl|ru|zh|ja|ko)/);
        const currentLang = langMatch ? langMatch[1] : null;
        
        const essentialPages = [];
        
        // Add language-specific pages
        if (currentLang) {
            // Root (inventory page)
            essentialPages.push(`/${currentLang}/`);
            // Dashboard
            essentialPages.push(`/${currentLang}/dashboard`);
            // Shared items
            essentialPages.push(`/${currentLang}/shared-items/`);
            
            // Type filters only
            const types = ['giftcard', 'coupon', 'voucher', 'loyaltycard'];
            types.forEach(type => {
                essentialPages.push(`/${currentLang}/?type=${type}`);
            });
            
            // Status filters only
            const statuses = ['available', 'used', 'expired', 'soon_expiring', 'shared_by_me', 'shared_with_me'];
            statuses.forEach(status => {
                essentialPages.push(`/${currentLang}/?status=${status}`);
            });
            
            // Combined type + status filters (most common combinations)
            types.forEach(type => {
                statuses.forEach(status => {
                    essentialPages.push(`/${currentLang}/?type=${type}&status=${status}`);
                });
            });
        } else {
            essentialPages.push('/');
            essentialPages.push('/dashboard');
            essentialPages.push('/shared-items/');
            
            // Type filters only
            const types = ['giftcard', 'coupon', 'voucher', 'loyaltycard'];
            types.forEach(type => {
                essentialPages.push(`/?type=${type}`);
            });
            
            // Status filters only
            const statuses = ['available', 'used', 'expired', 'soon_expiring', 'shared_by_me', 'shared_with_me'];
            statuses.forEach(status => {
                essentialPages.push(`/?status=${status}`);
            });
            
            // Combined type + status filters
            types.forEach(type => {
                statuses.forEach(status => {
                    essentialPages.push(`/?type=${type}&status=${status}`);
                });
            });
        }
        
        // Pre-cache each essential page
        for (const url of essentialPages) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    credentials: 'same-origin',
                    headers: {
                        'X-Requested-With': 'PreCache'
                    }
                });
                
                if (response.ok) {
                    // Manually add to PAGE_CACHE since these aren't navigation requests
                    const cache = await caches.open('PAGE_CACHE');
                    await cache.put(url, response.clone());
                    console.log(`[PageCache] ✓ Cached essential page: ${url}`);
                } else {
                    console.warn(`[PageCache] ✗ Failed to cache ${url}: HTTP ${response.status}`);
                }
            } catch (error) {
                console.warn(`[PageCache] ✗ Error caching ${url}:`, error.message);
            }
        }
        
        console.log('[PageCache] Essential pages pre-caching complete');
    }

    /**
     * Cache dashboard data - Always fetch fresh when online
     */
    async cacheDashboardData() {
        if (!navigator.onLine) {
            console.log('[PageCache] Offline - using existing cache');
            return;
        }

        try {
            const response = await fetch('/api/get/stats');
            if (response.ok) {
                const data = await response.json();
                if (window.offlineSyncManager) {
                    // Replace cache with fresh data
                    await window.offlineSyncManager.cacheData('dashboard_stats', data);
                    console.log('[PageCache] Updated dashboard cache with fresh data');
                }
            }
        } catch (error) {
            console.log('[PageCache] Using cached dashboard data (offline)');
        }
    }

    /**
     * Cache items list data - Always fetch fresh when online
     */
    async cacheItemsListData() {
        if (!navigator.onLine) {
            console.log('[PageCache] Offline - using existing cache');
            return;
        }

        try {
            // Extract item URLs from item links (preserves language prefix)
            const itemLinks = document.querySelectorAll('a[href*="/items/view/"]');
            const itemUrls = Array.from(itemLinks)
                .map(link => {
                    // Use the full pathname from the link to preserve language prefix
                    const url = new URL(link.href, window.location.origin);
                    return url.pathname;
                })
                .filter((url, index, self) => url && self.indexOf(url) === index); // Remove duplicates
            
            console.log(`[PageCache] Found ${itemUrls.length} unique items on page`);
            
            if (itemUrls.length > 0 && window.offlineSyncManager) {
                // Store URLs for reference
                await window.offlineSyncManager.cacheData('cached_item_urls', itemUrls);
                console.log(`[PageCache] Updated cache with ${itemUrls.length} item URLs`);
                
                // Immediately pre-cache all item detail pages
                await this.preCacheAllItemUrls(itemUrls);
            } else {
                console.log('[PageCache] No items found to cache');
            }
        } catch (error) {
            console.error('[PageCache] Error caching items list:', error);
        }
    }

    /**
     * Pre-cache all item detail pages in background
     */
    async preCacheAllItemUrls(itemUrls) {
        // Wait for service worker to be ready
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.ready;
            } catch (e) {
                console.warn('[PageCache] Service worker not ready, caching may not work');
            }
        }
        
        console.log(`[PageCache] Starting pre-cache of ${itemUrls.length} item detail pages...`);
        
        let cached = 0;
        let failed = 0;
        
        for (const url of itemUrls) {
            try {
                // Use the full URL with language prefix
                const response = await fetch(url, {
                    method: 'GET',
                    credentials: 'same-origin',
                    headers: {
                        'X-Requested-With': 'PreCache'
                    }
                });
                
                if (response.ok) {
                    // IMPORTANT: Consume the response body so service worker can cache it
                    await response.text();
                    cached++;
                    console.log(`[PageCache] ✓ Cached item ${cached}/${itemUrls.length}: ${url}`);
                } else {
                    failed++;
                    console.warn(`[PageCache] ✗ Failed to cache item ${url}: HTTP ${response.status}`);
                }
                
                // Small delay to avoid overwhelming the server
                if ((cached + failed) % 3 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (error) {
                failed++;
                console.warn(`[PageCache] ✗ Error caching item ${url}:`, error.message);
            }
        }
        
        console.log(`[PageCache] ✓ Pre-caching complete! Cached: ${cached}, Failed: ${failed}, Total: ${itemUrls.length}`);
    }

    /**
     * Cache item detail data
     */
    async cacheItemDetailData(itemId) {
        try {
            // The page HTML is cached by service worker
            // Cache any API data if needed
            if (window.offlineSyncManager) {
                // Store the item ID as recently viewed
                const recentItems = await window.offlineSyncManager.getCachedData('recent_items') || [];
                if (!recentItems.includes(itemId)) {
                    recentItems.unshift(itemId);
                    // Keep only last 20 items
                    const trimmedItems = recentItems.slice(0, 20);
                    await window.offlineSyncManager.cacheData('recent_items', trimmedItems);
                }
                console.log('[PageCache] Cached item detail:', itemId);
            }
        } catch (error) {
            console.log('[PageCache] Failed to cache item detail:', error);
        }
    }

    /**
     * Cache shared items data - Always fetch fresh when online
     */
    async cacheSharedItemsData() {
        if (!navigator.onLine) {
            console.log('[PageCache] Offline - using existing cache');
            return;
        }

        try {
            // Extract item URLs from shared item links (preserves language prefix)
            const itemLinks = document.querySelectorAll('a[href*="/items/view/"]');
            const sharedItemUrls = Array.from(itemLinks)
                .map(link => {
                    const url = new URL(link.href, window.location.origin);
                    return url.pathname;
                })
                .filter((url, index, self) => url && self.indexOf(url) === index); // Remove duplicates
            
            console.log(`[PageCache] Found ${sharedItemUrls.length} unique shared items on page`);
            
            if (sharedItemUrls.length > 0 && window.offlineSyncManager) {
                // Store URLs for reference
                await window.offlineSyncManager.cacheData('shared_item_urls', sharedItemUrls);
                console.log(`[PageCache] Updated cache with ${sharedItemUrls.length} shared item URLs`);
                
                // Pre-cache all shared item detail pages
                await this.preCacheAllItemUrls(sharedItemUrls);
            } else {
                console.log('[PageCache] No shared items found to cache');
            }
        } catch (error) {
            console.error('[PageCache] Error caching shared items:', error);
        }
    }

    /**
     * Intercept navigation to pre-cache pages
     */
    interceptNavigation() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (!link) return;

            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

            // Pre-cache important pages when clicked
            if (href.includes('/items/view/') || 
                href.includes('/dashboard') || 
                href.includes('/shared-items') ||
                href === '/') {
                this.preCachePage(href);
            }
        }, true);
    }

    /**
     * Pre-cache a page
     */
    async preCachePage(url) {
        try {
            // Let the service worker cache it
            const fullUrl = new URL(url, window.location.origin).href;
            
            // Trigger a fetch that will be cached by service worker
            fetch(fullUrl, { 
                method: 'GET',
                credentials: 'same-origin',
                priority: 'low' // Don't interfere with user navigation
            }).catch(() => {
                // Ignore errors, this is just pre-caching
            });
            
            console.log('[PageCache] Pre-caching page:', url);
        } catch (error) {
            // Ignore pre-cache errors
        }
    }

    /**
     * Refresh items list cache periodically when online
     */
    cacheItemsList() {
        // If we're on the items list page, refresh cache every 30 seconds when online
        const path = window.location.pathname;
        const pathWithoutLang = path.replace(/^\/(en|de|fr|it|es|pt|nl|pl|ru|zh|ja|ko)\/?/, '/');
        
        if (pathWithoutLang === '/' || path.includes('items') || pathWithoutLang.includes('items')) {
            setInterval(() => {
                if (navigator.onLine) {
                    this.cacheItemsListData();
                }
            }, 30000); // Every 30 seconds
        }
    }

    /**
     * Pre-cache all item pages accessible from current view
     */
    async preCacheVisibleItems() {
        // This is now handled by preCacheAllItemDetails
        // which is called automatically from cacheItemsListData
        console.log('[PageCache] Item pre-caching handled automatically');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.pageCacheHelper = new PageCacheHelper();
        
        // DISABLED: Automatic pre-caching - user must trigger via cache button
        // setTimeout(() => {
        //     if (window.pageCacheHelper && navigator.onLine) {
        //         window.pageCacheHelper.preCacheVisibleItems();
        //     }
        // }, 2000);
    });
} else {
    window.pageCacheHelper = new PageCacheHelper();
    
    // DISABLED: Automatic pre-caching - user must trigger via cache button
    // setTimeout(() => {
    //     if (window.pageCacheHelper && navigator.onLine) {
    //         window.pageCacheHelper.preCacheVisibleItems();
    //     }
    // }, 2000);
}
