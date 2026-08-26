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

await mkdir(OUT,{recursive:true});
const access=extractFunctionRuntime(await read('functions/portal/clients-agents-current-ui.js'),'currentUiRuntime');
const claims=extractRawScript(await read('functions/portal/claims-r2-ui.js'),'claims-r2-ui');
const remaining=extractRawScript(await read('functions/portal/remaining-sections-ui.js'),'remaining-sections-ui');

for(const marker of ["window.__RONA_CLIENTS_AGENTS_CURRENT__='20260826-single-owner-v3'",'ronaCreateAccess','admin-authority','Тип доступа','Договоры клиента','Профиль агента','Будет создан доступ клиента по выбранным договорам.','Будет создан доступ в кабинет агента.','Создать доступ'])requireMarker(access,marker,'clients-agents static runtime');
for(const marker of ['__RONA_CLAIMS_R2_UI__','#page-claims','Зарегистрировать и направить клиенту'])requireMarker(claims,marker,'claims static runtime');
for(const marker of ['renderRewards','Вознаграждения агентов'])requireMarker(remaining,marker,'remaining sections static runtime');
for(const forbidden of ['harvestLegacy','installNavigationStability','installShellParity'])if(access.includes(forbidden))throw new Error(`STATIC_ACCESS_FORBIDDEN_MARKER: ${forbidden}`);

await writeFile(join(OUT,'clients-agents-current-ui'),access);
await writeFile(join(OUT,'claims-r2-ui'),claims);
await writeFile(join(OUT,'remaining-sections-ui'),remaining);

const headers=`/portal/clients-agents-current-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-v1\n  X-Rona-Clients-Agents-Ui: single-owner-v3\n  X-Rona-Access-Create: client-agent-v3\n  X-Rona-Admin-Nav-Owner: external-current-router-v2\n  X-Rona-Shell-Mutation: none\n  X-Rona-Legacy-Dependency: none\n\n/portal/claims-r2-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-v1\n  X-Rona-Claims-Ui: direction-workflow-v6\n\n/portal/remaining-sections-ui\n  Content-Type: application/javascript; charset=utf-8\n  Cache-Control: no-store, no-cache, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n  X-Content-Type-Options: nosniff\n  X-Rona-Delivery: static-build-v1\n`;
await writeFile(join(ROOT,'dist','_headers'),headers);
console.log(`ADMIN_CURRENT_STATIC_MODULES=PASS access=${Buffer.byteLength(access)} claims=${Buffer.byteLength(claims)} remaining=${Buffer.byteLength(remaining)}`);
