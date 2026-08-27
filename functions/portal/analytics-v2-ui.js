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

const CANONICAL_HOME_VISUAL_PATCH=String.raw`;(()=>{const old=document.getElementById('ronaAnalyticsCanonicalHomeVisualV1');if(old)old.remove();const s=document.createElement('style');s.id='ronaAnalyticsCanonicalHomeVisualV1';s.textContent=[
'#current-admin-main #page-analytics #rona-analytics-v2.an2{--an2-text-primary:#e8f1f6;--an2-text-secondary:#9eb3c1;--an2-heading:#dbe8ef;--an2-heading-soft:#bdd0db;--an2-cyan:#65d9ff;--an2-blue:#8db7ff;--an2-green:#8bdcb4;--an2-amber:#efc978;--an2-red:#ff8c97;color:var(--an2-text-primary)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head,html.rona-visual-v2 #current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head.rona-visual-hero{position:static!important;overflow:visible!important;display:flex!important;align-items:flex-start!important;justify-content:space-between!important;flex-wrap:wrap!important;gap:14px!important;min-height:0!important;margin:0!important;padding:16px!important;border:1px solid var(--line,rgba(255,255,255,.18))!important;border-radius:14px!important;background:transparent!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;color:inherit!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head .rona-visual-kicker{display:none!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head h1,#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head .rona-visual-title{display:block!important;visibility:visible!important;opacity:1!important;margin:0 0 6px!important;color:inherit!important;font-size:24px!important;line-height:1.2!important;font-weight:800!important;letter-spacing:0!important;text-transform:none!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head p,#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head .rona-visual-sub{max-width:900px!important;margin:0!important;color:var(--an2-text-secondary)!important;font-size:12px!important;line-height:1.5!important;opacity:1!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-owner-card,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-market-forecast{border:1px solid var(--line,rgba(255,255,255,.18))!important;border-radius:14px!important;background:transparent!important;box-shadow:none!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-market-forecast{padding:16px!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-owner-card>h2,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-mf-title,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-rona-head h2{color:var(--an2-heading)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-owner-card>h3,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-price-card h3{color:var(--an2-heading-soft)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-owner-kpi,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-price-base{color:var(--an2-cyan)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-owner-muted,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-mf-sub,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-mf-meta,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-basis,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-price-current,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-model-note{color:var(--an2-text-secondary)!important;opacity:1!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-chart{color:var(--an2-cyan)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-axis{fill:var(--an2-text-secondary)!important;opacity:.84!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-point-value{fill:#dff7ff!important;opacity:1!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-controls button{color:#c7d7e1!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-controls button[aria-pressed="true"]{color:var(--an2-cyan)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-mf-row span:first-child{color:var(--an2-text-secondary)!important;opacity:1!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-mf-row strong{color:#e6eef3!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-comment{color:#cbdbe5!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2>.rona-owner-card:last-child>h2{color:var(--an2-amber)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-fin-pill--info{color:var(--an2-blue)!important}#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-fin-pill--success{color:var(--an2-green)!important}#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-fin-pill--warn{color:var(--an2-amber)!important}#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-fin-pill--danger{color:var(--an2-red)!important}#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-fin-pill--neutral{color:var(--an2-text-secondary)!important}',
'@media(max-width:680px){#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head,html.rona-visual-v2 #current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head.rona-visual-hero{min-height:0!important;padding:14px!important;border-radius:14px!important}}'
].join('');document.head.append(s);window.__RONA_ANALYTICS_CANONICAL_HOME_VISUAL__='v1';})();`;

export async function onRequest(context){
  const response=await canonicalV3(context);
  let source=await response.text();
  if(!source.includes(GUARD_FROM)||!source.includes(ROOT_FROM)||!source.includes(BIND_FROM)){
    return new Response('ANALYTICS_CANONICAL_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.replace(GUARD_FROM,GUARD_TO).replace(ROOT_FROM,ROOT_TO).replace(BIND_FROM,BIND_TO);
  source=source.replace('Комментарий Коммерческого директора','Аналитический вывод');
  const outerClose=source.lastIndexOf('})();');
  if(outerClose<0){
    return new Response('ANALYTICS_LAYOUT_PATCH_POINT_MISSING',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.slice(0,outerClose)+BALANCED_LAYOUT_PATCH+CANONICAL_HOME_VISUAL_PATCH+source.slice(outerClose);

  const required=['20260824-analytics-v3-market-rona-bases-lpg','АИ-92','АИ-95','ДТ','LPG / СУГ','Platts','Argus','LOW','BASE','HIGH','Forward','Аналитический вывод','FACT / CALCULATION / FORECAST'];
  const forbidden=['Выводов','Рыночных сигналов','Аналитическая лента','Текущий опубликованный ориентир RONA Trade','Комментарий Коммерческого директора'];
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
  headers.set('x-rona-analytics-visual','home-canonical-frames-title-v1');
  headers.set('x-rona-analytics-typography','semantic-palette-v1');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
