(()=>{'use strict';
const MARK='20260908-pr431-authorized-company-directory-v2-atomic';
const MATERIALIZATION_MARK='PR431_SERVER_DRIVEN_CARD_MATERIALIZATION_V1';
const LEGACY_CONTRACT_MARK='20260906-client-contract-v11-authoritative-company-metrics';
const DIRECTORY_SOURCE='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB';
const DOCUMENTS_PREDICATE='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY';
const REFRESH_MS=30000;
if(window.__RONA_PORTAL_CLIENT_COMPANY_DIRECTORY_RUNTIME__===MARK)return;
window.__RONA_PORTAL_CLIENT_COMPANY_DIRECTORY_RUNTIME__=MARK;
const state={base:null,directory:[],validated:false,active:false,loading:null,lastLoad:0,rendering:false,observer:null,timer:0,generation:0,renderedGeneration:0,template:null,templateIdentity:null};

const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('ru-RU');
const int=v=>{if(v===null||v===undefined||typeof v==='boolean'||(typeof v==='string'&&!/^\d+$/.test(v.trim())))return null;const n=Number(v);return Number.isInteger(n)&&n>=0?n:null};
const key=v=>norm(v?.client_id)+'|'+norm(v?.contract_id);
const same=(a,b)=>key(a)!=='|'&&key(a)===key(b);
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const leafNodes=root=>root?[...root.querySelectorAll('*')].filter(el=>!el.children.length&&norm(el.textContent)):[];
const currentContext=()=>state.base?.getCurrentContext?.()||null;
const canonicalGrid=()=>document.querySelector('section#page-companies #clientCompanyGrid');

function compactLegalName(input){
  const legal=norm(input);if(!legal)return 'Компания';
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
function formatDate(v){const s=norm(v);if(!/^\d{4}-\d{2}-\d{2}/.test(s))return'';const [y,m,d]=s.slice(0,10).split('-');return `${d}.${m}.${y}`}
function contextByIds(clientId,contractId){return (state.base?.getAuthorizedContexts?.()||[]).find(ctx=>norm(ctx?.client_id)===norm(clientId)&&norm(ctx?.contract_id)===norm(contractId))||null}
function authorizedSnapshot(){
  const rows=state.base?.getAuthorizedContexts?.();
  return Array.isArray(rows)?rows.map(ctx=>({...ctx,client_id:norm(ctx?.client_id),contract_id:norm(ctx?.contract_id)})).filter(ctx=>ctx.client_id&&ctx.contract_id):[];
}
function cleanDirectoryRow(row){
  if(!row||typeof row!=='object')return null;
  const applications_total=int(row.applications_total),deals_total=int(row.deals_total),documents_total=int(row.documents_total);
  if(applications_total===null||deals_total===null||documents_total===null)return null;
  const client_id=norm(row.client_id),contract_id=norm(row.contract_id);
  if(!client_id||!contract_id||norm(row.source)!==DIRECTORY_SOURCE||norm(row.documents_predicate)!==DOCUMENTS_PREDICATE)return null;
  let current_signed_contract=null;
  if(row.current_signed_contract!==null&&row.current_signed_contract!==undefined){
    const value=row.current_signed_contract;if(!value||typeof value!=='object')return null;
    const document_id=norm(value.document_id),storage_object_id=norm(value.storage_object_id),authoritative_filename=norm(value.authoritative_filename);
    if(!document_id||!storage_object_id||!authoritative_filename)return null;
    current_signed_contract={document_id,storage_object_id,authoritative_filename};
  }
  return{
    client_id,contract_id,
    legal_name:norm(row.legal_name)||null,
    registration_country:norm(row.registration_country)||null,
    current_external_contract_number:norm(row.current_external_contract_number)||contract_id,
    contract_status:norm(row.contract_status)||null,
    effective_from:row.effective_from||null,
    effective_to:row.effective_to||null,
    applications_total,deals_total,documents_total,
    documents_predicate:DOCUMENTS_PREDICATE,
    source:DIRECTORY_SOURCE,
    current_signed_contract
  };
}
function validateCompleteDirectory(body){
  const authorized=authorizedSnapshot(),data=body?.data&&typeof body.data==='object'?body.data:body;
  if(!authorized.length||norm(data?.company_directory_source)!==DIRECTORY_SOURCE)return null;
  const raw=Array.isArray(data?.company_directory)?data.company_directory:null;
  if(!raw||raw.length!==authorized.length)return null;
  const rows=raw.map(cleanDirectoryRow);if(rows.some(row=>!row))return null;
  const map=new Map;
  for(const row of rows){const k=key(row);if(map.has(k))return null;map.set(k,row)}
  for(const ctx of authorized)if(!map.has(key(ctx)))return null;
  for(const row of rows)if(!contextByIds(row.client_id,row.contract_id))return null;
  return{authorized,rows:authorized.map(ctx=>map.get(key(ctx)))};
}
async function loadDirectory(force=false){
  if(state.loading)return state.loading;
  if(!force&&state.validated&&Date.now()-state.lastLoad<REFRESH_MS)return state.directory;
  state.loading=(async()=>{
    await state.base.whenReady();
    const body=force?await state.base.refreshCompanyDirectory('pr431-company-directory-runtime'):await state.base.whenCompanyDirectory();
    const validated=validateCompleteDirectory(body);
    if(!validated)throw new Error('CLIENT_COMPANY_DIRECTORY_INCOMPLETE');
    state.directory=validated.rows.map(clone);
    state.validated=true;
    state.lastLoad=Date.now();
    state.generation+=1;
    if(!renderDirectory(state.generation))scheduleRender(0);
    return state.directory;
  })().catch(error=>{console.error('RONA authorized company directory',error);throw error}).finally(()=>{state.loading=null});
  return state.loading;
}

function metricSlots(card){
  const leaves=leafNodes(card);
  const byLabel=label=>{
    const labelNode=leaves.find(el=>low(el.textContent)===label);
    if(!labelNode)return null;
    const metric=leaves.slice(0,leaves.indexOf(labelNode)).reverse().find(el=>/^\d+$/.test(norm(el.textContent)));
    return metric?{value:metric,label:labelNode}:null;
  };
  const applications=byLabel('заявок'),deals=byLabel('сделок');
  const documents=byLabel('документов')||byLabel('действий');
  return applications&&deals&&documents?{applications,deals,documents}:null;
}
function templateIdentity(card){
  const leaves=leafNodes(card);
  const eyebrow=card.querySelector('.eyebrow');
  const legal=card.querySelector('h3');
  const contractLabel=leaves.find(el=>/^контракт(?=\s|№|$)/iu.test(norm(el.textContent))&&!/подписан|скач/iu.test(norm(el.textContent)));
  let client='',contract='';
  if(contractLabel){
    const before=leaves.slice(0,leaves.indexOf(contractLabel)).filter(el=>el!==eyebrow&&el!==legal);
    if(before.length>=2){client=norm(before.at(-2)?.textContent);contract=norm(before.at(-1)?.textContent)}
  }
  return{eyebrow:norm(eyebrow?.textContent),legal:norm(legal?.textContent),client,contract,contractLabel:norm(contractLabel?.textContent)};
}
function captureTemplate(){
  if(state.template)return state.template;
  const grid=canonicalGrid();if(!grid)return null;
  const cards=[...grid.querySelectorAll('article.company-switch-card')];
  const card=cards.find(item=>metricSlots(item)&&leafNodes(item).some(el=>/открыть\s+компанию/iu.test(norm(el.textContent))))||cards.find(item=>metricSlots(item))||null;
  if(!card)return null;
  state.template=card.cloneNode(true);
  state.templateIdentity=templateIdentity(card);
  return state.template;
}
function remapIds(card,suffix){
  const map=new Map;
  for(const el of [card,...card.querySelectorAll('[id]')]){
    const old=norm(el.id);if(!old)continue;
    const next=`${old}-${suffix}`;map.set(old,next);el.id=next;
  }
  if(!map.size)return;
  for(const el of [card,...card.querySelectorAll('*')]){
    for(const attr of ['for','aria-labelledby','aria-describedby','aria-controls']){
      const raw=norm(el.getAttribute?.(attr));if(!raw)continue;
      const next=raw.split(/\s+/).map(token=>map.get(token)||token).join(' ');
      el.setAttribute(attr,next);
    }
    const href=norm(el.getAttribute?.('href'));
    if(href.startsWith('#')&&map.has(href.slice(1)))el.setAttribute('href','#'+map.get(href.slice(1)));
  }
}
function stripContextEvidence(card){
  for(const el of [card,...card.querySelectorAll('[data-rona-client-id],[data-client-id],[data-rona-client-contract-id],[data-rona-contract-id],[data-contract-id]')]){
    for(const attr of ['data-rona-client-id','data-client-id','data-rona-client-contract-id','data-rona-contract-id','data-contract-id'])el.removeAttribute(attr);
  }
}
function clearOwnedButtons(card){
  for(const button of card.querySelectorAll('button[data-rona-company-contract-download],button[data-rona-contract-download-v3]'))button.remove();
}
function contractIdentityNodes(card){
  const leaves=leafNodes(card),eyebrow=card.querySelector('.eyebrow'),legal=card.querySelector('h3');
  const contractLabel=leaves.find(el=>/^контракт(?=\s|№|$)/iu.test(norm(el.textContent))&&!/подписан|скач|недоступ/iu.test(norm(el.textContent)))||null;
  if(!contractLabel)return{eyebrow,legal,client:null,contract:null,contractLabel:null};
  const before=leaves.slice(0,leaves.indexOf(contractLabel)).filter(el=>el!==eyebrow&&el!==legal);
  return{eyebrow,legal,client:before.length>=2?before.at(-2):null,contract:before.length>=1?before.at(-1):null,contractLabel};
}
function replaceLiteral(text,from,to){
  const source=norm(text),needle=norm(from);if(!needle)return source;
  const at=low(source).indexOf(low(needle));
  return at<0?source:source.slice(0,at)+to+source.slice(at+needle.length);
}
function stripUnsupportedBusinessTail(card){
  const leaves=leafNodes(card),idLabel=leaves.find(el=>/^ид\s+контракта$/iu.test(norm(el.textContent)));
  if(!idLabel)return;
  const tail=leaves.slice(leaves.indexOf(idLabel)+1),idValue=tail.find(el=>/^(B|STRONG|SPAN|DIV)$/i.test(el.tagName)&&norm(el.textContent));
  const opener=leaves.find(el=>/открыть\s+компанию/iu.test(norm(el.textContent))&&/^(BUTTON|A)$/i.test(el.tagName));
  if(!idValue||!opener)return;
  const start=leaves.indexOf(idValue),end=leaves.indexOf(opener);if(start<0||end<=start)return;
  for(const el of leaves.slice(start+1,end))if(el!==opener&&!/^(BUTTON|A)$/i.test(el.tagName))el.remove();
}
function setIdentity(card,ctx,row){
  const identity=state.templateIdentity||{};
  const legal=norm(row.legal_name)||norm(ctx.legal_name)||row.client_id;
  const display=compactLegalName(legal);
  const external=norm(row.current_external_contract_number)||row.contract_id;
  const effective=formatDate(row.effective_from);
  const contractText=`Контракт № ${external}${effective?` · ${effective}`:''}`;
  const nodes=contractIdentityNodes(card);
  if(nodes.eyebrow)nodes.eyebrow.textContent=display;
  if(nodes.legal)nodes.legal.textContent=legal;
  if(nodes.client)nodes.client.textContent=row.client_id;
  if(nodes.contract)nodes.contract.textContent=row.contract_id;
  if(nodes.contractLabel)nodes.contractLabel.textContent=contractText;
  const replacements=[
    [identity.client,row.client_id],
    [identity.contract,row.contract_id],
    [identity.contractLabel,contractText],
    [identity.legal,legal],
    [identity.eyebrow,display]
  ].filter(([token])=>norm(token));
  for(const el of leafNodes(card)){
    if(el===nodes.eyebrow||el===nodes.legal||el===nodes.client||el===nodes.contract||el===nodes.contractLabel)continue;
    let text=norm(el.textContent),next=text;
    for(const [from,to] of replacements)next=replaceLiteral(next,from,to);
    if(next!==text)el.textContent=next;
    if(/^контракт(?=\s|№|$)/iu.test(next)&&!/подписан|скач|недоступ/iu.test(next))el.textContent=contractText;
  }
  const leaves=leafNodes(card);
  const idLabel=leaves.find(el=>/^ид\s+контракта$/iu.test(norm(el.textContent)));
  if(idLabel){
    const tail=leaves.slice(leaves.indexOf(idLabel)+1);
    const idValue=tail.find(el=>/^(B|STRONG|SPAN|DIV)$/i.test(el.tagName)&&norm(el.textContent));
    if(idValue)idValue.textContent=row.contract_id;
  }
  stripUnsupportedBusinessTail(card);
  return{legal,display,external,effective};
}
function findUnavailableNode(card){
  const leaves=leafNodes(card);
  return leaves.find(el=>/контракт.*недоступ|файл.*контракт.*не опубликован|скачиван.*недоступ/iu.test(norm(el.textContent)))||null;
}
function contractAnchor(card){
  const leaves=leafNodes(card);
  const signed=leaves.find(el=>/подписанн(?:ый|ого)\s+контракт/iu.test(norm(el.textContent)))||null;
  if(signed?.parentElement)return signed.parentElement;
  return card;
}
function installButton(card,row){
  clearOwnedButtons(card);
  const doc=row.current_signed_contract;if(!doc?.storage_object_id)return false;
  const fallback=findUnavailableNode(card);
  const button=document.createElement('button');
  button.type='button';
  if(fallback)button.className=fallback.className||'status amber';
  button.textContent='Скачать договор PDF';
  button.dataset.ronaCompanyContractDownload='true';
  button.dataset.ronaClientId=row.client_id;
  button.dataset.ronaContractId=row.contract_id;
  button.dataset.ronaStorageObjectId=doc.storage_object_id;
  if(doc.document_id)button.dataset.ronaDocumentId=doc.document_id;
  button.addEventListener('click',async event=>{
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    const selectedBefore=key(currentContext());
    button.disabled=true;
    try{
      const response=await fetch(`/portal/api/v1/client/storage/${encodeURIComponent(doc.storage_object_id)}/signed-url`,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
      const body=await response.json().catch(()=>null);
      if(!response.ok||body?.ok===false)throw new Error(String(body?.code||body?.error?.code||`HTTP_${response.status}`));
      const url=norm(body?.data?.signed_url||body?.signed_url||body?.data?.url||body?.url);if(!url)throw new Error('SIGNED_URL_MISSING');
      window.open(url,'_blank','noopener,noreferrer');
    }catch(error){console.error('RONA signed contract download',error)}
    finally{button.disabled=false}
    if(key(currentContext())!==selectedBefore)console.error('RONA contract click changed company context');
  });
  if(fallback)fallback.replaceWith(button);else contractAnchor(card).append(button);
  return true;
}
function openControl(card){
  return leafNodes(card).find(el=>/(?:открыть\s+компанию|текущая\s+компания)/iu.test(norm(el.textContent))&&/^(BUTTON|A)$/i.test(el.tagName))||null;
}
function syncActionState(card,current,row){
  const opener=openControl(card);if(!opener)return false;
  const isCurrent=same(current,row);
  card.dataset.ronaCompanyCurrent=isCurrent?'true':'false';
  opener.textContent=isCurrent?'Текущая компания':'Открыть компанию';
  if(isCurrent){
    opener.dataset.ronaCurrentCompanyStatus='true';
    opener.setAttribute('aria-disabled','true');
    opener.setAttribute('tabindex','-1');
    if('disabled' in opener)opener.disabled=true;
  }else{
    delete opener.dataset.ronaCurrentCompanyStatus;
    opener.removeAttribute('aria-disabled');
    if(opener.getAttribute('tabindex')==='-1')opener.removeAttribute('tabindex');
    if('disabled' in opener)opener.disabled=false;
  }
  return true;
}
function materializeCard(template,ctx,row,index,current){
  const card=template.cloneNode(true);
  remapIds(card,`rona-company-${index+1}`);
  stripContextEvidence(card);
  clearOwnedButtons(card);
  card.removeAttribute('aria-hidden');
  card.removeAttribute('inert');
  if(card.getAttribute('tabindex')==='-1')card.removeAttribute('tabindex');
  const identity=setIdentity(card,ctx,row);
  const slots=metricSlots(card);if(!slots)return null;
  slots.applications.value.textContent=String(row.applications_total);
  slots.deals.value.textContent=String(row.deals_total);
  slots.documents.value.textContent=String(row.documents_total);
  slots.documents.label.textContent='ДОКУМЕНТОВ';
  const opener=openControl(card);if(!opener)return null;
  opener.removeAttribute('onclick');
  if('disabled' in opener)opener.disabled=false;
  opener.removeAttribute('aria-disabled');
  card.dataset.ronaCompanyAuthorizationScope='authorized-directory';
  card.dataset.ronaClientId=row.client_id;
  card.dataset.ronaClientContractId=row.contract_id;
  card.dataset.ronaCompanyDirectorySource=DIRECTORY_SOURCE;
  card.dataset.ronaCompanyDirectoryDocumentsPredicate=DOCUMENTS_PREDICATE;
  card.dataset.ronaCompanyDirectoryHydration='ready';
  card.dataset.ronaCompanyDirectoryMaterialization=MATERIALIZATION_MARK;
  if(!syncActionState(card,current,row))return null;
  installButton(card,row);
  return{ctx,row,card,identity};
}
function planDirectory(){
  if(!state.validated||!state.directory.length)return null;
  const grid=canonicalGrid(),template=captureTemplate();if(!grid||!template)return null;
  const authorized=authorizedSnapshot();if(authorized.length!==state.directory.length)return null;
  const rows=new Map(state.directory.map(row=>[key(row),row]));
  if(rows.size!==authorized.length)return null;
  const current=currentContext(),plan=[];
  for(let index=0;index<authorized.length;index++){
    const ctx=authorized[index],row=rows.get(key(ctx));if(!row)return null;
    const item=materializeCard(template,ctx,row,index,current);if(!item)return null;
    plan.push(item);
  }
  if(plan.length!==authorized.length)return null;
  return{grid,plan,generation:state.generation};
}
function publishState(){
  const current=currentContext();
  const entries=state.directory.map(row=>({
    client_id:row.client_id,contract_id:row.contract_id,legal_name:row.legal_name,
    current_external_contract_number:row.current_external_contract_number,
    applications:row.applications_total,deals:row.deals_total,documents:row.documents_total,
    source:row.source,documents_predicate:row.documents_predicate,
    current:same(current,row),signed_contract:Boolean(row.current_signed_contract?.storage_object_id),download:Boolean(row.current_signed_contract?.storage_object_id),metrics_ready:true
  }));
  const loadedAt=state.lastLoad?new Date(state.lastLoad).toISOString():null;
  window.__RONA_CLIENT_COMPANY_DIRECTORY_STATE__={
    version:MARK,materialization:MATERIALIZATION_MARK,scope:'ALL_AUTHORIZED_CONTEXT_DIRECTORY',
    source:DIRECTORY_SOURCE,documents_predicate:DOCUMENTS_PREDICATE,validated:state.validated,active:state.active,atomic:state.active,
    generation:state.generation,rendered_generation:state.renderedGeneration,entries,loaded_at:loadedAt
  };
  window.__RONA_CLIENT_CONTRACT_DOWNLOAD_STATE__={
    version:MARK,legacy_owner_marker:LEGACY_CONTRACT_MARK,current_contract_id:norm(current?.contract_id)||null,
    scope:'ALL_AUTHORIZED_CONTEXT_DIRECTORY',source:DIRECTORY_SOURCE,documents_predicate:DOCUMENTS_PREDICATE,entries,loadedAt
  };
}
function syncCurrentMarkers(){
  if(!state.active)return false;
  const grid=canonicalGrid();if(!grid)return false;
  const current=currentContext(),rows=new Map(state.directory.map(row=>[key(row),row]));
  let seen=0;
  for(const card of grid.querySelectorAll('article.company-switch-card[data-rona-company-directory-hydration="ready"]')){
    if(card.dataset.ronaCompanyDirectorySource!==DIRECTORY_SOURCE||card.dataset.ronaCompanyDirectoryDocumentsPredicate!==DOCUMENTS_PREDICATE)continue;
    const row=rows.get(norm(card.dataset.ronaClientId)+'|'+norm(card.dataset.ronaClientContractId));
    if(!row||!syncActionState(card,current,row))continue;
    seen+=1;
  }
  publishState();
  return seen===state.directory.length;
}
function renderDirectory(generation=state.generation){
  if(state.rendering)return false;
  if(state.active&&state.renderedGeneration===generation)return syncCurrentMarkers();
  const planned=planDirectory();if(!planned||planned.generation!==generation)return false;
  state.rendering=true;
  try{
    const fragment=document.createDocumentFragment();
    for(const item of planned.plan)fragment.append(item.card);
    if(planned.plan.length!==state.directory.length)return false;
    planned.grid.replaceChildren(fragment);
    state.active=true;
    state.renderedGeneration=generation;
    const root=document.documentElement;
    root.dataset.ronaClientCompanyDirectorySource=DIRECTORY_SOURCE;
    root.dataset.ronaClientCompanyDirectoryDocumentsPredicate=DOCUMENTS_PREDICATE;
    root.dataset.ronaClientCompanyDirectoryAtomic='true';
    root.dataset.ronaClientCompanyDirectoryMaterialization=MATERIALIZATION_MARK;
    root.dataset.ronaClientCompanyDirectoryGeneration=String(generation);
    window.__RONA_PORTAL_CLIENT_COMPANY_DIRECTORY__=MARK;
    publishState();
    window.dispatchEvent(new CustomEvent('rona:client-company-directory-ready',{detail:{source:DIRECTORY_SOURCE,documents_predicate:DOCUMENTS_PREDICATE,count:planned.plan.length,generation,materialization:MATERIALIZATION_MARK}}));
    return true;
  }finally{state.rendering=false}
}
function scheduleRender(delay=20){
  clearTimeout(state.timer);
  state.timer=setTimeout(()=>renderDirectory(state.generation),delay);
}
function startObserver(){
  const body=document.body;if(!body)return;
  captureTemplate();
  state.observer=new MutationObserver(records=>{
    if(state.rendering)return;
    if(state.active){syncCurrentMarkers();return}
    if(records.some(record=>record.type==='childList'||record.type==='attributes'))scheduleRender(35);
  });
  state.observer.observe(body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden','data-rona-client-id','data-rona-client-contract-id']});
}
async function start(){
  if(window.__RONA_CLIENT_COMPANY_DIRECTORY_AUTHORITY__===MARK)return;
  const base=window.RONA_CLIENT_CONTEXT;if(!base?.whenReady||!base?.getAuthorizedContexts||!base?.getCompanyDirectory||!base?.whenCompanyDirectory||!base?.refreshCompanyDirectory)return;
  window.__RONA_CLIENT_COMPANY_DIRECTORY_AUTHORITY__=MARK;
  state.base=base;
  captureTemplate();
  startObserver();
  if(base.subscribe)base.subscribe(()=>state.active?syncCurrentMarkers():scheduleRender(0));
  window.addEventListener('rona:client-authorized-directory',()=>loadDirectory(false).catch(()=>{}));
  window.addEventListener('pageshow',()=>loadDirectory(true).catch(()=>{}));
  window.addEventListener('rona:client-context-changed',()=>state.active?syncCurrentMarkers():scheduleRender(0));
  await loadDirectory(false).catch(()=>{});
  setInterval(()=>{if(document.visibilityState==='visible')loadDirectory(false).catch(()=>{})},REFRESH_MS);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
