/* Native paper placement. Coordinates are metres about the complete printed marker.
   QR recognition establishes the pose; ARCore owns subsequent camera tracking. */
(() => {
  'use strict';
  const {S,UI,motor}=AR,T=THREE;
  const available=()=>!!(window.NativePaper && typeof NativePaper.start==='function');
  let active=false;
  function buildMeshes(group,center,scale){
    const batches=new Map(), meshes=[];let total=0;
    const p=new T.Vector3(),n=new T.Vector3(),mat4=new T.Matrix4(),instance=new T.Matrix4(),normal=new T.Matrix3();
    group.updateMatrixWorld(true);
    const round=x=>{if(!Number.isFinite(x))throw new Error('El modelo contiene coordenadas inválidas.');return Math.round(x*1e6)/1e6;};
    function batch(material,vertexColors){
      const col=material.color||new T.Color(1,1,1), opacity=material.transparent?material.opacity:1;
      const key=[col.r,col.g,col.b,opacity,!!material.wireframe,material.roughness,material.metalness,vertexColors].join(':');
      let out=batches.get(key);
      if(!out||out.positions.length>=180000){
        out={positions:[],normals:[],color:[col.r,col.g,col.b],opacity,roughness:material.roughness??.65,metalness:material.metalness??0,wireframe:!!material.wireframe};
        if(vertexColors)out.colors=[];
        batches.set(key,out);meshes.push(out);
      }
      return out;
    }
    function visit(o,parentVisible){
      if(!parentVisible||!o.visible||['grilla','etiquetas','referencia','replanteo'].includes(o.userData.rol))return;
      if(o.isMesh){
        const g=o.geometry,pos=g.getAttribute('position');
        if(pos){
          if(!g.getAttribute('normal'))g.computeVertexNormals();
          const ns=g.getAttribute('normal'),colors=g.getAttribute('color'),idx=g.index;
          const materials=Array.isArray(o.material)?o.material:[o.material];
          const groups=Array.isArray(o.material)?g.groups:[{start:0,count:idx?idx.count:pos.count,materialIndex:0}];
          const instances=o.isInstancedMesh?o.count:1;
          for(let j=0;j<instances;j++){
            mat4.copy(o.matrixWorld);
            if(o.isInstancedMesh){o.getMatrixAt(j,instance);mat4.multiply(instance);}
            normal.getNormalMatrix(mat4);
            for(const range of groups){
              const material=materials[range.materialIndex||0];if(!material||material.visible===false)continue;
              const count=Math.min(range.count,(idx?idx.count:pos.count)-range.start);
              if(count%3)throw new Error('El modelo contiene una malla incompleta.');
              for(let k=range.start;k<range.start+count;k+=3){
                const out=batch(material,!!(colors&&material.vertexColors));
                for(let t=0;t<3;t++){
                  if(++total>750000)throw new Error('El modelo supera 250.000 triángulos. Exportá una copia simplificada para AR.');
                  const at=idx?idx.getX(k+t):k+t;
                  p.fromBufferAttribute(pos,at).applyMatrix4(mat4).sub(center).multiplyScalar(scale);
                  n.fromBufferAttribute(ns,at).applyMatrix3(normal).normalize();
                  out.positions.push(round(p.x),round(p.y),round(p.z));out.normals.push(round(n.x),round(n.y),round(n.z));
                  if(out.colors)out.colors.push(round(colors.getX(at)),round(colors.getY(at)),round(colors.getZ(at)));
                }
              }
            }
          }
        }
      }
      for(const child of o.children)visit(child,true);
    }
    visit(group,true);
    if(!total)throw new Error('El archivo no contiene superficies 3D visibles.');
    return meshes;
  }
  async function payload(){
    const tz=S.trazado,mk=tz?.marcador;
    if(!S.modoPapel){
      if(!tz)throw new Error('Primero abrí un modelo.');
      let factor=1/Math.max(1,S.escala||1);
      const max=Math.max(tz.medidas.x,tz.medidas.y,tz.medidas.z,.001);
      if(S.escala>1)factor=Math.max(.30/max,Math.min(2/max,factor));
      const group=motor.construirGrupo(tz);
      try{for(const key of ['grpPiso','grpSombra','grpEtiq','grpRef'])if(group.userData[key])group.userData[key].visible=false;return {schema:1,placement:'surface',title:tz.obra||'Modelo',meshes:buildMeshes(group,new T.Vector3(),factor)};}finally{motor.liberarObjeto(group,tz.geo);}
    }
    if(!mk?.png)throw new Error('Abrí el JSON de la Calculadora o el OBJ que incluye el QR de su hoja.');
    const factor=S.factorImpresion||1,scale=Number(mk.escala),width=Number(mk.lado_mm)*.001*factor;
    if(!(scale>0&&Number.isFinite(scale)&&width>=.01&&width<=2&&factor>0))throw new Error('El archivo no indica una escala y un tamaño de marcador válidos.');
    const geometry=await MSPaper.embeddedMarker(mk),center=motor.centroMarcador(tz,mk);
    const group=motor.construirGrupo(tz);
    try{
      for(const key of ['grpPiso','grpSombra','grpEtiq','grpRef'])if(group.userData[key])group.userData[key].visible=false;
      if(group.userData.grpMaq)group.userData.grpMaq.visible=S.verMaquinas!==false;
      // Native tracks the full bitmap: the QR offset belongs only to the QR locator.
      return {schema:1,title:tz.nombre||'Modelo sobre la hoja',marker:{image:mk.png,widthMeters:width,qr:{text:geometry.text,fraction:geometry.fraction,dx:geometry.dx,dy:geometry.dy}},meshes:buildMeshes(group,center,factor/scale)};
    }finally{motor.liberarObjeto(group,tz.geo);}
  }
  async function start(){
    if(!available()||active||S._iniciando||S._cargando||S.session||S.modo3D||S.papelCamera)return false;
    active=true;S._iniciando='native-paper';document.getElementById('btnAR').disabled=true;
    UI.estado(S.modoPapel?'Preparando el modelo para reconocer su QR y fijarlo sobre la hoja…':'Preparando el modelo para apoyarlo sobre una superficie…','ok');
    try{
      // Yield so the preparing message is drawn before exporting a complex model.
      await new Promise(resolve=>setTimeout(resolve,30));
      const data=JSON.stringify(await payload());
      if(data.length>64*1024*1024)throw new Error('El modelo es demasiado grande para esta vista. Exportá una copia simplificada.');
      NativePaper.start(data);return true;
    }catch(e){release();UI.estado(e.message||'No se pudo preparar el modelo.','err');return false;}
  }
  function release(){active=false;if(S._iniciando==='native-paper')S._iniciando=null;AR.revisarSoporte();}
  window.addEventListener('native-paper-closed',release);
  window.addEventListener('native-paper-error',e=>{release();UI.estado(e.detail?.message||String(e.detail||'No se pudo iniciar la cámara AR.'),'err');});
  window.MSNative={available,start,payload,buildMeshes,get active(){return active;}};
  if(available()){
    document.documentElement.dataset.nativePaper='true';
    const select=document.getElementById('msModoPapel');select.value='automatico';
    const radio=document.querySelector('input[name=modo][value=papel]');radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));
    AR.revisarSoporte();
  }else{
    const card=document.createElement('div');card.className='nota';card.id='nativeInstall';
    card.textContent='La APK 4.14 incorpora ubicación automática por QR y seguimiento espacial al mover el teléfono. ';
    const link=document.createElement('a'),ms=AR.CFG.marca==='MS';
    link.textContent='Descargar APK 4.14';
    link.href='https://github.com/rodrigodutruel-prog/'+(ms?'ms-ar':'3ddut-ar')+'/releases/download/v4.14.0/'+(ms?'MS_AR':'3DDUT_AR')+'_v4.14.0.apk';
    card.append(link);document.getElementById('msModoPapel').after(card);
  }
})();
