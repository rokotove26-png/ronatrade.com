import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const analyticsRuntimePath='dist/assets/portal-runtime/client-market-intelligence-v1.js';
const newsRuntimePath='dist/assets/portal-runtime/client-market-news-admin-parity-v1.js';
const spacingRuntimePath='dist/assets/portal-runtime/client-analytics-forecast-spacing-v1.js';
const analyticsId='rona-client-market-intelligence-v1';
const analyticsSrc='/assets/portal-runtime/client-market-intelligence-v1.js?v=20260902-analytics-hourly-isolated-v4';
const analyticsMarker='20260902-client-market-intelligence-v2-admin-news-parity';
const newsId='rona-client-market-news-admin-parity-v1';
const newsSrc='/assets/portal-runtime/client-market-news-admin-parity-v1.js?v=20260902-news-dialog-single-owner-v5';
const newsMarker='20260902-admin-news-canonical-exact-v1';
const spacingId='rona-client-analytics-forecast-spacing-v1';
const spacingSrc='/assets/portal-runtime/client-analytics-forecast-spacing-v1.js?v=20260902-forecast-spacing-v2';
const spacingMarker='20260902-client-analytics-forecast-inner-spacing-v2';
const newsVisualContract='portal-market-news-current-v1/20260827-auto-refresh-v2';
const sha256=b=>createHash('sha256').update(b).digest('hex');
function replaceRequired(text,from,to,label){if(!text.includes(from))throw new Error(`${label}_PATCH_SOURCE_MISSING: ${from}`);return text.replace(from,to)}

let analyticsRuntime=await readFile(analyticsRuntimePath,'utf8');
for(const required of [analyticsMarker,'/v1/client/market-intelligence','RONA_CLIENT_MARKET_INTELLIGENCE_V1','public_chart','REFRESH_MS=3600000',"load('open')"])
  if(!analyticsRuntime.includes(required))throw new Error(`CLIENT_MARKET_INTELLIGENCE_RUNTIME_MISSING: ${required}`);
analyticsRuntime=replaceRequired(analyticsRuntime,"function cacheData(){const entry=window.__RONA_CLIENT_BACKGROUND_CACHE__?.[API_PATH];return entry?.ok&&entry?.body?.ok&&entry?.body?.data?entry.body.data:null}\n",'', 'ANALYTICS_BACKGROUND_CACHE');
analyticsRuntime=replaceRequired(analyticsRuntime,"  const cached=cacheData();if(cached)accept(cached,'background-cache');\n",'', 'ANALYTICS_LOAD_BACKGROUND_CACHE');
analyticsRuntime=replaceRequired(analyticsRuntime,"  const cached=cacheData();if(cached)accept(cached,'initial-cache');\n",'', 'ANALYTICS_INITIAL_BACKGROUND_CACHE');
analyticsRuntime=replaceRequired(analyticsRuntime,"  window.addEventListener('rona:client:background-sections',()=>{const c=cacheData();if(c)accept(c,'background-event')},{passive:true});\n","  document.addEventListener('rona:client:context-changed',()=>load('context-change'));\n",'ANALYTICS_BACKGROUND_EVENT');
for(const forbidden of ['rona:client:background-sections','__RONA_CLIENT_BACKGROUND_CACHE__','background-cache','background-event','REFRESH_MS=60000'])if(analyticsRuntime.includes(forbidden))throw new Error(`CLIENT_ANALYTICS_HOURLY_ISOLATION_FAILED: ${forbidden}`);
await writeFile(analyticsRuntimePath,analyticsRuntime,'utf8');

let newsRuntime=await readFile(newsRuntimePath,'utf8');
for(const required of [newsMarker,newsVisualContract,'#page-market-news>.rona-market-news-current','.mn-masthead','.mn-front','.mn-grid','.mn-dialog','/v1/client/market-intelligence','source_published_at','duplicate_group','AUTO_REFRESH_MS=3600000'])
  if(!newsRuntime.includes(required))throw new Error(`CLIENT_MARKET_NEWS_ADMIN_PARITY_RUNTIME_MISSING: ${required}`);
newsRuntime=replaceRequired(newsRuntime,"const STYLE_ID='rona-market-news-current-style';\nconst API_PATH='/v1/client/market-intelligence';","const STYLE_ID='rona-market-news-current-style';\nconst DIALOG_ID='rona-client-market-news-dialog';\nconst API_PATH='/v1/client/market-intelligence';",'NEWS_DIALOG_ID');
newsRuntime=replaceRequired(newsRuntime,"  if(root.parentElement!==p)p.replaceChildren(root);\n  else for(const child of Array.from(p.children))if(child!==root)child.remove();","  const dialog=document.getElementById(DIALOG_ID);\n  if(root.parentElement!==p){const keep=dialog?.parentElement===p?dialog:null;p.replaceChildren(root,...(keep?[keep]:[]))}\n  else for(const child of Array.from(p.children))if(child!==root&&child!==dialog)child.remove();",'NEWS_DIALOG_HOST_PRESERVE');
newsRuntime=replaceRequired(newsRuntime,"function openArticle(x){\n  const root=ensureRoot();\n  if(!root)return;\n  let d=q('.mn-dialog',root);\n  if(!d){d=el('dialog',{class:'mn-dialog'});root.append(d)}\n  const close=el('button',{type:'button',class:'mn-dialog-close','aria-label':'Закрыть',text:'×',onclick:()=>d.close()});\n  const head=el('div',{class:'mn-dialog-head'},el('div',{},el('span',{class:'mn-kicker',text:'RONA Market Intelligence'}),el('h2',{text:headline(x)})),close);\n  const meta=el('div',{class:'mn-dialog-meta',text:metaText(x)});\n  const body=el('div',{class:'mn-dialog-body',text:bodyText(x)||'Текст материала отсутствует.'});\n  const actions=el('div',{class:'mn-dialog-actions'});\n  const url=sourceUrl(x);\n  if(url)actions.append(el('a',{class:'mn-source-link',href:url,target:'_blank',rel:'noopener noreferrer',text:'Открыть первоисточник · '+sourceName(x)}));\n  d.replaceChildren(head,meta,body,actions);\n  if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');\n}","function openArticle(x){\n  const root=ensureRoot(),p=page();\n  if(!root||!p)return;\n  const old=document.getElementById(DIALOG_ID);\n  if(old)old.remove();\n  const d=el('dialog',{id:DIALOG_ID,class:'mn-dialog'});\n  d.addEventListener('close',()=>d.remove(),{once:true});\n  const close=el('button',{type:'button',class:'mn-dialog-close','aria-label':'Закрыть',text:'×',onclick:()=>d.close()});\n  const head=el('div',{class:'mn-dialog-head'},el('div',{},el('span',{class:'mn-kicker',text:'RONA Market Intelligence'}),el('h2',{text:headline(x)})),close);\n  const meta=el('div',{class:'mn-dialog-meta',text:metaText(x)});\n  const body=el('div',{class:'mn-dialog-body',text:bodyText(x)||'Текст материала отсутствует.'});\n  const actions=el('div',{class:'mn-dialog-actions'});\n  const url=sourceUrl(x);\n  if(url)actions.append(el('a',{class:'mn-source-link',href:url,target:'_blank',rel:'noopener noreferrer',text:'Открыть первоисточник · '+sourceName(x)}));\n  d.replaceChildren(head,meta,body,actions);\n  p.append(d);\n  if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');\n}",'NEWS_DIALOG_OUTSIDE_RENDER_ROOT');
newsRuntime=replaceRequired(newsRuntime,"  if(root.querySelector('.mn-dialog[open]'))return true;\n",'', 'NEWS_DIALOG_ROOT_GUARD');
newsRuntime=replaceRequired(newsRuntime,"function refreshIfActive(){if(document.visibilityState==='visible'&&isActive())loadData(true)}","function refreshHourly(){if(document.visibilityState==='visible')loadData(true)}",'NEWS_ACTIVE_ONLY_TIMER');
newsRuntime=replaceRequired(newsRuntime,"function startAutoRefresh(){if(autoRefreshTimer)return;autoRefreshTimer=setInterval(refreshIfActive,AUTO_REFRESH_MS)}","function startAutoRefresh(){if(autoRefreshTimer)return;autoRefreshTimer=setInterval(refreshHourly,AUTO_REFRESH_MS)}",'NEWS_TIMER_OWNER');
newsRuntime=replaceRequired(newsRuntime,"function consumeBackground(){const data=cachedData();if(data&&acceptData(data))render()}\n",'', 'NEWS_BACKGROUND_CACHE_CONSUMER');
newsRuntime=replaceRequired(newsRuntime,"function activate(){ensureRoot();startAutoRefresh();consumeBackground();render()}","function activate(){ensureRoot();startAutoRefresh();render()}",'NEWS_ACTIVATE_BACKGROUND');
newsRuntime=replaceRequired(newsRuntime,"  ensureRoot();startAutoRefresh();consumeBackground();loadData(true);\n  window.addEventListener('focus',consumeBackground,{passive:true});\n  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')consumeBackground()});\n  window.addEventListener('rona:client:background-sections',consumeBackground,{passive:true});\n","  ensureRoot();startAutoRefresh();loadData(true);\n  document.addEventListener('rona:client:context-changed',()=>loadData(true));\n",'NEWS_START_BACKGROUND');
newsRuntime=replaceRequired(newsRuntime,"  document.addEventListener('click',ev=>{const n=ev.target?.closest?.('a,button,[data-page],[data-page-id],[role=\"tab\"]');const text=String(n?.textContent||'').toLocaleLowerCase('ru-RU');if(text.includes('новост')||String(n?.getAttribute?.('data-page')||'').includes('market-news'))setTimeout(activate,0)},true);","  document.addEventListener('click',ev=>{if(ev.target?.closest?.('#page-market-news'))return;const n=ev.target?.closest?.('a,button,[data-page],[data-page-id],[role=\"tab\"]');const text=String(n?.textContent||'').toLocaleLowerCase('ru-RU');if(text.includes('новост')||String(n?.getAttribute?.('data-page')||'').includes('market-news'))setTimeout(activate,0)},true);",'NEWS_NAV_CLICK_SCOPE');
for(const forbidden of ['rona:client:background-sections','consumeBackground','refreshIfActive','AUTO_REFRESH_MS=60000'])if(newsRuntime.includes(forbidden))throw new Error(`CLIENT_NEWS_HOURLY_ISOLATION_FAILED: ${forbidden}`);
if(!newsRuntime.includes('setInterval(refreshHourly,AUTO_REFRESH_MS)'))throw new Error('CLIENT_NEWS_HOURLY_TIMER_MISSING');
if(!newsRuntime.includes("if(ev.target?.closest?.('#page-market-news'))return"))throw new Error('CLIENT_NEWS_NAV_CLICK_SCOPE_MISSING');
if(!newsRuntime.includes("id:DIALOG_ID,class:'mn-dialog'")||!newsRuntime.includes('p.append(d)'))throw new Error('CLIENT_NEWS_DIALOG_ISOLATION_MISSING');
await writeFile(newsRuntimePath,newsRuntime,'utf8');

const spacingRuntime=await readFile(spacingRuntimePath,'utf8');
for(const required of [spacingMarker,'.an2-market-forecast',"PADDING='16px 18px'",'contentDocument','ronaClientForecastSpacing'])if(!spacingRuntime.includes(required))throw new Error(`CLIENT_ANALYTICS_FORECAST_SPACING_MISSING: ${required}`);

let html=await readFile(htmlPath,'utf8');
html=html.replace(/<script\b[^>]*\bsrc=(['"])[^'"]*\/assets\/portal-market-news-current-v1\.js(?:\?[^'"]*)?\1[^>]*>\s*<\/script>/gi,'');
if(html.includes('portal-market-news-current-v1.js'))throw new Error('CLIENT_COMPETING_MARKET_NEWS_RUNTIME_PRESENT');
for(const token of [analyticsId,'client-market-intelligence-v1.js',newsId,'client-market-news-admin-parity-v1.js',spacingId,'client-analytics-forecast-spacing-v1.js'])if(html.includes(token))throw new Error(`CLIENT_MARKET_INTELLIGENCE_ALREADY_PRESENT: ${token}`);
const close=html.toLowerCase().lastIndexOf('</body>');if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
const bridges=`<script id="${analyticsId}" src="${analyticsSrc}" defer></script><script id="${newsId}" src="${newsSrc}" defer></script><script id="${spacingId}" src="${spacingSrc}" defer></script>`;
html=html.slice(0,close)+bridges+html.slice(close);await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.market_intelligence={
  id:analyticsId,src:analyticsSrc,marker:analyticsMarker,mode:'ADMIN_PRINCIPLE_CLIENT_SAFE_PROJECTION',endpoint:'/portal/api/v1/client/market-intelligence',trigger:'PORTAL_OPEN',refresh_ms:3600000,refresh_policy:'OPEN_THEN_HOURLY',background_preload_dependency:false,background_30s_event_dependency:false,
  sections:['analytics','market-news'],analytics_gate:'PUBLISHED_VERIFIED_DISTRIBUTION_ALLOWED_CLIENT_SCOPE_PUBLIC_CHART_ONLY',news_gate:'PUBLISHED_VERIFIED_DISTRIBUTION_ALLOWED_CLIENT_SCOPE_AUTHORITATIVE_SOURCE_DATE_7_CALENDAR_DATES_DEDUP',authoritative_news_date:'source_published_at',news_window_calendar_dates:7,deduplication:'duplicate_group_then_news_id_then_publication_item_id',
  news_visual_owner:'ADMIN_MARKET_NEWS_CANONICAL_EXACT_V1',news_visual_contract:newsVisualContract,news_owner_asset:newsSrc,news_dom_contract:['mn-masthead','mn-front','mn-lead','mn-rail-item','mn-grid','mn-dialog'],news_visual_parity:'EXACT_ADMIN_RENDERER_DOM_CSS_TEXT',competing_client_news_renderer:false,news_dialog_host:'PAGE_SIBLING_OUTSIDE_RENDER_ROOT',
  analytics_forecast_spacing:{id:spacingId,src:spacingSrc,marker:spacingMarker,selector:'.an2-market-forecast',padding:'16px 18px',same_origin_iframe_aware:true,visual_scope:'INNER_SPACING_ONLY'},
  raw_internal_benchmarks_exposed:false,business_mutation:false,read_only:true
};
await writeFile(integrityPath,JSON.stringify(integrity),'utf8');
for(const token of [`id="${analyticsId}"`,analyticsSrc,`id="${newsId}"`,newsSrc,`id="${spacingId}"`,spacingSrc])if(!html.includes(token))throw new Error(`CLIENT_MARKET_INTELLIGENCE_BRIDGE_MISSING_AFTER_WRITE: ${token}`);
console.log('CLIENT_MARKET_INTELLIGENCE_ATTACH=PASS Analytics and Market News fetch on portal open and every 3600000ms only; Client News has one renderer; article dialog is outside the replaceable render root; article-content clicks cannot reactivate News');