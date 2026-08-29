import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT=process.cwd(),OUT=join(ROOT,'dist','portal');
const read=path=>readFile(join(ROOT,...path.split('/')),'utf8');
const requireMarker=(text,marker,label)=>{if(!text.includes(marker))throw new Error(`${label}: missing ${marker}`)};

function extractFunctionRuntime(source,name){
  const start=source.indexOf(`function ${name}(){`),endMarker=`\nconst SCRIPT='('+${name}.toString()+')();`,end=source.indexOf(endMarker,start);
  if(start<0||end<0)throw new Error(`STATIC_RUNTIME_EXTRACT_FAILED: ${name}`);
  return `(${source.slice(start,end).trim()})();\n`;
}
function extractRawScript(source,label){
  const mark='const SCRIPT=String.raw`',start=source.indexOf(mark),end=source.lastIndexOf('`;\nexport async function onRequest');
  if(start<0||end<0||end<=start)throw new Error(`STATIC_RUNTIME_EXTRACT_FAILED: ${label}`);
  return source.slice(start+mark.length,end)+'\n';
}
function stripLegacyOwnedSections(source){
  source=source.replaceAll("'аналитика':'analytics',",'').replaceAll("'новости топливного рынка снг':'news',",'').replaceAll(',.rona-rs-root[data-kind=\\"analytics\\"]','').replaceAll(',.rona-rs-root[data-kind=\\"news\\"]','');
  const start=source.indexOf('function publicationCard(){'),end=source.indexOf('function renderAgents(){',start);
  if(start<0||end<=start)throw new Error('STATIC_REMAINING_MARKET_SOURCE_MISMATCH');
  source=source.slice(0,start)+source.slice(end);
  source=source.replaceAll("if(kind==='analytics')return renderAnalytics();",'').replaceAll("if(kind==='news')return renderNews();",'').replaceAll("if(kind==='analytics'||kind==='news'){refreshMarket(true).then(()=>render(kind));return}",'').replaceAll("if(kind==='news'){refreshMarket(true).then(()=>render(kind));return}",'');
  for(const token of ["'аналитика':'analytics'","'новости топливного рынка снг':'news'",'function renderAnalytics(){','function renderNews(){','function publicationCard(){',"kind==='analytics'","root('analytics'","root('news'","kpi('Выводов'",'Аналитическая лента'])if(source.includes(token))throw new Error(`STATIC_REMAINING_LEGACY_MARKER: ${token}`);
  return source;
}
async function materializeAnalyticsCurrent(){
  const moduleUrl=pathToFileURL(join(ROOT,'functions','portal','analytics-v2-ui.js'));moduleUrl.searchParams.set('materialize',String(Date.now()));
  const mod=await import(moduleUrl.href);if(typeof mod.onRequest!=='function')throw new Error('ANALYTICS_CURRENT_OWNER_MISSING');
  const response=await mod.onRequest({}),source=await response.text();if(!response.ok)throw new Error(`ANALYTICS_CURRENT_OWNER_HTTP_${response.status}: ${source.slice(0,180)}`);
  for(const token of ['approved-v4.3.2-pricing-bridge-single-owner','RONA_Admin_LK_LOCAL_v4_3_2_Analytics_PricingBridge_Ready_Local.html','RONA TRADE · ANALYTICS','Внутренний аналитический контур','Базовая котировка','АИ-92','АИ-95','ДТ','LPG / СУГ','Platts LPG / СУГ','Petromarket · DAP benchmark','1075.25','1226.75','DATA-DRIVEN','FACT / CALCULATION / FORECAST','Возможные цены RONA Trade','Аналитический вывод','function pricingBridgeFor','function calculateRonaScenario',"version:'functional-v4.3.2'",'setPricingBridge','rona:analytics-price-model'])requireMarker(source,token,'canonical analytics static runtime');
  for(const token of ['live-market-intelligence-v2','owner-bootstrap-v2','/portal/api/v1/admin/analytics','LIVE DATA','РАЗРЫВ ДАННЫХ','rona-analytics-canonical-title','ronaAnalyticsCanonicalHomeVisualV1','home-canonical-frames-title-v1','LPG Hairatan','Hairatan / Petromarket / Platts propane ref','Комментарий Коммерческого директора','Аналитическая лента'])if(source.includes(token))throw new Error(`STATIC_ANALYTICS_STALE_MARKER: ${token}`);
  if(response.headers.get('x-rona-analytics-ui')!=='approved-v4.3.2-pricing-bridge-single-owner')throw new Error('CANONICAL_ANALYTICS_UI_HEADER_MISSING');
  if(response.headers.get('x-rona-analytics-owner')!=='approved-v432-exclusive')throw new Error('CANONICAL_ANALYTICS_OWNER_HEADER_MISSING');
  if(response.headers.get('x-rona-analytics-source-file')!=='RONA_Admin_LK_LOCAL_v4_3_2_Analytics_PricingBridge_Ready_Local.html')throw new Error('CANONICAL_ANALYTICS_SOURCE_FILE_HEADER_MISSING');
  if(response.headers.get('x-rona-analytics-visual')!=='approved-hero-v432-pricing-bridge')throw new Error('CANONICAL_ANALYTICS_VISUAL_HEADER_MISSING');
  if(response.headers.get('x-rona-analytics-chart')!=='designer-v3-shared-gasoline-axis')throw new Error('CANONICAL_ANALYTICS_CHART_HEADER_MISSING');
  return source;
}

await mkdir(OUT,{recursive:true});
const access=extractFunctionRuntime(await read('functions/portal/clients-agents-current-ui.js'),'currentUiRuntime');
const claims=extractRawScript(await read('functions/portal/claims-r2-ui.js'),'claims-r2-ui');
const newsBootstrap="(()=>{if(window.__RONA_MARKET_NEWS_CURRENT_LOADER__)return;window.__RONA_MARKET_NEWS_CURRENT_LOADER__='20260826-clean-rebuild-v1';const s=document.createElement('script');s.src='/assets/portal-market-news-current-v1.js?v=20260826-clean-rebuild-v1';s.defer=true;s.dataset.ronaMarketNewsLoader='clean-rebuild-v1';document.head.appendChild(s)})();\n";
const remaining=stripLegacyOwnedSections(extractRawScript(await read('functions/portal/remaining-sections-r2-base.js'),'remaining-sections-r2-base'))+newsBootstrap;
const analytics=await materializeAnalyticsCurrent();
const canonicalTweaks=await read('functions/portal/admin-canonical-tweaks-ui.js');
for(const forbidden of ['analyticsFix','#rona-analytics-v2'])if(canonicalTweaks.includes(forbidden))throw new Error(`ANALYTICS_EXTERNAL_MUTATOR_PRESENT: ${forbidden}`);
for(const marker of ["window.__RONA_CLIENTS_AGENTS_CURRENT__='20260828-single-owner-v5'","window.__RONA_ACCESS_CURRENT_OWNER__='clients-agents-current-v5'","window.__RONA_ACCESS_FUNCTIONAL_BUILD__='single-owner-create-user-v6-20260828'",'ronaCreateAccess','admin-authority','Тип доступа','Роль пользователя','Ф.И.О. пользователя','Единый логин','Электронная почта','Пароль','Повторите пароль','Разрешённые компании / контракты','Профиль агента','openWithoutContract','История и права','Сменить пароль','Создать пользователя',"await mutate('/access/users',payload)"])requireMarker(access,marker,'clients-agents static runtime');
for(const forbidden of ['openCanonicalAccessModal','installCanonicalAccessCreate','approved-canonical-v3.4.13','admin-canonical-create-access-v441-ui','rona-approved-access-mask','rona-canonical-access-mask'])if(access.includes(forbidden))throw new Error(`STATIC_ACCESS_COMPETING_OWNER_MARKER: ${forbidden}`);
for(const marker of ['__RONA_CLAIMS_R2_UI__','#page-claims','Зарегистрировать и направить клиенту'])requireMarker(claims,marker,'claims-r2-ui');
for(const marker of ['renderRewards','Вознаграждения агентов','Радиорубка','portal-market-news-current-v1.js','__RONA_MARKET_NEWS_CURRENT_LOADER__'])requireMarker(remaining,marker,'remaining sections static runtime');
for(const forbidden of ['Новости топливного рынка СНГ','function renderNews(){',"'новости топливного рынка снг':'news'"])if(remaining.includes(forbidden))throw new Error(`STATIC_REMAINING_NEWS_PRESENT: ${forbidden}`);
for(const forbidden of ['harvestLegacy','installNavigationStability','installShellParity'])if(access.includes(forbidden))throw new Error(`STATIC_ACCESS_FORBIDDEN_MARKER: ${forbidden}`);
await writeFile(join(OUT,'clients-agents-current-ui'),access);await writeFile(join(OUT,'claims-r2-ui'),claims);await writeFile(join(OUT,'remaining-sections-ui'),remaining);await writeFile(join(OUT,'analytics-v2-ui'),analytics);
const headers=`/portal/clients-agents-current-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-v1\n  X-Rona-Clients-Agents-Ui: single-owner-v5\n  X-Rona-Access-Create: single-owner-create-user-v6\n  X-Rona-Access-Create-Owner: clients-agents-current-v5\n  X-Rona-Admin-Nav-Owner: external-current-router-v2\n  X-Rona-Shell-Mutation: none\n  X-Rona-Legacy-Dependency: none\n\n/portal/claims-r2-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-v1\n  X-Rona-Claims-Ui: direction-workflow-v6\n\n/portal/remaining-sections-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-v2-no-analytics-no-news\n\n/portal/analytics-v2-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-canonical-v432-single-owner\n  X-Rona-Analytics-Ui: approved-v4.3.2-pricing-bridge-single-owner\n  X-Rona-Analytics-Owner: approved-v432-exclusive\n  X-Rona-Analytics-Source-File: RONA_Admin_LK_LOCAL_v4_3_2_Analytics_PricingBridge_Ready_Local.html\n  X-Rona-Analytics-Layout: approved-hero-balanced-1520-v432\n  X-Rona-Analytics-Visual: approved-hero-v432-pricing-bridge\n  X-Rona-Analytics-Chart: designer-v3-shared-gasoline-axis\n`;
await writeFile(join(ROOT,'dist','_headers'),headers);
console.log(`ADMIN_CURRENT_STATIC_MODULES=PASS access=${Buffer.byteLength(access)} claims=${Buffer.byteLength(claims)} remaining=${Buffer.byteLength(remaining)} analytics=${Buffer.byteLength(analytics)} accessOwner=clients-agents-current-v5 analyticsOwner=approved-v432-exclusive analyticsSource=RONA_Admin_LK_LOCAL_v4_3_2_Analytics_PricingBridge_Ready_Local.html newsOwner=dedicated-asset-v1`);
