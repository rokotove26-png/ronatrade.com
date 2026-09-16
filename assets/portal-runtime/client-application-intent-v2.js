(()=>{'use strict';
const CONTRACT='RONA_APPLICATION_BUSINESS_V2';
if(window.RonaApplicationIntentV2?.contract===CONTRACT)return;
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value}
async function fingerprint(value){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable(value))));return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('')}
function create(){return {openedAt:Date.now(),fingerprint:null,inFlight:null,completed:false}}
async function submit(intent,kind,body,request){
 if(!intent||!['STANDARD','DELIVERED'].includes(kind)||typeof request!=='function')throw new Error('APPLICATION_INTENT_INVALID');
 if(intent.inFlight)return intent.inFlight;
 if(!crypto?.subtle||!crypto?.randomUUID||!navigator?.locks?.request)throw new Error('APPLICATION_RETRY_STORAGE_UNAVAILABLE');
 // Persist only a hash and opaque intent key, never the client's commercial payload or credentials.
 intent.inFlight=(async()=>{
  const fp=await fingerprint({kind,body});
  if(intent.fingerprint&&intent.fingerprint!==fp)throw new Error('APPLICATION_RETRY_PAYLOAD_CHANGED');
  intent.fingerprint=fp;
  const storageKey='rona:application-intent:v2:'+fp;
  return navigator.locks.request(storageKey,async()=>{
   let saved;
   try{saved=JSON.parse(localStorage.getItem(storageKey)||'null')}catch{throw new Error('APPLICATION_RETRY_STORAGE_UNAVAILABLE')}
   if(!saved||!saved.key||(saved.completedAt&&intent.openedAt>saved.completedAt&&!intent.completed))saved={key:'APP-INTENT-'+crypto.randomUUID(),createdAt:Date.now()};
   try{localStorage.setItem(storageKey,JSON.stringify(saved));if(JSON.parse(localStorage.getItem(storageKey)||'null')?.key!==saved.key)throw new Error('WRITE_FAILED')}catch{throw new Error('APPLICATION_RETRY_STORAGE_UNAVAILABLE')}
   const payload={...body,[kind==='STANDARD'?'idempotencyKey':'idempotency_key']:saved.key};
   // Always ask the authenticated server, including retries. A local receipt is never business authority.
   const response=await request(kind==='STANDARD'?'/v1/client/applications':'/v1/events',{
    method:'POST',headers:{'content-type':'application/json','x-idempotency-key':saved.key},body:JSON.stringify(payload)});
   const receipt=response?.application||response;
   if(response?.ok!==true||receipt?.business_contract!==CONTRACT||receipt?.bundle_complete!==true||
    !/^.+-IN-[0-9]{4}-[0-9]{3,}$/.test(receipt?.application_id||'')||!receipt?.intake_id||!receipt?.durable_id)throw new Error('APPLICATION_DURABLE_RECEIPT_REQUIRED');
   saved.completedAt=Date.now();intent.completed=true;
   try{localStorage.setItem(storageKey,JSON.stringify(saved))}catch{throw new Error('APPLICATION_RETRY_STORAGE_UNAVAILABLE')}
   return receipt;
  });
 })();
 try{return await intent.inFlight}finally{intent.inFlight=null}
}
window.RonaApplicationIntentV2=Object.freeze({contract:CONTRACT,create,submit});
})();
