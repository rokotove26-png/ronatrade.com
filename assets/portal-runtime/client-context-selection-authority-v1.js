(()=>{'use strict';
const MARK='20260902-client-context-selection-authority-v3-scoped-bootstrap';
if(window.__RONA_CLIENT_CONTEXT_SELECTION_AUTHORITY__===MARK)return;
window.__RONA_CLIENT_CONTEXT_SELECTION_AUTHORITY__=MARK;
if(location.pathname!=='/portal/client')return;

const BOOT='/portal/api/v1/client/bootstrap';
const API_PREFIX='/portal/api/v1/client/';
const REQUIRED_CONTEXT_ROUTES=new Set([
  '/portal/api/v1/client/context',
  '/portal/api/v1/client/prices',
  '/portal/api/v1/client/deals',
  '/portal/api/v1/client/documents',
  '/portal/api/v1/client/payments',
  '/portal/api/v1/client/claims',
  '/portal/api/v1/client/messages',
  '/portal/api/v1/client/archive',
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
const nativeFetch=window.fetch.bind(window);
const state={contexts:[],selected:null,loading:null,ready:false,observer:null,queued:false,syncing:false};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('ru-RU').replaceAll('ё','е');
const d=document.documentElement;
const CLIENT_RE=/\bRONA-C\d{3}\b/g;
const CONTRACT_RE=/\bRONA-C\d{3}-CTR-\d{4}-\d{3,}\b/g;
const CLIENT_ONE=/\bRONA-C\d{3}\b/;
const CONTRACT_ONE=/\bRONA-C\d{3}-CTR-\d{4}-\d{3,}\b/;

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
function setSelected(ctx,source,emit=true){
  const next=ctx?authorized(ctx):null,before=key(state.selected),after=key(next);
  state.selected=next;exposeSelection();scheduleSync();
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
  if(state.selected){select.dataset.clientId=state.selected.client_id;select.dataset.contractId=state.selected.contract_id;select.dataset.ronaContextSource='server-session-authority';select.title=state.selected.legal_name}
  else{delete select.dataset.clientId;delete select.dataset.contractId;select.dataset.ronaContextSource='server-session-authority-selection-required';select.title='Выберите компанию'}
}
function contextScopes(){
  const out=[];
  for(const leaf of document.querySelectorAll('body *')){
    if(leaf.childElementCount!==0||!/^выбрана компания$/iu.test(norm(leaf.textContent)))continue;
    let node=leaf.parentElement,chosen=node;
    for(let depth=0;node&&node!==document.body&&depth<7;depth++,node=node.parentElement){
      const text=norm(node.textContent);if(text.length>1800)break;
      if(CONTRACT_ONE.test(text)||CLIENT_ONE.test(text)||/(контракт|договор)/iu.test(text))chosen=node;
    }
    if(chosen)out.push(chosen);
  }
  return [...new Set(out)];
}
function companyCandidate(scope){
  const leaves=[...scope.querySelectorAll('*')].filter(el=>el.childElementCount===0&&norm(el.textContent));
  const labelIndex=leaves.findIndex(el=>/^выбрана компания$/iu.test(norm(el.textContent)));
  let best=null,bestScore=-1;
  for(let i=0;i<leaves.length;i++){
    const el=leaves[i],text=norm(el.textContent),l=low(text);
    if(/^выбрана компания$/iu.test(text)||CLIENT_ONE.test(text)||CONTRACT_ONE.test(text)||/(контракт|договор|client|company)\s*№?/iu.test(text)||text.length>180)continue;
    if(['активен','активна','подключено','сервер'].includes(l))continue;
    let score=0;if(i>labelIndex)score+=120;if(/[«»“”"]/u.test(text))score+=80;if(/^[A-ZА-ЯЁ0-9][A-ZА-ЯЁ0-9 .&'«»“”"_-]{2,}$/u.test(text))score+=55;
    if(state.contexts.some(c=>text===c.legal_name||text===companyDisplayName(c)))score+=150;
    if(score>bestScore){best=el;bestScore=score}
  }
  return best;
}
function syncContextScope(scope,ctx){
  const display=companyDisplayName(ctx),contract=ctx.current_external_contract_number||ctx.contract_id;
  for(const leaf of scope.querySelectorAll('*')){
    if(leaf.childElementCount!==0)continue;const before=norm(leaf.textContent);if(!before)continue;
    let after=before.replace(CONTRACT_RE,contract).replace(CLIENT_RE,ctx.client_id);
    const contractPos=after.search(/(?:контракт|договор)\s*№/iu);
    if(contractPos>0&&(CLIENT_ONE.test(after)||CONTRACT_ONE.test(after)))after=display+' · '+after.slice(contractPos);
    if(after!==before)leaf.textContent=after;
  }
  const company=companyCandidate(scope);if(company&&norm(company.textContent)!==display)company.textContent=display;
  scope.dataset.clientId=ctx.client_id;scope.dataset.contractId=ctx.contract_id;scope.dataset.ronaContextSource='server-session-authority';
}
function syncHeader(ctx){
  const roots=[document.querySelector('header'),document.querySelector('.topbar'),document.querySelector('[class*="topbar"]')].filter(Boolean);
  for(const root of [...new Set(roots)])for(const leaf of root.querySelectorAll('*')){
    if(leaf.childElementCount!==0)continue;const before=norm(leaf.textContent);if(!before||!/(контракт|договор)\s*№/iu.test(before))continue;
    if(!CLIENT_ONE.test(before)&&!CONTRACT_ONE.test(before))continue;
    const contract=ctx.current_external_contract_number||ctx.contract_id;let after=before.replace(CONTRACT_RE,contract).replace(CLIENT_RE,ctx.client_id);
    const pos=after.search(/(?:контракт|договор)\s*№/iu);if(pos>0)after=companyDisplayName(ctx)+' · '+after.slice(pos);
    if(after!==before)leaf.textContent=after;
  }
}
function syncVisualContext(){const ctx=state.selected;if(!ctx)return;for(const scope of contextScopes())syncContextScope(scope,ctx);syncHeader(ctx)}
function syncAll(){if(state.syncing)return;state.syncing=true;try{syncSelect();syncVisualContext();exposeSelection()}finally{state.syncing=false}}
function scheduleSync(){if(state.queued)return;state.queued=true;requestAnimationFrame(()=>{state.queued=false;syncAll()})}
function publish(raw,source='bootstrap'){
  const contexts=(Array.isArray(raw)?raw:[]).map(clean).filter(valid);if(!contexts.length)return false;
  const previous=state.selected;state.contexts=contexts;state.ready=true;
  state.selected=previous&&authorized(previous)||resolveSelection();
  exposeSelection();scheduleSync();emitReady(source);
  if(key(previous)!==key(state.selected)||!state.selected)emitSelection(source,true);
  return true;
}
async function ensure(){
  if(state.ready)return state.contexts;if(state.loading)return state.loading;
  state.loading=(async()=>{
    const known=window.RONA_CLIENT_SERVER_CONTEXT?.contexts;
    if(Array.isArray(known)&&known.length&&publish(known,'server-context'))return state.contexts;
    const response=await nativeFetch(BOOT,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
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
    const body=await response.clone().json();
    if(body?.ok===false)return response;
    const rawContexts=body?.data?.contexts;
    if(!publish(rawContexts,'bootstrap-capture'))return response;
    const selected=state.selected?{...state.selected}:null;
    const data={...(body.data||{}),contexts:selected?[selected]:[],requires_context_selection:state.contexts.length>1&&!selected,selected_context:selected};
    return new Response(JSON.stringify({...body,data}),{status:response.status,statusText:response.statusText,headers:responseHeaders(response)});
  }catch(_){return response}
}
window.fetch=async function(input,init){
  const raw=rawInput(input),url=clientUrl(raw);if(!url)return nativeFetch(input,init);
  if(url.pathname===BOOT){const response=await nativeFetch(input,init);return scopedBootstrapResponse(response)}
  const explicitlyContextual=url.searchParams.has('clientId')||url.searchParams.has('contractId');
  const requiresContext=explicitlyContextual||pathRequiresContext(url.pathname);
  if(!requiresContext)return nativeFetch(input,init);
  await ensure();
  if(!state.selected){const dom=resolveSelection();if(dom)setSelected(dom,'selector',true)}
  if(!state.selected)throw new Error('CLIENT_CONTEXT_SELECTION_REQUIRED');
  url.searchParams.set('clientId',state.selected.client_id);url.searchParams.set('contractId',state.selected.contract_id);
  return nativeFetch(nextUrl(raw,url),init);
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
  subscribe
});
window.RONA_CLIENT_CONTEXT=publicApi;
window.getCurrentClientContext=publicApi.getCurrentContext;
function startObserver(){if(state.observer||!document.body)return;state.observer=new MutationObserver(()=>scheduleSync());state.observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['value','data-client-id','data-contract-id']});scheduleSync()}
function start(){
  document.addEventListener('change',onChange,true);
  window.addEventListener('pageshow',scheduleSync,{passive:true});
  window.addEventListener('rona:client-server-context-ready',()=>ensure().then(scheduleSync).catch(()=>{}));
  startObserver();ensure().then(()=>{startObserver();scheduleSync()}).catch(error=>console.error('RONA client context selection authority',error));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
