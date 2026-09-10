/* Camera pixels stay on the device; decoding is isolated from the render/UI thread. */
'use strict';
importScripts('vendor/jsQR.js');
self.onmessage = event => {
  const {id,buffer,width,height}=event.data;
  try {
    const code=jsQR(new Uint8ClampedArray(buffer),width,height,{inversionAttempts:'dontInvert'});
    self.postMessage({id,code:code ? {data:code.data,location:code.location,version:code.version} : null});
  } catch(error) { self.postMessage({id,error:String(error.message || error)}); }
};
