import { readFile } from 'node:fs/promises';
import path from 'node:path';

const HTML_PATH='dist/portal/client.html';
const MARK='CLIENT_IDLE_NETWORK_SCAN_V1';
const ARCHITECT_DEFERRED=new Set();

const html=await readFile(HTML_PATH,'utf8');
const srcs=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/giu)]
  .map(m=>m[1])
  .filter(Boolean);

const resolved=[];
for(const src of [...new Set(srcs)]){
  let pathname=src;
  try{pathname=new URL(src,'https://ronaoil.com').pathname}catch{}
  if(!pathname.endsWith('.js'))continue;
  if(!pathname.includes('/assets/portal-runtime/'))continue;
  const rel=pathname.replace(/^\//,'');
  resolved.push({src,rel,base:path.posix.basename(rel)});
}

const all=[];
for(const item of resolved){
  let body='';
  try{body=await readFile(path.join('dist',item.rel),'utf8')}catch(error){
    all.push({...item,missing:true,error:String(error?.code||error?.message||error)});
    continue;
  }
  const interval=(body.match(/\bsetInterval\s*\(/g)||[]).length;
  const timeout=(body.match(/\bsetTimeout\s*\(/g)||[]).length;
  const raf=(body.match(/\brequestAnimationFrame\s*\(/g)||[]).length;
  const fetches=(body.match(/\bfetch\s*\(/g)||[]).length;
  const xhr=(body.match(/\bXMLHttpRequest\b/g)||[]).length;
  const eventSource=(body.match(/\bEventSource\b/g)||[]).length;
  const webSocket=(body.match(/\bWebSocket\b/g)||[]).length;
  const network=fetches+xhr+eventSource+webSocket;
  const recurringNetwork=interval>0&&network>0;
  all.push({...item,missing:false,interval,timeout,raf,fetches,xhr,eventSource,webSocket,network,recurringNetwork,architectDeferred:ARCHITECT_DEFERRED.has(item.base)});
}

const inlineBlocks=[...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/giu)].map((m,i)=>({i,body:m[1]||''}));
const inline=inlineBlocks.map(({i,body})=>({
  index:i,
  interval:(body.match(/\bsetInterval\s*\(/g)||[]).length,
  timeout:(body.match(/\bsetTimeout\s*\(/g)||[]).length,
  fetches:(body.match(/\bfetch\s*\(/g)||[]).length,
  xhr:(body.match(/\bXMLHttpRequest\b/g)||[]).length
})).filter(x=>x.interval||x.timeout||x.fetches||x.xhr);

const recurring=all.filter(x=>!x.missing&&x.interval>0);
const recurringNetwork=all.filter(x=>!x.missing&&x.recurringNetwork);
const blocking=recurringNetwork.filter(x=>!x.architectDeferred);
const deferred=recurringNetwork.filter(x=>x.architectDeferred);

console.log(MARK+'=REPORT '+JSON.stringify({
  activePortalRuntimeScripts:all.length,
  recurringTimerAssets:recurring.map(x=>({base:x.base,interval:x.interval,network:x.network,architectDeferred:x.architectDeferred})),
  recurringNetworkBlocking:blocking.map(x=>({base:x.base,interval:x.interval,fetches:x.fetches,xhr:x.xhr,eventSource:x.eventSource,webSocket:x.webSocket})),
  recurringNetworkArchitectDeferred:deferred.map(x=>({base:x.base,interval:x.interval,fetches:x.fetches,xhr:x.xhr,eventSource:x.eventSource,webSocket:x.webSocket})),
  inline
}));

if(all.some(x=>x.missing))throw new Error('CLIENT_IDLE_NETWORK_SCAN_ACTIVE_ASSET_MISSING');
if(recurringNetwork.length){
  throw new Error('CLIENT_IDLE_NETWORK_SCAN_RECURRING_NETWORK='+recurringNetwork.map(x=>x.base).join(','));
}
console.log(MARK+'=PASS recurring_network=0 architect_deferred=0 active_runtime_scripts='+all.length);
