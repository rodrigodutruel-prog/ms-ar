/* Public exhibition entry point. Local assets, explicit offline preparation. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  if (!window.AR || !window.THREE) {
    const fatal = document.createElement('div'); fatal.id = 'expoFatal';
    fatal.textContent = 'No se pudo cargar el visor. Revisá la conexión y volvé a intentar. ';
    const retry = document.createElement('button'); retry.textContent = 'Volver a cargar'; retry.onclick = () => location.reload();
    fatal.append(retry); document.body.append(fatal); return;
  }
  const base = new URL('./', location.href), params = new URLSearchParams(location.search);
  const visitor = params.get('expo') === '1';
  const cacheName = 'expo-models-' + encodeURIComponent(base.pathname);
  const localMetaURL = new URL('_expo/local.json', base).href;
  const MAX_BYTES = 150 * 1024 * 1024;
  let catalog = [], current = null, localFiles = null, loadId = 0, busy = false, registration, loadingOwn = false;
  let offlineReady = false, localSaved = false;
  document.body.classList.toggle('expo-visitor', visitor);
  const panel = document.createElement('section'); panel.id = 'expoPanel';
  panel.setAttribute('aria-label', 'Visualización para la exposición');
  panel.innerHTML = `
    <div class="expo-eyebrow" id="expoBrand"></div>
    <h1>Explorá el diseño.<br>Descubrí cada detalle.</h1>
    <p>Giralo, acercate y miralo desde todos los ángulos. En equipos compatibles, también podés colocarlo en tu espacio.</p>
    <div class="expo-badges"><span class="expo-badge" id="expoConnection"></span><span class="expo-badge" id="expoOffline">Sin conexión: pendiente de preparar</span></div>
    <label for="expoModel">Elegí qué explorar</label><select id="expoModel" disabled><option>Cargando catálogo…</option></select>
    <div class="expo-model"><h2 id="expoTitle">Preparando la experiencia</h2><p class="expo-hint" id="expoDescription">Un momento, por favor.</p>
    <div class="expo-actions"><button id="expoView" class="expo-primary" disabled>Explorar en 3D</button><button id="expoAR" class="expo-secondary" disabled>Ver en mi espacio</button></div></div>
    <div id="expoStatus" role="status" aria-live="polite" aria-atomic="true"></div>
    <button id="expoRetry" hidden>Reintentar carga</button>
    <p class="expo-hint" id="expoARHint">Comprobando la compatibilidad con realidad aumentada…</p>
    <a id="expoPublicLink" class="expo-link">Abrir vista para visitantes</a>
    <details class="expo-help"><summary>Ayuda y uso sin conexión</summary>
      <p class="expo-hint">En 3D: arrastrá para girar y usá dos dedos o la rueda para acercarte. En realidad aumentada: buscá una superficie iluminada, tocá para apoyar y elegí Fijar.</p>
      <p class="expo-hint">Prepará este equipo antes de desconectarlo. Cada celular nuevo necesita conexión en su primera visita. El navegador puede eliminar datos guardados si falta espacio.</p>
      <div class="expo-actions"><button id="expoPrepare">Preparar este modelo sin conexión</button><button id="expoUpdate" hidden>Actualizar aplicación</button></div>
      <p class="expo-hint" id="expoUpdateNote" hidden>Hay una versión nueva. Actualizá al terminar la visualización.</p>
    </details>
    <details class="expo-help" id="expoOrganizer"><summary>Preparar el stand y el acceso por QR</summary>
      <p class="expo-hint">Para los visitantes, seleccioná un modelo del catálogo y generá su QR. Para este equipo también podés abrir OBJ + MTL, STL o JSON.</p>
      <label for="expoUnits">Unidades de los archivos OBJ / STL del stand</label><select id="expoUnits"><option value="mm">Milímetros</option><option value="cm">Centímetros</option><option value="m">Metros</option></select>
      <div class="expo-actions"><button id="expoChoose">Abrir modelo del stand</button><button id="expoRestore" hidden>Recuperar modelo guardado</button><button id="expoMakeQR">Mostrar QR del modelo</button></div>
      <input id="expoFiles" type="file" accept=".obj,.stl,.mtl,.json" multiple hidden><div id="expoQR" hidden></div>
      <p class="expo-hint">El modelo del stand se guarda sólo en este navegador. Para compartirlo por QR, agregalo al catálogo y publicá los archivos junto a la aplicación.</p>
    </details>`;
  $('capaUI').prepend(panel); $('expoBrand').textContent = AR.CFG.marca + ' · EXPERIENCIA EXPO';
  const help3D = document.createElement('div'); help3D.id = 'expo3DHelp';
  help3D.textContent = 'Arrastrá para girar · Dos dedos o rueda para acercarte · Cerrar para volver'; $('visor3D').append(help3D);
  function status(message, error = false) { $('expoStatus').textContent = message; $('expoStatus').dataset.error = String(error); }
  function controls() {
    $('expoView').disabled = busy || !current || !AR.S.trazado || !!AR.S._contextLost;
    $('expoAR').disabled = busy || !current || $('btnAR').disabled || !!AR.S._contextLost;
    $('expoPrepare').disabled = busy || !current;
    $('expoChoose').disabled = busy; $('expoRestore').disabled = busy;
    $('expoMakeQR').disabled = busy || !current || !!localFiles;
    $('expoModel').disabled = busy || !catalog.length;
    panel.setAttribute('aria-busy', String(busy));
  }
  function support() {
    controls();
    $('expoARHint').textContent = !isSecureContext
      ? 'La realidad aumentada requiere abrir la aplicación desde una dirección HTTPS. Podés explorar el modelo en 3D.'
      : !$('btnAR').disabled ? 'Realidad aumentada disponible. Al iniciar, permití el acceso a la cámara.'
      : 'Si la realidad aumentada no está disponible en tu equipo, podés recorrer el mismo modelo en 3D.';
  }
  new MutationObserver(support).observe($('btnAR'), { attributes: true, attributeFilter: ['disabled'] });
  window.addEventListener('ar:graphics-status', event => { status(event.detail.message, event.detail.lost); controls(); });
  const connect = () => { $('expoConnection').textContent = navigator.onLine ? 'Equipo conectado' : 'Equipo sin conexión'; };
  window.addEventListener('online', connect); window.addEventListener('offline', connect); connect();
  function safeAsset(path) {
    if (typeof path !== 'string' || !path.trim()) throw new Error('Falta la ruta de un archivo del modelo.');
    const url = new URL(path, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || url.search || url.hash || /%(2f|5c)/i.test(url.pathname))
      throw new Error('Los archivos del catálogo deben estar dentro de la aplicación.');
    return url.href;
  }
  async function boundedFetch(url) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const r = await fetch(url, { signal: controller.signal, cache: 'no-cache' });
      if (!r.ok) throw new Error('Archivo no disponible (HTTP ' + r.status + ').');
      if (Number(r.headers.get('Content-Length')) > MAX_BYTES) throw new Error('El archivo supera 150 MB. Preparalo en la PC antes de exhibirlo.');
      const blob = await r.blob();
      if (!blob.size || blob.size > MAX_BYTES) throw new Error('El archivo está vacío o supera 150 MB.');
      return new Response(blob, { headers: r.headers });
    } finally { clearTimeout(timer); }
  }
  function assetKey(url, hash) { const key = new URL(url); key.searchParams.set('expo-sha', hash); return key.href; }
  async function asset(url, hash) {
    const key = assetKey(url, hash);
    let cache;
    try { cache = await caches.open(cacheName); const saved = await cache.match(key); if (saved) return saved; } catch (_) {}
    const response = await boundedFetch(url);
    const bytes = await response.arrayBuffer();
    const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (actual !== hash) throw new Error('El modelo no coincide con la versión del catálogo. Actualizá la aplicación o pedile al organizador que vuelva a publicar el paquete completo.');
    return new Response(bytes, { headers: response.headers });
  }
  function entry(raw) {
    if (!raw || typeof raw.id !== 'string' || !/^[\w-]{1,80}$/.test(raw.id) || typeof raw.title !== 'string') throw new Error('Catálogo inválido: revisá identificador y título.');
    const url = safeAsset(raw.file), ext = new URL(url).pathname.split('.').pop().toLowerCase();
    if (!['json','obj','stl'].includes(ext)) throw new Error('El catálogo admite archivos JSON, OBJ o STL.');
    const units = raw.units || 'mm'; if (!['mm','cm','m'].includes(units)) throw new Error('Unidades inválidas en el catálogo.');
    if (!/^[a-f0-9]{64}$/.test(raw.sha256 || '') || (raw.mtl && !/^[a-f0-9]{64}$/.test(raw.mtlSha256 || ''))) throw new Error('El catálogo necesita preparación: ejecutá sincronizar_core.py antes de publicar.');
    const scale = Number(raw.scale || 20); if (![1,20,50].includes(scale)) throw new Error('Escala inválida: usá 1, 20 o 50.');
    return { ...raw, url, ext, units, scale, mtlURL: raw.mtl ? safeAsset(raw.mtl) : null };
  }
  function selectedURL(item = current) {
    const url = new URL('index.html', base); url.searchParams.set('expo', '1');
    if (item && !localFiles) url.searchParams.set('modelo', item.id);
    if (localFiles) url.searchParams.set('stand', '1');
    return url;
  }
  function updateLink() { $('expoPublicLink').href = selectedURL().href; }
  function setScale(value) {
    const radio = document.querySelector('input[name="modo"][value="' + value + '"]');
    if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
  }
  async function openFiles(files, item) {
    $('selUnid').value = item.units;
    let result;
    loadingOwn = true;
    try { result = await AR.cargarArchivos(files); } finally { loadingOwn = false; }
    if (result === false || !AR.S.trazado) throw new Error('No se pudo interpretar el modelo. Revisá el archivo de origen.');
    setScale(item.scale); return files;
  }
  async function load(item, files = null) {
    const request = ++loadId; busy = true; current = null; offlineReady = false;
    $('expoOffline').textContent = 'Sin conexión: pendiente de preparar';
    $('expoRetry').hidden = true; $('expoQR').hidden = true; controls(); status('Cargando ' + item.title + '…');
    const requestedFiles = files;
    localFiles = files;
    localSaved = false;
    try {
      if (!files) {
        const paths = item.mtlURL ? [[item.url, item.sha256], [item.mtlURL, item.mtlSha256]] : [[item.url, item.sha256]];
        files = await Promise.all(paths.map(async ([url, hash]) => new File([await (await asset(url, hash)).blob()], decodeURIComponent(new URL(url).pathname.split('/').pop()))));
        localFiles = null;
      } else { localFiles = files; }
      if (request !== loadId) return;
      await openFiles(files, item);
      current = item;
      $('expoTitle').textContent = item.title;
      $('expoDescription').textContent = item.description || 'El modelo está listo para explorar.';
      status('Listo. Elegí Explorar en 3D o Ver en mi espacio.');
      updateLink();
      checkOffline();
    } catch (error) {
      status(error.name === 'AbortError' ? 'La conexión está tardando demasiado. Reintentá cuando tengas señal.' : error.message, true);
      $('expoTitle').textContent = 'No se pudo abrir el modelo';
      $('expoDescription').textContent = 'Podés reintentar o elegir otro modelo del catálogo.';
      $('expoRetry').hidden = false;
      $('expoRetry').onclick = () => load(item, requestedFiles);
    } finally { if (request === loadId) { busy = false; controls(); support(); } }
  }
  async function initCatalog() {
    try {
      const config = await (await boundedFetch(new URL('expo.json', base).href)).json();
      if (!Array.isArray(config.models) || !config.models.length) throw new Error('El catálogo está vacío.');
      catalog = config.models.map(entry);
      if (new Set(catalog.map(m => m.id)).size !== catalog.length) throw new Error('Hay identificadores repetidos en el catálogo.');
      $('expoModel').replaceChildren(...catalog.map(m => { const option = document.createElement('option'); option.value = m.id; option.textContent = m.title; return option; }));
      const wanted = params.get('modelo') || config.defaultModel || catalog[0].id;
      const initial = catalog.find(m => m.id === wanted);
      if (!initial) throw new Error('El modelo del enlace no existe. Elegí uno del catálogo.');
      $('expoModel').value = initial.id;
      if (visitor && params.get('stand') === '1') await restoreLocal();
      else if (visitor && location.hash !== '#compartido') await load(initial);
      else { $('expoTitle').textContent = 'Prepará la experiencia del stand'; $('expoDescription').textContent = 'Seleccioná un modelo del catálogo o abrí un archivo del stand.'; status('Elegí un modelo para preparar el acceso de visitantes.'); }
    } catch (error) { status(error.message, true); $('expoRetry').hidden = false; $('expoRetry').onclick = initCatalog; }
    controls(); updateLink();
  }
  $('expoModel').addEventListener('change', () => { const item = catalog.find(m => m.id === $('expoModel').value); if (item) load(item); });
  window.addEventListener('ar:model-loaded', () => {
    if (loadingOwn) return;
    current = null; localFiles = null; offlineReady = false; controls();
    $('expoTitle').textContent = 'Modelo abierto en las herramientas de trabajo';
    $('expoDescription').textContent = 'Usá los controles de abajo para verlo, o abrilo desde Preparar el stand para configurar la expo.';
    $('expoOffline').textContent = 'Sin conexión: pendiente de preparar';
    $('expoQR').hidden = true;
  });
  // A separate load button permits selecting the first entry in organizer mode.
  const loadButton = document.createElement('button'); loadButton.textContent = 'Cargar modelo seleccionado'; loadButton.id = 'expoLoad';
  loadButton.onclick = () => { const item = catalog.find(m => m.id === $('expoModel').value); if (item && !busy) load(item); };
  if (!visitor) $('expoModel').after(loadButton);
  $('expoView').onclick = () => { if (!busy && current && AR.iniciar3D() === false) status('No se pudo abrir el visor 3D. Cerrá otras pestañas y volvé a intentar.', true); };
  $('expoAR').onclick = () => { if (!busy && current) Promise.resolve(AR.iniciarAR()).then(() => { if (!AR.S.session) status('No se inició la realidad aumentada. Podés explorar el modelo en 3D o volver a intentar.', true); }).catch(e => status(e.message, true)); };
  $('expoChoose').onclick = () => $('expoFiles').click();
  $('expoFiles').onchange = () => {
    const files = Array.from($('expoFiles').files); $('expoFiles').value = '';
    const models = files.filter(f => /\.(obj|stl|json)$/i.test(f.name));
    if (models.length !== 1 || files.some(f => !/\.(obj|stl|json|mtl)$/i.test(f.name)) || files.some(f => f.size > MAX_BYTES)) { status('Elegí un solo modelo (OBJ, STL o JSON), junto con sus MTL. Máximo 150 MB por archivo.', true); return; }
    load({ id:'local', title:models[0].name, description:'Modelo del stand · disponible en este equipo', units:$('expoUnits').value, scale:20 }, files);
  };
  async function messageSW(type) {
    if (!registration?.active) throw new Error('La aplicación todavía no está instalada para uso sin conexión. Esperá unos segundos y reintentá.');
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); reject(new Error('No se pudo verificar el guardado sin conexión. Reintentá con conexión.')); }, 30000);
      channel.port1.onmessage = e => { clearTimeout(timer); channel.port1.close(); resolve(e.data); };
      registration.active.postMessage({ type }, [channel.port2]);
    });
  }
  async function checkOffline() {
    if (!current || !registration?.active) return;
    const selected = current;
    try {
      const result = await messageSW('EXPO_STATUS');
      const cache = await caches.open(cacheName);
      let saved = false;
      if (localFiles) {
        if (!localSaved) return;
        const record = await cache.match(localMetaURL);
        if (record) {
          const metadata = await record.json();
          saved = metadata.item.title === selected.title && metadata.item.units === selected.units && metadata.files.length === localFiles.length;
          for (let i = 0; saved && i < metadata.files.length; i++) {
            const file = await cache.match(metadata.files[i].url);
            saved = !!file && metadata.files[i].name === localFiles[i].name && (await file.blob()).size === localFiles[i].size;
          }
        }
      } else {
        saved = true;
        for (const [url, hash] of [[selected.url, selected.sha256], [selected.mtlURL, selected.mtlSha256]].filter(([url]) => url)) if (!(await cache.match(assetKey(url, hash)))) saved = false;
      }
      if (current === selected && saved && result.ready) {
        offlineReady = true; $('expoOffline').textContent = 'Aplicación y modelo guardados en este equipo';
      }
    } catch (_) { /* A verified success is required before claiming offline readiness. */ }
  }
  $('expoPrepare').onclick = async () => {
    if (busy || !current) return; busy = true; controls(); status('Guardando aplicación y modelo en este equipo…');
    try {
      const result = await messageSW('EXPO_PREPARE');
      if (!result.ready) throw new Error('Faltan archivos de la aplicación. Revisá la conexión y reintentá.');
      const cache = await caches.open(cacheName);
      if (localFiles) {
        const generation = Date.now().toString(36), saved = [];
        for (let i = 0; i < localFiles.length; i++) {
          const file = localFiles[i], url = new URL('_expo/local/' + generation + '/' + i, base).href;
          await cache.put(url, new Response(file)); saved.push({ name:file.name, url });
        }
        await cache.put(localMetaURL, new Response(JSON.stringify({ item:current, files:saved })));
        localSaved = true;
        const keep = new Set(saved.map(f => f.url));
        for (const key of await cache.keys()) if (key.url.startsWith(new URL('_expo/local/', base).href) && !keep.has(key.url)) await cache.delete(key);
        $('expoRestore').hidden = false;
      } else {
        for (const [url, hash] of [[current.url, current.sha256], [current.mtlURL, current.mtlSha256]].filter(([url]) => url)) { const r = await asset(url, hash); await cache.put(assetKey(url, hash), r); }
      }
      try { await navigator.storage?.persist?.(); } catch (_) {}
      offlineReady = true; $('expoOffline').textContent = 'Aplicación y modelo guardados en este equipo';
      status('Guardado completo. Cerrá la aplicación, activá modo avión y volvé a abrirla para ensayar antes de la expo.');
    } catch (error) { offlineReady = false; $('expoOffline').textContent = 'Guardado sin conexión incompleto'; status(error.message, true); }
    finally { busy = false; controls(); }
  };
  async function restoreLocal() {
    try {
      const cache = await caches.open(cacheName), r = await cache.match(localMetaURL);
      if (!r) throw new Error('No hay un modelo del stand guardado en este navegador.');
      const record = await r.json(), files = [];
      for (const saved of record.files) { const f = await cache.match(saved.url); if (!f) throw new Error('El guardado está incompleto. Abrí nuevamente el archivo original.'); files.push(new File([await f.blob()], saved.name)); }
      $('expoUnits').value = record.item.units; await load(record.item, files);
      if (current) { localSaved = true; checkOffline(); }
    } catch (error) { status(error.message, true); }
  }
  $('expoRestore').onclick = restoreLocal;
  $('expoPublicLink').onclick = event => {
    if (localFiles && !offlineReady) { event.preventDefault(); status('Primero elegí Preparar este modelo sin conexión para abrirlo en la vista del stand.', true); }
  };
  $('expoMakeQR').onclick = () => {
    const url = selectedURL();
    if (localFiles || url.protocol !== 'https:' || /^(localhost|127\.|\[::1\])/.test(url.hostname)) { status('El QR del público requiere la dirección HTTPS publicada y un modelo del catálogo. La dirección local de prueba no funciona en otros celulares.', true); return; }
    try {
      const original = AR.qrCanvas(url.href, 6), qr = document.createElement('canvas');
      qr.width = original.width + 24; qr.height = original.height + 24;
      const pen = qr.getContext('2d'); pen.fillStyle = '#fff'; pen.fillRect(0, 0, qr.width, qr.height); pen.drawImage(original, 12, 12);
      const a = document.createElement('a'); a.href = url.href; a.textContent = url.href;
      const download = document.createElement('a'); download.className = 'expo-link'; download.download = 'QR-' + current.id + '.png'; download.href = qr.toDataURL('image/png'); download.textContent = 'Descargar QR';
      $('expoQR').replaceChildren(qr, a, download); $('expoQR').hidden = false;
      $('expoQR').scrollIntoView({ block:'center' });
    } catch (error) { status('No se pudo generar el QR: ' + error.message, true); }
  };
  async function serviceWorker() {
    if (!('serviceWorker' in navigator) || !isSecureContext) return;
    try {
      const wasControlled = !!navigator.serviceWorker.controller;
      registration = await navigator.serviceWorker.register('sw.js', { updateViaCache:'none' });
      const waiting = () => { $('expoUpdate').hidden = !registration.waiting; $('expoUpdateNote').hidden = !registration.waiting; };
      waiting(); registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', waiting));
      $('expoUpdate').onclick = () => { if (AR.S.session || AR.S.renderer || AR.S.modo3D || busy) { status('Terminá la visualización antes de actualizar.'); return; } registration.waiting?.postMessage({ type:'EXPO_ACTIVATE_UPDATE' }); };
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (registration.waiting) return; waiting(); checkOffline(); if (wasControlled) { $('expoUpdateNote').hidden = false; $('expoUpdateNote').textContent = 'La aplicación se actualizó. Volvé a cargar la página cuando termines.'; } });
      const cache = await caches.open(cacheName); $('expoRestore').hidden = !(await cache.match(localMetaURL));
      checkOffline();
    } catch (_) { $('expoOffline').textContent = 'Uso sin conexión no disponible; revisá permisos y conexión'; }
  }
  // Do not interrupt an active AR session or reload automatically on updates.
  support(); initCatalog(); serviceWorker();
  window.EXPO = { get current() { return current; }, get offlineReady() { return offlineReady; }, safeAsset };
})();
