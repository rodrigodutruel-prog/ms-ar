/* QR -> user-selected local files. IndexedDB stores copies, never uploads them. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),S=AR.S;
  const box=document.createElement('section');box.id='bibliotecaQR';box.className='qr-library';
  box.innerHTML='<h2>Abrir archivo por QR</h2><p>Agregá tus archivos una vez. Después escaneá el QR y la app encontrará el modelo guardado en este teléfono, incluso sin Internet.</p><div class="qr-actions"><button id="qrBuscar" type="button">Leer QR y abrir modelo</button><button id="qrAgregar" type="button">Agregar archivos del teléfono</button><button id="qrCarpeta" type="button">Agregar carpeta</button></div><input id="qrArchivos" type="file" accept=".json,.obj,.mtl" multiple hidden><input id="qrDirectorio" type="file" webkitdirectory multiple hidden><label>Al encontrarlo <select id="qrDestino"><option value="3d">Abrir en 3D sin cámara</option><option value="papel">Ubicar sobre el plano</option></select></label><p id="qrBibliotecaEstado" role="status" aria-live="polite"></p><details><summary>Archivos guardados</summary><div id="qrLista"></div></details>';
  document.querySelector('#capaUI main').prepend(box);
  let dbPromise,scan=null,busy=false,records=[];
  const say=text=>{$('qrBibliotecaEstado').textContent=text;};
  const active=()=>!!(busy||scan||S._cargando||S._iniciando||S.session||S.modo3D||S.renderer);
  function database(){
    if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open('ar-biblioteca-qr-'+location.pathname.replace(/index\.html$/,''),1);
      request.onupgradeneeded=()=>{const store=request.result.createObjectStore('models',{keyPath:'id'});store.createIndex('qr','qr');};
      request.onerror=()=>{dbPromise=null;reject(new Error('No se pudo abrir la biblioteca local. Revisá el espacio disponible y el modo privado.'));};
      request.onblocked=()=>{say('Cerrá otras ventanas de la app para abrir la biblioteca.');};
      request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();dbPromise=null;};resolve(request.result);};
    });return dbPromise;
  }
  async function transaction(mode,action){
    const db=await database();return new Promise((resolve,reject)=>{
      const tx=db.transaction('models',mode);let value;
      const request=action(tx.objectStore('models'));if(request)request.onsuccess=()=>{value=request.result;};
      tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(new Error('No se pudo guardar o leer el archivo. Revisá el espacio del teléfono.'));
    });
  }
  // Metadata only: scanning must not load all model blobs into memory.
  async function metadata(){
    const db=await database();return new Promise((resolve,reject)=>{
      const result=[],tx=db.transaction('models'),request=tx.objectStore('models').openCursor();
      request.onsuccess=()=>{const c=request.result;if(c){const {id,name,qr,bytes,updated}=c.value;result.push({id,name,qr,bytes,updated});c.continue();}};
      tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(new Error('No se pudo leer la biblioteca.'));
    });
  }
  async function refresh(){
    records=await metadata();$('qrLista').replaceChildren();
    for(const r of records){
      const row=document.createElement('div');row.className='qr-record';
      const label=document.createElement('span');label.textContent=r.name+' · '+(r.bytes/1048576).toFixed(1)+' MB';
      const open=document.createElement('button');open.textContent='Abrir';open.type='button';open.onclick=()=>openRecord(r.id,false).catch(e=>say(e.message));
      const del=document.createElement('button');del.textContent='Quitar copia';del.type='button';del.onclick=async()=>{if(active()){say('Cerrá el visor o esperá a que termine la operación.');return;}busy=true;try{await transaction('readwrite',s=>s.delete(r.id));await refresh();say('Copia quitada de la biblioteca. El archivo original sigue en el teléfono.');}catch(e){say(e.message);}finally{busy=false;}};
      row.append(label,open,del);$('qrLista').append(row);
    }
    if(!records.length)$('qrLista').textContent='Todavía no agregaste archivos con QR.';
  }
  async function importFiles(files){
    if(active()){say('Cerrá el visor antes de agregar archivos.');return;}
    const list=Array.from(files||[]),models=list.filter(f=>/\.(json|obj)$/i.test(f.name));
    if(!models.length){say('Seleccioná los JSON de la Calculadora o los OBJ exportados con su plano AR.');return;}
    if(models.length>100||list.reduce((s,f)=>s+f.size,0)>500*1048576){say('Agregá hasta 100 modelos y 500 MB por vez.');return;}
    busy=true;S._iniciando='library-import';const units=$('selUnid').value||'mm';let added=0,failed=[];
    try{
      for(const file of models){
        say('Leyendo '+file.name+'…');
        try{
          if(file.size>150*1048576)throw new Error('supera 150 MB');
          const text=await file.text(),isJSON=/\.json$/i.test(file.name);let marker;
          if(isJSON){const raw=JSON.parse(text);marker=raw.ar?.marcador;}
          else{const match=text.match(/^# MSAR_HOJA (.+)$/m);marker=match?JSON.parse(match[1]).marcador:null;}
          if(!marker?.png)throw new Error('no incluye el QR del plano; exportá el archivo AR');
          const decoded=await MSPaper.embeddedMarker(marker);
          const mainBytes=await file.arrayBuffer();
          const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',mainBytes)),b=>b.toString(16).padStart(2,'0')).join('');
          const parent=(file.webkitRelativePath||'').split('/').slice(0,-1).join('/');
          const wanted=isJSON?[]:Array.from(text.matchAll(/^mtllib\s+(.+)$/gm),m=>m[1].trim());
          const companions=list.filter(f=>/\.mtl$/i.test(f.name)&&(f.webkitRelativePath||'').split('/').slice(0,-1).join('/')===parent&&wanted.some(n=>n===f.name||n.split(/\s+/).includes(f.name)));
          const sources=[file,...companions];
          if(sources.length>20||sources.reduce((s,f)=>s+f.size,0)>150*1048576)throw new Error('el conjunto con materiales supera el límite de carga');
          const record={id,name:file.name,qr:decoded.text,units,bytes:sources.reduce((s,f)=>s+f.size,0),updated:Date.now(),files:sources.map(f=>({name:f.name,blob:f}))};
          await transaction('readwrite',s=>s.put(record));added++;
        }catch(e){failed.push(file.name+': '+e.message);}
      }
      await refresh();
      say(added+' archivo(s) guardado(s). '+records.length+' en la biblioteca.'+(failed.length?' No se agregaron: '+failed.join(' · '):' Ya podés abrirlos con su QR.'));
    }catch(e){say(e.message);}finally{if(S._iniciando==='library-import')S._iniciando=null;busy=false;AR.revisarSoporte();}
  }
  async function openRecord(id,destination){
    if(active()){say('Cerrá el visor o esperá a que termine la operación.');return false;}
    busy=true;S._iniciando='library-open';
    try{
      const r=await transaction('readonly',s=>s.get(id));if(!r)throw new Error('El archivo ya no está guardado. Agregalo nuevamente.');
      const files=r.files.map(f=>new File([f.blob],f.name));$('selUnid').value=r.units;
      S._iniciando=null;
      if(!await AR.cargarArchivos(files))throw new Error('El archivo se encontró, pero no pudo abrirse. Revisá el archivo original.');
      say('Encontrado en este teléfono: '+r.name);
      if(destination==='papel'){
        const radio=document.querySelector('input[name=modo][value=papel]');radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));
        $('msModoPapel').value='camara';AR.revisarSoporte();await AR.iniciarAR();
      }else if(destination==='3d')await AR.iniciar3D();
      return true;
    }finally{if(S._iniciando==='library-open')S._iniciando=null;busy=false;}
  }
  function closeScan(){
    const r=scan;if(!r)return;scan=null;r.closed=true;clearTimeout(r.timer);clearTimeout(r.timeout);
    r.worker?.terminate();r.stream?.getTracks().forEach(t=>t.stop());r.video.pause();r.video.srcObject=null;
    r.overlay.remove();document.removeEventListener('visibilitychange',r.hide);window.removeEventListener('pagehide',r.leave);window.removeEventListener('popstate',r.back);
    if(S._iniciando==='library-scan')S._iniciando=null;
    $('capaUI').classList.remove('oculto');AR.revisarSoporte();$('qrBuscar').focus();
  }
  function scanError(r,e){if(scan!==r)return;closeScan();say(e.name==='NotAllowedError'?'Permití la cámara para leer el QR.':e.message||'No se pudo iniciar la cámara.');}
  async function startScan(){
    if(active()){say('Cerrá el visor o esperá a que termine la operación.');return;}
    const r={closed:false,id:0,last:null,hits:0};scan=r;S._iniciando='library-scan';
    r.overlay=document.createElement('section');r.overlay.id='qrEscaner';r.overlay.className='qr-scanner';r.overlay.setAttribute('aria-label','Buscar archivo mediante QR');
    r.overlay.innerHTML='<video muted playsinline></video><div class="qr-scanner-top"><p id="qrScanEstado" role="status">Preparando cámara…</p><button id="qrScanSalir" type="button">Salir</button></div><div id="qrCoincidencias" class="qr-matches"></div>';
    document.body.append(r.overlay);r.video=r.overlay.querySelector('video');r.video.muted=true;r.video.playsInline=true;
    $('capaUI').classList.add('oculto');$('qrScanSalir').onclick=closeScan;
    r.hide=()=>{if(document.hidden)closeScan();};r.leave=closeScan;r.back=closeScan;
    document.addEventListener('visibilitychange',r.hide);window.addEventListener('pagehide',r.leave);window.addEventListener('popstate',r.back);
    try{
      records=await metadata();if(scan!==r)return;
      if(!records.length){closeScan();say('Primero tocá Agregar archivos del teléfono y seleccioná tus archivos AR. Solo hace falta una vez.');return;}
      const request=navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
      request.then(s=>{if(scan!==r)s.getTracks().forEach(t=>t.stop());},()=>{});
      r.stream=await request;if(scan!==r){r.stream.getTracks().forEach(t=>t.stop());return;}
      r.stream.getVideoTracks()[0].addEventListener('ended',()=>scanError(r,new Error('La cámara se desconectó. Volvé a leer el QR.')),{once:true});
      r.video.srcObject=r.stream;await r.video.play();if(scan!==r)return;
      r.canvas=document.createElement('canvas');r.context=r.canvas.getContext('2d',{willReadFrequently:true});
      r.worker=new Worker('qr-worker.js');r.worker.onerror=()=>scanError(r,new Error('No se pudo cargar el lector. Actualizá la app con conexión.'));
      r.worker.onmessage=async event=>{
        if(scan!==r||event.data.id!==r.id)return;clearTimeout(r.timeout);
        const code=event.data.code;
        if(code){
          r.hits=r.last===code.data?r.hits+1:1;r.last=code.data;
          if(r.hits>=2){
            const matches=records.filter(item=>item.qr===code.data);
            if(matches.length===1){const destination=$('qrDestino').value;closeScan();try{await openRecord(matches[0].id,destination);}catch(e){say(e.message);}return;}
            if(matches.length>1){
              $('qrScanEstado').textContent='Este QR coincide con varios archivos. Elegí cuál abrir.';
              $('qrCoincidencias').replaceChildren();
              for(const item of matches){const b=document.createElement('button');b.textContent=item.name+' · '+new Date(item.updated).toLocaleString();b.onclick=()=>{const dest=$('qrDestino').value;closeScan();openRecord(item.id,dest).catch(e=>say(e.message));};$('qrCoincidencias').append(b);}return;
            }
            $('qrScanEstado').textContent='QR leído. Su archivo todavía no está en la biblioteca. Salí y agregá el JSON o el OBJ correspondiente.';
          }
        }else{r.hits=0;r.last=null;}
        r.timer=setTimeout(()=>capture(r),100);
      };
      $('qrScanEstado').textContent='Apuntá al QR del plano. Buscaré entre '+records.length+' archivo(s) de este teléfono.';capture(r);
    }catch(e){scanError(r,e);}
  }
  function capture(r){
    if(scan!==r)return;
    try{
      const w=r.video.videoWidth,h=r.video.videoHeight;if(!w||!h){r.timer=setTimeout(()=>capture(r),100);return;}
      const k=Math.min(1,960/Math.max(w,h));r.canvas.width=Math.round(w*k);r.canvas.height=Math.round(h*k);
      r.context.drawImage(r.video,0,0,r.canvas.width,r.canvas.height);const pixels=r.context.getImageData(0,0,r.canvas.width,r.canvas.height);
      r.worker.postMessage({id:++r.id,buffer:pixels.data.buffer,width:pixels.width,height:pixels.height},[pixels.data.buffer]);
      r.timeout=setTimeout(()=>scanError(r,new Error('El lector no respondió. Volvé a iniciar.')),4000);
    }catch(e){scanError(r,e);}
  }
  $('qrAgregar').onclick=()=>{if(active()){say('Cerrá el visor antes de agregar archivos.');return;}$('qrArchivos').click();};
  $('qrCarpeta').onclick=()=>{if(active()){say('Cerrá el visor antes de agregar archivos.');return;}$('qrDirectorio').click();};
  for(const id of ['qrArchivos','qrDirectorio'])$(id).onchange=e=>{const files=Array.from(e.target.files);e.target.value='';importFiles(files);};
  $('qrBuscar').onclick=startScan;
  refresh().then(()=>say(records.length+' archivo(s) disponibles para buscar por QR.')).catch(e=>say(e.message));
})();
