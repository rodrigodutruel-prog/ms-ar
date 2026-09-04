/* Service worker de MS AR — cachea todo para uso offline en obra.
   HTML y ar-core.js van RED-PRIMERO (no-cache): las correcciones llegan al
   celu apenas hay señal; sin señal se sirve la copia cacheada. */
const CACHE = 'ms-ar-v55';
const ASSETS = ["./", "./index.html", "./ar-core.js", "./three.min.js", "./manifest.json", "./icon-192.png", "./icon-512.png", "./img/logo_dark.png", "./img/ondas.svg", "./fonts/SpaceGrotesk-Medium.ttf", "./fonts/SpaceGrotesk-SemiBold.ttf", "./fonts/SpaceGrotesk-Bold.ttf", "./fonts/ClashGrotesk-Regular.woff2", "./fonts/ClashGrotesk-Medium.woff2", "./fonts/ClashGrotesk-Semibold.woff2"];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'ar-compartido').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // ARCHIVO COMPARTIDO (share target): WhatsApp/Archivos manda el OBJ/JSON por
  // POST; lo guardamos y redirigimos a la app, que lo levanta con #compartido.
  if(e.request.method === 'POST' && url.pathname.endsWith('/recibir')){
    e.respondWith((async () => {
      try{
        const fd = await e.request.formData();
        const fs = fd.getAll('modelo').filter(f => f && f.name);
        const cache = await caches.open('ar-compartido');
        for(const k of await cache.keys()) await cache.delete(k);
        for(let i = 0; i < fs.length; i++){
          await cache.put('./_compartido_' + i, new Response(fs[i], {
            headers: { 'X-Nombre': encodeURIComponent(fs[i].name || 'modelo.obj') }
          }));
        }
      }catch(err){}
      return Response.redirect('./index.html#compartido', 303);
    })());
    return;
  }

  if(e.request.method !== 'GET') return;
  const esPagina = e.request.mode === 'navigate' || /\/(index\.html|ar-core\.js)$/.test(url.pathname);
  if(esPagina){
    e.respondWith(
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
