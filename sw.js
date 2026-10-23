// French Classroom PWA: cache the app shell, fetch updated lessons first.
const CACHE_NAME = 'mon-francais-shell-v18';
const CORE = ['./', './index.html', './foundations.js', './teacher-dashboard.js', './teacher-dashboard.css', './classroom-polish.css', './app-mobile.css', './assets/french-student.svg', './assets/paris-sky.svg', './config.json', './weeks/week1.json', './weeks/week2.json', './listening.json', './stories.json', './announcements.json', './audio/manifest.json', './firebase-auth.js', './firebase-config.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
    await Promise.allSettled(CORE.map(url => cache.add(url)));
    // Activate the updated shell promptly so stale CSS cannot persist after publishing.
    await self.skipWaiting();
  }));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))), self.clients.claim()]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request, {ignoreSearch: request.mode === 'navigate' || (url.pathname.endsWith('/classroom-polish.css') || url.pathname.endsWith('/app-mobile.css'))});
      if (cached) return cached;
      if (request.mode === 'navigate') return (await caches.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});
