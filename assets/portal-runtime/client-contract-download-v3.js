(()=>{'use strict';
const MARK='20260902-client-contract-v4-current-context-authority';
const COMPAT_MARK='20260829-client-contract-v3-authoritative-projection-v5';
if(window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V3__===MARK)return;
window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V3__=MARK;
window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V2__=MARK;
window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V1__=MARK;

const API='/portal/api',REFRESH_MS=30000,STYLE_ID='ronaClientContractDownloadV3Style';
const state={entry:null,loading:false,lastLoad:0,renderTimer:0,currentKey:'',observer:null,rendering:false,unsubscribe:null};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim(),low=v=>norm(v).toLocaleLowerCase('ru-RU');
const GENERIC=new Set(['общество','ограниченной','ответственностью','совместное','предприятие','company','limited','liability','joint','venture','contract','контракт','rona','trade','ооо','осоо','сп','с','llc']);
const APOSTROPHES="'’‘`´ʼ";

async function request(path){
  const r=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
  const b=await r.json().catch(()=>null);
  if(!r.ok||b?.ok===false)throw new Error(String(b?.code||b?.error?.code||('HTTP_'+r.status)));
  return b;
}
function contextAuthority(){return window.RONA_CLIENT_CONTEXT||null}
function contextKey(ctx){return norm(ctx?.client_id)+'|'+norm(ctx?.contract_id)}
async function authorityReady(){const authority=contextAuthority();if(!authority)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');await authority.whenReady();return authority}
function visible(el){if(!el||!el.isConnected)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0}
function tokenKey(v){return low(v).replace(new RegExp('['+APOSTROPHES+']','g'),'').replace(/[^a-zа-яё0-9]+/gi,'')}
function legalWords(name){return (norm(name).match(/[A-Za-zА-Яа-яЁё0-9]+(?:['’‘`´ʼ-][A-Za-zА-Яа-яЁё0-9]+)*/g)||[]).filter(Boolean)}
function canonicalBusinessWords(ctx){const words=legalWords(ctx?.legal_name);while(words.length&&GENERIC.has(low(words[0])))words.shift();return words}
function identityTokens(ctx){return canonicalBusinessWords(ctx).map(tokenKey).filter(x=>x.length>=3&&!GENERIC.has(x)).filter((x,i,a)=>a.indexOf(x)===i)}
function currentContractDocument(documents){
  const docs=Array.isArray(documents)?documents:[],type=d=>String(d?.document_type||'').trim().toUpperCase(),materialized=d=>Boolean(d?.storage_object_id);
  return docs.find(d=>type(d)==='SIGNED_CONTRACT'&&materialized(d))
    ||docs.find(d=>type(d)==='SIGNED_BILATERAL_CONTRACT'&&materialized(d))
    ||docs.find(d=>type(d)==='КОНТРАКТ'&&materialized(d))
    ||docs.find(d=>type(d)==='CONTRACT'&&materialized(d))
    ||docs.find(d=>(type(d).includes('CONTRACT')||type(d).includes('КОНТРАКТ'))&&materialized(d))
    ||docs.find(d=>type(d)==='SIGNED_CONTRACT')
    ||docs.find(d=>type(d)==='SIGNED_BILATERAL_CONTRACT')
    ||docs.find(d=>type(d)==='КОНТРАКТ')
    ||docs.find(d=>type(d)==='CONTRACT')
    ||docs.find(d=>type(d).includes('CONTRACT')||type(d).includes('КОНТРАКТ'))
    ||null;
}
function effectiveContext(base,detail){const dc=detail?.contract||{},number=norm(dc.current_external_contract_number)||norm(base?.current_external_contract_number)||null;return{...base,...dc,current_external_contract_number:number}}
function frozenContexts(){try{if(typeof CLIENT_CONTEXTS!=='undefined'&&CLIENT_CONTEXTS&&typeof CLIENT_CONTEXTS==='object')return CLIENT_CONTEXTS}catch{}return null}
function hydrateFrozenClientModel(entry){
  const model=frozenContexts(),ctx=entry?.context||{},id=norm(ctx.contract_id),num=norm(ctx.current_external_contract_number);if(!model||!id||!num)return 0;
  const row=model[id];if(!row||typeof row!=='object')return 0;
  row.contractNo=num.replace(/^№\s*/u,'');row.contractStateBlocked=String(ctx.contract_status||'').toUpperCase()!=='ACTIVE';if(!row.contractStateBlocked&&/уточн/i.test(String(row.status||'')))row.status='Действует';
  document.documentElement.dataset.ronaClientContractModel='authoritative';return 1;
}
function publishState(){
  const entry=state.entry,ctx=entry?.context||null;
  window.__RONA_CLIENT_CONTRACT_DOWNLOAD_STATE__={version:MARK,compat:COMPAT_MARK,current_contract_id:ctx?.contract_id||null,context_source:'RONA_CLIENT_CONTEXT_AUTHORITY',scope:'CURRENT_CONTEXT_ONLY',entries:entry?[{client_id:ctx.client_id||null,legal_name:ctx.legal_name||null,contract_id:ctx.contract_id||null,current_external_contract_number:ctx.current_external_contract_number||null,contract_status:ctx.contract_status||null,document_id:entry.document?.document_id||null,storage_object_id:entry.document?.storage_object_id||null,current:true}]:[],loadedAt:new Date().toISOString()};
}
async function refresh(force=false){
  if(state.loading)return;if(!force&&Date.now()-state.lastLoad<REFRESH_MS){render();return}state.loading=true;
  try{
    const authority=await authorityReady(),current=authority.getCurrentContext();
    if(!current){state.entry=null;state.currentKey='';state.lastLoad=Date.now();publishState();render();return}
    const key=contextKey(current),detail=await request('/v1/client/context?clientId='+encodeURIComponent(current.client_id)+'&contractId='+encodeURIComponent(current.contract_id));
    if(contextKey(authority.getCurrentContext())!==key)return;
    const data=detail?.data||{},context=effectiveContext(current,data);state.entry={context,document:currentContractDocument(data.documents)};state.currentKey=key;state.lastLoad=Date.now();hydrateFrozenClientModel(state.entry);publishState();render();
  }catch(error){console.error('RONA contract current-context projection',error)}finally{state.loading=false}
}
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;
  s.textContent=`button[data-rona-contract-download-v3]{appearance:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;min-height:30px!important;padding:6px 11px!important;border:1px solid rgba(230,190,82,.38)!important;border-radius:999px!important;background:linear-gradient(180deg,rgba(230,190,82,.13),rgba(230,190,82,.07))!important;color:#ecd27e!important;font-family:inherit!important;font-size:10.5px!important;line-height:1.15!important;font-weight:820!important;letter-spacing:.02em!important;white-space:nowrap!important;cursor:pointer!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)!important}button[data-rona-contract-download-v3]::before{content:'↓';font-size:13px;font-weight:900;color:#67d9fb}@media(hover:hover) and (pointer:fine){button[data-rona-contract-download-v3]:hover{border-color:rgba(101,217,255,.55)!important;background:rgba(101,217,255,.11)!important;color:#ddf9ff!important}}button[data-rona-contract-download-v3][disabled]{cursor:wait!important;opacity:.72!important}`;document.head.appendChild(s);
}
function leafByText(root,predicate){return [...root.querySelectorAll('button,a,span,small,strong,p,div')].find(e=>e.childElementCount===0&&predicate(low(e.textContent)))||null}
function findCompanyCard(ctx){
  if(!ctx)return null;const contract=CSS.escape(norm(ctx.contract_id)),client=CSS.escape(norm(ctx.client_id));
  const direct=document.querySelector(`[data-rona-client-contract-id="${contract}"],[data-contract-id="${contract}"],[data-client-id="${client}"]`);if(direct&&visible(direct))return direct.closest('article,section,li,div')||direct;
  const contractKey=low(ctx.contract_id),clientKey=low(ctx.client_id),tokens=identityTokens(ctx),c=[];
  for(const node of document.querySelectorAll('article,section,li,div')){
    if(!visible(node))continue;const t=low(node.textContent);if(!t||t.length>9000||(!t.includes('подписанный контракт')&&!t.includes('текущая компания')&&!t.includes('активный контекст')&&!t.includes('выбрана компания')))continue;
    const compact=tokenKey(t),hc=contractKey&&t.includes(contractKey),hi=clientKey&&t.includes(clientKey);let tokenScore=0;for(const x of tokens)if(compact.includes(x))tokenScore+=40;if(!hc&&!hi&&tokenScore<40)continue;
    c.push({node,score:(hc?10000:0)+(hi?3000:0)+tokenScore+500-Math.min(t.length,8000)/8,len:t.length});
  }
  c.sort((a,b)=>b.score-a.score||a.len-b.len);return c[0]?.node||null;
}
const unavailableNode=card=>leafByText(card,t=>t.includes('контракт пока недоступен для скачивания')||t==='контракт недоступен для скачивания'||t.includes('файл подписанного контракта не опубликован в кабинете'));
const contractAnchor=card=>leafByText(card,t=>t==='подписанный контракт');
function downloadName(entry,issued){return norm(issued?.object?.filename||entry?.document?.authoritative_filename||'Договор.pdf')||'Договор.pdf'}
function withDownloadDisposition(url,filename){try{const u=new URL(String(url));u.searchParams.set('download',filename);return u.toString()}catch{return String(url||'')}}
async function beginDownload(entry,b){
  if(b.disabled||!entry?.document?.storage_object_id)return;const idle='Скачать договор PDF';b.disabled=true;b.textContent='Подготовка PDF…';
  try{const issued=await request('/v1/client/storage/'+encodeURIComponent(entry.document.storage_object_id)+'/signed-url'),url=issued?.signed_url||issued?.data?.signed_url;if(!url)throw new Error('SIGNED_URL_MISSING');const filename=downloadName(entry,issued),a=document.createElement('a');a.href=withDownloadDisposition(url,filename);a.target='_blank';a.rel='noopener';a.download=filename;a.style.display='none';document.body.appendChild(a);a.click();a.remove();b.textContent='Договор открыт'}catch(error){console.error('RONA contract download',error);b.textContent='Не удалось скачать';b.title='Не удалось получить защищённую ссылку. Повторите попытку.'}finally{setTimeout(()=>{if(b.isConnected){b.disabled=false;b.textContent=idle}},1200)}
}
function makeButton(entry,template){
  ensureStyle();const b=document.createElement('button');b.type='button';if(template&&typeof template.className==='string')b.className=template.className;b.dataset.ronaContractDownloadV3=String(entry.context?.contract_id||'');b.dataset.storageObjectId=String(entry.document?.storage_object_id||'');b.textContent='Скачать договор PDF';b.title=norm(entry.document?.authoritative_filename)||'Скачать действующий подписанный договор';b.setAttribute('aria-label','Скачать подписанный договор '+norm(entry.context?.current_external_contract_number||entry.context?.contract_id));b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();beginDownload(entry,b)},true);return b;
}
function clearRuntimeButtons(){for(const old of document.querySelectorAll('button[data-rona-contract-download-v3],button[data-rona-contract-download],button[data-rona-contract-download-v2]'))old.remove()}
function renderEntry(entry){
  const card=findCompanyCard(entry?.context);if(!card)return false;card.dataset.ronaClientContractId=String(entry.context?.contract_id||'');card.dataset.ronaClientId=String(entry.context?.client_id||'');
  const unavailable=unavailableNode(card),active=String(entry.context?.contract_status||'').toUpperCase()==='ACTIVE';if(!active)return false;
  if(!entry.document?.storage_object_id){if(unavailable){const msg='Файл подписанного контракта не опубликован в кабинете';if(unavailable.textContent!==msg)unavailable.textContent=msg;unavailable.setAttribute('aria-disabled','true');unavailable.dataset.ronaContractUnavailable='authoritative-storage-not-materialized'}return false}
  const b=makeButton(entry,unavailable);if(unavailable){unavailable.replaceWith(b);return true}const anchor=contractAnchor(card),host=anchor?.parentElement||card;host.appendChild(b);return true;
}
function render(){
  if(state.rendering)return false;state.rendering=true;try{ensureStyle();clearRuntimeButtons();const entry=state.entry;if(!entry){document.documentElement.dataset.ronaClientContractDownloads='0';document.documentElement.dataset.ronaClientContractRuntime='v4-current-context-only';return true}hydrateFrozenClientModel(entry);const count=renderEntry(entry)?1:0;document.documentElement.dataset.ronaClientContractDownloads=String(count);document.documentElement.dataset.ronaClientContractRuntime='v4-current-context-only';return true}finally{state.rendering=false}
}
function scheduleRender(delay=120){clearTimeout(state.renderTimer);state.renderTimer=setTimeout(render,delay)}
function startObserver(){if(state.observer||!document.documentElement)return;state.observer=new MutationObserver(records=>{if(state.rendering)return;if(records.some(r=>r.type==='childList'||r.type==='characterData'))scheduleRender(80)});state.observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true})}
function start(){
  startObserver();const authority=contextAuthority();if(!authority){console.error('RONA contract download: context authority unavailable');return}
  state.unsubscribe=authority.subscribe(()=>refresh(true));refresh(true);
  document.addEventListener('click',()=>scheduleRender(140),true);document.addEventListener('change',()=>scheduleRender(80),true);
  window.addEventListener('pageshow',()=>{scheduleRender(0);if(Date.now()-state.lastLoad>10000)refresh(true)});window.addEventListener('popstate',()=>scheduleRender(80));window.addEventListener('hashchange',()=>scheduleRender(80));setInterval(()=>{if(document.visibilityState==='visible')refresh(true)},REFRESH_MS);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();