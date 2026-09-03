import { readFile, writeFile } from 'node:fs/promises';

const runtimePath='assets/portal-runtime/client-contract-download-v3.js';
const buildPath='scripts/build-pages-direct-canonical.mjs';
let runtime=await readFile(runtimePath,'utf8');

function replaceOnce(from,to,label){
  if(!runtime.includes(from))throw new Error(`${label}_NOT_FOUND`);
  runtime=runtime.replace(from,to);
}

replaceOnce(
  "const MARK='20260904-client-contract-v6-company-alias-slot-removed';",
  "const MARK='20260904-client-contract-v7-company-first-paint';\nconst COMPANY_ALIAS_COMPAT='20260904-client-contract-v6-company-alias-slot-removed';",
  'COMPANY_FIRST_PAINT_MARKER'
);

replaceOnce(
  "const state={entry:null,loading:false,lastLoad:0,renderTimer:0,currentKey:'',observer:null,rendering:false,unsubscribe:null};",
  "const state={entry:null,loading:false,pendingImmediate:false,lastLoad:0,renderTimer:0,currentKey:'',observer:null,rendering:false,unsubscribe:null};",
  'COMPANY_FIRST_PAINT_STATE'
);

replaceOnce(
  "  if(state.loading)return;if(!force&&Date.now()-state.lastLoad<REFRESH_MS){render();return}state.loading=true;",
  "  if(state.loading){if(force)state.pendingImmediate=true;return}if(!force&&Date.now()-state.lastLoad<REFRESH_MS){render();return}state.loading=true;",
  'COMPANY_FIRST_PAINT_REFRESH_GUARD'
);

replaceOnce(
  "  }catch(error){console.error('RONA contract current-context projection',error)}finally{state.loading=false}\n}",
  "  }catch(error){console.error('RONA contract current-context projection',error)}finally{state.loading=false;if(state.pendingImmediate){state.pendingImmediate=false;queueMicrotask(()=>refresh(true))}}\n}",
  'COMPANY_FIRST_PAINT_REFRESH_FINALLY'
);

replaceOnce(
  "    const n=leafNodes(box).find(el=>el!==label&&/^\\d+$/.test(norm(el.textContent)));",
  "    const n=leafNodes(box).find(el=>el!==label&&/^(?:\\d+|—)$/.test(norm(el.textContent)));",
  'COMPANY_FIRST_PAINT_METRIC_PENDING'
);

const syncAnchor=`  return hidden>0;\n}\nfunction syncCompanyCard(entry,card){`;
const primeBlock=`  return hidden>0;\n}\nfunction primeCompanyDirectory(ctx){\n  if(!ctx)return false;const card=findCompanyCard(ctx);if(!card)return false;\n  const display=compactLegalName(ctx),external=norm(ctx.current_external_contract_number||ctx.contract_id),effective=formatDate(ctx.effective_from);\n  hideRedundantCompanyAlias(card);\n  for(const el of leafNodes(card)){\n    const before=norm(el.textContent),l=low(before);if(!before)continue;\n    if(/^RONA-C\\d{3}$/i.test(before)){setNodeText(el,ctx.client_id);continue}\n    if(/^RONA-C\\d{3}-CTR-\\d{4}-\\d{3,}$/i.test(before)){setNodeText(el,ctx.contract_id);continue}\n    if(/^контракт\\b/iu.test(before)&&!l.includes('подписанный контракт')&&!l.includes('скач')){setNodeText(el,'Контракт '+external+(effective?' · '+effective:''));continue}\n    if((/^(общество с |ооо\\b|осоо\\b|llc\\b)/iu.test(before)||/[«»]/u.test(before))&&!l.includes('контракт')&&!l.includes('договор')){setNodeText(el,display);continue}\n  }\n  const sameReady=card.dataset.ronaCompanyDirectoryHydration==='ready'&&norm(card.dataset.ronaClientContractId)===norm(ctx.contract_id);\n  if(!sameReady){\n    setMetric(card,'заявок','—');\n    setMetric(card,'сделок','—');\n    if(!setMetric(card,'действий','—','ДОКУМЕНТОВ'))setMetric(card,'документов','—');\n    card.dataset.ronaCompanyDirectoryHydration='pending';\n  }\n  card.dataset.ronaClientContractId=String(ctx.contract_id||'');card.dataset.ronaClientId=String(ctx.client_id||'');\n  return true;\n}\nfunction syncCompanyCard(entry,card){`;
replaceOnce(syncAnchor,primeBlock,'COMPANY_FIRST_PAINT_PRIME_BLOCK');

replaceOnce(
  "card.dataset.ronaClientContractId=String(ctx.contract_id||'');card.dataset.ronaClientId=String(ctx.client_id||'');card.dataset.ronaCompanyDirectorySource='client-context-api';card.dataset.ronaCompanyDirectoryUpdatedAt=new Date().toISOString();",
  "card.dataset.ronaClientContractId=String(ctx.contract_id||'');card.dataset.ronaClientId=String(ctx.client_id||'');card.dataset.ronaCompanyDirectorySource='client-context-api';card.dataset.ronaCompanyDirectoryHydration='ready';card.dataset.ronaCompanyDirectoryUpdatedAt=new Date().toISOString();",
  'COMPANY_FIRST_PAINT_READY_STATE'
);

const scheduleAnchor=`function scheduleRender(delay=120){clearTimeout(state.renderTimer);state.renderTimer=setTimeout(render,delay)}\nfunction startObserver(){`;
const scheduleBlock=`function scheduleRender(delay=120){clearTimeout(state.renderTimer);state.renderTimer=setTimeout(render,delay)}\nfunction primeFromAuthority(authority){const current=authority?.getCurrentContext?.();return current?primeCompanyDirectory(current):false}\nfunction refreshCompanyDirectoryNow(authority,delay=0){setTimeout(()=>{if(!primeFromAuthority(authority))return;refresh(true)},delay)}\nfunction startObserver(){`;
replaceOnce(scheduleAnchor,scheduleBlock,'COMPANY_FIRST_PAINT_SCHEDULER');

replaceOnce(
  "  if(typeof authority.subscribe==='function')state.unsubscribe=authority.subscribe(()=>refresh(true));",
  "  primeFromAuthority(authority);\n  if(typeof authority.subscribe==='function')state.unsubscribe=authority.subscribe(()=>{primeFromAuthority(authority);refresh(true)});",
  'COMPANY_FIRST_PAINT_SUBSCRIBE'
);

replaceOnce(
  "  window.addEventListener('rona:client-context-ready',()=>refresh(true));window.addEventListener('rona:client-context-changed',()=>refresh(true));\n  refresh(true);",
  "  window.addEventListener('rona:client-context-ready',()=>{primeFromAuthority(authority);refresh(true)});window.addEventListener('rona:client-context-changed',()=>{primeFromAuthority(authority);refresh(true)});\n  refresh(true);[120,350,900,1800,3200].forEach(delay=>refreshCompanyDirectoryNow(authority,delay));",
  'COMPANY_FIRST_PAINT_INITIAL_BURST'
);

replaceOnce(
  "  document.addEventListener('click',()=>scheduleRender(140),true);document.addEventListener('change',()=>scheduleRender(80),true);",
  "  document.addEventListener('click',()=>scheduleRender(140),true);document.addEventListener('click',()=>refreshCompanyDirectoryNow(authority,90),true);document.addEventListener('change',()=>{scheduleRender(80);refreshCompanyDirectoryNow(authority,20)},true);",
  'COMPANY_FIRST_PAINT_NAVIGATION'
);

replaceOnce(
  "  window.addEventListener('pageshow',()=>{scheduleRender(0);if(Date.now()-state.lastLoad>10000)refresh(true)});window.addEventListener('popstate',()=>scheduleRender(80));window.addEventListener('hashchange',()=>scheduleRender(80));setInterval(()=>{if(document.visibilityState==='visible')refresh(true)},REFRESH_MS);",
  "  window.addEventListener('pageshow',()=>{scheduleRender(0);refreshCompanyDirectoryNow(authority,0);if(Date.now()-state.lastLoad>10000)refresh(true)});window.addEventListener('popstate',()=>{scheduleRender(80);refreshCompanyDirectoryNow(authority,20)});window.addEventListener('hashchange',()=>{scheduleRender(80);refreshCompanyDirectoryNow(authority,20)});setInterval(()=>{if(document.visibilityState==='visible')refresh(true)},REFRESH_MS);",
  'COMPANY_FIRST_PAINT_HISTORY'
);

await writeFile(runtimePath,runtime,'utf8');

let build=await readFile(buildPath,'utf8');
const oldSrc='/assets/portal-runtime/client-contract-download-v3.js?v=20260904-company-directory-alias-v2';
const newSrc='/assets/portal-runtime/client-contract-download-v3.js?v=20260904-company-directory-first-paint-v1';
if(!build.includes(oldSrc))throw new Error('COMPANY_FIRST_PAINT_BUILD_SRC_NOT_FOUND');
build=build.replaceAll(oldSrc,newSrc);
await writeFile(buildPath,build,'utf8');

console.log('CLIENT_COMPANY_FIRST_PAINT_V1=PASS');
