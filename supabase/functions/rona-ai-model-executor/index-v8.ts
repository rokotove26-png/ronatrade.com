// Mount the dedicated Payments V8 signed-document Finance worker inside the existing model-executor function.
// This avoids creating another Edge Function and isolates V8 extraction from the generic 120B queue.
const nativeServe:any=Deno.serve.bind(Deno);

async function captureHandler(specifier:string){
  let captured:any=null;
  const original=Object.getOwnPropertyDescriptor(Deno,'serve');
  Object.defineProperty(Deno,'serve',{configurable:true,writable:true,value:(first:any,second?:any)=>{
    captured=typeof first==='function'?first:second;
    if(typeof captured!=='function')throw new Error('EDGE_HANDLER_CAPTURE_FAILED');
    return{finished:Promise.resolve(),ref(){},unref(){},shutdown(){return Promise.resolve()},addr:{transport:'tcp',hostname:'0.0.0.0',port:0}};
  }});
  try{await import(specifier)}finally{if(original)Object.defineProperty(Deno,'serve',original);else Object.defineProperty(Deno,'serve',{configurable:true,writable:true,value:nativeServe})}
  if(typeof captured!=='function')throw new Error(`EDGE_HANDLER_NOT_CAPTURED:${specifier}`);
  return captured;
}

const baseHandler=await captureHandler('./index.ts');
const financeV8Handler=await captureHandler('../rona-finance-v8-document-worker/index.ts');

nativeServe(async(req:Request,info:any)=>{
  const path=new URL(req.url).pathname;
  if(path.endsWith('/finance-v8-run')){
    const forwarded=new Request('https://internal.local/rona-finance-v8-document-worker/run',{method:'POST',headers:req.headers});
    return await financeV8Handler(forwarded,info);
  }
  if(path.endsWith('/finance-v8-health')){
    const forwarded=new Request('https://internal.local/rona-finance-v8-document-worker/health',{method:'GET',headers:req.headers});
    return await financeV8Handler(forwarded,info);
  }
  return await baseHandler(req,info);
});
