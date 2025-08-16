/**
 * Drive Nest - Service Worker
 * Handles caching, offline functionality, and background sync
 */

const CACHE_NAME = 'drive-nest-v1.0.0';
const STATIC_CACHE_NAME = 'drive-nest-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'drive-nest-dynamic-v1.0.0';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles/base.css',
  '/styles/theme.css',
  '/styles/components.css',
  '/styles/preview.css',
  '/scripts/app.js',
  '/scripts/auth.js',
  '/scripts/storage.js',
  '/scripts/firestore.js',
  '/scripts/upload.js',
  '/scripts/ui/modals.js',
  '/scripts/ui/keyboard.js',
  '/scripts/preview/index.js',
  '/scripts/preview/pdf.js',
  '/scripts/preview/docx.js',
  '/manifest.json'
];

// Files that should bypass cache
const BYPASS_CACHE = [
  '/scripts/firebase-config.js' // Contains sensitive config
];

// Maximum cache sizes
const MAX_DYNAMIC_CACHE_SIZE = 50;
const MAX_IMAGE_CACHE_SIZE = 20;

/**
 * Service Worker Installation
 */
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

/**
 * Service Worker Activation
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName.startsWith('drive-nest-')) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

/**
 * Fetch Event Handler
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Skip Firebase requests (let Firebase handle caching)
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    return;
  }
  
  // Skip files that should bypass cache
  if (BYPASS_CACHE.some(path => url.pathname.includes(path))) {
    return;
  }
  
  event.respondWith(handleRequest(request));
});

/**
 * Handle network requests with caching strategy
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Static assets: Cache first, then network
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname === '/') {
    return cacheFirst(request, STATIC_CACHE_NAME);
  }
  
  // Images: Cache first with size limit
  if (request.destination === 'image' || 
      /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname)) {
    return cacheFirstWithLimit(request, DYNAMIC_CACHE_NAME, MAX_IMAGE_CACHE_SIZE);
  }
  
  // External libraries (PDF.js, etc.): Cache first
  if (url.hostname === 'unpkg.com' || 
      url.hostname === 'cdnjs.cloudflare.com' ||
      url.hostname === 'cdn.jsdelivr.net') {
    return cacheFirst(request, DYNAMIC_CACHE_NAME);
  }
  
  // Other requests: Network first, cache fallback
  return networkFirst(request, DYNAMIC_CACHE_NAME);
}

/**
 * Cache first strategy
 */
async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Update cache in background
      fetch(request).then(response => {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
      }).catch(() => {}); // Ignore network errors
      
      return cachedResponse;
    }
    
    // Not in cache, fetch from network
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('Cache first strategy failed:', error);
    
    // Fallback for offline scenarios
    if (request.url.includes('.html') || request.url === self.location.origin + '/') {
      const cache = await caches.open(STATIC_CACHE_NAME);
      return cache.match('/index.html') || new Response('Offline', { status: 503 });
    }
    
    return new Response('Network Error', { 
      status: 503,
      statusText: 'Service Unavailable' 
    });
  }
}

/**
 * Network first strategy
 */
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      
      // Clean up cache if it gets too large
      cleanupCache(cache, MAX_DYNAMIC_CACHE_SIZE);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('Network failed, trying cache:', request.url);
    
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Ultimate fallback
    if (request.url.includes('.html') || request.url === self.location.origin + '/') {
      const staticCache = await caches.open(STATIC_CACHE_NAME);
      return staticCache.match('/index.html') || new Response('Offline', { status: 503 });
    }
    
    return new Response('Not Found', { 
      status: 404,
      statusText: 'Not Found' 
    });
  }
}

/**
 * Cache first with size limit
 */
async function cacheFirstWithLimit(request, cacheName, maxSize) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
      cleanupCache(cache, maxSize);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('Cache first with limit failed:', error);
    return new Response('Network Error', { status: 503 });
  }
}

/**
 * Clean up cache when it exceeds maximum size
 */
async function cleanupCache(cache, maxSize) {
  try {
    const keys = await cache.keys();
    if (keys.length > maxSize) {
      // Remove oldest entries
      const keysToDelete = keys.slice(0, keys.length - maxSize);
      await Promise.all(keysToDelete.map(key => cache.delete(key)));
      console.log(`Cache cleaned up: removed ${keysToDelete.length} entries`);
    }
  } catch (error) {
    console.error('Cache cleanup failed:', error);
  }
}

/**
 * Background Sync for failed uploads
 */
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'upload-retry') {
    event.waitUntil(retryFailedUploads());
  }
});

/**
 * Retry failed uploads when back online
 */
async function retryFailedUploads() {
  try {
    // Get failed uploads from IndexedDB or localStorage
    const failedUploads = JSON.parse(localStorage.getItem('failedUploads') || '[]');
    
    if (failedUploads.length === 0) return;
    
    console.log(`Retrying ${failedUploads.length} failed uploads`);
    
    // Notify main app about retry attempt
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'UPLOAD_RETRY',
        uploads: failedUploads
      });
    });
    
  } catch (error) {
    console.error('Failed to retry uploads:', error);
  }
}

/**
 * Handle messages from main app
 */
self.addEventListener('message', (event) => {
  const { data } = event;
  
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_FILE':
      cacheFile(data.url, data.cacheName || DYNAMIC_CACHE_NAME);
      break;
      
    case 'CLEAR_CACHE':
      clearCache(data.cacheName);
      break;
      
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0]?.postMessage(status);
      });
      break;
  }
});

/**
 * Cache a specific file
 */
async function cacheFile(url, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    await cache.add(url);
    console.log('File cached:', url);
  } catch (error) {
    console.error('Failed to cache file:', error);
  }
}

/**
 * Clear specific cache
 */
async function clearCache(cacheName) {
  try {
    await caches.delete(cacheName);
    console.log('Cache cleared:', cacheName);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

/**
 * Get cache status information
 */
async function getCacheStatus() {
  try {
    const cacheNames = await caches.keys();
    const status = {};
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      status[cacheName] = {
        size: keys.length,
        keys: keys.map(key => key.url)
      };
    }
    
    return status;
  } catch (error) {
    console.error('Failed to get cache status:', error);
    return {};
  }
}

/**
 * Handle push notifications (future feature)
 */
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  // Future implementation for push notifications
  // e.g., file sharing notifications, sync status updates
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  event.waitUntil(
    self.clients.openWindow('/')
  );
});

/**
 * Periodic background sync (future feature)
 */
self.addEventListener('periodicsync', (event) => {
  console.log('Periodic sync triggered:', event.tag);
  
  if (event.tag === 'file-sync') {
    event.waitUntil(syncFiles());
  }
});

/**
 * Sync files in background
 */
async function syncFiles() {
  try {
    console.log('Background file sync started');
    
    // Future implementation for background file synchronization
    // This could include checking for file changes, uploading queued files, etc.
    
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

console.log('Service Worker: Loaded and ready');
