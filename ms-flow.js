/* Local paper tracking: Lucas-Kanade checked forward/backward, then RANSAC.
   The exact QR must periodically confirm identity. Never extrapolate a lost pose. */
(function(root,factory){
  if(typeof module==='object' && module.exports)module.exports=factory;
  else root.MSFlow=factory(root.jsfeat);
})(typeof globalThis!=='undefined'?globalThis:this,function(J){
  'use strict';
  const keys=['topLeftCorner','topRightCorner','bottomRightCorner','bottomLeftCorner'];
  const points=c=>keys.map(k=>({...c.location[k]}));
  const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%4];return s+a.x*b.y-a.y*b.x;},0))/2;
  function inside(p,q){let sign=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],cross=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);if(sign&&cross*sign<0)return false;if(cross)sign=Math.sign(cross);}return true;}
  class Tracker {
    constructor(){this.pool=[];this.reset();}
    reset(){this.prev=null;this.features=[];this.quad=null;this.code=null;this.verified=0;}
    frame(rgba,w,h){
      const pyr=new J.pyramid_t(3);pyr.allocate(w,h,J.U8_t|J.C1_t);
      J.imgproc.grayscale(rgba,w,h,pyr.data[0]);pyr.build(pyr.data[0],true);return pyr;
    }
    seed(pyr,code,now){
      this.reset();this.prev=pyr;this.code=code;this.quad=points(code);this.verified=now;
      const full=pyr.data[0],x0=Math.max(0,Math.floor(Math.min(...this.quad.map(p=>p.x)))-12),y0=Math.max(0,Math.floor(Math.min(...this.quad.map(p=>p.y)))-12);
      const x1=Math.min(full.cols,Math.ceil(Math.max(...this.quad.map(p=>p.x)))+12),y1=Math.min(full.rows,Math.ceil(Math.max(...this.quad.map(p=>p.y)))+12);
      const im=new J.matrix_t(x1-x0,y1-y0,J.U8_t|J.C1_t);
      for(let y=0;y<im.rows;y++)im.data.set(full.data.subarray((y+y0)*full.cols+x0,(y+y0)*full.cols+x1),y*im.cols);
      while(this.pool.length<im.cols*im.rows)this.pool.push(new J.keypoint_t());
      J.fast_corners.set_threshold(20);
      const n=J.fast_corners.detect(im,this.pool,12),list=this.pool.slice(0,n).map(p=>({x:p.x+x0,y:p.y+y0,score:p.score})).filter(p=>inside(p,this.quad)).sort((a,b)=>b.score-a.score);
      for(const p of list){if(this.features.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>9))this.features.push({x:p.x,y:p.y});if(this.features.length===80)break;}
    }
    track(pyr,now){
      if(!this.prev||!this.quad||now-this.verified>2400||this.features.length<14||this.prev.data[0].cols!==pyr.data[0].cols||this.prev.data[0].rows!==pyr.data[0].rows){this.reset();return null;}
      const n=this.features.length,a=new Float32Array(n*2),b=new Float32Array(n*2),back=new Float32Array(n*2),ok=new Uint8Array(n),rev=new Uint8Array(n);
      this.features.forEach((p,i)=>{a[i*2]=p.x;a[i*2+1]=p.y;});
      J.optical_flow_lk.track(this.prev,pyr,a,b,n,15,25,ok,.01,.001);
      J.optical_flow_lk.track(pyr,this.prev,b,back,n,15,25,rev,.01,.001);
      const from=[],to=[],w=pyr.data[0].cols,h=pyr.data[0].rows;
      for(let i=0;i<n;i++)if(ok[i]&&rev[i]&&Math.hypot(a[2*i]-back[2*i],a[2*i+1]-back[2*i+1])<1.1&&b[2*i]>8&&b[2*i]<w-8&&b[2*i+1]>8&&b[2*i+1]<h-8){from.push(this.features[i]);to.push({x:b[2*i],y:b[2*i+1]});}
      if(from.length<14||from.length<n*.55){this.reset();return null;}
      const matrix=new J.matrix_t(3,3,J.F64_t|J.C1_t),mask=new J.matrix_t(from.length,1,J.U8_t|J.C1_t),kernel=new J.motion_model.homography2d();
      if(!J.motion_estimator.ransac(new J.ransac_params_t(4,1.8,.35,.99),kernel,from,to,from.length,matrix,mask,100)){this.reset();return null;}
      const f=[],t=[];for(let i=0;i<from.length;i++)if(mask.data[i]){f.push(from[i]);t.push(to[i]);}
      if(f.length<12||f.length<from.length*.75||!kernel.run(f,t,matrix,f.length)){this.reset();return null;}
      const m=matrix.data,project=p=>{const z=m[6]*p.x+m[7]*p.y+m[8];return{x:(m[0]*p.x+m[1]*p.y+m[2])/z,y:(m[3]*p.x+m[4]*p.y+m[5])/z};};
      const q=this.quad.map(project),ratio=area(q)/area(this.quad),cx=f.reduce((s,p)=>s+p.x,0)/f.length,cy=f.reduce((s,p)=>s+p.y,0)/f.length;
      const quadrants=new Set(f.map(p=>(p.x>cx?1:0)+(p.y>cy?2:0)));
      if(quadrants.size<4||ratio<.65||ratio>1.55||q.some(p=>!Number.isFinite(p.x+p.y)||p.x<1||p.x>=w-1||p.y<1||p.y>=h-1)){this.reset();return null;}
      this.prev=pyr;this.features=t;this.quad=q;
      return {data:this.code.data,version:this.code.version,location:Object.fromEntries(keys.map((key,i)=>[key,q[i]])),tracked:true};
    }
  }
  return {Tracker};
});
