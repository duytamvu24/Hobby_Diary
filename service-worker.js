// service-worker.js

const CACHE_NAME = 'hobby-diary-v1';
const urlsToCache = [
  './',
  './index.html',
  './calender_view.css',
  './create_post.css',
  './menu.css',
  './post_feed.css',
  './settings.css',
  './statistics.css',
  './hobby_diary.js',
  './post.js',
  './images/diary.jpg',
  './images/back.png',
  './images/bulb.jpg',
  './images/calen.webp',
  './images/calender_icon.jpg',
  './images/delete.png',
  './images/edit.png',
  './images/settings.png',
  './manifest.json'
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
