import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT=process.cwd();
const OUT=join(ROOT,'dist','portal');
const read=path=>readFile(join(ROOT,...path.split('/')),'utf8');
const requireMarker=(text,marker,label)=>{if(!text.includes(marker))throw new Error(`${label}: missing ${marker}`)};

function extractFunctionRuntime(source,name){
  const start=source.indexOf(`function ${name}(){`);
  const endMarker=`\nconst SCRIPT='('+${name}.toString()+')();';`;
  const end=source.indexOf(endMarker,start);
  if(start<0||end<0)throw new Error(`STATIC_RUNTIME_EXTRACT_FAILED: ${name}`);
  const fn=source.slice(start,end).trim();
  return `(${fn})();\n`;
}
function extractRawScript(source,label){
  const startMarker='const SCRIPT=String.raw`';
  const start=source.indexOf(startMarker);
  const end=source.lastIndexOf('`;\nexport async function onRequest');
  if(start<0||end<0||end<=start)throw new Error(`STATIC_RUNTIME_EXTRACT_FAILED: ${label}`);
  return source.slice(start+startMarker.length,end)+'\n';
}
function stripLegacyOwnedSections(source){
  source=source.replaceAll("'аналитика':'analytics',",'');
  source=source.replaceAll("'новости топливного рынка снг':'news',",'');
  source=source.replaceAll(',.rona-rs-root[data-kind=\\"analytics\\"]','');
  source=source.replaceAll(',.rona-rs-root[data-kind=\\"news\\"]','');

  const start=source.indexOf('function publicationCard(){');
  const end=source.indexOf('function renderAgents(){',start);
  if(start<0||end<=start)throw new Error('STATIC_REMAINING_MARKET_SOURCE_MISMATCH');
  source=source.slice(0,start)+source.slice(end);

  source=source.replaceAll("if(kind==='analytics')return renderAnalytics();",'');
  source=source.replaceAll("if(kind==='news')return renderNews();",'');
  source=source.replaceAll("if(kind==='analytics'||kind==='news'){refreshMarket(true).then(()=>render(kind));return}",'');
  source=source.replaceAll("if(kind==='news'){refreshMarket(true).then(()=>render(kind));return}",'');

  for(const token of [
    "'аналитика':'analytics'",
    "'новости топливного рынка снг':'news'",
    'function renderAnalytics(){',
    'function renderNews(){',
    'function publicationCard(){',
    "kind==='analytics'",
    "root('analytics'",
    "root('news'",
    "kpi('Выводов'",
    'Аналитическая лента'
  ]){
    if(source.includes(token))throw new Error(`STATIC_REMAINING_LEGACY_MARKER: ${token}`);
  }
  return source;
}

async function materializeAnalyticsCurrent(){
  const moduleUrl=pathToFileURL(join(ROOT,'functions','portal','analytics-v2-ui.js'));
  moduleUrl.searchParams.set('materialize',String(Date.now()));
  const mod=await import(moduleUrl.href);
  if(typeof mod.onRequest!=='function')throw new Error('ANALYTICS_CURRENT_OWNER_MISSING');
  const response=await mod.onRequest({});
  const source=await response.text();
  if(!response.ok)throw new Error(`ANALYTICS_CURRENT_OWNER_HTTP_${response.status}: ${source.slice(0,180)}`);
  for(const token of [
    '20260824-analytics-v3-market-rona-bases-lpg','АИ-92','АИ-95','ДТ','LPG / СУГ','Platts','Argus',
    'LOW','BASE','HIGH','Forward','Аналитический вывод','FACT / CALCULATION / FORECAST',
    'rona-analytics-canonical-title','ronaAnalyticsDesignerChartV2'
  ])requireMarker(source,token,'current analytics static runtime');
  for(const token of ['Выводов','Рыночных сигналов','Аналитическая лента','Текущий опубликованный ориентир RONA Trade','Комментарий Коммерческого директора']){
    if(source.includes(token))throw new Error(`STATIC_ANALYTICS_LEGACY_MARKER: ${token}`);
  }
  return source;
}

await mkdir(OUT,{recursive:true});
const access=extractFunctionRuntime(await read('functions/portal/clients-agents-current-ui.js'),'currentUiRuntime');
const claims=extractRawScript(await read('functions/portal/claims-r2-ui.js'),'claims-r2-ui');
const newsBootstrap="(()=>{if(window.__RONA_MARKET_NEWS_CURRENT_LOADER__)return;window.__RONA_MARKET_NEWS_CURRENT_LOADER__='20260826-clean-rebuild-v1';const s=document.createElement('script');s.src='/assets/portal-market-news-current-v1.js?v=20260826-clean-rebuild-v1';s.defer=true;s.dataset.ronaMarketNewsLoader='clean-rebuild-v1';document.head.appendChild(s)})();\n";
const remaining=stripLegacyOwnedSections(extractRawScript(await read('functions/portal/remaining-sections-r2-base.js'),'remaining-sections-r2-base'))+newsBootstrap;
const analytics=await materializeAnalyticsCurrent();

for(const marker of [
  "window.__RONA_CLIENTS_AGENTS_CURRENT__='20260826-single-owner-v4'",
  'ronaCreateAccess','admin-authority','Тип доступа','Договоры клиента','Профиль агента','Роль пользователя',
  'openWithoutContract','История и права','Сменить пароль','Будет создан клиентский доступ по выбранным договорам.',
  'Будет создан доступ в кабинет агента.','Создать доступ'
])requireMarker(access,marker,'clients-agents static runtime');
for(const marker of ['__RONA_CLAIMS_R2_UI__','#page-claims','Зарегистрировать и направить клиенту'])requireMarker(claims,marker,'claims-r2-ui');
for(const marker of ['renderRewards','Вознаграждения агентов','Радиорубка','portal-market-news-current-v1.js','__RONA_MARKET_NEWS_CURRENT_LOADER__'])requireMarker(remaining,marker,'remaining sections static runtime');
for(const forbidden of ['Новости топливного рынка СНГ','function renderNews(){',"'новости топливного рынка снг':'news'"])if(remaining.includes(forbidden))throw new Error(`STATIC_REMAINING_NEWS_PRESENT: ${forbidden}`);
for(const forbidden of ['harvestLegacy','installNavigationStability','installShellParity'])if(access.includes(forbidden))throw new Error(`STATIC_ACCESS_FORBIDDEN_MARKER: ${forbidden}`);

await writeFile(join(OUT,'clients-agents-current-ui'),access);
await writeFile(join(OUT,'claims-r2-ui'),claims);
await writeFile(join(OUT,'remaining-sections-ui'),remaining);
await writeFile(join(OUT,'analytics-v2-ui'),analytics);

const headers=`/portal/clients-agents-current-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-v1\n  X-Rona-Clients-Agents-Ui: single-owner-v4\n  X-Rona-Access-Create: client-agent-v4\n  X-Rona-Admin-Nav-Owner: external-current-router-v2\n  X-Rona-Shell-Mutation: none\n  X-Rona-Legacy-Dependency: none\n\n/portal/claims-r2-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-v1\n  X-Rona-Claims-Ui: direction-workflow-v6\n\n/portal/remaining-sections-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-v2-no-analytics-no-news\n\n/portal/analytics-v2-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-current-owner\n  X-Rona-Analytics-Ui: canonical-v3-only\n  X-Rona-Analytics-Owner: canonical-v3-exclusive\n  X-Rona-Analytics-Layout: balanced-fluid-1520-v2\n  X-Rona-Analytics-Visual: home-canonical-frames-title-v1\n  X-Rona-Analytics-Typography: semantic-palette-v1\n  X-Rona-Analytics-Chart: designer-depth-v2\n`;
await writeFile(join(ROOT,'dist','_headers'),headers);
console.log(`ADMIN_CURRENT_STATIC_MODULES=PASS access=${Buffer.byteLength(access)} claims=${Buffer.byteLength(claims)} remaining=${Buffer.byteLength(remaining)} analytics=${Buffer.byteLength(analytics)} analyticsOwner=current-only newsOwner=dedicated-asset-v1`);