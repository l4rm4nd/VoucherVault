/**
 * Example Integration: How to Make Forms Work Offline
 * 
 * This file shows examples of how to integrate the offline sync manager
 * with your existing forms and API calls.
 */

// ============================================================================
// Example 1: Simple Form Submission with Offline Support
// ============================================================================

function submitFormWithOfflineSupport(formElement, url) {
    const formData = new FormData(formElement);
    const data = Object.fromEntries(formData);
    
    // Check if we're offline
    if (window.offlineSyncManager && window.offlineSyncManager.isOffline()) {
        // Save to sync queue
        window.offlineSyncManager.addToSyncQueue({
            type: 'form_submission',
            method: 'POST',
            url: url,
            data: data
        }).then(() => {
            // Show success message
            alert('Saved offline. Will sync when connection is restored.');
            // Optionally update UI optimistically
            updateUIOptimistically(data);
        });
        return;
    }
    
    // If online, submit normally
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        alert('Saved successfully!');
        updateUI(data);
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to save. Please try again.');
    });
}

// ============================================================================
// Example 2: Mark Item as Used (Toggle Status)
// ============================================================================

async function toggleItemStatus(itemId, currentStatus) {
    const newStatus = !currentStatus;
    const url = `/items/toggle_status/${itemId}`;
    
    try {
        // Try to update on server
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ is_used: newStatus })
        });
        
        if (response.ok) {
            // Success - update UI
            updateItemStatusUI(itemId, newStatus);
            showNotification('Item status updated!', 'success');
        }
    } catch (error) {
        // Network error - we're probably offline
        if (window.offlineSyncManager && window.offlineSyncManager.isOffline()) {
            // Queue for sync
            await window.offlineSyncManager.addToSyncQueue({
                type: 'toggle_status',
                method: 'POST',
                url: url,
                data: { is_used: newStatus, item_id: itemId }
            });
            
            // Update UI optimistically
            updateItemStatusUI(itemId, newStatus);
            showNotification('Status changed offline. Will sync when online.', 'info');
        } else {
            // Real error
            showNotification('Failed to update status. Please try again.', 'error');
        }
    }
}

// ============================================================================
// Example 3: Edit Item with Offline Support
// ============================================================================

async function saveItemChanges(itemId, formData) {
    const url = `/items/edit/${itemId}`;
    const data = Object.fromEntries(formData);
    
    // Check connection
    if (!navigator.onLine) {
        // Queue for sync
        await window.offlineSyncManager.addToSyncQueue({
            type: 'edit_item',
            method: 'POST',
            url: url,
            data: data
        });
        
        // Store in cache for immediate display
        await window.offlineSyncManager.cacheData(`item_${itemId}`, data);
        
        showNotification('Changes saved offline. Will sync when online.', 'info');
        return { success: true, offline: true };
    }
    
    // Online - submit normally
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification('Changes saved!', 'success');
            return { success: true, data: result };
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        showNotification('Failed to save changes. Please try again.', 'error');
        return { success: false, error: error.message };
    }
}

// ============================================================================
// Example 4: Load Item with Cache Fallback
// ============================================================================

async function loadItemWithCache(itemId) {
    const url = `/api/items/${itemId}`;
    
    try {
        // Try to fetch from server
        const response = await fetch(url);
        const data = await response.json();
        
        // Cache for offline use
        if (window.offlineSyncManager) {
            await window.offlineSyncManager.cacheData(`item_${itemId}`, data);
        }
        
        return data;
    } catch (error) {
        // Network error - try cache
        if (window.offlineSyncManager) {
            const cachedData = await window.offlineSyncManager.getCachedData(`item_${itemId}`);
            if (cachedData) {
                showNotification('Showing cached data (offline)', 'info');
                return cachedData;
            }
        }
        
        throw new Error('Item not available offline');
    }
}

// ============================================================================
// Example 5: Dashboard Data with Offline Support
// ============================================================================

async function loadDashboardData() {
    const url = '/api/get/stats';
    
    try {
        // Fetch from server
        const response = await fetch(url);
        const data = await response.json();
        
        // Cache for offline use
        if (window.offlineSyncManager) {
            await window.offlineSyncManager.cacheData('dashboard_stats', data);
        }
        
        updateDashboard(data);
        return data;
    } catch (error) {
        // Try to use cached data
        if (window.offlineSyncManager) {
            const cachedData = await window.offlineSyncManager.getCachedData('dashboard_stats');
            if (cachedData) {
                updateDashboard(cachedData);
                showNotification('Showing cached data (offline)', 'info');
                return cachedData;
            }
        }
        
        showNotification('Unable to load dashboard data', 'error');
        throw error;
    }
}

// ============================================================================
// Example 6: Batch Operations with Offline Queue
// ============================================================================

async function deleteMultipleItems(itemIds) {
    const results = [];
    
    for (const itemId of itemIds) {
        const url = `/items/delete/${itemId}`;
        
        if (!navigator.onLine) {
            // Queue deletion
            await window.offlineSyncManager.addToSyncQueue({
                type: 'delete_item',
                method: 'DELETE',
                url: url,
                data: { item_id: itemId }
            });
            
            results.push({ itemId, status: 'queued' });
        } else {
            try {
                await fetch(url, {
                    method: 'DELETE',
                    headers: { 'X-CSRFToken': getCSRFToken() }
                });
                results.push({ itemId, status: 'deleted' });
            } catch (error) {
                results.push({ itemId, status: 'failed', error: error.message });
            }
        }
    }
    
    return results;
}

// ============================================================================
// Example 7: Auto-Refresh on Reconnection
// ============================================================================

// Listen for network status changes
window.addEventListener('networkStatusChanged', (event) => {
    if (event.detail.isOnline) {
        console.log('Connection restored! Refreshing data...');
        
        // Refresh current page data
        if (typeof window.refreshData === 'function') {
            window.refreshData();
        } else {
            // Default: reload dashboard stats if on dashboard
            if (window.location.pathname.includes('dashboard')) {
                loadDashboardData();
            }
        }
    }
});

// ============================================================================
// Example 8: Form with Optimistic Updates
// ============================================================================

class OfflineForm {
    constructor(formElement) {
        this.form = formElement;
        this.url = formElement.action;
        this.setupListeners();
    }
    
    setupListeners() {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
    }
    
    async handleSubmit() {
        const formData = new FormData(this.form);
        const data = Object.fromEntries(formData);
        
        // Show loading state
        this.setLoadingState(true);
        
        try {
            if (navigator.onLine) {
                // Online submission
                const response = await fetch(this.url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    this.handleSuccess(await response.json());
                } else {
                    throw new Error('Server error');
                }
            } else {
                // Offline - queue for sync
                await window.offlineSyncManager.addToSyncQueue({
                    type: 'form_submission',
                    method: 'POST',
                    url: this.url,
                    data: data
                });
                
                this.handleOfflineSuccess(data);
            }
        } catch (error) {
            this.handleError(error);
        } finally {
            this.setLoadingState(false);
        }
    }
    
    setLoadingState(loading) {
        const submitButton = this.form.querySelector('[type="submit"]');
        if (submitButton) {
            submitButton.disabled = loading;
            submitButton.textContent = loading ? 'Saving...' : 'Save';
        }
    }
    
    handleSuccess(data) {
        showNotification('Saved successfully!', 'success');
        // Redirect or update UI
    }
    
    handleOfflineSuccess(data) {
        showNotification('Saved offline. Will sync when online.', 'info');
        // Update UI optimistically
    }
    
    handleError(error) {
        showNotification('Failed to save. Please try again.', 'error');
        console.error('Form error:', error);
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

function getCSRFToken() {
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

function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Use Bootstrap toast if available
    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        const toastContainer = document.getElementById('toast-container');
        if (toastContainer) {
            const bgClass = {
                'success': 'bg-success',
                'error': 'bg-danger',
                'warning': 'bg-warning',
                'info': 'bg-info'
            }[type] || 'bg-info';
            
            const toastEl = document.createElement('div');
            toastEl.className = `toast align-items-center text-white ${bgClass} border-0`;
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
            
            toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
        }
    }
}

function updateUIOptimistically(data) {
    // Update the UI immediately with the new data
    // This makes the app feel responsive even when offline
    console.log('Updating UI optimistically:', data);
}

function updateItemStatusUI(itemId, status) {
    // Update item status in the UI
    const element = document.querySelector(`[data-item-id="${itemId}"]`);
    if (element) {
        element.classList.toggle('used', status);
    }
}

function updateDashboard(data) {
    // Update dashboard with new data
    console.log('Updating dashboard:', data);
}

// ============================================================================
// Usage Examples
// ============================================================================

// Example: Initialize offline form
document.addEventListener('DOMContentLoaded', () => {
    const forms = document.querySelectorAll('.offline-enabled-form');
    forms.forEach(form => new OfflineForm(form));
});

// Example: Make existing button work offline
document.getElementById('markAsUsedBtn')?.addEventListener('click', async (e) => {
    const itemId = e.target.dataset.itemId;
    const currentStatus = e.target.dataset.isUsed === 'true';
    await toggleItemStatus(itemId, currentStatus);
});

// Example: Set up global refresh function
window.refreshData = async function() {
    // Refresh whatever data is on the current page
    if (window.location.pathname.includes('dashboard')) {
        await loadDashboardData();
    }
    // Add more conditions for other pages
};
