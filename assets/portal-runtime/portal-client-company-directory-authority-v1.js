(()=>{'use strict';
const MARK='20260908-pr431-authorized-company-directory-v2-atomic';
const LEGACY_CONTRACT_MARK='20260906-client-contract-v11-authoritative-company-metrics';
const DIRECTORY_SOURCE='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB';
const DOCUMENTS_PREDICATE='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY';
const REFRESH_MS=30000;
if(window.__RONA_PORTAL_CLIENT_COMPANY_DIRECTORY__===MARK)return;
window.__RONA_PORTAL_CLIENT_COMPANY_DIRECTORY__=MARK;
const state={base:null,directory:[],validated:false,active:false,loading:null,lastLoad:0,rendering:false,observer:null,timer:0,generation:0};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('ru-RU');
const pairKey=v=>`${norm(v?.client_id)}|${norm(v?.contract_id)}`;
const metric=v=>{if(v===null||v===undefined||typeof v==='boolean')return null;const n=Number(v);return Number.isInteger(n)&&n>=0?n:null};
const cloneRow=row=>row?Object.freeze({...row,current_signed_contract:row.current_signed_contract?Object.freeze({...row.current_signed_contract}):null}):null;
function authorizedSnapshot(){
  const contexts=state.base?.getAuthorizedContexts?.()||[];
  if(!Array.isArray(contexts)||contexts.length===0)return null;
  const map=new Map(),ordered=[];
  for(const ctx of contexts){const client_id=norm(ctx?.client_id),contract_id=norm(ctx?.contract_id),key=`${client_id}|${contract_id}`;if(!client_id||!contract_id||map.has(key))return null;const copy={...ctx,client_id,contract_id};map.set(key,copy);ordered.push(copy)}
  return{contexts:ordered,map};
}
function cleanDirectoryRow(row,authorized){
  if(!row||typeof row!=='object')return null;
  const key=pairKey(row),ctx=authorized.get(key);if(!ctx)return null;
  const applications_total=metric(row.applications_total),deals_total=metric(row.deals_total),documents_total=metric(row.documents_total);
  if(applications_total===null||deals_total===null||documents_total===null)return null;
  if(norm(row.source)!==DIRECTORY_SOURCE||norm(row.documents_predicate)!==DOCUMENTS_PREDICATE)return null;
  let current_signed_contract=null;
  if(row.current_signed_contract!==null&&row.current_signed_contract!==undefined){
    const contract=row.current_signed_contract;
    if(!contract||typeof contract!=='object')return null;
    const document_id=norm(contract.document_id),storage_object_id=norm(contract.storage_object_id),authoritative_filename=norm(contract.authoritative_filename);
    if(!document_id||!storage_object_id||!authoritative_filename)return null;
    current_signed_contract={document_id,storage_object_id,authoritative_filename};
  }
  return cloneRow({client_id:norm(ctx.client_id),legal_name:norm(row.legal_name||ctx.legal_name),registration_country:norm(row.registration_country||ctx.registration_country),contract_id:norm(ctx.contract_id),current_external_contract_number:norm(row.current_external_contract_number||ctx.current_external_contract_number),contract_status:norm(row.contract_status||ctx.contract_status),effective_from:row.effective_from||ctx.effective_from||null,effective_to:row.effective_to||ctx.effective_to||null,applications_total,deals_total,documents_total,documents_predicate:DOCUMENTS_PREDICATE,source:DIRECTORY_SOURCE,current_signed_contract});
}
function validateCompleteDirectory(body){
  const authorized=authorizedSnapshot();if(!authorized)return null;
  if(norm(body?.data?.company_directory_source)!==DIRECTORY_SOURCE)return null;
  const raw=Array.isArray(body?.data?.company_directory)?body.data.company_directory:null;
  if(!raw||raw.length!==authorized.contexts.length)return null;
  const rows=[],seen=new Set();
  for(const item of raw){const key=pairKey(item);if(!key||seen.has(key))return null;seen.add(key);const clean=cleanDirectoryRow(item,authorized.map);if(!clean)return null;rows.push(clean)}
  if(seen.size!==authorized.map.size)return null;
  const byKey=new Map(rows.map(row=>[pairKey(row),row]));
  const ordered=authorized.contexts.map(ctx=>byKey.get(pairKey(ctx))||null);if(ordered.some(row=>!row))return null;
  return{authorized,rows:ordered};
}
async function loadDirectory(force=false){
  if(state.loading)return state.loading;if(!state.base)return[];if(!force&&state.validated&&Date.now()-state.lastLoad<REFRESH_MS)return state.directory.map(cloneRow);
  state.loading=(async()=>{
    await state.base.whenReady();
    const body=force?await state.base.refreshCompanyDirectory('portal-client-company-directory-authority-v2'):await state.base.whenCompanyDirectory();
    const validated=validateCompleteDirectory(body);if(!validated)throw new Error('CLIENT_COMPANY_DIRECTORY_INCOMPLETE');
    state.directory=validated.rows.map(cloneRow);state.validated=true;state.lastLoad=Date.now();state.generation+=1;
    const committed=renderDirectory(state.generation);if(!committed)scheduleRender(0);
    return state.directory.map(cloneRow);
  })().finally(()=>{state.loading=null});
  return state.loading;
}
function leafNodes(root){return [...root.querySelectorAll('button,a,span,small,strong,p,div')].filter(el=>el.childElementCount===0&&norm(el.textContent))}
function metricSlot(card,labels){const matches=leafNodes(card).filter(el=>labels.includes(low(el.textContent)));if(matches.length!==1)return null;const label=matches[0];let box=label.parentElement;for(let depth=0;box&&card.contains(box)&&depth<4;depth++,box=box.parentElement){const values=leafNodes(box).filter(el=>el!==label&&/^(?:\d+|—)$/.test(norm(el.textContent)));if(values.length===1)return{label,value:values[0]};if(values.length>1)return null;if(box===card)break}return null}
function metricSlots(card){const applications=metricSlot(card,['заявок']),deals=metricSlot(card,['сделок']),documents=metricSlot(card,['документов','действий']);return applications&&deals&&documents?{applications,deals,documents}:null}
function cardScore(card,ctx,row){const text=low(card.textContent),client=low(ctx.client_id),contract=low(ctx.contract_id),external=low(row?.current_external_contract_number||ctx.current_external_contract_number),legal=low(row?.legal_name||ctx.legal_name);let score=0;const attrs=[norm(card.dataset.ronaClientId),norm(card.dataset.clientId)];const cattrs=[norm(card.dataset.ronaClientContractId),norm(card.dataset.ronaContractId),norm(card.dataset.contractId)];if(attrs.includes(norm(ctx.client_id)))score+=4000;if(cattrs.includes(norm(ctx.contract_id)))score+=8000;if(contract&&text.includes(contract))score+=2000;if(client&&text.includes(client))score+=1000;if(external&&text.includes(external))score+=700;if(legal&&legal.length>=4&&text.includes(legal))score+=400;return score}
function findCard(ctx,row,used){const grid=document.querySelector('section#page-companies #clientCompanyGrid');if(!grid)return null;const cards=[...grid.querySelectorAll('article.company-switch-card')].filter(card=>card.isConnected&&!used.has(card));const scored=cards.map(card=>({card,score:cardScore(card,ctx,row)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);if(!scored.length)return null;if(scored.length>1&&scored[0].score===scored[1].score)return null;return scored[0].card}
function setNodeText(el,value){const next=String(value??'');if(!el||String(el.textContent??'')===next)return false;el.textContent=next;return true}
function setMetric(slot,value,label){if(!slot)return false;if(label)setNodeText(slot.label,label);setNodeText(slot.value,String(value));return true}
function unavailableNode(card){return leafNodes(card).find(el=>/контракт.*(?:недоступ|не опубликован)|файл подписанного контракта/iu.test(norm(el.textContent)))||null}
function contractAnchor(card){return leafNodes(card).find(el=>low(el.textContent)==='подписанный контракт')||null}
function downloadName(row,issued){return norm(issued?.object?.filename||row?.current_signed_contract?.authoritative_filename||'Договор.pdf')||'Договор.pdf'}
function withDownloadDisposition(url,filename){try{const u=new URL(String(url));u.searchParams.set('download',filename);return u.toString()}catch{return String(url||'')}}
async function beginDownload(row,button){const objectId=norm(row?.current_signed_contract?.storage_object_id);if(!objectId||button.disabled)return;const idle='Скачать договор PDF';button.disabled=true;button.textContent='Подготовка PDF…';try{const response=await fetch('/portal/api/v1/client/storage/'+encodeURIComponent(objectId)+'/signed-url',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-rona-client-source':'portal-client-company-directory-authority-v2:contract-download'}}),body=await response.json().catch(()=>null);if(!response.ok||body?.ok===false)throw new Error(String(body?.code||`HTTP_${response.status}`));const url=body?.signed_url||body?.data?.signed_url;if(!url)throw new Error('SIGNED_URL_MISSING');const filename=downloadName(row,body),a=document.createElement('a');a.href=withDownloadDisposition(url,filename);a.target='_blank';a.rel='noopener';a.download=filename;a.hidden=true;document.body.appendChild(a);a.click();a.remove();button.textContent='Договор открыт'}catch(error){console.error('RONA company directory contract download',error);button.textContent='Не удалось скачать';button.title='Не удалось получить защищённую ссылку. Повторите попытку.'}finally{setTimeout(()=>{if(button.isConnected){button.disabled=false;button.textContent=idle}},1200)}}
function clearOwnedButton(card){for(const button of card.querySelectorAll('button[data-rona-company-contract-download]'))button.remove()}
function installButton(card,row){
  const contract=row?.current_signed_contract,existing=card.querySelector('button[data-rona-company-contract-download]'),legacy=card.querySelector('button[data-rona-contract-download-v3]'),unavailable=unavailableNode(card),anchor=contractAnchor(card);
  if(!contract?.storage_object_id){clearOwnedButton(card);if(legacy)legacy.remove();return false}
  if(legacy&&norm(legacy.dataset.storageObjectId)===norm(contract.storage_object_id)){
    if(existing&&existing!==legacy)existing.remove();legacy.dataset.ronaCompanyContractDownload=norm(row.contract_id);legacy.dataset.storageObjectId=norm(contract.storage_object_id);return true;
  }
  if(legacy)legacy.remove();
  if(existing&&norm(existing.dataset.storageObjectId)===norm(contract.storage_object_id)&&norm(existing.dataset.ronaCompanyContractDownload)===norm(row.contract_id))return true;
  if(existing)existing.remove();
  const b=document.createElement('button');b.type='button';b.className='btn small';b.dataset.ronaCompanyContractDownload=norm(row.contract_id);b.dataset.storageObjectId=norm(contract.storage_object_id);b.textContent='Скачать договор PDF';b.title=norm(contract.authoritative_filename)||'Скачать действующий подписанный договор';b.setAttribute('aria-label','Скачать подписанный договор '+norm(row.current_external_contract_number||row.contract_id));b.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();beginDownload(row,b)},true);
  if(unavailable){unavailable.replaceWith(b);return true}if(anchor?.parentElement){anchor.parentElement.appendChild(b);return true}card.appendChild(b);return true;
}
function planDirectory(){
  if(!state.validated||!state.base||!state.directory.length)return null;
  const authorized=authorizedSnapshot();if(!authorized||authorized.contexts.length!==state.directory.length)return null;
  const byKey=new Map(state.directory.map(row=>[pairKey(row),row]));if(byKey.size!==authorized.contexts.length)return null;
  const used=new Set(),plan=[];
  for(const ctx of authorized.contexts){const row=byKey.get(pairKey(ctx));if(!row)return null;const card=findCard(ctx,row,used);if(!card)return null;const slots=metricSlots(card);if(!slots)return null;used.add(card);plan.push({ctx,row,card,slots})}
  return plan;
}
function publishState(plan){const current=state.base?.getCurrentContext?.();window.__RONA_CLIENT_CONTRACT_DOWNLOAD_STATE__={version:MARK,legacy_owner_marker:LEGACY_CONTRACT_MARK,current_contract_id:norm(current?.contract_id)||null,scope:'ALL_AUTHORIZED_CONTEXT_DIRECTORY',source:DIRECTORY_SOURCE,documents_predicate:DOCUMENTS_PREDICATE,entries:plan.map(({row,ctx})=>({client_id:ctx.client_id,contract_id:ctx.contract_id,applications:row.applications_total,deals:row.deals_total,documents:row.documents_total,metrics_ready:true,current:pairKey(ctx)===pairKey(current),download:!!row.current_signed_contract?.storage_object_id})),loadedAt:new Date().toISOString()}}
function renderDirectory(generation=state.generation){
  if(state.rendering||!state.validated||generation!==state.generation)return false;
  const plan=planDirectory();if(!plan)return false;
  state.rendering=true;
  try{
    for(const {ctx,row,card,slots} of plan){setMetric(slots.applications,row.applications_total);setMetric(slots.deals,row.deals_total);setMetric(slots.documents,row.documents_total,'ДОКУМЕНТОВ');card.dataset.ronaCompanyDirectoryHydration='ready';card.dataset.ronaCompanyDirectorySource=DIRECTORY_SOURCE;card.dataset.ronaCompanyDirectoryDocumentsPredicate=DOCUMENTS_PREDICATE;card.dataset.ronaClientId=norm(ctx.client_id);card.dataset.ronaClientContractId=norm(ctx.contract_id);installButton(card,row)}
    state.active=true;document.documentElement.dataset.ronaClientCompanyDirectory=MARK;document.documentElement.dataset.ronaClientCompanyDirectorySource=DIRECTORY_SOURCE;document.documentElement.dataset.ronaClientCompanyDirectoryDocumentsPredicate=DOCUMENTS_PREDICATE;document.documentElement.dataset.ronaClientContractDownloads=String(plan.filter(x=>x.row.current_signed_contract?.storage_object_id).length);publishState(plan);window.dispatchEvent(new CustomEvent('rona:client-company-directory-ready',{detail:{source:DIRECTORY_SOURCE,predicate:DOCUMENTS_PREDICATE,count:plan.length,authorized_count:plan.length,generation}}));return true;
  }finally{state.rendering=false}
}
function scheduleRender(delay=50){if(!state.validated)return;clearTimeout(state.timer);state.timer=setTimeout(()=>renderDirectory(state.generation),delay)}
function startObserver(){if(state.observer||!document.body)return;state.observer=new MutationObserver(records=>{if(state.rendering||!state.validated)return;if(records.some(r=>r.type==='childList'||r.type==='characterData'||r.type==='attributes'))scheduleRender(40)});state.observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-rona-company-directory-hydration','data-rona-company-directory-source','data-rona-company-directory-documents-predicate','data-rona-client-id','data-rona-client-contract-id']})}
async function start(){const base=window.RONA_CLIENT_CONTEXT;if(!base?.whenReady||!base?.getAuthorizedContexts||!base?.getCompanyDirectory||!base?.whenCompanyDirectory||!base?.refreshCompanyDirectory){console.error('RONA company directory authority unavailable');return}state.base=base;startObserver();if(typeof base.subscribe==='function')base.subscribe(()=>scheduleRender(0));window.addEventListener('rona:client-context-ready',()=>scheduleRender(0));window.addEventListener('rona:client-context-changed',()=>scheduleRender(0));window.addEventListener('rona:client-authorized-directory',()=>loadDirectory(false).catch(error=>console.error('RONA company directory central snapshot',error)));window.addEventListener('pageshow',()=>loadDirectory(true).catch(error=>console.error('RONA company directory refresh',error)),{passive:true});await loadDirectory(false).catch(error=>console.error('RONA company directory bootstrap',error));setInterval(()=>{if(document.visibilityState==='visible')loadDirectory(false).catch(error=>console.error('RONA company directory TTL',error))},REFRESH_MS)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
