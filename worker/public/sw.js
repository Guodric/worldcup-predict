// Service Worker - 只缓存静态页面，不拦截API
const CACHE_NAME = 'wc-predict-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // 不拦截API请求
  if (event.request.url.includes('/api/')) return;

  // 静态资源：网络优先
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
