/* Planet · Service Worker
 * 策略：HTML 用 network-first（总拿最新）；静态资源 cache-first（图标/manifest）
 * 版本号改了之后，旧缓存会被自动清理
 */
const VERSION = 'planet-v3-20260910';
const STATIC_CACHE = 'planet-static-' + VERSION;
const HTML_CACHE = 'planet-html-' + VERSION;
const STATIC_FILES = [
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-1024.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_FILES).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== STATIC_CACHE && k !== HTML_CACHE)
        .map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;

  /* GitHub API 不走缓存（同步用） */
  if (url.includes('api.github.com')) return;

  const isHTML = e.request.mode === 'navigate' ||
                 url.endsWith('/') ||
                 url.endsWith('.html') ||
                 url.endsWith('/index.html');

  if (isHTML) {
    /* network-first：服务器优先，拿到了更新缓存并返回 */
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          const copy = resp.clone();
          caches.open(HTML_CACHE).then(c => c.put(e.request, copy));
          return resp;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
    );
  } else {
    /* cache-first：静态资源先看缓存 */
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(STATIC_CACHE).then(c => c.put(e.request, copy));
          }
          return resp;
        }).catch(() => cached);
      })
    );
  }
});