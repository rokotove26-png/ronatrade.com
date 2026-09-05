(()=>{'use strict';
const MARK='20260903-client-context-selection-authority-v4-header-current-context';
if(window.__RONA_CLIENT_CONTEXT_SELECTION_AUTHORITY__===MARK)return;
window.__RONA_CLIENT_CONTEXT_SELECTION_AUTHORITY__=MARK;
if(location.pathname!=='/portal/client')return;

const BOOT='/portal/api/v1/client/bootstrap';
const API_PREFIX='/portal/api/v1/client/';
const CONTEXT_ROUTE='/portal/api/v1/client/context';
const REQUIRED_CONTEXT_ROUTES=new Set([
  CONTEXT_ROUTE,
  '/portal/api/v1/client/prices',
  '/portal/api/v1/client/market',
  '/portal/api/v1/client/deals',
  '/portal/api/v1/client/documents',
  '/portal/api/v1/client/payments',
  '/portal/api/v1/client/claims',
  '/portal/api/v1/client/messages',
  '/portal/api/v1/client/archive',
  '/portal/api/v1/client/shipments',
  '/portal/api/v1/client/rail'
]);
const DIAG_ROUTES=new Set([
  CONTEXT_ROUTE,
  '/portal/api/v1/client/messages',
  '/portal/api/v1/client/archive',
  '/portal/api/v1/client/prices',
  '/portal/api/v1/client/market',
  '/portal/api/v1/client/shipments',
  '/portal/api/v1/client/rail'
]);
const REQUIRED_CONTEXT_PREFIXES=[
  '/portal/api/v1/client/deals/',
  '/portal/api/v1/client/deal-documents/',
  '/portal/api/v1/client/documents/',
  '/portal/api/v1/client/payments/',
  '/portal/api/v1/client/claims/',
  '/portal/api/v1/client/messages/',
  '/portal/api/v1/client/archive/'
];
const CURRENT_SLOT='data-rona-current-context-slot';
const CURRENT_SCOPE='data-rona-current-context-scope';
const nativeFetch=window.fetch.bind(window);
const state={contexts:[],selected:null,loading:null,ready:false,observer:null,queued:false,syncing:false,projection:{key:'',promise:null,text:'',json:null,status:0,statusText:'',headers:[],loadedAt:0},callerMap:[]};
window.__RONA_CLIENT_CALLER_MAP__=state.callerMap;
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('ru-RU').replaceAll('ё','е');
const d=document.documentElement;
const CLIENT_ONE=/^RONA-C\d{3}$/u;
const CONTRACT_ONE=/^RONA-C\d{3}-CTR-\d{4}-\d{3,}$/u;

function clean(c){return c&&typeof c==='object'?{
  client_id:norm(c.client_id),legal_name:norm(c.legal_name),registration_country:norm(c.registration_country),
  contract_id:norm(c.contract_id),current_external_contract_number:norm(c.current_external_contract_number),
  contract_status:norm(c.contract_status),effective_from:norm(c.effective_from),effective_to:norm(c.effective_to)
}:null}
function valid(c){return !!(c&&c.client_id&&c.contract_id&&c.legal_name)}
function key(c){return c?c.client_id+'|'+c.contract_id:''}
function copy(c){return c?Object.freeze({...c}):null}
function authorized(ctx){const k=key(ctx);return state.contexts.find(c=>key(c)===k)||null}
function isKg(ctx){return /(кыргыз|киргиз|kyrgyz|kgz|\bkg\b)/iu.test(norm(ctx?.registration_country))}
function quoteName(legal){const m=norm(legal).match(/[«“"][^»”"]+[»”"]/u);return m?m[0]:''}
function companyDisplayName(ctx){
  const legal=norm(ctx?.legal_name);if(!legal)return norm(ctx?.client_id)||'Компания';
  const quoted=quoteName(legal);
  const existing=legal.match(/^(ОсОО|ООО|ПАО|НАО|АО|ЗАО|ОАО|ОДО|ИП|LLC)(?:\s+|$)/iu);
  if(existing){const form=existing[1];return quoted?form+' '+quoted:legal}
  const forms=[
    [/^общество с ограниченной ответственностью(?:\s+|$)/iu,isKg(ctx)?'ОсОО':'ООО'],
    [/^общество с дополнительной ответственностью(?:\s+|$)/iu,'ОДО'],
    [/^публичное акционерное общество(?:\s+|$)/iu,'ПАО'],
    [/^непубличное акционерное общество(?:\s+|$)/iu,'АО'],
    [/^закрытое акционерное общество(?:\s+|$)/iu,'ЗАО'],
    [/^открытое акционерное общество(?:\s+|$)/iu,'ОАО'],
    [/^акционерное общество(?:\s+|$)/iu,'АО'],
    [/^индивидуальный предприниматель(?:\s+|$)/iu,'ИП'],
    [/^limited liability company(?:\s+|$)/iu,'LLC']
  ];
  for(const [re,form] of forms){if(!re.test(legal))continue;const rest=legal.replace(re,'').trim();return quoted?form+' '+quoted:(rest?form+' '+rest:form)}
  return legal;
}
function compactContract(ctx){const no=norm(ctx?.current_external_contract_number||ctx?.contract_id);return no.replace(/^RONA-C\d{3}-CTR-/,'CTR ')}
function contextByIds(clientId,contractId){
  const c=norm(clientId),k=norm(contractId);
  if(!c||!k)return null;
  return state.contexts.find(x=>x.client_id===c&&x.contract_id===k)||null;
}
function contextByValue(value,option){
  const v=norm(value),clientId=norm(option?.dataset?.clientId),contractId=norm(option?.dataset?.contractId);
  const byPair=contextByIds(clientId,contractId);if(byPair)return byPair;
  return state.contexts.find(c=>c.contract_id===v||c.current_external_contract_number===v)||null;
}
function contextFromSelect(){
  const select=document.getElementById('clientContextSelect');if(!select)return null;
  return contextByValue(select.value,select.selectedOptions?.[0]||null);
}
function contextFromDataset(){return contextByIds(d.dataset.ronaClientId,d.dataset.ronaContractId)}
function resolveSelection(){
  if(state.contexts.length===1)return state.contexts[0];
  return contextFromSelect()||contextFromDataset()||null;
}
function detail(source){
  const ctx=state.selected;
  return {client_id:ctx?.client_id||'',contract_id:ctx?.contract_id||'',display_name:ctx?companyDisplayName(ctx):'',source:source||'SERVER_SESSION_AUTHORITY',ready:state.ready,selection_required:state.ready&&state.contexts.length>1&&!ctx};
}
function exposeSelection(){
  d.dataset.ronaClientContextAuthority=MARK;
  d.dataset.ronaClientContextReady=state.ready?'true':'false';
  d.dataset.ronaClientContextSelection=state.selected?'selected':(state.ready&&state.contexts.length>1?'required':'pending');
  if(state.selected){
    d.dataset.ronaClientId=state.selected.client_id;
    d.dataset.ronaContractId=state.selected.contract_id;
    d.dataset.ronaClientDisplayName=companyDisplayName(state.selected);
  }else{
    delete d.dataset.ronaClientId;
    delete d.dataset.ronaContractId;
    delete d.dataset.ronaClientDisplayName;
  }
}
function emitSelection(source,force=false){if(!force&&!state.ready)return;window.dispatchEvent(new CustomEvent('rona:client-context-changed',{detail:detail(source)}))}
function emitReady(source){window.dispatchEvent(new CustomEvent('rona:client-context-ready',{detail:detail(source)}))}
function requestHeaders(input,init){return new Headers(init?.headers||(input instanceof Request?input.headers:undefined))}
function callerSource(input,init){
  const explicit=requestHeaders(input,init).get('x-rona-client-source');if(explicit)return explicit;
  const stack=String(new Error().stack||'');
  const assets=[...stack.matchAll(/\/assets\/portal-runtime\/([^?/:\s]+\.js)/g)].map(m=>m[1]).filter(n=>n!=='client-context-selection-authority-v1.js');
  if(assets.length)return assets[0];
  const routes=[...stack.matchAll(/\/portal\/([^?/:\s]+(?:-ui)?)/g)].map(m=>m[1]).filter(Boolean);return routes[0]||'client-context-selection-authority-v1';
}
function diagnosticRoute(pathname){return DIAG_ROUTES.has(pathname)}
function recordCaller(url,source,kind){
  if(!diagnosticRoute(url.pathname))return;
  const item={at:new Date().toISOString(),kind,source,route:url.pathname,client_id:url.searchParams.get('clientId')||'',contract_id:url.searchParams.get('contractId')||''};
  state.callerMap.push(item);if(state.callerMap.length>500)state.callerMap.splice(0,state.callerMap.length-500);
}
function taggedInit(input,init,source){const headers=requestHeaders(input,init);if(!headers.has('x-rona-client-source'))headers.set('x-rona-client-source',source);return{...(init||{}),headers}}
function invalidateProjection(){state.projection.key='';state.projection.promise=null;state.projection.text='';state.projection.json=null;state.projection.status=0;state.projection.statusText='';state.projection.headers=[];state.projection.loadedAt=0}
function cloneProjection(){const p=state.projection;return new Response(p.text,{status:p.status,statusText:p.statusText,headers:new Headers(p.headers)})}
function validateProjection(body,ctx){
  if(!body||body.ok===false||!body.data)throw new Error('CLIENT_CONTEXT_PROJECTION_INVALID');
  const contract=body.data.contract||{},clientId=norm(contract.client_id),contractId=norm(contract.contract_id);
  if((clientId&&clientId!==ctx.client_id)||(contractId&&contractId!==ctx.contract_id))throw new Error('CLIENT_CONTEXT_PROJECTION_SCOPE_MISMATCH');
}
async function loadCurrentProjection(source='client-context-selection-authority-v1:coordinator'){
  const ctx=state.selected;if(!ctx)return null;const wanted=key(ctx),p=state.projection;
  if(p.key===wanted&&p.text&&p.status>=200&&p.status<300)return cloneProjection();
  if(p.key===wanted&&p.promise){recordCaller(new URL(CONTEXT_ROUTE+`?clientId=${encodeURIComponent(ctx.client_id)}&contractId=${encodeURIComponent(ctx.contract_id)}`,location.origin),source,'join');await p.promise;return cloneProjection()}
  invalidateProjection();p.key=wanted;
  const url=new URL(CONTEXT_ROUTE,location.origin);url.searchParams.set('clientId',ctx.client_id);url.searchParams.set('contractId',ctx.contract_id);recordCaller(url,source,'network');
  p.promise=(async()=>{
    const response=await nativeFetch(url.pathname+url.search,taggedInit(url.pathname+url.search,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}},source));
    const text=await response.text();const body=JSON.parse(text||'null');if(!response.ok)throw new Error(String(body?.code||`HTTP_${response.status}`));validateProjection(body,ctx);
    if(key(state.selected)!==wanted)throw new Error('CLIENT_CONTEXT_CHANGED_DURING_PROJECTION');
    p.text=text;p.json=body;p.status=response.status;p.statusText=response.statusText;p.headers=[...response.headers.entries()];p.loadedAt=Date.now();
    window.dispatchEvent(new CustomEvent('rona:client-current-projection',{detail:{client_id:ctx.client_id,contract_id:ctx.contract_id,source,loaded_at:new Date(p.loadedAt).toISOString()}}));
  })().catch(error=>{if(p.key===wanted)invalidateProjection();throw error}).finally(()=>{if(p.key===wanted)p.promise=null});
  await p.promise;return cloneProjection();
}
function projectionData(){const p=state.projection;if(p.key!==key(state.selected)||!p.json?.data)return null;return JSON.parse(JSON.stringify(p.json.data))}
function primeProjection(source){if(!state.selected)return;queueMicrotask(()=>loadCurrentProjection(source).catch(error=>console.error('RONA current-context coordinator',error)))}
function setSelected(ctx,source,emit=true){
  const next=ctx?authorized(ctx):null,before=key(state.selected),after=key(next);
  state.selected=next;if(before!==after){invalidateProjection();if(next)primeProjection('client-context-selection-authority-v1:context-change')}
  exposeSelection();scheduleSync();
  if(emit&&before!==after)emitSelection(source,true);
  return next;
}
function labelCounts(){const map=new Map();for(const c of state.contexts){const n=companyDisplayName(c);map.set(n,(map.get(n)||0)+1)}return map}
function syncSelect(){
  const select=document.getElementById('clientContextSelect');if(!select||!state.ready)return;
  const prior=state.selected||resolveSelection();if(prior)state.selected=authorized(prior);
  const counts=labelCounts(),selectedKey=key(state.selected),desired=[];
  if(state.contexts.length>1&&!state.selected)desired.push({value:'',text:'Выберите компанию',disabled:true,selected:true,ctx:null});
  for(const ctx of state.contexts){
    const display=companyDisplayName(ctx),duplicate=counts.get(display)>1;
    desired.push({value:ctx.contract_id,text:duplicate?display+' · '+compactContract(ctx):display,disabled:false,selected:key(ctx)===selectedKey,ctx});
  }
  const current=[...select.options].map(o=>[norm(o.value),norm(o.textContent),o.disabled,o.selected,norm(o.dataset.clientId),norm(o.dataset.contractId)]);
  const target=desired.map(o=>[o.value,o.text,o.disabled,o.selected,o.ctx?.client_id||'',o.ctx?.contract_id||'']);
  if(JSON.stringify(current)!==JSON.stringify(target)){
    const frag=document.createDocumentFragment();
    for(const item of desired){
      const option=new Option(item.text,item.value,item.selected,item.selected);option.disabled=item.disabled;
      if(item.ctx){option.dataset.clientId=item.ctx.client_id;option.dataset.contractId=item.ctx.contract_id;option.title=item.ctx.legal_name+(item.ctx.current_external_contract_number?' · '+item.ctx.current_external_contract_number:'')}
      frag.appendChild(option);
    }
    select.replaceChildren(frag);
  }
  if(state.selected&&select.value!==state.selected.contract_id)select.value=state.selected.contract_id;
  if(state.selected){if(select.dataset.clientId!==state.selected.client_id)select.dataset.clientId=state.selected.client_id;if(select.dataset.contractId!==state.selected.contract_id)select.dataset.contractId=state.selected.contract_id;if(select.dataset.ronaContextSource!=='server-session-authority')select.dataset.ronaContextSource='server-session-authority';if(select.title!==state.selected.legal_name)select.title=state.selected.legal_name}
  else{if(select.dataset.clientId)delete select.dataset.clientId;if(select.dataset.contractId)delete select.dataset.contractId;if(select.dataset.ronaContextSource!=='server-session-authority-selection-required')select.dataset.ronaContextSource='server-session-authority-selection-required';if(select.title!=='Выберите компанию')select.title='Выберите компанию'}
}
function leafNodes(root){return [...root.querySelectorAll('div,span,p,small,strong,b,label,h1,h2,h3,h4')].filter(el=>el.childElementCount===0&&norm(el.textContent))}
function authorizedName(text){const l=low(text);return state.contexts.some(c=>l===low(c.legal_name)||l===low(companyDisplayName(c)))}
function authorizedContract(text){const l=low(text);return state.contexts.some(c=>{const values=[c.contract_id,c.current_external_contract_number].map(norm).filter(Boolean);return values.some(v=>l===low(v)||l.includes(low(v)))})}
function markSlot(el,type){if(!el)return null;if(el.getAttribute(CURRENT_SLOT)!==type)el.setAttribute(CURRENT_SLOT,type);return el}
function markContractSlot(el){if(!el)return null;const text=norm(el.textContent),prefix=/^договор\b/iu.test(text)?'Договор':/^контракт\b/iu.test(text)?'Контракт':'';if(prefix)el.dataset.ronaCurrentContextContractPrefix=prefix;return markSlot(el,prefix?'contract-label':'contract-id')}
function declaredSlots(){
  for(const el of document.querySelectorAll('[data-rona-context-client],[data-rona-current-client]'))markSlot(el,'client-name');
  for(const el of document.querySelectorAll('[data-rona-context-contract],[data-rona-current-contract]'))markContractSlot(el);
}
function legacyContextScopes(){
  const out=[];
  for(const leaf of document.querySelectorAll('body *')){
    if(leaf.childElementCount!==0||!/^выбрана компания$/iu.test(norm(leaf.textContent)))continue;
    let scope=leaf.parentElement;
    for(let depth=0;scope&&scope!==document.body&&depth<6;depth++,scope=scope.parentElement){
      const leaves=leafNodes(scope);if(leaves.some(n=>authorizedName(n.textContent))&&(leaves.some(n=>authorizedContract(n.textContent)||CONTRACT_ONE.test(norm(n.textContent)))||leaves.some(n=>CLIENT_ONE.test(norm(n.textContent))))){out.push(scope);break}
    }
  }
  return [...new Set(out)];
}
function bindLegacyScope(scope){
  if(!scope)return;
  scope.setAttribute(CURRENT_SCOPE,'legacy-explicit-slots');
  const leaves=leafNodes(scope),labelIndex=leaves.findIndex(n=>/^выбрана компания$/iu.test(norm(n.textContent)));
  const company=leaves.find((n,i)=>i>labelIndex&&authorizedName(n.textContent));if(company)markSlot(company,'client-name');
  const clientId=leaves.find(n=>CLIENT_ONE.test(norm(n.textContent)));if(clientId)markSlot(clientId,'client-id');
  const contract=leaves.find(n=>CONTRACT_ONE.test(norm(n.textContent))||authorizedContract(n.textContent));if(contract)markContractSlot(contract);
}
function headerRoots(){
  const out=[document.querySelector('header'),document.querySelector('.topbar'),document.querySelector('[class*="topbar"]')].filter(Boolean);
  const select=document.getElementById('clientContextSelect');
  if(select){let node=select.parentElement;for(let depth=0;node&&node!==document.body&&depth<8;depth++,node=node.parentElement){const text=norm(node.textContent);if(text.length<=1400&&(/личный кабинет клиента/iu.test(text)||/компания\s*\/\s*контракт/iu.test(text))){out.push(node);break}if(text.length>2200)break}}
  return [...new Set(out.filter(Boolean))];
}
function normalizeHeaderTitle(){
  for(const root of headerRoots())for(const leaf of leafNodes(root)){
    const before=norm(leaf.textContent),match=before.match(/^(.*?личный кабинет клиента)(?:\s*·.*)?$/iu);
    if(match&&before!==match[1])leaf.textContent=match[1];
  }
}
function bindHeaderSlots(){
  for(const root of headerRoots())for(const leaf of leafNodes(root)){
    if(leaf.closest('select,option,button,[data-status],[data-service],[data-access]'))continue;
    const text=norm(leaf.textContent);if(!text)continue;
    if(authorizedName(text)){markSlot(leaf,'client-name');continue}
    if(CONTRACT_ONE.test(text)||authorizedContract(text)||/^(?:контракт|договор)\b/iu.test(text)){markContractSlot(leaf);continue}
    if(CLIENT_ONE.test(text))markSlot(leaf,'client-id');
  }
}
function purgeHeaderContractDownload(){for(const root of headerRoots())for(const el of root.querySelectorAll('button,a,[role="button"]'))if(/^скачать\s+договор\s+pdf$/iu.test(norm(el.textContent)))el.remove()}
function contractValue(ctx){return norm(ctx?.current_external_contract_number||ctx?.contract_id)}
function renderSlot(el,ctx){
  const type=el.getAttribute(CURRENT_SLOT);if(!type)return;
  if(!ctx){const empty=type==='client-name'?'Выберите компанию':'';if(el.textContent!==empty)el.textContent=empty;return}
  let value='';
  if(type==='client-name')value=companyDisplayName(ctx);
  else if(type==='client-id')value=ctx.client_id;
  else if(type==='contract-id')value=contractValue(ctx);
  else if(type==='contract-label'){const prefix=el.dataset.ronaCurrentContextContractPrefix||'Контракт';value=prefix+' '+contractValue(ctx)}
  if(norm(el.textContent)!==norm(value))el.textContent=value;
}
function syncVisualContext(){
  purgeHeaderContractDownload();normalizeHeaderTitle();declaredSlots();for(const scope of legacyContextScopes())bindLegacyScope(scope);bindHeaderSlots();for(const el of document.querySelectorAll(`[${CURRENT_SLOT}]`))renderSlot(el,state.selected);purgeHeaderContractDownload();
}
function syncAll(){if(state.syncing)return;state.syncing=true;try{syncSelect();syncVisualContext();exposeSelection()}finally{state.syncing=false}}
function scheduleSync(){if(state.queued)return;state.queued=true;requestAnimationFrame(()=>{state.queued=false;syncAll()})}
function publish(raw,source='bootstrap'){
  const contexts=(Array.isArray(raw)?raw:[]).map(clean).filter(valid);if(!contexts.length)return false;
  const previous=state.selected;state.contexts=contexts;state.ready=true;
  state.selected=previous&&authorized(previous)||resolveSelection();
  if(key(previous)!==key(state.selected)){invalidateProjection();if(state.selected)primeProjection('client-context-selection-authority-v1:initial')}
  exposeSelection();scheduleSync();emitReady(source);
  if(key(previous)!==key(state.selected)||!state.selected)emitSelection(source,true);
  return true;
}
async function ensure(){
  if(state.ready)return state.contexts;if(state.loading)return state.loading;
  state.loading=(async()=>{
    const known=window.RONA_CLIENT_SERVER_CONTEXT?.contexts;
    if(Array.isArray(known)&&known.length&&publish(known,'server-context'))return state.contexts;
    const response=await nativeFetch(BOOT,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-rona-client-source':'client-context-selection-authority-v1:bootstrap'}});
    if(!response.ok)throw new Error('CLIENT_BOOTSTRAP_HTTP_'+response.status);
    const body=await response.json();
    if(body?.ok===false||!publish(body?.data?.contexts,'bootstrap'))throw new Error('CLIENT_CONTEXT_NOT_AUTHORIZED');
    return state.contexts;
  })().finally(()=>{state.loading=null});
  return state.loading;
}
function rawInput(input){if(typeof input==='string')return input;if(input instanceof URL)return input.href;if(input&&typeof input.url==='string')return input.url;return''}
function clientUrl(raw){try{const u=new URL(raw,location.origin);return u.origin===location.origin&&u.pathname.startsWith(API_PREFIX)?u:null}catch{return null}}
function nextUrl(raw,url){return raw.startsWith('http://')||raw.startsWith('https://')?url.href:url.pathname+url.search+url.hash}
function pathRequiresContext(pathname){return REQUIRED_CONTEXT_ROUTES.has(pathname)||REQUIRED_CONTEXT_PREFIXES.some(prefix=>pathname.startsWith(prefix))}
function responseHeaders(response){const headers=new Headers(response.headers);headers.set('content-type','application/json; charset=utf-8');headers.delete('content-length');headers.delete('content-encoding');return headers}
async function scopedBootstrapResponse(response){
  try{
    if(!response?.ok)return response;
    const body=await response.clone().json();if(body?.ok===false)return response;
    const rawContexts=body?.data?.contexts;if(!publish(rawContexts,'bootstrap-capture'))return response;
    const selected=state.selected?{...state.selected}:null;
    const data={...(body.data||{}),contexts:selected?[selected]:[],requires_context_selection:state.contexts.length>1&&!selected,selected_context:selected};
    return new Response(JSON.stringify({...body,data}),{status:response.status,statusText:response.statusText,headers:responseHeaders(response)});
  }catch(_){return response}
}
window.fetch=async function(input,init){
  const raw=rawInput(input),url=clientUrl(raw);if(!url)return nativeFetch(input,init);
  const source=callerSource(input,init);
  if(url.pathname===BOOT){recordCaller(url,source,'request');const response=await nativeFetch(input,taggedInit(input,init,source));return scopedBootstrapResponse(response)}
  const explicitlyContextual=url.searchParams.has('clientId')||url.searchParams.has('contractId');
  const requiresContext=explicitlyContextual||pathRequiresContext(url.pathname);
  if(!requiresContext)return nativeFetch(input,init);
  await ensure();
  if(!state.selected){const dom=resolveSelection();if(dom)setSelected(dom,'selector',true)}
  if(!state.selected)throw new Error('CLIENT_CONTEXT_SELECTION_REQUIRED');
  url.searchParams.set('clientId',state.selected.client_id);url.searchParams.set('contractId',state.selected.contract_id);
  recordCaller(url,source,'request');
  if(url.pathname===CONTEXT_ROUTE&&(init?.method===undefined||String(init.method).toUpperCase()==='GET'))return loadCurrentProjection(source);
  const response=await nativeFetch(nextUrl(raw,url),taggedInit(input,init,source));recordCaller(url,source,'network');
  if(String(init?.method||'GET').toUpperCase()!=='GET'&&response.ok)invalidateProjection();
  return response;
};
function onChange(event){const select=event.target?.closest?.('#clientContextSelect');if(!select)return;const ctx=contextByValue(select.value,select.selectedOptions?.[0]||null);setSelected(ctx,'selector',true)}
function subscribe(listener){
  if(typeof listener!=='function')return()=>{};
  const fn=e=>listener(copy(state.selected),{...e.detail});
  window.addEventListener('rona:client-context-changed',fn);
  if(state.ready)queueMicrotask(()=>listener(copy(state.selected),detail('subscribe')));else ensure().catch(()=>{});
  return()=>window.removeEventListener('rona:client-context-changed',fn);
}
const publicApi=Object.freeze({
  version:MARK,
  whenReady:async()=>{await ensure();return copy(state.selected)},
  getCurrentContext:()=>copy(state.selected),
  getAuthorizedContexts:()=>state.contexts.map(copy),
  selectionRequired:()=>state.ready&&state.contexts.length>1&&!state.selected,
  select:(clientId,contractId)=>{const ctx=contextByIds(clientId,contractId);if(!ctx)throw new Error('CLIENT_CONTEXT_NOT_AUTHORIZED');return copy(setSelected(ctx,'api',true))},
  getCurrentProjection:()=>projectionData(),
  whenCurrentProjection:async(source='public-api')=>{await ensure();if(!state.selected)return null;await loadCurrentProjection('client-context-selection-authority-v1:'+source);return projectionData()},
  invalidateCurrentProjection:()=>invalidateProjection(),
  getCallerMap:()=>state.callerMap.map(x=>({...x})),
  subscribe
});
window.RONA_CLIENT_CONTEXT=publicApi;
window.getCurrentClientContext=publicApi.getCurrentContext;
function startObserver(){if(state.observer||!document.body)return;state.observer=new MutationObserver(()=>scheduleSync());state.observer.observe(document.body,{childList:true,subtree:true});scheduleSync()}
function start(){
  document.addEventListener('change',onChange,true);
  window.addEventListener('pageshow',scheduleSync,{passive:true});
  window.addEventListener('rona:client-server-context-ready',()=>ensure().then(()=>{scheduleSync();if(state.selected)primeProjection('client-context-selection-authority-v1:server-ready')}).catch(()=>{}));
  startObserver();ensure().then(()=>{startObserver();scheduleSync();if(state.selected)primeProjection('client-context-selection-authority-v1:startup')}).catch(error=>console.error('RONA client context selection authority',error));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();