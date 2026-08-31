import { onRequest as coreOnRequest } from './_middleware-core.js';

const CLIENT_SERVER_TENANT_GUARD = `<script id="rona-client-server-tenant-guard-v1">(()=>{'use strict';
const MARK='20260901-client-server-tenant-context-v1';
if(window.__RONA_CLIENT_SERVER_TENANT_GUARD__===MARK)return;
window.__RONA_CLIENT_SERVER_TENANT_GUARD__=MARK;
if(location.pathname!=='/portal/client')return;
const BOOT='/portal/api/v1/client/bootstrap';
const nativeFetch=window.fetch.bind(window);
const state={contexts:[],single:null,loading:null,ready:false,observer:null,syncing:false,queued:false,eventSent:false};
const norm=v=>String(v??'').replace(/\\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('ru-RU').replaceAll('ё','е');
const CLIENT_RE=/\\bRONA-C\\d{3}\\b/g;
const CONTRACT_RE=/\\bRONA-C\\d{3}-CTR-\\d{4}-\\d{3,}\\b/g;
const d=document.documentElement;
d.dataset.ronaClientTenantReady='0';
d.dataset.ronaClientTenantState='checking';
function attr(el,name,value){if(el&&el.getAttribute(name)!==value)el.setAttribute(name,value)}
function clean(c){return c&&typeof c==='object'?{client_id:norm(c.client_id),legal_name:norm(c.legal_name),contract_id:norm(c.contract_id),current_external_contract_number:norm(c.current_external_contract_number),contract_status:norm(c.contract_status)}:null}
function valid(c){return !!(c&&c.client_id&&c.contract_id&&c.legal_name)}
function expose(){
  const contexts=state.contexts.map(c=>Object.freeze({...c}));
  const value=Object.freeze({schema:'RONA_CLIENT_SERVER_CONTEXT/1.0',source:'SERVER_SESSION_AUTHORITY',contexts:Object.freeze(contexts),single_context:state.single?Object.freeze({...state.single}):null});
  try{Object.defineProperty(window,'RONA_CLIENT_SERVER_CONTEXT',{value,writable:false,configurable:false,enumerable:false})}catch(_){window.RONA_CLIENT_SERVER_CONTEXT=value}
}
function companyLike(t){const v=low(t);if(v.length<14||v.length>260)return false;if(v==='kompaniya / kontrakt'||v==='компания / контракт'||v==='компания'||v==='контракт')return false;if(v.includes('выбрана компания')||v.includes('текущая компания')||v.includes('активный контекст')||v.includes('контракт №')||v.includes('договор №'))return false;return /(ооо|осоо|общество|совместное предприятие|топливная компания|llc|limited|company|«|»)/iu.test(t)}
function contextScopes(){
  const out=[];
  const labels=[...document.querySelectorAll('body *')].filter(el=>el.childElementCount===0&&/^(выбрана компания|текущая компания|активный контекст)$/iu.test(norm(el.textContent)));
  for(const label of labels){let node=label;for(let i=0;node&&node!==document.body&&i<8;i++,node=node.parentElement){const text=norm(node.textContent);if(text.length>=20&&text.length<=1800){out.push(node);break}}}
  const select=document.getElementById('clientContextSelect');
  if(select){let node=select;for(let i=0;node&&node!==document.body&&i<6;i++,node=node.parentElement){const text=norm(node.textContent);if(text.length>=20&&text.length<=1800){out.push(node);break}}}
  return [...new Set(out)];
}
function syncSelect(ctx){
  const select=document.getElementById('clientContextSelect');
  if(!select)return;
  const label=ctx.legal_name+(ctx.current_external_contract_number?' · '+ctx.current_external_contract_number:'');
  const current=select.options.length===1&&norm(select.options[0]?.value)===ctx.contract_id&&norm(select.options[0]?.textContent)===label;
  if(!current){const option=new Option(label,ctx.contract_id,true,true);select.replaceChildren(option)}
  if(select.value!==ctx.contract_id)select.value=ctx.contract_id;
  attr(select,'data-client-id',ctx.client_id);
  attr(select,'data-contract-id',ctx.contract_id);
  attr(select,'data-rona-context-source','server-session-authority');
}
function syncScope(scope,ctx){
  if(!scope)return;
  attr(scope,'data-client-id',ctx.client_id);
  attr(scope,'data-contract-id',ctx.contract_id);
  attr(scope,'data-rona-context-source','server-session-authority');
  const leaves=[...scope.querySelectorAll('*')].filter(el=>el.childElementCount===0);
  let company=null,companyScore=-1;
  for(const leaf of leaves){
    const before=norm(leaf.textContent);if(!before)continue;
    const after=before.replace(CONTRACT_RE,ctx.current_external_contract_number||ctx.contract_id).replace(CLIENT_RE,ctx.client_id);
    if(after!==before)leaf.textContent=after;
    if(companyLike(before)){
      let score=before.length;if(/[«»]/u.test(before))score+=300;if(/(ооо|осоо|общество|совместное предприятие|llc|limited)/iu.test(before))score+=200;
      if(score>companyScore){company=leaf;companyScore=score}
    }
  }
  if(company&&norm(company.textContent)!==ctx.legal_name)company.textContent=ctx.legal_name;
}
function sync(){
  if(state.syncing||!state.single||!document.body)return;
  state.syncing=true;
  try{
    const ctx=state.single;
    syncSelect(ctx);
    for(const scope of contextScopes())syncScope(scope,ctx);
    d.dataset.ronaClientTenantReady='1';
    d.dataset.ronaClientTenantState='bound';
    d.dataset.ronaClientId=ctx.client_id;
    d.dataset.ronaContractId=ctx.contract_id;
    if(!state.eventSent){state.eventSent=true;window.dispatchEvent(new CustomEvent('rona:client-server-context-ready',{detail:{client_id:ctx.client_id,contract_id:ctx.contract_id,source:'SERVER_SESSION_AUTHORITY'}}))}
  }finally{state.syncing=false}
}
function schedule(){if(state.queued)return;state.queued=true;requestAnimationFrame(()=>{state.queued=false;sync()})}
function publish(raw){
  const contexts=(Array.isArray(raw)?raw:[]).map(clean).filter(valid);
  if(!contexts.length)return false;
  state.contexts=contexts;state.single=contexts.length===1?contexts[0]:null;state.ready=true;
  expose();
  d.dataset.ronaClientTenantState=state.single?'bound':'selection-required';
  if(state.single)schedule();else d.dataset.ronaClientTenantReady='1';
  return true;
}
async function capture(response){
  try{if(!response?.ok)return;const body=await response.clone().json();if(body?.ok!==false)publish(body?.data?.contexts)}catch(_){ }
}
function sameOriginClient(raw){try{const u=new URL(raw,location.origin);return u.origin===location.origin&&u.pathname.startsWith('/portal/api/v1/client/')?u:null}catch{return null}}
function rawInput(input){if(typeof input==='string')return input;if(input instanceof URL)return input.href;if(input&&typeof input.url==='string')return input.url;return''}
async function ensure(){
  if(state.ready)return state.contexts;
  if(state.loading)return state.loading;
  state.loading=(async()=>{const response=await nativeFetch(BOOT,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});if(!response.ok)throw new Error('CLIENT_BOOTSTRAP_HTTP_'+response.status);const body=await response.json();if(body?.ok===false||!publish(body?.data?.contexts))throw new Error('CLIENT_CONTEXT_NOT_AUTHORIZED');return state.contexts})().catch(error=>{d.dataset.ronaClientTenantState='error';console.error('RONA client tenant guard',error);throw error}).finally(()=>{state.loading=null});
  return state.loading;
}
window.fetch=async function(input,init){
  const raw=rawInput(input),url=sameOriginClient(raw);
  if(!url)return nativeFetch(input,init);
  if(url.pathname==='/portal/api/v1/client/bootstrap'){
    const response=await nativeFetch(input,init);capture(response);return response;
  }
  const rewriteable=typeof input==='string'||input instanceof URL;
  if(rewriteable&&(url.searchParams.has('clientId')||url.searchParams.has('contractId'))){
    if(!state.single)await ensure().catch(()=>{});
    if(state.single){url.searchParams.set('clientId',state.single.client_id);url.searchParams.set('contractId',state.single.contract_id);const next=raw.startsWith('http://')||raw.startsWith('https://')?url.href:url.pathname+url.search+url.hash;return nativeFetch(next,init)}
  }
  return nativeFetch(input,init);
};
function startObserver(){if(state.observer||!document.body)return;state.observer=new MutationObserver(()=>schedule());state.observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['value','data-client-id','data-contract-id']});schedule()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{startObserver();schedule()},{once:true});else startObserver();
ensure().then(()=>{startObserver();schedule()}).catch(()=>{});
})();<\/script>`;
const CLIENT_CANONICAL_PREPAINT = `<style id="rona-client-canonical-prepaint-v5">html[data-rona-client-canon-ready="0"] body,html[data-rona-client-tenant-ready="0"] body{visibility:hidden!important}</style><script id="rona-client-canonical-prepaint-boot-v5">(()=>{const d=document.documentElement;d.dataset.ronaClientCanonReady='0';setTimeout(()=>{if(d.dataset.ronaClientCanonReady!=='1')d.dataset.ronaClientCanonReady='1'},3000)})();<\/script>`;
const CLIENT_DEAL_CANONICAL_VISUAL_RUNTIME = `<script id="rona-client-deal-canonical-visual-v2-loader" src="/assets/portal-runtime/client-deal-canonical-visual-v2.js?v=20260829-v5-canonical-compact-v2" defer><\/script>`;
const CLIENT_ADMIN_SYNC_RUNTIME = `${CLIENT_SERVER_TENANT_GUARD}${CLIENT_CANONICAL_PREPAINT}<script id="rona-client-single-logout-loader-v3" src="/assets/portal-runtime/client-shell-guard-v3.js?v=20260829-bounded-role-v3" defer><\/script><script id="rona-client-contract-download-v3-loader" src="/assets/portal-runtime/client-contract-download-v3.js?v=20260829-authoritative-context-v3-2" defer><\/script><script id="rona-client-deal-documents-v5-loader" src="/assets/portal-runtime/client-deal-documents-v5.js?v=20260829-role-canonical-v5" defer><\/script>${CLIENT_DEAL_CANONICAL_VISUAL_RUNTIME}<script id="rona-client-price-sync-bounded-loader" src="/assets/portal-runtime/client-price-sync-v1.js?v=20260829-bounded-context-v7" defer><\/script>`;
const OSM_TILE_ORIGIN='https://tile.openstreetmap.org';

class ClientAdminSyncHeadInjector {
  element(el) {
    el.append(CLIENT_ADMIN_SYNC_RUNTIME,{html:true});
  }
}

function allowClientRailTileCsp(headers){
  const csp=String(headers.get('content-security-policy')||'');
  if(!csp||csp.includes(OSM_TILE_ORIGIN))return;
  const marker="img-src 'self' data: blob:;";
  if(csp.includes(marker))headers.set('content-security-policy',csp.replace(marker,`img-src 'self' data: blob: ${OSM_TILE_ORIGIN};`));
}

export async function onRequest(context) {
  const response=await coreOnRequest(context);
  const url=new URL(context.request.url);
  if(url.pathname!=='/portal/client')return response;
  const contentType=String(response.headers.get('content-type')||'').toLowerCase();
  if(response.status!==200||!contentType.includes('text/html'))return response;

  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('x-rona-client-admin-sync','role-v3-contract-authoritative-deal-v5-canonical-compact-v2-source-no-standalone-documents-price-bounded');
  headers.set('x-rona-client-tenant-context','server-session-authority-v1');
  allowClientRailTileCsp(headers);

  if(typeof HTMLRewriter==='function'){
    const base=new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    return new HTMLRewriter().on('head',new ClientAdminSyncHeadInjector()).transform(base);
  }

  const source=await response.text();
  if(source.includes('rona-client-server-tenant-guard-v1'))return new Response(source,{status:response.status,statusText:response.statusText,headers});
  const html=source.replace('</head>',CLIENT_ADMIN_SYNC_RUNTIME+'</head>');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}
