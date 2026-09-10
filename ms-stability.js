/* Full-pose image tracking for devices that support the optional WebXR path. */
(() => {
  'use strict';
  const {S,UI,motor}=AR, T=THREE;
  let samples=[],last=0;
  function reset(){samples=[];last=0;}
  function marker(pos,quat){
    if(!S.grupo || !S.trazado?.marcador)return;
    const now=performance.now();
    if(![pos.x,pos.y,pos.z,quat.x,quat.y,quat.z,quat.w].every(Number.isFinite))return;
    const p=new T.Vector3(pos.x,pos.y,pos.z),q=quat.clone().normalize();
    if(now-last>180)reset();
    last=now;
    const prior=samples.at(-1);
    if(prior && (p.distanceTo(prior.p)>.08 || q.angleTo(prior.q)>.35)) {
      reset();S.grupo.visible=false;UI.msg('La referencia cambió. Sostené el QR visible para verificar nuevamente.');
    }
    samples.push({p,q,time:now});samples=samples.filter(s=>now-s.time<550);
    const center=new T.Vector3();samples.forEach(s=>center.addScaledVector(s.p,1/samples.length));
    const spread=Math.max(...samples.map(s=>s.p.distanceTo(center)));
    const angle=Math.max(...samples.map(s=>s.q.angleTo(q)));
    if(samples.length<5 || now-samples[0].time<250 || spread>.012 || angle>.08){
      S.grupo.visible=false;UI.msg('QR visible. Comprobando estabilidad: mantené la hoja quieta y acercá la cámara.');return;
    }
    // Image space uses +Y toward the top of the image, +Z toward the viewer.
    // The model uses +Y as height and -Z as plan north: rotate it by +90° X.
    const orientation=q.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2));
    const mk=S.trazado.marcador,scale=mk.escala/(S.factorImpresion||1);
    if(!(scale>0 && Number.isFinite(scale)))return;
    const local=motor.centroMarcador(S.trazado,mk).multiplyScalar(1/scale);
    S.grupo.quaternion.copy(orientation);
    S.grupo.position.copy(center).sub(local.applyQuaternion(orientation));
    S.grupo.scale.setScalar(1/scale);S.escala=scale;S.escalaEf=scale;
    S.grupo.visible=true;S.anclado=true;S.fijado=true;S.papelSinAncla=true;
    S._mkLock={pos:S.grupo.position.clone(),rotY:S.rotY};S._pedirAncla=false;
    document.getElementById('btnFijar').textContent='Vinculado a hoja';
    UI.msg('Modelo vinculado al plano. Conservá el QR visible; si perdés la referencia, volvé a apuntarlo.');
  }
  function lost(){reset();if(S.grupo)S.grupo.visible=false;UI.msg('QR fuera de vista. Volvé a apuntar al marcador completo para recuperar la posición.');}
  window.MSStability={marker,lost,reset};
})();
