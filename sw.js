/* VERTFORM 2.0 service worker. Caches the app files only; it never touches saved records (those live in localStorage). */
const VERSION = '2.71.3';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'css/styles.css', 'css/career.css', 'css/premium.css', 'fonts/manrope-400.woff2', 'fonts/manrope-500.woff2', 'fonts/manrope-600.woff2', 'fonts/manrope-700.woff2', 'fonts/manrope-800.woff2',
  'js/config.js', 'js/util.js', 'js/foods-data.js', 'js/foods-more.js', 'js/programme.js', 'js/store.js', 'js/ui.js', 'js/nutrition.js', 'js/recipes.js', 'js/scanner.js', 'js/insights.js', 'js/board.js', 'js/mysessions.js', 'js/onboarding.js', 'js/friends.js', 'js/posts.js', 'css/light.css', 'css/nav2.css', 'css/premium2.css', 'js/partners.js', 'js/lifts.js', 'img/banners/spike.jpg', 'img/banners/set.jpg', 'img/banners/captain.jpg', 'img/banners/smile.jpg', 'img/banners/read.jpg', 'img/banners/focus.jpg', 'img/banners/serve.jpg', 'js/notify.js', 'js/photo.js', 'js/nav2.js', 'lib/barcode-detector.js', 'lib/zxing_reader.wasm', 'js/workout.js', 'js/library.js', 'js/calendar.js', 'js/metrics.js', 'js/jump.js', 'js/avatar.js', 'js/account.js', 'js/profile.js', 'js/views.js', 'js/home.js', 'js/matchfuel.js', 'js/motion.js', 'js/main.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' }))))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('vertform-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;   // product lookups and the scanner library go straight to the network
  if (req.mode === 'navigate' && req.destination !== 'iframe') { e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put('index.html', copy)); return r; }).catch(() => caches.match('index.html').then(r => r || caches.match('./')))); return; }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; })));
});

/* push notifications: friends posting, mentions, session reminders */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'VERTFORM', { body: d.body || '', tag: d.tag || 'vertform', icon: 'icon-192.png', badge: 'icon-192.png', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { for (const c of cs) { if ('focus' in c) return c.focus(); } return self.clients.openWindow(url); }));
});
