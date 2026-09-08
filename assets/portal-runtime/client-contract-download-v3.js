(()=>{'use strict';
const MARK='20260906-client-contract-v11-authoritative-company-metrics';
const COMPANY_ALIAS_COMPAT='20260904-client-contract-v6-company-alias-slot-removed';
const PREVIOUS_MARK='20260902-client-contract-v4-current-context-authority';
const COMPAT_MARK='20260829-client-contract-v3-authoritative-projection-v5';
if(window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V3__===MARK)return;
window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V3__=MARK;
window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V2__=MARK;
window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V1__=MARK;

const API='/portal/api',REFRESH_MS=30000,STYLE_ID='ronaClientContractDownloadV3Style';
const state={entry:null,loading:false,pendingImmediate:false,lastLoad:0,renderTimer:0,currentKey:'',observer:null,rendering:false,unsubscribe:null};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('ru-RU');
const upper=v=>norm(v).toUpperCase();
const CURRENT_DEAL_ID=/^DEAL-\d{4}-\d{3,}$/i;
const TERMINAL_DEALS=new Set(['CLOSED','COMPLETED','DONE','CANCELLED','RESOURCE_DENIED']);
const TERMINAL_APPLICATIONS=new Set(['DEAL_REGISTERED','ARCHIVED','CANCELLED','REJECTED','CLOSED']);
function authoritativeCompanyDirectoryOwnsCards(){const d=document.documentElement.dataset;return Boolean(window.__RONA_PORTAL_CLIENT_COMPANY_DIRECTORY__)||(d.ronaClientCompanyDirectoryAtomic==='true'&&d.ronaClientCompanyDirectorySource==='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'&&d.ronaClientCompanyDirectoryDocumentsPredicate==='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY')}
function metricNumber(value){if(value===null||value===undefined||typeof value==='boolean'||(typeof value==='string'&&!/^\d+$/.test(value.trim())))return null;const n=Number(value);return Number.isInteger(n)&&n>=0?n:null}
function currentCompanyMetrics(entry){
  const authoritative=entry?.company_metrics&&typeof entry.company_metrics==='object'?entry.company_metrics:null;
  const applicationsTotal=metricNumber(authoritative?.applications_total),dealsTotal=metricNumber(authoritative?.deals_total),documentsTotal=metricNumber(authoritative?.documents_total);
  const sourceValid=authoritative?.source==='AUTHORITATIVE_CURRENT_CONTEXT_DB',predicateValid=authoritative?.documents_predicate==='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY';
  const ready=applicationsTotal!==null&&dealsTotal!==null&&documentsTotal!==null&&sourceValid&&predicateValid;
  return ready
    ?{applications:applicationsTotal,deals:dealsTotal,documents:documentsTotal,source:authoritative.source,documents_predicate:authoritative.documents_predicate,ready:true}
    :{applications:null,deals:null,documents:null,source:'AUTHORITATIVE_METRICS_UNAVAILABLE',documents_predicate:null,ready:false};
}
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
  if(authoritativeCompanyDirectoryOwnsCards())return 0;
  const model=frozenContexts(),ctx=entry?.context||{},id=norm(ctx.contract_id),num=norm(ctx.current_external_contract_number||ctx.contract_id);if(!model||!id)return 0;
  const row=model[id];if(!row||typeof row!=='object')return 0;
  row.clientId=norm(ctx.client_id);row.contractId=id;row.companyName=compactLegalName(ctx);row.legalName=norm(ctx.legal_name);row.contractNo=num.replace(/^№\s*/u,'');row.contractDate=formatDate(ctx.effective_from);const metrics=currentCompanyMetrics(entry);row.applicationsCount=metrics.ready?metrics.applications:'—';row.dealsCount=metrics.ready?metrics.deals:'—';row.documentsCount=metrics.ready?metrics.documents:'—';row.contractStateBlocked=String(ctx.contract_status||'').toUpperCase()!=='ACTIVE';if(!row.contractStateBlocked&&/уточн/i.test(String(row.status||'')))row.status='Действует';
  document.documentElement.dataset.ronaClientContractModel='authoritative';return 1;
}
function publishState(){
  const entry=state.entry,ctx=entry?.context||null,metrics=currentCompanyMetrics(entry);
  window.__RONA_CLIENT_CONTRACT_DOWNLOAD_STATE__={version:MARK,previous:PREVIOUS_MARK,compat:COMPAT_MARK,current_contract_id:ctx?.contract_id||null,context_source:'RONA_CLIENT_CONTEXT_AUTHORITY',scope:'CURRENT_CONTEXT_ONLY',entries:entry?[{client_id:ctx.client_id||null,legal_name:ctx.legal_name||null,contract_id:ctx.contract_id||null,current_external_contract_number:ctx.current_external_contract_number||null,contract_status:ctx.contract_status||null,document_id:entry.document?.document_id||null,storage_object_id:entry.document?.storage_object_id||null,applications:metrics.applications,deals:metrics.deals,documents:metrics.documents,metrics_ready:metrics.ready,metrics_source:metrics.source,documents_predicate:metrics.documents_predicate,current:true}]:[],loadedAt:new Date().toISOString()};
}
async function refresh(force=false){
  if(state.loading){if(force)state.pendingImmediate=true;return}if(!force&&Date.now()-state.lastLoad<REFRESH_MS){render();return}state.loading=true;
  try{
    const authority=await waitForAuthority(),current=authority.getCurrentContext();
    if(!current){state.entry=null;state.currentKey='';state.lastLoad=Date.now();publishState();render();return}
    const key=contextKey(current);
    if(state.currentKey!==key){state.entry=null;state.currentKey=key;state.lastLoad=0;primeCompanyDirectory(current);publishState();render()}
    const detail=await request('/v1/client/context?clientId='+encodeURIComponent(current.client_id)+'&contractId='+encodeURIComponent(current.contract_id));
    if(contextKey(authority.getCurrentContext())!==key)return;
    const data=detail?.data||{},context=effectiveContext(current,data);
    state.entry={context,document:currentContractDocument(data.documents)};
    state.entry.applications=Array.isArray(data.applications)?data.applications:[];
    state.entry.deals=Array.isArray(data.deals)?data.deals:[];
    state.entry.documents=Array.isArray(data.documents)?data.documents:[];
    state.entry.payments=Array.isArray(data.payments)?data.payments:[];
    state.entry.company_metrics=data.company_metrics&&typeof data.company_metrics==='object'?data.company_metrics:null;
    state.currentKey=key;state.lastLoad=Date.now();hydrateFrozenClientModel(state.entry);publishState();render();
  }catch(error){console.error('RONA contract current-context projection',error)}finally{state.loading=false;if(state.pendingImmediate){state.pendingImmediate=false;queueMicrotask(()=>refresh(true))}}
}
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;
  s.textContent=`button[data-rona-contract-download-v3]{appearance:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;min-height:30px!important;padding:6px 11px!important;border:1px solid rgba(230,190,82,.38)!important;border-radius:999px!important;background:linear-gradient(180deg,rgba(230,190,82,.13),rgba(230,190,82,.07))!important;color:#ecd27e!important;font-family:inherit!important;font-size:10.5px!important;line-height:1.15!important;font-weight:820!important;letter-spacing:.02em!important;white-space:nowrap!important;cursor:pointer!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)!important}button[data-rona-contract-download-v3]::before{content:'↓';font-size:13px;font-weight:900;color:#67d9fb}@media(hover:hover) and (pointer:fine){button[data-rona-contract-download-v3]:hover{border-color:rgba(101,217,255,.55)!important;background:rgba(101,217,255,.11)!important;color:#ddf9ff!important}}button[data-rona-contract-download-v3][disabled]{cursor:wait!important;opacity:.72!important}[data-rona-current-company-status]{background:transparent!important;border-color:transparent!important;box-shadow:none!important;cursor:default!important;pointer-events:none!important;transform:none!important}`;document.head.appendChild(s);
}
function leafNodes(root){return [...root.querySelectorAll('button,a,span,small,strong,p,div')].filter(e=>e.childElementCount===0&&norm(e.textContent))}
function leafByText(root,predicate){return leafNodes(root).find(e=>predicate(low(e.textContent)))||null}
function eligibleCompanyNode(node){return visible(node)&&!node.closest('header,nav,aside,[role="navigation"]')}
function companyMetricSlot(owner,labels,structural=false){
  if(!owner)return null;const eligible=el=>structural?el.isConnected:visible(el),matches=leafNodes(owner).filter(el=>eligible(el)&&labels.includes(low(el.textContent)));if(matches.length!==1)return null;const label=matches[0];let box=label.parentElement;
  for(let depth=0;box&&owner.contains(box)&&depth<3;depth++,box=box.parentElement){const values=leafNodes(box).filter(el=>el!==label&&eligible(el)&&/^(?:\d+|—)$/.test(norm(el.textContent)));if(values.length===1)return{label,value:values[0]};if(values.length>1)return null;if(box===owner)break}
  return null;
}
function companyMetricSlots(owner,structural=false){
  const applications=companyMetricSlot(owner,['заявок'],structural),deals=companyMetricSlot(owner,['сделок'],structural),documents=companyMetricSlot(owner,['документов','действий'],structural);
  return applications&&deals&&documents?{applications,deals,documents}:null;
}
function clearCompanyDirectoryState(node){if(!node)return;delete node.dataset.ronaCompanyDirectoryHydration;delete node.dataset.ronaCompanyDirectorySource;delete node.dataset.ronaCompanyDirectoryDocumentsPredicate;delete node.dataset.ronaCompanyDirectoryUpdatedAt}
function findCompanyIdentityAnchor(ctx){
  if(!ctx)return null;const main=document.querySelector('main,[role="main"]');if(!main)return null;const rawContract=norm(ctx.contract_id),rawClient=norm(ctx.client_id);if(!rawContract||!rawClient)return null;const contract=CSS.escape(rawContract),client=CSS.escape(rawClient);
  const exact=[...main.querySelectorAll(`[data-rona-client-id="${client}"][data-rona-client-contract-id="${contract}"]`)].filter(eligibleCompanyNode);if(exact.length===1)return exact[0];if(exact.length>1)return null;
  const direct=[...new Set([...main.querySelectorAll(`[data-rona-client-contract-id="${contract}"]`),...main.querySelectorAll(`[data-contract-id="${contract}"]`),...main.querySelectorAll(`[data-client-id="${client}"]`)])].filter(eligibleCompanyNode);
  if(direct.length){const scored=direct.map(node=>{const t=low(node.textContent),score=(norm(node.dataset.ronaClientContractId)===rawContract?1000:0)+(norm(node.dataset.contractId)===rawContract?800:0)+(norm(node.dataset.ronaClientId)===rawClient?500:0)+(norm(node.dataset.clientId)===rawClient?400:0)+(t.includes(low(rawContract))?120:0)+(t.includes(low(rawClient))?60:0);return{node,score}}).sort((a,b)=>b.score-a.score);if(scored[0]?.score>0&&(scored.length===1||scored[0].score>scored[1].score))return scored[0].node;if(scored.length===1)return scored[0].node;return null}
  const contractKey=low(ctx.contract_id),clientKey=low(ctx.client_id),tokens=identityTokens(ctx),c=[];
  for(const node of main.querySelectorAll('article,section,li,div')){if(!eligibleCompanyNode(node))continue;const t=low(node.textContent);if(!t||t.length>9000||(!t.includes('подписанный контракт')&&!t.includes('текущая компания')))continue;const compact=tokenKey(t),hc=contractKey&&t.includes(contractKey),hi=clientKey&&t.includes(clientKey);let tokenScore=0;for(const x of tokens)if(compact.includes(x))tokenScore+=40;if(!hc&&!hi&&tokenScore<40&&!(t.includes('подписанный контракт')&&t.includes('текущая компания')))continue;c.push({node,score:(hc?10000:0)+(hi?3000:0)+tokenScore+500-Math.min(t.length,8000)/8,len:t.length})}
  c.sort((a,b)=>b.score-a.score||a.len-b.len);if(!c.length)return null;if(c.length>1&&c[0].score===c[1].score&&c[0].len===c[1].len)return null;return c[0].node;
}
function canonicalCompanyGridExactCard(ctx){
  const rawClient=norm(ctx?.client_id),rawContract=norm(ctx?.contract_id);if(!rawClient||!rawContract)return null;const grid=document.querySelector('section#page-companies #clientCompanyGrid');if(!grid||!grid.isConnected)return null;
  const exact=[...grid.querySelectorAll('article.company-switch-card')].filter(card=>card.isConnected&&norm(card.dataset.ronaCompanyAuthorizationScope)==='authorized').filter(card=>{
    const clientAttrs=[norm(card.dataset.ronaClientId),norm(card.dataset.clientId)].filter(Boolean),contractAttrs=[norm(card.dataset.ronaClientContractId),norm(card.dataset.contractId)].filter(Boolean);
    if(clientAttrs.some(value=>value!==rawClient)||contractAttrs.some(value=>value!==rawContract))return false;
    const values=new Set(leafNodes(card).map(el=>norm(el.textContent)).filter(Boolean));
    return (clientAttrs.includes(rawClient)||values.has(rawClient))&&(contractAttrs.includes(rawContract)||values.has(rawContract));
  });
  return exact.length===1?exact[0]:null;
}
function bindCompanyOwner(resolved,ctx){
  const {anchor,card}=resolved;if(anchor!==card){clearCompanyDirectoryState(anchor);if(norm(anchor.dataset.ronaClientId)===norm(ctx.client_id))delete anchor.dataset.ronaClientId;if(norm(anchor.dataset.ronaClientContractId)===norm(ctx.contract_id))delete anchor.dataset.ronaClientContractId}
  card.dataset.ronaClientContractId=String(ctx.contract_id||'');card.dataset.ronaClientId=String(ctx.client_id||'');
}
function resolveCanonicalCompanyCardStructurally(ctx){
  const card=canonicalCompanyGridExactCard(ctx);if(!card)return null;const slots=companyMetricSlots(card,true);if(!slots)return null;const resolved={anchor:card,card,slots,depth:0};bindCompanyOwner(resolved,ctx);return resolved;
}
function resolveCompanyCard(ctx){
  const anchor=findCompanyIdentityAnchor(ctx),main=document.querySelector('main,[role="main"]');
  if(anchor&&main){let node=anchor;for(let depth=0;node&&main.contains(node)&&depth<=6;depth++,node=node.parentElement){if(!eligibleCompanyNode(node)){if(node===main)break;continue}const slots=companyMetricSlots(node);if(slots){const resolved={anchor,card:node,slots,depth};bindCompanyOwner(resolved,ctx);return resolved}if(node===main)break}clearCompanyDirectoryState(anchor)}
  return resolveCanonicalCompanyCardStructurally(ctx);
}
function findCompanyCard(ctx){return resolveCompanyCard(ctx)?.card||null}
function setMetricSlot(slot,value,relabel){if(!slot?.label||!slot?.value)return false;if(relabel)setNodeText(slot.label,relabel);setNodeText(slot.value,value==null?'—':String(value));return norm(slot.value.textContent)===(value==null?'—':String(value))}
function setMetric(card,labelText,value,relabel){const slot=companyMetricSlot(card,[labelText]);return setMetricSlot(slot,value,relabel)}
function setCompanyDirectoryState(resolved,ctx,hydration,source,predicate){const card=resolved?.card;if(!card)return false;bindCompanyOwner(resolved,ctx);card.dataset.ronaCompanyDirectoryHydration=hydration;card.dataset.ronaCompanyDirectorySource=source;card.dataset.ronaCompanyDirectoryDocumentsPredicate=String(predicate||'');card.dataset.ronaCompanyDirectoryUpdatedAt=new Date().toISOString();return true}
function neutralizeCompanyMetrics(resolved,ctx){
  if(!resolved?.slots)return false;clearCompanyDirectoryState(resolved.card);const ok=setMetricSlot(resolved.slots.applications,'—')&&setMetricSlot(resolved.slots.deals,'—')&&setMetricSlot(resolved.slots.documents,'—','ДОКУМЕНТОВ');if(!ok){clearCompanyDirectoryState(resolved.card);return false}return setCompanyDirectoryState(resolved,ctx,'pending','AUTHORITATIVE_METRICS_UNAVAILABLE','');
}
function hideRedundantCompanyAlias(){return false}
function primeCompanyDirectory(ctx){
  if(!ctx||authoritativeCompanyDirectoryOwnsCards())return false;const resolved=resolveCompanyCard(ctx);if(!resolved)return false;const card=resolved.card;
  const display=compactLegalName(ctx),external=norm(ctx.current_external_contract_number||ctx.contract_id),effective=formatDate(ctx.effective_from);
  hideRedundantCompanyAlias(card);
  for(const el of leafNodes(card)){
    const before=norm(el.textContent),l=low(before);if(!before)continue;
    if(/^RONA-C\d{3}$/i.test(before)){setNodeText(el,ctx.client_id);continue}
    if(/^RONA-C\d{3}-CTR-\d{4}-\d{3,}$/i.test(before)){setNodeText(el,ctx.contract_id);continue}
    if(/^контракт\b/iu.test(before)&&!l.includes('подписанный контракт')&&!l.includes('скач')){setNodeText(el,'Контракт '+external+(effective?' · '+effective:''));continue}
    if((/^(общество с |ооо\b|осоо\b|llc\b)/iu.test(before)||/[«»]/u.test(before))&&!l.includes('контракт')&&!l.includes('договор')){setNodeText(el,display);continue}
  }
  const sameReady=card.dataset.ronaCompanyDirectoryHydration==='ready'&&norm(card.dataset.ronaClientContractId)===norm(ctx.contract_id)&&norm(card.dataset.ronaClientId)===norm(ctx.client_id);
  if(!sameReady&&!neutralizeCompanyMetrics(resolved,ctx))return false;
  bindCompanyOwner(resolved,ctx);return true;
}
function syncCompanyCard(entry,resolved){
  if(authoritativeCompanyDirectoryOwnsCards()||!entry||!resolved)return false;const card=resolved.card,ctx=entry.context,display=compactLegalName(ctx),external=norm(ctx.current_external_contract_number||ctx.contract_id),effective=formatDate(ctx.effective_from),leaves=leafNodes(card);
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
  hideRedundantCompanyAlias(card);
  const metrics=currentCompanyMetrics(entry),hydration=metrics.ready?'ready':'pending';clearCompanyDirectoryState(card);
  if(!metrics.ready)return neutralizeCompanyMetrics(resolved,ctx);
  const ok=setMetricSlot(resolved.slots.applications,metrics.applications)&&setMetricSlot(resolved.slots.deals,metrics.deals)&&setMetricSlot(resolved.slots.documents,metrics.documents,'ДОКУМЕНТОВ');if(!ok){clearCompanyDirectoryState(card);return false}
  return setCompanyDirectoryState(resolved,ctx,hydration,metrics.source,metrics.documents_predicate);
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
  if(authoritativeCompanyDirectoryOwnsCards())return 0;
  for(const old of document.querySelectorAll('button[data-rona-contract-download],button[data-rona-contract-download-v2]'))old.remove();
  const current=norm(entry?.context?.contract_id);
  for(const old of document.querySelectorAll('button[data-rona-contract-download-v3]'))if(!current||norm(old.dataset.ronaContractDownloadV3)!==current)old.remove();
}
function renderEntry(entry){
  if(authoritativeCompanyDirectoryOwnsCards())return false;
  const resolved=resolveCompanyCard(entry?.context);if(!resolved||!syncCompanyCard(entry,resolved))return false;const card=resolved.card;
  const unavailable=unavailableNode(card),anchor=contractAnchor(card),active=String(entry.context?.contract_status||'').toUpperCase()==='ACTIVE';if(!active||(!unavailable&&!anchor))return false;
  if(!entry.document?.storage_object_id){if(unavailable){const msg='Файл подписанного контракта не опубликован в кабинете';setNodeText(unavailable,msg);unavailable.setAttribute('aria-disabled','true');unavailable.dataset.ronaContractUnavailable='authoritative-storage-not-materialized'}return false}
  const existing=card.querySelector('button[data-rona-contract-download-v3]');if(existing){existing.dataset.storageObjectId=String(entry.document.storage_object_id);return true}
  const b=makeButton(entry,unavailable);if(unavailable){unavailable.replaceWith(b);return true}anchor.parentElement.appendChild(b);return true;
}
function render(){
  if(state.rendering)return false;state.rendering=true;try{ensureStyle();if(authoritativeCompanyDirectoryOwnsCards()){document.documentElement.dataset.ronaClientContractRuntime='v11-source-standdown-all-authorized-directory';return true}const entry=state.entry;clearRuntimeButtons(entry);if(!entry){document.documentElement.dataset.ronaClientContractDownloads='0';document.documentElement.dataset.ronaClientContractRuntime='v6-company-alias-slot-removed';return true}hydrateFrozenClientModel(entry);const count=renderEntry(entry)?1:0;document.documentElement.dataset.ronaClientContractDownloads=String(count);document.documentElement.dataset.ronaClientContractRuntime='v6-company-alias-slot-removed';return true}finally{state.rendering=false}
}
function scheduleRender(delay=120){clearTimeout(state.renderTimer);state.renderTimer=setTimeout(render,delay)}
function primeFromAuthority(authority){if(authoritativeCompanyDirectoryOwnsCards())return false;const current=authority?.getCurrentContext?.();return current?primeCompanyDirectory(current):false}
function refreshCompanyDirectoryNow(authority,delay=0){setTimeout(()=>{if(!primeFromAuthority(authority))return;refresh(true)},delay)}
function startObserver(){if(state.observer||!document.documentElement)return;state.observer=new MutationObserver(records=>{if(state.rendering)return;if(records.some(r=>r.type==='childList'||r.type==='characterData'))scheduleRender(80)});state.observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true})}
async function start(){
  startObserver();
  let authority;try{authority=await waitForAuthority()}catch(error){console.error('RONA contract download: context authority unavailable',error);return}
  primeFromAuthority(authority);
  if(typeof authority.subscribe==='function')state.unsubscribe=authority.subscribe(()=>{primeFromAuthority(authority);refresh(true)});
  window.addEventListener('rona:client-context-ready',()=>{primeFromAuthority(authority);refresh(true)});window.addEventListener('rona:client-context-changed',()=>{primeFromAuthority(authority);refresh(true)});window.addEventListener('rona:client-company-directory-ready',()=>scheduleRender(0));
  refresh(true);[120,350,900,1800,3200].forEach(delay=>refreshCompanyDirectoryNow(authority,delay));
  document.addEventListener('click',()=>scheduleRender(140),true);document.addEventListener('click',()=>refreshCompanyDirectoryNow(authority,90),true);document.addEventListener('change',()=>{scheduleRender(80);refreshCompanyDirectoryNow(authority,20)},true);
  window.addEventListener('pageshow',()=>{scheduleRender(0);refreshCompanyDirectoryNow(authority,0);if(Date.now()-state.lastLoad>10000)refresh(true)});window.addEventListener('popstate',()=>{scheduleRender(80);refreshCompanyDirectoryNow(authority,20)});window.addEventListener('hashchange',()=>{scheduleRender(80);refreshCompanyDirectoryNow(authority,20)});setInterval(()=>{if(document.visibilityState==='visible')refresh(true)},REFRESH_MS);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
const OWNER_TYPO_MARK='RONA_CLIENT_OWNER_TYPOGRAPHY_110_V3_COMPUTED';
const OWNER_TYPO_SCALE=1.1;
const OWNER_TYPO_BASE_ATTR='data-rona-owner-typo-base';
let ownerTypoObserver=null,ownerTypoQueued=false,ownerTypoPending=new Set();
function ownerTypoExcluded(el){if(!el||el.nodeType!==1)return true;if(el.closest('svg,canvas,picture,img,video,#page-analytics,#analyticsPage,[data-page-panel="analytics"],[data-page-id="analytics"]'))return true;if(el.getAttribute('aria-hidden')==='true')return true;if(/(?:icon|logo|glyph)/i.test(String(el.className||'')))return true;return false}
function ownerTypoDirectText(el){if(ownerTypoExcluded(el)||el.matches('script,style,link,meta,template,noscript'))return false;if(el.matches('input,select,textarea,button,option'))return true;for(const node of el.childNodes){if(node.nodeType!==Node.TEXT_NODE)continue;const text=norm(node.textContent);if(!text)continue;if(text.length===1&&!/[A-Za-zА-Яа-яЁё0-9]/u.test(text))continue;return true}return false}
function ownerTypoTargets(root){if(!root||root.nodeType!==1)return[];const nodes=[root,...root.querySelectorAll('*')];return nodes.filter(el=>!el.hasAttribute(OWNER_TYPO_BASE_ATTR)&&ownerTypoDirectText(el))}
function ownerTypoApply(targets){const items=[...new Set(targets)].filter(el=>el?.isConnected&&!el.hasAttribute(OWNER_TYPO_BASE_ATTR)&&ownerTypoDirectText(el));if(!items.length)return 0;const restore=new Map();for(const el of items){for(let p=el.parentElement;p;p=p.parentElement){if(!p.hasAttribute(OWNER_TYPO_BASE_ATTR)||restore.has(p))continue;const base=Number(p.getAttribute(OWNER_TYPO_BASE_ATTR));if(!Number.isFinite(base)||base<=0)continue;restore.set(p,{value:p.style.getPropertyValue('font-size'),priority:p.style.getPropertyPriority('font-size')});p.style.setProperty('font-size',`${base}px`,'important')}}const baselines=items.map(el=>parseFloat(getComputedStyle(el).fontSize));for(const [el,old] of restore){if(old.value)el.style.setProperty('font-size',old.value,old.priority);else el.style.removeProperty('font-size')}let applied=0;items.forEach((el,index)=>{const base=baselines[index];if(!Number.isFinite(base)||base<=0)return;const scaled=Math.round(base*OWNER_TYPO_SCALE*10000)/10000;el.setAttribute(OWNER_TYPO_BASE_ATTR,String(base));el.setAttribute('data-rona-owner-typo-scaled','1.10');el.style.setProperty('font-size',`${scaled}px`,'important');applied++});document.documentElement.dataset.ronaClientOwnerTypography=OWNER_TYPO_MARK;return applied}
function ownerTypoFlush(){ownerTypoQueued=false;const roots=[...ownerTypoPending];ownerTypoPending.clear();const targets=[];for(const root of roots)targets.push(...ownerTypoTargets(root));ownerTypoApply(targets)}
function ownerTypoQueue(root){if(root?.nodeType===1)ownerTypoPending.add(root);if(ownerTypoQueued)return;ownerTypoQueued=true;queueMicrotask(ownerTypoFlush)}
function startOwnerTypography(){if(!document.body)return;ownerTypoApply(ownerTypoTargets(document.body));if(ownerTypoObserver)return;ownerTypoObserver=new MutationObserver(records=>{for(const record of records){if(record.type==='characterData'){ownerTypoQueue(record.target?.parentElement);continue}for(const node of record.addedNodes){if(node.nodeType===1)ownerTypoQueue(node);else if(node.nodeType===3)ownerTypoQueue(node.parentElement)}}});ownerTypoObserver.observe(document.body,{childList:true,subtree:true,characterData:true});window.RONA_CLIENT_OWNER_TYPOGRAPHY=Object.freeze({version:OWNER_TYPO_MARK,scale:OWNER_TYPO_SCALE,rescan:()=>ownerTypoApply(ownerTypoTargets(document.body))})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startOwnerTypography,{once:true});else startOwnerTypography();
})();