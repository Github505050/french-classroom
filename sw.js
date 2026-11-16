// French Classroom PWA: cache the app shell, fetch updated lessons first.
const CACHE_NAME = 'mon-francais-shell-v42';
const CORE = ['./', './index.html', './foundations.js', './teacher-dashboard.js', './teacher-test-submissions.js', './classroom-tests.js', './classroom-results.js', './classroom-notifications.js', './classroom-notifications.css', './teacher-announcements.js', './classroom-results.css', './test-uploads.js', './tests.json', './supabase-config.json', './teacher-dashboard.css', './classroom-polish.css', './app-mobile.css', './vocabulary-library.css', './assets/french-student.svg', './assets/paris-sky.svg', './config.json', './weeks/week1.json', './weeks/week2.json', './weeks/week3.json', './weeks/week4.json', './weeks/week5.json', './listening.json', './stories.json', './announcements.json', './audio/manifest.json', './firebase-auth.js', './firebase-config.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
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
      const cached = await caches.match(request, {ignoreSearch: request.mode === 'navigate' || (url.pathname.endsWith('/classroom-polish.css') || url.pathname.endsWith('/app-mobile.css') || url.pathname.endsWith('/vocabulary-library.css'))});
      if (cached) return cached;
      if (request.mode === 'navigate') return (await caches.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});

/* Phone push: a real visible notification, not silent background processing. */
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let msg={};
  try{msg=event.data?event.data.json():{}}catch{msg={}}
  const allowed=['home','tests','myresults'];
  const section=allowed.includes(msg.destination)?msg.destination:'home';
  const notice=String(msg.tag||'').slice(0,140);
  const url=new URL('./?notice='+encodeURIComponent(notice)+'#classroom=section='+section,self.registration.scope).href;
  const title=String(msg.title||'Mon Espace Français').slice(0,110);
  const body=String(msg.body||'You have a new classroom update.').slice(0,200);
  await self.registration.showNotification(title,{
   body,icon:new URL('./icons/icon-192.png',self.registration.scope).href,
   badge:new URL('./icons/icon-192.png',self.registration.scope).href,
   tag:String(msg.tag||'classroom-update').slice(0,140),
   renotify:true, silent:false, vibrate:[160,80,160],
   data:{url},timestamp:Date.now()
  });
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of clients)client.postMessage({type:'classroom-push-received'});
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const target=event.notification.data?.url||new URL('./',self.registration.scope).href;
  const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const page=list.find(c=>c.url.startsWith(self.registration.scope))||list[0];
  if(page){try{await page.navigate(target)}catch{}await page.focus();return}
  await self.clients.openWindow(target);
 })());
});
