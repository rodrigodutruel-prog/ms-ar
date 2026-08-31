/* Service worker de AR Conductería MS — cachea todo para uso offline en planta */
const CACHE = 'ar-ductos-v4';
const ASSETS = ['./', './index.html', './manifest.json', './trazado_demo.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  // el HTML va red-primero: así las correcciones llegan al celu apenas hay señal,
  // y sin señal sigue sirviendo la copia cacheada
  const esPagina = e.request.mode === 'navigate' || e.request.url.endsWith('/index.html');
  if(esPagina){
    e.respondWith(
      // no-cache: revalida SIEMPRE contra el servidor (GitHub Pages manda
      // max-age=600 y el celu quedaba pegado 10 min a la versión vieja)
      fetch(e.request, { cache: 'no-cache' }).then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return resp;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      const copia = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
      return resp;
    }).catch(() => caches.match('./index.html')))
  );
});
