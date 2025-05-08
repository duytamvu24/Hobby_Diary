// service-worker.js

const CACHE_NAME = 'hobby-diary-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/images/diary.jpg',
  '/manifest.json'
];

// Installationsereignis: Ressourcen cachen
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Abrufereignis: Aus dem Cache antworten
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache-Hit: Rückgabe der gecachten Antwort
        if (response) {
          return response;
        }
        // Cache-Miss: Netzwerkabruf
        return fetch(event.request);
      })
  );
});

// Aktivierungsereignis: Alte Caches löschen
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
