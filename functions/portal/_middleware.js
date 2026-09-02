import { onRequest as coreOnRequest } from './_middleware-core.js';

const CLIENT_SERVER_TENANT_GUARD = `<script id="rona-client-server-tenant-guard-v1">(()=>{'use strict';
const MARK='20260902-client-server-tenant-context-v3-nonblocking-model-bind';
if(window.__RONA_CLIENT_SERVER_TENANT_GUARD__===MARK)return;
window.__RONA_CLIENT_SERVER_TENANT_GUARD__=MARK;
if(location.pathname!=='/portal/client')return;
const BOOT='/portal/api/v1/client/bootstrap';
const nativeFetch=window.fetch.bind(window);
const state={contexts:[],single:null,loading:null,ready:false,observer:null,syncing:false,queued:false,eventSent:false,modelBound:false};
const norm=v=>String(v??'').replace(/\\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('ru-RU').replaceAll('ё','е');
const CLIENT_RE=/\\bRONA-C\\d{3}\\b/g;
const CONTRACT_RE=/\\bRONA-C\\d{3}-CTR-\\d{4}-\\d{3,}\\b/g;
const d=document.documentElement;
d.dataset.ronaClientTenantReady='0';
d.dataset.ronaClientTenantState='checking';
function attr(el,name,value){if(el&&el.getAttribute(name)!==value)el.setAttribute(name,value)}
function clean(c){return c&&typeof c==='object'?{client_id:norm(c.client_id),legal_name:norm(c.legal_name),registration_country:norm(c.registration_country),registered_address:norm(c.registered_address),contact_phone:norm(c.contact_phone),contract_id:norm(c.contract_id),current_external_contract_number:norm(c.current_external_contract_number),contract_status:norm(c.contract_status),effective_from:norm(c.effective_from),effective_to:norm(c.effective_to)}:null}
function valid(c){return !!(c&&c.client_id&&c.contract_id&&c.legal_name)}
function expose(){
  const contexts=state.contexts.map(c=>Object.freeze({...c}));
  const value=Object.freeze({schema:'RONA_CLIENT_SERVER_CONTEXT/1.0',source:'SERVER_SESSION_AUTHORITY',contexts:Object.freeze(contexts),single_context:state.single?Object.freeze({...state.single}):null});
  try{if(!Object.prototype.hasOwnProperty.call(window,'RONA_CLIENT_SERVER_CONTEXT'))Object.defineProperty(window,'RONA_CLIENT_SERVER_CONTEXT',{value,writable:false,configurable:false,enumerable:false})}catch(_){ }
}
function companyLike(t){const v=low(t);if(v.length<14||v.length>260)return false;if(v==='kompaniya / kontrakt'||v==='компания / контракт'||v==='компания'||v==='контракт')return false;if(v.includes('выбрана компания')||v.includes('текущая компания')||v.includes('активный контекст')||v.includes('контракт №')||v.includes('договор №'))return false;return /(ооо|осоо|общество|совместное предприятие|топливная компания|llc|limited|company|«|»)/iu.test(t)}
function isKg(ctx){const country=low(ctx?.registration_country);return country.includes('кыргыз')||country.includes('киргиз')||country.includes('kyrgyz')||country==='kg'||country==='kgz'}
function companyDisplayName(ctx){
  const legal=norm(ctx?.legal_name);if(!legal)return norm(ctx?.client_id)||'Компания';
  const direct=['ОсОО','ООО','ПАО','НАО','АО','ЗАО','ОАО','ОДО','ИП','LLC'];
  for(const form of direct)if(legal===form||legal.startsWith(form+' '))return legal;
  const legalLow=low(legal);
  const forms=[
    ['общество с ограниченной ответственностью',isKg(ctx)?'ОсОО':'ООО'],
    ['общество с дополнительной ответственностью','ОДО'],
    ['публичное акционерное общество','ПАО'],
    ['непубличное акционерное общество','АО'],
    ['закрытое акционерное общество','ЗАО'],
    ['открытое акционерное общество','ОАО'],
    ['акционерное общество','АО'],
    ['индивидуальный предприниматель','ИП'],
    ['limited liability company','LLC']
  ];
  for(const [full,short] of forms){if(legalLow===full||legalLow.startsWith(full+' ')){const rest=legal.slice(full.length).trim();return rest?short+' '+rest:short}}
  return legal;
}
function blankShape(value,depth=0){
  if(depth>5)return null;
  if(Array.isArray(value))return[];
  if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value))out[k]=blankShape(v,depth+1);return out}
  if(typeof value==='boolean')return false;
  if(typeof value==='number')return 0;
  return'';
}
function serverModel(ctx,template){
  const out=blankShape(template&&typeof template==='object'?template:{})||{};
  const active=String(ctx.contract_status||'').toUpperCase()==='ACTIVE';
  Object.assign(out,{id:ctx.client_id,clientId:ctx.client_id,client_id:ctx.client_id,company:ctx.legal_name,legalName:ctx.legal_name,legal_name:ctx.legal_name,registrationCountry:ctx.registration_country,registration_country:ctx.registration_country,registeredAddress:ctx.registered_address,registered_address:ctx.registered_address,contactPhone:ctx.contact_phone,contact_phone:ctx.contact_phone,contractId:ctx.contract_id,contract_id:ctx.contract_id,contractNo:ctx.current_external_contract_number,current_external_contract_number:ctx.current_external_contract_number,contractDate:ctx.effective_from,effective_from:ctx.effective_from,effective_to:ctx.effective_to,contractStatus:ctx.contract_status,contract_status:ctx.contract_status,status:active?'Действует':(ctx.contract_status||'Требует проверки'),contractStateBlocked:!active});
  for(const k of ['applications','deals','payments','shipments','documents','rail','claims','notifications','messages','actions','prices'])if(!Array.isArray(out[k]))out[k]=[];
  return out;
}
function bindCanonicalModel(ctx){
  if(state.modelBound)return true;
  try{
    if(typeof CLIENT_CONTEXTS==='undefined'||!Array.isArray(CLIENT_CONTEXTS))return false;
    const existing=CLIENT_CONTEXTS.find(c=>norm(c?.contractId||c?.contract_id)===ctx.contract_id&&norm(c?.id||c?.clientId||c?.client_id)===ctx.client_id);
    const next=existing||serverModel(ctx,CLIENT_CONTEXTS[0]||{});
    Object.assign(next,{id:ctx.client_id,clientId:ctx.client_id,client_id:ctx.client_id,company:ctx.legal_name,legalName:ctx.legal_name,legal_name:ctx.legal_name,contractId:ctx.contract_id,contract_id:ctx.contract_id,contractNo:ctx.current_external_contract_number,current_external_contract_number:ctx.current_external_contract_number,contractStatus:ctx.contract_status,contract_status:ctx.contract_status});
    CLIENT_CONTEXTS.splice(0,CLIENT_CONTEXTS.length,next);
    try{activeClientContractId=ctx.contract_id}catch(_){ }
    state.modelBound=true;
    try{if(typeof setClientContext==='function')setClientContext(ctx.contract_id,false)}catch(_){ }
    return true;
  }catch(_){return false}
}
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
  const label=companyDisplayName(ctx);
  const current=select.options.length===1&&norm(select.options[0]?.value)===ctx.contract_id&&norm(select.options[0]?.textContent)===label;
  if(!current){const option=new Option(label,ctx.contract_id,true,true);option.title=ctx.legal_name+(ctx.current_external_contract_number?' · '+ctx.current_external_contract_number:'');select.replaceChildren(option)}
  if(select.value!==ctx.contract_id)select.value=ctx.contract_id;
  attr(select,'data-client-id',ctx.client_id);
  attr(select,'data-contract-id',ctx.contract_id);
  attr(select,'data-rona-context-source','server-session-authority');
  attr(select,'title',ctx.legal_name);
}
function filterTenantCards(ctx){
  for(const card of document.querySelectorAll('.company-switch-card')){
    const text=norm(card.textContent),action=norm(card.getAttribute('onclick'))+' '+norm(card.querySelector('[onclick]')?.getAttribute('onclick'));
    const ids=[...(text+' '+action).matchAll(/RONA-C\\d{3}(?:-CTR-\\d{4}-\\d{3,})?/g)].map(m=>m[0]);
    const authorized=!ids.length||ids.some(v=>v===ctx.client_id||v===ctx.contract_id);
    if(!authorized){card.hidden=true;card.style.display='none';attr(card,'data-rona-tenant-filtered','true')}else if(card.getAttribute('data-rona-tenant-filtered')==='true'){card.hidden=false;card.style.removeProperty('display');card.removeAttribute('data-rona-tenant-filtered')}
  }
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
  const display=companyDisplayName(ctx);
  if(company&&norm(company.textContent)!==display)company.textContent=display;
}
function sync(){
  if(state.syncing||!state.single||!document.body)return;
  state.syncing=true;
  try{
    const ctx=state.single;
    const modelBound=bindCanonicalModel(ctx);
    syncSelect(ctx);
    filterTenantCards(ctx);
    for(const scope of contextScopes())syncScope(scope,ctx);
    d.dataset.ronaClientTenantReady='1';
    d.dataset.ronaClientTenantState=modelBound?'bound':'bound-dom-model-pending';
    d.dataset.ronaClientId=ctx.client_id;
    d.dataset.ronaContractId=ctx.contract_id;
    d.dataset.ronaClientDisplayName=companyDisplayName(ctx);
    if(!state.eventSent){state.eventSent=true;window.dispatchEvent(new CustomEvent('rona:client-server-context-ready',{detail:{client_id:ctx.client_id,contract_id:ctx.contract_id,display_name:companyDisplayName(ctx),source:'SERVER_SESSION_AUTHORITY'}}))}
  }finally{state.syncing=false}
}
function schedule(){if(state.queued)return;state.queued=true;requestAnimationFrame(()=>{state.queued=false;sync()})}
function publish(raw){
  const contexts=(Array.isArray(raw)?raw:[]).map(clean).filter(valid);
  if(!contexts.length)return false;
  state.contexts=contexts;state.single=contexts.length===1?contexts[0]:null;state.ready=true;
  expose();
  d.dataset.ronaClientTenantState=state.single?'binding-model':'selection-required';
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
  headers.set('x-rona-client-tenant-context','server-session-authority-v3');
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