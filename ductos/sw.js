/* Retira solamente el registro de la antigua app de conductos.
   CacheStorage pertenece al origen completo: nunca borrar otras apps ni modelos. */
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil(self.registration.unregister());
});
