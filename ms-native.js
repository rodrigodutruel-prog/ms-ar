/* Native paper placement. Coordinates are metres about the complete printed marker.
   QR recognition establishes the pose; ARCore owns subsequent camera tracking.

   v4.16 — LAS MALLAS VIAJAN EN BINARIO. Hasta 4.15 cada vértice iba como números
   de texto en un JSON (positions/normals/colors): con la maqueta de FITECMA
   (108.000 caras después de decimar) eran 23 MB de JSON que el visor armaba con
   326 MB de memoria, y que del lado Java se parseaban DOS veces en objetos Double.
   v4.20 — ESQUEMA 3. Cada vértice ocupa 20 bytes (posición float32, normal y color
   en bytes) en vez de 36, y el blob no viaja dentro del JSON: se pasa por tandas a
   un archivo de la APK (NativePaper.open/append) y recién después se manda el
   encabezado chico con NativePaper.start. Java lee el archivo derecho a un buffer
   de GL: no parsea ningún JSON grande ni decodifica 20 MB de base64 de una vez.
   Las aristas negras del modelo (LineSegments del visor) viajan como lotes de líneas. */
(() => {
  'use strict';
  const {S,UI,motor}=AR,T=THREE;
  const available=()=>!!(window.NativePaper && typeof NativePaper.start==='function');
  const MAX_TRIANGULOS=250000,STRIDE=20,TANDA=768*1024;   // bytes por vértice; bytes binarios por tanda (1 MB en base64)
  let active=false;
  // base64 de un arreglo de bytes, por tandas (String.fromCharCode con millones de
  // argumentos revienta la pila).
  function base64(bytes){
    if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const partes=[];
    for(let i=0;i<bytes.length;i+=0x8000)partes.push(String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000)));
    return btoa(partes.join(''));
  }
  const clamp01=v=>v<0?0:v>1?1:v;
  function buildMeshes(group,center,scale){
    if(new Uint8Array(new Uint16Array([1]).buffer)[0]!==1)throw new Error('Este dispositivo no es little-endian.');
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
    const meshes=[],blobs=[];let offset=0;
    for(const lote of lotes.values()){
      const wire=lote.lines||!!lote.material.wireframe,porVertice=(wire&&!lote.lines)?2:1;   // alambre: cada triángulo son 3 segmentos = 6 vértices; las aristas ya vienen de a pares
      const col=lote.material.color||new T.Color(1,1,1),count=lote.count*porVertice,buf=new ArrayBuffer(count*STRIDE);
      lote.f32=new Float32Array(buf);lote.i8=new Int8Array(buf);lote.u8=new Uint8Array(buf);lote.at=0;lote.wire=wire;
      lote.tint=[col.r,col.g,col.b];
      lote.out={offset,count,color:[col.r,col.g,col.b],opacity:lote.material.transparent?lote.material.opacity:1,
                roughness:lote.material.roughness??.65,metalness:lote.material.metalness??0,wireframe:wire};
      meshes.push(lote.out);blobs.push(lote.u8);offset+=count*STRIDE;
    }
    const esquina=[new Float32Array(9),new Float32Array(9),new Float32Array(9)];
    const ORDEN_TRI=[0,1,2],ORDEN_LINEAS=[0,1,1,2,2,0];
    // un vértice del blob: xyz float32, normal en bytes con signo (+1 de relleno), color en bytes (+1 de relleno)
    function poner(lote,x,y,z,nx,ny,nz,r,g,b){
      const at=lote.at,w=at>>2,f32=lote.f32,i8=lote.i8,u8=lote.u8,tint=lote.tint;
      f32[w]=x;f32[w+1]=y;f32[w+2]=z;
      i8[at+12]=Math.round(nx*127);i8[at+13]=Math.round(ny*127);i8[at+14]=Math.round(nz*127);i8[at+15]=0;
      u8[at+16]=Math.round(clamp01(r*tint[0])*255);u8[at+17]=Math.round(clamp01(g*tint[1])*255);u8[at+18]=Math.round(clamp01(b*tint[2])*255);u8[at+19]=255;
      lote.at=at+STRIDE;
    }
    recorrer((material,vertexColors,start,count,idx,pos,ns,colors,lines)=>{
      const lote=lotes.get(claveDe(material,vertexColors,lines)),orden=lote.wire?ORDEN_LINEAS:ORDEN_TRI;
      if(lines){
        for(let k=start;k<start+count;k++){
          const at=idx?idx.getX(k):k;
          p.fromBufferAttribute(pos,at).applyMatrix4(mat4).sub(center).multiplyScalar(scale);
          if(!(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)))throw new Error('El modelo contiene coordenadas inválidas.');
          poner(lote,p.x,p.y,p.z,0,1,0,1,1,1);
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
        for(const t of orden){const c=esquina[t];poner(lote,c[0],c[1],c[2],c[3],c[4],c[5],c[6],c[7],c[8]);}
      }
    });
    for(const lote of lotes.values()){if(lote.at!==lote.count*(lote.wire&&!lote.lines?2:1)*STRIDE)throw new Error('El modelo contiene una malla incompleta.');lote.f32=lote.i8=null;}
    return {meshes,blobs};
  }
  // Sobre plano impreso SOLO si el archivo trae su hoja con QR; si no, se apoya
  // sobre una superficie (antes: error "Abrí el JSON..." con cualquier OBJ suelto).
  function sobreHoja(){return !!(S.modoPapel&&S.trazado?.marcador?.png);}
  // el encabezado lleva los blobs colgados en una propiedad NO enumerable: JSON.stringify no los incluye
  // HERRAMIENTAS (v4.27): los tramos del sistema para la FICHA al tocar y el AIRE en los conductos, en el mismo
  // sistema que las mallas (matrixWorld - centro, por la escala). a -> b = sentido del aire: de las captaciones hacia
  // el equipo (la punta libre mas cercana al equipo de la planta, o el ventilador del trazado; si no hay, la punta
  // del caño mas gordo). Paquete MS: Ø, velocidad y largo tal como los calculo la Calculadora; trazado simple: Ø.
  function ductosDe(tz,group,center,scale){
    if(!tz)return null;const M=group.matrixWorld,lista=[];let raiz=null,cerca=null;
    const W=v=>v.clone().applyMatrix4(M).sub(center).multiplyScalar(scale);
    if(tz.esMS&&tz.paq&&Array.isArray(tz.paq.tramos)){
      const paq=tz.paq,cx=tz.cx,cz=tz.cz,V=p=>new T.Vector3(p.x-cx,(p.z||0),p.y-cz);
      const clave=p=>[p.x,p.y,p.z||0].map(v=>Math.round(v*1000)).join(',');
      for(const t of paq.tramos){if(!t||!t.a||!t.b||!(t.d_mm>0))continue;
        lista.push({id:t.id,tipo:t.tipo,A:V(t.a),B:V(t.b),d:t.d_mm/1000,v:t.v_ms,largo:t.largo_m,ka:t.nodo_a||clave(t.a),kb:t.nodo_b||clave(t.b)});}
      const eq=(paq.planta||[]).find(pl=>pl&&pl.tipo==='equipo'&&pl.x!=null);
      if(eq)cerca=new T.Vector3(eq.x-cx,0,eq.y-cz);
    }else if(tz.nodos&&Array.isArray(tz.tramos)){
      tz.tramos.forEach((t,i)=>{const A=tz.nodos[t.de],B=tz.nodos[t.a];if(A&&B&&t.d>0)lista.push({id:'T'+(i+1),tipo:t.tipo,A,B,d:t.d,v:0,largo:null,ka:t.de,kb:t.a});});
      raiz=tz.ventilador;
    }
    const tramos=lista.filter(e=>e.A.distanceTo(e.B)>=.003);if(!tramos.length)return null;
    const ady=new Map(),pos=new Map();
    for(const e of tramos)for(const [k,p] of [[e.ka,e.A],[e.kb,e.B]]){if(!ady.has(k)){ady.set(k,[]);pos.set(k,p);}ady.get(k).push(e);}
    const hojas=[...ady.keys()].filter(k=>ady.get(k).length===1),dist=k=>Math.hypot(pos.get(k).x-cerca.x,pos.get(k).z-cerca.z);
    hojas.sort(cerca?(a,b)=>dist(a)-dist(b):(a,b)=>ady.get(b)[0].d-ady.get(a)[0].d);
    const raices=(raiz&&ady.has(raiz)?[raiz]:[]).concat(hojas,[...ady.keys()]),abajo=new Map(),visto=new Set();
    for(const r of raices){if(visto.has(r))continue;visto.add(r);const cola=[r];
      for(let i=0;i<cola.length;i++){const k=cola[i];for(const e of ady.get(k)){if(abajo.has(e))continue;abajo.set(e,k);const o=e.ka===k?e.kb:e.ka;if(!visto.has(o)){visto.add(o);cola.push(o);}}}}
    const r5=x=>Math.round(x*1e5)/1e5;
    return tramos.map(e=>{
      const haciaA=abajo.get(e)===e.ka&&e.ka!==e.kb,A=W(haciaA?e.B:e.A),B=W(haciaA?e.A:e.B),v=Number(e.v),L=Number(e.largo);
      return {id:String(e.id||''),tipo:String(e.tipo||''),a:[r5(A.x),r5(A.y),r5(A.z)],b:[r5(B.x),r5(B.y),r5(B.z)],d:e.d,
              v:Number.isFinite(v)&&v>0?v:0,largo:Number.isFinite(L)&&L>0?L:Math.round(e.A.distanceTo(e.B)*1000)/1000};
    });
  }
  /** Lo que las herramientas de la vista nativa necesitan del archivo: tramos, velocidad de diseño y chapa. */
  function extrasHerramientas(tz,group,center,scale){
    const out={};
    try{const d=ductosDe(tz,group,center,scale);if(d&&d.length)out.ductos=d;}catch(e){console.warn('AR: sin tramos para las herramientas',e);}
    const paq=tz&&tz.esMS?tz.paq:null;
    if(paq){
      const vd=Number(paq.material?.vel_transporte_ms??paq.vel_transporte_diseno_ms);if(Number.isFinite(vd)&&vd>0)out.velDiseno=vd;
      if(paq.chapa?.nombre)out.chapa=String(paq.chapa.nombre);
      const e=paq.chapa?.espesores_mm||{},t=[[400,e.hasta_400_mm],[1000,e.hasta_1000_mm],[1e9,e.mayor_1000_mm]].map(f=>[f[0],Number(f[1])]).filter(f=>Number.isFinite(f[1])&&f[1]>0);
      if(t.length)out.espesores=t;
    }
    return out;
  }
  function conBlobs(header,blobs){Object.defineProperty(header,'_blobs',{value:blobs,enumerable:false});return header;}
  async function payload(){
    const tz=S.trazado,mk=tz?.marcador;
    if(!tz)throw new Error('Primero abrí un modelo.');
    if(!sobreHoja()){
      let factor=1/Math.max(1,S.escala||1);
      const max=Math.max(tz.medidas.x,tz.medidas.y,tz.medidas.z,.001);
      if(S.escala>1)factor=Math.max(.30/max,Math.min(2/max,factor));
      const group=motor.construirGrupo(tz);
      try{for(const key of ['grpPiso','grpSombra','grpEtiq','grpRef'])if(group.userData[key])group.userData[key].visible=false;
        const {meshes,blobs}=buildMeshes(group,new T.Vector3(),factor);
        return conBlobs(Object.assign({schema:3,placement:'surface',title:tz.obra||'Modelo',realScale:factor,meshes},extrasHerramientas(tz,group,new T.Vector3(),factor)),blobs);}finally{motor.liberarObjeto(group,tz.geo);}
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
      // REPLANTEO EN OBRA (v4.27): el modelo va SIEMPRE a tamaño real; una marca impresa reducida solo cambia su ancho
      const esc=mk.replanteo?1:factor/scale;
      const {meshes,blobs}=buildMeshes(group,center,esc);
      return conBlobs(Object.assign({schema:3,title:mk.replanteo?(tz.obra||tz.nombre||'Replanteo'):(tz.nombre||'Modelo sobre la hoja'),realScale:esc,marker:{image:mk.png,widthMeters:width,qr:{text:geometry.text,fraction:geometry.fraction,dx:geometry.dx,dy:geometry.dy}},meshes},extrasHerramientas(tz,group,center,esc)),blobs);
    }finally{motor.liberarObjeto(group,tz.geo);}
  }
  async function start(){
    if(!available()||active||S._iniciando||S._cargando||S.session||S.modo3D||S.papelCamera)return false;
    active=true;S._iniciando='native-paper';document.getElementById('btnAR').disabled=true;
    UI.estado(sobreHoja()?'Preparando el modelo para reconocer su QR y fijarlo sobre la hoja…':
      (S.modoPapel?'Este modelo no trae la hoja con QR: se apoya sobre una superficie. Preparando…':'Preparando el modelo para apoyarlo sobre una superficie…'),'ok');
    let token='';
    try{
      // Yield so the preparing message is drawn before exporting a complex model.
      await new Promise(resolve=>setTimeout(resolve,30));
      const header=await payload(),blobs=header._blobs;
      const total=blobs.reduce((s,b)=>s+b.byteLength,0);
      if(total>60*1024*1024)throw new Error('El modelo es demasiado grande para esta vista. Exportá una copia simplificada.');
      // TRANSFERENCIA por tandas al archivo de la APK; una APK anterior a 4.20 no tiene open()
      if(typeof NativePaper.open!=='function')throw new Error('Esta versión necesita la APK 4.20 o posterior. Bajala desde el link de arriba o de Más opciones.');
      token=String(NativePaper.open()||'');
      if(!token)throw new Error('No se pudo preparar el modelo para la vista AR. Cerrá y volvé a abrir la aplicación.');
      let enviados=0;
      for(const b of blobs)for(let i=0;i<b.byteLength;i+=TANDA){
        if(!NativePaper.append(token,base64(b.subarray(i,i+TANDA))))throw new Error('No se pudo transferir el modelo a la vista AR. Probá de nuevo.');
        enviados+=Math.min(TANDA,b.byteLength-i);
        if(total>4*TANDA){UI.estado('Pasando el modelo a la vista AR… '+Math.round(enviados/total*100)+' %','ok');await new Promise(r=>setTimeout(r,0));}
      }
      header.blob=token;
      NativePaper.start(JSON.stringify(header));
      return true;
    }catch(e){if(token){try{NativePaper.abort(token);}catch(_){}}release();UI.estado(e.message||'No se pudo preparar el modelo.','err');return false;}
  }
  function release(){active=false;if(S._iniciando==='native-paper')S._iniciando=null;AR.revisarSoporte();}
  window.addEventListener('native-paper-closed',release);
  window.addEventListener('native-paper-error',e=>{release();UI.estado(e.detail?.message||String(e.detail||'No se pudo iniciar la cámara AR.'),'err');});
  // ARCHIVOS RECIBIDOS desde otra app (WhatsApp, Archivos, correo): la APK los copió a su caché y avisa con
  // 'native-files' {files:[{name,url}]}. Se bajan por la misma origen y entran por cargarArchivos, como del selector.
  window.addEventListener('native-files',async e=>{
    const items=Array.isArray(e.detail?.files)?e.detail.files:[];if(!items.length)return;
    const nombres=items.map(i=>i.name).join(', ');recibiendo=true;
    try{
      UI.estado('Recibiendo '+nombres+'…','ok');try{AR.registrar&&AR.registrar('archivo recibido: '+nombres);}catch(_){}
      const files=[];
      for(const it of items){let r=null;try{r=await fetch(it.url,{cache:'no-store'});}catch(_){}if(!r||!r.ok)throw new Error('No se pudo leer '+it.name+'. Volvé a compartirlo o abrilo con Seleccionar archivo.');files.push(new File([await r.blob()],it.name));}
      const ok=await AR.cargarArchivos(files);
      if(ok){UI.estado('Modelo recibido: '+nombres+'. Ya podés fijarlo en AR.','ok');barraRecibido(items);}
    }catch(x){UI.estado('Archivo recibido: '+(x.message||x),'err');try{AR.registrar&&AR.registrar('archivo recibido, error: '+(x.message||x));}catch(_){}}
    finally{recibiendo=false;}
  });
  let recibiendo=false;   // mientras se abre lo recibido, sus eventos de carga no sacan la barra de guardar/compartir
  // GUARDAR / COMPARTIR EL MODELO RECIBIDO (v4.28): lo que llegó a la app (de la PC con Inventor, de WhatsApp…) ya está
  // preparado para la app; se guarda en Descargas del teléfono o se manda a otra persona, que lo abre directo con la app.
  // La APK usa el archivo tal cual lo recibió (no pasa de nuevo por la web). Otro modelo abierto saca la barra.
  function barraRecibido(items){
    let bar=document.getElementById('msRecibido');
    if(!window.NativePaper||typeof NativePaper.guardarRecibido!=='function'||typeof NativePaper.compartirRecibido!=='function'){if(bar)bar.remove();return;}
    if(!bar){bar=document.createElement('div');bar.id='msRecibido';bar.className='fila';bar.style.cssText='margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center';
      const est=document.getElementById('estadoAR');if(est)est.after(bar);else return;}
    const urls=JSON.stringify(items.map(i=>String(i.url))),nombre=(items.find(i=>/\.(obj|stl|json)$/i.test(i.name))||items[0]).name;
    const g=document.createElement('button');g.type='button';g.className='mini';g.id='msGuardarRecibido';g.textContent='Guardar en el teléfono';
    g.title='Una copia de '+nombre+' en Descargas del teléfono, lista para abrir con la app';g.onclick=()=>NativePaper.guardarRecibido(urls);
    const c=document.createElement('button');c.type='button';c.className='mini';c.id='msCompartirRecibido';c.textContent='Compartir';
    c.title='Mandar '+nombre+' por WhatsApp, correo o Drive: del otro lado se abre directo con la app';c.onclick=()=>NativePaper.compartirRecibido(urls);
    bar.replaceChildren(g,c);bar.dataset.urls=urls;
  }
  for(const ev of ['ar:files-loaded','ar:model-loaded'])window.addEventListener(ev,()=>{if(recibiendo)return;const b=document.getElementById('msRecibido');if(b)b.remove();});
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
  // con estado:true también se muestra en la línea de estado (avance de un STL grande que se reduce en el teléfono, v4.22)
  window.addEventListener('native-log',e=>{const t=String(e.detail?.text||'');if(!t)return;try{AR.registrar&&AR.registrar('APK: '+t);}catch(_){}if(e.detail?.error)UI.estado(t,'err');else if(e.detail?.estado)UI.estado(t,'ok');});
  window.MSNative={available,start,payload,buildMeshes,ductosDe,extrasHerramientas,base64,sobreHoja,STRIDE,get active(){return active;}};
  if(available()){
    document.documentElement.dataset.nativePaper='true';
    const select=document.getElementById('msModoPapel');select.value='automatico';
    const radio=document.querySelector('input[name=modo][value=papel]');radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));
    AR.revisarSoporte();
  }else{
    const card=document.createElement('div');card.className='nota';card.id='nativeInstall';
    card.textContent='La APK 4.28 suma guardar en el teléfono y compartir el modelo que llega de la PC (o de WhatsApp), listo para abrir en la app, y una persona que recorre el mapa de lo real de a poco (sin tironcitos); sobre la 4.27: herramientas en la vista AR (choques en rojo, cinta métrica, ficha, aire en los conductos, corte, rayos X y video), el ingeniero que esquiva paredes y equipos reales, replanteo en obra a tamaño real y colores de Inventor. ';
    const link=document.createElement('a'),ms=AR.CFG.marca==='MS';
    link.textContent='Descargar APK 4.28';
    link.href='https://github.com/rodrigodutruel-prog/'+(ms?'ms-ar':'3ddut-ar')+'/releases/download/v4.28.0/'+(ms?'MS_AR':'3DDUT_AR')+'_v4.28.0.apk';
    card.append(link);document.getElementById('msModoPapel').after(card);
  }
})();
