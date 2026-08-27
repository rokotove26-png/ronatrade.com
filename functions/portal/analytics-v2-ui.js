import { onRequest as canonicalV3 } from './analytics-v2-approved-base.js';

const GUARD_FROM="if(window.__RONA_ANALYTICS_V2__)return;";
const GUARD_TO="if(window.__RONA_ANALYTICS_CANONICAL_ONLY__==='balanced-fluid-1520-v2'&&document.getElementById('rona-analytics-v2'))return;window.__RONA_ANALYTICS_CANONICAL_ONLY__='balanced-fluid-1520-v2';";
const ROOT_FROM="function ensureRoot(){const p=page();if(!p)return null;style();let r=q('#rona-analytics-v2',p);if(!r){r=el('section','an2');r.id='rona-analytics-v2';p.insertBefore(r,p.firstChild)}for(const x of qa(':scope>*',p))if(x!==r){x.style.setProperty('display','none','important');x.setAttribute('aria-hidden','true')}return r}";
const ROOT_TO="function ensureRoot(){const p=page();if(!p)return null;style();let r=q('#rona-analytics-v2',p);if(!r){r=el('section','an2');r.id='rona-analytics-v2';p.insertBefore(r,p.firstChild)}for(const x of qa(':scope>*',p))if(x!==r)x.remove();return r}";
const BIND_FROM="function bind(){render();const p=page();if(p&&!p.__ronaAnalyticsV2Observer){p.__ronaAnalyticsV2Observer=true;new MutationObserver(()=>{const r=q('#rona-analytics-v2',p);if(!r)return;for(const x of qa(':scope>*',p))if(x!==r){x.style.setProperty('display','none','important');x.setAttribute('aria-hidden','true')}}).observe(p,{childList:true})}}";
const BIND_TO="function bind(){render();const p=page();if(p&&!p.__ronaAnalyticsV2Observer){p.__ronaAnalyticsV2Observer=true;new MutationObserver(()=>{const r=q('#rona-analytics-v2',p);if(!r)return;for(const x of qa(':scope>*',p))if(x!==r)x.remove()}).observe(p,{childList:true})}}";

const BALANCED_LAYOUT_PATCH=String.raw`;(()=>{const old=document.getElementById('ronaAnalyticsBalancedLayoutV1');if(old)old.remove();if(document.getElementById('ronaAnalyticsBalancedLayoutV2'))return;const s=document.createElement('style');s.id='ronaAnalyticsBalancedLayoutV2';s.textContent=[
'#page-analytics #rona-analytics-v2.an2{width:min(100%,1520px)!important;max-width:1520px!important;margin-left:auto!important;margin-right:auto!important;gap:14px!important;padding:0 clamp(10px,1vw,18px) 20px!important;box-sizing:border-box!important}',
'#page-analytics #rona-analytics-v2 .an2-head{gap:14px!important}#page-analytics #rona-analytics-v2 .an2-head p{max-width:780px!important}',
'#page-analytics #rona-analytics-v2 .an2-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important;min-width:0!important}',
'#page-analytics #rona-analytics-v2 .an2-main{grid-template-columns:minmax(0,1.52fr) minmax(330px,.78fr)!important;gap:14px!important;align-items:stretch!important;min-width:0!important}',
'#page-analytics #rona-analytics-v2 .an2-chart{min-height:360px!important}#page-analytics #rona-analytics-v2 .an2-chart svg{height:310px!important}',
'#page-analytics #rona-analytics-v2 .an2-market-forecast{height:100%!important;box-sizing:border-box!important}',
'#page-analytics #rona-analytics-v2 .an2-rona{gap:10px!important}#page-analytics #rona-analytics-v2 .an2-rona-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important;min-width:0!important}',
'#page-analytics #rona-analytics-v2 .an2-price-card{min-width:0!important}#page-analytics #rona-analytics-v2 .an2-price-base{font-size:22px!important}',
'@media(max-width:1280px){#page-analytics #rona-analytics-v2.an2{width:100%!important;max-width:none!important}#page-analytics #rona-analytics-v2 .an2-main{grid-template-columns:minmax(0,1.45fr) minmax(300px,.72fr)!important}}',
'@media(max-width:1050px){#page-analytics #rona-analytics-v2 .an2-main{grid-template-columns:1fr!important}#page-analytics #rona-analytics-v2 .an2-chart{min-height:340px!important}#page-analytics #rona-analytics-v2 .an2-chart svg{height:295px!important}#page-analytics #rona-analytics-v2 .an2-rona-grid{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))!important}}',
'@media(max-width:680px){#page-analytics #rona-analytics-v2.an2{padding-left:0!important;padding-right:0!important}#page-analytics #rona-analytics-v2 .an2-kpis{grid-template-columns:1fr!important}#page-analytics #rona-analytics-v2 .an2-rona-grid{grid-template-columns:1fr!important}#page-analytics #rona-analytics-v2 .an2-chart svg{height:270px!important}}'
].join('');document.head.append(s)})();`;

export async function onRequest(context){
  const response=await canonicalV3(context);
  let source=await response.text();
  if(!source.includes(GUARD_FROM)||!source.includes(ROOT_FROM)||!source.includes(BIND_FROM)){
    return new Response('ANALYTICS_CANONICAL_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.replace(GUARD_FROM,GUARD_TO).replace(ROOT_FROM,ROOT_TO).replace(BIND_FROM,BIND_TO);
  const outerClose=source.lastIndexOf('})();');
  if(outerClose<0){
    return new Response('ANALYTICS_LAYOUT_PATCH_POINT_MISSING',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.slice(0,outerClose)+BALANCED_LAYOUT_PATCH+source.slice(outerClose);

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
  headers.set('x-rona-analytics-layout','balanced-fluid-1520-v2');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
