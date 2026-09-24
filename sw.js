/* Uso sin conexión: una versión completa por aplicación y carpeta.
   Actualizaciones esperan al cierre de la sesión o EXPO_ACTIVATE_UPDATE.
   Los modelos del visitante se guardan aparte y nunca se borran aquí. */
'use strict';

const APP_NAME = 'ms-ar';
const VERSION = 'ar-6c94c57b869a';
const SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = APP_NAME + '-shell-' + encodeURIComponent(SCOPE.pathname) + '-';
const CACHE = CACHE_PREFIX + VERSION;
const ASSETS = [
  "./index.html",
  "./ar-core.js",
  "./three.min.js",
  "./qrcode.js",
  "./ar-app.js",
  "./ms-anchor-ui.js",
  "./ms-native.js",
  "./ms-visual.js",
  "./ms-anchor.css",
  "./ms-library.js",
  "./ms-library.css",
  "./ms-flow.js",
  "./vendor/jsfeat.js",
  "./ms-tracking.js",
  "./ms-paper.js",
  "./ms-paper.css",
  "./ms-stability.js",
  "./qr-worker.js",
  "./vendor/jsQR.js",
  "./vendor/svd.js",
  "./vendor/posit1.js",
  "./modelos.json",
  "./examples/demo.json",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./img/logo_dark.png",
  "./img/ondas.svg",
  "./fonts/SpaceGrotesk-Medium.ttf",
  "./fonts/SpaceGrotesk-SemiBold.ttf",
  "./fonts/SpaceGrotesk-Bold.ttf",
  "./fonts/ClashGrotesk-Regular.woff2",
  "./fonts/ClashGrotesk-Medium.woff2",
  "./fonts/ClashGrotesk-Semibold.woff2"
];
const SHELL_URLS = ASSETS.map(path => new URL(path, SCOPE).href);
const SHELL = new Set(SHELL_URLS);
const INDEX_URL = new URL('./index.html', SCOPE).href;
const SHARE_URL = new URL('./recibir', SCOPE).href;
const SHARED_CACHE = 'ar-compartido';
const MAX_SHARED_BYTES = 150 * 1024 * 1024;
const MAX_SHARED_FILES = 20;

function withinScope(url) {
  return url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname);
}

function validAsset(response, url) {
  if (!response || !response.ok || response.status !== 200) return false;
  const type = response.headers.get('Content-Type') || '';
  // Servidores estáticos a veces devuelven index.html con estado 200 ante un 404.
  return /\.html$/.test(new URL(url).pathname) || !/text\/html/i.test(type);
}

async function fetchAsset(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { cache: 'reload', signal: controller.signal });
    if (!validAsset(response, url)) throw new Error('Recurso no disponible: ' + new URL(url).pathname);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function prepareShell() {
  const cache = await caches.open(CACHE);
  // La instalación falla si falta un recurso: el worker anterior sigue operativo.
  // Primero descarga y valida el lote completo; luego escribe con reversión.
  const requests = SHELL_URLS.map(url => new Request(url, { cache: 'reload' }));
  // Se verifican también los tipos para no guardar HTML como JavaScript.
  const responses = await Promise.all(SHELL_URLS.map(fetchAsset));
  const previous = await Promise.all(requests.map(request => cache.match(request)));
  const written = [];
  try {
    for (let i = 0; i < requests.length; i++) {
      await cache.put(requests[i], responses[i]);
      written.push(i);
    }
  } catch (error) {
    // Mantiene una preparación previa si se agota la cuota en la nueva.
    await Promise.all(written.map(i => previous[i]
      ? cache.put(requests[i], previous[i])
      : cache.delete(requests[i]))).catch(() => {});
    throw error;
  }
}

async function shellStatus(error) {
  const result = { ready: false, version: VERSION, missing: [] };
  try {
    const cache = await caches.open(CACHE);
    const present = await Promise.all(SHELL_URLS.map(async url => validAsset(await cache.match(url), url)));
    result.missing = ASSETS.filter((_, index) => !present[index]);
    result.ready = result.missing.length === 0;
  } catch (failure) {
    result.missing = ASSETS.slice();
    result.error = 'El navegador no permite guardar el modo sin conexión.';
  }
  if (error) result.error = 'No se pudo completar la descarga. Revisá la conexión y el espacio disponible.';
  return result;
}

self.addEventListener('install', event => {
  event.waitUntil(prepareShell().then(() => {
    if (!self.registration.active) return self.skipWaiting();
  }));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Borra únicamente versiones del shell de ESTA app en ESTA carpeta.
    // Conserva ar-compartido, expo-models-* y las cachés de las otras apps.
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

let preparing;
self.addEventListener('message', event => {
  if (event.source && event.source.url && !withinScope(new URL(event.source.url))) return;
  const type = String(event.data && event.data.type || '').replace(/^AR_/, 'EXPO_');
  if (type === 'EXPO_ACTIVATE_UPDATE') {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (type !== 'EXPO_STATUS' && type !== 'EXPO_PREPARE') return;
  event.waitUntil((async () => {
    let error = false;
    if (type === 'EXPO_PREPARE') {
      const status = await shellStatus();
      if (!status.ready) {
        if (!preparing) preparing = prepareShell().finally(() => { preparing = null; });
        try { await preparing; } catch (_) { error = true; }
      }
    }
    const status = await shellStatus(error);
    if (event.ports && event.ports[0]) event.ports[0].postMessage(status);
    else if (event.source && event.source.postMessage) event.source.postMessage({ type: 'EXPO_STATUS', ...status });
  })());
});

async function receiveSharedFiles(request) {
  const written = [];
  let cache;
  const batch = Date.now().toString(36) + '-' + Array.from(crypto.getRandomValues(new Uint32Array(2)), value => value.toString(36)).join('');
  try {
    const form = await request.formData();
    const files = form.getAll('modelo').filter(file => file && typeof file.name === 'string' && file.name);
    if (!files.length || files.length > MAX_SHARED_FILES) throw new Error('Cantidad de archivos no válida');
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (!Number.isFinite(total) || total <= 0 || total > MAX_SHARED_BYTES) throw new Error('Archivo demasiado grande');
    if (files.some(file => !/\.(obj|stl|json|mtl)$/i.test(file.name) || !file.size)) {
      throw new Error('Formato no admitido');
    }
    if (files.filter(file => /\.(obj|stl|json)$/i.test(file.name)).length > 1) {
      throw new Error('Compartí un modelo por vez, con sus materiales MTL');
    }
    cache = await caches.open(SHARED_CACHE);
    for (let i = 0; i < files.length; i++) {
      const key = new URL('./_compartido_' + batch + '_' + i, SCOPE).href;
      await cache.put(key, new Response(files[i], {
        headers: {
          'Content-Type': files[i].type || 'application/octet-stream',
          'X-Nombre': encodeURIComponent(files[i].name)
        }
      }));
      written.push(key);
    }
    return Response.redirect(INDEX_URL + '#compartido=' + batch, 303);
  } catch (_) {
    if (cache) await Promise.all(written.map(key => cache.delete(key))).catch(() => {});
    return Response.redirect(INDEX_URL + '#compartido-error', 303);
  }
}

async function shellResponse(url) {
  let cache;
  try {
    cache = await caches.open(CACHE);
    const cached = await cache.match(url);
    if (validAsset(cached, url)) return cached;
  } catch (_) {}
  try {
    const response = await fetchAsset(url);
    if (cache) {
      try { await cache.put(url, response.clone()); } catch (_) {}
    }
    return response;
  } catch (_) {
    // Nunca devolver HTML en lugar de un JS, imagen o modelo.
    return new Response('Recurso no disponible sin conexión. Abrí la app con conexión y prepará el modo sin conexión.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (!withinScope(url)) return;
  const canonical = new URL(url.href);
  canonical.search = '';
  canonical.hash = '';
  if (request.method === 'POST' && canonical.href === SHARE_URL) {
    event.respondWith(receiveSharedFiles(request));
    return;
  }
  if (request.method !== 'GET' || request.headers.has('range')) return;
  if (url.pathname === SCOPE.pathname || canonical.href === INDEX_URL) {
    event.respondWith(shellResponse(INDEX_URL));
    return;
  }
  if (SHELL.has(canonical.href)) event.respondWith(shellResponse(canonical.href));
  // Solicitudes ajenas al shell conservan la respuesta de red y su código HTTP.
});
