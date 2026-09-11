/* MS AR paper mode: match the embedded QR and render against the same captured frame.
   No WebXR image-tracking flag, server processing, or camera uploads are required. */
(() => {
  'use strict';
  const {S,UI,motor}=AR, T=THREE, math=MSTracking;
  const $=id=>document.getElementById(id);
  let run=null, serial=0;
  function cameraError(e) {
    if(e.name==='NotAllowedError') return 'La cámara no tiene permiso. Permití la cámara para este sitio en Android o Chrome y volvé a iniciar.';
    if(e.name==='NotFoundError') return 'No se encontró una cámara. Podés usar Ver en 3D.';
    if(e.name==='NotReadableError') return 'Otra aplicación está usando la cámara. Cerrala y volvé a iniciar.';
    return e.message || 'No se pudo iniciar la cámara.';
  }
  function status(text,state='search') {
    const e=$('papelEstado'); if(!e) return;
    if(e.textContent!==text) e.textContent=text;
    e.dataset.state=state;
  }
  function alive(r) { return run===r && !r.closed; }
  function listen(r,target,event,callback,options) {
    target.addEventListener(event,callback,options);
    r.cleanups.push(()=>target.removeEventListener(event,callback,options));
  }
  function stop(reason) {
    const r=run; if(!r) return;
    r.closed=true; run=null; serial++;
    clearTimeout(r.watchdog); clearTimeout(r.workerTimer); clearTimeout(r.captureTimer);
    r.worker?.terminate(); r.stream?.getTracks().forEach(track=>track.stop());
    r.cleanups.forEach(fn=>fn()); r.pending?.bitmap?.close();
    r.video?.pause(); if(r.video) r.video.srcObject=null;
    if(r.renderer) { r.renderer.setAnimationLoop(null); r.renderer.domElement.remove(); }
    if(r.scene) motor.liberarObjeto(r.scene,r.geometry);
    r.overlay?.remove();
    S.papelCamera=false; S._iniciando=null; S.renderer=null; S.grupo=null; S.fijado=false;
    $('capaUI').classList.remove('oculto'); AR.revisarSoporte();
    if(reason) UI.estado(reason,'err');
  }
  async function embeddedMarker(marker) {
    if(!marker || !marker.png) throw new Error('Este archivo no contiene el QR impreso. Abrí el JSON exportado con AR desde la Calculadora. También podés elegir Dos cruces.');
    const bitmap=await motor.bitmapMarcador(marker);
    if(!bitmap) throw new Error('No se pudo leer la imagen del QR guardada en el archivo. Exportá nuevamente el JSON de la Calculadora.');
    try {
      const c=document.createElement('canvas'); c.width=bitmap.width; c.height=bitmap.height;
      const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(bitmap,0,0);
      const code=jsQR(g.getImageData(0,0,c.width,c.height).data,c.width,c.height,{inversionAttempts:'dontInvert'});
      if(!code) throw new Error('El marcador guardado no contiene un QR legible. Elegí Dos cruces o exportá un plano y su JSON nuevos desde la Calculadora.');
      // Use decoded PNG data: old Calculator exports may truncate the text
      // before generating the QR. Matching a guessed string would reject them.
      return math.markerGeometry(code,c.width,c.height,marker);
    } finally { bitmap.close(); }
  }
  function buildOverlay(r) {
    const overlay=document.createElement('section'); overlay.id='papelCamara'; overlay.setAttribute('aria-label','Modelo sobre plano impreso');
    overlay.innerHTML='<div id="papelStage"></div><div class="papel-guia"></div><div class="papel-cabecera"><p id="papelEstado" role="status" aria-live="polite">Preparando cámara…</p><button id="papelSalir" type="button">Salir</button></div><div class="papel-controles"><button id="papelReleer" type="button">Volver a leer QR</button><button id="papelLibre" type="button">Ver 3D sin cámara</button><button id="papelPausa" type="button" disabled>Pausar imagen</button><details><summary>Ajustar vista</summary><p>Usá el mismo JSON y plano. Mantené visible el QR completo, con luz uniforme.</p><label>Perspectiva de cámara <input id="papelFov" type="range" min="45" max="85" step="1" value="65"></label><p>Si la altura se ve deformada, ajustá la perspectiva. La escala sobre la hoja usa la medida del marco impreso.</p><label>Ver a través del modelo <input id="papelOpacidad" type="range" min="25" max="100" step="5" value="100"></label></details></div>';
    document.body.append(overlay); r.overlay=overlay; r.stage=$('papelStage');
    r.background=document.createElement('canvas'); r.stage.append(r.background);
    r.backgroundContext=r.background.getContext('2d',{alpha:false});
    $('capaUI').classList.add('oculto');
    listen(r,$('papelSalir'),'click',()=>stop());
    listen(r,$('papelLibre'),'click',()=>{stop();AR.iniciar3D();});
    listen(r,$('papelReleer'),'click',()=>{
      r.resetFlow=true; r.lastGood=0; r.filter.reset(); r.acquisition.reset(); r.lastRotation=null; r.group.visible=false; r.paused=false;
      $('papelPausa').textContent='Pausar imagen'; $('papelPausa').disabled=true;
      overlay.dataset.found='false'; status('Apuntá al QR completo del plano.');
    });
    listen(r,$('papelPausa'),'click',()=>{
      r.paused=!r.paused;
      $('papelPausa').textContent=r.paused ? 'Seguir con cámara' : 'Pausar imagen';
      if(r.paused) status('Imagen pausada. Tocá Seguir con cámara para volver al seguimiento.');
      else { r.resetFlow=true;r.lastGood=0;r.filter.reset(); r.acquisition.reset(); r.group.visible=false; status('Buscando nuevamente el QR…'); }
    });
    listen(r,$('papelFov'),'input',()=>{r.fov=Number($('papelFov').value);r.filter.reset();r.lastRotation=null;});
    listen(r,$('papelOpacidad'),'input',()=>r.group?.traverse(o=>{
      if(!o.isMesh || o.userData.esEtiqueta) return;
      for(const m of Array.isArray(o.material)?o.material:[o.material]) {
        const opacity=Number($('papelOpacidad').value)/100;
        m.opacity=opacity*(m.userData.papelOpacity ?? (m.userData.papelOpacity=m.opacity));
        m.transparent=m.opacity<.99; m.depthWrite=!m.transparent; m.needsUpdate=true;
      }
    }));
    listen(r,document,'visibilitychange',()=>{if(document.hidden) stop('La cámara se cerró al salir de la aplicación. Tocá Iniciar AR para continuar.');});
    listen(r,window,'pagehide',()=>stop());
    listen(r,window,'resize',()=>{if(r.width) layout(r);});
  }
  function layout(r) {
    const w=r.width,h=r.height,k=Math.min(innerWidth/w,innerHeight/h);
    r.stage.style.width=Math.round(w*k)+'px';r.stage.style.height=Math.round(h*k)+'px';
    r.renderer.setSize(Math.round(w*k),Math.round(h*k));
    r.camera.aspect=w/h; r.camera.fov=2*Math.atan(h/(2*r.focal))*180/Math.PI; r.camera.updateProjectionMatrix();
  }
  function place(r,pose) {
    const a=pose.rotation,p=pose.translation;
    // POSIT uses camera +Z forward. D*R*D preserves handedness in Three's
    // camera coordinates; the marker +Z faces the viewer.
    const m=new T.Matrix4().set(a[0][0],a[0][1],-a[0][2],p[0],a[1][0],a[1][1],-a[1][2],p[1],-a[2][0],-a[2][1],a[2][2],-p[2],0,0,0,1);
    r.pivot.matrix.copy(m); r.pivot.matrixWorldNeedsUpdate=true;
    r.lastRotation=a;
  }
  function showFrame(r,pending) {
    const {bitmap}=pending;
    if(r.background.width!==bitmap.width || r.background.height!==bitmap.height) {r.background.width=bitmap.width;r.background.height=bitmap.height;}
    r.backgroundContext.drawImage(bitmap,0,0); bitmap.close();
  }
  function result(r,event) {
    if(!alive(r) || !r.pending || event.data.id!==r.pending.id) return;
    clearTimeout(r.workerTimer);
    const pending=r.pending; r.pending=null;
    if(r.paused) {pending.bitmap.close();schedule(r);return;}
    const now=performance.now(); r.lastFrame=now;
    let pose=null, message='Mantené visible el QR completo del plano, sin reflejos.', mismatch=false;
    const code=event.data.code;
    if(code) {
      if(code.data!==r.marker.text) {message='Este QR no corresponde al archivo abierto. Usá el plano y el JSON de la misma exportación.';mismatch=true;}
      else {
        const points=math.corners(code);
        if(math.validQuad(points,r.width,r.height)) {
          const filtered=r.filter.update(points,now);
          pose=math.solvePose(POS,filtered,r.width,r.height,r.qrSize,r.focal,r.lastRotation);
          if(!pose) message='Lectura inclinada o borrosa. Acercá el teléfono y mirá el QR menos de costado.';
        } else message='Acercate un poco: el QR completo debe verse más grande dentro de la cámara.';
      }
    }
    if(pose) {
      showFrame(r,pending);
      place(r,pose);r.lastGood=now;
      r.group.visible=r.acquisition.accept(now);
      r.overlay.dataset.found=String(r.group.visible);
      r.overlay.dataset.tracking=code.tracked?'flow':'qr';
      status(r.group.visible ? 'QR reconocido · modelo vinculado a la hoja · escala 1:'+r.scale.toFixed(1) : 'QR reconocido. Comprobando la posición…',r.group.visible?'ok':'search');
    } else {
      // A short failed read holds BOTH the last image and its model. Never draw
      // an old pose over a new camera frame. Good optical flow renders normally.
      if(!mismatch && r.group.visible && now-r.lastGood<600){
        pending.bitmap.close();r.overlay.dataset.tracking='recovering';
        status('Recuperando referencia · imagen retenida un instante');schedule(r);return;
      }
      showFrame(r,pending);r.overlay.dataset.tracking='lost';
      r.group.visible=false; r.acquisition.miss(now); r.overlay.dataset.found='false';
      if(mismatch) {r.acquisition.reset();r.filter.reset();r.lastRotation=null;}
      status(message,mismatch?'error':'search');
    }
    $('papelPausa').disabled=!r.group.visible;
    r.renderer.render(r.scene,r.camera);
    schedule(r);
  }
  function schedule(r) { if(alive(r)) r.captureTimer=setTimeout(()=>capture(r),Math.max(0,50-(performance.now()-(r.captureStarted||0)))); }
  async function capture(r) {
    if(!alive(r)) return;
    if(r.paused) {schedule(r);return;}
    r.captureStarted=performance.now();
    let bitmap;
    try {
      bitmap=await createImageBitmap(r.video);
      if(!alive(r)){bitmap.close();return;}
      const k=Math.min(1,900/Math.max(bitmap.width,bitmap.height));
      const w=Math.round(bitmap.width*k),h=Math.round(bitmap.height*k);
      r.width=w;r.height=h;r.focal=Math.max(w,h)/(2*Math.tan(r.fov*Math.PI/360));
      layout(r);
      r.capture.width=w;r.capture.height=h;r.captureContext.drawImage(bitmap,0,0,w,h);
      const pixels=r.captureContext.getImageData(0,0,w,h);
      const id=++r.frameId;r.pending={id,bitmap};
      r.worker.postMessage({id,buffer:pixels.data.buffer,width:w,height:h,expected:r.marker.text,reset:!!r.resetFlow},[pixels.data.buffer]);
      r.resetFlow=false;
      r.workerTimer=setTimeout(()=>{if(alive(r))stop('El lector QR dejó de responder. Volvé a iniciar la cámara.');},4000);
    } catch(e) {bitmap?.close();if(alive(r))stop(cameraError(e));}
  }
  async function start() {
    if(run || S._iniciando || S._cargando || S.session || S.modo3D || !S.trazado) return false;
    if(!isSecureContext || !navigator.mediaDevices?.getUserMedia) {UI.estado('La cámara requiere abrir MS AR con HTTPS y permitir el acceso a la cámara.','err');return false;}
    const r={id:++serial,closed:false,cleanups:[],fov:65,frameId:0,lastGood:0,filter:new math.CornerFilter(),acquisition:new math.Acquisition(),geometry:S.trazado.geo};
    run=r; S._iniciando='paper'; S.papelCamera=true;
    buildOverlay(r);
    try {
      const tz=S.trazado,mk=tz.marcador;
      r.marker=await embeddedMarker(mk); if(!alive(r))return false;
      const factor=S.factorImpresion || 1;
      if(!(mk.escala>0 && mk.escala<=10000) || !(factor>0 && factor<=5)) throw new Error('La escala del plano no es válida. Revisá el archivo y la medida del marco.');
      r.scale=mk.escala/factor;r.qrSize=mk.lado_mm/1000*factor*r.marker.fraction;
      const relative=motor.centroMarcador(tz,mk);
      // The QR is smaller than its printed border. Measure its actual bounds
      // in the embedded PNG, including off-centre markers from older exports.
      relative.x+=r.marker.dx*mk.lado_mm/1000*mk.escala;
      relative.z+=r.marker.dy*mk.lado_mm/1000*mk.escala;
      r.renderer=motor.obtenerRenderer();S.renderer=r.renderer;
      r.renderer.setAnimationLoop(null);r.renderer.domElement.style.cssText='position:absolute;inset:0;z-index:1;pointer-events:none;';
      r.stage.append(r.renderer.domElement);
      r.scene=motor.nuevaEscena();r.camera=new T.PerspectiveCamera(60,1,.002,100);
      r.pivot=new T.Group();r.pivot.matrixAutoUpdate=false;r.scene.add(r.pivot);
      r.group=motor.construirGrupo(tz);r.group.scale.setScalar(1/r.scale);r.group.rotation.x=Math.PI/2;
      r.group.position.set(-relative.x/r.scale,relative.z/r.scale,0);r.group.visible=false;
      ['grpPiso','grpSombra','grpEtiq','grpRef'].forEach(key=>{if(r.group.userData[key])r.group.userData[key].visible=false;});
      r.pivot.add(r.group);S.grupo=r.group;S.fijado=true;
      r.video=document.createElement('video');r.video.muted=true;r.video.playsInline=true;r.video.setAttribute('playsinline','');
      status('Permití la cámara y apuntá al QR de tu plano.');
      const portrait=innerHeight>innerWidth;
      const request=navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:portrait?1080:1920},height:{ideal:portrait?1920:1080},aspectRatio:{ideal:portrait?9/16:16/9},frameRate:{ideal:30,max:30}}});
      request.then(stream=>{if(!alive(r))stream.getTracks().forEach(t=>t.stop());},()=>{});
      r.stream=await request;if(!alive(r)){r.stream.getTracks().forEach(t=>t.stop());return false;}
      const track=r.stream.getVideoTracks()[0];
      listen(r,track,'ended',()=>stop('La cámara se desconectó. Volvé a iniciar AR.'));
      const caps=track.getCapabilities?.() || {};
      if(caps.focusMode?.includes('continuous')) await track.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(()=>{});
      if(!alive(r))return false;
      r.video.srcObject=r.stream;await r.video.play();if(!alive(r))return false;
      r.capture=document.createElement('canvas');r.captureContext=r.capture.getContext('2d',{willReadFrequently:true});
      r.worker=new Worker('qr-worker.js');r.worker.onmessage=event=>result(r,event);
      r.worker.onerror=()=>stop('No se pudo cargar el lector QR. Actualizá la aplicación con conexión y reintentá.');
      S._iniciando=null;
      if(history.state?.ar || history.state?.v3d)history.replaceState({ar:1},'');else history.pushState({ar:1},'');
      S._histAR=true;
      r.watchdog=setTimeout(function check(){
        if(!alive(r))return;
        if(!r.paused && r.lastFrame && performance.now()-r.lastFrame>4000){stop('La imagen de cámara se interrumpió. Volvé a iniciar AR.');return;}
        r.watchdog=setTimeout(check,1500);
      },1500);
      capture(r);return true;
    } catch(e) {if(alive(r))stop(cameraError(e));return false;}
  }
  window.MSPaper={start,stop,embeddedMarker,get active(){return !!run;}};
})();
