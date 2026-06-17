// Service Worker - 只缓存静态页面，不拦截API
const CACHE_NAME = 'wc-predict-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // 不拦截API请求
  if (event.request.url.includes('/api/')) return;

  // 静态资源：网络优先
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
