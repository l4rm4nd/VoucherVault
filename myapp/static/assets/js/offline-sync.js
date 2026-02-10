/**
 * Offline Sync Manager
 * Handles offline data storage, sync queue, and network detection
 */

class OfflineSyncManager {
    constructor() {
        this.dbName = 'VoucherVaultOfflineDB';
        this.dbVersion = 1;
        this.db = null;
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        
        this.init();
    }

    /**
     * Initialize the offline sync manager
     */
    async init() {
        try {
            await this.initIndexedDB();
            this.setupNetworkListeners();
            this.setupServiceWorker();
            
            // If we're online, sync any pending changes
            if (this.isOnline) {
                this.syncPendingChanges();
            }
            
            console.log('[OfflineSync] Initialized successfully');
        } catch (error) {
            console.error('[OfflineSync] Initialization failed:', error);
        }
    }

    /**
     * Initialize IndexedDB for offline storage
     */
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('[OfflineSync] IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('[OfflineSync] IndexedDB opened successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores for different data types
                if (!db.objectStoreNames.contains('syncQueue')) {
                    const syncStore = db.createObjectStore('syncQueue', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                    syncStore.createIndex('status', 'status', { unique: false });
                }

                if (!db.objectStoreNames.contains('cachedData')) {
                    const dataStore = db.createObjectStore('cachedData', { 
                        keyPath: 'key' 
                    });
                    dataStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                console.log('[OfflineSync] IndexedDB upgraded to version', db.version);
            };
        });
    }

    /**
     * Setup network event listeners
     */
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            console.log('[OfflineSync] Connection restored');
            this.isOnline = true;
            this.updateOnlineStatus(true);
            this.syncPendingChanges();
        });

        window.addEventListener('offline', () => {
            console.log('[OfflineSync] Connection lost');
            this.isOnline = false;
            this.updateOnlineStatus(false);
        });

        // Check if page was loaded from cache
        this.checkIfOfflineResponse();

        // Initial status check
        this.updateOnlineStatus(navigator.onLine);
    }

    /**
     * Check if the current page response is from cache (offline)
     */
    checkIfOfflineResponse() {
        // Check if the page was served from cache
        if (performance && performance.getEntriesByType) {
            const navEntries = performance.getEntriesByType('navigation');
            if (navEntries.length > 0 && navEntries[0].transferSize === 0) {
                // Page loaded from cache
                this.showOfflinePageBanner();
            }
        }
        
        // Also check for offline response header from service worker
        if (!navigator.onLine) {
            this.showOfflinePageBanner();
        }
    }

    /**
     * Show banner when viewing offline/cached content
     */
    showOfflinePageBanner() {
        // Don't show on the offline page itself
        if (window.location.pathname === '/offline/') return;

        const banner = document.createElement('div');
        banner.id = 'offline-content-banner';
        banner.className = 'offline-content-banner';
        banner.innerHTML = `
            <i class="bi bi-database"></i>
            <span>Viewing cached content. Some data may not be up to date.</span>
            <button onclick="window.location.reload()" class="btn btn-sm btn-light">
                <i class="bi bi-arrow-clockwise"></i> Refresh
            </button>
        `;
        document.body.insertBefore(banner, document.body.firstChild);
    }

    /**
     * Setup service worker registration and messaging
     */
    setupServiceWorker() {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            navigator.serviceWorker.ready.then(registration => {
                console.log('[OfflineSync] Service Worker ready');
            });
        }
    }

    /**
     * Update UI to show online/offline status
     */
    updateOnlineStatus(isOnline) {
        // No visible banner - just dispatch event for other parts of the app
        window.dispatchEvent(new CustomEvent('networkStatusChanged', { 
            detail: { isOnline } 
        }));
    }

    /**
     * Add an action to the sync queue (for operations done while offline)
     */
    async addToSyncQueue(action) {
        if (!this.db) {
            console.error('[OfflineSync] Database not initialized');
            return;
        }

        const transaction = this.db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');

        const queueItem = {
            action: action.type,
            method: action.method,
            url: action.url,
            data: action.data,
            timestamp: Date.now(),
            status: 'pending',
            retries: 0
        };

        return new Promise((resolve, reject) => {
            const request = store.add(queueItem);
            
            request.onsuccess = () => {
                console.log('[OfflineSync] Added to sync queue:', action.type);
                this.showNotification('Changes saved offline. Will sync when online.');
                resolve(request.result);
            };
            
            request.onerror = () => {
                console.error('[OfflineSync] Failed to add to sync queue:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get all pending items from sync queue
     */
    async getPendingSync() {
        if (!this.db) return [];

        const transaction = this.db.transaction(['syncQueue'], 'readonly');
        const store = transaction.objectStore('syncQueue');
        const index = store.index('status');

        return new Promise((resolve, reject) => {
            const request = index.getAll('pending');
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Sync pending changes when back online
     */
    async syncPendingChanges() {
        if (this.syncInProgress || !this.isOnline) {
            return;
        }

        this.syncInProgress = true;
        console.log('[OfflineSync] Starting sync...');

        try {
            const pendingItems = await this.getPendingSync();
            
            if (pendingItems.length === 0) {
                console.log('[OfflineSync] No pending changes to sync');
                this.syncInProgress = false;
                return;
            }

            console.log(`[OfflineSync] Syncing ${pendingItems.length} pending changes...`);
            this.showNotification(`Syncing ${pendingItems.length} offline changes...`);

            let successCount = 0;
            let failCount = 0;

            for (const item of pendingItems) {
                try {
                    await this.syncItem(item);
                    await this.removeSyncItem(item.id);
                    successCount++;
                } catch (error) {
                    console.error('[OfflineSync] Failed to sync item:', item.id, error);
                    await this.updateSyncItemStatus(item.id, 'failed', item.retries + 1);
                    failCount++;
                }
            }

            if (successCount > 0) {
                this.showNotification(`Successfully synced ${successCount} changes!`, 'success');
                
                // Refresh page data from server (fetch fresh data)
                if (typeof window.refreshData === 'function') {
                    window.refreshData();
                } else {
                    // Force page reload to get fresh data
                    window.location.reload();
                }
            }

            if (failCount > 0) {
                this.showNotification(`${failCount} changes failed to sync. Will retry later.`, 'warning');
            }

        } catch (error) {
            console.error('[OfflineSync] Sync failed:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Sync a single item
     */
    async syncItem(item) {
        console.log('[OfflineSync] Syncing item:', item.type, item.url);
        
        // Handle different item types
        if (item.type === 'form_submission') {
            return this.syncFormSubmission(item);
        }
        
        // Default sync for other types
        const response = await fetch(item.url, {
            method: item.method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCSRFToken()
            },
            body: item.data ? JSON.stringify(item.data) : undefined
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }
    
    /**
     * Sync form submission
     */
    async syncFormSubmission(item) {
        // For form submissions, we need to use FormData
        const formData = new FormData();
        
        // Add all form fields
        if (item.data) {
            for (const [key, value] of Object.entries(item.data)) {
                formData.append(key, value);
            }
        }
        
        const response = await fetch(item.url, {
            method: item.method,
            body: formData,
            headers: {
                'X-CSRFToken': this.getCSRFToken()
            },
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response;
    }

    /**
     * Remove item from sync queue
     */
    async removeSyncItem(id) {
        if (!this.db) return;

        const transaction = this.db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');

        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update sync item status
     */
    async updateSyncItemStatus(id, status, retries) {
        if (!this.db) return;

        const transaction = this.db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');

        return new Promise((resolve, reject) => {
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (item) {
                    item.status = status;
                    item.retries = retries;
                    const updateRequest = store.put(item);
                    
                    updateRequest.onsuccess = () => resolve();
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    resolve();
                }
            };
            
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Cache data for offline use (replaces existing cache)
     */
    async cacheData(key, data) {
        if (!this.db) return;

        const transaction = this.db.transaction(['cachedData'], 'readwrite');
        const store = transaction.objectStore('cachedData');

        const cacheItem = {
            key: key,
            data: data,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            // Use put to replace existing cache entry
            const request = store.put(cacheItem);
            
            request.onsuccess = () => {
                console.log(`[OfflineSync] Cache updated: ${key}`);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get cached data (never expires - supports long-term offline)
     */
    async getCachedData(key) {
        if (!this.db) return null;

        const transaction = this.db.transaction(['cachedData'], 'readonly');
        const store = transaction.objectStore('cachedData');

        return new Promise((resolve, reject) => {
            const request = store.get(key);
            
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    console.log(`[OfflineSync] Retrieved from cache: ${key}`);
                    resolve(result.data);
                } else {
                    resolve(null);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get CSRF token for requests
     */
    getCSRFToken() {
        const name = 'csrftoken';
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        console.log(`[OfflineSync] ${type.toUpperCase()}: ${message}`);
        
        // Try to use toast notifications if available
        if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            const toastContainer = document.getElementById('toast-container');
            if (toastContainer) {
                const toastEl = document.createElement('div');
                toastEl.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'info'} border-0`;
                toastEl.setAttribute('role', 'alert');
                toastEl.innerHTML = `
                    <div class="d-flex">
                        <div class="toast-body">${message}</div>
                        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                    </div>
                `;
                toastContainer.appendChild(toastEl);
                const toast = new bootstrap.Toast(toastEl);
                toast.show();
                
                // Remove after shown
                toastEl.addEventListener('hidden.bs.toast', () => {
                    toastEl.remove();
                });
            }
        }
    }

    /**
     * Check if we're currently offline
     */
    isOffline() {
        return !this.isOnline;
    }

    /**
     * Intercept fetch requests to handle offline scenarios
     */
    static wrapFetch(url, options = {}) {
        const manager = window.offlineSyncManager;
        
        return fetch(url, options)
            .catch(async (error) => {
                if (manager && manager.isOffline()) {
                    console.log('[OfflineSync] Network request failed, adding to queue');
                    
                    // Add to sync queue
                    await manager.addToSyncQueue({
                        type: options.action || 'unknown',
                        method: options.method || 'GET',
                        url: url,
                        data: options.body ? JSON.parse(options.body) : null
                    });
                    
                    // Return cached data if available
                    const cachedData = await manager.getCachedData(url);
                    if (cachedData) {
                        return new Response(JSON.stringify(cachedData), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                }
                
                throw error;
            });
    }
}

// Initialize the offline sync manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.offlineSyncManager = new OfflineSyncManager();
    });
} else {
    window.offlineSyncManager = new OfflineSyncManager();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineSyncManager;
}
