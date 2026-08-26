import { onRequest as canonicalV3 } from './analytics-v2-approved-base.js';

const GUARD_FROM="if(window.__RONA_ANALYTICS_V2__)return;";
const GUARD_TO="if(window.__RONA_ANALYTICS_CANONICAL_ONLY__===true&&document.getElementById('rona-analytics-v2'))return;window.__RONA_ANALYTICS_CANONICAL_ONLY__=true;";
const ROOT_FROM="function ensureRoot(){const p=page();if(!p)return null;style();let r=q('#rona-analytics-v2',p);if(!r){r=el('section','an2');r.id='rona-analytics-v2';p.insertBefore(r,p.firstChild)}for(const x of qa(':scope>*',p))if(x!==r){x.style.setProperty('display','none','important');x.setAttribute('aria-hidden','true')}return r}";
const ROOT_TO="function ensureRoot(){const p=page();if(!p)return null;style();let r=q('#rona-analytics-v2',p);if(!r){r=el('section','an2');r.id='rona-analytics-v2';p.insertBefore(r,p.firstChild)}for(const x of qa(':scope>*',p))if(x!==r)x.remove();return r}";
const BIND_FROM="function bind(){render();const p=page();if(p&&!p.__ronaAnalyticsV2Observer){p.__ronaAnalyticsV2Observer=true;new MutationObserver(()=>{const r=q('#rona-analytics-v2',p);if(!r)return;for(const x of qa(':scope>*',p))if(x!==r){x.style.setProperty('display','none','important');x.setAttribute('aria-hidden','true')}}).observe(p,{childList:true})}}";
const BIND_TO="function bind(){render();const p=page();if(p&&!p.__ronaAnalyticsV2Observer){p.__ronaAnalyticsV2Observer=true;new MutationObserver(()=>{const r=q('#rona-analytics-v2',p);if(!r)return;for(const x of qa(':scope>*',p))if(x!==r)x.remove()}).observe(p,{childList:true})}}";

export async function onRequest(context){
  const response=await canonicalV3(context);
  let source=await response.text();
  if(!source.includes(GUARD_FROM)||!source.includes(ROOT_FROM)||!source.includes(BIND_FROM)){
    return new Response('ANALYTICS_CANONICAL_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.replace(GUARD_FROM,GUARD_TO).replace(ROOT_FROM,ROOT_TO).replace(BIND_FROM,BIND_TO);

  const required=['20260824-analytics-v3-market-rona-bases-lpg','АИ-92','АИ-95','ДТ','LPG / СУГ','Platts','Argus','LOW','BASE','HIGH','Forward','Комментарий Коммерческого директора','FACT / CALCULATION / FORECAST'];
  const forbidden=['Выводов','Рыночных сигналов','Аналитическая лента','Текущий опубликованный ориентир RONA Trade'];
  if(required.some(token=>!source.includes(token))||forbidden.some(token=>source.includes(token))){
    return new Response('ANALYTICS_CANONICAL_VALIDATION_FAILED',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-analytics-ui','canonical-v3-only');
  headers.set('x-rona-analytics-owner','canonical-v3-exclusive');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
