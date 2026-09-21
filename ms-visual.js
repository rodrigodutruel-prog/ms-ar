/* Local studio lighting and material textures. No network assets are required. */
(() => {
  'use strict';
  const T=THREE;
  function texture(){
    const size=128, pixels=new Uint8Array(size*size*4);let seed=4187;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const grain=184+(seed>>>24)%32+Math.sin(y*.8)*7,i=(y*size+x)*4;
      pixels[i]=pixels[i+1]=pixels[i+2]=grain;pixels[i+3]=255;
    }
    const map=new T.DataTexture(pixels,size,size,T.RGBAFormat);
    map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(5,5);
    map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;
    map.generateMipmaps=true;map.needsUpdate=true;return map;
  }
  function studio(){
    const faces=[];
    for(let i=0;i<6;i++){
      const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
      const gradient=g.createLinearGradient(0,0,0,128);
      gradient.addColorStop(0,i===3?'#3a4049':'#d9e5f2');gradient.addColorStop(1,'#535e70');
      g.fillStyle=gradient;g.fillRect(0,0,128,128);
      if(i!==3){g.fillStyle=i===2?'#ffffff':'#eef4ff';g.fillRect(20,12,24,94);g.fillStyle='#9cabc0';g.fillRect(82,25,15,70);}
      faces.push(c);
    }
    const env=new T.CubeTexture(faces);env.colorSpace=T.SRGBColorSpace;env.needsUpdate=true;return env;
  }
  function material(options={},finish='paint'){
    const m=new T.MeshStandardMaterial({...options,metalness:finish==='metal'?.72:.22,roughness:finish==='metal'?.34:.57});
    m.userData.finish=finish;return m;
  }
  function uv(geo){
    if(geo.getAttribute('uv'))return;
    const p=geo.getAttribute('position'),n=geo.getAttribute('normal');if(!p||!n)return;
    const data=new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++){
      const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));
      data[i*2]=x>y&&x>z?p.getZ(i):p.getX(i);
      data[i*2+1]=y>=x&&y>=z?p.getZ(i):p.getY(i);
    }
    geo.setAttribute('uv',new T.BufferAttribute(data,2));
  }
  function prepare(group,tz){
    const grain=texture();let used=false;
    function visit(o,decorative){
      decorative=decorative||['referencia','grilla','etiquetas','replanteo'].includes(o.userData.rol)||o===group.userData.grpSombra||o===group.userData.grpPiso;
      if(o.isMesh&&!decorative){
        const materials=Array.isArray(o.material)?o.material:[o.material];
        for(const m of materials)if(m?.isMeshStandardMaterial){
          uv(o.geometry);m.roughnessMap=grain;m.bumpMap=grain;m.bumpScale=.00018;
          m.envMapIntensity=.8;if(m.emissive)m.emissiveIntensity=Math.min(m.emissiveIntensity,.025);
          used=true;
        }
        o.castShadow=materials.some(m=>m&&!m.transparent);o.receiveShadow=true;
      }
      for(const child of o.children)visit(child,decorative);
    }
    visit(group,false);if(!used)grain.dispose();
    return group;
  }
  function scene(){
    const s=new T.Scene();s.environment=studio();
    s.add(new T.HemisphereLight(0xe8f1ff,0x687080,1.35));
    const key=new T.DirectionalLight(0xfff3df,2.4);key.position.set(3,6,4);
    key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.radius=3;
    key.shadow.autoUpdate=false;key.shadow.needsUpdate=true;
    s.add(key,key.target);
    const fill=new T.DirectionalLight(0xbdd5ff,.7);fill.position.set(-4,2,-3);s.add(fill);
    s.userData.visual={key,matrix:new T.Matrix4(),initialized:false,scale:new T.Vector3(),center:new T.Vector3(),offset:new T.Vector3()};return s;
  }
  function attach(s,group,tz){
    if(!s.userData.visual)return;
    const size=tz.medidas,span=Math.max(size.x,size.y,size.z,.05);
    const floor=new T.Mesh(new T.PlaneGeometry(Math.max(size.x,span*.4)*1.7,Math.max(size.z,span*.4)*1.7),new T.ShadowMaterial({color:0x172031,opacity:.28,depthWrite:false}));
    floor.rotation.x=-Math.PI/2;floor.position.y=.0005;floor.receiveShadow=true;floor.userData.rol='sombra';
    group.add(floor);if(group.userData.grpSombra)group.userData.grpSombra.visible=false;
    group.userData.grpSombraReal=floor;
    s.userData.visual.group=group;s.userData.visual.size=size.clone();
    s.userData.visual.span=span;update(s);
  }
  function update(s){
    const v=s?.userData.visual;if(!v?.group)return;
    const group=v.group;group.updateWorldMatrix(true,false);
    const visibility=group.visible+':'+group.userData.grpMaq?.visible+':'+group.children.length;
    if(v.initialized&&v.matrix.equals(group.matrixWorld)&&v.visibility===visibility)return;
    v.matrix.copy(group.matrixWorld);v.visibility=visibility;v.initialized=true;v.key.shadow.needsUpdate=true;
    const scale=v.scale.setFromMatrixScale(group.matrixWorld).length()/Math.sqrt(3);
    const r=Math.max(.02,v.span*scale),center=v.center.set(0,v.size.y*.35,0).applyMatrix4(group.matrixWorld);
    v.key.position.copy(center).add(v.offset.set(r*.7,r*1.6,r*.8));v.key.target.position.copy(center);
    const cam=v.key.shadow.camera;cam.left=cam.bottom=-r;cam.right=cam.top=r;cam.near=r*.03;cam.far=r*5;cam.updateProjectionMatrix();
    v.key.shadow.normalBias=r*.001;v.key.shadow.bias=-.00015;
    if(group.userData.grpSombra)group.userData.grpSombra.visible=false;
  }
  function renderer(r){if(r.shadowMap){r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;}r.toneMappingExposure=1;}
  function dispose(s){if(s?.isScene){s.environment?.dispose();s.traverse(o=>{if(o.isLight&&o.shadow?.map)o.shadow.map.dispose();});}}
  window.MSVisual={material,prepare,scene,attach,update,renderer,dispose};
})();
