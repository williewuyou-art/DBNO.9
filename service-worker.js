const CACHE_NAME = "dbno9-v1";
// 基本 PWA Service Worker：啟用安裝能力與版本更新控制；此版不提供離線快取。
self.addEventListener("install", event => self.skipWaiting());
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
