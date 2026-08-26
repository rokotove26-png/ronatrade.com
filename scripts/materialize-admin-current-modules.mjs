import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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
function stripLegacyAnalytics(source){
  source=source.replaceAll("'аналитика':'analytics',",'');
  source=source.replaceAll(',.rona-rs-root[data-kind=\\"analytics\\"]','');
  const start=source.indexOf('function publicationCard(){');
  const end=source.indexOf('function renderNews(){',start);
  if(start<0||end<=start)throw new Error('STATIC_REMAINING_ANALYTICS_SOURCE_MISMATCH');
  source=source.slice(0,start)+source.slice(end);
  source=source.replace("if(kind==='analytics')return renderAnalytics();",'');
  source=source.replace("if(kind==='analytics'||kind==='news')","if(kind==='news')");
  for(const token of ["'аналитика':'analytics'",'function renderAnalytics(){','function publicationCard(){',"kind==='analytics'",'data-kind=\\"analytics\\"',"kpi('Выводов'",'Аналитическая лента']){
    if(source.includes(token))throw new Error(`STATIC_REMAINING_LEGACY_ANALYTICS_PRESENT: ${token}`);
  }
  return source;
}
function canonicalizeAnalytics(source){
  const guardFrom="if(window.__RONA_ANALYTICS_V2__)return;";
  const guardTo="if(window.__RONA_ANALYTICS_CANONICAL_ONLY__===true&&document.getElementById('rona-analytics-v2'))return;window.__RONA_ANALYTICS_CANONICAL_ONLY__=true;";
  const rootFrom="function ensureRoot(){const p=page();if(!p)return null;style();let r=q('#rona-analytics-v2',p);if(!r){r=el('section','an2');r.id='rona-analytics-v2';p.insertBefore(r,p.firstChild)}for(const x of qa(':scope>*',p))if(x!==r){x.style.setProperty('display','none','important');x.setAttribute('aria-hidden','true')}return r}";
  const rootTo="function ensureRoot(){const p=page();if(!p)return null;style();let r=q('#rona-analytics-v2',p);if(!r){r=el('section','an2');r.id='rona-analytics-v2';p.insertBefore(r,p.firstChild)}for(const x of qa(':scope>*',p))if(x!==r)x.remove();return r}";
  const bindFrom="function bind(){render();const p=page();if(p&&!p.__ronaAnalyticsV2Observer){p.__ronaAnalyticsV2Observer=true;new MutationObserver(()=>{const r=q('#rona-analytics-v2',p);if(!r)return;for(const x of qa(':scope>*',p))if(x!==r){x.style.setProperty('display','none','important');x.setAttribute('aria-hidden','true')}}).observe(p,{childList:true})}}";
  const bindTo="function bind(){render();const p=page();if(p&&!p.__ronaAnalyticsV2Observer){p.__ronaAnalyticsV2Observer=true;new MutationObserver(()=>{const r=q('#rona-analytics-v2',p);if(!r)return;for(const x of qa(':scope>*',p))if(x!==r)x.remove()}).observe(p,{childList:true})}}";
  if(!source.includes(guardFrom)||!source.includes(rootFrom)||!source.includes(bindFrom))throw new Error('STATIC_ANALYTICS_CANONICAL_SOURCE_MISMATCH');
  source=source.replace(guardFrom,guardTo).replace(rootFrom,rootTo).replace(bindFrom,bindTo);
  for(const token of ['20260824-analytics-v3-market-rona-bases-lpg','АИ-92','АИ-95','ДТ','LPG / СУГ','Platts','Argus','LOW','BASE','HIGH','Forward','Комментарий Коммерческого директора','FACT / CALCULATION / FORECAST'])requireMarker(source,token,'canonical analytics static runtime');
  for(const token of ['Выводов','Рыночных сигналов','Аналитическая лента','Текущий опубликованный ориентир RONA Trade'])if(source.includes(token))throw new Error(`STATIC_ANALYTICS_LEGACY_MARKER: ${token}`);
  return source;
}

await mkdir(OUT,{recursive:true});
const access=extractFunctionRuntime(await read('functions/portal/clients-agents-current-ui.js'),'currentUiRuntime');
const claims=extractRawScript(await read('functions/portal/claims-r2-ui.js'),'claims-r2-ui');
const remaining=stripLegacyAnalytics(extractRawScript(await read('functions/portal/remaining-sections-r2-base.js'),'remaining-sections-r2-base'));
const analytics=canonicalizeAnalytics(extractRawScript(await read('functions/portal/analytics-v2-approved-base.js'),'analytics-v2-approved-base'));

for(const marker of [
  "window.__RONA_CLIENTS_AGENTS_CURRENT__='20260826-single-owner-v4'",
  'ronaCreateAccess','admin-authority','Тип доступа','Договоры клиента','Профиль агента','Роль пользователя',
  'openWithoutContract','История и права','Сменить пароль','Будет создан клиентский доступ по выбранным договорам.',
  'Будет создан доступ в кабинет агента.','Создать доступ'
])requireMarker(access,marker,'clients-agents static runtime');
for(const marker of ['__RONA_CLAIMS_R2_UI__','#page-claims','Зарегистрировать и направить клиенту'])requireMarker(claims,marker,'claims-r2-ui');
for(const marker of ['renderRewards','Вознаграждения агентов','Радиорубка','Новости топливного рынка СНГ'])requireMarker(remaining,marker,'remaining sections static runtime');
for(const forbidden of ['harvestLegacy','installNavigationStability','installShellParity'])if(access.includes(forbidden))throw new Error(`STATIC_ACCESS_FORBIDDEN_MARKER: ${forbidden}`);

await writeFile(join(OUT,'clients-agents-current-ui'),access);
await writeFile(join(OUT,'claims-r2-ui'),claims);
await writeFile(join(OUT,'remaining-sections-ui'),remaining);
await writeFile(join(OUT,'analytics-v2-ui'),analytics);

const headers=`/portal/clients-agents-current-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-v1\n  X-Rona-Clients-Agents-Ui: single-owner-v4\n  X-Rona-Access-Create: client-agent-v4\n  X-Rona-Admin-Nav-Owner: external-current-router-v2\n  X-Rona-Shell-Mutation: none\n  X-Rona-Legacy-Dependency: none\n\n/portal/claims-r2-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Claims-Ui: direction-workflow-v6\n\n/portal/remaining-sections-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-v1-no-analytics\n\n/portal/analytics-v2-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-v1\n  X-Rona-Analytics-Ui: canonical-v3-only\n  X-Rona-Analytics-Owner: canonical-v3-exclusive\n`;
await writeFile(join(ROOT,'dist','_headers'),headers);
console.log(`ADMIN_CURRENT_STATIC_MODULES=PASS access=${Buffer.byteLength(access)} claims=${Buffer.byteLength(claims)} remaining=${Buffer.byteLength(remaining)} analytics=${Buffer.byteLength(analytics)}`);
