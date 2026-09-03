(()=>{'use strict';
const MARK='20260904-client-contract-v5-company-directory-authority';
const PREVIOUS_MARK='20260902-client-contract-v4-current-context-authority';
const COMPAT_MARK='20260829-client-contract-v3-authoritative-projection-v5';
if(window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V3__===MARK)return;
window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V3__=MARK;
window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V2__=MARK;
window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V1__=MARK;

const API='/portal/api',REFRESH_MS=30000,STYLE_ID='ronaClientContractDownloadV3Style';
const state={entry:null,loading:false,lastLoad:0,renderTimer:0,currentKey:'',observer:null,rendering:false,unsubscribe:null};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('ru-RU');
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
async function waitForAuthority(timeoutMs=15000){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    const authority=contextAuthority();
    if(authority){await authority.whenReady();return authority}
    await new Promise(resolve=>setTimeout(resolve,60));
  }
  throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');
}
function visible(el){if(!el||!el.isConnected)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0}
function setNodeText(el,value){if(!el)return false;const next=String(value??'');if(String(el.textContent??'')===next)return false;el.textContent=next;return true}
function tokenKey(v){return low(v).replace(new RegExp('['+APOSTROPHES+']','g'),'').replace(/[^a-zа-яё0-9]+/gi,'')}
function legalWords(name){return (norm(name).match(/[A-Za-zА-Яа-яЁё0-9]+(?:['’‘`´ʼ-][A-Za-zА-Яа-яЁё0-9]+)*/g)||[]).filter(Boolean)}
function canonicalBusinessWords(ctx){const words=legalWords(ctx?.legal_name);while(words.length&&GENERIC.has(low(words[0])))words.shift();return words}
function identityTokens(ctx){return canonicalBusinessWords(ctx).map(tokenKey).filter(x=>x.length>=3&&!GENERIC.has(x)).filter((x,i,a)=>a.indexOf(x)===i)}
function compactLegalName(ctx){
  const legal=norm(ctx?.legal_name);if(!legal)return norm(ctx?.client_id)||'Компания';
  const rules=[
    [/^общество с ограниченной ответственностью\s+/iu,'ООО '],
    [/^общество с дополнительной ответственностью\s+/iu,'ОДО '],
    [/^публичное акционерное общество\s+/iu,'ПАО '],
    [/^непубличное акционерное общество\s+/iu,'АО '],
    [/^закрытое акционерное общество\s+/iu,'ЗАО '],
    [/^открытое акционерное общество\s+/iu,'ОАО '],
    [/^акционерное общество\s+/iu,'АО '],
    [/^limited liability company\s+/iu,'LLC ']
  ];
  for(const [re,prefix] of rules)if(re.test(legal))return legal.replace(re,prefix);
  return legal;
}
function formatDate(v){
  const s=norm(v);if(!/^\d{4}-\d{2}-\d{2}/.test(s))return '';
  const [y,m,d]=s.slice(0,10).split('-');return `${d}.${m}.${y}`;
}
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
function effectiveContext(base,detail){const dc=detail?.contract||{},number=norm(dc.current_external_contract_number)||norm(base?.current_external_contract_number)||norm(dc.contract_id)||norm(base?.contract_id)||null;return{...base,...dc,current_external_contract_number:number}}
function frozenContexts(){try{if(typeof CLIENT_CONTEXTS!=='undefined'&&CLIENT_CONTEXTS&&typeof CLIENT_CONTEXTS==='object')return CLIENT_CONTEXTS}catch{}return null}
function hydrateFrozenClientModel(entry){
  const model=frozenContexts(),ctx=entry?.context||{},id=norm(ctx.contract_id),num=norm(ctx.current_external_contract_number||ctx.contract_id);if(!model||!id)return 0;
  const row=model[id];if(!row||typeof row!=='object')return 0;
  row.clientId=norm(ctx.client_id);row.contractId=id;row.companyName=compactLegalName(ctx);row.legalName=norm(ctx.legal_name);row.contractNo=num.replace(/^№\s*/u,'');row.contractDate=formatDate(ctx.effective_from);row.applicationsCount=entry.applications.length;row.dealsCount=entry.deals.length;row.documentsCount=entry.documents.length;row.contractStateBlocked=String(ctx.contract_status||'').toUpperCase()!=='ACTIVE';if(!row.contractStateBlocked&&/уточн/i.test(String(row.status||'')))row.status='Действует';
  document.documentElement.dataset.ronaClientContractModel='authoritative';return 1;
}
function publishState(){
  const entry=state.entry,ctx=entry?.context||null;
  window.__RONA_CLIENT_CONTRACT_DOWNLOAD_STATE__={version:MARK,previous:PREVIOUS_MARK,compat:COMPAT_MARK,current_contract_id:ctx?.contract_id||null,context_source:'RONA_CLIENT_CONTEXT_AUTHORITY',scope:'CURRENT_CONTEXT_ONLY',entries:entry?[{client_id:ctx.client_id||null,legal_name:ctx.legal_name||null,contract_id:ctx.contract_id||null,current_external_contract_number:ctx.current_external_contract_number||null,contract_status:ctx.contract_status||null,document_id:entry.document?.document_id||null,storage_object_id:entry.document?.storage_object_id||null,applications:entry.applications.length,deals:entry.deals.length,documents:entry.documents.length,current:true}]:[],loadedAt:new Date().toISOString()};
}
async function refresh(force=false){
  if(state.loading)return;if(!force&&Date.now()-state.lastLoad<REFRESH_MS){render();return}state.loading=true;
  try{
    const authority=await waitForAuthority(),current=authority.getCurrentContext();
    if(!current){state.entry=null;state.currentKey='';state.lastLoad=Date.now();publishState();render();return}
    const key=contextKey(current),detail=await request('/v1/client/context?clientId='+encodeURIComponent(current.client_id)+'&contractId='+encodeURIComponent(current.contract_id));
    if(contextKey(authority.getCurrentContext())!==key)return;
    const data=detail?.data||{},context=effectiveContext(current,data);
    state.entry={context,document:currentContractDocument(data.documents)};
    state.entry.applications=Array.isArray(data.applications)?data.applications:[];
    state.entry.deals=Array.isArray(data.deals)?data.deals:[];
    state.entry.documents=Array.isArray(data.documents)?data.documents:[];
    state.entry.payments=Array.isArray(data.payments)?data.payments:[];
    state.currentKey=key;state.lastLoad=Date.now();hydrateFrozenClientModel(state.entry);publishState();render();
  }catch(error){console.error('RONA contract current-context projection',error)}finally{state.loading=false}
}
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;
  s.textContent=`button[data-rona-contract-download-v3]{appearance:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;min-height:30px!important;padding:6px 11px!important;border:1px solid rgba(230,190,82,.38)!important;border-radius:999px!important;background:linear-gradient(180deg,rgba(230,190,82,.13),rgba(230,190,82,.07))!important;color:#ecd27e!important;font-family:inherit!important;font-size:10.5px!important;line-height:1.15!important;font-weight:820!important;letter-spacing:.02em!important;white-space:nowrap!important;cursor:pointer!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)!important}button[data-rona-contract-download-v3]::before{content:'↓';font-size:13px;font-weight:900;color:#67d9fb}@media(hover:hover) and (pointer:fine){button[data-rona-contract-download-v3]:hover{border-color:rgba(101,217,255,.55)!important;background:rgba(101,217,255,.11)!important;color:#ddf9ff!important}}button[data-rona-contract-download-v3][disabled]{cursor:wait!important;opacity:.72!important}[data-rona-current-company-status]{background:transparent!important;border-color:transparent!important;box-shadow:none!important;cursor:default!important;pointer-events:none!important;transform:none!important}`;document.head.appendChild(s);
}
function leafNodes(root){return [...root.querySelectorAll('button,a,span,small,strong,p,div')].filter(e=>e.childElementCount===0&&norm(e.textContent))}
function leafByText(root,predicate){return leafNodes(root).find(e=>predicate(low(e.textContent)))||null}
function findCompanyCard(ctx){
  if(!ctx)return null;const main=document.querySelector('main,[role="main"]');if(!main)return null;
  const contract=CSS.escape(norm(ctx.contract_id)),client=CSS.escape(norm(ctx.client_id));
  const direct=main.querySelector(`[data-rona-client-contract-id="${contract}"],[data-contract-id="${contract}"],[data-client-id="${client}"]`);
  if(direct&&visible(direct)&&!direct.closest('header,nav,aside,[role="navigation"]')){const card=direct.closest('article,section,li,div')||direct,t=low(card.textContent);if(t.includes('подписанный контракт')||t.includes('текущая компания'))return card}
  const contractKey=low(ctx.contract_id),clientKey=low(ctx.client_id),tokens=identityTokens(ctx),c=[];
  for(const node of main.querySelectorAll('article,section,li,div')){
    if(!visible(node)||node.closest('header,nav,aside,[role="navigation"]'))continue;
    const t=low(node.textContent);if(!t||t.length>9000||(!t.includes('подписанный контракт')&&!t.includes('текущая компания')))continue;
    const compact=tokenKey(t),hc=contractKey&&t.includes(contractKey),hi=clientKey&&t.includes(clientKey);let tokenScore=0;for(const x of tokens)if(compact.includes(x))tokenScore+=40;
    if(!hc&&!hi&&tokenScore<40&&!(t.includes('подписанный контракт')&&t.includes('текущая компания')))continue;
    c.push({node,score:(hc?10000:0)+(hi?3000:0)+tokenScore+500-Math.min(t.length,8000)/8,len:t.length});
  }
  c.sort((a,b)=>b.score-a.score||a.len-b.len);return c[0]?.node||null;
}
function setMetric(card,labelText,value,relabel){
  const label=leafByText(card,t=>t===labelText);if(!label)return false;
  if(relabel)setNodeText(label,relabel);
  let box=label.parentElement;
  for(let depth=0;box&&box!==card&&depth<3;depth++,box=box.parentElement){
    const n=leafNodes(box).find(el=>el!==label&&/^\d+$/.test(norm(el.textContent)));
    if(n){setNodeText(n,String(value));return true}
  }
  return false;
}
function hideRedundantCompanyAlias(displayLeaf,card){
  if(!displayLeaf)return false;const main=document.querySelector('main,[role="main"]'),roots=[];let root=card;
  for(let depth=0;root&&root!==main&&depth<4;depth++,root=root.parentElement)roots.push(root);
  const displayRect=displayLeaf.getBoundingClientRect(),seen=new Set(),candidates=[];
  for(const scope of roots)for(const el of scope.querySelectorAll('small,span,strong,div')){
    if(seen.has(el)||el===displayLeaf||el.childElementCount!==0||!visible(el))continue;seen.add(el);
    const text=norm(el.textContent);if(!/^[A-Z][A-Z0-9&.' -]{4,}$/u.test(text)||/^RONA-C/u.test(text)||/RONA TRADE/u.test(text)||/CLIENT DIRECTORY/u.test(text))continue;
    const r=el.getBoundingClientRect(),vertical=displayRect.top-r.bottom,horizontal=Math.abs(r.left-displayRect.left);
    if(vertical>=-8&&vertical<=90&&horizontal<=220)candidates.push({el,score:vertical+horizontal/8});
  }
  candidates.sort((a,b)=>a.score-b.score);const alias=candidates[0]?.el||null;if(!alias)return false;
  alias.style.setProperty('display','none','important');alias.setAttribute('aria-hidden','true');alias.dataset.ronaRedundantCompanyAlias='hidden';return true;
}
function syncCompanyCard(entry,card){
  if(!entry||!card)return;const ctx=entry.context,display=compactLegalName(ctx),external=norm(ctx.current_external_contract_number||ctx.contract_id),effective=formatDate(ctx.effective_from),leaves=leafNodes(card);
  for(const el of leaves){
    const before=norm(el.textContent),l=low(before);if(!before)continue;
    if(/^RONA-C\d{3}$/i.test(before)){setNodeText(el,ctx.client_id);continue}
    if(/^RONA-C\d{3}-CTR-\d{4}-\d{3,}$/i.test(before)){setNodeText(el,ctx.contract_id);continue}
    if(/^контракт\b/iu.test(before)&&!l.includes('подписанный контракт')&&!l.includes('скач')){setNodeText(el,`Контракт ${external}${effective?' · '+effective:''}`);continue}
    if((/^(общество с |ооо\b|осоо\b|llc\b)/iu.test(before)||/[«»]/u.test(before))&&!l.includes('контракт')&&!l.includes('договор')){setNodeText(el,display);continue}
    if(/межсистемн|договорной контур|дополнительн.*сверк|контракт не требуется/iu.test(before)){
      setNodeText(el,entry.document?.storage_object_id?'Подписанный договор зарегистрирован и доступен для скачивания.':'Подписанный договор зарегистрирован. Электронный файл пока не опубликован.');
      continue;
    }
  }
  const refreshed=leafNodes(card),displayLeaf=refreshed.find(el=>norm(el.textContent)===display)||null;
  hideRedundantCompanyAlias(displayLeaf,card);
  setMetric(card,'заявок',entry.applications.length);
  setMetric(card,'сделок',entry.deals.length);
  if(!setMetric(card,'действий',entry.documents.length,'ДОКУМЕНТОВ'))setMetric(card,'документов',entry.documents.length);
  card.dataset.ronaClientContractId=String(ctx.contract_id||'');card.dataset.ronaClientId=String(ctx.client_id||'');card.dataset.ronaCompanyDirectorySource='client-context-api';card.dataset.ronaCompanyDirectoryUpdatedAt=new Date().toISOString();
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
function clearRuntimeButtons(entry){
  for(const old of document.querySelectorAll('button[data-rona-contract-download],button[data-rona-contract-download-v2]'))old.remove();
  const current=norm(entry?.context?.contract_id);
  for(const old of document.querySelectorAll('button[data-rona-contract-download-v3]'))if(!current||norm(old.dataset.ronaContractDownloadV3)!==current)old.remove();
}
function renderEntry(entry){
  const card=findCompanyCard(entry?.context);if(!card)return false;syncCompanyCard(entry,card);
  const unavailable=unavailableNode(card),anchor=contractAnchor(card),active=String(entry.context?.contract_status||'').toUpperCase()==='ACTIVE';if(!active||(!unavailable&&!anchor))return false;
  if(!entry.document?.storage_object_id){if(unavailable){const msg='Файл подписанного контракта не опубликован в кабинете';setNodeText(unavailable,msg);unavailable.setAttribute('aria-disabled','true');unavailable.dataset.ronaContractUnavailable='authoritative-storage-not-materialized'}return false}
  const existing=card.querySelector('button[data-rona-contract-download-v3]');if(existing){existing.dataset.storageObjectId=String(entry.document.storage_object_id);return true}
  const b=makeButton(entry,unavailable);if(unavailable){unavailable.replaceWith(b);return true}anchor.parentElement.appendChild(b);return true;
}
function render(){
  if(state.rendering)return false;state.rendering=true;try{ensureStyle();const entry=state.entry;clearRuntimeButtons(entry);if(!entry){document.documentElement.dataset.ronaClientContractDownloads='0';document.documentElement.dataset.ronaClientContractRuntime='v5-company-directory-authority';return true}hydrateFrozenClientModel(entry);const count=renderEntry(entry)?1:0;document.documentElement.dataset.ronaClientContractDownloads=String(count);document.documentElement.dataset.ronaClientContractRuntime='v5-company-directory-authority';return true}finally{state.rendering=false}
}
function scheduleRender(delay=120){clearTimeout(state.renderTimer);state.renderTimer=setTimeout(render,delay)}
function startObserver(){if(state.observer||!document.documentElement)return;state.observer=new MutationObserver(records=>{if(state.rendering)return;if(records.some(r=>r.type==='childList'||r.type==='characterData'))scheduleRender(80)});state.observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true})}
async function start(){
  startObserver();
  let authority;try{authority=await waitForAuthority()}catch(error){console.error('RONA contract download: context authority unavailable',error);return}
  if(typeof authority.subscribe==='function')state.unsubscribe=authority.subscribe(()=>refresh(true));
  window.addEventListener('rona:client-context-ready',()=>refresh(true));window.addEventListener('rona:client-context-changed',()=>refresh(true));
  refresh(true);
  document.addEventListener('click',()=>scheduleRender(140),true);document.addEventListener('change',()=>scheduleRender(80),true);
  window.addEventListener('pageshow',()=>{scheduleRender(0);if(Date.now()-state.lastLoad>10000)refresh(true)});window.addEventListener('popstate',()=>scheduleRender(80));window.addEventListener('hashchange',()=>scheduleRender(80));setInterval(()=>{if(document.visibilityState==='visible')refresh(true)},REFRESH_MS);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();