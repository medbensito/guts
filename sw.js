// Guts : service worker. Garde l'app disponible hors ligne et affiche les rappels.
// Réseau d'abord : en ligne, on reçoit toujours la dernière version ; hors ligne, la copie en cache prend le relais.
// À chaque nouvelle version de l'app, changer le nom du cache ci-dessous.
const CACHE = 'guts-cal-23';
const FICHIERS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/icone-maskable-512.png',
  './icones/apple-touch-icon.png',
  './icones/favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(cles => Promise.all(cles.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then(rep => {
        if (rep.ok) {
          const copie = rep.clone();
          caches.open(CACHE).then(c => c.put(req, copie));
        }
        return rep;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});

// Rappels : le service envoie { titre, corps, tag }. iOS exige qu'une notification soit toujours affichée.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { corps: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titre || 'Guts', {
    body: d.corps || '',
    tag: d.tag || undefined,
    icon: 'icones/icone-192.png',
    badge: 'icones/icone-192.png',
    data: { url: './' }
  }));
});

// Toucher la notification : ouvre Guts (ou le ramène devant)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(liste => {
    const ouvert = liste.find(c => 'focus' in c);
    return ouvert ? ouvert.focus() : self.clients.openWindow((e.notification.data && e.notification.data.url) || './');
  }));
});
