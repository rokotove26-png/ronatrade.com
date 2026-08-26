import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT=process.cwd();
const OUT=join(ROOT,'dist','portal');
const ASSETS=join(ROOT,'dist','assets');
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

await mkdir(OUT,{recursive:true});
await mkdir(ASSETS,{recursive:true});
const access=extractFunctionRuntime(await read('functions/portal/clients-agents-current-ui.js'),'currentUiRuntime');
const claims=extractRawScript(await read('functions/portal/claims-r2-ui.js'),'claims-r2-ui');
const remaining=extractRawScript(await read('functions/portal/remaining-sections-ui.js'),'remaining-sections-ui');
const recovery=await read('assets/admin-four-sections-recovery-v1.js');
const analyticsOwner=await read('assets/admin-approved-analytics-owner-v1.js');
const navOwner=await read('assets/admin-current-nav-owner-guard-v1.js');
const accessVisibility=await read('assets/admin-access-full-visibility-v1.js');

for(const marker of ["window.__RONA_CLIENTS_AGENTS_CURRENT__='20260826-single-owner-v3'",'ronaCreateAccess','admin-authority','Тип доступа','Договоры клиента','Профиль агента','Будет создан доступ клиента по выбранным договорам.','Будет создан доступ в кабинет агента.','Создать доступ'])requireMarker(access,marker,'clients-agents static runtime');
for(const marker of ['__RONA_CLAIMS_R2_UI__','#page-claims','Зарегистрировать и направить клиенту'])requireMarker(claims,marker,'claims static runtime');
for(const marker of ['renderRewards','Вознаграждения агентов'])requireMarker(remaining,marker,'remaining sections static runtime');
for(const marker of ['__RONA_ADMIN_FOUR_SECTIONS_RECOVERY__','RETIRED_STANDARD_AGENT_PRICE_LIST','rail-current-stable-ui','analytics-v2-ui','Открыть без контракта','Загрузить договор','Единый логин','Роль привязки'])requireMarker(recovery,marker,'four sections recovery runtime');
for(const marker of ['__RONA_APPROVED_ANALYTICS_OWNER_GUARD__','rona-analytics-v2','approved-v2','MutationObserver'])requireMarker(analyticsOwner,marker,'approved analytics owner guard');
for(const marker of ['__RONA_ADMIN_CURRENT_NAV_OWNER_GUARD__','stopImmediatePropagation','__RONA_ADMIN_NAVIGATE__'])requireMarker(navOwner,marker,'current navigation owner guard');
for(const marker of ['__RONA_ACCESS_FULL_VISIBILITY_GUARD__','Единый логин','Электронная почта','data-rona-access-field'])requireMarker(accessVisibility,marker,'full access semantics guard');
for(const forbidden of ['harvestLegacy','installNavigationStability','installShellParity'])if(access.includes(forbidden))throw new Error(`STATIC_ACCESS_FORBIDDEN_MARKER: ${forbidden}`);

await writeFile(join(OUT,'clients-agents-current-ui'),access);
await writeFile(join(OUT,'claims-r2-ui'),claims);
await writeFile(join(OUT,'remaining-sections-ui'),remaining);
await writeFile(join(ASSETS,'admin-four-sections-recovery-v1.js'),recovery);
await writeFile(join(ASSETS,'admin-approved-analytics-owner-v1.js'),analyticsOwner);
await writeFile(join(ASSETS,'admin-current-nav-owner-guard-v1.js'),navOwner);
await writeFile(join(ASSETS,'admin-access-full-visibility-v1.js'),accessVisibility);

const adminPath=join(OUT,'admin.html');
let admin=await readFile(adminPath,'utf8');
const recoveryTag='<script id="rona-admin-four-sections-recovery" src="/assets/admin-four-sections-recovery-v1.js?v=20260826-v1" defer></script>';
const analyticsOwnerTag='<script id="rona-admin-approved-analytics-owner" src="/assets/admin-approved-analytics-owner-v1.js?v=20260826-v1" defer></script>';
const navOwnerTag='<script id="rona-admin-current-nav-owner-guard" src="/assets/admin-current-nav-owner-guard-v1.js?v=20260826-v1" defer></script>';
const accessVisibilityTag='<script id="rona-admin-access-full-visibility" src="/assets/admin-access-full-visibility-v1.js?v=20260826-v1" defer></script>';
const anchor='<script id="rona-admin-fast-shell-runtime"';
if(!admin.includes(anchor))throw new Error('ADMIN_RECOVERY_INJECTION_ANCHOR_MISSING');
const tags=[recoveryTag,analyticsOwnerTag,navOwnerTag,accessVisibilityTag].filter(tag=>!admin.includes(tag.match(/id="([^"]+)/)?.[1]||tag));
if(tags.length){admin=admin.replace(anchor,tags.join('\n')+'\n'+anchor);await writeFile(adminPath,admin)}
requireMarker(admin,'rona-admin-four-sections-recovery','built admin recovery loader');
requireMarker(admin,'rona-admin-approved-analytics-owner','built approved analytics owner loader');
requireMarker(admin,'rona-admin-current-nav-owner-guard','built current navigation owner guard');
requireMarker(admin,'rona-admin-access-full-visibility','built full access semantics loader');

const headers=`/portal/clients-agents-current-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-v1\n  X-Rona-Clients-Agents-Ui: single-owner-v3\n  X-Rona-Access-Create: client-agent-v3\n  X-Rona-Admin-Nav-Owner: external-current-router-v2\n  X-Rona-Shell-Mutation: none\n  X-Rona-Legacy-Dependency: none\n\n/portal/claims-r2-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-v1\n  X-Rona-Claims-Ui: direction-workflow-v6\n\n/portal/remaining-sections-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-v1\n\n/assets/admin-four-sections-recovery-v1.js\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Admin-Recovery: prices-rail-access-analytics-v1\n\n/assets/admin-approved-analytics-owner-v1.js\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Analytics-Owner: approved-v2\n\n/assets/admin-current-nav-owner-guard-v1.js\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Admin-Nav-Owner: current-only-router-v2-exclusive\n\n/assets/admin-access-full-visibility-v1.js\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Access-Semantics: full-current-v1\n`;
await writeFile(join(ROOT,'dist','_headers'),headers);
console.log(`ADMIN_CURRENT_STATIC_MODULES=PASS access=${Buffer.byteLength(access)} claims=${Buffer.byteLength(claims)} remaining=${Buffer.byteLength(remaining)} recovery=${Buffer.byteLength(recovery)} analyticsOwner=${Buffer.byteLength(analyticsOwner)} navOwner=${Buffer.byteLength(navOwner)} accessVisibility=${Buffer.byteLength(accessVisibility)}`);