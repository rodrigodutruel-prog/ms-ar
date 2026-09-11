/* Camera pixels stay on the device; decoding is isolated from the render/UI thread. */
'use strict';
// jsfeat's unmodified browser bundle exports via window, also in this worker.
self.window=self;
importScripts('vendor/jsQR.js','vendor/jsfeat.js','ms-flow.js');
const tracker=new MSFlow.Tracker();let frames=0;
self.onmessage = event => {
  const {id,buffer,width,height,expected,reset}=event.data;
  try {
    if(reset)tracker.reset();
    const pixels=new Uint8ClampedArray(buffer),now=performance.now();
    const pyramid=expected?tracker.frame(pixels,width,height):null;
    const tracked=pyramid?tracker.track(pyramid,now):null;
    let code=(!tracked || ++frames%3===0)?jsQR(pixels,width,height,{inversionAttempts:'dontInvert'}):null;
    if(code){
      code={data:code.data,location:code.location,version:code.version};
      if(expected&&code.data===expected)tracker.seed(pyramid,code,now);else tracker.reset();
    }else code=tracked;
    self.postMessage({id,code});
  } catch(error) { tracker.reset();self.postMessage({id,error:String(error.message || error)}); }
};
