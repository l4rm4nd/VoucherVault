/**
 * Manual Cache Manager
 * User-controlled caching with 48-hour expiration
 */

class ManualCacheManager {
    constructor() {
        this.CACHE_DURATION = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
        this.CACHE_KEY = 'offline_cache_timestamp';
        this.VERSION = 'v2.0.0';
        this.PAGE_CACHE_NAME = `vouchervault-pages-${this.VERSION}`;
        this.init();
    }

    init() {
        this.updateCacheStatus();
        
        // Check cache status every minute to update expiration time
        setInterval(() => {
            this.updateCacheStatus();
        }, 60000); // Update every 60 seconds
        
        console.log('[ManualCache] Initialized');
    }

    /**
     * Check if cache is still valid (within 48 hours)
     */
    async isCacheValid() {
        const timestamp = localStorage.getItem(this.CACHE_KEY);
        if (!timestamp) return false;
        
        const age = Date.now() - parseInt(timestamp);
        if (age >= this.CACHE_DURATION) return false;
        
        // Also verify cache actually exists
        try {
            const cache = await caches.open(this.PAGE_CACHE_NAME);
            const keys = await cache.keys();
            return keys.length > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get remaining cache time in hours and minutes
     */
    getRemainingTime() {
        const timestamp = localStorage.getItem(this.CACHE_KEY);
        if (!timestamp) return { hours: 0, minutes: 0 };
        
        const age = Date.now() - parseInt(timestamp);
        const remaining = Math.max(0, this.CACHE_DURATION - age);
        
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        
        return { hours, minutes };
    }

    /**
     * Get remaining cache time in hours (for backwards compatibility)
     */
    getRemainingHours() {
        return this.getRemainingTime().hours;
    }

    /**
     * Update cache status display
     */
    async updateCacheStatus() {
        const statusElement = document.getElementById('cache-status');
        const buttonTextElement = document.getElementById('cache-button-text');
        
        if (!statusElement) {
            console.warn('[ManualCache] Status element not found');
            return;
        }

        const isValid = await this.isCacheValid();
        console.log('[ManualCache] Updating status, valid:', isValid);

        if (isValid) {
            const { hours, minutes } = this.getRemainingTime();
            statusElement.textContent = `${hours}h ${minutes}m left`;
            statusElement.className = 'badge bg-success ms-2';
            if (buttonTextElement) {
                buttonTextElement.textContent = 'Refresh Cache';
            }
        } else {
            // If cache doesn't exist but localStorage has timestamp, clear it
            if (localStorage.getItem(this.CACHE_KEY)) {
                localStorage.removeItem(this.CACHE_KEY);
                console.log('[ManualCache] Cleared stale timestamp');
            }
            statusElement.textContent = 'Not cached';
            statusElement.className = 'badge bg-secondary ms-2';
            if (buttonTextElement) {
                buttonTextElement.textContent = 'Cache for Offline';
            }
        }
    }

    /**
     * Cache all current page data and items
     */
    async cacheData() {
        if (!('caches' in window)) {
            this.showToast('Error', 'Caching not supported in this browser', 'danger');
            return;
        }

        const buttonTextElement = document.getElementById('cache-button-text');
        const originalText = buttonTextElement ? buttonTextElement.textContent : '';
        
        if (buttonTextElement) {
            buttonTextElement.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Caching...';
        }

        try {
            // Get current language
            const langMatch = window.location.pathname.match(/^\/(en|de|fr|it)/);
            const currentLang = langMatch ? langMatch[1] : 'en';

            const urlsToCache = [];
            const itemUrls = new Set();

            // Add essential pages
            urlsToCache.push(`/${currentLang}/`);
            urlsToCache.push(`/${currentLang}/dashboard`);
            urlsToCache.push(`/${currentLang}/shared-items/`);
            urlsToCache.push(`/${currentLang}/offline/`);

            // Add all filter combinations
            const types = ['giftcard', 'coupon', 'voucher', 'loyaltycard'];
            const statuses = ['available', 'used', 'expired', 'soon_expiring', 'shared_by_me', 'shared_with_me'];
            
            types.forEach(type => {
                urlsToCache.push(`/${currentLang}/?type=${type}`);
            });
            
            statuses.forEach(status => {
                urlsToCache.push(`/${currentLang}/?status=${status}`);
            });
            
            types.forEach(type => {
                statuses.forEach(status => {
                    urlsToCache.push(`/${currentLang}/?type=${type}&status=${status}`);
                });
            });

            // Extract all item URLs from the current page
            const itemLinks = document.querySelectorAll('a[href*="/items/view/"]');
            itemLinks.forEach(link => {
                const url = new URL(link.href, window.location.origin);
                itemUrls.add(url.pathname);
            });

            // Fetch inventory and filter pages to collect ALL item detail URLs
            const pagesToScan = new Set();
            pagesToScan.add(`/${currentLang}/`);
            pagesToScan.add(`/${currentLang}/shared-items/`);

            types.forEach(type => {
                pagesToScan.add(`/${currentLang}/?type=${type}`);
            });

            statuses.forEach(status => {
                pagesToScan.add(`/${currentLang}/?status=${status}`);
            });

            types.forEach(type => {
                statuses.forEach(status => {
                    pagesToScan.add(`/${currentLang}/?type=${type}&status=${status}`);
                });
            });

            const collectItemUrlsFromHtml = (html) => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const links = doc.querySelectorAll('a[href*="/items/view/"]');
                links.forEach(link => {
                    try {
                        const url = new URL(link.getAttribute('href'), window.location.origin);
                        itemUrls.add(url.pathname);
                    } catch (e) {
                        // Ignore invalid URLs
                    }
                });
            };

            for (const pageUrl of pagesToScan) {
                try {
                    const response = await fetch(pageUrl, {
                        method: 'GET',
                        credentials: 'same-origin',
                        cache: 'no-store',
                        headers: {
                            'X-Manual-Cache': '1',
                            'Cache-Control': 'no-store'
                        }
                    });

                    if (response.ok) {
                        const html = await response.text();
                        collectItemUrlsFromHtml(html);
                    }
                } catch (error) {
                    console.warn(`[ManualCache] Failed to scan ${pageUrl}:`, error);
                }
            }

            itemUrls.forEach(url => urlsToCache.push(url));

            console.log(`[ManualCache] Caching ${urlsToCache.length} URLs...`);

            // Cache all URLs
            const cache = await caches.open(this.PAGE_CACHE_NAME);
            let cached = 0;
            let failed = 0;

            for (const url of urlsToCache) {
                try {
                    const response = await fetch(url, {
                        method: 'GET',
                        credentials: 'same-origin',
                        cache: 'no-store',
                        headers: {
                            'X-Manual-Cache': '1',
                            'Cache-Control': 'no-store'
                        }
                    });

                    if (response.ok) {
                        // Add timestamp header
                        const blob = await response.clone().blob();
                        const headers = new Headers(response.headers);
                        headers.set('sw-cached-time', Date.now().toString());

                        const timestampedResponse = new Response(blob, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: headers
                        });

                        await cache.put(url, timestampedResponse);
                        cached++;
                    } else {
                        failed++;
                    }
                } catch (error) {
                    console.warn(`[ManualCache] Failed to cache ${url}:`, error);
                    failed++;
                }
            }

            // Save cache timestamp
            localStorage.setItem(this.CACHE_KEY, Date.now().toString());

            console.log(`[ManualCache] ✓ Cached ${cached} pages, ${failed} failed`);
            this.showToast('Success', `Cached ${cached} pages for offline use (valid for 48 hours)`, 'success');
            this.updateCacheStatus();

        } catch (error) {
            console.error('[ManualCache] Caching failed:', error);
            this.showToast('Error', 'Failed to cache data. Please try again.', 'danger');
        } finally {
            this.updateCacheStatus();
        }
    }

    /**
     * Clear all cached data
     */
    async clearCache() {
        const buttonTextElement = document.getElementById('purge-button-text');
        const originalText = buttonTextElement ? buttonTextElement.textContent : '';
        
        if (buttonTextElement) {
            buttonTextElement.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Purging...';
        }

        try {
            const cacheNames = await caches.keys();
            const vaultCaches = cacheNames.filter(name => name.includes('vouchervault'));
            
            console.log(`[ManualCache] Purging ${vaultCaches.length} caches:`, vaultCaches);
            
            await Promise.all(
                vaultCaches.map(name => caches.delete(name))
            );
            
            localStorage.removeItem(this.CACHE_KEY);
            await this.updateCacheStatus();
            
            this.showToast('Success', `Cache purged successfully (${vaultCaches.length} cache${vaultCaches.length !== 1 ? 's' : ''} cleared)`, 'success');
            console.log('[ManualCache] Cache cleared');
        } catch (error) {
            console.error('[ManualCache] Failed to clear cache:', error);
            this.showToast('Error', 'Failed to clear cache', 'danger');
        } finally {
            if (buttonTextElement) {
                buttonTextElement.textContent = originalText;
            }
        }
    }

    /**
     * Show toast notification
     */
    showToast(title, message, type = 'info') {
        let toastContainer = document.getElementById('cache-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'cache-toast-container';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            toastContainer.style.zIndex = '11';
            document.body.appendChild(toastContainer);
        }

        const toastId = 'toast-' + Date.now();
        const iconClass = type === 'success' ? 'bi-check-circle-fill' : 
                         type === 'danger' ? 'bi-exclamation-triangle-fill' : 
                         'bi-info-circle-fill';
        
        const bgClass = type === 'success' ? 'bg-success' : 
                       type === 'danger' ? 'bg-danger' : 
                       'bg-info';

        const toastHtml = `
            <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header ${bgClass} text-white">
                    <i class="bi ${iconClass} me-2"></i>
                    <strong class="me-auto">${title}</strong>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHtml);

        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000
        });
        toast.show();

        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
}

// Initialize when DOM is ready
let manualCacheManager;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        manualCacheManager = new ManualCacheManager();
    });
} else {
    manualCacheManager = new ManualCacheManager();
}
