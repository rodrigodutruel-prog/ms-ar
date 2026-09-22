/* Native paper placement. Coordinates are metres about the complete printed marker.
   QR recognition establishes the pose; ARCore owns subsequent camera tracking.

   v4.16 — LAS MALLAS VIAJAN EN BINARIO. Hasta 4.15 cada vértice iba como números
   de texto en un JSON (positions/normals/colors): con la maqueta de FITECMA
   (108.000 caras después de decimar) eran 23 MB de JSON que el visor armaba con
   326 MB de memoria, y que del lado Java se parseaban DOS veces en objetos Double.
   Ahora cada lote es un Float32Array intercalado (posición, normal, color = 9
   floats por vértice), en base64 little-endian: 4 bytes por número en vez de ~9
   caracteres, y Java lo copia derecho a un buffer de GL sin parsear nada.
   Schema 2. La APK 4.16 lo lee; la 4.15 no (avisa "formato no compatible").
   Las aristas negras del modelo (LineSegments del visor) viajan como lotes de lineas. */
(() => {
  'use strict';
  const {S,UI,motor}=AR,T=THREE;
  const available=()=>!!(window.NativePaper && typeof NativePaper.start==='function');
  const MAX_TRIANGULOS=250000;
  let active=false;

  // base64 de un Float32Array, por tandas (String.fromCharCode con millones de
  // argumentos revienta la pila).
  function base64(f32){
    const bytes=new Uint8Array(f32.buffer,f32.byteOffset,f32.byteLength);
    const partes=[];
    for(let i=0;i<bytes.length;i+=0x8000)partes.push(String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000)));
    return btoa(partes.join(''));
  }
  function buildMeshes(group,center,scale){
    const p=new T.Vector3(),n=new T.Vector3(),mat4=new T.Matrix4(),instance=new T.Matrix4(),normal=new T.Matrix3();
    const excluidos=['grilla','etiquetas','referencia','replanteo'];
    group.updateMatrixWorld(true);
    // Un solo recorrido, usado dos veces: primero para CONTAR (y reservar los
    // buffers exactos), después para LLENAR. Sin arreglos de números en el medio.
    function recorrer(f){
      let total=0;
      (function visit(o,parentVisible){
        if(!parentVisible||!o.visible||excluidos.includes(o.userData.rol))return;
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
                total+=count;
                f(material,!!(colors&&material.vertexColors),range.start,count,idx,pos,ns,colors);
              }
            }
          }
        }
        if(o.isLineSegments){
          // aristas del modelo: pares de vertices, sin luz (el shader las pinta planas)
          const g=o.geometry,pos=g.getAttribute('position'),material=o.material;
          if(pos&&material&&material.visible!==false){
            const idx=g.index,count=(idx?idx.count:pos.count)&~1;
            if(count){mat4.copy(o.matrixWorld);f(material,false,0,count,idx,pos,null,null,true);}
          }
        }
        for(const child of o.children)visit(child,true);
      })(group,true);
      return total;
    }
    const claveDe=(material,vertexColors,lines)=>{
      const col=material.color||new T.Color(1,1,1),opacity=material.transparent?material.opacity:1;
      return [col.r,col.g,col.b,opacity,!!material.wireframe,material.roughness,material.metalness,vertexColors,!!lines].join(':');
    };
    const lotes=new Map();
    const total=recorrer((material,vertexColors,start,count,idx,pos,ns,colors,lines)=>{
      const k=claveDe(material,vertexColors,lines);let lote=lotes.get(k);
      if(!lote){lote={material,vertexColors,lines:!!lines,count:0};lotes.set(k,lote);}
      lote.count+=count;
    });
    if(!total)throw new Error('El archivo no contiene superficies 3D visibles.');
    if(total/3>MAX_TRIANGULOS)throw new Error('El modelo supera '+MAX_TRIANGULOS.toLocaleString('es-AR')+' triángulos. Exportá una copia simplificada para AR.');
    const meshes=[];
    for(const lote of lotes.values()){
      const wire=lote.lines||!!lote.material.wireframe,porVertice=(wire&&!lote.lines)?2:1;   // alambre: cada triángulo son 3 segmentos = 6 vértices; las aristas ya vienen de a pares
      const col=lote.material.color||new T.Color(1,1,1);
      lote.data=new Float32Array(lote.count*porVertice*9);lote.at=0;lote.wire=wire;
      lote.out={vertices:'',count:lote.count*porVertice,color:[col.r,col.g,col.b],opacity:lote.material.transparent?lote.material.opacity:1,
                roughness:lote.material.roughness??.65,metalness:lote.material.metalness??0,wireframe:wire};
      meshes.push(lote.out);
    }
    const esquina=[new Float32Array(9),new Float32Array(9),new Float32Array(9)];
    const ORDEN_TRI=[0,1,2],ORDEN_LINEAS=[0,1,1,2,2,0];
    recorrer((material,vertexColors,start,count,idx,pos,ns,colors,lines)=>{
      const lote=lotes.get(claveDe(material,vertexColors,lines)),d=lote.data,orden=lote.wire?ORDEN_LINEAS:ORDEN_TRI;
      if(lines){
        for(let k=start;k<start+count;k++){
          const at=idx?idx.getX(k):k;
          p.fromBufferAttribute(pos,at).applyMatrix4(mat4).sub(center).multiplyScalar(scale);
          if(!(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)))throw new Error('El modelo contiene coordenadas inválidas.');
          d[lote.at]=p.x;d[lote.at+1]=p.y;d[lote.at+2]=p.z;d[lote.at+3]=0;d[lote.at+4]=1;d[lote.at+5]=0;d[lote.at+6]=d[lote.at+7]=d[lote.at+8]=1;lote.at+=9;
        }
        return;
      }
      for(let k=start;k<start+count;k+=3){
        for(let t=0;t<3;t++){
          const at=idx?idx.getX(k+t):k+t,c=esquina[t];
          p.fromBufferAttribute(pos,at).applyMatrix4(mat4).sub(center).multiplyScalar(scale);
          n.fromBufferAttribute(ns,at).applyMatrix3(normal).normalize();
          if(!(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)))throw new Error('El modelo contiene coordenadas inválidas.');
          c[0]=p.x;c[1]=p.y;c[2]=p.z;c[3]=n.x;c[4]=n.y;c[5]=n.z;
          if(vertexColors){c[6]=colors.getX(at);c[7]=colors.getY(at);c[8]=colors.getZ(at);}else{c[6]=c[7]=c[8]=1;}
        }
        for(const t of orden){d.set(esquina[t],lote.at);lote.at+=9;}
      }
    });
    for(const lote of lotes.values()){lote.out.vertices=base64(lote.data);lote.data=null;}
    return meshes;
  }
  // Sobre plano impreso SOLO si el archivo trae su hoja con QR; si no, se apoya
  // sobre una superficie (antes: error "Abrí el JSON..." con cualquier OBJ suelto).
  function sobreHoja(){return !!(S.modoPapel&&S.trazado?.marcador?.png);}
  async function payload(){
    const tz=S.trazado,mk=tz?.marcador;
    if(!tz)throw new Error('Primero abrí un modelo.');
    if(!sobreHoja()){
      let factor=1/Math.max(1,S.escala||1);
      const max=Math.max(tz.medidas.x,tz.medidas.y,tz.medidas.z,.001);
      if(S.escala>1)factor=Math.max(.30/max,Math.min(2/max,factor));
      const group=motor.construirGrupo(tz);
      try{for(const key of ['grpPiso','grpSombra','grpEtiq','grpRef'])if(group.userData[key])group.userData[key].visible=false;return {schema:2,placement:'surface',title:tz.obra||'Modelo',meshes:buildMeshes(group,new T.Vector3(),factor)};}finally{motor.liberarObjeto(group,tz.geo);}
    }
    // Resolve the ruler measurement against THIS file, including measurements entered before loading it.
    const measured=document.getElementById('qrMedido'),raw=measured?.value.trim()||'';
    if(raw&&(!Number.isFinite(Number(raw))||Number(raw)<=10||Number(raw)>2000))throw new Error('Revisá la medida del marco completo: debe ser mayor a 10 mm y no superar 2000 mm.');
    const factor=raw?Number(raw)/Number(mk.lado_mm):(S.factorImpresion||1),scale=Number(mk.escala),width=Number(mk.lado_mm)*.001*factor;
    if(!(scale>0&&Number.isFinite(scale)&&width>=.01&&width<=2&&factor>0))throw new Error('El archivo no indica una escala y un tamaño de marcador válidos.');
    const geometry=await MSPaper.embeddedMarker(mk),center=motor.centroMarcador(tz,mk);
    const group=motor.construirGrupo(tz);
    try{
      for(const key of ['grpPiso','grpSombra','grpEtiq','grpRef'])if(group.userData[key])group.userData[key].visible=false;
      if(group.userData.grpMaq)group.userData.grpMaq.visible=S.verMaquinas!==false;
      // Native tracks the full bitmap: the QR offset belongs only to the QR locator.
      return {schema:2,title:tz.nombre||'Modelo sobre la hoja',marker:{image:mk.png,widthMeters:width,qr:{text:geometry.text,fraction:geometry.fraction,dx:geometry.dx,dy:geometry.dy}},meshes:buildMeshes(group,center,factor/scale)};
    }finally{motor.liberarObjeto(group,tz.geo);}
  }
  async function start(){
    if(!available()||active||S._iniciando||S._cargando||S.session||S.modo3D||S.papelCamera)return false;
    active=true;S._iniciando='native-paper';document.getElementById('btnAR').disabled=true;
    UI.estado(sobreHoja()?'Preparando el modelo para reconocer su QR y fijarlo sobre la hoja…':
      (S.modoPapel?'Este modelo no trae la hoja con QR: se apoya sobre una superficie. Preparando…':'Preparando el modelo para apoyarlo sobre una superficie…'),'ok');
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
  // ARCHIVOS RECIBIDOS desde otra app (WhatsApp, Archivos, correo): la APK los copió a su caché y avisa con
  // 'native-files' {files:[{name,url}]}. Se bajan por la misma origen y entran por cargarArchivos, como del selector.
  window.addEventListener('native-files',async e=>{
    const items=Array.isArray(e.detail?.files)?e.detail.files:[];if(!items.length)return;
    const nombres=items.map(i=>i.name).join(', ');
    try{
      UI.estado('Recibiendo '+nombres+'…','ok');try{AR.registrar&&AR.registrar('archivo recibido: '+nombres);}catch(_){}
      const files=[];
      for(const it of items){let r=null;try{r=await fetch(it.url,{cache:'no-store'});}catch(_){}if(!r||!r.ok)throw new Error('No se pudo leer '+it.name+'. Volvé a compartirlo o abrilo con Seleccionar archivo.');files.push(new File([await r.blob()],it.name));}
      const ok=await AR.cargarArchivos(files);
      if(ok)UI.estado('Modelo recibido: '+nombres+'. Ya podés fijarlo en AR.','ok');
    }catch(x){UI.estado('Archivo recibido: '+(x.message||x),'err');try{AR.registrar&&AR.registrar('archivo recibido, error: '+(x.message||x));}catch(_){}}
  });
  // VERSION NUEVA: la APK consulta el release al abrir y avisa con 'native-update' {version,url}. La tarjeta
  // va arriba, con el link a la APK; en la APK el link se abre en el navegador del teléfono y se instala encima.
  window.addEventListener('native-update',e=>{
    const v=String(e.detail?.version||''),url=String(e.detail?.url||'');if(!v||!/^https:\/\//.test(url))return;
    let card=document.getElementById('nativeUpdate');
    // ARRIBA DE TODO (primera tarjeta de la página): debajo del selector de hoja quedaba oculta en la APK.
    if(!card){card=document.createElement('section');card.className='card';card.id='nativeUpdate';card.style.borderColor='#30d69b';const main=document.querySelector('main')||document.body;main.insertBefore(card,main.firstElementChild);}
    card.textContent='Hay una versión nueva de la aplicación: '+v+' (instalada: '+(window.NativePaper?.version?.()||'?')+'). Se instala encima, sin desinstalar, y conserva la biblioteca. ';
    const link=document.createElement('a');link.textContent='Descargar APK '+v;link.href=url;link.target='_blank';link.rel='noopener';card.append(link);
    UI.estado('Hay una versión nueva de la aplicación ('+v+'). El link para bajarla está arriba.','ok');
    try{AR.registrar&&AR.registrar('versión nueva publicada: '+v);}catch(_){}
  });
  // REGISTRO: lo que pasa en la APK (archivos recibidos, consulta de versión) queda en el Diagnóstico del
  // teléfono, que antes venía vacío porque la parte nativa no escribía ahí.
  window.addEventListener('native-log',e=>{const t=String(e.detail?.text||'');if(!t)return;try{AR.registrar&&AR.registrar('APK: '+t);}catch(_){}if(e.detail?.error)UI.estado(t,'err');});
  window.MSNative={available,start,payload,buildMeshes,base64,sobreHoja,get active(){return active;}};
  if(available()){
    document.documentElement.dataset.nativePaper='true';
    const select=document.getElementById('msModoPapel');select.value='automatico';
    const radio=document.querySelector('input[name=modo][value=papel]');radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));
    AR.revisarSoporte();
  }else{
    const card=document.createElement('div');card.className='nota';card.id='nativeInstall';
    card.textContent='La APK 4.19 abre un OBJ, STL o JSON con un toque desde WhatsApp, Archivos o el correo, y suma Volcar y Ladear en la vista AR para parar una pieza acostada. Conserva Ubicar, Ajustar, Fijar, sombras, texturas, oclusión y Foto. ';
    const link=document.createElement('a'),ms=AR.CFG.marca==='MS';
    link.textContent='Descargar APK 4.19';
    link.href='https://github.com/rodrigodutruel-prog/'+(ms?'ms-ar':'3ddut-ar')+'/releases/download/v4.19.4/'+(ms?'MS_AR':'3DDUT_AR')+'_v4.19.4.apk';
    card.append(link);document.getElementById('msModoPapel').after(card);
  }
})();
