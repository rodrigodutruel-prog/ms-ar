/* MS AR: QR geometry and time-based pose validation. No camera or network access. */
(function(root, factory) {
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.MSTracking = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const corners = code => ['topLeftCorner','topRightCorner','bottomRightCorner','bottomLeftCorner'].map(k => code.location[k]);
  function validQuad(points, width, height) {
    if(!Array.isArray(points) || points.length !== 4 || points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<1||p.y<1||p.x>=width-1||p.y>=height-1)) return false;
    const sides=points.map((p,i)=>distance(p,points[(i+1)%4]));
    if(Math.min(...sides)<32 || Math.max(...sides)/Math.min(...sides)>4) return false;
    let sign=0, area=0;
    for(let i=0;i<4;i++) {
      const a=points[i],b=points[(i+1)%4],c=points[(i+2)%4];
      const cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
      if(!cross || (sign && Math.sign(cross)!==sign)) return false;
      sign=Math.sign(cross); area+=a.x*b.y-a.y*b.x;
    }
    return Math.abs(area)>2200;
  }
  function markerGeometry(code, width, height, marker) {
    const points=corners(code);
    if(!validQuad(points,width,height) || !(marker.lado_mm>0 && marker.lado_mm<2000)) throw new Error('El marcador guardado no tiene un tamaño válido.');
    const side=points.reduce((sum,p,i)=>sum+distance(p,points[(i+1)%4]),0)/4;
    const center=points.reduce((p,c)=>({x:p.x+c.x/4,y:p.y+c.y/4}),{x:0,y:0});
    return {text:code.data, fraction:side/width, dx:(center.x/width-.5), dy:(center.y/height-.5)};
  }
  function projectionError(rotation,translation,points,size,focal) {
    if(!rotation || rotation.length!==3 || !translation || translation.length!==3 || !rotation.flat().concat(translation).every(Number.isFinite)) return Infinity;
    const half=size/2, model=[[-half,half],[half,half],[half,-half],[-half,-half]];
    let sum=0;
    for(let i=0;i<4;i++) {
      const [x,y]=model[i], z=translation[2]+rotation[2][0]*x+rotation[2][1]*y;
      if(z<=size*.5) return Infinity;
      sum+=Math.pow(focal*(translation[0]+rotation[0][0]*x+rotation[0][1]*y)/z-points[i].x,2);
      sum+=Math.pow(focal*(translation[1]+rotation[1][0]*x+rotation[1][1]*y)/z-points[i].y,2);
    }
    return Math.sqrt(sum/4);
  }
  function rotationDistance(a,b) {
    if(!b) return 0;
    let trace=0;
    for(let i=0;i<3;i++) for(let j=0;j<3;j++) trace+=a[i][j]*b[i][j];
    return Math.acos(Math.max(-1,Math.min(1,(trace-1)/2)));
  }
  function solveLinear(matrix,vector) {
    const n=vector.length,a=matrix.map((row,i)=>row.concat(vector[i]));
    for(let c=0;c<n;c++){
      let pivot=c;for(let r=c+1;r<n;r++)if(Math.abs(a[r][c])>Math.abs(a[pivot][c]))pivot=r;
      if(Math.abs(a[pivot][c])<1e-12)return null;
      [a[c],a[pivot]]=[a[pivot],a[c]];
      const k=a[c][c];for(let j=c;j<=n;j++)a[c][j]/=k;
      for(let r=0;r<n;r++)if(r!==c){const k=a[r][c];for(let j=c;j<=n;j++)a[r][j]-=k*a[c][j];}
    }
    return a.map(row=>row[n]);
  }
  function refinePose(rotation,translation,points,size,focal) {
    let R=rotation.map(row=>row.slice()),t=translation.slice(),error=projectionError(R,t,points,size,focal),lambda=1e-4;
    const model=[[-1,1],[1,1],[1,-1],[-1,-1]].map(([x,y])=>[x*size/2,y*size/2]);
    for(let iteration=0;iteration<15 && error>.015;iteration++){
      const A=Array.from({length:6},()=>Array(6).fill(0)),b=Array(6).fill(0);
      for(let i=0;i<4;i++){
        const [x,y]=model[i],c=R.map(row=>row[0]*x+row[1]*y),[X,Y,Z]=c.map((v,k)=>v+t[k]);
        const du=[focal/Z,0,-focal*X/(Z*Z)],dv=[0,focal/Z,-focal*Y/(Z*Z)];
        const d=[[0,c[2],-c[1]],[-c[2],0,c[0]],[c[1],-c[0],0]];
        [du,dv].forEach((partial,row)=>{
          const J=[0,1,2].map(k=>partial.reduce((sum,v,j)=>sum+v*d[j][k],0)).concat(partial);
          const residual=(row===0?points[i].x-focal*X/Z:points[i].y-focal*Y/Z);
          for(let j=0;j<6;j++){b[j]+=J[j]*residual;for(let k=0;k<6;k++)A[j][k]+=J[j]*J[k];}
        });
      }
      for(let i=0;i<6;i++)A[i][i]+=lambda*Math.max(A[i][i],1);
      const delta=solveLinear(A,b);if(!delta || !delta.every(Number.isFinite))break;
      const theta=Math.hypot(...delta.slice(0,3));if(theta>.5){lambda*=10;continue;}
      const v=delta.slice(0,3),K=[[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]];
      const aa=theta<1e-6?1:Math.sin(theta)/theta,bb=theta<1e-6?.5:(1-Math.cos(theta))/(theta*theta);
      const Q=K.map((row,i)=>row.map((k,j)=>(i===j?1:0)+aa*k+bb*K[i].reduce((sum,v,z)=>sum+v*K[z][j],0)));
      const nextR=Q.map(row=>[0,1,2].map(j=>row.reduce((sum,v,k)=>sum+v*R[k][j],0))),nextT=t.map((v,i)=>v+delta[i+3]);
      const nextError=projectionError(nextR,nextT,points,size,focal);
      if(nextError<error){R=nextR;t=nextT;error=nextError;lambda=Math.max(1e-7,lambda/3);}
      else lambda*=10;
    }
    return {rotation:R,translation:t,error};
  }
  function solvePose(POS,points,width,height,size,focal,previous) {
    if(!validQuad(points,width,height)) return null;
    const centered=points.map(p=>({x:p.x-width/2,y:height/2-p.y}));
    let pose;
    try { pose=new POS.Posit(size,focal).pose(centered); } catch(_) { return null; }
    const candidates=['best','alternative'].map(key=>{
      const rotation=pose[key+'Rotation'],translation=pose[key+'Translation'];
      const error=projectionError(rotation,translation,centered,size,focal);
      return error<8 ? refinePose(rotation,translation,centered,size,focal) : {rotation,translation,error};
    }).filter(p=>p.error<2.8 && p.translation[2]>size && p.translation[2]<8);
    // Coplanar pose has two solutions. Prefer temporal continuity only when
    // both explain the observed corners equally well; never preserve a bad fit.
    candidates.sort((a,b)=>(a.error+Math.min(.65,rotationDistance(a.rotation,previous)*.3))-(b.error+Math.min(.65,rotationDistance(b.rotation,previous)*.3)));
    return candidates[0] || null;
  }
  class CornerFilter {
    constructor() { this.reset(); }
    reset() { this.points=null; this.time=0; }
    update(points,time) {
      if(!this.points || time-this.time>250) this.points=points.map(p=>({...p}));
      else {
        const motion=Math.max(...points.map((p,i)=>distance(p,this.points[i])));
        const alpha=motion>5 ? .95 : motion>1.3 ? .72 : .35;
        this.points=points.map((p,i)=>({x:this.points[i].x+(p.x-this.points[i].x)*alpha,y:this.points[i].y+(p.y-this.points[i].y)*alpha}));
      }
      this.time=time; return this.points.map(p=>({...p}));
    }
  }
  class Acquisition {
    constructor() { this.reset(); }
    reset() { this.since=null; this.last=null; this.count=0; this.ready=false; }
    accept(now) {
      if(this.last===null || now-this.last>900) { this.since=now; this.count=0; this.ready=false; }
      this.last=now; this.count++;
      this.ready=this.ready || (this.count>=2 && now-this.since>=100);
      return this.ready;
    }
    miss(now) { if(this.last===null || now-this.last>600) this.reset(); return false; }
  }
  class SurfaceFilter {
    constructor(){this.reset();}
    reset(){this.samples=[];this.last=null;this.ready=false;}
    update(p,time){
      if(!p || ![p.x,p.y,p.z].every(Number.isFinite)){this.reset();return null;}
      if(this.last!==null && time-this.last>150)this.reset();
      if(this.samples.length && Math.hypot(p.x-this.samples.at(-1).x,p.y-this.samples.at(-1).y,p.z-this.samples.at(-1).z)>.08)this.reset();
      this.last=time;this.samples.push({...p,time});
      this.samples=this.samples.filter(s=>time-s.time<=450);
      const mean={x:0,y:0,z:0};
      this.samples.forEach(s=>{mean.x+=s.x/this.samples.length;mean.y+=s.y/this.samples.length;mean.z+=s.z/this.samples.length;});
      const spread=Math.max(...this.samples.map(s=>Math.hypot(s.x-mean.x,s.y-mean.y,s.z-mean.z)));
      this.ready=this.samples.length>=5 && time-this.samples[0].time>=250 && spread<.018;
      return mean;
    }
  }
  return {corners,validQuad,markerGeometry,projectionError,rotationDistance,solvePose,CornerFilter,Acquisition,SurfaceFilter};
});
