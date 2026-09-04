/* ============================================================
   ar-core.js — NÚCLEO COMPARTIDO de MS AR y 3DDUT AR (v3)
   Realidad aumentada sobre la obra: modelos OBJ (con colores, como
   salen de Inventor / PlanObra) y redes de conductería de la
   Calculadora de Aspiración MS (JSON de fabricación).
   Cada app trae su propio index.html (marca, layout, colores) y le
   pasa window.AR_CONFIG ANTES de cargar este archivo. Los ids del
   DOM que usa el núcleo son los mismos en las dos; si una app no
   tiene alguno, $() devuelve un elemento fantasma y no pasa nada.
   ============================================================ */
const CFG = Object.assign({
  marca: 'AR', version: 'v3.6.4',
  restaurarAncla: false,        // NUNCA volver solo a un anclaje de otra sesión: el modelo aparecía en cualquier lado
  pielDefault: 'altura',        // piel de los OBJ sin color
  cacheCompartido: 'ar-compartido',
  umbral2Puntos: 8              // modelos de más de 8 m se ubican por 2 puntos (galpón / casa)
}, window.AR_CONFIG || {});
const VERSION = CFG.version;
// PALETA del 3D (retícula, banderas, etiquetas…): cada marca pone la suya
const PAL = Object.assign({
  acento: 0xe31e24, acento2: 0x00aeef, aviso: 0xffc400,
  bajo: 0x00c2d1, alto: 0xff6a13,
  ejeX: 0xe31e24, ejeY: 0x21c063, ejeZ: 0x2e6bff,
  grilla: 0x333940, fondoEtiq: 'rgba(9,9,11,0.82)', textoEtiq: '#FFFFFF',
  tuboCyan: 0x00aeef, tuboRojo: 0xe31e24
}, CFG.colores || {});
const cssPal = k => '#' + ('000000' + (PAL[k] >>> 0).toString(16)).slice(-6);


/* ------------------------------------------------------------
   1. ESTADO
   ------------------------------------------------------------ */
const S = {
  trazado: null,      // trazado normalizado
  grupo: null,        // THREE.Group con la conductería
  escala: 1,          // 1 = 1:1 ; 20 = 1:20 ; 50 = 1:50
  anclado: false,
  opacidad: 1,        // la red arranca OPACA; el botón Transparencia baja a 70/45/25 %
  verEtiquetas: true,
  verMaquinas: true,
  verPiso: true,      // replanteo: ejes proyectados, cotas y cruces de tiza en el piso
  offsetY: 0,         // corrección de altura en metros
  rotY: 0,            // rotación en radianes
  fino: false,        // ajuste fino: pasos chicos en rotación/altura
  // v0.8 — anclaje persistente
  anchor: null,       // XRAnchor de la sesión actual
  ancUuid: null,      // handle persistente (sobrevive a cerrar la app)
  ancPos: null, ancQuat: null,     // pose del ancla en el ref space (por frame)
  ancDelta: null,     // offset del trazado respecto del ancla, en coords del ancla
  ancRotLocal: 0,     // rotación del trazado relativa al yaw del ancla
  ancListo: false,    // el ancla ya devolvió una pose trackeada
  ancPersist: false,  // la sesión soporta persistentAnchors
  ultimoHit: null,    // último XRHitTestResult (para crear el ancla sobre el piso)
  // v0.8 — oclusión por profundidad
  oclusion: true,
  ocl: null,          // { mesh, tex, w, h, fmt }
  oclDisponible: false,
  // v0.8 — medición
  midiendo: false,
  esquinando: 0, esqP1: null,    // anclaje por esquina de referencia (2 toques)
  medGrp: null, medPts: [],
  // v1.0 — escuadrar / auto-ajuste
  escuadrando: false, escPts: [],
  autoPend: 0, autoNube: null, modeloPts: null, autoCorriendo: false,
  // v3 — el modelo apoyado puede re-apoyarse con otro toque hasta que se FIJA
  fijado: false,
  modoUbic: 'auto',   // 'auto' | 'toque' | '2puntos' (lo elige el usuario en la pantalla de carga)
  overlayOK: false,
  renderer: null,
  scene: null,
  camera: null,
  reticula: null,
  hitSource: null,
  refSpaceLocal: null,
  session: null,
  modo3D: false,
  raf3D: null
};

const _fantasmas = {};
function _fantasma(id){
  if(!_fantasmas[id]){
    const e = document.createElement('div'); e.dataset.fantasma = id;
    _fantasmas[id] = e;
  }
  return _fantasmas[id];
}
const $ = id => document.getElementById(id) || _fantasma(id);
// atajos de interfaz
// ángulo normalizado a (-π, π]
function angNorm(a){ return Math.atan2(Math.sin(a), Math.cos(a)); }

// EL MARCADOR IMPRESO (QR + marco): la imagen que ARCore rastrea. Un QR pelado
// de 60 mm se reconocía tarde (patrón repetitivo, chico): ahora va más grande
// según la hoja y con un marco negro y esquinas asimétricas, que le dan a
// ARCore rasgos únicos para engancharlo rápido y saber la orientación.
// TODO EN BLANCO Y NEGRO: la primera versión tenía esquinas rojo/cyan y una
// impresora en negro las sacaba grises o negras — distinto de lo que la app
// le daba a ARCore, y no lo reconocía. Así sale igual en cualquier impresora.
// La MISMA función arma lo que se imprime y lo que se rastrea (el PNG embebido).
const MARCADOR_LADO_MM = { a4: 84, a3: 84, a2: 112, a1: 112 };
const MARCADOR_MARGEN_MM = { a4: 100, a3: 100, a2: 130, a1: 130 };
function marcadorCompuesto(qrCv, L){
  L = L || 1000;
  const cv = document.createElement('canvas'); cv.width = cv.height = L;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, L, L);                     // marco negro 5 %
  g.fillStyle = '#fff'; g.fillRect(L*.05, L*.05, L*.90, L*.90);
  g.imageSmoothingEnabled = false;
  g.drawImage(qrCv, L*.18, L*.18, L*.64, L*.64);                    // el QR en el 64 % central
  g.fillStyle = '#000';
  g.fillRect(L*.07, L*.07, L*.09, L*.09);                           // cuadrado lleno arriba-izquierda
  g.fillRect(L*.84, L*.07, L*.09, L*.09); g.fillStyle = '#fff'; g.fillRect(L*.865, L*.095, L*.04, L*.04);   // cuadrado hueco arriba-derecha
  g.fillStyle = '#000';
  g.beginPath(); g.moveTo(L*.84, L*.93); g.lineTo(L*.93, L*.93); g.lineTo(L*.93, L*.84); g.closePath(); g.fill();   // triángulo abajo-derecha
  g.fillRect(L*.07, L*.865, L*.38, L*.065);                          // barra abajo-izquierda
  return cv;
}

const UI = {
  msg:   t => { $('hudMsg').textContent = t; },
  datos: t => { $('hudDatos').textContent = t; },
  paso:  (n, t) => { const e = $('pasoAR'); e.textContent = t || ''; e.dataset.n = n || ''; e.classList.toggle('oculto', !t); },
  estado:(t, clase) => { const e = $('estadoAR'); e.className = 'nota' + (clase ? ' ' + clase : ''); e.innerHTML = t; }
};


/* ------------------------------------------------------------
   2. TRAZADO — parseo y normalización
   Formato esperado (export de la Calculadora de Aspiración):
   {
     "obra":"Nave 2 - Sierras",
     "unidades":"mm",
     "nodos":   { "N1":[x,y,z], ... }          x,y = planta ; z = altura
     "tramos":  [ {"de":"N1","a":"N2","d":200,"tipo":"caño|codo|derivacion"} ],
     "maquinas":[ {"nombre":"Sierra 1","pos":[x,y],"alto":1200} ],
     "ventilador": { "nodo":"N9" }
   }
   ------------------------------------------------------------ */
function parseTrazado(raw){
  if(!raw || !raw.nodos || !raw.tramos) throw new Error('El JSON no tiene "nodos" y "tramos".');
  const f = (raw.unidades === 'm') ? 1 : 0.001;   // todo a metros

  const nodos = {};
  for(const [k,v] of Object.entries(raw.nodos)){
    if(!v || v.length < 3) throw new Error('Nodo inválido: ' + k);
    // planta (x,y) + altura (z)  ->  three (x, altura, y)
    nodos[k] = new THREE.Vector3(v[0]*f, v[2]*f, v[1]*f);
  }

  const tramos = raw.tramos.filter(t => nodos[t.de] && nodos[t.a]).map(t => ({
    de:t.de, a:t.a,
    d:(Number(t.d)||150)*f,
    tipo:t.tipo || 'caño'
  }));
  if(!tramos.length) throw new Error('No hay tramos válidos.');

  const maquinas = (raw.maquinas||[]).map(m => ({
    nombre:m.nombre||'',
    pos:new THREE.Vector3((m.pos?.[0]||0)*f, 0, (m.pos?.[1]||0)*f),
    alto:(m.alto||1000)*f
  }));

  // centrado en planta: el origen queda en el centro de la nube de nodos
  const box = new THREE.Box3();
  Object.values(nodos).forEach(p => box.expandByPoint(p));
  maquinas.forEach(m => box.expandByPoint(m.pos));
  const c = box.getCenter(new THREE.Vector3());
  Object.values(nodos).forEach(p => { p.x -= c.x; p.z -= c.z; });
  maquinas.forEach(m => { m.pos.x -= c.x; m.pos.z -= c.z; });

  return {
    obra: raw.obra || 'Trazado sin nombre',
    nodos, tramos, maquinas,
    ventilador: raw.ventilador?.nodo || null,
    medidas: box.getSize(new THREE.Vector3())
  };
}

/* ------------------------------------------------------------
   3. COLORES POR DIÁMETRO (serie MS 100–1200)
   ------------------------------------------------------------ */
function colorPorDiametro(dMetros, dMin, dMax){
  const t = dMax > dMin ? (dMetros - dMin) / (dMax - dMin) : 0.5;
  const cyan = new THREE.Color(PAL.tuboCyan);
  const rojo = new THREE.Color(PAL.tuboRojo);
  return cyan.clone().lerp(rojo, Math.min(1, Math.max(0, t)));
}

/* ------------------------------------------------------------
   4. CONSTRUCCIÓN DE LA GEOMETRÍA
   ------------------------------------------------------------ */
function etiqueta(texto, color){
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = PAL.fondoEtiq;
  g.fillRect(0,0,256,64);
  g.fillStyle = '#' + color.getHexString();
  g.fillRect(0,0,6,64);
  g.font = 'bold 34px Consolas, monospace';
  g.fillStyle = PAL.textoEtiq;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(texto, 134, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, depthTest:false, transparent:true }));
  sp.userData.esEtiqueta = true;
  return sp;
}

function construirGrupo(tz){
  if(tz && tz.esModelo) return construirGrupoModelo(tz);
  if(tz && tz.esMS) return construirGrupoMS(tz);
  const g = new THREE.Group();
  const ds = tz.tramos.map(t => t.d);
  const dMin = Math.min(...ds), dMax = Math.max(...ds);

  const grpTubos = new THREE.Group();
  const grpEtiq  = new THREE.Group();
  const grpMaq   = new THREE.Group();
  grpEtiq.userData.rol = 'etiquetas';
  grpMaq.userData.rol  = 'maquinas';

  const arriba = new THREE.Vector3(0,1,0);

  tz.tramos.forEach(t => {
    const A = tz.nodos[t.de], B = tz.nodos[t.a];
    const dir = new THREE.Vector3().subVectors(B,A);
    const largo = dir.length();
    if(largo < 1e-6) return;

    const col = colorPorDiametro(t.d, dMin, dMax);
    const mat = new THREE.MeshStandardMaterial({
      color: col, transparent:true, opacity:S.opacidad,
      metalness:.25, roughness:.45,
      emissive: col, emissiveIntensity:.35,
      side: THREE.DoubleSide, depthWrite:false
    });

    const tubo = new THREE.Mesh(
      new THREE.CylinderGeometry(t.d/2, t.d/2, largo, 20, 1, true), mat
    );
    tubo.position.copy(A).addScaledVector(dir, 0.5);
    tubo.quaternion.setFromUnitVectors(arriba, dir.clone().normalize());
    tubo.userData.esTubo = true;
    grpTubos.add(tubo);

    // aristas de contorno: es lo que hace que se lea como holograma
    const aro = new THREE.Mesh(
      new THREE.TorusGeometry(t.d/2, Math.max(t.d*0.035, 0.006), 6, 22),
      new THREE.MeshBasicMaterial({ color: col, transparent:true, opacity:.9 })
    );
    aro.position.copy(B);
    aro.quaternion.copy(tubo.quaternion);
    aro.rotateX(Math.PI/2);
    grpTubos.add(aro);

    if(largo > 0.8/Math.max(1,S.escala) || largo > 0.8){
      const et = etiqueta('Ø' + Math.round(t.d*1000), col);
      et.position.copy(A).addScaledVector(dir, .5).add(new THREE.Vector3(0, t.d/2 + .12, 0));
      et.scale.set(.42, .105, 1);
      grpEtiq.add(et);
    }
  });

  // nodos (codos / derivaciones)
  Object.entries(tz.nodos).forEach(([k,p]) => {
    const conect = tz.tramos.filter(t => t.de===k || t.a===k);
    if(!conect.length) return;
    const dMayor = Math.max(...conect.map(t => t.d));
    const esVent = (tz.ventilador === k);
    const col = esVent ? new THREE.Color(PAL.aviso) : colorPorDiametro(dMayor, dMin, dMax);
    const nodo = new THREE.Mesh(
      new THREE.SphereGeometry(dMayor*0.58, 14, 10),
      new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:.5, wireframe:true })
    );
    nodo.position.copy(p);
    grpTubos.add(nodo);
  });

  // máquinas: caja al piso + línea vertical hasta la boca
  tz.maquinas.forEach(m => {
    const caja = new THREE.Mesh(
      new THREE.BoxGeometry(.9, m.alto, .9),
      new THREE.MeshBasicMaterial({ color:PAL.acento2, transparent:true, opacity:.16, wireframe:true })
    );
    caja.position.set(m.pos.x, m.alto/2, m.pos.z);
    grpMaq.add(caja);
    if(m.nombre){
      const et = etiqueta(m.nombre, new THREE.Color(PAL.acento2));
      et.position.set(m.pos.x, m.alto + .18, m.pos.z);
      et.scale.set(.5, .125, 1);
      grpMaq.add(et);
    }
  });

  // piso de referencia
  const grilla = new THREE.GridHelper(Math.max(tz.medidas.x, tz.medidas.z) + 4, 20, PAL.acento, PAL.grilla);
  grilla.material.transparent = true;
  grilla.material.opacity = .22;
  grilla.userData.rol = 'grilla';
  g.add(grilla);

  g.add(grpTubos); g.add(grpEtiq); g.add(grpMaq);
  g.userData.grpEtiq = grpEtiq;
  g.userData.grpMaq  = grpMaq;
  return g;
}

/* ------------------------------------------------------------
   4bis. PAQUETE MS COMPLETO (export "AR" de la Calculadora v2)
   El mismo paquete de fabricación que lee Inventor: tramos boca a
   boca, nudos con accesorios, máquinas, galpón y la tabla de
   bridas MS. Acá se dibuja PIEZA POR PIEZA: caños en tiras de 3 m
   con sus bridas (agujeros incluidos), codos facetados, derivaciones
   con cuerpo cónico y rama, pantalones y mangueras corrugadas.
   ------------------------------------------------------------ */
function parsePaqueteMS(raw){
  if(!raw.tramos || !raw.tramos.length) throw new Error('El paquete no tiene tramos.');
  let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9,maxz=0;
  raw.tramos.forEach(t => [t.a,t.b].forEach(p => {
    if(!p) return;
    if(p.x<minx)minx=p.x; if(p.x>maxx)maxx=p.x;
    if(p.y<miny)miny=p.y; if(p.y>maxy)maxy=p.y;
    if(p.z>maxz)maxz=p.z;
  }));
  const g = raw.galpon;
  const cx = (g && g.ancho_m>0) ? g.ancho_m/2 : (minx+maxx)/2;
  const cz = (g && g.largo_m>0) ? g.largo_m/2 : (miny+maxy)/2;
  return {
    esMS: true, paq: raw, cx: cx, cz: cz,
    marcador: (raw.ar && raw.ar.marcador) || null,   // reconocimiento del plano impreso
    obra: (raw.proyecto && (raw.proyecto.cliente || raw.proyecto.ot)) || 'Paquete de red',
    medidas: new THREE.Vector3((g&&g.ancho_m)||maxx-minx, maxz||4, (g&&g.largo_m)||maxy-miny)
  };
}

function construirGrupoMS(tz){
  const paq = tz.paq, cx = tz.cx, cz = tz.cz;
  const V = p => new THREE.Vector3(p.x - cx, (p.z||0), p.y - cz);
  const g = new THREE.Group();
  const grpTubos = new THREE.Group(), grpEtiq = new THREE.Group(), grpMaq = new THREE.Group();
  grpEtiq.userData.rol = 'etiquetas';
  grpMaq.userData.rol  = 'maquinas';
  const ejeY = new THREE.Vector3(0,1,0);
  const quatDir = dir => new THREE.Quaternion().setFromUnitVectors(ejeY, dir.clone().normalize());

  // chapa metálica TEÑIDA POR DIÁMETRO (cyan→rojo, la misma escala de la
  // leyenda): se distingue cada Ø de un vistazo sin perder el aspecto real
  const dsTodos = (paq.tramos||[]).map(t => t.d_mm||0).filter(d => d>0);
  const dMinMS = dsTodos.length ? Math.min.apply(null, dsTodos) : 100;
  const dMaxMS = dsTodos.length ? Math.max.apply(null, dsTodos) : 500;
  const _matsD = {};
  function matD(d){
    const k = Math.round(d);
    if(_matsD[k]) return _matsD[k];
    const col = colorPorDiametro(d/1000, dMinMS/1000, dMaxMS/1000)
      .lerp(new THREE.Color(0xc9ced4), 0.35);        // tinte + un toque de chapa
    const _op = (typeof S.opacidad === 'number') ? S.opacidad : 1;
    _matsD[k] = new THREE.MeshStandardMaterial({ color:col, metalness:.75, roughness:.4,
      emissive: col, emissiveIntensity:.18,
      transparent:_op < .99, opacity:_op, side:THREE.DoubleSide, depthWrite:_op >= .99 });
    return _matsD[k];
  }
  const _op0 = (typeof S.opacidad === 'number') ? S.opacidad : 1;
  const matBrida = new THREE.MeshStandardMaterial({ color:0x878e97, metalness:.9, roughness:.3,
    transparent:_op0 < .99, opacity:_op0, depthWrite:_op0 >= .99 });
  const matAguj  = new THREE.MeshBasicMaterial({ color:0x0c0f14, transparent:true, opacity:.95 });
  const matHose  = new THREE.MeshStandardMaterial({ color:0x2f343b, metalness:.15, roughness:.85,
    transparent:_op0 < .99, opacity:_op0, side:THREE.DoubleSide, depthWrite:_op0 >= .99 });

  /* ── TUBO POR GAJOS A INGLETE: cada corte entre gajos va en el plano
        bisector (mitad del ángulo), como se fabrica: sin cuñas ni solapes ── */
  function tuboGajos(pts, r, seg, mat){
    const n = pts.length; if(n < 2) return null;
    const dirs = [];
    for(let i=0;i<n-1;i++) dirs.push(new THREE.Vector3().subVectors(pts[i+1], pts[i]).normalize());
    const perp = d => { const a = Math.abs(d.y) < .9 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0); return new THREE.Vector3().crossVectors(d, a).normalize(); };
    const anillos = [];
    let prevE1 = perp(dirs[0]);
    for(let i=0;i<n;i++){
      const dIn = dirs[Math.max(0, i-1)], dOut = dirs[Math.min(n-2, i)];
      const nrm = (i === 0) ? dirs[0].clone() : (i === n-1 ? dirs[n-2].clone() : dIn.clone().add(dOut).normalize());
      // marco transportado a lo largo del gajo (sin torsión)
      let f1 = prevE1.clone().addScaledVector(dIn, -prevE1.dot(dIn));
      if(f1.lengthSq() < 1e-9) f1 = perp(dIn);
      f1.normalize();
      const f2 = new THREE.Vector3().crossVectors(dIn, f1).normalize();
      prevE1 = f1;
      const dn = Math.max(0.2, dIn.dot(nrm));
      const ring = [];
      for(let k=0;k<seg;k++){
        const a = k/seg*Math.PI*2;
        const q = pts[i].clone().addScaledVector(f1, r*Math.cos(a)).addScaledVector(f2, r*Math.sin(a));
        // proyección del círculo (⊥ al gajo de entrada) sobre el plano bisector, a lo largo del gajo
        const t = new THREE.Vector3().subVectors(pts[i], q).dot(nrm) / dn;
        q.addScaledVector(dIn, t);
        ring.push(q);
      }
      anillos.push(ring);
    }
    // cada gajo con sus propios vértices: suave alrededor, arista dura entre gajos
    const pos = [], idx = [];
    for(let i=0;i<n-1;i++){
      const base = pos.length/3;
      for(let k=0;k<seg;k++){ const q = anillos[i][k]; pos.push(q.x, q.y, q.z); }
      for(let k=0;k<seg;k++){ const q = anillos[i+1][k]; pos.push(q.x, q.y, q.z); }
      for(let k=0;k<seg;k++){
        const k1 = (k+1)%seg;
        idx.push(base+k, base+seg+k, base+seg+k1,  base+k, base+seg+k1, base+k1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.userData.esTubo = true;
    grpTubos.add(m);
    return m;
  }

  function tubo(A, B, d, seg){
    const dir = new THREE.Vector3().subVectors(B, A), L = dir.length();
    if(L < 0.004) return null;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(d/2000, d/2000, L, seg||22, 1, true), matD(d));
    m.position.copy(A).addScaledVector(dir, .5);
    m.quaternion.copy(quatDir(dir));
    m.userData.esTubo = true;
    grpTubos.add(m);
    return m;
  }

  /* ── BRIDAS con agujeros, instanciadas (cientos de piezas sin matar el celu) ── */
  const tabla = (paq.ar && paq.ar.bridas_tabla) || [];
  const bridaCol = {}, agujeros = [], anillos = {};
  function specBrida(d){
    for(let i=0;i<tabla.length;i++) if(tabla[i].d >= d-1) return tabla[i];
    return tabla.length ? tabla[tabla.length-1] : { d:d, esp:4, ancho:32, agujeros:8 };
  }
  // p = la boca; hacia = unitario apuntando hacia el CUERPO de la pieza dueña de la brida
  function addBrida(p, hacia, d){
    const s = specBrida(d), esp = Math.max(s.esp, 3)/1000;
    const u = hacia.clone().normalize();
    const pc = p.clone().addScaledVector(u, esp/2);
    const q = quatDir(u);
    (bridaCol[s.d] = bridaCol[s.d] || { spec:s, dInt:d, items:[] }).items.push({ p:pc, q:q });
    const rB = (d/2 + s.ancho/2)/1000;
    const aux = Math.abs(u.y) < .9 ? ejeY : new THREE.Vector3(1,0,0);
    const e1 = new THREE.Vector3().crossVectors(u, aux).normalize();
    const e2 = new THREE.Vector3().crossVectors(u, e1).normalize();
    for(let i=0;i<s.agujeros;i++){
      const a = i/s.agujeros * Math.PI*2;
      agujeros.push({ p: pc.clone().addScaledVector(e1, Math.cos(a)*rB).addScaledVector(e2, Math.sin(a)*rB), q:q, esp:esp });
    }
  }
  function volcarInstancias(){
    const m4 = new THREE.Matrix4(), esc1 = new THREE.Vector3(1,1,1);
    Object.keys(bridaCol).forEach(k => {
      const b = bridaCol[k], s = b.spec;
      const rExt = (b.dInt/2 + s.ancho)/1000, esp = Math.max(s.esp,3)/1000;
      const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(rExt, rExt, esp, 28), matBrida, b.items.length);
      b.items.forEach((it,i) => { m4.compose(it.p, it.q, esc1); im.setMatrixAt(i, m4); });
      grpTubos.add(im);
    });
    if(agujeros.length){
      const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(.0055, .0055, 1, 8), matAguj, agujeros.length);
      agujeros.forEach((it,i) => { m4.compose(it.p, it.q, new THREE.Vector3(1, it.esp*2.4, 1)); im.setMatrixAt(i, m4); });
      grpTubos.add(im);
    }
    Object.keys(anillos).forEach(k => {
      const lst = anillos[k]; if(!lst.length) return;
      const r = (+k)/2000 * 1.14;
      const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(r, r, .022, 14, 1, true), matHose, lst.length);
      lst.forEach((it,i) => { m4.compose(it.p, it.q, esc1); im.setMatrixAt(i, m4); });
      grpTubos.add(im);
    });
  }

  /* ── TRAMOS: caños boca a boca, en tiras de 3 m con junta bridada ── */
  const bocasTramo = {};
  (paq.bocas_planas||[]).forEach(b => {
    (bocasTramo[b.tramo] = bocasTramo[b.tramo] || []).push(b);
  });
  // De dónde a dónde va el caño de un tramo:
  //  · 2 bocas → de boca a boca (lo que se fabrica)
  //  · 1 boca (bajante que termina en la máquina) → de la boca al nudo LIBRE.
  //    Antes iba de nudo a nudo: el caño seguía 200 mm hasta el vértice del codo
  //    y asomaba por arriba (en la Calculadora no pasa porque usa el largo útil).
  //  · 0 bocas → de nudo a nudo
  function extremosTramo(t){
    const bs = bocasTramo[t.id] || [];
    const P = b => new THREE.Vector3(b.x - cx, b.z, b.y - cz);
    if(bs.length >= 2) return [P(bs[0]), P(bs[1])];
    if(bs.length === 1){
      const b = bs[0];
      const libre = (b.nodo && t.nodo_a === b.nodo) ? t.b : (b.nodo && t.nodo_b === b.nodo) ? t.a
        : (V(t.a).distanceTo(P(b)) > V(t.b).distanceTo(P(b)) ? t.a : t.b);
      return [P(b), V(libre)];
    }
    return [V(t.a), V(t.b)];
  }
  // PUNTOS DE REFERENCIA para "Punto del 3D": la entrada al equipo (punta libre
  // del colector), la boca de cada máquina y la esquina 0,0 del galpón
  const puntosRef = [], extremos = [];
  (paq.tramos||[]).forEach(t => {
    const [A, B] = extremosTramo(t);
    const d = t.d_mm || 150;
    const dir = new THREE.Vector3().subVectors(B, A), L = dir.length();
    if(L < 0.003 || t.fabricar === false) return;   // conexión directa: las bridas de las piezas se juntan solas
    dir.normalize();
    if(t.tipo !== 'manguera' && t.tipo !== 'bajante') extremos.push({ A, B, d });
    if(t.tipo === 'manguera'){
      const m = tubo(A, B, d, 18); if(m) m.material = matHose;
      const lst = (anillos[d] = anillos[d] || []);
      for(let s=.05; s<L; s+=.085) lst.push({ p: A.clone().addScaledVector(dir, s), q: quatDir(dir) });
      return;
    }
    tubo(A, B, d);
    addBrida(A, dir, d);                       // brida de cada punta, mirando al caño
    addBrida(B, dir.clone().negate(), d);
    const n = Math.ceil(L / 3);                // los caños MS vienen en tiras de 3 m
    for(let i=1;i<n;i++){
      const pC = A.clone().addScaledVector(dir, i*L/n);
      addBrida(pC, dir.clone().negate(), d);   // junta: par de bridas espalda con espalda
      addBrida(pC, dir, d);
    }
    if(L > 1.1){
      const largoTxt = (t.largo_util_m != null ? t.largo_util_m : L);
      const et = etiqueta('Ø' + Math.round(d) + ' · ' + largoTxt.toFixed(2).replace('.', ',') + ' m', new THREE.Color(PAL.acento2));
      et.position.copy(A).addScaledVector(dir, L/2).add(new THREE.Vector3(0, d/2000 + .14, 0));
      et.scale.set(.55, .13, 1);
      grpEtiq.add(et);
    }
  });

  // "Entrada al equipo": la punta LIBRE (sin otro caño encima) más cercana al
  // equipo de la planta; si no hay equipo dibujado, la del caño más gordo
  (function(){
    const pts = []; extremos.forEach(e => { pts.push({ p:e.A, d:e.d }); pts.push({ p:e.B, d:e.d }); });
    const libres = pts.filter(pt => !pts.some(o => o !== pt && o.p.distanceTo(pt.p) < 0.06));
    if(!libres.length) return;
    const eq = (paq.planta||[]).find(pl => pl.tipo === 'equipo' && pl.x != null);
    let mejor = null;
    if(eq){
      const ex = eq.x - cx, ez = eq.y - cz;
      libres.forEach(pt => { const dd = Math.hypot(pt.p.x - ex, pt.p.z - ez); if(!mejor || dd < mejor.dd) mejor = { pt, dd }; });
      mejor = mejor.pt;
    }else{
      libres.forEach(pt => { if(!mejor || pt.d > mejor.d) mejor = pt; });
    }
    puntosRef.push({ nombre: 'Entrada al ' + ((eq && eq.nombre) || 'equipo') + ' (Ø' + Math.round(mejor.d) + ')', p: mejor.p.clone() });
  })();

  /* ── ACCESORIOS desde los nudos: codo facetado, derivación, pantalón ── */
  const segCierra = (a, b, p) => {         // punto del eje a-b más cercano a p
    const ab = new THREE.Vector3().subVectors(b, a);
    const tt = Math.max(0, Math.min(1, new THREE.Vector3().subVectors(p, a).dot(ab) / ab.lengthSq()));
    return a.clone().addScaledVector(ab, tt);
  };
  (paq.nodos||[]).forEach(n => {
    const acc = n.accesorio; if(!acc) return;
    const bocas = (n.bocas||[]).map(b => ({
      p: new THREE.Vector3(b.pos.x - cx, b.pos.z, b.pos.y - cz),
      u: new THREE.Vector3(b.dir.x, b.dir.z, b.dir.y).normalize(),   // apunta del nudo HACIA su caño
      d: b.d_mm || acc.d || 150
    }));
    if(!bocas.length) return;

    if(acc.tipo === 'codo' && bocas.length >= 2){
      const A = bocas[0], B = bocas[1];
      const dC = Math.max(A.d, B.d);
      const ang = (acc.angulo_gr != null) ? acc.angulo_gr : 90;
      const th = ang * Math.PI/180;
      // gajos: los que dice la pieza (tabla MS) o uno cada ~22°
      const nSeg = Math.max(2, acc.gajos ? Math.round(acc.gajos) : Math.round(ang / 22.5));
      // ARCO CIRCULAR real: R sale de la distancia boca–vértice (= R·tan(θ/2)),
      // y la Bezier con manija (4/3)·tan(θ/4)·R reproduce ese arco
      const Vn = n.pos ? V(n.pos) : A.p.clone().lerp(B.p, .5);
      const R = Math.tan(th/2) > 1e-3 ? A.p.distanceTo(Vn) / Math.tan(th/2) : dC/500;
      const h = (4/3) * Math.tan(th/4) * R;
      const curva = new THREE.CubicBezierCurve3(
        A.p, A.p.clone().addScaledVector(A.u, -h),
        B.p.clone().addScaledVector(B.u, -h), B.p);
      const pts = curva.getPoints(nSeg);
      tuboGajos(pts, dC/2000, 22, matD(dC));
      addBrida(A.p, A.u.clone().negate(), A.d);
      addBrida(B.p, B.u.clone().negate(), B.d);
      return;
    }

    if(acc.tipo === 'derivacion' && bocas.length >= 3){
      let iA=0, iB=1, mejor=-2;
      for(let i=0;i<bocas.length;i++) for(let j=i+1;j<bocas.length;j++){
        const op = -bocas[i].u.dot(bocas[j].u);
        if(op > mejor){ mejor = op; iA=i; iB=j; }
      }
      const ent = bocas[iA].d >= bocas[iB].d ? bocas[iA] : bocas[iB];
      const sal = (ent === bocas[iA]) ? bocas[iB] : bocas[iA];
      const dirC = new THREE.Vector3().subVectors(sal.p, ent.p), Lc = dirC.length();
      if(Lc > 0.004){
        dirC.normalize();
        const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(sal.d/2000, ent.d/2000, Lc, 22, 1, true), matD(ent.d));
        cuerpo.position.copy(ent.p).addScaledVector(dirC, Lc/2);
        cuerpo.quaternion.copy(quatDir(dirC));
        cuerpo.userData.esTubo = true;
        grpTubos.add(cuerpo);
      }
      bocas.forEach((b, idx) => {
        addBrida(b.p, b.u.clone().negate(), b.d);
        if(idx === iA || idx === iB) return;
        // LA RAMA SIGUE SU PROPIO ÁNGULO (los 30° de la Y MS) hasta
        // encontrarse con el eje del cuerpo — antes iba derecho al eje,
        // perpendicular, y la derivación quedaba dibujada mal.
        const dirRama = b.u.clone().negate();       // de la boca hacia adentro
        const u = new THREE.Vector3().subVectors(sal.p, ent.p);
        const w0 = new THREE.Vector3().subVectors(ent.p, b.p);
        const A2 = u.dot(u), B2 = u.dot(dirRama), C2 = dirRama.dot(dirRama);
        const D2 = u.dot(w0), E2 = dirRama.dot(w0);
        const den = A2*C2 - B2*B2;
        let sPar = (den > 1e-9) ? (B2*E2 - C2*D2) / den : .5;
        sPar = Math.max(0, Math.min(1, sPar));
        const encuentro = ent.p.clone().addScaledVector(u, sPar);
        tubo(b.p, encuentro, b.d, 18);
      });
      return;
    }

    if(acc.tipo === 'pantalon'){
      const sal = bocas.reduce((a,b) => (!a || b.d > a.d) ? b : a, null);
      if(sal){
        const hP = .33;
        const cono = new THREE.Mesh(new THREE.CylinderGeometry(sal.d/2000, sal.d/1000*.95, hP, 20, 1, true), matD(sal.d));
        cono.position.copy(sal.p).addScaledVector(sal.u, -hP/2);
        cono.quaternion.copy(quatDir(sal.u));
        cono.userData.esTubo = true;
        grpTubos.add(cono);
        addBrida(sal.p, sal.u.clone().negate(), sal.d);
      }
      return;
    }
  });

  /* ── VÁLVULAS Y PANTALONES: el paquete no los trae como piezas (los cuenta el
        cómputo); acá se arman desde cada MÁQUINA: la válvula mariposa en el bajante
        que le llega, y si tiene más de una boca, el pantalón con sus mangueras ── */
  const matValv = new THREE.MeshStandardMaterial({ color:0x3b4048, metalness:.85, roughness:.35 });
  const matPal  = new THREE.MeshBasicMaterial({ color:PAL.acento });
  const bajantes = (paq.tramos||[]).filter(t => t.tipo === 'bajante' && t.a && t.b);
  // altura de las BOCAS de máquina: donde terminan los bajantes de una boca (1,5 m típico);
  // en las de varias bocas el bajante termina más arriba, en la salida del pantalón
  let zBocas = 1e9;
  bajantes.forEach(t => { const zb = Math.min(t.a.z || 0, t.b.z || 0); if(zb < zBocas) zBocas = zb; });
  if(!(zBocas < 1e8)) zBocas = 1.5;
  (paq.maquinas||[]).forEach(m => {
    if(m.x == null || m.y == null) return;
    // el bajante de esta máquina: el que baja hasta su posición
    let mejor = null, dm = 1e9;
    bajantes.forEach(t => {
      const bajo = (t.a.z || 0) <= (t.b.z || 0) ? t.a : t.b;
      const dd = Math.hypot(bajo.x - m.x, bajo.y - m.y);
      if(dd < dm){ dm = dd; mejor = t; }
    });
    if(!mejor || dm > 0.8) return;
    const bajo = (mejor.a.z || 0) <= (mejor.b.z || 0) ? mejor.a : mejor.b;
    const P = V(bajo);                                   // punta inferior del bajante (la boca)
    puntosRef.push({ nombre: 'Boca ' + (m.nombre || m.name || ('máquina ' + (puntosRef.length + 1))), p: P.clone() });
    const dB = mejor.d_mm || (m.bocas && m.bocas[0] && m.bocas[0].d_mm) || 120;
    const rB = dB/2000;
    // VÁLVULA MARIPOSA a 35 cm por encima de la boca: cuerpo, disco girado a la apertura y palanca
    if(m.valvula){
      const dV = m.valvula_d_mm || dB, rV = dV/2000;
      const zV = P.y + 0.35;
      const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(rV*1.18, rV*1.18, 0.10, 20), matValv);
      cuerpo.position.set(P.x, zV, P.z); cuerpo.userData.esTubo = false;
      grpTubos.add(cuerpo);
      [zV-0.05, zV+0.05].forEach(zz => {
        const brV = new THREE.Mesh(new THREE.CylinderGeometry(rV*1.45, rV*1.45, 0.006, 20), matBrida);
        brV.position.set(P.x, zz, P.z); grpTubos.add(brV);
      });
      const ap = ((m.valvula_apertura_gr != null) ? m.valvula_apertura_gr : 60) * Math.PI/180;
      const disco = new THREE.Mesh(new THREE.CylinderGeometry(rV*.96, rV*.96, 0.004, 20), matValv);
      disco.position.set(P.x, zV, P.z); disco.rotation.x = ap;   // 0 = cerrada (horizontal), 90 = abierta
      grpTubos.add(disco);
      const eje = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, rV*2.9, 8), matValv);
      eje.position.set(P.x, zV, P.z); eje.rotation.z = Math.PI/2; grpTubos.add(eje);
      const palanca = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, rV*1.6), matPal);
      palanca.position.set(P.x + rV*1.35, zV, P.z); palanca.rotation.x = ap;
      palanca.position.z += Math.sin(ap) * 0; grpTubos.add(palanca);
      const etV = etiqueta('válvula Ø' + Math.round(dV) + ' · ' + Math.round((m.valvula_apertura_gr != null ? m.valvula_apertura_gr : 60)) + '°', new THREE.Color(PAL.acento));
      etV.position.set(P.x + rV + .18, zV + .1, P.z); etV.scale.set(.42, .105, 1); grpEtiq.add(etV);
    }
    // PANTALÓN + MANGUERAS si la máquina tiene varias bocas
    const bocasM = (m.bocas || []).filter(b => b && b.d_mm > 0);
    if(bocasM.length > 1){
      const hP = .33, ancho = rB*2 + 0.12*(bocasM.length-1);
      const cono = new THREE.Mesh(new THREE.CylinderGeometry(rB, ancho/2, hP, 20, 1, true), matD(dB));
      cono.position.set(P.x, P.y - hP/2, P.z); cono.userData.esTubo = true; grpTubos.add(cono);
      addBrida(P, new THREE.Vector3(0,-1,0), dB);
      const zBase = P.y - hP, zBoca = Math.min(zBase - 0.3, zBocas);   // las mangueras bajan hasta la boca de la máquina
      bocasM.forEach((b, i) => {
        const off = (i - (bocasM.length-1)/2) * 0.12 * 2;
        const A = new THREE.Vector3(P.x + off*.5, zBase, P.z), B = new THREE.Vector3(P.x + off, zBoca, P.z);
        const dir = new THREE.Vector3().subVectors(B, A), L = dir.length(); dir.normalize();
        const mh = tubo(A, B, b.d_mm, 16); if(mh) mh.material = matHose;
        const lst = (anillos[b.d_mm] = anillos[b.d_mm] || []);
        for(let s2=.04; s2<L; s2+=.06) lst.push({ p: A.clone().addScaledVector(dir, s2), q: quatDir(dir) });
        addBrida(B, dir.clone().negate(), b.d_mm);
      });
      const etP = etiqueta('pantalón Ø' + Math.round(dB) + ' · ' + bocasM.map(b => 'Ø' + Math.round(b.d_mm)).join('/'), new THREE.Color(PAL.acento2));
      etP.position.set(P.x - rB - .2, P.y - hP/2, P.z); etP.scale.set(.5, .125, 1); grpEtiq.add(etP);
    }
  });

  /* ── REPLANTEO EN EL PISO: eje proyectado, cota a nivel de piso y
        cruces donde cae cada pieza — para marcar con tiza ── */
  const grpPiso = new THREE.Group();
  grpPiso.userData.rol = 'replanteo';
  const matEje  = new THREE.LineDashedMaterial({ color:PAL.acento2, dashSize:.20, gapSize:.13, transparent:true, opacity:.95 });
  const matCruz = new THREE.LineBasicMaterial({ color:PAL.acento, transparent:true, opacity:.95 });
  const cruces = new Set();
  function cruzPiso(x, z){
    const k = Math.round(x*50) + '|' + Math.round(z*50);
    if(cruces.has(k)) return;
    cruces.add(k);
    const s = .20, y = .015;
    const g1 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x-s, y, z), new THREE.Vector3(x+s, y, z)]);
    const g2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z-s), new THREE.Vector3(x, y, z+s)]);
    grpPiso.add(new THREE.Line(g1, matCruz));
    grpPiso.add(new THREE.Line(g2, matCruz));
  }
  (paq.tramos||[]).forEach(t => {
    const [A, B] = extremosTramo(t);
    const dir = new THREE.Vector3().subVectors(B, A), L = dir.length();
    if(L < 0.05) return;
    dir.normalize();
    if(Math.abs(dir.y) > 0.85){
      cruzPiso(A.x, A.z);                          // bajante: su marca de tiza
      return;
    }
    if(Math.min(A.y, B.y) < 0.4 || t.tipo === 'manguera') return;
    const gEje = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(A.x, .015, A.z), new THREE.Vector3(B.x, .015, B.z)]);
    const ln = new THREE.Line(gEje, matEje);
    ln.computeLineDistances();                     // sin esto el punteado no aparece
    grpPiso.add(ln);
    if(L > 1.1){
      const zm = (A.y + B.y) / 2;
      const etP = etiqueta('alt. eje ' + zm.toFixed(2).replace('.', ',') + ' m', new THREE.Color(PAL.acento));
      etP.position.set((A.x + B.x)/2, .22, (A.z + B.z)/2);
      etP.scale.set(.5, .125, 1);
      grpPiso.add(etP);
    }
  });
  // una cruz por cada pieza (codo, derivación, pantalón): ahí cae el montaje
  (paq.nodos||[]).forEach(n => {
    if(!n.accesorio || !n.pos) return;
    cruzPiso(n.pos.x - cx, n.pos.y - cz);
  });

  /* ── GALPÓN: el contorno real, la referencia para calzarlo en la nave ── */
  if(paq.galpon && paq.galpon.ancho_m > 0){
    const an = paq.galpon.ancho_m, la = paq.galpon.largo_m;
    const esq = [[0,0],[an,0],[an,la],[0,la]].map(e => new THREE.Vector3(e[0]-cx, .012, e[1]-cz));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(esq.concat([esq[0]])),
      new THREE.LineBasicMaterial({ color:PAL.acento })));
    esq.forEach(e => {
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(.028,.028,1.2,8),
        new THREE.MeshBasicMaterial({ color:PAL.acento, transparent:true, opacity:.85 }));
      poste.position.copy(e).add(new THREE.Vector3(0,.6,0));
      g.add(poste);
    });
    const grilla = new THREE.GridHelper(Math.max(an, la), Math.round(Math.max(an, la)), PAL.acento, PAL.grilla);
    grilla.material.transparent = true; grilla.material.opacity = .2;
    grilla.userData.rol = 'grilla';
    g.add(grilla);
  }

  /* ── PLANTA: huella y volumen real de cada máquina y equipo ── */
  (paq.planta||[]).forEach(pl => {
    const w = pl.ancho_m || 1.2, h = pl.largo_m || .9;
    const alto = (pl.tipo === 'equipo') ? 3.2 : 1.3;
    const col = (pl.tipo === 'equipo') ? PAL.aviso : PAL.acento2;
    const caja = new THREE.Mesh(new THREE.BoxGeometry(w, alto, h),
      new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:.15, wireframe:true }));
    caja.position.set(pl.x - cx, (pl.z_base_m||0) + alto/2, pl.y - cz);
    grpMaq.add(caja);
    if(pl.nombre){
      const et = etiqueta(pl.nombre, new THREE.Color(col));
      et.position.set(pl.x - cx, (pl.z_base_m||0) + alto + .18, pl.y - cz);
      et.scale.set(.5, .125, 1);
      grpMaq.add(et);
    }
  });

  volcarInstancias();
  // punto de referencia de la red (esquina 0,0 del galpón): tríada de ejes chica
  if(tz.refEsquina){
    const grpRef = new THREE.Group(); grpRef.userData.rol = 'referencia';
    const Lt = 1.2;
    [[new THREE.Vector3(1,0,0), PAL.ejeX], [new THREE.Vector3(0,1,0), PAL.ejeY], [new THREE.Vector3(0,0,1), PAL.ejeZ]]
      .forEach(par => grpRef.add(new THREE.ArrowHelper(par[0], new THREE.Vector3(0,0,0), Lt, par[1], Lt*.22, Lt*.1)));
    grpRef.position.copy(tz.refEsquina);
    grpRef.visible = (S.verBandera !== false);
    g.add(grpRef); g.userData.grpRef = grpRef;
  }
  g.add(grpTubos); g.add(grpEtiq); g.add(grpMaq); g.add(grpPiso);
  g.userData.grpEtiq = grpEtiq;
  g.userData.grpMaq  = grpMaq;
  g.userData.grpPiso = grpPiso;
  g.userData.matsRed = Object.keys(_matsD).map(k => _matsD[k]).concat([matBrida, matHose]);
  if(tz.refEsquina) puntosRef.push({ nombre: 'Esquina 0,0 del galpón', p: tz.refEsquina.clone() });
  g.userData.puntosRef = puntosRef;
  return g;
}

/* ------------------------------------------------------------
   4ter. MODELO 3D LIBRE (STL / OBJ exportado de Inventor)
   Cualquier pieza o ensamble: se parsea acá mismo, sin loaders
   externos, para que la PWA siga siendo un solo archivo offline.
   ------------------------------------------------------------ */
function parseSTL(buf){
  const dv = new DataView(buf);
  // ¿binario? header 80 bytes + uint32 nTris + nTris*50
  if(buf.byteLength >= 84){
    const n = dv.getUint32(80, true);
    if(84 + n*50 === buf.byteLength){
      const pos = new Float32Array(n*9);
      const nor = new Float32Array(n*9);
      let o = 84;
      for(let i=0;i<n;i++){
        const nx=dv.getFloat32(o,true), ny=dv.getFloat32(o+4,true), nz=dv.getFloat32(o+8,true);
        o += 12;
        for(let v=0;v<3;v++){
          const j = i*9 + v*3;
          pos[j]   = dv.getFloat32(o,true);
          pos[j+1] = dv.getFloat32(o+4,true);
          pos[j+2] = dv.getFloat32(o+8,true);
          nor[j]=nx; nor[j+1]=ny; nor[j+2]=nz;
          o += 12;
        }
        o += 2; // attribute byte count
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos,3));
      g.setAttribute('normal',   new THREE.BufferAttribute(nor,3));
      return g;
    }
  }
  // ASCII
  const txt = new TextDecoder().decode(buf);
  const pos = [];
  const re = /vertex\s+([\-0-9.eE+]+)\s+([\-0-9.eE+]+)\s+([\-0-9.eE+]+)/g;
  let m;
  while((m = re.exec(txt))) pos.push(+m[1], +m[2], +m[3]);
  if(!pos.length) throw new Error('STL sin triángulos legibles.');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos),3));
  g.computeVertexNormals();
  return g;
}

// STL binario GIGANTE (galpones completos, millones de triángulos): se
// SIMPLIFICA al cargar con una rejilla de agrupamiento de vértices. Un
// celular no puede con 3 M de triángulos; con la rejilla queda una malla
// fiel a escala de obra y liviana. Corre por lotes para no colgar la UI.
async function parseSTLBinGrande(buf, n, avance){
  const dv = new DataView(buf);
  // bbox muestreada (para elegir el tamaño de celda)
  let minx=1e18,miny=1e18,minz=1e18,maxx=-1e18,maxy=-1e18,maxz=-1e18;
  const salto = Math.max(1, Math.floor(n/30000));
  for(let i=0;i<n;i+=salto){
    const o = 84 + i*50 + 12;
    const x=dv.getFloat32(o,true), y=dv.getFloat32(o+4,true), z=dv.getFloat32(o+8,true);
    if(x<minx)minx=x; if(x>maxx)maxx=x;
    if(y<miny)miny=y; if(y>maxy)maxy=y;
    if(z<minz)minz=z; if(z>maxz)maxz=z;
  }
  const diag = Math.hypot(maxx-minx, maxy-miny, maxz-minz) || 1;
  const celda = Math.min(Math.max(diag/1400, 4), 80);   // en unidades del archivo
  const map = new Map(), vx=[], vy=[], vz=[];
  const tIdx = new Uint32Array(n*3);
  let nIdx = 0, tri = 0;
  await new Promise(done => {
    function lote(){
      const fin = Math.min(n, tri + 120000);
      for(; tri<fin; tri++){
        let off = 84 + tri*50 + 12;
        let i0=0, i1=0, i2=0;
        for(let v2=0; v2<3; v2++){
          const x=dv.getFloat32(off,true), y=dv.getFloat32(off+4,true), z=dv.getFloat32(off+8,true);
          off += 12;
          const key = ((Math.round(x/celda)+16384)*32768 + (Math.round(y/celda)+16384))*32768 + (Math.round(z/celda)+16384);
          let id = map.get(key);
          if(id === undefined){ id = vx.length; map.set(key, id); vx.push(x); vy.push(y); vz.push(z); }
          if(v2===0) i0=id; else if(v2===1) i1=id; else i2=id;
        }
        if(i0===i1 || i1===i2 || i0===i2) continue;   // colapsó: no es cara
        tIdx[nIdx++]=i0; tIdx[nIdx++]=i1; tIdx[nIdx++]=i2;
      }
      if(avance) avance(tri/n);
      if(tri < n) setTimeout(lote, 0); else done();
    }
    lote();
  });
  const pos = new Float32Array(vx.length*3);
  for(let i=0;i<vx.length;i++){ pos[i*3]=vx[i]; pos[i*3+1]=vy[i]; pos[i*3+2]=vz[i]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(tIdx.slice(0, nIdx), 1));
  g.computeVertexNormals();
  return g;
}

// Color estable a partir del nombre de un material (Inventor exporta
// "usemtl Acero_Galvanizado", "usemtl Pintura_Roja"…): cada material un tono
// distinto, siempre el mismo para el mismo nombre.
function colorDeNombre(nom){
  let h = 2166136261;
  for(let i=0;i<nom.length;i++){ h ^= nom.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const c = new THREE.Color().setHSL((h % 360)/360, .55, .55);
  return [c.r, c.g, c.b];
}

// MTL de Inventor: "newmtl X" + "Kd r g b" (+ "d" opacidad). Devuelve { nombre: {kd:[r,g,b], d:1} }
function parseMTL(txt){
  const out = {}; let act = null;
  txt.split('\n').forEach(l => {
    l = l.trim();
    if(l.startsWith('newmtl ')){ act = l.slice(7).trim(); out[act] = { kd:[.8,.8,.8], d:1 }; }
    else if(act && l.startsWith('Kd ')){ const p = l.split(/\s+/); out[act].kd = [+p[1]||0, +p[2]||0, +p[3]||0]; }
    else if(act && (l.startsWith('d ') || l.startsWith('Tr '))){ const v = +l.split(/\s+/)[1]; if(isFinite(v)) out[act].d = l.startsWith('Tr ') ? 1 - v : v; }
  });
  return out;
}

// OBJ — ASÍNCRONO por tandas (un OBJ grande de Inventor congelaba la app al
// abrirlo). Lee:
//  · "v x y z r g b"  colores por vértice (PlanObra, o el conversor de PC)
//  · "usemtl nombre"  materiales de Inventor → color por material (del .mtl
//    si se cargó, si no un tono estable por nombre)
//  · "o vidrio" / materiales con opacidad < .9 → grupo translúcido
async function parseOBJ(txt, avance, mtl){
  const vs = [], cols = [], tris = [], trisVid = [], triMat = [], triMatVid = [];
  const matNombres = []; const matIdx = {};
  let hayColor = false, enVidrio = false, matAct = -1, hayMat = false, hojaEmb = null;
  const lineas = txt.split('\n'); txt = null;
  const N = lineas.length;
  const LOTE = 25000;
  for(let i0=0; i0<N; i0+=LOTE){
    const fin = Math.min(N, i0+LOTE);
    for(let i=i0;i<fin;i++){
      const l = lineas[i];
      const c0 = l.charCodeAt(0), c1 = l.charCodeAt(1);
      if(c0===118 && c1===32){          // "v "
        const p = l.trim().split(/\s+/);
        vs.push(+p[1], +p[2], +p[3]);
        if(p.length >= 7){ cols.push(+p[4], +p[5], +p[6]); hayColor = true; }
        else cols.push(1, 1, 1);
      }else if(c0===102 && c1===32){    // "f "
        const p = l.trim().split(/\s+/).slice(1)
          .map(t => { let k = parseInt(t,10); return k<0 ? vs.length/3 + k : k-1; });
        const vid = enVidrio || (matAct >= 0 && mtl && mtl[matNombres[matAct]] && mtl[matNombres[matAct]].d < .9);
        const dest = vid ? trisVid : tris, dm = vid ? triMatVid : triMat;
        for(let j=2;j<p.length;j++){ dest.push(p[0], p[j-1], p[j]); dm.push(matAct); }
      }else if(c0===111 && c1===32){    // "o "
        enVidrio = /vidrio|glass|agua|cristal/i.test(l);
      }else if(c0===35 && l.startsWith('# MSAR_HOJA ')){   // la hoja impresa (Plano_AR_desde_OBJ)
        try{ hojaEmb = JSON.parse(l.slice(12)); }catch(e){}
      }else if(c0===117 && l.startsWith('usemtl')){
        const nom = l.slice(6).trim();
        if(matIdx[nom] === undefined){ matIdx[nom] = matNombres.length; matNombres.push(nom); }
        matAct = matIdx[nom]; hayMat = true;
      }
    }
    if(avance) avance(fin / N);
    if(fin < N) await new Promise(r => setTimeout(r, 0));
  }
  if(!tris.length && !trisVid.length) throw new Error('OBJ sin caras legibles.');
  let nOp = tris.length;
  let todos = tris.concat(trisVid);
  let mats = triMat.concat(triMatVid);      // material de cada TRIÁNGULO (por índice de vértice-esquina /3)
  // MODELO GIGANTE (galpón entero de Inventor): un celular no mueve millones de
  // caras. Se simplifica acá mismo con una rejilla de agrupamiento de vértices
  // (lo mismo que hace Preparar_OBJ_para_AR en la PC) — no hace falta prepararlo.
  const MAX_CARAS = CFG.maxCaras || 400000;
  if(todos.length/3 > MAX_CARAS){
    let minx=1e18,miny=1e18,minz=1e18,maxx=-1e18,maxy=-1e18,maxz=-1e18;
    for(let i=0;i<vs.length;i+=3){ const x=vs[i],y=vs[i+1],z=vs[i+2]; if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; if(z<minz)minz=z; if(z>maxz)maxz=z; }
    const diag = Math.hypot(maxx-minx, maxy-miny, maxz-minz) || 1;
    let factor = 1200;
    for(let intento=0; intento<6; intento++){
      const celda = diag / factor;
      const map = new Map(), remap = new Int32Array(vs.length/3);
      let nv = 0;
      for(let i=0;i<vs.length/3;i++){
        const key = ((Math.round(vs[i*3]/celda)+16384)*32768 + (Math.round(vs[i*3+1]/celda)+16384))*32768 + (Math.round(vs[i*3+2]/celda)+16384);
        let id = map.get(key);
        if(id === undefined){ id = nv++; map.set(key, id); }
        remap[i] = id;
      }
      const t2 = [], m2 = []; let nOp2 = 0;
      for(let t=0; t<todos.length; t+=3){
        const a = remap[todos[t]], b = remap[todos[t+1]], c = remap[todos[t+2]];
        if(a===b || b===c || a===c) continue;
        t2.push(a, b, c); m2.push(mats[t/3]);
        if(t < nOp) nOp2 += 3;
      }
      if(t2.length/3 <= MAX_CARAS || intento === 5){
        // vértices y colores remapeados (el primero de cada celda representa a la celda)
        const vs2 = new Array(nv*3), cols2 = new Array(nv*3);
        const visto = new Uint8Array(nv);
        for(let i=0;i<vs.length/3;i++){
          const id = remap[i]; if(visto[id]) continue; visto[id] = 1;
          vs2[id*3]=vs[i*3]; vs2[id*3+1]=vs[i*3+1]; vs2[id*3+2]=vs[i*3+2];
          cols2[id*3]=cols[i*3]; cols2[id*3+1]=cols[i*3+1]; cols2[id*3+2]=cols[i*3+2];
        }
        vs.length = 0; vs.push(...vs2); cols.length = 0; cols.push(...cols2);
        todos = t2; mats = m2; nOp = nOp2;
        break;
      }
      factor *= 0.7;
      if(avance) avance(1);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  const pos = new Float32Array(todos.length*3);
  for(let i=0;i<todos.length;i++){
    const k = todos[i]*3;
    pos[i*3]=vs[k]; pos[i*3+1]=vs[k+1]; pos[i*3+2]=vs[k+2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  if(trisVid.length){
    g.addGroup(0, nOp, 0);
    g.addGroup(nOp, trisVid.length, 1);
    g.userData.hayVidrio = true;
  }
  g.computeVertexNormals();
  g.userData.matNombres = matNombres;
  g.userData.hoja = hojaEmb;
  g.userData.triMat = (hayMat && matNombres.length > 1) ? Int16Array.from(mats) : null;
  if(hayColor){
    // COLORES REALES del archivo (crudos): la luz fija se hornea con hornearReal()
    // una vez que el modelo está girado a Y-arriba (la luz es del mundo, no del CAD)
    const crudo = new Float32Array(todos.length*3);
    for(let i=0;i<todos.length;i++){
      const k = todos[i]*3;
      crudo[i*3] = cols[k]; crudo[i*3+1] = cols[k+1]; crudo[i*3+2] = cols[k+2];
    }
    g.userData.colCrudo = crudo;
    hornearReal(g);
  }else if(g.userData.triMat){
    // sin colores por vértice pero con materiales: un tono por material
    aplicarColoresMaterial(g, mtl || null);
  }
  return g;
}

// Hornea la luz fija sobre los colores crudos (userData.colCrudo) con las
// normales ACTUALES de la geometría → piel 'real'. Se vuelve a llamar después
// de rotar el modelo para que la luz caiga como en las otras pieles.
function hornearReal(g){
  const crudo = g.userData.colCrudo; if(!crudo) return null;
  const nrm = g.getAttribute('normal');
  const n = crudo.length/3, col = new Float32Array(n*3);
  const L = new THREE.Vector3(.45,.78,.42).normalize();
  const nv = new THREE.Vector3();
  for(let i=0;i<n;i++){
    nv.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    const lam = .48 + .52*Math.abs(nv.dot(L));
    col[i*3] = Math.min(1, crudo[i*3]*lam); col[i*3+1] = Math.min(1, crudo[i*3+1]*lam); col[i*3+2] = Math.min(1, crudo[i*3+2]*lam);
  }
  const attr = new THREE.BufferAttribute(col, 3);
  g.setAttribute('color', attr);
  g.userData.pieles = g.userData.pieles || {};
  g.userData.pieles.real = attr;
  attr.needsUpdate = true;
  return attr;
}

// Colorea por material (Inventor): con el .mtl usa sus Kd; sin él, un tono
// estable por nombre. Deja la piel 'real' lista para el botón Color.
function aplicarColoresMaterial(g, mtl){
  const tm = g.userData.triMat, noms = g.userData.matNombres || [];
  if(!tm) return false;
  const n = g.getAttribute('position').count, crudo = new Float32Array(n*3);
  const tabla = noms.map(nm => (mtl && mtl[nm] && mtl[nm].kd) ? mtl[nm].kd : colorDeNombre(nm));
  const gris = [.78,.78,.8];
  for(let i=0;i<n;i++){
    const m = tm[(i/3)|0];
    const c = (m >= 0) ? tabla[m] : gris;
    crudo[i*3] = c[0]; crudo[i*3+1] = c[1]; crudo[i*3+2] = c[2];
  }
  g.userData.colCrudo = crudo;
  hornearReal(g);
  return true;
}

// Varios archivos de una vez (selección múltiple o Compartir con 2 archivos):
// el .mtl se lee ANTES que el .obj para que el modelo abra ya con sus colores.
function cargarArchivos(files){
  const lista = Array.from(files || []);
  if(!lista.length) return;
  const ext = f => (f.name.split('.').pop() || '').toLowerCase();
  const mtls = lista.filter(f => ext(f) === 'mtl');
  const resto = lista.filter(f => ext(f) !== 'mtl');
  const seguir = () => {
    resto.forEach(f => {
      if(ext(f) === 'json'){
        const fr = new FileReader();
        fr.onload = () => { try{ cargar(JSON.parse(fr.result)); }catch(e){ UI.estado('JSON inválido: ' + e.message, 'err'); } };
        fr.readAsText(f);
      }else cargarModelo3D(f);
    });
  };
  if(mtls.length){
    const fr = new FileReader();
    fr.onload = () => { try{ S.mtl = parseMTL(fr.result); }catch(e){} seguir(); if(!resto.length) cargarMTL(mtls[0]); };
    fr.readAsText(mtls[0]);
  }else seguir();
}

// Cargar un .mtl DESPUÉS del .obj: recolorea el modelo ya abierto
function cargarMTL(file){
  const fr = new FileReader();
  fr.onload = () => {
    try{
      const mtl = parseMTL(fr.result);
      S.mtl = mtl;
      const tz = S.trazado;
      if(!tz || !tz.esModelo || !tz.geo || !tz.geo.userData.triMat){
        UI.estado('Colores .mtl leídos (' + Object.keys(mtl).length + ' materiales). Abrí un OBJ con "usemtl" para aplicarlos.', 'ok');
        return;
      }
      aplicarColoresMaterial(tz.geo, mtl);
      S.piel = 'real'; $('btnColor').textContent = 'Color: real';
      UI.estado('Colores aplicados desde el .mtl: ' + Object.keys(mtl).length + ' materiales.', 'ok');
    }catch(e){ UI.estado('Error al leer el .mtl: ' + e.message, 'err'); }
  };
  fr.readAsText(file);
}

function cargarModelo3D(file){
  const ext = (file.name.split('.').pop()||'').toLowerCase();
  if(ext === 'mtl'){ cargarMTL(file); return; }
  const fr = new FileReader();
  UI.estado('Leyendo ' + file.name + '…');
  fr.onload = async () => {
    try{
      let geo, esPlanObra = false;
      if(ext === 'obj'){
        S._textoOBJ = (fr.result.length < 40e6) ? fr.result : null;   // para el _AR.obj de "Plano con QR"
        geo = await parseOBJ(fr.result, f => { UI.estado('Leyendo OBJ… ' + Math.round(f*100) + '%'); }, S.mtl || null);
      }else{
        S._textoOBJ = null;
        let nT = 0;
        if(fr.result.byteLength >= 84){
          const dv0 = new DataView(fr.result);
          const cand = dv0.getUint32(80, true);
          if(84 + cand*50 === fr.result.byteLength) nT = cand;
        }
        if(nT > 350000){
          $('estadoAR').className = 'nota';
          geo = await parseSTLBinGrande(fr.result, nT, f => {
            $('estadoAR').textContent = 'Modelo grande (' + Math.round(nT/1000) + 'k caras): simplificando… ' + Math.round(f*100) + '%';
          });
        }else{
          geo = parseSTL(fr.result);
        }
      }
      // Unidades: lo que dice el selector (Inventor y PlanObra exportan en mm).
      // Inventor exporta Z-arriba; three usa Y-arriba.
      {
        const f = { mm:0.001, cm:0.01, m:1 }[$('selUnid').value] || 0.001;
        geo.scale(f,f,f);
        geo.rotateX(-Math.PI/2);
        if(geo.userData.colCrudo) hornearReal(geo);   // la luz horneada, ya con Y arriba
      }
      // centrar en planta y apoyar en el piso
      geo.computeBoundingBox();
      const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3());
      const minY0 = bb.min.y;             // el min ANTES de trasladar (bb se recalcula después)
      geo.translate(-c.x, -bb.min.y, -c.z);
      geo.computeBoundingBox();
      const med = geo.boundingBox.getSize(new THREE.Vector3());
      const nTris = (geo.index ? geo.index.count : geo.getAttribute('position').count)/3;
      // PUNTO DE REFERENCIA: el ORIGEN del archivo — el trío de ejes que se
      // ve en Inventor. Rodrigo pone el origen en la esquina de referencia
      // del galpón, así que ese es el punto para el anclaje por esquina.
      // (Si el origen quedara lejos del modelo, respaldo: esquina del bbox.)
      // El (0,0,0) del archivo, tras escalar/rotar/centrar, queda en:
      const refEsq = new THREE.Vector3(-c.x, -minY0, -c.z);
      const _bbb = geo.boundingBox, _mgX = (_bbb.max.x - _bbb.min.x) * .15, _mgZ = (_bbb.max.z - _bbb.min.z) * .15;
      if(refEsq.x < _bbb.min.x - _mgX || refEsq.x > _bbb.max.x + _mgX ||
         refEsq.z < _bbb.min.z - _mgZ || refEsq.z > _bbb.max.z + _mgZ ||
         refEsq.y < -1 || refEsq.y > _bbb.max.y){
        refEsq.set(_bbb.min.x, 0, _bbb.min.z);
      }
      // candidatos de ESQUINA (vértices bajos): el imán del selector de
      // punto de referencia sobre el plano
      const _pC = geo.getAttribute('position');
      const _cand = [];
      const _sC = Math.max(1, Math.floor(_pC.count/9000));
      for(let _i=0;_i<_pC.count;_i+=_sC){
        const _y = _pC.getY(_i);
        if(_y > -0.5 && _y < 3) _cand.push(_pC.getX(_i), _pC.getZ(_i));
      }
      // silueta en planta para el minimapa (muestra de vértices, X/Z locales)
      const _posM = geo.getAttribute('position');
      const _salto = Math.max(1, Math.floor(_posM.count/3500));
      const _mini = new Float32Array(Math.ceil(_posM.count/_salto)*2);
      let _mk = 0;
      for(let _i=0;_i<_posM.count;_i+=_salto){ _mini[_mk++]=_posM.getX(_i); _mini[_mk++]=_posM.getZ(_i); }
      if(geo.userData.pieles && geo.userData.pieles.real){
        S.piel = 'real';
        const bC = $('btnColor'); if(bC) bC.textContent = 'Color: real';
      }
      S.trazado = { esModelo:true, geo:geo, obra:file.name, tamano:file.size, medidas:med, tris:nTris, refEsquina:refEsq, miniPts:_mini.slice(0,_mk), refCandidatos:new Float32Array(_cand),
                    refOrigen: new THREE.Vector3(-c.x, -minY0, -c.z), fUnid: ({ mm:0.001, cm:0.01, m:1 }[$('selUnid').value] || 0.001) };
      // HOJA IMPRESA embebida (Plano_AR_desde_OBJ): el QR y las cruces en coordenadas del archivo
      let hoja = geo.userData.hoja;
      if(!hoja){ try{ hoja = JSON.parse(localStorage.getItem('ar-hoja::' + file.name + '::' + file.size) || 'null'); }catch(e){ hoja = null; } }
      if(hoja && hoja.marcador){
        const F = S.trazado.fUnid, O = S.trazado.refOrigen;
        const aLocal = (xf, yf) => new THREE.Vector3(O.x + xf*F, 0, O.z - yf*F);   // archivo (x, y) → local (x, -z)
        S.trazado.marcador = hoja.marcador;
        S.trazado.hoja = hoja;
        if(hoja.esquina1_mm){ const e1 = aLocal(hoja.esquina1_mm[0], hoja.esquina1_mm[1]); S.trazado.refEsquina = e1; }
        if(hoja.esquina2_mm){ const e2 = aLocal(hoja.esquina2_mm[0], hoja.esquina2_mm[1]); S.trazado.refP2Sugerido = { x: e2.x, z: e2.z }; }
        UI.estado('Modelo con hoja impresa (escala 1:' + hoja.escala + ', ' + String(hoja.hoja || '').toUpperCase() + '): elegí "Sobre plano impreso" y apuntá al QR.', 'ok');
        const rP = document.querySelector('input[name="modo"][value="papel"]');
        if(rP){ rP.checked = true; rP.dispatchEvent(new Event('change')); }
      }
      prepararPlanoImagen(S.trazado);
      pintarInfo(S.trazado);
      // aviso de UNIDADES: si el modelo mide menos de 30 cm o más de 400 m, casi seguro
      // el selector está mal (mm ↔ m) — se avisa en vez de dejar que "no se vea nada"
      const _ext = Math.max(med.x, med.y, med.z);
      if(_ext < 0.3) UI.estado('Mide solo ' + (_ext*100).toFixed(0) + ' cm de lado: si tendría que ser más grande, cambiá las unidades a "m" y volvé a abrirlo.', 'err');
      else if(_ext > 400) UI.estado('Mide ' + Math.round(_ext) + ' m de lado: si tendría que ser más chico, cambiá las unidades a "mm" y volvé a abrirlo.', 'err');
      else $('estadoAR').classList.remove('err');
      revisarSoporte();
    }catch(e){
      UI.estado('Error al leer el 3D: ' + e.message, 'err');
    }
  };
  if(ext==='obj') fr.readAsText(file); else fr.readAsArrayBuffer(file);
}

// La RED MS también se puede ubicar con 2 puntos (plano impreso / galpón):
// esquina de referencia = esquina (0,0) del galpón, candidatos = las 4 esquinas
// del galpón + cada máquina, y un plano cenital de la red dibujada.
function prepararReferenciasMS(tz){
  try{
    const paq = tz.paq, g = paq.galpon || {};
    const an = g.ancho_m > 0 ? g.ancho_m : tz.medidas.x, la = g.largo_m > 0 ? g.largo_m : tz.medidas.z;
    const L = (x, y) => [x - tz.cx, y - tz.cz];
    tz.refEsquina = new THREE.Vector3(L(0,0)[0], 0, L(0,0)[1]);
    tz.refP2Sugerido = { x: L(an, la)[0], z: L(an, la)[1] };      // la cruz 2 del plano impreso
    const cand = [];
    [[0,0],[an,0],[an,la],[0,la]].forEach(e => { const q = L(e[0], e[1]); cand.push(q[0], q[1]); });
    (paq.planta || []).forEach(pl => { const q = L(pl.x, pl.y); cand.push(q[0], q[1]); });
    (paq.maquinas || []).forEach(m => { if(m.pos){ const q = L(m.pos.x, m.pos.y); cand.push(q[0], q[1]); } });
    tz.refCandidatos = new Float32Array(cand);
    // plano cenital: se dibuja el grupo de la red y se fotografía desde arriba
    const gr = construirGrupoMS(tz);
    const bb = new THREE.Box3().setFromObject(gr);
    bb.min.x = Math.min(bb.min.x, -tz.cx); bb.min.z = Math.min(bb.min.z, -tz.cz);
    bb.max.x = Math.max(bb.max.x, an - tz.cx); bb.max.z = Math.max(bb.max.z, la - tz.cz);
    tz.bbox = bb;
    tz.tris = 0;
    prepararPlanoImagen(tz, gr);
    gr.traverse(o => { if(o.geometry) o.geometry.dispose(); });
  }catch(e){ tz.planImg = null; }
}

// FOTO DE PLANO: un render cenital ortográfico del modelo, hecho UNA vez al
// cargar. La vista en planta dibuja esta imagen (paredes y máquinas como un
// plano de verdad) en lugar de una lluvia de puntos ilegible.
function prepararPlanoImagen(tz, objeto){
  try{
    const w = 1024;
    const bb = objeto ? tz.bbox : tz.geo.boundingBox;
    // OJO: un segundo WebGLRenderer (otro contexto GL) alrededor de las
    // sesiones ARCore colgaba Chrome en algunos equipos. Se usa el renderer
    // ÚNICO de la app y se dibuja a un render target fuera de pantalla.
    const rnd = obtenerRenderer();
    const rt = new THREE.WebGLRenderTarget(w, w, { depthBuffer: true, stencilBuffer: false });
    const esc = new THREE.Scene();
    // look de PLANO CAD: la masa en gris oscuro (DoubleSide: lo seccionado
    // por el corte se ve relleno, como el rayado de un plano) y las ARISTAS
    // en blanco.
    if(objeto){
      esc.add(objeto);
      esc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.5));
    }else{
      const mesh = new THREE.Mesh(tz.geo, new THREE.MeshBasicMaterial({ color: 0x1a2432, side: THREE.DoubleSide }));
      esc.add(mesh);
    }
    if(!objeto && tz.tris < 60000){   // en modelos grandes las aristas del plano costaban segundos: va la masa sola
      try{
        const bordes = new THREE.LineSegments(new THREE.EdgesGeometry(tz.geo, 22),
          new THREE.LineBasicMaterial({ color: 0xffffff }));
        esc.add(bordes);
      }catch(e){}
    }
    const pcx = (bb.min.x + bb.max.x) / 2, pcz = (bb.min.z + bb.max.z) / 2;
    const H = Math.max((bb.max.x - bb.min.x) / 2, (bb.max.z - bb.min.z) / 2) * 1.04;
    // CORTE DE PLANO: en un edificio, mirar desde el techo muestra las chapas
    // y las cerchas — puré. Como en un plano de arquitectura, se corta a
    // 1,8 m: paredes seccionadas, máquinas y piso. Piezas bajas: vista entera.
    const alto = bb.max.y - bb.min.y;
    const corte = (objeto || alto <= 3) ? (bb.max.y + 10) : (bb.min.y + 1.8);
    const cam = new THREE.OrthographicCamera(-H, H, H, -H, .01, (corte - bb.min.y) + 5);
    cam.position.set(pcx, corte, pcz);
    cam.up.set(0, 0, -1);
    cam.lookAt(pcx, bb.min.y, pcz);
    const xrEra = rnd.xr.enabled; rnd.xr.enabled = false;
    rnd.setRenderTarget(rt);
    rnd.setClearColor(0x000000, 0); rnd.clear();
    rnd.render(esc, cam);
    const px = new Uint8Array(w * w * 4);
    rnd.readRenderTargetPixels(rt, 0, 0, w, w, px);
    rnd.setRenderTarget(null); rnd.xr.enabled = xrEra; rt.dispose();
    // a un canvas 2D (WebGL entrega las filas de abajo hacia arriba → se invierte)
    const cvv = document.createElement('canvas'); cvv.width = w; cvv.height = w;
    const c2 = cvv.getContext('2d'); const idat = c2.createImageData(w, w);
    for(let y = 0; y < w; y++) idat.data.set(px.subarray((w-1-y)*w*4, (w-y)*w*4), y*w*4);
    c2.putImageData(idat, 0, 0);
    const img = document.createElement('canvas'); img.width = w; img.height = w;
    const gi = img.getContext('2d');
    // 5 pasadas corridas 1px: las líneas de 1px pasan a ~2-3px y se LEEN
    [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(o => gi.drawImage(cvv, o[0], o[1]));
    tz.planImg = img;
    tz.planMeta = { cx: pcx, cz: pcz, H: H, w: w };
  }catch(e){ tz.planImg = null; }
}

function construirGrupoModelo(tz){
  const g = new THREE.Group();

  // COLORES HORNEADOS por vértice: degradé 3DDUT (cian abajo → naranja
  // arriba) multiplicado por una luz fija. Con la luz metida en el color,
  // el material puede ser Basic (sin cálculo de luces por cuadro): la pieza
  // se LEE — cada cara con su tono — y además rinde mucho más rápido.
  tz.geo.userData.pieles = tz.geo.userData.pieles || {};
  if(!tz.geo.getAttribute('color') && CFG.pielDefault && CFG.pielDefault !== 'altura'){
    const attr0 = hornearPiel(tz.geo, CFG.pielDefault, tz.medidas.y);
    tz.geo.setAttribute('color', attr0);
    S.piel = CFG.pielDefault; $('btnColor').textContent = 'Color: ' + S.piel;
  }
  if(!tz.geo.getAttribute('color')){
    const pos = tz.geo.getAttribute('position');
    const nrm = tz.geo.getAttribute('normal');
    const nV = pos.count, col = new Float32Array(nV*3);
    const cBajo = new THREE.Color(PAL.bajo), cAlto = new THREE.Color(PAL.alto);
    const L = new THREE.Vector3(.45,.78,.42).normalize();
    const c = new THREE.Color(), nv = new THREE.Vector3();
    const alto = Math.max(tz.medidas.y, .001);
    for(let i=0;i<nV;i++){
      c.copy(cBajo).lerp(cAlto, Math.max(0, Math.min(1, pos.getY(i)/alto)));
      nv.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      const lam = .42 + .58*Math.abs(nv.dot(L));   // luz fija horneada (dos caras)
      col[i*3] = c.r*lam; col[i*3+1] = c.g*lam; col[i*3+2] = c.b*lam;
    }
    tz.geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    tz.geo.userData.pieles.altura = tz.geo.getAttribute('color');
  }
  const mat = new THREE.MeshBasicMaterial({
    vertexColors:true, side:THREE.DoubleSide,
    transparent:false, opacity:1, depthWrite:true,
    polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:2
  });
  // VIDRIOS del OBJ de PlanObra: segundo grupo de la geometría → material translúcido
  let matVid = null;
  if(tz.geo.userData.hayVidrio && tz.geo.groups && tz.geo.groups.length > 1){
    matVid = new THREE.MeshBasicMaterial({
      vertexColors:true, side:THREE.DoubleSide,
      transparent:true, opacity:.35, depthWrite:false
    });
  }
  const mesh = new THREE.Mesh(tz.geo, matVid ? [mat, matVid] : mat);
  mesh.userData.esModelo3D = true;   // el botón Opacidad lo alterna sólido/fantasma
  g.add(mesh);
  g.userData.matLuz = mat;           // la estimación de luz ambiente modula este material
  if(matVid) g.userData.matVidrio = matVid;

  // sombra suave bajo el modelo — solo visible en modo MAQUETA (asienta la
  // pieza sobre la mesa); a escala 1:1 sería una mancha gigante en el piso
  try{
    const cvS = document.createElement('canvas'); cvS.width = cvS.height = 256;
    const cxS = cvS.getContext('2d');
    const grS = cxS.createRadialGradient(128, 128, 20, 128, 128, 128);
    grS.addColorStop(0, 'rgba(0,0,0,.42)'); grS.addColorStop(.7, 'rgba(0,0,0,.16)'); grS.addColorStop(1, 'rgba(0,0,0,0)');
    cxS.fillStyle = grS; cxS.fillRect(0, 0, 256, 256);
    const texS = new THREE.CanvasTexture(cvS);
    const ladoS = Math.max(tz.medidas.x, tz.medidas.z) * 1.25;
    const sombra = new THREE.Mesh(
      new THREE.PlaneGeometry(ladoS, ladoS),
      new THREE.MeshBasicMaterial({ map: texS, transparent: true, depthWrite: false })
    );
    sombra.rotation.x = -Math.PI/2;
    sombra.position.y = 0.003;
    sombra.renderOrder = -1;
    sombra.visible = false;
    g.add(sombra);
    g.userData.grpSombra = sombra;
  }catch(e){}

  // aristas blancas: los pliegues y gajos se leen como en el plano.
  // Se construyen DESPUÉS del primer cuadro para no trabar la colocación.
  // (EdgesGeometry de 80k caras = varios segundos de cuelgue en el celu: solo
  // modelos chicos, y recién 1,5 s después de arrancar, con el AR ya andando)
  if(tz.tris < 25000){
    setTimeout(() => {
      try{
        const bordes = new THREE.LineSegments(
          new THREE.EdgesGeometry(tz.geo, 24),
          new THREE.LineBasicMaterial({ color:0xf2f7fa, transparent:true, opacity:.9 })
        );
        g.add(bordes);
      }catch(e){}
    }, 1500);
  }

  const grilla = new THREE.GridHelper(Math.max(tz.medidas.x, tz.medidas.z) + 2, 20, PAL.acento, PAL.grilla);
  grilla.material.transparent = true; grilla.material.opacity = .22;
  grilla.userData.rol = 'grilla';
  g.add(grilla);

  // BANDERA de la esquina de referencia: es la esquina que se apoya sobre la
  // esquina real del galpón con el botón "Anclar esquina".
  const grpRef = new THREE.Group();
  grpRef.userData.rol = 'referencia';
  if(tz.refEsquina){
    // la bandera escala con el modelo: en un galpón de 70 m una bandera de
    // 1,6 m desaparece — acá mide hasta 6 m de alto
    const _maxD = Math.max(tz.medidas.x, tz.medidas.z);
    const kf = Math.min(6, Math.max(Math.min(1.6, _maxD * .6), _maxD * .08));
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(.03*kf, .03*kf, kf, 10),
      new THREE.MeshBasicMaterial({ color:PAL.acento }));
    poste.position.set(0, kf/2, 0);
    grpRef.add(poste);
    const bandera = new THREE.Mesh(new THREE.BoxGeometry(.30*kf, .18*kf, .015*kf),
      new THREE.MeshBasicMaterial({ color:PAL.acento, side:THREE.DoubleSide }));
    bandera.position.set(.16*kf, kf*.88, 0);
    grpRef.add(bandera);
    const etE = etiqueta('ESQUINA REF.', new THREE.Color(PAL.acento));
    etE.position.set(0, kf*1.12, 0);
    etE.scale.set(.22*kf, .055*kf, 1);
    grpRef.add(etE);
    // la PARED DE REFERENCIA marcada en el piso: desde la esquina, la línea
    // ámbar con flecha indica hacia dónde caminar para el segundo toque
    const Lp = Math.min(Math.max(tz.medidas.x * .5, 4), 14);
    const pared = new THREE.ArrowHelper(new THREE.Vector3(1,0,0),
      new THREE.Vector3(0,.03,0), Lp, PAL.aviso, Math.min(1.2, Lp*.12), Math.min(.7, Lp*.07));
    grpRef.add(pared);
    // el TRÍO DE EJES como en Inventor (X rojo · Y verde arriba · Z azul):
    // es el mismo origen que Rodrigo ve en el CAD — inconfundible
    const Lt = Math.max(1.2, kf * .55);
    [[new THREE.Vector3(1,0,0), PAL.ejeX], [new THREE.Vector3(0,1,0), PAL.ejeY], [new THREE.Vector3(0,0,1), PAL.ejeZ]]
      .forEach(par => grpRef.add(new THREE.ArrowHelper(par[0], new THREE.Vector3(0,0,0), Lt, par[1], Lt*.22, Lt*.1)));
    grpRef.position.copy(tz.refEsquina);
  }
  // la referencia solo importa en el flujo de 2 puntos (galpón / casa): en una
  // pieza chica que se apoya con un toque, la bandera estorba
  grpRef.visible = (S.verBandera !== false) && (Math.max(tz.medidas.x, tz.medidas.z) >= CFG.umbral2Puntos || S.modoUbic === '2puntos');
  g.add(grpRef);
  g.userData.grpRef = grpRef;

  const grpEtiq = new THREE.Group(), grpMaq = new THREE.Group();
  const et = etiqueta(tz.obra.replace(/\.(stl|obj)$/i,''), new THREE.Color(PAL.acento2));
  et.visible = !!CFG.etiquetaNombre;
  et.position.set(0, tz.medidas.y + .25, 0);
  et.scale.set(.6, .15, 1);
  grpEtiq.add(et);
  g.add(grpEtiq); g.add(grpMaq);
  g.userData.grpEtiq = grpEtiq;
  g.userData.grpMaq  = grpMaq;
  return g;
}

/* ------------------------------------------------------------
   7d. AUTO-AJUSTE POR PROFUNDIDAD (ICP restringido)
   El modelo ya está "más o menos" sobre la pieza real. Tomamos la
   nube de puntos de la cámara de profundidad y buscamos el giro
   (solo alrededor de Y) y la traslación que mejor encajan el
   modelo contra la pieza. 4 grados de libertad: es robusto con
   la profundidad ruidosa de un celu y no puede "acostar" el modelo.
   ------------------------------------------------------------ */

// Muestreo de la superficie del modelo, en coordenadas LOCALES del grupo
function muestrearModelo(grupo, nMax){
  nMax = nMax || 3000;
  grupo.updateMatrixWorld(true);
  const invG = new THREE.Matrix4().copy(grupo.matrixWorld).invert();
  const tris = [];   // {a,b,c,area}
  let areaTot = 0;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  grupo.traverse(o => {
    if(!o.isMesh || o.isInstancedMesh || o.isSprite || o.userData.rol === 'grilla') return;
    const g = o.geometry, pos = g.getAttribute('position');
    if(!pos) return;
    const M = new THREE.Matrix4().multiplyMatrices(invG, o.matrixWorld);
    const idx = g.index;
    const n = idx ? idx.count : pos.count;
    const paso = Math.max(1, Math.floor(n/3 / 20000));     // tope 20k triángulos leídos
    for(let i=0; i<n; i += 3*paso){
      const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i+1) : i+1, ic = idx ? idx.getX(i+2) : i+2;
      A.fromBufferAttribute(pos, ia).applyMatrix4(M);
      B.fromBufferAttribute(pos, ib).applyMatrix4(M);
      C.fromBufferAttribute(pos, ic).applyMatrix4(M);
      const ar = new THREE.Vector3().subVectors(B,A).cross(new THREE.Vector3().subVectors(C,A)).length()*.5;
      if(ar < 1e-9) continue;
      tris.push({ a:A.clone(), b:B.clone(), c:C.clone(), area:ar });
      areaTot += ar;
    }
  });
  if(!tris.length || areaTot <= 0) return null;
  const pts = [];
  tris.forEach(t => {
    let k = Math.max(1, Math.round(nMax * t.area / areaTot));
    for(let j=0;j<k && pts.length < nMax*2;j++){
      let u = Math.random(), v = Math.random();
      if(u+v > 1){ u = 1-u; v = 1-v; }
      pts.push(new THREE.Vector3().copy(t.a).addScaledVector(new THREE.Vector3().subVectors(t.b,t.a), u)
        .addScaledVector(new THREE.Vector3().subVectors(t.c,t.a), v));
    }
  });
  return pts;
}

// Índice espacial (grilla uniforme) para vecino más cercano
function crearGrilla(pts, celda){
  const map = new Map();
  const key = (x,y,z) => x + ',' + y + ',' + z;
  pts.forEach((p,i) => {
    const k = key(Math.floor(p.x/celda), Math.floor(p.y/celda), Math.floor(p.z/celda));
    (map.get(k) || map.set(k, []).get(k)).push(i);
  });
  return {
    pts, celda,
    masCercano(p, rMax){
      const cx = Math.floor(p.x/celda), cy = Math.floor(p.y/celda), cz = Math.floor(p.z/celda);
      const rc = Math.ceil(rMax/celda);
      let best = -1, bd = rMax*rMax;
      for(let dx=-rc; dx<=rc; dx++) for(let dy=-rc; dy<=rc; dy++) for(let dz=-rc; dz<=rc; dz++){
        const lst = map.get(key(cx+dx, cy+dy, cz+dz));
        if(!lst) continue;
        for(let i=0;i<lst.length;i++){
          const d = pts[lst[i]].distanceToSquared(p);
          if(d < bd){ bd = d; best = lst[i]; }
        }
      }
      return best;
    }
  };
}

// ICP: devuelve {ok, rotY, pos, n, err} o {ok:false, motivo}
// nube: puntos del mundo real (ref space). modeloLocal: puntos del modelo (coords locales).
// pose inicial: rotY0 (rad), pos0 (Vector3), escala (número, 1 = 1:1)
function _icpUna(nube, modeloLocal, grillas, grillasNube, modeloSub, rotY0, pos0, escala){
  const k = 1/(escala||1);
  const pick = (G, r) => (r >= 0.10) ? G.gruesa : (r >= 0.035 ? G.media : G.fina);
  const elegir = r => pick(grillas, r/k);
  const elegirN = r => pick(grillasNube, r);
  let rotY = rotY0, pos = pos0.clone();
  const q = new THREE.Quaternion(), qi = new THREE.Quaternion();
  const radios = [0.30, 0.20, 0.14, 0.10, 0.07, 0.05, 0.04, 0.03, 0.03, 0.025, 0.02, 0.02];
  let nCorr = 0, errFin = 0;
  const tmp = new THREE.Vector3();
  for(let it=0; it<radios.length; it++){
    q.setFromAxisAngle(new THREE.Vector3(0,1,0), rotY); qi.copy(q).invert();
    const r = radios[it] / (k>1 ? 1 : 1);
    // correspondencias: cada punto real → punto más cercano del modelo (en coords del mundo)
    const P = [], Q = [], D = [];
    for(let i=0;i<nube.length;i++){
      // mundo → local del grupo: local = R^-1 (p - pos) / k
      tmp.copy(nube[i]).sub(pos).applyQuaternion(qi).multiplyScalar(1/k);
      if(tmp.y < 0.03) continue;                 // piso: no participa
      const j = elegir(r).masCercano(tmp, r / k);
      if(j < 0) continue;
      const qw = modeloLocal[j].clone().multiplyScalar(k).applyQuaternion(q).add(pos); // local → mundo
      P.push(nube[i]); Q.push(qw); D.push(qw.distanceTo(nube[i]));
    }
    // correspondencias INVERSAS: cada punto del modelo → punto real más cercano.
    // Castiga las partes del modelo que quedan "en el aire" y ensancha la
    // cuenca de convergencia (evita mínimos locales con piezas simétricas)
    for(let i=0;i<modeloSub.length;i++){
      const qw = modeloSub[i].clone().multiplyScalar(k).applyQuaternion(q).add(pos);
      const j = elegirN(r).masCercano(qw, r);
      if(j < 0) continue;
      P.push(nube[j]); Q.push(qw); D.push(qw.distanceTo(nube[j]));
    }
    if(P.length < 60){ if(it === 0) return { ok:false, motivo:'El modelo está muy lejos de la pieza real: acercalo a mano primero.' }; break; }
    // recorte de outliers: descartar pares con distancia > 2.5 × mediana
    const ord = D.slice().sort((a,b)=>a-b), med = ord[Math.floor(ord.length/2)];
    const lim = Math.max(0.01, med*2.5);
    let cp = new THREE.Vector3(), cq = new THREE.Vector3(), n = 0;
    for(let i=0;i<P.length;i++){ if(D[i] > lim) continue; cp.add(P[i]); cq.add(Q[i]); n++; }
    if(n < 40) break;
    cp.multiplyScalar(1/n); cq.multiplyScalar(1/n);
    // giro óptimo en el plano XZ (Procrustes 2D): Q→P
    let a = 0, b = 0, err = 0;
    for(let i=0;i<P.length;i++){
      if(D[i] > lim) continue;
      const qx = Q[i].x-cq.x, qz = Q[i].z-cq.z, px = P[i].x-cp.x, pz = P[i].z-cp.z;
      a += qx*px + qz*pz;
      b += qx*pz - qz*px;
      err += D[i];
    }
    const phi = Math.atan2(b, a);           // rotación en el plano x→z
    // three: rotation.y = θ lleva (1,0,0) a (cosθ,0,−sinθ)  ⇒  θ = −φ
    const dTheta = -phi;
    // aplicar: pos' = R(dθ)·(pos − cq) + cp   (giro alrededor del centroide, luego trasladar)
    const rq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), dTheta);
    pos.sub(cq).applyQuaternion(rq).add(cp);
    rotY += dTheta;
    nCorr = n; errFin = err/n;
    if(Math.abs(dTheta) < 0.0005 && it > 6) break;
  }
  return { ok:true, rotY:rotY, pos:pos, n:nCorr, err:errFin };
}

// puntaje de una pose: cuántos puntos reales quedan a < 2.5 cm de la superficie del modelo
function _puntajePose(nube, modeloLocal, grillas, rotY, pos, escala, radio){
  radio = radio || 0.025;
  const grilla = (radio >= 0.10) ? grillas.gruesa : (radio >= 0.035 ? grillas.media : grillas.fina);
  const k = 1/(escala||1);
  const qi = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), rotY).invert();
  const tmp = new THREE.Vector3();
  let n = 0, sum = 0;
  for(let i=0;i<nube.length;i++){
    tmp.copy(nube[i]).sub(pos).applyQuaternion(qi).multiplyScalar(1/k);
    if(tmp.y < 0.03) continue;
    const j = grilla.masCercano(tmp, radio/k);
    if(j >= 0){ n++; sum += tmp.distanceTo(modeloLocal[j])*k; }
  }
  return { n:n, err: n ? sum/n : 1 };
}

// Búsqueda gruesa + refinado. El ICP puro cae en mínimos locales con piezas
// simétricas y vistas parciales (el modelo "se hunde" en la cáscara de puntos).
// 1) barrido de giros ±30° y corrimientos ±15 cm puntuando cuántos puntos
//    reales explica cada pose; 2) ICP fino sobre las 3 mejores; 3) gana la que
//    más inliers deja. Es async para no congelar el render entre pasos.
async function icpYaw(nube, modeloLocal, rotY0, pos0, escala, avance){
  if(!nube || nube.length < 200) return { ok:false, motivo:'Muy pocos puntos de profundidad (' + (nube?nube.length:0) + ').' };
  if(!modeloLocal || modeloLocal.length < 50) return { ok:false, motivo:'El modelo no tiene superficie muestreable.' };
  if(nube.length > 1200){ const paso = nube.length/1200; const sub = []; for(let i=0;i<nube.length;i+=paso) sub.push(nube[Math.floor(i)]); nube = sub; }
  const grillas = { gruesa: crearGrilla(modeloLocal, 0.12), media: crearGrilla(modeloLocal, 0.05), fina: crearGrilla(modeloLocal, 0.03) };
  const grillasNube = { gruesa: crearGrilla(nube, 0.12), media: crearGrilla(nube, 0.05), fina: crearGrilla(nube, 0.03) };
  const modeloSub = modeloLocal.filter((p,i) => i % Math.max(1, Math.round(modeloLocal.length/600)) === 0);
  const respiro = () => new Promise(r => setTimeout(r, 0));

  // 1) barrido grueso (con una submuestra: alcanza para rankear)
  const nubeB = nube.filter((p,i) => i % 2 === 0);
  const cand = [];
  // GIRO COMPLETO (el equipo real puede estar en cualquier orientación respecto
  // de cómo se apoyó el 3D) y corrimientos de ±30 cm: barrido grueso, después ICP
  const giros = []; for(let gd = -180; gd < 180; gd += (S.autoAmplio === false ? 15 : 15)) giros.push(gd*Math.PI/180);
  const pasos = [-0.30,-0.15,0,0.15,0.30];
  let hecho = 0, total = giros.length*pasos.length*pasos.length;
  for(const dg of giros){
    for(const dx of pasos) for(const dz of pasos){
      const pos = pos0.clone().add(new THREE.Vector3(dx,0,dz));
      const sc = _puntajePose(nubeB, modeloLocal, grillas, rotY0+dg, pos, escala, 0.04);
      cand.push({ rotY:rotY0+dg, pos:pos, s:sc.n });
      hecho++;
    }
    if(avance) avance(0.6*hecho/total);
    await respiro();
  }
  cand.sort((a,b) => b.s - a.s);
  const top = cand.slice(0, 5);
  // el punto de partida del usuario siempre entra, por si el barrido no lo eligió
  if(!top.some(c => c.rotY === rotY0 && c.pos.equals(pos0))) top.push({ rotY:rotY0, pos:pos0.clone(), s:0 });

  // 2) ICP fino sobre los candidatos
  let mejor = null, motivo = '';
  for(let i=0;i<top.length;i++){
    const r = _icpUna(nube, modeloLocal, grillas, grillasNube, modeloSub, top[i].rotY, top[i].pos, escala);
    if(avance) avance(0.6 + 0.4*(i+1)/top.length);
    await respiro();
    if(!r.ok){ motivo = motivo || r.motivo; continue; }
    const sc = _puntajePose(nube, modeloLocal, grillas, r.rotY, r.pos, escala, 0.025);
    r.score = sc.n - sc.err*200;
    r.inliers = sc.n;
    if(!mejor || r.score > mejor.score) mejor = r;
  }
  if(!mejor) return { ok:false, motivo: motivo || 'No se pudo encajar.' };
  // COINCIDENCIA: de los puntos reales que están cerca del modelo (<15 cm),
  // qué porcentaje quedó pegado a la superficie (<2,5 cm). 100% = calza justo.
  const cerca = _puntajePose(nube, modeloLocal, grillas, mejor.rotY, mejor.pos, escala, 0.15);
  mejor.pct = Math.round(100 * mejor.inliers / Math.max(1, cerca.n));
  return mejor;
}

/* ------------------------------------------------------------
   5. UI 2D
   ------------------------------------------------------------ */
function pintarInfo(tz){
  $('bObra').textContent = tz.obra;
  const cont = $('infoTrazado');
  cont.innerHTML = '';
  const badge = t => { const b=document.createElement('span'); b.className='ms-badge'; b.textContent=t; cont.appendChild(b); };
  if(tz.esModelo){
    badge(tz.obra);
    badge('MODELO 3D');
    badge(Math.round(tz.tris).toLocaleString('es-AR') + ' triángulos');
    badge(tz.medidas.x.toFixed(2) + ' × ' + tz.medidas.z.toFixed(2) + ' × ' + tz.medidas.y.toFixed(2) + ' m');
    $('leyenda').innerHTML = '';
    return;
  }
  if(tz.esMS){
    const paq = tz.paq;
    badge(tz.obra);
    badge('DETALLE COMPLETO');
    badge((paq.tramos||[]).length + ' tramos');
    badge((paq.accesorios||[]).length + ' accesorios');
    badge((paq.maquinas||[]).length + ' máquinas');
    badge(tz.medidas.x.toFixed(1) + ' × ' + tz.medidas.z.toFixed(1) + ' m');
    const dsMS = [...new Set((paq.tramos||[]).map(t => Math.round(t.d_mm||0)))].filter(d=>d>0).sort((a,b)=>a-b);
    const ley0 = $('leyenda'); ley0.innerHTML = '';
    const dMin0 = Math.min(...dsMS)/1000, dMax0 = Math.max(...dsMS)/1000;
    dsMS.forEach(d => {
      const c = colorPorDiametro(d/1000, dMin0, dMax0);
      const chip = document.createElement('span');
      chip.className = 'chip-d';
      chip.innerHTML = '<i style="background:#'+c.getHexString()+'"></i>Ø'+d;
      ley0.appendChild(chip);
    });
    return;
  }
  badge(tz.obra);
  badge(Object.keys(tz.nodos).length + ' nodos');
  badge(tz.tramos.length + ' tramos');
  badge(tz.maquinas.length + ' máquinas');
  badge(tz.medidas.x.toFixed(1) + ' × ' + tz.medidas.z.toFixed(1) + ' m');

  const ds = [...new Set(tz.tramos.map(t => Math.round(t.d*1000)))].sort((a,b)=>a-b);
  const dMin = Math.min(...ds)/1000, dMax = Math.max(...ds)/1000;
  const ley = $('leyenda'); ley.innerHTML = '';
  ds.forEach(d => {
    const c = colorPorDiametro(d/1000, dMin, dMax);
    const chip = document.createElement('span');
    chip.className = 'chip-d';
    chip.innerHTML = '<i style="background:#'+c.getHexString()+'"></i>Ø'+d;
    ley.appendChild(chip);
  });
}

function cargar(raw){
  try{
    S.trazado = (raw && raw.formato === 'MS_ASPIRACION_RED') ? parsePaqueteMS(raw) : parseTrazado(raw);
    if(S.trazado.esMS) prepararReferenciasMS(S.trazado);
    pintarInfo(S.trazado);
    // el JSON tiene que ser de la MISMA Calculadora que imprimió el plano: si el
    // marcador no trae el QR embebido, la app buscaría otra imagen y nunca lo vería
    if(S.trazado.esMS && S.trazado.marcador && !S.trazado.marcador.png){
      UI.estado('Este archivo del AR no trae el QR del plano (es de una Calculadora anterior). Para "Sobre plano impreso" volvé a exportarlo con el botón AR de la Calculadora nueva, y usá el mismo plano impreso.', 'err');
      registrar('JSON sin QR embebido (marcador ' + (S.trazado.marcador.patron || '?') + ')');
      return;
    }
    $('estadoAR').classList.remove('err');
    revisarSoporte();
  }catch(e){
    $('estadoAR').className = 'nota err';
    $('estadoAR').textContent = 'Error al leer el trazado: ' + e.message;
  }
}

/* ------------------------------------------------------------
   5bis. CALIBRACIÓN GUARDADA — por obra, en el celu
   La gracia: calibrás la nave UNA vez; la próxima que ancles el
   mismo trazado, rotación / altura / opacidad ya vienen puestas.
   ------------------------------------------------------------ */
function claveCalib(){ return S.trazado ? ('ar-calib::' + S.trazado.obra) : null; }
function borrarCalib(){ const k = claveCalib(); if(k){ try{ localStorage.removeItem(k); }catch(e){} } }

function guardarCalib(){
  const k = claveCalib();
  if(!k) return;
  try{
    localStorage.setItem(k, JSON.stringify({
      rotY:S.rotY, offsetY:S.offsetY, opacidad:S.opacidad
    }));
  }catch(e){}
}

function aplicarCalibGuardada(){
  const k = claveCalib();
  if(!k) return false;
  let c = null;
  try{ c = JSON.parse(localStorage.getItem(k)); }catch(e){}
  if(!c) return false;
  // La ALTURA guardada era lo que "perdía" el modelo en el espacio al rehacer
  // una simulación (flotaba a la altura de la vez anterior): arranca SIEMPRE en 0.
  // La rotación se recuerda solo para redes de conductería (misma nave); los
  // modelos OBJ arrancan derechos y se orientan con el flujo de 2 puntos.
  S.rotY = (S.trazado && !S.trazado.esModelo) ? (c.rotY || 0) : 0;
  S.offsetY = 0;
  // (la opacidad guardada ya no se restaura: la red arranca opaca siempre)
  if(S.grupo) S.grupo.rotation.y = S.rotY;
  return true;
}

/* ------------------------------------------------------------
   6. ESCENA COMÚN
   ------------------------------------------------------------ */
function nuevaEscena(){
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2f38, 2.2));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(2,6,3);
  scene.add(dir);
  return scene;
}

function aplicarEscala(){
  if(!S.grupo) return;
  let k = 1 / S.escala;
  S.escalaEf = S.escala;
  if(S.escala > 1 && !S.modoPapel && S.trazado && S.trazado.medidas){
    // MAQUETA: tiene que caber en una mesa y VERSE. Una pieza de 60 cm a 1:50
    // mide 1 cm (imposible de encontrar); un galpón de 70 m a 1:20 mide 3,5 m.
    const maxD = Math.max(S.trazado.medidas.x, S.trazado.medidas.y, S.trazado.medidas.z) || 1;
    const lado = maxD * k;
    if(lado < 0.30) k = 0.30 / maxD;
    if(lado > 2.0)  k = 2.0 / maxD;
    S.escalaEf = Math.round(1 / k * 10) / 10;
  }
  S.grupo.scale.setScalar(k);
  if(S.grupo.userData.grpSombra) S.grupo.userData.grpSombra.visible = S.escala > 1;
}

/* ------------------------------------------------------------
   7. MODO AR (WebXR)
   ------------------------------------------------------------ */
/* --- diagnóstico --- */
function esWebView(){
  const ua = navigator.userAgent;
  return /; wv\)/.test(ua) || (/Android/.test(ua) && !/Chrome\/\d+/.test(ua));
}

// registro de lo que pasa en la sesión: se guarda en el celu y se muestra
// con el botón Diagnóstico — así se puede ver qué pasó aunque Chrome se cuelgue
S._log = [];
function registrar(txt){
  try{
    const t = new Date(); const hh = t.toTimeString().slice(0,8);
    S._log.push(hh + ' ' + txt); if(S._log.length > 80) S._log.shift();
    localStorage.setItem('ar-registro', JSON.stringify(S._log));
  }catch(e){}
}
try{ const prev = JSON.parse(localStorage.getItem('ar-registro') || '[]'); if(prev.length){ S._log = prev.slice(-40); registrar('--- app abierta ' + VERSION + ' ---'); } }catch(e){}

async function diagnostico(){
  const l = [];
  l.push('version     : ' + VERSION + ' (' + CFG.marca + ')');
  l.push('protocolo   : ' + location.protocol);
  l.push('host        : ' + (location.host || '(ninguno)'));
  l.push('secureCtx   : ' + window.isSecureContext);
  l.push('navigator.xr: ' + ('xr' in navigator));
  l.push('WebView?    : ' + esWebView());
  l.push('en iframe?  : ' + (window.self !== window.top));
  if('xr' in navigator){
    try{ l.push('immersive-ar: ' + await navigator.xr.isSessionSupported('immersive-ar')); }
    catch(e){ l.push('immersive-ar: error ' + e.message); }
    try{ l.push('immersive-vr: ' + await navigator.xr.isSessionSupported('immersive-vr')); }
    catch(e){}
  }
  l.push('UA          : ' + navigator.userAgent);
  l.push('');
  l.push('REGISTRO (ultima sesion):');
  (S._log || []).slice(-40).forEach(x => l.push('  ' + x));
  const d = $('diag');
  d.classList.remove('oculto');
  d.textContent = l.join('\n');
}
$('btnDiag').addEventListener('click', diagnostico);

async function revisarSoporte(){
  const est = $('estadoAR');
  const hayTrazado = !!S.trazado;

  if(location.protocol !== 'http:' && location.protocol !== 'https:'){
    const comoAbrio = {
      'file:':    'como archivo local (file://)',
      'content:': 'desde la carpeta de Descargas (content://)',
      'blob:':    'como blob temporal'
    }[location.protocol] || ('con el protocolo ' + location.protocol);
    est.className='nota err';
    est.innerHTML = 'Abriste la página ' + comoAbrio + '.<br>' +
      'Ese es un <b>origen opaco</b>: no tiene dominio, así que WebXR rechaza toda sesión ' +
      'aunque el equipo sea compatible. No es problema del archivo.<br><br>' +
      'Hay que servirlo desde una URL <b>https://</b> real ' +
      '(GitHub Pages, o servidor_https.py en la LAN).';
    $('btnAR').disabled = true;
    return;
  }
  if(window.self !== window.top || esWebView()){
    est.className='nota err';
    est.innerHTML = 'Parece un <b>visor embebido / WebView</b> (no Chrome).<br>' +
      'El AR necesita Chrome completo. Abrí la URL directo en Chrome.';
  }
  if(!window.isSecureContext){
    est.className='nota err';
    est.innerHTML = 'Contexto NO seguro (' + location.protocol + ').<br>' +
      'WebXR solo arranca en <b>https://</b> o <b>localhost</b>.';
    $('btnAR').disabled = true;
    return;
  }
  if(!('xr' in navigator)){
    est.className='nota err';
    est.innerHTML = 'Este navegador no expone WebXR.<br>' +
      'Necesitás <b>Chrome en Android</b> con <b>Google Play Services for AR (ARCore)</b> instalado. ' +
      'En iPhone no existe: usá "Ver en 3D".';
    $('btnAR').disabled = true;
    return;
  }
  let ok = false;
  try{ ok = await navigator.xr.isSessionSupported('immersive-ar'); }catch(e){}
  if(!ok){
    est.className='nota err';
    est.textContent='WebXR AR no disponible en este dispositivo. En PC usá "Ver en 3D".';
    $('btnAR').disabled = true;
  }else{
    est.className='nota ok';
    est.textContent = hayTrazado ? 'AR listo. Tocá Iniciar AR.' : 'AR listo — abrí un OBJ o una red de la Calculadora.';
    $('btnAR').disabled = !hayTrazado;
  }
}

async function iniciarAR(){
  if(!S.trazado) return;

  const renderer = obtenerRenderer();
  const canvas = renderer.domElement;
  canvas.style.visibility = '';
  document.body.appendChild(canvas);
  canvas.style.position = 'fixed';
  canvas.style.top = '0'; canvas.style.left = '0';
  canvas.style.zIndex = '45';

  S.renderer = renderer;
  S.scene = nuevaEscena();
  S.camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.05, 500);

  // retícula de anclaje
  const ret = new THREE.Mesh(
    new THREE.RingGeometry(0.09, 0.13, 32).rotateX(-Math.PI/2),
    new THREE.MeshBasicMaterial({ color:PAL.acento, transparent:true, opacity:.9 })
  );
  ret.visible = false;
  S.scene.add(ret);
  S.reticula = ret;

  // guía del modo esquina: banderita + flecha de la pared de referencia,
  // pegadas a la retícula — se ve QUÉ se va a clavar y hacia dónde sale la pared
  const guia = new THREE.Group();
  const gPoste = new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.9,8),
    new THREE.MeshBasicMaterial({ color:PAL.acento }));
  gPoste.position.y = .45; guia.add(gPoste);
  const gBand = new THREE.Mesh(new THREE.BoxGeometry(.3,.18,.015),
    new THREE.MeshBasicMaterial({ color:PAL.acento, side:THREE.DoubleSide }));
  gBand.position.set(.17,.8,0); guia.add(gBand);
  const gFlecha = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,.02,0), 1.6, PAL.aviso, .3, .18);
  guia.add(gFlecha);
  guia.visible = false;
  S.scene.add(guia);
  S.esqGuia = guia;

  S.grupo = construirGrupo(S.trazado);
  S.grupo.visible = false;
  aplicarEscala();
  S.scene.add(S.grupo);
  S.anclado = false;
  S.rotY = 0; S.offsetY = 0;
  const habiaCalib = aplicarCalibGuardada();   // restaura rot/alt/opacidad de esta obra

  // IMPORTANTE: el root del dom-overlay tiene que estar VISIBLE antes de pedir
  // la sesión. Con display:none Chrome rechaza toda la configuración.
  $('capaUI').classList.add('oculto');
  $('capaAR').classList.remove('oculto');
  $('panelAR').classList.add('oculto');
  $('hudMsg').textContent = 'Iniciando AR…';

  // Reintentos degradados: si una feature no está soportada, probamos sin ella
  // anchors y depth-sensing van como OPCIONALES: si el equipo no los tiene,
  // la sesión arranca igual y la app degrada sola (sin persistencia / sin oclusión)
  const extras = ['anchors','depth-sensing','light-estimation'];
  // RECONOCIMIENTO DEL PLANO IMPRESO: si el paquete trae marcador y el modo es
  // "Sobre plano impreso", se pide image-tracking (Chrome lo tiene detrás de
  // chrome://flags/#webxr-incubations; si no está, se cae al flujo de 2 cruces)
  S.imgCfg = null; S.imgTrack = false;
  if(S.modoPapel && S.trazado && S.trazado.marcador){
    const bmp = await bitmapMarcador(S.trazado.marcador);
    if(bmp){
      extras.push('image-tracking');
      const fImp = S.factorImpresion || 1;   // hoja impresa reducida/ampliada (A1→A2 = 0,71…)
      S.imgCfg = { trackedImages: [{ image: bmp, widthInMeters: (S.trazado.marcador.lado_mm || 60) / 1000 * fImp }] };
      registrar('marcador declarado ' + Math.round((S.trazado.marcador.lado_mm || 60) * fImp) + ' mm (factor impresión ' + fImp.toFixed(2) + ')');
    }
  }

  const depthCfg = { usagePreference:['cpu-optimized'], dataFormatPreference:['luminance-alpha','float32'] };
  const intentos = [
    { nom:'hit-test + overlay + local-floor',
      cfg:Object.assign({ requiredFeatures:['hit-test','local-floor'], optionalFeatures:['dom-overlay'].concat(extras),
            domOverlay:{ root:$('capaAR') }, depthSensing:depthCfg }, S.imgCfg || {}) },
    { nom:'hit-test + overlay',
      cfg:Object.assign({ requiredFeatures:['hit-test'], optionalFeatures:['dom-overlay'].concat(extras),
            domOverlay:{ root:$('capaAR') }, depthSensing:depthCfg }, S.imgCfg || {}) },
    { nom:'hit-test solo',
      cfg:{ requiredFeatures:['hit-test'] } },
    { nom:'sin hit-test (colocación manual)',
      cfg:{ optionalFeatures:['dom-overlay'], domOverlay:{ root:$('capaAR') } } },
    { nom:'mínima',
      cfg:{} }
  ];

  let session = null, usado = '', errores = [], usaFloor = false;
  for(const it of intentos){
    try{
      session = await navigator.xr.requestSession('immersive-ar', it.cfg);
      usado = it.nom; registrar('sesion AR: ' + it.nom);
      usaFloor = !!(it.cfg.requiredFeatures && it.cfg.requiredFeatures.indexOf('local-floor') >= 0);
      break;
    }catch(e){
      errores.push(it.nom + ' → ' + (e.message || e.name));
    }
  }

  if(!session){
    $('capaAR').classList.add('oculto');
    $('capaUI').classList.remove('oculto');
    $('estadoAR').className = 'nota err';
    $('estadoAR').innerHTML = 'No se pudo iniciar AR. Probé estas configuraciones:<br>· ' +
      errores.join('<br>· ') +
      '<br><br>Si todas fallan, casi seguro falta <b>Google Play Services for AR</b> ' +
      'o el equipo no está en la lista de dispositivos ARCore.';
    canvas.remove();
    return;
  }

  S.session = session;
  S.overlayOK = !!(session.domOverlayState && session.domOverlayState.type);
  try{ S.imgTrack = !!(S.imgCfg && typeof session.getTrackedImageScores === 'function'); }catch(e){ S.imgTrack = false; }
  if(S.imgCfg) registrar('image-tracking ' + (S.imgTrack ? 'DISPONIBLE' : 'NO disponible (flag webxr-incubations)'));
  registrar('overlay ' + (S.overlayOK ? 'OK' : 'NO') + ' - escala 1:' + S.escala + ' - ' + (S.trazado && S.trazado.esModelo ? 'modelo ' + Math.round(S.trazado.tris) + ' caras' : 'red'));
  // el espacio de referencia tiene que coincidir con lo que la sesión otorgó:
  // si three pide 'local-floor' en una sesión sin esa feature, setSession revienta
  // y la pantalla queda "en la cámara" sin dibujar nada.
  try{
    const nat = (typeof XRWebGLLayer !== 'undefined' && XRWebGLLayer.getNativeFramebufferScaleFactor)
      ? XRWebGLLayer.getNativeFramebufferScaleFactor(session) : 1;
    renderer.xr.setFramebufferScaleFactor(Math.min(Math.max(nat || 1, 1), 1.2));
  }catch(e){}
  renderer.xr.setReferenceSpaceType(usaFloor ? 'local-floor' : 'local');
  try{
    await renderer.xr.setSession(session);
  }catch(e1){
    try{
      renderer.xr.setReferenceSpaceType('local');
      usaFloor = false;
      await renderer.xr.setSession(session);
    }catch(e2){
      try{ session.end(); }catch(e3){}
      cerrarAR();
      $('estadoAR').className = 'nota err';
      $('estadoAR').textContent = 'La sesión AR abrió pero no se pudo montar: ' + (e2.message || e2);
      return;
    }
  }
  S.usaFloor = usaFloor;
  S.refSpaceLocal = renderer.xr.getReferenceSpace();

  // luz ambiente estimada por ARCore: el modelo toma el brillo del lugar real
  S.lightProbe = null; S._luzK = 1;
  try{
    if(typeof session.requestLightProbe === 'function'){
      S.lightProbe = await session.requestLightProbe();
    }
  }catch(e){ S.lightProbe = null; }

  // hit-test si la sesión lo permite; si no, colocación manual a 2 m
  S.hitSource = null;
  if(typeof session.requestHitTestSource === 'function'){
    try{
      const refViewer = await session.requestReferenceSpace('viewer');
      // 'plane' + 'point': engancha el PISO y también las PAREDES — marcar
      // la esquina contra la pared proyecta al piso con más precisión
      try{
        S.hitSource = await session.requestHitTestSource({ space: refViewer, entityTypes: ['plane', 'point'] });
      }catch(e2){
        S.hitSource = await session.requestHitTestSource({ space: refViewer });
      }
    }catch(e){ S.hitSource = null; }
  }

  // ── v0.8: anclaje persistente ─────────────────────────────────
  S.ancPersist = ('persistentAnchors' in session) && (typeof session.restorePersistentAnchor === 'function');
  S.anchor = null; S.ancUuid = null; S.ancListo = false;
  S.ancPos = new THREE.Vector3(); S.ancQuat = new THREE.Quaternion();
  S.anchor2 = null; S.anc2Listo = false; S.anc2Pos = new THREE.Vector3(); S.anc2Yaw0 = 0; S.anc2Bear0 = 0;
  S.ancDelta = new THREE.Vector3(); S.ancRotLocal = 0;
  let restaurando = false;
  // Restaurar un ancla de otra sesión hacía que el modelo apareciera "en
  // cualquier lado" (otra oficina, otro día) y el toque no lo movía. Apagado.
  if(S.ancPersist && CFG.restaurarAncla){
    const guardado = leerAncla();
    if(guardado && guardado.uuid && [...session.persistentAnchors].indexOf(guardado.uuid) >= 0){
      try{
        S.anchor = await session.restorePersistentAnchor(guardado.uuid);
        S.ancUuid = guardado.uuid;
        S.ancDelta.fromArray(guardado.delta || [0,0,0]);
        S.ancRotLocal = guardado.rotLocal || 0;
        S.anclado = true;          // la pose llega cuando ARCore re-localiza
        restaurando = true;
      }catch(e){ S.anchor = null; borrarAncla(); }
    }
  }

  // ── v0.8: oclusión por profundidad (occluder que escribe gl_FragDepth) ──
  S.oclDisponible = false;
  S.ocl = crearOccluder();
  S.scene.add(S.ocl.mesh);

  // ── v0.8: medición ──
  S.medGrp = new THREE.Group(); S.medPts = [];
  S.scene.add(S.medGrp);
  // ── v1.0 ──
  S.escuadrando = false; S.escPts = []; S.autoPend = 0; S.autoNube = null; S.modeloPts = null; S.autoCorriendo = false; S.nubeAcum = null;
  $('btnEscuadrar').textContent = 'Escuadrar';
  $('btnAuto').textContent = 'Auto-ajuste';
  S.fijado = false;
  $('btnFijar').textContent = 'Fijar';

  UI.msg(restaurando
    ? 'Buscando el anclaje guardado… caminá despacio por donde lo calibraste.'
    : (S.hitSource
      ? 'Apuntá al piso hasta ver el aro y tocá la pantalla.'
      : 'Sin detección de piso: tocá la pantalla o usá "Traer acá".'));
  $('hudDatos').textContent = 'MODO ' + usado;
  SENS.dist = (S.escala === 1) ? 6 : 2.5;
  S.oclusion = (S.escala === 1);   // en maqueta la profundidad ruidosa de cerca "tapaba" el modelo
  $('btnOcl').textContent = 'Oclusión: ' + (S.oclusion ? 'ON' : 'OFF');
  $('btnMedir').textContent = 'Medir: OFF';

  $('panelAR').classList.remove('oculto');

  // MODELO GRANDE (un galpón): el flujo normal de "tocá el piso y aparece
  // todo" marea — el edificio te cae encima en cualquier lado. Acá se arranca
  // DIRECTO en el modo esquina: primero el rincón real, después la pared.
  const _tieneRef = S.trazado && S.trazado.refEsquina && S.trazado.planImg;
  const _grande = S.trazado && S.trazado.esModelo && Math.max(S.trazado.medidas.x, S.trazado.medidas.z) >= CFG.umbral2Puntos;
  const _por2 = _tieneRef && ((S.modoPapel) || (S.escala === 1 && (S.modoUbic === '2puntos' || (S.modoUbic !== 'toque' && _grande && S.trazado.esModelo))));
  if(S.modoPapel && S.imgTrack){
    // SOBRE PLANO IMPRESO con RECONOCIMIENTO: apuntar al marcador y listo
    S.esquinando = 0; S.marcadorBuscando = true;
    UI.msg('Apuntá la cámara al QR del plano (junto a la cruz 1), a 30-50 cm, con la hoja bien iluminada. El 3D se monta solo sobre la hoja.');
    UI.paso('1', 'Plano impreso · buscando el marcador');
  }
  else if(S.modoPapel && _tieneRef){
    // SOBRE PLANO IMPRESO sin reconocimiento: cruz 1 y cruz 2 del papel
    if(S.trazado.marcador) UI.estado('Este teléfono no tiene el reconocimiento de imagen activo (chrome://flags/#webxr-incubations). Se usa el modo de 2 cruces.', 'err');
    S.esquinando = 3; S.refP2 = S.trazado.refP2Sugerido ? { x: S.trazado.refP2Sugerido.x, z: S.trazado.refP2Sugerido.z } : null;
    S.planoModo = 'grande'; S.planZoom = 1; S.planPan = { x:0, y:0 };
    const bM1 = $('btnMini'); if(bM1) bM1.textContent = 'Planta: GRANDE';
    const bE1 = $('btnEsquina'); if(bE1){ bE1.textContent = '✔ Usar este punto'; bE1.classList.add('destacado'); }
    UI.msg('PLANO IMPRESO · cruz 1: es la esquina marcada en el plano (rojo). Si tu plano tiene la cruz 1 en otro lado, tocala acá. Después "✔ Usar este punto".');
    UI.paso('1', 'Plano impreso · paso 1 de 4 · la cruz 1 en el plano');
  }
  else if(S.trazado && S.escala > 1){
    // MAQUETA: sin puntos de referencia — apuntás a la mesa/piso y tocás
    UI.msg('Maqueta 1:' + S.escala + ' — apuntá a la mesa o al piso hasta ver el aro y tocá para apoyarla. 1 dedo mueve · 2 dedos giran.');
    UI.paso('1', 'Apoyar la maqueta');
  }
  else if(_por2){
    S.esquinando = 3;  S.refP2 = S.trazado.refP2Sugerido ? { x: S.trazado.refP2Sugerido.x, z: S.trazado.refP2Sugerido.z } : null;      // paso 0: ELEGIR el punto de referencia
    if(!S.modoPapel) S.escala = 1;           // a tamaño real los modelos van SIEMPRE 1:1
    S.planoModo = 'grande'; S.planZoom = 1; S.planPan = { x:0, y:0 };
    const bM0 = $('btnMini'); if(bM0) bM0.textContent = 'Planta: GRANDE';
    const bE = $('btnEsquina'); if(bE){ bE.textContent = '✔ Usar este punto'; bE.classList.add('destacado'); }
    UI.msg('PUNTO 1 en el plano: la tríada marca el origen del CAD. Si preferís otra esquina, hacé zoom (2 dedos) y tocala — tiene imán. Después "✔ Usar este punto".');
    UI.paso('1', 'Paso 1 de 4 · elegí el punto 1 en el plano');
  }
  else if(S.trazado && S.trazado.esModelo){
    UI.msg('Apuntá al piso hasta ver el aro y tocá para apoyar el modelo. Tocá otro lugar para moverlo · 2 dedos giran.');
    UI.paso('1', 'Apoyar el modelo');
  }
  else{
    UI.msg(S.hitSource
      ? 'Apuntá al piso hasta ver el aro y tocá para apoyar la red. Después: 2 dedos giran, Escuadrar la alinea a una pared.'
      : 'Sin detección de piso: tocá la pantalla o usá "Traer acá".');
    UI.paso('1', 'Apoyar la red');
  }


  // EL TOQUE. Con dom-overlay los toques llegan como eventos de puntero a la
  // capa #gestos (tapPantalla); el 'select' de la sesión queda solo para el
  // caso sin overlay (si se usaran los dos, cada toque se procesaría dos veces).
  S._habiaCalib = habiaCalib;
  if(!S.overlayOK) session.addEventListener('select', ev => tapPantalla(ev));


  session.addEventListener('end', () => cerrarAR(true));
  // BOTÓN ATRÁS de Android: en vez de que Chrome mate la sesión de golpe, se
  // sale por el camino limpio (el mismo que el botón Salir)
  try{ history.pushState({ ar: 1 }, ''); S._histAR = true; }catch(e){}

  renderer.setAnimationLoop((t, frame) => {
    // retícula: antes de anclar, y también mientras se mide
    if(frame && (!S.anclado || !S.fijado || S.midiendo || S.escuadrando || S.esquinando || S.pivMode) && S.hitSource){
      const hits = frame.getHitTestResults(S.hitSource);
      // Para APOYAR: el impacto MÁS CERCANO cuya superficie mira hacia arriba
      // (mesa, banco, piso). Los puntos sueltos SÍ cuentan: en una mesa chica
      // ARCore tarda en armar el plano y, sin ellos, el aro caía al piso de abajo.
      // En el replanteo por 2 puntos vale cualquiera (marcar contra la pared).
      let hit = null, pose = null;
      for(let hi = 0; hi < hits.length; hi++){
        const ps = hits[hi].getPose(S.refSpaceLocal); if(!ps) continue;
        if(S.esquinando || S.midiendo || S.escuadrando || S.pivMode || ps.transform.matrix[5] > 0.6){ hit = hits[hi]; pose = ps; break; }
      }
      if(!hit && hits.length){ hit = hits[0]; pose = hits[0].getPose(S.refSpaceLocal); }
      // LA MESA DE VERDAD: ARCore tarda en armar el plano de una mesa (y una
      // mesa lisa no da puntos): o no devuelve NADA, o el hit atraviesa hasta
      // el piso. La cámara de PROFUNDIDAD ve la superficie real donde apunta
      // el aro: si está más cerca que el hit (o no hay hit), manda ella.
      let pd = null;
      if((!S.esquinando || S.modoPapel) && !S.midiendo && !S.escuadrando){ try{ pd = puntoDeProfundidadCentro(frame); }catch(e){ pd = null; } }
      let usarDepth = false;
      if(pd){
        if(!hit) usarDepth = true;
        else{
          const hp = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(pose.transform.matrix));
          if(pd.dist < pd.cam.distanceTo(hp) - 0.12) usarDepth = true;
        }
      }
      if(usarDepth){
        S.reticula.visible = true;
        S.reticula.position.copy(pd.p);
        S.reticula.quaternion.identity();          // superficie horizontal (mesa / banco / piso)
        S.reticula.scale.setScalar(1);
        S.hitEsPared = false;
        S.hitDesdeDepth = true;
        S.ultimoHit = null;                        // ancla libre (no hay trackable ahí)
        S.reticula.material.color.setHex(PAL.aviso);
      }else if(hit && pose){
        S.reticula.visible = true;
        S.reticula.matrix.fromArray(pose.transform.matrix);
        S.reticula.matrix.decompose(S.reticula.position, S.reticula.quaternion, S.reticula.scale);
        S.reticula.scale.setScalar(1);
        S.ultimoHit = hit;
        // piso u pared: el eje Y del pose del hit es la normal de la superficie
        const _ny = S.reticula.matrix.elements[5];  // normal del hit (antes de re-escalar)
        S.hitEsPared = Math.abs(_ny) < 0.5;
        S.hitDesdeDepth = false;
        S.reticula.material.color.setHex(S.hitEsPared ? PAL.acento2 : PAL.acento);
      }else{
        S.reticula.visible = false;
        S.ultimoHit = null;
      }
      if(S.esqGuia){
        const mostrar = S.esquinando === 1 && S.reticula.visible;
        S.esqGuia.visible = mostrar;
        if(mostrar){
          S.esqGuia.position.copy(S.reticula.position);
          S.esqGuia.rotation.y = S.rotY;
        }
      }
    }else if(!S.midiendo && !S.escuadrando && !S.esquinando && !S.pivMode){
      S.reticula.visible = false;
    }
    // el aro se achica y atenúa cuando el modelo ya está apoyado (solo sugiere "tocá para re-apoyar")
    if(S.reticula.visible){
      const k = (S.anclado && !S.esquinando && !S.midiendo && !S.escuadrando) ? .55 : 1;
      S.reticula.scale.setScalar(k);
      S.reticula.material.opacity = k < 1 ? .55 : .9;
    }


    if(S.trazado && (S.trazado.esModelo || S.trazado.esMS)){
      S._miniTick = (S._miniTick||0) + 1;
      if(S._miniTick % 4 === 0) dibujarMiniPlanta();
    }
    // TRACKING de ARCore: si se pierde (cámara sobre una mesa lisa, muy cerca,
    // poca luz) el mundo se mueve con el teléfono. Avisar en el HUD y registrar.
    if(frame){
      let vpT = null; try{ vpT = frame.getViewerPose(S.refSpaceLocal); }catch(e){}
      const perdido = !vpT || vpT.emulatedPosition === true;
      if(perdido !== !!S._trackPerdido){
        S._trackPerdido = perdido;
        registrar(perdido ? 'TRACKING PERDIDO (movete despacio, apuntá a algo con textura)' : 'tracking recuperado');
        if(perdido) UI.msg('⚠ ARCore perdió la referencia: alejá un poco el celu, apuntá a cosas con textura (no solo la mesa lisa) y movete despacio.');
        else UI.msg('Referencia recuperada.');
      }
    }
    // mientras no está apoyado: registrar cada 2 s qué ve (para el Diagnóstico)
    S._regTick = (S._regTick||0) + 1;
    if(frame && !S.anclado && S._regTick % 120 === 0){
      let nh = -1; try{ nh = S.hitSource ? frame.getHitTestResults(S.hitSource).length : -1; }catch(e){}
      let pdd = null; try{ const q = puntoDeProfundidadCentro(frame); pdd = q ? q.dist.toFixed(2) : 'no'; }catch(e){ pdd = 'err'; }
      registrar('buscando: hits ' + nh + ' - profundidad ' + pdd + ' m - aro ' + (S.reticula.visible ? (S.hitDesdeDepth ? 'amarillo' : 'rojo') : 'NO'));
    }
    // ¿el modelo quedó lejos? (medido cada medio segundo): el HUD avisa y ofrece "Traer acá"
    S._distTick = (S._distTick||0) + 1;
    if(S._distTick % 30 === 0 && S.anclado && S.grupo && S.grupo.visible){
      try{
        const camX = renderer.xr.getCamera(); const cpos = new THREE.Vector3(); camX.getWorldPosition(cpos);
        const dm = cpos.distanceTo(S.grupo.position);
        const antes = S._distModelo; S._distModelo = dm;
        if((dm > 30) !== ((antes||0) > 30)) refrescarHUD();
      }catch(e){}
    }


    // RECONOCIMIENTO DEL MARCADOR: el 3D queda parado sobre el plano impreso y
    // sigue al papel mientras se vea (moviste el plano → se mueve el 3D) hasta "Fijar"
    if(frame && S.imgTrack && S.modoPapel && S.grupo && (!S.fijado || S._mkLock) && S.trazado && S.trazado.marcador && S.trazado.refEsquina){
      try{
        const res = frame.getImageTrackingResults();
        let visto = false;
        for(const r of res){
          if(r.trackingState !== 'tracked') continue;
          const pose = frame.getPose(r.imageSpace, S.refSpaceLocal); if(!pose) continue;
          const tr = pose.transform;
          const q = new THREE.Quaternion(tr.orientation.x, tr.orientation.y, tr.orientation.z, tr.orientation.w);
          pasoMarcador(tr.position, q, r.measuredWidthInMeters);
          visto = true;
          break;
        }
        if(!visto && S.anclado && !S.anchor && !S._pedirAncla && S._marcadorPerdidoTick === undefined){ S._marcadorPerdidoTick = 0; }
      }catch(e){}
    }
    // AUTO-AJUSTE CONTINUO: mientras está activo, cada ~10 s vuelve a capturar y
    // re-encaja (solo acepta si la coincidencia mejora) — caminando alrededor
    // del equipo el 3D se va clavando solo
    if(frame && S.autoContinuo && !S.autoCorriendo && S.autoPend === 0 && S.anclado){
      S._autoContTick = (S._autoContTick||0) + 1;
      if(S._autoContTick >= 600){ S._autoContTick = 0; S.autoNube = (S.nubeAcum || []).slice(); S.autoPend = 45; S._autoSilencioso = true; }
    }
    // auto-ajuste: juntar nube de puntos de varios frames y encajar.
    // Se capturan cuadros salteados durante ~1,5 s MIENTRAS el usuario se
    // mueve: la profundidad por movimiento mejora mucho con paralaje.
    if(frame && S.autoPend > 0){
      if(S.autoPend % 3 === 0 && S.autoNube.length < 22000){
        const pts = nubeDesdeFrame(frame);
        if(pts) S.autoNube.push(...pts);
      }
      S.autoPend--;
      $('hudMsg').textContent = 'Capturando profundidad… ' + S.autoNube.length + ' puntos — seguí moviéndote despacio';
      if(S.autoPend === 0) correrAutoAjuste();
    }

    // apoyado por PROFUNDIDAD (ancla libre): cuando ARCore arma el plano de la
    // mesa justo bajo el modelo, se pasa el ancla a ese plano (mucho más estable)
    if(frame && S._mejorarAncla && S.anclado && !S.fijado && !S.papelSinAncla && S.grupo && S.hitSource && S._regTick % 45 === 0){
      try{
        const hs2 = frame.getHitTestResults(S.hitSource);
        for(let k=0;k<hs2.length;k++){
          const ps2 = hs2[k].getPose(S.refSpaceLocal); if(!ps2) continue;
          const m2 = ps2.transform.matrix;
          if(m2[5] < 0.8) continue;
          const dy = Math.abs(m2[13] - S.grupo.position.y), dxz = Math.hypot(m2[12] - S.grupo.position.x, m2[14] - S.grupo.position.z);
          if(dy < 0.06 && dxz < 0.6 && typeof hs2[k].createAnchor === 'function'){
            S._mejorarAncla = false;
            hs2[k].createAnchor().then(a => { olvidarAncla(S.session); instalarAncla(a, S.session); registrar('ancla pasada al plano de la mesa'); }).catch(() => { S._mejorarAncla = true; });
            break;
          }
        }
      }catch(e){}
    }
    // fallback: si el ancla del hit no salio, se crea una libre en la pose actual
    if(frame && S._pedirAncla && !S.anchor && S.anclado && S.grupo && !S.papelSinAncla && typeof frame.createAnchor === 'function'){
      S._pedirAncla = false;
      try{
        const gp = S.grupo.position;
        const gq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), S.rotY);
        frame.createAnchor(new XRRigidTransform({x:gp.x, y:gp.y, z:gp.z, w:1}, {x:gq.x, y:gq.y, z:gq.z, w:gq.w}), S.refSpaceLocal)
          .then(a => instalarAncla(a, S.session)).catch(() => {});
      }catch(e){}
    }

    // segunda ancla (P2 del replanteo): su posición viva da el rumbo real
    if(frame && S.anchor2){
      let pose2 = null;
      try{ pose2 = frame.getPose(S.anchor2.anchorSpace, S.refSpaceLocal); }catch(e){}
      if(pose2){
        const t2 = pose2.transform;
        S.anc2Pos.set(t2.position.x, t2.position.y, t2.position.z);
        if(!S.anc2Listo && S.ancListo){
          // línea de base: en este instante el rumbo entre anclas equivale al
          // yaw del ancla 1 — de acá en más solo se aplican las CORRECCIONES
          const u0 = { x: S.anc2Pos.x - S.ancPos.x, z: S.anc2Pos.z - S.ancPos.z };
          if(u0.x*u0.x + u0.z*u0.z > 2.25){
            S.anc2Yaw0 = yawDe(S.ancQuat);
            S.anc2Bear0 = Math.atan2(-u0.z, u0.x);
            S.anc2Listo = true;
          }
        }
      }
    }

    // ancla: el trazado sigue al ancla (ARCore corrige la deriva solo).
    // La ORIENTACIÓN también se corrige en cada cuadro (antes solo se tomaba
    // al instalar el ancla → al caminar el edificio quedaba girado): con dos
    // anclas manda el rumbo entre ellas, con una el yaw vivo del ancla.
    if(frame && S.anchor && S.grupo && !S.papelSinAncla){
      let pose = null;
      try{ pose = frame.getPose(S.anchor.anchorSpace, S.refSpaceLocal); }catch(e){}
      if(pose){
        const tr = pose.transform;
        S.ancPos.set(tr.position.x, tr.position.y, tr.position.z);
        S.ancQuat.set(tr.orientation.x, tr.orientation.y, tr.orientation.z, tr.orientation.w);
        if(!S.ancListo){
          S.ancListo = true;
          if(S._fijarDelta){
            S._fijarDelta = false;
            sincronizarAncla();                 // ancla nueva: el offset sale de donde está el trazado
          }
          if(restaurando){
            $('hudMsg').textContent = 'Anclaje recuperado: el trazado está donde lo dejaste.';
            restaurando = false;
          }
        }
        const yA = yawAncla();
        const qE = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), yA);
        S.grupo.position.copy(S.ancDelta).applyQuaternion(qE).add(S.ancPos);
        S.rotY = S.ancRotLocal + yA;
        S.grupo.rotation.y = S.rotY;
        S.grupo.visible = true;
      }
      // (antes: si el ancla todavía no tenía pose, el modelo se ESCONDÍA — en una
      // mesa con tracking pobre el ancla puede no trackear nunca y la maqueta
      // "desaparecía". Ahora se queda donde se apoyó hasta que el ancla hable.)
    }

    // luz ambiente: modular el brillo del modelo con la luz real del lugar
    if(frame && S.lightProbe && S.grupo && S.grupo.userData.matLuz && typeof frame.getLightEstimate === 'function'){
      try{
        const le = frame.getLightEstimate(S.lightProbe);
        if(le && le.primaryLightIntensity){
          const pi = le.primaryLightIntensity;
          const i = Math.max(pi.x, pi.y, pi.z);
          const objetivo = Math.min(1.2, Math.max(.55, .45 + Math.cbrt(i) * .65));
          S._luzK += (objetivo - S._luzK) * .08;
          S.grupo.userData.matLuz.color.setScalar(S._luzK);
          if(S.grupo.userData.matVidrio) S.grupo.userData.matVidrio.color.setScalar(S._luzK);
        }
      }catch(e){}
    }

    // oclusión: profundidad real → depth buffer
    if(frame) actualizarOcclusion(frame, renderer);

    if(S.grupo && S.grupo.userData.grpEtiq){
      S.grupo.userData.grpEtiq.visible = S.verEtiquetas;
      S.grupo.userData.grpMaq.visible  = S.verMaquinas;
      if(S.grupo.userData.grpPiso) S.grupo.userData.grpPiso.visible = S.verPiso;
    }
    renderer.render(S.scene, S.camera);
  });
}

/* ------------------------------------------------------------
   6a. PLANO CON QR GENERADO EN LA APP
   Para un OBJ/STL cargado: vista en planta para imprimir (a la escala
   más grande que entre en la hoja), QR (qrcode.js, MIT) arriba a la
   izquierda, cruces 1 y 2, rótulo. Sale un PDF a tamaño físico exacto
   (imagen JPEG a 200/150 dpi envuelta en un PDF mínimo) y el mismo
   modelo como <nombre>_AR.obj con la hoja adentro. Se comparten con
   el menú del teléfono (WhatsApp, Drive, impresora) o se descargan.
   ------------------------------------------------------------ */
const HOJAS_APP = { a4:[297,210], a3:[420,297], a2:[594,420], a1:[841,594] };
const SERIE_ESC = [0.2,0.25,0.3,0.4,0.5,0.6,0.75,1,1.25,1.5,2,2.5,3,4,5,6,7.5,10,12.5,15,20,25,30,40,50,60,75,100,125,150,200,250,300,400,500,750,1000];

function qrCanvas(texto, pxModulo){
  if(typeof qrcode !== 'function') throw new Error('falta qrcode.js');
  const qr = qrcode(0, 'M'); qr.addData(texto); qr.make();
  const n = qr.getModuleCount(), b = 2, m = pxModulo || 12;
  const cv = document.createElement('canvas'); cv.width = cv.height = (n + 2*b) * m;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#000';
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(qr.isDark(r, c)) g.fillRect((c+b)*m, (r+b)*m, m, m);
  return cv;
}

// vista en planta PARA IMPRIMIR: gris claro con aristas oscuras sobre blanco (render target del renderer único)
function renderPlantaImpresion(tz, anchoPx, altoPx){
  const rnd = obtenerRenderer();
  const bb = tz.geo.boundingBox;
  const rt = new THREE.WebGLRenderTarget(anchoPx, altoPx, { depthBuffer: true, stencilBuffer: false });
  const esc = new THREE.Scene();
  esc.add(new THREE.Mesh(tz.geo, new THREE.MeshBasicMaterial({ color: 0xd9dde2, side: THREE.DoubleSide })));
  if(tz.tris < 120000){ try{ esc.add(new THREE.LineSegments(new THREE.EdgesGeometry(tz.geo, 25), new THREE.LineBasicMaterial({ color: 0x1a2432 }))); }catch(e){} }
  const alto = bb.max.y - bb.min.y;
  const corte = (alto > 3) ? (bb.min.y + 1.8) : (bb.max.y + 10);
  const cam = new THREE.OrthographicCamera(bb.min.x, bb.max.x, -bb.min.z, -bb.max.z, .01, (corte - bb.min.y) + 5);
  // mirando hacia abajo con el +X a la derecha y el −Z (arriba del plano) hacia arriba de la hoja
  cam.position.set(0, corte, 0); cam.up.set(0, 0, -1); cam.lookAt(0, bb.min.y, 0);
  const xrEra = rnd.xr.enabled; rnd.xr.enabled = false;
  rnd.setRenderTarget(rt); rnd.setClearColor(0xffffff, 1); rnd.clear(); rnd.render(esc, cam);
  const px = new Uint8Array(anchoPx * altoPx * 4); rnd.readRenderTargetPixels(rt, 0, 0, anchoPx, altoPx, px);
  rnd.setRenderTarget(null); rnd.setClearColor(0x000000, 0); rnd.xr.enabled = xrEra; rt.dispose();
  const cv = document.createElement('canvas'); cv.width = anchoPx; cv.height = altoPx;
  const c2 = cv.getContext('2d'); const idat = c2.createImageData(anchoPx, altoPx);
  for(let y = 0; y < altoPx; y++) idat.data.set(px.subarray((altoPx-1-y)*anchoPx*4, (altoPx-y)*anchoPx*4), y*anchoPx*4);
  c2.putImageData(idat, 0, 0);
  return cv;
}

// PDF mínimo con una imagen JPEG a tamaño físico exacto (W×H en mm)
function pdfConJPEG(jpegDataURL, Wmm, Hmm, anchoPx, altoPx){
  const b64 = jpegDataURL.split(',')[1]; const bin = atob(b64);
  const jpg = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) jpg[i] = bin.charCodeAt(i);
  const Wpt = (Wmm/25.4*72).toFixed(2), Hpt = (Hmm/25.4*72).toFixed(2);
  const enc = new TextEncoder();
  const partes = []; const offs = []; let len = 0;
  const push = (u8) => { partes.push(u8); len += u8.length; };
  const txt = (t) => push(enc.encode(t));
  txt('%PDF-1.4\n');
  const obj = (n, cuerpo) => { offs[n] = len; txt(n + ' 0 obj\n' + cuerpo + '\nendobj\n'); };
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + Wpt + ' ' + Hpt + '] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
  const cont = 'q ' + Wpt + ' 0 0 ' + Hpt + ' 0 0 cm /Im0 Do Q';
  obj(4, '<< /Length ' + cont.length + ' >>\nstream\n' + cont + '\nendstream');
  offs[5] = len;
  txt('5 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + anchoPx + ' /Height ' + altoPx + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n');
  push(jpg); txt('\nendstream\nendobj\n');
  const xref = len;
  let x = 'xref\n0 6\n0000000000 65535 f \n';
  for(let i=1;i<=5;i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  x += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  txt(x);
  return new Blob(partes, { type: 'application/pdf' });
}

// el OBJ con la hoja adentro (texto original si lo hay; si no —STL— se escribe desde la geometría)
function textoOBJConHoja(tz, hoja){
  const cab = '# MSAR_HOJA ' + JSON.stringify(hoja) + '\n';
  if(S._textoOBJ) return cab + S._textoOBJ + (S._textoOBJ.endsWith('\n') ? '' : '\n');
  const pos = tz.geo.getAttribute('position'), O = tz.refOrigen, f = tz.fUnid || 0.001;
  const partes = [cab, '# generado por MS AR desde ' + tz.obra + '\n'];
  const n = pos.count;
  for(let i=0;i<n;i++){
    const lx = pos.getX(i), ly = pos.getY(i), lz = pos.getZ(i);
    partes.push('v ' + ((lx - O.x)/f).toFixed(2) + ' ' + ((-(lz - O.z))/f).toFixed(2) + ' ' + ((ly - O.y)/f).toFixed(2) + '\n');
  }
  const idx = tz.geo.index;
  if(idx){ for(let i=0;i<idx.count;i+=3) partes.push('f ' + (idx.getX(i)+1) + ' ' + (idx.getX(i+1)+1) + ' ' + (idx.getX(i+2)+1) + '\n'); }
  else{ for(let i=0;i<n;i+=3) partes.push('f ' + (i+1) + ' ' + (i+2) + ' ' + (i+3) + '\n'); }
  return partes.join('');
}

async function entregarArchivos(archivos){
  try{
    if(navigator.share && navigator.canShare && navigator.canShare({ files: archivos })){
      await navigator.share({ files: archivos, title: 'Plano AR con QR' });
      return 'compartido';
    }
  }catch(e){ if(e && e.name === 'AbortError') return 'cancelado'; }
  archivos.forEach((f, i) => setTimeout(() => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.style.display = 'none';
    document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 4000);
  }, i * 700));
  return 'descargado';
}

async function generarHojaEnApp(hojaNom){
  const tz = S.trazado;
  if(!tz || !tz.esModelo || !tz.geo){ UI.estado('Primero abrí un OBJ o STL: el plano con QR se genera para ese modelo.', 'err'); return null; }
  hojaNom = (hojaNom || 'a3').toLowerCase(); if(!HOJAS_APP[hojaNom]) hojaNom = 'a3';
  try{
    UI.estado('Generando el plano con QR (' + hojaNom.toUpperCase() + ')…');
    await new Promise(r => setTimeout(r, 30));
    const [W, H] = HOJAS_APP[hojaNom];
    const bb = tz.geo.boundingBox, f = tz.fUnid || 0.001, O = tz.refOrigen || new THREE.Vector3();
    const anMM = (bb.max.x - bb.min.x)/f, laMM = (bb.max.z - bb.min.z)/f, alMM = (bb.max.y - bb.min.y)/f;
    const mg = MARCADOR_MARGEN_MM[hojaNom] || 90, ladoQR = MARCADOR_LADO_MM[hojaNom] || 62, cOff = 6 + ladoQR/2;   // centro del marcador: a cOff mm del origen del dibujo
    const ox = mg, oy = mg, dispW = W - ox - 15, dispH = H - oy - 25;
    let esc = SERIE_ESC.find(e => anMM/e <= dispW && laMM/e <= dispH); if(!esc) esc = SERIE_ESC[SERIE_ESC.length-1];
    const k = 1/esc;
    const nombre = tz.obra.replace(/\.(obj|stl)$/i, '');
    // coordenadas DEL ARCHIVO de las esquinas del plano (arriba-izq y abajo-der)
    const aFile = (lx, lz) => [ (lx - O.x)/f, -(lz - O.z)/f ];
    const e1 = aFile(bb.min.x, bb.min.z), e2 = aFile(bb.max.x, bb.max.z);
    const texto = 'MS AR | ' + nombre.slice(0, 40) + ' | plano 1:' + esc;
    const qrCv = marcadorCompuesto(qrCanvas(texto, 12), 1000);
    const png = qrCv.toDataURL('image/png');
    const marcador = { patron:'QR2', lado_mm:ladoQR, escala:esc, texto:texto, png:png, x_file_mm: e1[0] - cOff*esc, y_file_mm: e1[1] + cOff*esc };
    const hoja = { version:1, hoja:hojaNom, escala:esc, titulo:nombre, esquina1_mm:e1, esquina2_mm:e2,
                   bbox_mm:[e1[0], e2[1], 0, e2[0], e1[1], alMM], marcador:marcador, origen:'app' };
    // ── la hoja como imagen ──
    const DPI = (hojaNom === 'a1' || hojaNom === 'a2') ? 150 : 200;
    const px = mm => mm/25.4*DPI;
    const Wpx = Math.round(px(W)), Hpx = Math.round(px(H));
    const cv = document.createElement('canvas'); cv.width = Wpx; cv.height = Hpx;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, Wpx, Hpx);
    // planta
    const dibW = Math.max(2, Math.round(px(anMM*k))), dibH = Math.max(2, Math.round(px(laMM*k)));
    const pl = renderPlantaImpresion(tz, Math.min(dibW, 2600), Math.min(dibH, 2600));
    g.drawImage(pl, px(ox), px(oy), dibW, dibH);
    g.strokeStyle = '#c9ced4'; g.lineWidth = Math.max(1, px(.3)); g.strokeRect(px(ox), px(oy), dibW, dibH);
    // cruces
    const rojo = '#e0292a';
    const cruz = (cx, cy, num, dx, dy) => {
      g.strokeStyle = rojo; g.lineWidth = Math.max(1, px(.5));
      g.beginPath(); g.moveTo(cx - px(6), cy); g.lineTo(cx + px(6), cy); g.moveTo(cx, cy - px(6)); g.lineTo(cx, cy + px(6)); g.stroke();
      g.beginPath(); g.arc(cx, cy, px(2.5), 0, Math.PI*2); g.stroke();
      g.fillStyle = rojo; g.font = 'bold ' + Math.round(px(3.8)) + 'px sans-serif'; g.fillText(num, cx + px(dx), cy + px(dy));
    };
    cruz(px(ox), px(oy), '1', -9, -4); cruz(px(ox) + dibW, px(oy) + dibH, '2', 5, 7);
    // QR
    g.imageSmoothingEnabled = false;
    g.drawImage(qrCv, px(ox - 6 - ladoQR), px(oy - 6 - ladoQR), px(ladoQR), px(ladoQR));
    g.imageSmoothingEnabled = true;
    // rótulo
    g.fillStyle = '#111'; g.font = 'bold ' + Math.round(px(4.6)) + 'px sans-serif'; g.fillText('PLANO PARA MS AR · ' + nombre, px(ox), px(12));
    g.fillStyle = '#333'; g.font = Math.round(px(3.0)) + 'px sans-serif';
    g.fillText('Escala 1:' + esc + ' · hoja ' + hojaNom.toUpperCase() + ' · imprimir al 100 % (sin "ajustar a página") · ' + new Date().toLocaleDateString('es-AR') + ' · pieza ' + Math.round(anMM) + ' x ' + Math.round(laMM) + ' x ' + Math.round(alMM) + ' mm', px(ox), px(17));
    g.fillText('En MS AR: abrir ' + nombre + '_AR.obj, modo "Sobre plano impreso", apuntar al QR. El 3D se monta sobre esta hoja.', px(ox), px(21));
    g.font = Math.round(px(2.6)) + 'px sans-serif';
    g.fillText('Cruz 1 = esquina superior izquierda de la pieza · Cruz 2 = esquina inferior derecha · el QR es el marcador (sin reconocimiento de imágenes: tocar cruz 1 y cruz 2).', px(ox), px(24.5));
    g.fillStyle = '#666'; g.fillText((CFG.marca === 'MS' ? 'Metalúrgica Sarmiento · Depto. Innovación y Desarrollo' : '3DDUT Digital Craft') + ' · generado en la app', px(ox), px(H - 8));
    const jpeg = cv.toDataURL('image/jpeg', 0.92);
    const pdf = pdfConJPEG(jpeg, W, H, Wpx, Hpx);
    const objTxt = textoOBJConHoja(tz, hoja);
    const fPdf = new File([pdf], nombre + '_planoAR_' + hojaNom + '.pdf', { type: 'application/pdf' });
    const fObj = new File([objTxt], nombre + '_AR.obj', { type: 'text/plain' });
    // dejar el modelo LISTO en esta misma sesión
    tz.hoja = hoja; tz.marcador = marcador;
    tz.refEsquina = new THREE.Vector3(bb.min.x, 0, bb.min.z); tz.refP2Sugerido = { x: bb.max.x, z: bb.max.z };
    try{ localStorage.setItem('ar-hoja::' + tz.obra + '::' + (tz.tamano || 0), JSON.stringify(hoja)); }catch(e){}
    const rP = document.querySelector('input[name="modo"][value="papel"]'); if(rP){ rP.checked = true; rP.dispatchEvent(new Event('change')); }
    S._ultimaHoja = { pdf: fPdf, obj: fObj };
    const como = await entregarArchivos([fPdf, fObj]);
    UI.estado('Plano con QR listo (' + hojaNom.toUpperCase() + ', escala 1:' + esc + '): ' + fPdf.name + ' y ' + fObj.name + ' ' + (como === 'compartido' ? 'compartidos' : (como === 'descargado' ? 'descargados' : '')) + '. Imprimí el PDF al 100 %; este modelo ya quedó en modo "Sobre plano impreso".', 'ok');
    registrar('hoja generada en la app: ' + hojaNom + ' 1:' + esc);
    return { pdf: fPdf, obj: fObj, hoja: hoja };
  }catch(e){
    UI.estado('No se pudo generar el plano: ' + (e.message || e), 'err');
    registrar('ERROR hoja en app: ' + (e.message || e));
    return null;
  }
}

/* ------------------------------------------------------------
   6b. MARCADOR DEL PLANO IMPRESO — la imagen que rastrea WebXR
   Es el cuadrado con patrón que la Calculadora imprime junto a la
   cruz 1. Se dibuja acá con EL MISMO algoritmo (LCG 9×9) para que
   lo impreso y lo buscado sean idénticos.
   ------------------------------------------------------------ */
function patronMarcador(){
  let s = 20260901; const n = 9, cel = [];
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for(let j=0;j<n;j++) for(let i=0;i<n;i++){ const r = rnd(); cel.push(r < .42 ? 1 : (r < .58 ? 2 : 0)); }
  return cel;
}
/* ------------------------------------------------------------
   6·bis. UN CUADRO DE LECTURA DEL MARCADOR
   Vive afuera del render loop a propósito: así se puede probar con
   lecturas simuladas (test_ar.py le mete el ruido que tiene ARCore
   de verdad y comprueba que, una vez clavado, el 3D no se mueve).
   pos  = posición del centro del marcador en el espacio local
   quat = orientación de la imagen · medido = measuredWidthInMeters
   ------------------------------------------------------------ */
function pasoMarcador(pos, quat, medido){
  if(!S.grupo || !S.trazado || !S.trazado.marcador) return;
  const q = quat;
                // el +X de la imagen = el +X del plano; el papel está apoyado (su normal mira arriba)
      const dirX = new THREE.Vector3(1,0,0).applyQuaternion(q);
      const th = Math.atan2(-dirX.z, dirX.x);
      const mk = S.trazado.marcador;
      // FACTOR DE IMPRESIÓN: si la hoja se imprimió en otro tamaño (A1 en A2 = 71 %),
      // el QR mide distinto y la escala del papel también. Manda el selector "Hoja
      // impresa"; si está en "medir", se usa el ancho que ARCore le mide al QR.
      let fac = S.factorImpresion || 0;
      if(!fac){
        const mw = medido;
        const decl = (mk.lado_mm || 60) / 1000;
        if(mw > 0.01 && decl > 0){
          const fm = mw / decl;
          if(fm > 0.2 && fm < 5){ S._facMedido = S._facMedido ? (S._facMedido*0.9 + fm*0.1) : fm; }
          S._anchoMedido = mw;
        }
        fac = S._facMedido || 1;
      }
      // LA ESCALA SE CONGELA AL CLAVAR. El ancho que ARCore le mide al QR
      // tiembla; recalcular la escala en cada cuadro hacia crecer y achicar
      // el modelo solo, y como se escala desde el marcador, TODO se corria.
      let esc;
      if(S._mkLock && S._escFija){
        esc = S._escFija;
      }else{
        esc = (mk.escala || S.escala || 50) / fac;
        if(Math.abs(S.escala - esc) > esc*0.01){ S.escala = esc; S.escalaEf = Math.round(esc*10)/10; S.grupo.scale.setScalar(1/esc); if(S.grupo.userData.grpSombra) S.grupo.userData.grpSombra.visible = true; }
      }
      const k = 1/esc;
      // centro del marcador en coordenadas LOCALES del modelo (metros reales) → escalado y girado
      let mLocal;
      if(mk.x_file_mm != null && S.trazado.refOrigen){
        const F = S.trazado.fUnid || 0.001, O = S.trazado.refOrigen;
        mLocal = new THREE.Vector3(O.x + mk.x_file_mm*F, 0, O.z - mk.y_file_mm*F).multiplyScalar(k);
      }else{
        mLocal = new THREE.Vector3(S.trazado.refEsquina.x + (mk.dx_m || 0), 0, S.trazado.refEsquina.z + (mk.dy_m || 0)).multiplyScalar(k);
      }
      const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), th);
      const posT = new THREE.Vector3(pos.x, pos.y, pos.z).sub(mLocal.applyQuaternion(qY));
      // El plano 0 del modelo va APOYADO en la hoja: la Y sale del papel y
      // nada más. Cualquier altura de antes (un ▲ o un arrastre de dos dedos)
      // lo dejaba flotando arriba del plano impreso.
      if(!S._alturaCero){ S._alturaCero = true; S.offsetY = 0; }
      posT.y += S.offsetY;

      if(S._mkLock){
        // CLAVADO ES CLAVADO: acá NO se mueve nada. La lectura del QR tiembla
        // uno o dos centímetros según el ángulo desde el que se mire, así que
        // cualquier corrección "suave" termina siendo el modelo nadando sobre
        // la hoja. Solo se vuelve a leer si el PAPEL se corrió de verdad.
        const dp = posT.distanceTo(S._mkLock.pos), da = Math.abs(angNorm(th - S._mkLock.rotY));
        // Diagnóstico: cada 3 s se anota cuánto se aparta la lectura viva del
        // punto clavado. Si eso es chico y aun así se ve moverse, lo que se
        // mueve es el tracking del teléfono, no la lectura del QR.
        S._mkDiagTick = (S._mkDiagTick || 0) + 1;
        if(S._mkDiagTick % 180 === 0) registrar('clavado: la lectura viva se aparta ' + Math.round(dp*1000) + ' mm y ' + (da*180/Math.PI).toFixed(1) + '°');
        if(dp > 0.04 || da > 4*Math.PI/180){
          S._mkMovTick = (S._mkMovTick || 0) + 1;
          if(S._mkMovTick >= 20){
            S._mkLock = null; S._mkMovTick = 0; S._mkBuf = []; S._mkDesde = 0; S._escFija = 0;
            S.fijado = false; $('btnFijar').textContent = 'Fijar';
            olvidarAncla(S.session); S._pedirAncla = false;
            registrar('plano movido: vuelve a leer el marcador');
            UI.msg('El plano se movió: el 3D lo sigue de nuevo y se vuelve a clavar en un segundo.');
          }
        }else S._mkMovTick = 0;
        return;
      }

      // SIGUIENDO EL PAPEL: la pose que devuelve ARCore para una imagen
      // TIEMBLA, y cambia con el angulo desde el que se mire. Si el 3D la
      // copia cuadro a cuadro se mueve todo el tiempo. Por eso se promedian
      // las ultimas ~15 lecturas (posicion y giro) y se va suave hacia ese
      // promedio; despues se clava y no se toca mas.
      if(!S._mkDesde) S._mkDesde = performance.now();
      S._mkBuf = S._mkBuf || [];
      S._mkBuf.push({ p: posT.clone(), th: th });
      if(S._mkBuf.length > 15) S._mkBuf.shift();
      let _sx = 0, _sy = 0, _sz = 0, _cs = 0, _sn = 0;
      S._mkBuf.forEach(b => { _sx += b.p.x; _sy += b.p.y; _sz += b.p.z; _cs += Math.cos(b.th); _sn += Math.sin(b.th); });
      const _n = S._mkBuf.length;
      const pProm = new THREE.Vector3(_sx/_n, _sy/_n, _sz/_n), thProm = Math.atan2(_sn, _cs);
      let _disp = 0;
      S._mkBuf.forEach(b => { const d2 = b.p.distanceTo(pProm); if(d2 > _disp) _disp = d2; });

      S.grupo.position.lerp(pProm, 0.25);
      S.rotY = S.rotY + angNorm(thProm - S.rotY) * 0.25;
      S.grupo.rotation.y = S.rotY;
      S.grupo.visible = true; S.anclado = true;

      if(S.marcadorBuscando){
        S.marcadorBuscando = false;
        registrar('marcador reconocido: escala 1:' + (Math.round(esc*10)/10) + ' giro ' + (th*180/Math.PI).toFixed(1) + ' factor impresión ' + fac.toFixed(2) + (S.factorImpresion ? ' (manual)' : ' (medido)'));
        UI.msg('✓ Plano reconocido (escala 1:' + (Math.round(esc*10)/10) + (Math.abs(fac-1) > 0.05 ? ', hoja impresa al ' + Math.round(fac*100) + ' %' : '') + '). Sostené el celu apuntando al QR un segundo: se clava solo.');
        UI.paso('', '');
      }

      // Se clava cuando la lectura se quedo quieta (15 muestras dentro de 2 cm)
      // o, si nunca se aquieta (mano temblorosa, poca luz), a los 2,5 s igual:
      // mejor clavado con 1 cm de error que bailando para siempre.
      const _estable = (_n >= 15 && _disp < 0.02);
      const _porTiempo = (performance.now() - S._mkDesde) > 2500;
      if(_estable || _porTiempo){
        S.grupo.position.copy(pProm); S.rotY = thProm; S.grupo.rotation.y = thProm;
        S._mkLock = { pos: pProm.clone(), rotY: thProm }; S._mkMovTick = 0; S._escFija = esc;
        S.fijado = true; $('btnFijar').textContent = 'Fijado ✓';
        // NADA de ancla acá: el ancla de ARCore se reacomoda con el plano de
        // la mesa y levantaba y giraba el modelo. La hoja es la referencia.
        S.papelSinAncla = true; olvidarAncla(S.session); S._pedirAncla = false;
        if(S.reticula) S.reticula.visible = false;
        registrar('marcador clavado (' + (_estable ? 'lectura estable' : 'por tiempo') + ') disp ' + Math.round(_disp*1000) + ' mm' +
          ' · QR declarado ' + Math.round((mk.lado_mm || 60) * (S.factorImpresion || 1)) + ' mm' +
          (S._anchoMedido ? ' · medido por ARCore ' + Math.round(S._anchoMedido*1000) + ' mm' : '') +
          ' · escala 1:' + (Math.round(esc*10)/10) + ' (congelada)');
        if(S._anchoMedido && Math.abs(S._anchoMedido*1000 - (mk.lado_mm||60)*(S.factorImpresion||1)) > (mk.lado_mm||60)*0.12){
          UI.msg('⚠ El QR impreso NO mide lo que dice la hoja (medido ' + Math.round(S._anchoMedido*1000) + ' mm, esperado ' + Math.round((mk.lado_mm||60)*(S.factorImpresion||1)) + ' mm): imprimí al 100 %, sin "ajustar a página", o elegí la reducción en "Hoja impresa".');
        }
        UI.msg('✓ 3D clavado sobre el plano. Si movés la hoja, la sigue solo · "Apoyar de nuevo" lo libera.');
        refrescarHUD();
      }
}

async function bitmapMarcador(mk){
  // QR embebido por la Calculadora (ar.marcador.png): se rastrea ESA imagen
  if(mk && mk.png){
    try{
      const img = new Image();
      await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = mk.png; });
      // el QR va sobre fondo blanco con su zona muda (así lo imprime la hoja)
      const W = 900, cv = document.createElement('canvas'); cv.width = cv.height = W;
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, W);
      g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, W, W);
      return await createImageBitmap(cv);
    }catch(e){ /* cae al patrón */ }
  }
  const W = 900, cv = document.createElement('canvas'); cv.width = cv.height = W;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, W);
  g.fillStyle = '#fff'; g.fillRect(W*.09, W*.09, W*.82, W*.82);
  const c = W*.82/9, o = W*.09, cel = patronMarcador();
  for(let j=0;j<9;j++) for(let i=0;i<9;i++){
    const v = cel[j*9+i]; if(!v) continue;
    g.fillStyle = v === 1 ? '#000' : '#0095b8';
    g.fillRect(o + i*c, o + j*c, c + .5, c + .5);
  }
  g.fillStyle = '#e0292a'; g.fillRect(o, o, c*1.5, c*1.5);
  try{ return await createImageBitmap(cv); }catch(e){ return null; }
}

/* ------------------------------------------------------------
   7·0. EL TOQUE EN PANTALLA — apoyar / re-apoyar el modelo
   Mientras el modelo NO está fijado, cada toque sobre el aro lo
   vuelve a apoyar ahí (así "marcar la base" siempre funciona y el
   modelo nunca queda perdido). "Fijar" lo bloquea; "Apoyar de
   nuevo" lo libera. Medir / escuadrar / 2 puntos tienen prioridad.
   ------------------------------------------------------------ */
function tapPantalla(ev){
  if(!S.session || !S.grupo) return;
  registrar('toque - aro ' + (S.reticula && S.reticula.visible ? ('a ' + S.reticula.position.y.toFixed(2) + ' m de alto' + (S.hitEsPared ? ' (pared)' : '') + (S.hitDesdeDepth ? ' (por profundidad)' : ' (hit ARCore)')) : 'NO visible') + ' - anclado ' + S.anclado + ' - fijado ' + S.fijado + ' - modo ' + (S.esquinando ? 'esquina' + S.esquinando : (S.midiendo ? 'medir' : 'apoyar')));
  if(S.pivMode === 1){ elegirPuntoDel3D(); return; }
  if(S.pivMode === 2){ marcarPivoteReal(); return; }
  if(S.esquinando){ puntoEsquina(); return; }
  if(S.midiendo){ agregarPuntoMedicion(); return; }
  if(S.escuadrando){ agregarPuntoEscuadra(); return; }
  if(S.autoCorriendo) return;
  if(S.anclado && S.fijado){
    UI.msg('El modelo está FIJADO en su lugar. Para apoyarlo en otro lado: "Apoyar de nuevo".');
    return;
  }
  if(S.reticula && S.reticula.visible){ apoyarEnReticula(); }
  else if(S.escala > 1){
    // MAQUETA sin aro: igual se apoya — al frente, a 80 cm, a la altura de la
    // mano — y se acomoda con el dedo (1 dedo mueve, 2 dedos suben/bajan/giran)
    const cam = S.renderer && S.renderer.xr.isPresenting ? S.renderer.xr.getCamera() : S.camera;
    const cp = new THREE.Vector3(), fw = new THREE.Vector3();
    cam.getWorldPosition(cp); cam.getWorldDirection(fw); fw.y = 0; if(fw.lengthSq() < 1e-6) fw.set(0,0,-1); fw.normalize();
    S.grupo.position.copy(cp).addScaledVector(fw, 0.8); S.grupo.position.y = cp.y - 0.35 + S.offsetY;
    S.grupo.rotation.y = S.rotY; S.grupo.visible = true; S.anclado = true;
    olvidarAncla(S.session); S._pedirAncla = true;
    registrar('apoyada al frente (sin aro) a 0,8 m');
    UI.msg('Apoyada al frente. 1 dedo la mueve · 2 dedos la giran y suben/bajan · cuando esté bien, "Fijar".');
  }else{
    colocarAlFrente();
    // sin retícula: ancla libre en el punto donde quedó
    S._pedirAncla = true;
    UI.msg('Colocado al frente (no se detectó el piso). 1 dedo mueve · 2 dedos giran · − cerca / + lejos.');
  }
  refrescarHUD();
}

function apoyarEnReticula(){
  S.grupo.position.copy(S.reticula.position);
  registrar('apoyado en (' + S.reticula.position.x.toFixed(2) + ', ' + S.reticula.position.y.toFixed(2) + ', ' + S.reticula.position.z.toFixed(2) + ') escala ef 1:' + (S.escalaEf || S.escala) + (S.hitDesdeDepth ? ' por profundidad' : ' por hit'));
  S._mejorarAncla = !!S.hitDesdeDepth;   // ancla libre por ahora: si aparece el plano, se pasa a él
  // (se apoya EXACTAMENTE donde está el aro — sobre una mesa, sobre el piso —
  // sin proyectar a ningún lado: la proyección al piso mandaba la maqueta
  // de la mesa al suelo cuando el hit venía con la normal torcida)
  S.grupo.position.y += S.offsetY;
  S.grupo.rotation.y = S.rotY;
  S.grupo.visible = true;
  S.anclado = true;
  // ancla real de ARCore → sobrevive a la deriva del tracking. A escala real va
  // pegada al PLANO del hit; en MAQUETA va LIBRE (un ancla pegada al plano de la
  // mesa se movía cuando ARCore re-estimaba ese plano y el modelo "se iba solo").
  olvidarAncla(S.session);
  if(S.escala === 1 && S.ultimoHit && typeof S.ultimoHit.createAnchor === 'function'){
    S.ultimoHit.createAnchor().then(a => instalarAncla(a, S.session)).catch(() => { S._pedirAncla = true; });
  }else{
    S._pedirAncla = true;
  }
  if(S.escala > 1){
    const _mx = S.trazado && S.trazado.medidas ? Math.max(S.trazado.medidas.x, S.trazado.medidas.y, S.trazado.medidas.z) / (S.escalaEf || S.escala) : 0;
    UI.msg('Maqueta apoyada (mide ' + (_mx >= 1 ? _mx.toFixed(1) + ' m' : Math.round(_mx*100) + ' cm') + ' de lado, escala 1:' + (S.escalaEf || S.escala) + '). Tocá otro lugar para moverla · 2 dedos giran · "Fijar" cuando esté bien.');
  }else if(S.trazado && S.trazado.esModelo){
    UI.msg('Modelo apoyado en el aro. Tocá otro lugar para re-apoyarlo · 1 dedo mueve · 2 dedos giran · "Fijar" cuando esté bien.');
  }else{
    UI.msg(S._habiaCalib
      ? 'Red apoyada con la orientación guardada. Tocá otro lugar para re-apoyarla · 2 dedos giran · Escuadrar afina.'
      : 'Red apoyada. Tocá otro lugar para re-apoyarla · 1 dedo mueve · 2 dedos giran · Escuadrar / Auto-ajuste afinan.');
  }
  UI.paso('', '');
}

/* ------------------------------------------------------------
   7·1. PUNTO DEL 3D — clavar un punto conocido del modelo en una
   marca real y girar alrededor de él.
   El caso del taller: no está el galpón para referenciar, pero SÍ
   está el filtro. Se elige "Entrada al equipo" (o se toca un punto
   del 3D), se apunta el aro a la marca hecha en la pared/piso donde
   va esa boca y se toca: la boca queda clavada ahí. Desde ese
   momento ⟲ ⟳, "Girar 90°" y el twist de 2 dedos giran la red
   ALREDEDOR de ese punto hasta que calce con la planta real.
   ------------------------------------------------------------ */
function girarRed(nuevo){
  if(!S.grupo) return;
  if(S.piv && S.piv.local){
    const Y = new THREE.Vector3(0,1,0), k = S.grupo.scale.x || 1;
    const off = S.piv.local.clone().multiplyScalar(k);
    const pw = off.clone().applyAxisAngle(Y, S.rotY).add(S.grupo.position);   // el punto, quieto en el mundo
    S.rotY = nuevo;
    S.grupo.position.copy(pw).sub(off.applyAxisAngle(Y, nuevo));
  }else{
    S.rotY = nuevo;
  }
  S.grupo.rotation.y = S.rotY;
}
function _btnPiv(txt, dest){ const b = $('btnPivote'); if(b && b.textContent !== undefined){ b.textContent = txt; b.classList.toggle('destacado', !!dest); } }
function marcarPivote3D(local, nombre){
  S.piv = { local: local.clone(), nombre: nombre };
  try{ if(S._pivMesh) S._pivMesh.parent.remove(S._pivMesh); }catch(e){}
  const k = S.grupo.scale.x || 1;
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.05 / Math.max(k, 1e-6), 14, 10),   // 5 cm en el mundo, a cualquier escala
    new THREE.MeshBasicMaterial({ color: PAL.acento, transparent: true, opacity: .85, depthTest: false }));
  m.position.copy(local); m.renderOrder = 999; m.userData.rol = 'pivote';
  S.grupo.add(m); S._pivMesh = m;
}
function cancelarPivote(silencio){
  S.pivMode = 0; S.piv = null;
  try{ if(S._pivMesh) S._pivMesh.parent.remove(S._pivMesh); }catch(e){}
  S._pivMesh = null;
  const l = document.getElementById('listaPiv'); if(l) l.remove();
  _btnPiv('Punto del 3D', false);
  if(!silencio){ UI.msg('Punto del 3D cancelado.'); UI.paso('', ''); }
  refrescarHUD();
}
function mostrarListaPivote(){
  if(!S.grupo) return;
  const viejo = document.getElementById('listaPiv'); if(viejo) viejo.remove();
  const capa = $('capaAR');
  const box = document.createElement('div'); box.id = 'listaPiv';
  box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:110px;z-index:80;pointer-events:auto;touch-action:manipulation;' +
    'background:rgba(10,13,22,.96);color:#fff;border-left:5px solid ' + cssPal('acento') + ';border-radius:10px;padding:12px 12px 8px;' +
    'font:15px/1.3 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6);max-height:55vh;overflow:auto';
  const tit = document.createElement('div'); tit.style.cssText = 'font-weight:700;margin-bottom:8px;letter-spacing:.5px';
  tit.textContent = '¿Qué punto del 3D vas a clavar en la realidad?'; box.appendChild(tit);
  const mk = (txt, fn, sub) => {
    const b = document.createElement('button');
    b.style.cssText = 'display:block;width:100%;text-align:left;margin:6px 0;padding:13px 12px;pointer-events:auto;touch-action:manipulation;' +
      'background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:8px;font:inherit';
    b.innerHTML = txt + (sub ? '<br><small style="opacity:.7">' + sub + '</small>' : '');
    const _ir = ev => { ev.preventDefault(); ev.stopPropagation(); if(b.dataset.usado) return; b.dataset.usado = '1'; fn(); };
    b.addEventListener('click', _ir);
    b.addEventListener('pointerup', _ir);
    box.appendChild(b); return b;
  };
  const refs = (S.grupo.userData && S.grupo.userData.puntosRef) || [];
  refs.forEach(r => mk('📍 ' + r.nombre, () => { box.remove(); marcarPivote3D(r.p, r.nombre); S.pivMode = 2; _btnPiv('Cancelar punto', true);
    UI.msg('"' + r.nombre + '" elegido. Ahora apuntá el aro a la MARCA REAL donde va ese punto (pared o piso) y tocá.'); UI.paso('2', 'Punto del 3D · paso 2 · tocá la marca real'); }));
  mk('👆 Tocar un punto del 3D', () => { box.remove(); S.pivMode = 1; _btnPiv('Cancelar punto', true);
    UI.msg('Apuntá el CENTRO de la pantalla al punto del 3D (una boca, una brida) y tocá.'); UI.paso('1', 'Punto del 3D · paso 1 · apuntá al punto del modelo y tocá'); },
    'apuntás con el centro de la pantalla a una boca o brida del modelo');
  if(S.piv) mk('✖ Quitar el punto actual (' + S.piv.nombre + ')', () => cancelarPivote());
  mk('Cancelar', () => box.remove());
  box.addEventListener('beforexrselect', ev => ev.preventDefault());
  box.addEventListener('pointerdown', ev => ev.stopPropagation());
  box.addEventListener('pointerup', ev => ev.stopPropagation());
  box.addEventListener('touchstart', ev => ev.stopPropagation(), { passive: true });
  capa.appendChild(box);
  // RED DE SEGURIDAD: si por lo que sea el panel no responde, se va solo a los
  // 25 s. Nunca puede dejar la pantalla trabada.
  setTimeout(() => { const v = document.getElementById('listaPiv'); if(v === box) box.remove(); }, 25000);
}
function elegirPuntoDel3D(){
  if(!S.grupo || !S.grupo.visible){ UI.msg('El 3D no está a la vista: apoyalo primero (o "Traer acá") y después elegí el punto.'); return; }
  const cam = S.renderer && S.renderer.xr.isPresenting ? S.renderer.xr.getCamera() : S.camera;
  const o = new THREE.Vector3(), d = new THREE.Vector3(); cam.getWorldPosition(o); cam.getWorldDirection(d);
  const rc = new THREE.Raycaster(o, d, 0.05, 300); rc.camera = cam;
  let hits = [];
  try{ hits = rc.intersectObject(S.grupo, true).filter(h => h.object.visible && h.object.type !== 'Sprite' && h.object.userData.rol !== 'pivote'); }catch(e){ hits = []; }
  if(!hits.length){ UI.msg('No toqué el 3D: apuntá el centro de la pantalla a una boca o brida del modelo y tocá de nuevo.'); return; }
  const local = S.grupo.worldToLocal(hits[0].point.clone());
  marcarPivote3D(local, 'punto tocado');
  S.pivMode = 2;
  registrar('punto del 3D elegido en local (' + local.x.toFixed(2) + ', ' + local.y.toFixed(2) + ', ' + local.z.toFixed(2) + ')');
  UI.msg('Punto marcado en el 3D (bolita). Ahora apuntá el aro a la MARCA REAL donde va (pared o piso) y tocá.');
  UI.paso('2', 'Punto del 3D · paso 2 · tocá la marca real');
}
function marcarPivoteReal(){
  if(!S.grupo || !S.piv) { S.pivMode = 0; return; }
  S.papelSinAncla = false;      // ya no es el papel el que manda: va ancla real
  if(!S.reticula || !S.reticula.visible){ UI.msg('No veo superficie ahí: acercate a la marca (pared o piso) hasta que aparezca el aro y tocá.'); return; }
  const P = S.reticula.position.clone();
  const Y = new THREE.Vector3(0,1,0), k = S.grupo.scale.x || 1;
  const off = S.piv.local.clone().multiplyScalar(k);
  S.grupo.position.copy(P).sub(off.applyAxisAngle(Y, S.rotY));
  S.grupo.rotation.y = S.rotY;
  S.grupo.visible = true; S.anclado = true; S.fijado = false; $('btnFijar').textContent = 'Fijar';
  S.pivMode = 0; S._mkLock = null;
  // ancla física en la marca: si el tracking se corrige, la boca vuelve sola a su lugar
  olvidarAncla(S.session);
  if(S.ultimoHit && typeof S.ultimoHit.createAnchor === 'function'){
    S.ultimoHit.createAnchor().then(a => instalarAncla(a, S.session)).catch(() => { S._pedirAncla = true; });
  }else{
    S._pedirAncla = true;
  }
  registrar('punto del 3D "' + S.piv.nombre + '" clavado en (' + P.x.toFixed(2) + ', ' + P.y.toFixed(2) + ', ' + P.z.toFixed(2) + ')' + (S.hitEsPared ? ' contra la pared' : ''));
  _btnPiv('Punto: ' + S.piv.nombre, true);
  UI.msg('✓ "' + S.piv.nombre + '" clavado en la marca. Girá con ⟲ ⟳ (o 2 dedos): la red gira ALREDEDOR de ese punto. Cuando calce, "Fijar".');
  UI.paso('', '');
  refrescarHUD();
}

// "TRAER ACÁ": rescate del modelo perdido — lo trae al frente, a la altura
// del piso, sin fijar, y olvida el ancla vieja. Un botón siempre a mano.
function traerAca(){
  if(!S.grupo) return;
  S.offsetY = 0;
  S.fijado = false; S._mkLock = null; S._mkBuf = []; S._mkDesde = 0; S.papelSinAncla = false; S._escFija = 0;
  if(S.piv || S.pivMode) cancelarPivote(true);
  olvidarAncla(S.session);
  if(SENS.activo){ colocarAlFrente(); refrescarHUD(); return; }
  colocarAlFrente();
  S._pedirAncla = true;
  UI.msg('Modelo traído al frente. Apuntá al piso y tocá el aro para apoyarlo donde va.');
  $('btnFijar').textContent = 'Fijar';
  refrescarHUD();
}

function fijarModelo(si){
  S.fijado = !!si;
  $('btnFijar').textContent = S.fijado ? 'Fijado ✓' : 'Fijar';
  if(S.fijado){
    if(S.reticula) S.reticula.visible = false;
    if(!S.anchor) S._pedirAncla = true;
    S.marcadorBuscando = false;
    if(S.imgTrack && S.modoPapel && S.grupo) S._mkLock = { pos: S.grupo.position.clone(), rotY: S.rotY };   // fijado a mano sobre el papel: si movés la hoja, la sigue igual
    sincronizarAncla(); guardarCalib();
    UI.msg('Fijado ✓. Los toques ya no lo mueven. Ajuste fino con los botones o "Apoyar de nuevo" para cambiarlo de lugar.');
  }else{
    S._mkLock = null; S._mkBuf = []; S._mkDesde = 0; S.papelSinAncla = false; S._escFija = 0;
    UI.msg('Liberado: tocá el aro para apoyarlo en otro lado.');
  }
}

/* ------------------------------------------------------------
   7a. ANCLAJE PERSISTENTE (WebXR Anchors)
   El ancla es un punto físico que ARCore trackea. El trazado se
   guarda como offset + rotación RELATIVOS al ancla (no al ref
   space, que cambia en cada sesión). Con persistentAnchors el
   handle sobrevive al cierre de la app: calibrás una vez.
   ------------------------------------------------------------ */
function yawDe(q){ return new THREE.Euler().setFromQuaternion(q, 'YXZ').y; }

function claveAncla(){ return S.trazado ? ('ar-ancla::' + S.trazado.obra) : null; }
function leerAncla(){
  const k = claveAncla(); if(!k) return null;
  try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; }
}
let _tGuardAncla = 0;
function guardarAncla(){
  const k = claveAncla(); if(!k || !S.ancUuid) return;
  const ahora = performance.now(); if(ahora - _tGuardAncla < 500) return;   // no en cada pointermove
  _tGuardAncla = ahora;
  try{ localStorage.setItem(k, JSON.stringify({ uuid:S.ancUuid, delta:S.ancDelta.toArray(), rotLocal:S.ancRotLocal })); }catch(e){}
}
function borrarAncla(){
  const k = claveAncla(); if(!k) return;
  try{ localStorage.removeItem(k); }catch(e){}
}

// yaw efectivo del sistema de anclas: con DOS (P1 y P2 del replanteo) manda
// el rumbo entre sus posiciones — ARCore corrige las posiciones mucho mejor
// que la orientación de un ancla sola, que deriva al caminar; con una, su yaw.
function yawAncla(){
  if(S.anchor2 && S.anc2Listo){
    const u = { x: S.anc2Pos.x - S.ancPos.x, z: S.anc2Pos.z - S.ancPos.z };
    if(u.x*u.x + u.z*u.z > 2.25) return S.anc2Yaw0 + (Math.atan2(-u.z, u.x) - S.anc2Bear0);
  }
  return yawDe(S.ancQuat);
}

// el trazado se movió (gesto / botón): recalcular su offset respecto del ancla.
// El offset se expresa en el marco Y-puro del yaw efectivo (el modelo vive
// sobre el piso: cabeceo/rolido del ancla no deben inclinar el delta).
function sincronizarAncla(){
  if(!S.anchor || !S.ancListo || !S.grupo) return;
  const yA = yawAncla();
  const inv = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), -yA);
  S.ancDelta.copy(S.grupo.position).sub(S.ancPos).applyQuaternion(inv);
  S.ancRotLocal = S.rotY - yA;
  guardarAncla();
}

async function instalarAncla(anchor, session){
  if(!anchor || !S.grupo) return;
  registrar('ancla instalada');
  S.anchor = anchor; S.ancListo = false;
  S._fijarDelta = true;   // en la primera pose, el offset se calcula desde el trazado
  // handle persistente
  if(S.ancPersist && typeof anchor.requestPersistentHandle === 'function'){
    try{
      // un solo ancla guardada por obra: borrar la anterior
      const prev = leerAncla();
      if(prev && prev.uuid){ try{ await session.deletePersistentAnchor(prev.uuid); }catch(e){} }
      S.ancUuid = await anchor.requestPersistentHandle();
    }catch(e){ S.ancUuid = null; }
  }
  refrescarHUD();
}

function olvidarAncla(session){
  try{ if(S.anchor2 && S.anchor2.delete) S.anchor2.delete(); }catch(e){}
  S.anchor2 = null; S.anc2Listo = false;
  if(S.anchor){
    if(S.ancUuid && session && typeof session.deletePersistentAnchor === 'function'){
      try{ session.deletePersistentAnchor(S.ancUuid).catch(() => {}); }catch(e){}
    }
    try{ S.anchor.delete && S.anchor.delete(); }catch(e){}
  }
  S.anchor = null; S.ancUuid = null; S.ancListo = false;
  borrarAncla();
}

/* ------------------------------------------------------------
   7b. OCLUSIÓN POR PROFUNDIDAD (WebXR Depth Sensing, CPU)
   Cada frame se sube el mapa de profundidad como textura y un
   quad de pantalla completa escribe SOLO profundidad (sin color).
   Resultado: las máquinas y columnas reales tapan los caños que
   pasan por detrás.
   ------------------------------------------------------------ */
function crearOccluder(){
  const mat = new THREE.ShaderMaterial({
    uniforms:{
      tDepth:{ value:null }, uvT:{ value:new THREE.Matrix4() },
      rawToM:{ value:1 }, p22:{ value:-1 }, p23:{ value:-0.02 }, fmt:{ value:0 }
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader:
      'uniform sampler2D tDepth; uniform mat4 uvT; uniform float rawToM, p22, p23; uniform int fmt;\n' +
      'varying vec2 vUv;\n' +
      'void main(){\n' +
      '  vec2 nv = vec2(vUv.x, 1.0 - vUv.y);\n' +          // spec: origen arriba-izq, Y hacia abajo
      '  vec2 tc = (uvT * vec4(nv, 0.0, 1.0)).xy;\n' +
      '  vec4 s = texture2D(tDepth, tc);\n' +
      '  float raw = (fmt == 1) ? s.r : (s.r*255.0 + s.g*255.0*256.0);\n' +
      '  float d = raw * rawToM;\n' +
      '  if(d < 0.05) discard;\n' +          // sin dato: no ocluir
      '  float zv = -d; float ndc = (p22*zv + p23) / (-zv);\n' +
      '  gl_FragDepthEXT = clamp(ndc*0.5 + 0.5, 0.0, 1.0);\n' +
      '  gl_FragColor = vec4(0.0);\n' +
      '}',
    colorWrite:false, depthWrite:true, depthTest:true, depthFunc:THREE.AlwaysDepth
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1e6;   // se dibuja ANTES que todo
  mesh.visible = false;
  return { mesh:mesh, tex:null, w:0, h:0, fmt:0 };
}

function actualizarOcclusion(frame, renderer){
  const O = S.ocl; if(!O) return;
  if(!S.oclusion){ O.mesh.visible = false; return; }
  let di = null;
  try{
    const vp = frame.getViewerPose(S.refSpaceLocal);
    if(vp && vp.views.length && typeof frame.getDepthInformation === 'function'){
      di = frame.getDepthInformation(vp.views[0]);
    }
  }catch(e){ di = null; }
  if(!di || !di.data){ O.mesh.visible = false; return; }
  if(!S.oclDisponible){ S.oclDisponible = true; refrescarHUD(); }

  const esFloat = (S.session && S.session.depthDataFormat === 'float32');
  if(!O.tex || O.w !== di.width || O.h !== di.height || O.fmt !== (esFloat?1:0)){
    if(O.tex) O.tex.dispose();
    const datos = esFloat ? new Float32Array(di.data) : new Uint8Array(di.data);
    O.tex = new THREE.DataTexture(datos, di.width, di.height,
      esFloat ? THREE.RedFormat : THREE.RGFormat, esFloat ? THREE.FloatType : THREE.UnsignedByteType);
    O.tex.minFilter = THREE.NearestFilter; O.tex.magFilter = THREE.NearestFilter;
    O.tex.generateMipmaps = false; O.tex.flipY = false;
    O.w = di.width; O.h = di.height; O.fmt = esFloat ? 1 : 0;
    O.mesh.material.uniforms.tDepth.value = O.tex;
    O.mesh.material.uniforms.fmt.value = O.fmt;
  }else{
    O.tex.image.data = esFloat ? new Float32Array(di.data) : new Uint8Array(di.data);
  }
  O.tex.needsUpdate = true;
  const u = O.mesh.material.uniforms;
  u.rawToM.value = di.rawValueToMeters || 1;
  if(di.normDepthBufferFromNormView && di.normDepthBufferFromNormView.matrix){
    u.uvT.value.fromArray(di.normDepthBufferFromNormView.matrix);
  }
  const xrCam = renderer.xr.getCamera();
  const cam = (xrCam.cameras && xrCam.cameras[0]) || xrCam;
  const pe = cam.projectionMatrix.elements;
  u.p22.value = pe[10]; u.p23.value = pe[14];
  O.mesh.visible = true;
}

/* ------------------------------------------------------------
   7e. ESCUADRAR — 2 puntos sobre un borde real ⇒ el eje X del
   modelo queda paralelo a ese borde
   ------------------------------------------------------------ */
function agregarPuntoEscuadra(){
  if(!S.reticula || !S.reticula.visible || !S.grupo) return;
  const p = S.reticula.position.clone();
  S.escPts.push(p);
  const esf = new THREE.Mesh(new THREE.SphereGeometry(.02, 12, 8), new THREE.MeshBasicMaterial({ color:PAL.acento2 }));
  esf.position.copy(p); S.medGrp.add(esf);
  if(S.escPts.length < 2){ $('hudMsg').textContent = 'Primer punto. Ahora el segundo, sobre el mismo borde.'; return; }
  const [A,B] = S.escPts;
  const dx = B.x - A.x, dz = B.z - A.z;
  if(Math.hypot(dx,dz) < 0.15){ $('hudMsg').textContent = 'Los puntos están muy juntos (< 15 cm). Tocá de nuevo el segundo.'; S.escPts.pop(); return; }
  // rotation.y = θ lleva el eje X local a (cosθ, 0, −sinθ)  ⇒  θ = atan2(−dz, dx)
  const theta = Math.atan2(-dz, dx);
  // elegir el múltiplo de 90° respecto de la rotación actual que menos gira (respeta la orientación que ya tenía)
  let mejor = theta, dmin = 1e9;
  for(let k=-2;k<=2;k++){
    const c = theta + k*Math.PI/2;
    let d = Math.abs(((c - S.rotY + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
    if(d < dmin){ dmin = d; mejor = c; }
  }
  S.rotY = mejor; S.grupo.rotation.y = S.rotY;
  sincronizarAncla(); guardarCalib();
  S.escuadrando = false; S.escPts = [];
  $('btnEscuadrar').textContent = 'Escuadrar';
  $('hudMsg').textContent = 'Escuadrado: el modelo quedó paralelo al borde. Girar 90° si hace falta.';
  refrescarHUD();
}

/* ------------------------------------------------------------
   7f0. PUNTO DE PROFUNDIDAD en el centro de la pantalla (ref space)
   Lo que la cámara de profundidad ve justo donde apunta el aro:
   {p: punto en el mundo, dist: distancia a la cámara, cam: pos cámara}
   ------------------------------------------------------------ */
const _pdInvP = new THREE.Matrix4(), _pdM = new THREE.Matrix4();
function puntoDeProfundidadCentro(frame){
  let di = null, view = null;
  try{
    const vp = frame.getViewerPose(S.refSpaceLocal);
    if(!vp || !vp.views.length) return null;
    view = vp.views[0];
    di = frame.getDepthInformation(view);
  }catch(e){ return null; }
  if(!di || typeof di.getDepthInMeters !== 'function') return null;
  // promedio robusto de un parche chico alrededor del centro (la profundidad por movimiento es ruidosa)
  const ds = [];
  for(let j=-2;j<=2;j++) for(let i=-2;i<=2;i++){
    let d = 0;
    try{ d = di.getDepthInMeters(0.5 + i*0.012, 0.5 + j*0.012); }catch(e){ continue; }
    if(d > 0.15 && d < 6) ds.push(d);
  }
  if(ds.length < 5) return null;
  ds.sort((a,b) => a-b);
  const d = ds[Math.floor(ds.length/2)];
  _pdInvP.fromArray(view.projectionMatrix).invert();
  _pdM.fromArray(view.transform.matrix);
  const p = new THREE.Vector3(0, 0, 0.5).applyMatrix4(_pdInvP);     // rayo del centro en coords de vista
  p.multiplyScalar(-d / p.z).applyMatrix4(_pdM);                     // a la profundidad medida → mundo
  const cam = new THREE.Vector3().setFromMatrixPosition(_pdM);
  return { p: p, dist: d, cam: cam };
}

/* ------------------------------------------------------------
   7f. NUBE DE PUNTOS desde la profundidad del frame (ref space)
   ------------------------------------------------------------ */
function nubeDesdeFrame(frame){
  let di = null, view = null;
  try{
    const vp = frame.getViewerPose(S.refSpaceLocal);
    if(!vp || !vp.views.length) return null;
    view = vp.views[0];
    di = frame.getDepthInformation(view);
  }catch(e){ return null; }
  if(!di || typeof di.getDepthInMeters !== 'function') return null;
  const invP = new THREE.Matrix4().fromArray(view.projectionMatrix).invert();
  const M = new THREE.Matrix4().fromArray(view.transform.matrix);
  const centro = S.grupo.position, R = Math.max(S.trazado.medidas.x, S.trazado.medidas.y, S.trazado.medidas.z)/S.escala * 1.3 + 0.4;
  const out = [];
  const NX = 72, NY = 54;   // ~3900 muestras por frame
  for(let j=0;j<NY;j++){
    const v = (j + .5)/NY;                     // coords de vista normalizadas: origen ARRIBA-izq
    for(let i=0;i<NX;i++){
      const u = (i + .5)/NX;
      let d = 0;
      try{ d = di.getDepthInMeters(u, v); }catch(e){ continue; }
      if(!(d > 0.25 && d < 4.5)) continue;      // más de 4,5 m la profundidad por movimiento es invento
      const p = new THREE.Vector3(u*2-1, 1-2*v, 0.5).applyMatrix4(invP);   // punto en vista
      p.multiplyScalar(-d / p.z).applyMatrix4(M);                          // a la profundidad real → mundo
      if(p.distanceTo(centro) > R) continue;                               // solo alrededor del modelo
      out.push(p);
    }
  }
  return out;
}

/* ------------------------------------------------------------
   7g. AUTO-AJUSTE — orquestación
   ------------------------------------------------------------ */
async function correrAutoAjuste(){
  if(!S.grupo || S.autoCorriendo) return;
  S.autoCorriendo = true;
  try{
    if(!S.modeloPts) S.modeloPts = muestrearModelo(S.grupo, 3000);
    let nube = S.autoNube || [];
    // VOXELIZAR a 1,5 cm: los puntos repetidos de una misma cara no suman y ahogan el ICP
    if(nube.length > 1500){
      const vox = new Map(); const out = [];
      for(let i=0;i<nube.length;i++){
        const q = nube[i]; const k = (Math.round(q.x/0.015)*73856093) ^ (Math.round(q.y/0.015)*19349663) ^ (Math.round(q.z/0.015)*83492791);
        if(vox.has(k)) continue; vox.set(k, 1); out.push(q);
      }
      nube = out;
    }
    S._ultimoGiroAuto = S.rotY; S._ultimaPosAuto = S.grupo.position.clone();
    // MOSTRAR lo que capturó el teléfono: la nube en puntos amarillos por 5 s.
    // Si los puntos no pintan la pieza real, el problema es la captura (luz,
    // distancia, moverse) — no el encaje.
    try{
      if(nube.length && S.scene){
        const gN = new THREE.BufferGeometry();
        const aN = new Float32Array(nube.length*3);
        nube.forEach((pt,i) => { aN[i*3]=pt.x; aN[i*3+1]=pt.y; aN[i*3+2]=pt.z; });
        gN.setAttribute('position', new THREE.BufferAttribute(aN,3));
        const ptsN = new THREE.Points(gN, new THREE.PointsMaterial({ color:PAL.aviso, size:.012, sizeAttenuation:true, transparent:true, opacity:.85 }));
        S.scene.add(ptsN);
        setTimeout(() => { try{ S.scene.remove(ptsN); gN.dispose(); }catch(e){} }, 5000);
      }
    }catch(e){}
    $('hudMsg').textContent = 'Encajando… (' + nube.length + ' puntos)';
    // RONDAS DE REFINAMIENTO: se busca el calce y se vuelve a encajar desde el
    // resultado hasta que la coincidencia deja de mejorar (ideal ≥95%).
    let r = null, rotY = S.rotY, pos = S.grupo.position.clone();
    for(let ronda = 0; ronda < 5; ronda++){
      const ri = await icpYaw(nube, S.modeloPts, rotY, pos, S.escala,
        f => { $('hudMsg').textContent = 'Encajando (ronda ' + (ronda+1) + ')… ' + Math.round(f*100) + '%'; });
      if(!ri.ok){ if(!r){ $('hudMsg').textContent = 'Auto-ajuste: ' + ri.motivo; return; } break; }
      if(r && ri.pct <= r.pct + 1){ if(ri.pct > r.pct) r = ri; break; }
      r = ri; rotY = ri.rotY; pos = ri.pos.clone();
      if(r.pct >= 95) break;
    }
    if(r.pct < 40){
      UI.msg('Coincidencia baja (' + r.pct + '%): no lo muevo. Apoyá el 3D más o menos sobre el equipo real y probá de nuevo (barré el equipo despacio al capturar).');
      return;
    }
    S._deshacerAuto = { rotY: S._ultimoGiroAuto, pos: S._ultimaPosAuto, offsetY: S.offsetY };
    if(S._autoSilencioso){
      S._autoSilencioso = false;
      if(S._mejorPct != null && r.pct <= S._mejorPct){ registrar('auto continuo: ' + r.pct + '% no mejora ' + S._mejorPct + '%'); return; }
    }
    S._mejorPct = Math.max(S._mejorPct || 0, r.pct);
    const giro = (r.rotY - S.rotY)*180/Math.PI, desp = r.pos.distanceTo(S.grupo.position);
    S.offsetY += (r.pos.y - S.grupo.position.y);
    S.rotY = r.rotY; S.grupo.rotation.y = S.rotY;
    S.grupo.position.copy(r.pos);
    sincronizarAncla(); guardarCalib();
    S.fijado = true; $('btnFijar').textContent = 'Fijado ✓';
    UI.msg((r.pct >= 95 ? '✓ CLAVADO — coincidencia ' : 'Coincidencia ') + r.pct + '% · ' +
      r.inliers + ' puntos a ' + (r.err*1000).toFixed(0) + ' mm (giró ' + giro.toFixed(1) + '°, movió ' +
      (desp*100).toFixed(1) + ' cm).' + (r.pct < 95 ? ' Auto-ajuste de nuevo desde otro lado para subirla, o "Deshacer ajuste".' : ''));
    registrar('auto-ajuste ' + r.pct + '% giro ' + giro.toFixed(1) + ' desp ' + (desp*100).toFixed(0) + ' cm');
    refrescarHUD();
  }catch(e){
    $('hudMsg').textContent = 'Auto-ajuste falló: ' + (e.message || e);
  }finally{
    S.autoCorriendo = false;
    // ACUMULAR: la nube queda guardada y la próxima captura le suma otro
    // ángulo — caminando alrededor de la pieza el calce mejora corrida a corrida
    if(S.autoNube && S.autoNube.length){
      let acc = S.autoNube;
      if(acc.length > 15000){
        const paso = acc.length/15000, sub = [];
        for(let i=0;i<acc.length;i+=paso) sub.push(acc[Math.floor(i)]);
        acc = sub;
      }
      S.nubeAcum = acc;
    }
    S.autoNube = null;
  }
}

/* ------------------------------------------------------------
   7c. MEDICIÓN — 2 toques sobre el piso = distancia real
   ------------------------------------------------------------ */
function limpiarMedicion(){
  if(S.medGrp){ while(S.medGrp.children.length) S.medGrp.remove(S.medGrp.children[0]); }
  S.medPts = [];
}
function agregarPuntoMedicion(){
  if(!S.reticula || !S.reticula.visible || !S.medGrp) return;
  if(S.medPts.length >= 2) limpiarMedicion();
  const p = S.reticula.position.clone();
  S.medPts.push(p);
  const esf = new THREE.Mesh(new THREE.SphereGeometry(.02, 12, 8), new THREE.MeshBasicMaterial({ color:PAL.aviso }));
  esf.position.copy(p); S.medGrp.add(esf);
  if(S.medPts.length === 2){
    const [a,b] = S.medPts;
    const linea = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),
      new THREE.LineBasicMaterial({ color:PAL.aviso }));
    S.medGrp.add(linea);
    const L = a.distanceTo(b);
    const et = etiqueta(L.toFixed(2) + ' m  (' + Math.round(L*1000) + ' mm)', new THREE.Color(PAL.aviso));
    et.position.copy(a).lerp(b, .5).add(new THREE.Vector3(0, .12, 0));
    et.scale.set(.5, .125, 1);
    S.medGrp.add(et);
    $('hudMsg').textContent = 'Distancia: ' + L.toFixed(2) + ' m. Tocá de nuevo para medir otra.';
  }else{
    $('hudMsg').textContent = 'Primer punto marcado. Apuntá al segundo y tocá.';
  }
}

/* ------------------------------------------------------------
   7f2. PIELES DE COLOR del modelo — horneadas por vértice
   altura (cian→naranja) · metal (chapa galvanizada realista) ·
   caras (cada orientación un tono: se distinguen los planos)
   ------------------------------------------------------------ */
const PIELES = ['altura', 'metal', 'caras', 'piezas'];
function pielesDe(geo){ return (geo && geo.userData.pieles && geo.userData.pieles.real) ? ['real'].concat(PIELES) : PIELES; }
// PIEZAS: qué triángulos están conectados entre sí = una pieza física
// (cada máquina, pared o cercha del STL por separado). Union-find.
function componentesDe(geo){
  if(geo.userData.comp) return geo.userData.comp;
  const pos = geo.getAttribute('position');
  const nV = pos.count;
  if(nV > 1600000) return null;                   // demasiado para el celu
  const parent = new Int32Array(nV);
  for(let i=0;i<nV;i++) parent[i] = i;
  const find = i => { while(parent[i] !== i){ parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const uni = (a,b) => { a = find(a); b = find(b); if(a !== b) parent[b] = a; };
  const idx = geo.index;
  if(idx){
    for(let i=0;i<idx.count;i+=3){ const a=idx.getX(i), b=idx.getX(i+1), d=idx.getX(i+2); uni(a,b); uni(b,d); }
  }else{
    // STL sin índice: primero se sueldan los vértices coincidentes (0,5 mm)
    const map = new Map();
    for(let i=0;i<nV;i++){
      const k = Math.round(pos.getX(i)*2000) + '|' + Math.round(pos.getY(i)*2000) + '|' + Math.round(pos.getZ(i)*2000);
      const j = map.get(k);
      if(j === undefined) map.set(k, i); else uni(i, j);
    }
    for(let i=0;i+2<nV;i+=3){ uni(i, i+1); uni(i+1, i+2); }
  }
  const comp = new Int32Array(nV);
  const orden = new Map();                          // raíz → número de pieza (0,1,2…)
  for(let i=0;i<nV;i++){
    const r = find(i);
    let q = orden.get(r);
    if(q === undefined){ q = orden.size; orden.set(r, q); }
    comp[i] = q;
  }
  geo.userData.comp = comp;
  geo.userData.nPiezas = orden.size;
  return comp;
}
function hornearPiel(geo, modo, alto){
  const pieles = geo.userData.pieles = geo.userData.pieles || {};
  if(pieles[modo]) return pieles[modo];
  const pos = geo.getAttribute('position'), nrm = geo.getAttribute('normal');
  const nV = pos.count, col = new Float32Array(nV*3);
  const L = new THREE.Vector3(.45,.78,.42).normalize();
  const c = new THREE.Color(), nv = new THREE.Vector3();
  const cBajo = new THREE.Color(PAL.bajo), cAlto = new THREE.Color(PAL.alto);
  for(let i=0;i<nV;i++){
    nv.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    const lam = .42 + .58*Math.abs(nv.dot(L));
    if(modo === 'metal'){
      // chapa: gris frío con un brillo direccional más marcado
      const esp = Math.pow(Math.abs(nv.dot(L)), 8) * .35;
      c.setRGB(.72*lam + esp, .75*lam + esp, .78*lam + esp);
    }else if(modo === 'piezas'){
      const comp = geo.userData.comp;
      const raiz = comp ? comp[i] : 0;
      c.setHSL((raiz * 0.6180339887) % 1, .62, .48);
      c.multiplyScalar(.5 + .5*lam);
    }else if(modo === 'caras'){
      // cada orientación un tono: azimut de la normal → matiz
      const az = Math.atan2(nv.z, nv.x);
      c.setHSL((az/(Math.PI*2) + .5) % 1, .55, .38 + .27*Math.abs(nv.y));
      c.multiplyScalar(.55 + .45*lam);
    }else{
      c.copy(cBajo).lerp(cAlto, Math.max(0, Math.min(1, pos.getY(i)/Math.max(alto,.001))));
      c.multiplyScalar(lam);
    }
    col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
  }
  pieles[modo] = new THREE.BufferAttribute(col, 3);
  return pieles[modo];
}
function cambiarPiel(){
  if(!S.trazado || !S.trazado.esModelo) return;
  const LISTA = pielesDe(S.trazado.geo);
  S.piel = LISTA[(LISTA.indexOf(S.piel || 'altura') + 1) % LISTA.length];
  if(S.piel === 'piezas'){
    const comp = componentesDe(S.trazado.geo);
    if(!comp){ S.piel = 'altura'; }                // modelo gigante sin decimar: no da
    else delete S.trazado.geo.userData.pieles.piezas;   // rehornear con los comp listos
  }
  const attr = hornearPiel(S.trazado.geo, S.piel, S.trazado.medidas.y);
  S.trazado.geo.setAttribute('color', attr);
  attr.needsUpdate = true;
  $('btnColor').textContent = 'Color: ' + S.piel;
}

/* ------------------------------------------------------------
   7e. ANCLAR POR ESQUINA — replanteo de 2 toques
   Toque 1: parado en la esquina real, la retícula sobre el rincón
   → la ESQUINA REF. del modelo se clava ahí.
   Toque 2: la retícula sobre el piso siguiendo la pared de
   referencia → el modelo gira alrededor de la esquina hasta que
   su pared acompaña la real. Galpones enteros, ubicados en serio.
   ------------------------------------------------------------ */
function puntoEsquina(){
  if(S.esquinando === 3 || S.esquinando === 4) return;   // en el plano se elige tocando el plano
  if(S._gesMovio){ S._gesMovio = false; return; }
  if(!S.reticula || !S.reticula.visible || !S.grupo || !S.trazado || !S.trazado.refEsquina){
    $('hudMsg').textContent = 'Apuntá la retícula al piso o a la pared (tiene que verse el aro) y tocá.';
    return;
  }
  const p = S.reticula.position.clone();
  const contraPared = !!S.hitEsPared;
  if(contraPared) p.y = 0;
  const ref = S.trazado.refEsquina;

  if(S.esquinando === 1){
    // ── PUNTO 1 EN LA REALIDAD: el punto elegido del plano se clava acá ──
    S.esqP1 = p.clone();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), S.rotY);
    const kEsc = S.grupo.scale.x || 1;
    S.grupo.position.copy(p).sub(ref.clone().multiplyScalar(kEsc).applyQuaternion(q));
    S.grupo.position.y += S.offsetY;
    S.grupo.rotation.y = S.rotY;
    S.grupo.visible = true; S.anclado = true;
    // ancla fisica de ARCore en el punto 1: cuando el tracking se corrige o
    // re-localiza (te fuiste a otra oficina), el modelo vuelve solo a su lugar
    olvidarAncla(S.session);
    if(S.ultimoHit && typeof S.ultimoHit.createAnchor === 'function'){
      S.ultimoHit.createAnchor().then(a => instalarAncla(a, S.session)).catch(() => { S._pedirAncla = true; });
    }else{
      S._pedirAncla = true;
    }
    // → a elegir el SEGUNDO punto sobre el plano
    S.esquinando = 4;
    S.planoModo = 'grande';
    const bE = $('btnEsquina');
    if(bE){ bE.textContent = '✔ Usar 2º punto'; bE.classList.add('destacado'); }
    UI.msg(S.modoPapel
      ? 'Cruz 1 marcada ✓. La cruz 2 (naranja) ya está sugerida en la esquina opuesta: si es la de tu plano, "✔ Usar 2º punto"; si no, tocá otra esquina.'
      : ((contraPared ? 'Punto 1 marcado contra la PARED ✓. ' : 'Punto 1 marcado ✓. ') +
      'Ahora elegí el PUNTO 2 EN EL PLANO (una esquina bien alejada del primero): zoom y tocala. Después lo marcás en el lugar real.'));
    UI.paso('3', 'Paso 3 de 4 · elegí el punto 2 en el plano');
    refrescarHUD();
    return;
  }

  if(S.esquinando === 5){
    // ── PUNTO 2 EN LA REALIDAD: con los 2 pares queda orientado EXACTO ──
    if(!S.refP2){ S.esquinando = 4; return; }
    const uR = { x: p.x - S.esqP1.x, z: p.z - S.esqP1.z };
    const dReal = Math.hypot(uR.x, uR.z);
    const dMin = S.modoPapel ? 0.08 : 1.5;
    if(dReal < dMin){
      UI.msg('Muy cerca del punto 1 (' + (dReal*100).toFixed(0) + ' cm): cuanto más lejos, más precisa la orientación. Marcá el punto 2 en su lugar.');
      return;
    }
    const uL = { x: S.refP2.x - ref.x, z: S.refP2.z - ref.z };
    const dPlano = Math.hypot(uL.x, uL.z);
    // rotación exacta: el vector del plano gira hasta calzar con el medido.
    // LA ESCALA NO SE TOCA NUNCA: siempre 1:1.
    S.rotY = Math.atan2(-uR.z, uR.x) - Math.atan2(-uL.z, uL.x);
    const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), S.rotY);
    S.grupo.rotation.y = S.rotY;
    if(S.modoPapel && dPlano > 0.01){
      // SOBRE PLANO IMPRESO: la ESCALA la dan las dos cruces (dPlano real ↔ dReal en el papel)
      S.escala = Math.min(1000, Math.max(0.05, dPlano / dReal));
      S.escalaEf = Math.round(S.escala * 10) / 10;
      S.grupo.scale.setScalar(1 / S.escala);
      if(S.grupo.userData.grpSombra) S.grupo.userData.grpSombra.visible = true;
      registrar('plano impreso: escala deducida 1:' + S.escalaEf);
    }
    const kEsc2 = S.grupo.scale.x || 1;
    S.grupo.position.copy(S.esqP1).sub(ref.clone().multiplyScalar(kEsc2).applyQuaternion(q2));
    S.grupo.position.y += S.offsetY;
    const dif = dReal - dPlano;
    S.esquinando = 0; S.esqP1 = null; S.refP2 = null;
    S.planoModo = 'off';
    $('miniPlanta').classList.add('oculto');
    const bE2 = $('btnEsquina');
    if(bE2){ bE2.classList.remove('destacado'); bE2.textContent = 'Anclar esquina'; }
    const bM2 = $('btnMini'); if(bM2) bM2.textContent = 'Planta: OFF';
    if(!S.anchor) S._pedirAncla = true;
    // SEGUNDA ANCLA física en P2: el rumbo entre las dos anclas sostiene la
    // orientación aunque el tracking derive al caminar por el galpón
    try{ if(S.anchor2 && S.anchor2.delete) S.anchor2.delete(); }catch(e){}
    S.anchor2 = null; S.anc2Listo = false;
    if(S.ultimoHit && typeof S.ultimoHit.createAnchor === 'function'){
      S.ultimoHit.createAnchor().then(a => { S.anchor2 = a; S.anc2Listo = false; }).catch(() => {});
    }
    S.fijado = true; $('btnFijar').textContent = 'Fijado ✓';
    sincronizarAncla(); guardarCalib();
    let ctrl = S.modoPapel
      ? ('Escala del papel: 1:' + S.escalaEf + ' (' + dPlano.toFixed(2) + ' m reales = ' + (dReal*100).toFixed(1) + ' cm en el plano).')
      : ('Control de escala: plano ' + dPlano.toFixed(2) + ' m · medido ' + dReal.toFixed(2) + ' m (dif ' + Math.round(Math.abs(dif)*100) + ' cm).');
    if(!S.modoPapel && Math.abs(dif) > dPlano * .05 + .3) ctrl += ' ⚠ Diferencia grande: revisá que los puntos marcados sean los del plano.';
    UI.msg((S.modoPapel ? '✓ 3D parado sobre el plano impreso y FIJADO. ' : '✓ Modelo ubicado con 2 puntos y FIJADO. ') + ctrl);
    UI.paso('', '');
    refrescarHUD();
    return;
  }
}

/* ------------------------------------------------------------
   7f3. MINIMAPA — vista en planta para orientarse en el galpón
   El modelo visto desde arriba (silueta de puntos), la bandera de
   la esquina de referencia y VOS como flecha amarilla, en vivo.
   ------------------------------------------------------------ */
function dibujarMiniPlanta(){
  const cv = $('miniPlanta');
  if(!cv || !S.trazado || !(S.trazado.esModelo || S.trazado.esMS)){ if(cv) cv.classList.add('oculto'); return; }
  const modo = S.planoModo || 'off';
  if(modo === 'off'){ cv.classList.add('oculto'); return; }
  let colocado = S.grupo && S.grupo.visible;
  if(S.esquinando === 3 || S.esquinando === 4) colocado = false;   // en el plano se elige: vista de plano pura
  if(!colocado && !S.esquinando){ cv.classList.add('oculto'); return; }
  cv.classList.remove('oculto');
  const grande = modo === 'grande';
  cv.classList.toggle('grande', grande);
  const objW = grande ? window.innerWidth : 300, objH = grande ? window.innerHeight : 300;
  if(cv.width !== objW || cv.height !== objH){ cv.width = objW; cv.height = objH; }
  const kUi = grande ? 2.1 : 1;
  const zoom = grande ? (S.planZoom || 1) : 1;
  const panX = grande ? (S.planPan ? S.planPan.x : 0) : 0;
  const panY = grande ? (S.planPan ? S.planPan.y : 0) : 0;
  const g2 = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  g2.setTransform(1,0,0,1,0,0);
  g2.clearRect(0,0,W,H);
  const M = S.trazado.planMeta;

  if(!colocado){
    // ── VISTA PREVIA (todavía sin anclar): el plano solo, norte arriba,
    //    con la esquina de referencia en rojo — para estudiarlo y ubicarse ──
    if(!S.trazado.planImg || !M) return;
    const kFit = Math.min(W, H) / (2 * M.H) * .92 * zoom;
    const dib = 2 * M.H * kFit;
    const ox = W/2 - dib/2 + panX, oy = H/2 - dib/2 + panY;
    S._planPrev = { ox: ox, oy: oy, kFit: kFit, M: M };   // para elegir esquina tocando el plano
    g2.globalAlpha = .96;
    g2.drawImage(S.trazado.planImg, ox, oy, dib, dib);
    g2.globalAlpha = 1;
    if(S.trazado.refEsquina){
      const px = ox + (S.trazado.refEsquina.x - (M.cx - M.H)) * kFit;
      const pz = oy + (S.trazado.refEsquina.z - (M.cz - M.H)) * kFit;
      g2.fillStyle = cssPal('acento');
      g2.beginPath(); g2.arc(px, pz, 6*kUi, 0, Math.PI*2); g2.fill();
      g2.strokeStyle = cssPal('aviso'); g2.lineWidth = 2.5*kUi;
      g2.beginPath(); g2.moveTo(px, pz);
      g2.lineTo(px + Math.min(M.H, 14) * kFit, pz); g2.stroke();
      g2.fillStyle = '#fff'; g2.font = 'bold ' + Math.round(7*kUi+8) + 'px sans-serif';
      g2.fillText('⚑ punto 1', px + 8*kUi, pz - 8*kUi);
    }
    if(S.refP2){
      const px2 = ox + (S.refP2.x - (M.cx - M.H)) * kFit;
      const pz2 = oy + (S.refP2.z - (M.cz - M.H)) * kFit;
      g2.strokeStyle = cssPal('alto'); g2.lineWidth = 3*kUi;
      g2.beginPath(); g2.arc(px2, pz2, 7*kUi, 0, Math.PI*2); g2.stroke();
      g2.fillStyle = '#fff'; g2.font = 'bold ' + Math.round(7*kUi+8) + 'px sans-serif';
      g2.fillText('◎ punto 2', px2 + 9*kUi, pz2 - 9*kUi);
    }
    return;
  }

  // ── ANCLADO: el plano girado y escalado como quedó en el mundo, con vos ──
  const cam = (S.renderer && S.renderer.xr && S.renderer.xr.isPresenting) ? S.renderer.xr.getCamera() : S.camera;
  if(!cam || !M || !S.trazado.planImg) return;
  const cp = new THREE.Vector3(); cam.getWorldPosition(cp);
  const fw = new THREE.Vector3(); cam.getWorldDirection(fw);
  const esc = 1/S.escala, cy = Math.cos(S.rotY), sy = Math.sin(S.rotY);
  const gp = S.grupo.position;
  const aMundo = (x, z) => [ (x*cy + z*sy)*esc + gp.x, (-x*sy + z*cy)*esc + gp.z ];
  const bb = (S.trazado.geo && S.trazado.geo.boundingBox) || S.trazado.bbox;
  let mnx=1e9, mnz=1e9, mxx=-1e9, mxz=-1e9;
  [[bb.min.x,bb.min.z],[bb.max.x,bb.min.z],[bb.min.x,bb.max.z],[bb.max.x,bb.max.z]].forEach(e => {
    const [wx,wz] = aMundo(e[0], e[1]);
    if(wx<mnx)mnx=wx; if(wx>mxx)mxx=wx;
    if(wz<mnz)mnz=wz; if(wz>mxz)mxz=wz;
  });
  if(cp.x<mnx)mnx=cp.x; if(cp.x>mxx)mxx=cp.x;
  if(cp.z<mnz)mnz=cp.z; if(cp.z>mxz)mxz=cp.z;
  const cxW = (mnx+mxx)/2, czW = (mnz+mxz)/2;
  const k = Math.min((W-24)/Math.max(.5, mxx-mnx), (H-24)/Math.max(.5, mxz-mnz)) * zoom;
  const aPx = (wx, wz) => [ W/2 + (wx-cxW)*k + panX, H/2 + (wz-czW)*k + panY ];

  // la foto de plano con la afín exacta local→mundo→pantalla
  const du = (2*M.H)/M.w;
  const m11 = k*esc*cy*du,  m12 = k*esc*(-sy)*du;
  const m21 = k*esc*sy*du,  m22 = k*esc*cy*du;
  const [ox2, oz2] = aMundo(M.cx - M.H, M.cz - M.H);
  const [dx2, dy2] = aPx(ox2, oz2);
  g2.save();
  g2.globalAlpha = grande ? .96 : .9;
  g2.setTransform(m11, m12, m21, m22, dx2, dy2);
  g2.drawImage(S.trazado.planImg, 0, 0);
  g2.restore();
  g2.setTransform(1,0,0,1,0,0);
  g2.globalAlpha = 1;

  if(S.trazado.refEsquina){
    const [ex,ez] = aMundo(S.trazado.refEsquina.x, S.trazado.refEsquina.z);
    const [px1,pz1] = aPx(ex,ez);
    g2.fillStyle = cssPal('acento');
    g2.beginPath(); g2.arc(px1, pz1, 5*kUi, 0, Math.PI*2); g2.fill();
  }
  // vos: flecha amarilla con tu rumbo
  const [cxp,czp] = aPx(cp.x, cp.z);
  const ang = Math.atan2(fw.z, fw.x);
  g2.save();
  g2.translate(cxp, czp); g2.rotate(ang);
  g2.fillStyle = cssPal('aviso');
  g2.strokeStyle = 'rgba(9,9,11,.8)'; g2.lineWidth = 1.5*kUi;
  g2.beginPath(); g2.moveTo(9*kUi,0); g2.lineTo(-6*kUi,-5.5*kUi); g2.lineTo(-3*kUi,0); g2.lineTo(-6*kUi,5.5*kUi); g2.closePath();
  g2.fill(); g2.stroke();
  g2.restore();
}

function refrescarHUD(){
  const _e = (S.escalaEf || S.escala);
  const esc = S.escala === 1 ? '1:1' : (_e < 1 ? (Math.round(1/_e*10)/10) + ':1' : ('1:' + _e));
  let lejos = '';
  if(S._distModelo != null && S.anclado){
    if(S._distModelo > 30) lejos = '\n⚠ EL MODELO ESTÁ A ' + Math.round(S._distModelo) + ' m — usá "Traer acá"';
  }
  $('hudDatos').textContent =
    'ESC ' + esc +
    '   ROT ' + Math.round(S.rotY*180/Math.PI) + '°' +
    '   ALT ' + (S.offsetY>=0?'+':'') + S.offsetY.toFixed(2) + ' m' +
    (S.anchor ? '   ⚓' : '') +
    (S.fijado ? '   🔒' : '') +
    (S.piv ? '   📍' : '') +
    (S.oclDisponible && S.oclusion ? '   OCL' : '') + lejos;
}

/* UN solo renderer WebGL para toda la vida de la app: crear y destruir
   contextos alrededor de sesiones ARCore congelaba Chrome al Salir
   (mismo patrón ya probado en el escáner de ms-ar). */
let _rendererUnico = null;
function obtenerRenderer(){
  if(!_rendererUnico){
    const cv = document.createElement('canvas');
    _rendererUnico = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, powerPreference: 'high-performance' });
    _rendererUnico.xr.enabled = true;
  }
  _rendererUnico.setPixelRatio(Math.min(window.devicePixelRatio, 2.25));
  _rendererUnico.setSize(window.innerWidth, window.innerHeight);
  return _rendererUnico;
}

function cerrarAR(desdeEvento){
  if(S._cerrando) return;            // guard de reentrada: 'end' + botón Salir
  registrar('cierre AR ' + (desdeEvento ? '(evento end / atras)' : '(boton Salir)'));
  S._cerrando = true;
  setTimeout(() => { S._cerrando = false; }, 1500);
  const r = S.renderer;
  const hs = S.hitSource;
  if(hs){ try{ hs.cancel(); }catch(e){} }
  S.renderer = null; S.session = null; S.hitSource = null;
  S.grupo = null; S.anclado = false;
  S.anchor = null; S.ancListo = false; S.ultimoHit = null; S.lightProbe = null;
  S.anchor2 = null; S.anc2Listo = false;
  S.midiendo = false; S.medGrp = null; S.medPts = [];
  S.esquinando = 0; S.esqP1 = null; S.refP2 = null; S.fijado = false; S._distModelo = null; S.marcadorBuscando = false; S.imgTrack = false; S.imgCfg = null; S._facMedido = 0; S._mkLock = null; S._mkBuf = []; S._mkDesde = 0; S._mkMovTick = 0; S.papelSinAncla = false; S._alturaCero = false; S._escFija = 0; S._anchoMedido = 0; S.piv = null; S.pivMode = 0; S._pivMesh = null;
  S.escuadrando = false; S.escPts = []; S.autoPend = 0; S.autoNube = null; S.modeloPts = null; S.autoCorriendo = false; S.nubeAcum = null;
  UI.paso('', '');
  const _oclTex = S.ocl && S.ocl.tex;
  if(_oclTex) setTimeout(() => { try{ _oclTex.dispose(); }catch(e){} }, 1200);
  S.ocl = null; S.oclDisponible = false;
  $('capaAR').classList.add('oculto');
  $('capaUI').classList.remove('oculto');
  if(r){
    try{ r.setAnimationLoop(null); }catch(e){}
    // el canvas se ESCONDE ya, pero se saca del DOM recién cuando ARCore terminó
    // de desarmar la sesión: sacarlo en el mismo instante del 'end' (botón atrás
    // de Android) dejaba a Chrome colgado hasta el "no responde".
    if(desdeEvento){
      // la sesión la terminó Android (atrás / otra app): no tocar el canvas en ese instante
      try{ r.domElement.style.visibility = 'hidden'; }catch(e){}
      setTimeout(() => { try{ r.domElement.remove(); r.domElement.style.visibility = ''; }catch(e){} }, 900);
    }else{
      // botón Salir: sacar el canvas YA y pedir session.end() aparte — es el patrón
      // que venía funcionando; esconderlo primero y sacarlo después bloqueaba la app
      try{ r.domElement.remove(); }catch(e){}
    }
    // el renderer NO se destruye: se reusa en la próxima sesión (destruirlo
    // durante el desarme de ARCore congelaba la app al Salir)
  }
}

// Salir de la sesión AR por el camino seguro: devolver la pantalla YA y pedir
// el cierre de la sesión aparte (llamar end() desde adentro de un evento de la
// capa AR deadlockeaba Chrome con cuadros XR en vuelo).
function salirAR(){
  if(SENS.activo){ cerrarARSensor(); return; }
  const s = S.session;
  if(!s){ if(S.renderer) cerrarAR(false); return; }
  cerrarAR(false);
  setTimeout(() => {
    try{
      const p = s.end();
      if(p && p.catch) p.catch(() => {});
    }catch(e){}
  }, 50);
}

// El botón ATRÁS: cierra lo que esté abierto (AR, sensores o visor 3D) en vez
// de dejar que el navegador lo mate a su manera.
window.addEventListener('popstate', () => {
  if(S.session || SENS.activo){ S._histAR = false; salirAR(); return; }
  if(!$('visor3D').classList.contains('oculto')){ S._hist3D = false; const b = $('btnSalir3D'); if(b.onclick) b.onclick(); return; }
  S._histAR = false; S._hist3D = false;
});

/* ------------------------------------------------------------
   7pre. GESTOS DE CALIBRACIÓN EN AR
   Ya anclado: 1 dedo arrastra el trazado por el piso (relativo a
   donde mira la cámara), 2 dedos lo giran (twist) y el arrastre
   vertical con 2 dedos ajusta la altura fino. Antes de anclar la
   capa deja pasar el tap para que el 'select' de WebXR ancle.
   ------------------------------------------------------------ */
const GES = { punteros:new Map(), angPrev:null, cyPrev:null };

$('gestos').addEventListener('beforexrselect', ev => {
  // con overlay, los toques se manejan por eventos de puntero (tapPantalla):
  // un 'select' además de eso los procesaría dos veces
  if(S.overlayOK) ev.preventDefault();
});


function gesAnguloYCentro(){
  const ps = [...GES.punteros.values()];
  return {
    ang: Math.atan2(ps[1].y - ps[0].y, ps[1].x - ps[0].x),
    cy:  (ps[0].y + ps[1].y) / 2
  };
}

$('gestos').addEventListener('pointerdown', ev => {
  // el pulgar que SOSTIENE el celu apoya en el borde: no es un gesto (arrastraba
  // el modelo junto con el teléfono y parecía que "se movía solo")
  const mB = 36;
  if(ev.clientX < mB || ev.clientX > window.innerWidth - mB || ev.clientY < mB || ev.clientY > window.innerHeight - mB) return;
  GES.punteros.set(ev.pointerId, { x:ev.clientX, y:ev.clientY, x0:ev.clientX, y0:ev.clientY, t0:performance.now() });
  if(GES.punteros.size === 1){ S._gesMovio = false; GES.maxP = 1; }
  else GES.maxP = Math.max(GES.maxP || 1, GES.punteros.size);
  if(GES.punteros.size === 2){
    const g = gesAnguloYCentro();
    GES.angPrev = g.ang; GES.cyPrev = g.cy;
    const ps = [...GES.punteros.values()];
    GES.sepPrev = Math.hypot(ps[1].x-ps[0].x, ps[1].y-ps[0].y);
  }
});

function gesFin(ev){
  const p = GES.punteros.get(ev.pointerId);
  GES.punteros.delete(ev.pointerId);
  if(GES.punteros.size < 2){ GES.angPrev = null; GES.cyPrev = null; }
  if(S.anclado) guardarCalib();
  // TAP = un solo dedo, sin arrastre, corto → apoyar / medir / punto del replanteo
  if(ev.type === 'pointerup' && p && GES.punteros.size === 0 && (GES.maxP || 1) === 1 && S.overlayOK &&
     !S._gesMovio && (performance.now() - (p.t0 || 0)) < 600 &&
     !(S.esquinando === 3 || S.esquinando === 4)){
    tapPantalla(null);
  }
}
$('gestos').addEventListener('pointerup', ev => {
  // PASO 0 del anclaje: un TAP sobre el plano elige el punto de referencia
  if((S.esquinando === 3 || S.esquinando === 4) && !S._gesMovio && S._planPrev && S.trazado && S.trazado.refCandidatos){
    const pp = S._planPrev, M = pp.M;
    const lx = (ev.clientX - pp.ox) / pp.kFit + (M.cx - M.H);
    const lz = (ev.clientY - pp.oy) / pp.kFit + (M.cz - M.H);
    const rIman = 26 / pp.kFit;                     // imán: 26 px en unidades del modelo
    const cds = S.trazado.refCandidatos;
    let mejor = -1, md = rIman * rIman;
    for(let i = 0; i < cds.length; i += 2){
      const dx = cds[i] - lx, dz = cds[i+1] - lz;
      const dd = dx*dx + dz*dz;
      if(dd < md){ md = dd; mejor = i; }
    }
    if(mejor >= 0){
      if(S.esquinando === 3){
        S.trazado.refEsquina.x = cds[mejor];
        S.trazado.refEsquina.z = cds[mejor+1];
        if(S.grupo && S.grupo.userData.grpRef) S.grupo.userData.grpRef.position.copy(S.trazado.refEsquina);
        UI.msg('Punto 1 elegido ✔. Confirmalo con el botón "✔ Usar este punto".');
      }else{
        S.refP2 = { x: cds[mejor], z: cds[mejor+1] };
        UI.msg('Punto 2 elegido ✔. Confirmalo con "✔ Usar 2º punto" y andá a marcarlo en el lugar real.');
      }
    }else{
      $('hudMsg').textContent = 'Ahí no hay ninguna esquina del modelo: hacé más zoom y tocá justo sobre una esquina del plano.';
    }
  }
});
$('gestos').addEventListener('pointerup', gesFin);
$('gestos').addEventListener('pointercancel', gesFin);

$('gestos').addEventListener('pointermove', ev => {
  // durante el modo esquina con el plano grande: 1 dedo PANEA el plano,
  // 2 dedos hacen ZOOM — y ese arrastre no marca ningún punto
  if(S.esquinando && S.planoModo === 'grande' && GES.punteros.has(ev.pointerId)){
    const p0 = GES.punteros.get(ev.pointerId);
    const dx0 = ev.clientX - p0.x, dy0 = ev.clientY - p0.y;
    p0.x = ev.clientX; p0.y = ev.clientY;
    // solo cuenta como arrastre si se ALEJÓ del punto de apoyo (un tap
    // normal tiembla unos píxeles y tiene que seguir marcando)
    if(p0.x0 != null && Math.hypot(ev.clientX - p0.x0, ev.clientY - p0.y0) > 14) S._gesMovio = true;
    S.planPan = S.planPan || { x:0, y:0 };
    if(GES.punteros.size === 1){
      S.planPan.x += dx0; S.planPan.y += dy0;
    }else if(GES.punteros.size === 2 && GES.sepPrev){
      const ps = [...GES.punteros.values()];
      const sep = Math.hypot(ps[1].x-ps[0].x, ps[1].y-ps[0].y);
      S.planZoom = Math.min(8, Math.max(.5, (S.planZoom || 1) * (sep / GES.sepPrev)));
      GES.sepPrev = sep;
    }
    return;
  }
  if(!GES.punteros.has(ev.pointerId)) return;
  const p = GES.punteros.get(ev.pointerId);
  if(p.x0 != null && Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) > 14) S._gesMovio = true;
  if(!S.anclado || S.midiendo || S.escuadrando || S.esquinando || S.autoCorriendo || S.pivMode || !S.grupo) return;
  // FIJADO = FIJADO. Antes los gestos no miraban esto: con el modelo fijado, el
  // pulgar que sostiene el celu lo arrastraba, dos dedos lo giraban y el arrastre
  // vertical lo levantaba del piso (o de la hoja). Eso era "se mueve solo".
  if(S.fijado){
    if(!S._avisoFijado || performance.now() - S._avisoFijado > 4000){
      S._avisoFijado = performance.now();
      UI.msg('Está FIJADO: los dedos no lo mueven. Para reacomodarlo, "Apoyar de nuevo" o soltá con "Fijado ✓".');
    }
    return;
  }
  const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
  p.x = ev.clientX; p.y = ev.clientY;
  if(!S._gesMovio) return;   // temblor del dedo: todavía es un tap


  if(GES.punteros.size === 1){
    // mover en el plano del piso, relativo a hacia dónde mira el celu
    const cam = S.renderer && S.renderer.xr.isPresenting
      ? S.renderer.xr.getCamera() : S.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd); fwd.y = 0;
    if(fwd.lengthSq() < 1e-6) fwd.set(0,0,-1);
    fwd.normalize();
    const der = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0,1,0)).negate();
    const cp = new THREE.Vector3(); cam.getWorldPosition(cp);
    const k = Math.max(1.5, cp.distanceTo(S.grupo.position)) * 0.0012 * (S.fino ? .25 : 1);
    S.grupo.position.addScaledVector(der, dx * k);
    S.grupo.position.addScaledVector(fwd, -dy * k);
  }else if(GES.punteros.size === 2 && GES.angPrev !== null){
    const g = gesAnguloYCentro();
    let da = g.ang - GES.angPrev;
    if(da >  Math.PI) da -= Math.PI*2;
    if(da < -Math.PI) da += Math.PI*2;
    girarRed(S.rotY - da);             // twist de 2 dedos = girar (alrededor del punto del 3D si hay uno)
    const dcy = g.cy - GES.cyPrev;     // arrastre vertical de 2 dedos = altura
    const dh = -dcy * 0.004 * (S.fino ? .25 : 1);
    S.offsetY += dh;
    S.grupo.position.y += dh;
    GES.angPrev = g.ang; GES.cyPrev = g.cy;
  }
  sincronizarAncla();
  refrescarHUD();
});

/* --- pestañas del panel AR --- */
document.querySelectorAll('.ptab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.ptab').forEach(x => x.classList.toggle('activa', x === t));
  document.querySelectorAll('.ptab-cont').forEach(c => c.classList.toggle('oculto', c.dataset.tab !== t.dataset.tab));
}));

/* --- controles del panel AR --- */
// los toques sobre los botones NO deben generar 'select' de WebXR
// (si no, apretar un botón re-coloca el trazado)
$('panelAR').addEventListener('beforexrselect', ev => ev.preventDefault());

$('panelAR').addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]');
  if(!b || !S.grupo) return;
  const a = b.dataset.act;
  const pasoR = S.fino ? Math.PI/180 : Math.PI/12;   // 1° / 15°
  const pasoA = S.fino ? .02 : .2;                    // 2 cm / 20 cm
  if(a==='rot+'){ girarRed(S.rotY + pasoR); }
  if(a==='rot-'){ girarRed(S.rotY - pasoR); }
  if(a==='alt+'){ S.offsetY += pasoA; S.grupo.position.y += pasoA; }
  if(a==='alt-'){ S.offsetY -= pasoA; S.grupo.position.y -= pasoA; }
  if(a==='fino'){
    S.fino = !S.fino;
    b.textContent = 'Ajuste fino: ' + (S.fino ? 'ON' : 'OFF');
    document.querySelector('[data-act="rot-"]').textContent = S.fino ? '⟲ 1°' : '⟲ 15°';
    document.querySelector('[data-act="rot+"]').textContent = S.fino ? '1° ⟳' : '15° ⟳';
  }
  if(a==='etiq'){ S.verEtiquetas = !S.verEtiquetas; }
  if(a==='maq'){  S.verMaquinas  = !S.verMaquinas; }
  if(a==='piso'){ S.verPiso = !S.verPiso; }
  if(a==='opac'){
    if(S.trazado && S.trazado.esModelo){
      const niveles = [1, .7, .45, .25];
      S.opNivel = ((S.opNivel == null ? 0 : S.opNivel) + 1) % niveles.length;
      const op = niveles[S.opNivel];
      S.grupo.traverse(o => {
        if(o.userData.esModelo3D){
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m, i) => {
            const esVid = i > 0;   // el 2º material es el vidrio: siempre translúcido
            m.opacity = esVid ? Math.min(.35, op) : op;
            m.transparent = esVid || op < .99;
            m.depthWrite = !esVid && op >= .99;
            m.needsUpdate = true;
          });
        }
      });
      $('hudMsg').textContent = 'Transparencia: ' + Math.round(op*100) + '%';
    }else{
      const niveles = [1, .7, .45, .25];
      S.opNivel = ((S.opNivel == null ? 0 : S.opNivel) + 1) % niveles.length;
      const op = niveles[S.opNivel];
      S.opacidad = op;
      const mats = S.grupo.userData.matsRed;
      if(mats && mats.length){
        mats.forEach(m => { m.opacity = op; m.transparent = op < .99; m.depthWrite = op >= .99; m.needsUpdate = true; });
      }else{
        S.grupo.traverse(o => { if(o.userData.esTubo){ o.material.opacity = op; o.material.transparent = op < .99; o.material.depthWrite = op >= .99; o.material.needsUpdate = true; } });
      }
      UI.msg('Transparencia: ' + Math.round(op*100) + '%');
    }
  }
  if(a==='reancla'){
    if(SENS.activo){
      colocarAlFrente();
    }else{
      // "queda guardada otra configuración": acá se BORRA todo lo de antes —
      // ancla, altura, calibración guardada de esta obra — y se apoya de cero
      olvidarAncla(S.session);
      borrarCalib();
      S.anclado = false; S.fijado = false; S.grupo.visible = false; S.offsetY = 0;
      S.grupo.position.y = 0;
      S._distModelo = null;
      S._mkLock = null; S._mkBuf = []; S._mkDesde = 0; S.papelSinAncla = false; S._alturaCero = false; S._escFija = 0;
      if(S.piv || S.pivMode) cancelarPivote(true);
      $('btnFijar').textContent = 'Fijar';
      if(S.midiendo){ S.midiendo = false; limpiarMedicion(); $('btnMedir').textContent = 'Medir: OFF'; }
      UI.msg('Listo para apoyar de nuevo: apuntá al piso hasta ver el aro y tocá.');
    }
  }
  if(a==='fijar'){ fijarModelo(!S.fijado); }
  if(a==='traer'){ traerAca(); }
  if(a==='rot90'){ girarRed(S.rotY + Math.PI/2); sincronizarAncla(); }
  if(a==='pivote'){ if(S.pivMode) cancelarPivote(); else mostrarListaPivote(); }
  if(a==='escuadrar'){
    S.escuadrando = !S.escuadrando; S.escPts = [];
    b.textContent = S.escuadrando ? 'Escuadrar: tocá 2 pts' : 'Escuadrar';
    $('hudMsg').textContent = S.escuadrando
      ? 'Apuntá la retícula a un punto del borde real (pared, base de máquina) y tocá. Después el segundo.'
      : 'Escuadra cancelada.';
  }
  if(a==='auto'){
    if(!S.oclDisponible){ $('hudMsg').textContent = 'Este equipo no entrega profundidad: el auto-ajuste no está disponible.'; }
    else if(!S.anclado){ $('hudMsg').textContent = 'Primero anclá el modelo más o menos sobre la pieza real.'; }
    else if(!S.autoCorriendo){
      S.autoNube = (S.nubeAcum || []).slice(); S.autoPend = 75;
      UI.msg('Auto-ajuste: movete DESPACIO alrededor del equipo (2-3 pasos, subiendo y bajando el celu) mientras capturo…');
    }
  }
  if(a==='color'){ cambiarPiel(); }
  if(a==='autocont'){
    S.autoContinuo = !S.autoContinuo;
    b.textContent = 'Auto continuo: ' + (S.autoContinuo ? 'ON' : 'OFF');
    UI.msg(S.autoContinuo ? 'Auto-ajuste continuo: cada 10 s vuelvo a capturar y encajar mientras caminás alrededor. Solo acepto mejoras.' : 'Auto-ajuste continuo apagado.');
    if(S.autoContinuo) S._autoContTick = 550;
  }
  if(a==='deshacerauto'){
    const u = S._deshacerAuto;
    if(u){ S.rotY = u.rotY; S.grupo.rotation.y = S.rotY; S.grupo.position.copy(u.pos); S.offsetY = u.offsetY; sincronizarAncla(); guardarCalib(); S._deshacerAuto = null; UI.msg('Ajuste deshecho: el 3D volvió a donde lo apoyaste.'); }
    else UI.msg('No hay ajuste para deshacer.');
  }
  if(a==='bandera'){
    S.verBandera = S.verBandera === false ? true : false;
    if(S.grupo && S.grupo.userData.grpRef) S.grupo.userData.grpRef.visible = S.verBandera;
    $('btnBandera').textContent = 'Bandera: ' + (S.verBandera ? 'ON' : 'OFF');
  }
  if(a==='pasoMm'){
    const pasos = [1, 5, 10, 50, 100];
    S.pasoMm = pasos[(pasos.indexOf(S.pasoMm || 10) + 1) % pasos.length];
    $('btnPasoMm').textContent = 'Paso: ' + S.pasoMm + ' mm';
  }
  if(a==='mov'){
    // mueve SEGÚN LOS EJES DEL PLANO CAD (X+ = derecha del plano, Y+ = arriba
    // del plano, Alto = vertical), el paso configurado, para cualquier lado
    const d = (S.pasoMm || 10) / 1000;
    const sig = parseInt(b.dataset.sig, 10) || 1;
    const eje = b.dataset.eje;
    if(eje === 'h'){
      S.grupo.position.y += d * sig;
      S.offsetY += d * sig;
    }else{
      // eje del plano → local: X+ = local +X · Y+ (norte del plano) = local −Z
      const lx = (eje === 'x') ? sig : 0;
      const lz = (eje === 'y') ? -sig : 0;
      const cy = Math.cos(S.rotY), sy = Math.sin(S.rotY);
      S.grupo.position.x += (lx*cy + lz*sy) * d;
      S.grupo.position.z += (-lx*sy + lz*cy) * d;
    }
    sincronizarAncla(); guardarCalib();
    const nom = eje === 'h' ? (sig > 0 ? 'Alto +' : 'Alto −') : (eje.toUpperCase() + (sig > 0 ? '+' : '−'));
    $('hudMsg').textContent = 'Movido ' + (S.pasoMm || 10) + ' mm en ' + nom + ' (ejes del plano).';
    refrescarHUD();
  }
  if(a==='mini'){
    const orden = ['grande', 'chico', 'off'];
    S.planoModo = orden[(orden.indexOf(S.planoModo || 'chico') + 1) % orden.length];
    S.verMini = S.planoModo !== 'off';
    $('btnMini').textContent = 'Planta: ' + (S.planoModo === 'grande' ? 'GRANDE' : (S.planoModo === 'chico' ? 'chica' : 'OFF'));
    if(S.planoModo === 'off') $('miniPlanta').classList.add('oculto');
  }
  if(a==='esquina'){
    if(S.esquinando === 3){
      // punto 1 confirmado → a marcarlo en la realidad
      S.esquinando = 1;
      $('btnEsquina').classList.remove('destacado');
      $('btnEsquina').textContent = 'Cancelar 2 puntos';
      UI.msg(S.modoPapel ? 'Cruz 1 confirmada ✔. Apuntá el aro a la CRUZ 1 del papel (aro amarillo o rojo sobre la mesa) y tocá.'
                         : 'Punto 1 confirmado ✔. Caminá hasta ESE lugar real, apuntá el aro al rincón (contra la pared es más preciso) y tocá.');
      UI.paso('2', 'Paso 2 de 4 · marcá el punto 1 en el lugar real');
    }else if(S.esquinando === 4){
      if(!S.refP2){
        $('hudMsg').textContent = 'Todavía no elegiste el 2º punto: tocá una esquina en el plano (con zoom).';
      }else{
        S.esquinando = 5;
        $('btnEsquina').classList.remove('destacado');
        $('btnEsquina').textContent = '↩ Volver al plano';
        UI.msg(S.modoPapel ? 'Cruz 2 confirmada ✔. Apuntá el aro a la CRUZ 2 del papel y tocá. Ahí el 3D queda parado sobre el plano.'
                           : 'Punto 2 confirmado ✔. Caminá hasta ESE lugar real (guiate por el plano), apuntá el aro y tocá. Ahí queda todo orientado.');
        UI.paso('4', 'Paso 4 de 4 · marcá el punto 2 en el lugar real');
      }
    }else if(S.esquinando === 5){
      S.esquinando = 4;
      const bE5 = $('btnEsquina'); bE5.textContent = '✔ Usar 2º punto'; bE5.classList.add('destacado');
      $('hudMsg').textContent = '↩ De vuelta al plano: elegí otra vez el 2º punto.';
    }else if(S.esquinando === 1){
      S.esquinando = 0; S.esqP1 = null; S.refP2 = null;
      $('btnEsquina').classList.remove('destacado');
      $('btnEsquina').textContent = 'Anclar esquina';
      UI.msg('Ubicación por 2 puntos cancelada. Podés apoyarlo con un toque en el aro.');
      UI.paso('', '');
    }else if(!S.trazado || !S.trazado.refEsquina){
      UI.msg('Este trazado no tiene punto de referencia para ubicarlo por 2 puntos.');
    }else{
      // arrancar el flujo completo desde el plano
      S.esquinando = 3; S.refP2 = null; S.fijado = false;
      if(S.grupo.userData.grpRef) S.grupo.userData.grpRef.visible = true;
      S.planoModo = 'grande'; S.planZoom = 1; S.planPan = { x:0, y:0 };
      $('btnMini').textContent = 'Planta: GRANDE';
      $('btnEsquina').textContent = '✔ Usar este punto'; $('btnEsquina').classList.add('destacado');
      UI.msg('PUNTO 1 en el plano: tocá una esquina (tiene imán) o dejá el origen del CAD. Después "✔ Usar este punto".');
      UI.paso('1', 'Paso 1 de 4 · elegí el punto 1 en el plano');
    }
  }
  if(a==='medir'){
    S.midiendo = !S.midiendo;
    b.textContent = 'Medir: ' + (S.midiendo ? 'ON' : 'OFF');
    if(S.midiendo){
      $('hudMsg').textContent = S.hitSource
        ? 'Apuntá la retícula al primer punto y tocá.'
        : 'Este equipo no detecta el piso: no se puede medir.';
    }else{
      limpiarMedicion();
      $('hudMsg').textContent = 'Medición cerrada.';
    }
  }
  if(a==='ocl'){
    S.oclusion = !S.oclusion;
    b.textContent = 'Oclusión: ' + (S.oclusion ? 'ON' : 'OFF');
  }
  if(a==='rot+' || a==='rot-' || a==='alt+' || a==='alt-') sincronizarAncla();
  if(a==='dist-'){ SENS.dist = Math.max(1, SENS.dist - 1); if(SENS.activo) colocarAlFrente(); }
  if(a==='dist+'){ SENS.dist = Math.min(60, SENS.dist + 1); if(SENS.activo) colocarAlFrente(); }
  if(a==='frente'){ traerAca(); }
  if(a==='esc'){
    const escalas = [1,20,50];
    if(S.trazado && S.trazado.esModelo && S.esquinando){
      // estaba eligiendo referencia y pasa a maqueta: cancelar ese flujo
      S.esquinando = 0; S.esqP1 = null; S.refP2 = null;
      S.planoModo = 'off'; $('miniPlanta').classList.add('oculto');
      const bEE = $('btnEsquina'); if(bEE){ bEE.classList.remove('destacado'); bEE.textContent = 'Anclar esquina'; }
    }
    S.escala = escalas[(escalas.indexOf(S.escala)+1) % escalas.length];
    aplicarEscala();
    S.oclusion = (S.escala === 1); $('btnOcl').textContent = 'Oclusión: ' + (S.oclusion ? 'ON' : 'OFF');
    if(SENS.activo){ SENS.dist = (S.escala===1) ? 8 : 2.5; colocarAlFrente(); }
  }
  guardarCalib();
  refrescarHUD();
});
$('btnSalirAR').addEventListener('click', salirAR);

/* ------------------------------------------------------------
   7bis. MODO AR POR SENSORES (sin ARCore, sin WebXR)
   Cámara de fondo + giroscopio. 3 grados de libertad: al girar el
   celular el trazado queda fijo alrededor; al caminar NO te sigue.
   Sirve donde WebXR no arranca (origen content://, file://, etc).
   ------------------------------------------------------------ */
const SENS = { activo:false, stream:null, orient:null, dist:6, rafId:null, q:null, screenAng:0 };

function quatDesdeOrientacion(q, alpha, beta, gamma, orient){
  const zee = new THREE.Vector3(0,0,1);
  const euler = new THREE.Euler();
  const q0 = new THREE.Quaternion();
  const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° en X
  euler.set(beta, alpha, -gamma, 'YXZ');
  q.setFromEuler(euler);
  q.multiply(q1);
  q.multiply(q0.setFromAxisAngle(zee, -orient));
}

function colocarAlFrente(){
  if(!S.grupo) return;
  // dirección donde mira el celu, aplanada al horizonte — sirve en modo
  // sensores (SENS.q) y también en WebXR (cámara actualizada por la sesión)
  const dir = new THREE.Vector3(0,0,-1);
  const base = new THREE.Vector3();
  if(SENS.activo && SENS.q){
    dir.applyQuaternion(SENS.q);
  }else if(S.camera){
    S.camera.getWorldDirection(dir);
    S.camera.getWorldPosition(base);
  }else return;
  dir.y = 0;
  if(dir.lengthSq() < 1e-6) dir.set(0,0,-1);
  dir.normalize();
  // altura del piso: en 'local-floor' el 0 ES el piso; si no, 1,4 m bajo el celu
  const pisoY = SENS.activo ? -1.4 : (S.usaFloor ? 0 : base.y - 1.4);
  S.grupo.position.set(base.x + dir.x*SENS.dist, pisoY + S.offsetY, base.z + dir.z*SENS.dist);
  S.grupo.visible = true;
  S.anclado = true;
  if(S.reticula) S.reticula.visible = false;
}

async function iniciarARSensor(){
  if(!S.trazado){
    $('estadoAR').className='nota err';
    $('estadoAR').textContent='Primero cargá un modelo (o tocá "Trazado demo").';
    return;
  }

  // 1. permiso de giroscopio (iOS lo pide explícito)
  try{
    if(typeof DeviceOrientationEvent !== 'undefined' &&
       typeof DeviceOrientationEvent.requestPermission === 'function'){
      const r = await DeviceOrientationEvent.requestPermission();
      if(r !== 'granted') throw new Error('permiso de sensores denegado');
    }
  }catch(e){
    $('estadoAR').className='nota err';
    $('estadoAR').textContent='Sensores: ' + e.message;
    return;
  }

  // 2. cámara trasera
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    $('estadoAR').className='nota err';
    $('estadoAR').innerHTML = 'Este origen (<b>' + location.protocol + '</b>) no expone la cámara: ' +
      '<code>navigator.mediaDevices</code> ni siquiera existe, por eso Chrome no te pide permiso.<br><br>' +
      'Servilo desde <b>http://localhost:8080</b> con una app de servidor HTTP en el celu, ' +
      'o desde una URL https. Ahí funciona todo, incluido el AR real.';
    $('estadoAR').scrollIntoView({behavior:'smooth', block:'center'});
    return;
  }
  let stream = null;
  try{
    stream = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:{ ideal:'environment' } }, audio:false
    });
  }catch(e){
    $('estadoAR').className='nota err';
    $('estadoAR').innerHTML = 'No se pudo abrir la cámara: <b>' + (e.name||'') + ' ' + (e.message||'') + '</b>.<br>' +
      'Si dice NotAllowedError, revisá el permiso de cámara de Chrome. ' +
      'Si dice NotSupportedError, este origen no permite cámara y hay que servirlo por https.';
    return;
  }

  SENS.stream = stream;
  const vid = $('videoCam');
  vid.srcObject = stream;
  vid.classList.remove('oculto');
  try{ await vid.play(); }catch(e){}

  // 3. escena encima del video
  const renderer = obtenerRenderer();
  const canvas = renderer.domElement;
  canvas.style.position='fixed'; canvas.style.top='0'; canvas.style.left='0';
  canvas.style.zIndex='42';
  document.body.appendChild(canvas);

  S.renderer = renderer;
  S.scene = nuevaEscena();
  S.camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, .05, 400);
  S.camera.position.set(0,0,0);

  S.grupo = construirGrupo(S.trazado);
  aplicarEscala();
  S.grupo.visible = false;
  S.scene.add(S.grupo);
  S.anclado = false; S.rotY = 0; S.offsetY = 0;
  SENS.q = new THREE.Quaternion();
  SENS.dist = (S.escala === 1) ? 8 : 2.5;

  $('capaUI').classList.add('oculto');
  $('capaAR').classList.remove('oculto');
  $('panelAR').classList.remove('oculto');
  $('hudMsg').textContent = 'MODO SENSORES: girá el celu para mirar alrededor y tocá para colocar. ' +
    'OJO: este modo no sabe dónde caminás — si te movés, el trazado se mueve con vos. ' +
    'El AR fijo de verdad es "Iniciar AR" (necesita ARCore).';

  // 4. orientación — SOLO giroscopio (evento relativo). El evento "absolute"
  // usa la brújula, y en una nave metalúrgica el magnetómetro delira con el
  // hierro: la escena entera se movía sola. Si el equipo no emite el relativo,
  // recién ahí caemos al absoluto.
  SENS.recibio = false;
  SENS.orient = ev => {
    if(ev.alpha === null) return;
    SENS.recibio = true;
    const g = Math.PI/180;
    SENS.screenAng = (screen.orientation && screen.orientation.angle || window.orientation || 0) * g;
    quatDesdeOrientacion(SENS.q, ev.alpha*g, ev.beta*g, ev.gamma*g, SENS.screenAng);
    if(!S.anclado){
      $('hudDatos').textContent = 'SENSORES OK · tocá para colocar';
    }
  };
  window.addEventListener('deviceorientation', SENS.orient, true);
  SENS.fallbackTimer = setTimeout(() => {
    if(!SENS.recibio && 'ondeviceorientationabsolute' in window){
      window.addEventListener('deviceorientationabsolute', SENS.orient, true);
      $('hudMsg').textContent = 'Usando brújula (menos estable cerca de estructuras metálicas).';
    }
  }, 2000);

  // 5. tocar para colocar
  canvas.addEventListener('pointerdown', () => { colocarAlFrente(); refrescarHUD(); });

  SENS.activo = true;

  let sinDatos = 0;
  (function loop(){
    if(!SENS.activo) return;
    if(S.grupo && S.grupo.userData.grpEtiq){
      S.grupo.userData.grpEtiq.visible = S.verEtiquetas;
      S.grupo.userData.grpMaq.visible  = S.verMaquinas;
      if(S.grupo.userData.grpPiso) S.grupo.userData.grpPiso.visible = S.verPiso;
    }
    if(!S.anclado && ++sinDatos === 180 && SENS.q.w === 1 && SENS.q.x === 0){
      $('hudMsg').textContent = 'No llegan datos del giroscopio. Tocá igual: se coloca al frente y podés girarlo con los botones.';
    }
    // suavizado: la cámara persigue la orientación medida en vez de copiarla,
    // así el temblor del sensor no sacude toda la escena
    S.camera.quaternion.slerp(SENS.q, 0.35);
    renderer.render(S.scene, S.camera);
    SENS.rafId = requestAnimationFrame(loop);
  })();

  window.addEventListener('resize', ajustarSensor);
}

function ajustarSensor(){
  if(!SENS.activo || !S.renderer) return;
  S.camera.aspect = window.innerWidth/window.innerHeight;
  S.camera.updateProjectionMatrix();
  S.renderer.setSize(window.innerWidth, window.innerHeight);
}

function cerrarARSensor(){
  SENS.activo = false;
  if(SENS.rafId) cancelAnimationFrame(SENS.rafId);
  if(SENS.fallbackTimer){ clearTimeout(SENS.fallbackTimer); SENS.fallbackTimer = null; }
  if(SENS.orient){
    window.removeEventListener('deviceorientationabsolute', SENS.orient, true);
    window.removeEventListener('deviceorientation', SENS.orient, true);
    SENS.orient = null;
  }
  if(SENS.stream){ SENS.stream.getTracks().forEach(t => t.stop()); SENS.stream = null; }
  const vid = $('videoCam');
  vid.srcObject = null; vid.classList.add('oculto');
  if(S.renderer){ const r = S.renderer; S.renderer = null; try{ r.setAnimationLoop(null); }catch(e){} try{ r.domElement.remove(); }catch(e){} }  // el renderer se reusa, no se destruye
  S.grupo = null; S.anclado = false;
  $('capaAR').classList.add('oculto');
  $('capaUI').classList.remove('oculto');
}

/* ------------------------------------------------------------
   8. VISOR 3D (fallback sin AR — para PC y para mostrar en escritorio)
   ------------------------------------------------------------ */
function iniciar3D(){
  if(!S.trazado) return;
  const cont = $('visor3D');
  cont.classList.remove('oculto');
  $('capaUI').classList.add('oculto');

  const renderer = obtenerRenderer();
  renderer.domElement.style.visibility = '';
  cont.appendChild(renderer.domElement);
  try{ history.pushState({ v3d: 1 }, ''); S._hist3D = true; }catch(e){}

  const scene = nuevaEscena();
  const cam = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, .05, 500);
  const grupo = construirGrupo(S.trazado);
  scene.add(grupo);

  const R = Math.max(Math.max(S.trazado.medidas.x, S.trazado.medidas.z, S.trazado.medidas.y) * 1.6, 0.8);
  let ang = Math.PI*0.25, alt = Math.PI*0.28, dist = R;
  const centro = new THREE.Vector3(0, S.trazado.medidas.y*0.4, 0);

  function ubicarCam(){
    cam.position.set(
      centro.x + dist*Math.cos(alt)*Math.cos(ang),
      centro.y + dist*Math.sin(alt),
      centro.z + dist*Math.cos(alt)*Math.sin(ang)
    );
    cam.lookAt(centro);
  }
  ubicarCam();

  let px=0, py=0, arr=false, dPrev=0;
  const el = renderer.domElement;
  const dist2 = e => Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
  el.addEventListener('pointerdown', e => { arr=true; px=e.clientX; py=e.clientY; });
  el.addEventListener('pointerup',   () => arr=false);
  el.addEventListener('pointercancel', () => arr=false);
  el.addEventListener('pointermove', e => {
    if(!arr) return;
    ang -= (e.clientX-px)*.006;
    alt = Math.min(Math.PI/2-.05, Math.max(.05, alt + (e.clientY-py)*.005));
    px=e.clientX; py=e.clientY; ubicarCam();
  });
  el.addEventListener('wheel', e => { dist = Math.min(R*3, Math.max(R*.15, dist + e.deltaY*.01*R*.1)); ubicarCam(); }, {passive:true});
  el.addEventListener('touchstart', e => { if(e.touches.length===2){ arr=false; dPrev=dist2(e); } }, {passive:true});
  el.addEventListener('touchmove',  e => {
    if(e.touches.length===2){
      const d = dist2(e);
      dist = Math.min(R*3, Math.max(R*.15, dist * (dPrev/d)));
      dPrev = d; ubicarCam();
    }
  }, {passive:true});

  function loop(){
    grupo.userData.grpEtiq.visible = S.verEtiquetas;
    if(grupo.userData.grpPiso) grupo.userData.grpPiso.visible = S.verPiso;
    renderer.render(scene, cam);
    S.raf3D = requestAnimationFrame(loop);
  }
  loop();

  window.addEventListener('resize', () => {
    cam.aspect = window.innerWidth/window.innerHeight;
    cam.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  $('btnSalir3D').onclick = () => {
    cancelAnimationFrame(S.raf3D);
    el.remove();                    // el renderer se reusa, no se destruye
    cont.classList.add('oculto');
    $('capaUI').classList.remove('oculto');
    $('btnSalir3D').onclick = null;
  };
}

/* ------------------------------------------------------------
   9. TRAZADO DEMO — nave con 4 máquinas y colector a ventilador
   ------------------------------------------------------------ */
const DEMO = {
  obra:'DEMO — Nave 2, línea de sierras',
  unidades:'mm',
  nodos:{
    B1:[ 1500, 1000, 1400], C1:[ 1500, 1000, 4200],
    B2:[ 5000, 1000, 1400], C2:[ 5000, 1000, 4200],
    B3:[ 8500, 1000, 1600], C3:[ 8500, 1000, 4200],
    B4:[12000, 1000, 1600], C4:[12000, 1000, 4200],
    T1:[ 1500, 4000, 4200], T2:[ 5000, 4000, 4200],
    T3:[ 8500, 4000, 4200], T4:[12000, 4000, 4200],
    V1:[14500, 4000, 4200], V2:[14500, 4000, 1800]
  },
  tramos:[
    {de:'B1',a:'C1',d:160}, {de:'C1',a:'T1',d:160},
    {de:'B2',a:'C2',d:160}, {de:'C2',a:'T2',d:160},
    {de:'B3',a:'C3',d:180}, {de:'C3',a:'T3',d:180},
    {de:'B4',a:'C4',d:180}, {de:'C4',a:'T4',d:180},
    {de:'T1',a:'T2',d:220}, {de:'T2',a:'T3',d:280},
    {de:'T3',a:'T4',d:340}, {de:'T4',a:'V1',d:400},
    {de:'V1',a:'V2',d:400}
  ],
  maquinas:[
    {nombre:'Sierra 1', pos:[1500,1000],  alto:1200},
    {nombre:'Sierra 2', pos:[5000,1000],  alto:1200},
    {nombre:'Cepillo',  pos:[8500,1600],  alto:1400},
    {nombre:'Lijadora', pos:[12000,1600], alto:1400}
  ],
  ventilador:{ nodo:'V2' }
};

/* --- errores visibles en pantalla, para no quedarse sin saber qué pasó --- */
function mostrarError(txt){
  registrar('ERROR: ' + txt);
  const d = $('diag');
  d.classList.remove('oculto');
  d.textContent = 'ERROR: ' + txt + '\n\n' + (d.textContent || '');
  // si estamos dentro de AR, el diagnóstico no se ve: lo mostramos en el HUD
  if(!$('capaAR').classList.contains('oculto')){
    const h = $('hudMsg');
    h.style.display = 'block';
    h.textContent = '⚠ ' + txt;
  }else{
    d.scrollIntoView({behavior:'smooth', block:'center'});
  }
}
window.addEventListener('error', e => mostrarError((e.message||'') + ' @ linea ' + (e.lineno||'?')));
window.addEventListener('unhandledrejection', e => mostrarError('promesa: ' + (e.reason && e.reason.message || e.reason)));

/* ------------------------------------------------------------
   10. WIRING
   ------------------------------------------------------------ */
$('ver').textContent = VERSION;

$('btnDemo').addEventListener('click', () => cargar(DEMO));
$('btn3DFile').addEventListener('click', () => $('inp3D').click());
$('inp3D').addEventListener('change', ev => {
  cargarArchivos(ev.target.files);
  ev.target.value = '';
});
$('btnArchivo').addEventListener('click', () => $('inpArchivo').click());
$('inpArchivo').addEventListener('change', ev => {
  const f = ev.target.files?.[0];
  if(!f) return;
  const fr = new FileReader();
  fr.onload = () => {
    try{ cargar(JSON.parse(fr.result)); }
    catch(e){
      $('estadoAR').className='nota err';
      $('estadoAR').textContent='JSON inválido: ' + e.message;
    }
  };
  fr.readAsText(f);
});

const _selImp = document.getElementById('selImpreso');
if(_selImp) _selImp.addEventListener('change', () => { S.factorImpresion = parseFloat(_selImp.value) || 0; S._facMedido = 0; });
document.querySelectorAll('input[name="ubic"]').forEach(r => {
  r.addEventListener('change', () => { S.modoUbic = r.value; });
});
document.querySelectorAll('input[name="modo"]').forEach(r => {
  r.addEventListener('change', () => {
    if(r.value === 'papel'){
      // SOBRE PLANO IMPRESO: la escala la deducen las dos cruces del papel
      S.modoPapel = true; S.escala = 50;
    }else{
      S.modoPapel = false; S.escala = Number(r.value) || 1;
    }
    aplicarEscala();
    refrescarHUD();
  });
});

$('btnAR').addEventListener('click', iniciarAR);
$('btnHoja').addEventListener('click', () => { const sel = document.getElementById('selHojaApp'); generarHojaEnApp(sel ? sel.value : 'a3'); });
$('btnSensor').addEventListener('click', () => {
  iniciarARSensor().catch(e => mostrarError('AR sensores: ' + (e.message || e)));
});
$('btn3D').addEventListener('click', iniciar3D);

$('btnTema').addEventListener('click', () => {
  const b = document.body;
  b.dataset.tema = b.dataset.tema === 'neon' ? 'corporate' : 'neon';
});

revisarSoporte();

// ARCHIVO COMPARTIDO desde otra app (WhatsApp / Archivos → Compartir → 3DDUT AR):
// el service worker lo dejó guardado y nos mandó acá con #compartido.
if(location.hash === '#compartido'){
  (async () => {
    try{
      const cache = await caches.open(CFG.cacheCompartido);
      const claves = await cache.keys();
      const files = [];
      for(const req of claves){
        if(!/_compartido/.test(req.url)) continue;
        const r = await cache.match(req);
        if(!r) continue;
        const nombre = decodeURIComponent(r.headers.get('X-Nombre') || 'modelo.obj');
        files.push(new File([await r.blob()], nombre));
        await cache.delete(req);
      }
      if(files.length){
        cargarArchivos(files);
        UI.estado('Recibido: ' + files.map(f => f.name).join(' + ') + ' — tocá Iniciar AR.', 'ok');
      }
      history.replaceState(null, '', location.pathname);
    }catch(e){ mostrarError('Archivo compartido: ' + (e.message || e)); }
  })();
}



/* ── API para las interfaces (index.html de cada marca) ── */
window.AR = { S, CFG, PAL, UI, cargar, cargarModelo3D, cargarMTL, cargarArchivos, generarHojaEnApp, qrCanvas, pdfConJPEG, iniciarAR, iniciar3D, iniciarARSensor,
              revisarSoporte, traerAca, fijarModelo, tapPantalla, refrescarHUD, DEMO, VERSION,
              construirGrupoMS, girarRed, marcadorCompuesto, pasoMarcador, qrCanvas, generarHojaEnApp, mostrarListaPivote, cancelarPivote };
