/* Offline storage and updates integrated into the original application. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  if (!window.AR || !window.THREE) {
    const message = document.createElement('p'); message.className = 'nota err';
    message.textContent = 'No se pudo cargar el visor. Revisá la conexión y recargá la página.';
    const retry = document.createElement('button'); retry.textContent = 'Recargar'; retry.onclick = () => location.reload();
    message.append(retry); document.body.prepend(message); return;
  }
  const base = new URL('./', location.href), params = new URLSearchParams(location.search);
  const cacheName = 'ar-modelos-' + encodeURIComponent(base.pathname);
  const legacyCache = 'expo-models-' + encodeURIComponent(base.pathname);
  const recordURL = new URL('_guardado/modelo.json', base).href;
  let sourceFiles = [], sourceUnits = 'mm', registration, busy = false;
  if (params.has('expo')) { params.delete('expo'); history.replaceState(history.state, '', location.pathname + (params.size ? '?' + params : '') + location.hash); }
  const options = $('btnDiag').closest('details');
  const box = document.createElement('div'); box.id = 'opcionesOffline';
  const style = $('btnDiag').className;
  function button(id, label, action) {
    const element = document.createElement('button'); element.id = id; element.type = 'button'; element.className = style;
    element.textContent = label; element.onclick = action; box.append(element); return element;
  }
  const save = button('btnGuardarOffline', 'Guardar modelo sin conexión', guardar);
  const restore = button('btnRestaurarOffline', 'Abrir último modelo guardado', restaurar);
  const update = button('btnActualizarApp', 'Actualizar aplicación', actualizar); update.classList.add('oculto');
  const state = document.createElement('p'); state.id = 'estadoOffline'; state.className = 'nota'; state.setAttribute('role','status'); state.setAttribute('aria-live','polite'); box.append(state);
  options.append(box);
  function message(text, error = false) { state.textContent = text; state.className = 'nota' + (error ? ' err' : ''); }
  function active() { return !!(busy || AR.S._cargando || AR.S._iniciando || AR.S.session || AR.S.modo3D || AR.S.renderer); }
  function controls() { save.disabled = busy || !sourceFiles.length; restore.disabled = busy; update.disabled = busy; }
  function received(files, units) { sourceFiles = Array.from(files); sourceUnits = units || $('selUnid').value || 'mm'; controls(); }
  window.addEventListener('ar:model-loaded', event => {
    received(event.detail?.raw ? [new File([JSON.stringify(event.detail.raw)], 'trazado.json', {type:'application/json'})] : [], $('selUnid').value);
  });
  window.addEventListener('ar:files-loaded', event => {
    const files = Array.from(event.detail.files);
    received(files.every(f => /\.mtl$/i.test(f.name)) ? sourceFiles.filter(f => !/\.mtl$/i.test(f.name)).concat(files) : files, event.detail.units);
  });
  window.addEventListener('ar:graphics-status', event => AR.UI.estado(event.detail.message, event.detail.lost ? 'err' : 'ok'));
  async function workerMessage(type) {
    if (!registration?.active) throw new Error('Esperá a que termine la descarga inicial de la aplicación y reintentá.');
    return new Promise((resolve,reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); reject(new Error('No se pudo verificar el guardado. Revisá conexión y espacio disponible.')); }, 30000);
      channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
      registration.active.postMessage({type}, [channel.port2]);
    });
  }
  async function guardar() {
    if (active()) { message('Cerrá el visor antes de guardar el modelo.'); return; }
    if (!sourceFiles.length) { message('Primero abrí un modelo o el ejemplo.'); return; }
    busy = true; controls(); message('Guardando aplicación y modelo en este equipo…');
    const savedModel = AR.S.trazado, files = sourceFiles.slice(), units = sourceUnits;
    let cache, written = [], committed = false;
    try {
      const status = await workerMessage('AR_PREPARE');
      if (!status.ready) throw new Error('Faltan archivos de la aplicación. Revisá la conexión y reintentá.');
      cache = await caches.open(cacheName);
      const batch = crypto.randomUUID(), metadata = [];
      for (let i=0; i<files.length; i++) {
        const url = new URL('_guardado/' + batch + '/' + i, base).href;
        await cache.put(url, new Response(files[i])); written.push(url);
        metadata.push({url, name:files[i].name});
      }
      if (AR.S.trazado !== savedModel) throw new Error('El modelo cambió durante el guardado. Guardá nuevamente el modelo que querés conservar.');
      await cache.put(recordURL, new Response(JSON.stringify({files:metadata, units, obra:savedModel.obra})));
      committed = true;
      try { for (const key of await cache.keys()) if (key.url !== recordURL && !written.includes(key.url)) await cache.delete(key); } catch (_) {}
      try { await navigator.storage?.persist?.(); } catch (_) {}
      message('Aplicación y modelo guardados en este equipo. Para recuperarlo sin conexión, elegí “Abrir último modelo guardado”.');
    } catch (error) {
      if (cache && !committed) await Promise.all(written.map(url => cache.delete(url))).catch(() => {});
      message(error.message, true);
    } finally { busy=false; controls(); }
  }
  async function restaurar() {
    if (active()) { message('Cerrá el visor antes de abrir el modelo guardado.'); return; }
    busy=true; controls(); message('Abriendo modelo guardado…');
    try {
      let cache = await caches.open(cacheName), response = await cache.match(recordURL), legacy = false;
      if (!response) { cache = await caches.open(legacyCache); response = await cache.match(new URL('_expo/local.json',base).href); legacy=true; }
      if (!response) throw new Error('Todavía no hay un modelo guardado en este navegador.');
      const record = await response.json(), files = [];
      if (!Array.isArray(record.files) || !record.files.length || record.files.length > 20) throw new Error('El guardado está incompleto. Abrí el archivo original.');
      for (const entry of record.files) {
        const url = new URL(entry.url,base);
        if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error('Ruta de guardado inválida.');
        const response = await cache.match(url.href);
        if (!response) throw new Error('Falta un archivo guardado. Abrí el modelo original.');
        files.push(new File([await response.blob()],entry.name));
      }
      const units = legacy ? record.item?.units : record.units;
      if (!['mm','cm','m'].includes(units)) throw new Error('El guardado no indica unidades válidas.');
      $('selUnid').value = units;
      if (!(await AR.cargarArchivos(files))) throw new Error('No se pudo abrir el modelo guardado. Revisá el archivo original.');
      message('Modelo recuperado. Usá los botones habituales para verlo en 3D o AR.');
    } catch (error) { message(error.message,true); }
    finally { busy=false; controls(); }
  }
  function actualizar() {
    if (active()) { message('Terminá la visualización antes de actualizar.'); return; }
    if (registration?.waiting) registration.waiting.postMessage({type:'AR_ACTIVATE_UPDATE'});
    else location.reload();
  }
  async function prepareApp() {
    if (!isSecureContext || !('serviceWorker' in navigator)) { message('El uso sin conexión requiere HTTPS o el servidor local de esta computadora.'); return; }
    try {
      registration = await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'});
      const waiting = () => {
        if (registration.waiting) { update.classList.remove('oculto'); message('Hay una actualización disponible. Aplicala cuando termines de usar el visor.'); }
      };
      waiting(); registration.addEventListener('updatefound',() => registration.installing?.addEventListener('statechange',waiting));
      let applying = false;
      update.addEventListener('click',() => { applying = !active() && !!registration.waiting; });
      navigator.serviceWorker.addEventListener('controllerchange',() => {
        if (applying && !active()) location.reload();
        else if (!registration.waiting) { message('Aplicación disponible sin conexión. Guardá también el modelo que quieras recuperar.'); }
      });
      if (registration.active) {
        const status = await workerMessage('AR_STATUS');
        message(status.ready ? 'Aplicación disponible sin conexión. Podés guardar el modelo en este equipo.' : 'Descargando los recursos de la aplicación…');
      }
    } catch (_) { message('No se pudo preparar el uso sin conexión. Revisá la conexión y los permisos del navegador.',true); }
  }
  // Existing model links continue to open within the original interface.
  async function openLink() {
    if (params.get('stand') === '1') { await restaurar(); return; }
    if (!params.has('modelo') || location.hash.startsWith('#compartido')) return;
    busy=true; controls(); AR.UI.estado('Abriendo modelo del enlace…');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(),30000);
    try {
      const configResponse = await fetch(new URL('modelos.json',base),{signal:controller.signal});
      if (!configResponse.ok) throw new Error('No se pudo descargar la lista de modelos.');
      const config = await configResponse.json(), item = config.models?.find(m => m.id === params.get('modelo'));
      if (!item) throw new Error('El modelo de este enlace no está disponible. Podés abrir tu archivo desde la pantalla de carga.');
      const cache = await caches.open(cacheName), legacy = await caches.open(legacyCache), files=[];
      for (const [path, hash] of [[item.file,item.sha256],[item.mtl,item.mtlSha256]].filter(([path])=>path)) {
        const url = new URL(path,base);
        if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || url.search || url.hash || !/^[a-f0-9]{64}$/.test(hash||'')) throw new Error('El enlace contiene un archivo inválido.');
        const key = new URL(url); key.searchParams.set('expo-sha',hash);
        let response = await cache.match(key.href) || await legacy.match(key.href);
        if (!response) response = await fetch(url.href,{signal:controller.signal});
        if (!response.ok || Number(response.headers.get('Content-Length'))>150*1024*1024) throw new Error('Archivo no disponible o demasiado grande.');
        const bytes = await response.arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength>150*1024*1024) throw new Error('El modelo está vacío o es demasiado grande.');
        const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
        if (actual!==hash) throw new Error('El modelo no coincide con la versión publicada. Actualizá la aplicación y reintentá.');
        files.push(new File([bytes],decodeURIComponent(url.pathname.split('/').pop())));
      }
      if (!['mm','cm','m'].includes(item.units || 'mm')) throw new Error('El enlace contiene unidades inválidas.');
      $('selUnid').value=item.units || 'mm';
      if (!(await AR.cargarArchivos(files))) throw new Error('No se pudo abrir el modelo del enlace.');
    } catch (error) { AR.UI.estado(error.name==='AbortError' ? 'La descarga tardó demasiado. Revisá la conexión y reintentá.' : error.message,'err'); }
    finally { clearTimeout(timer); busy=false; controls(); }
  }
  controls(); prepareApp(); openLink();
})();
