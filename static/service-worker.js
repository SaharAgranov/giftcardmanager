const CACHE_NAME = "giftcards-cache-v1";
const urlsToCache = [
  "/",
  "/dashboard",
  "/static/css/style.css",
  "/static/js/dashboard.js"
];

// Install
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Fetch
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
