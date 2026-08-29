(()=>{'use strict';
const MARK='20260829-client-contract-v3-authoritative-projection-v5';
const COMPAT_MARK='20260829-client-contract-v3-authoritative-projection-v4';
if(window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V3__===MARK)return;
window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V3__=MARK;
window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V2__=MARK;
window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V1__=MARK;

const API='/portal/api',REFRESH_MS=30000,STYLE_ID='ronaClientContractDownloadV3Style';
const state={entries:new Map(),loading:false,lastLoad:0,renderTimer:0,currentKey:'',observer:null,setterHooked:false,rendering:false};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim(),low=v=>norm(v).toLocaleLowerCase('ru-RU');
const GENERIC=new Set(['общество','ограниченной','ответственностью','совместное','предприятие','company','limited','liability','joint','venture','contract','контракт','rona','trade','ооо','осоо','сп','с','llc']);
const APOSTROPHES="'’‘`´ʼ";

async function request(path){
  const r=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
  const b=await r.json().catch(()=>null);
  if(!r.ok||b?.ok===false)throw new Error(String(b?.code||b?.error?.code||('HTTP_'+r.status)));
  return b;
}
function visible(el){
  if(!el||!el.isConnected)return false;
  const s=getComputedStyle(el);
  if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;
  const r=el.getBoundingClientRect();
  return r.width>0&&r.height>0;
}
function tokenKey(v){return low(v).replace(new RegExp('['+APOSTROPHES+']','g'),'').replace(/[^a-zа-яё0-9]+/gi,'')}
function legalWords(name){return (norm(name).match(/[A-Za-zА-Яа-яЁё0-9]+(?:['’‘`´ʼ-][A-Za-zА-Яа-яЁё0-9]+)*/g)||[]).filter(Boolean)}
function canonicalBusinessWords(ctx){const words=legalWords(ctx?.legal_name);while(words.length&&GENERIC.has(low(words[0])))words.shift();return words}
function identityTokens(ctx){return canonicalBusinessWords(ctx).map(tokenKey).filter(x=>x.length>=3&&!GENERIC.has(x)).filter((x,i,a)=>a.indexOf(x)===i)}
function currentContractDocument(documents){
  const docs=Array.isArray(documents)?documents:[];
  const type=d=>String(d?.document_type||'').trim().toUpperCase();
  const materialized=d=>Boolean(d?.storage_object_id);
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
async function mapLimit(items,limit,worker){
  const q=[...items],out=[];
  const runners=Array.from({length:Math.min(limit,q.length)},async()=>{
    while(q.length){
      const item=q.shift();
      if(item===undefined)break;
      out.push(await worker(item));
    }
  });
  await Promise.all(runners);
  return out;
}
function effectiveContext(base,detail){
  const dc=detail?.contract||{},number=norm(dc.current_external_contract_number)||norm(base.current_external_contract_number)||null;
  return{...base,...dc,current_external_contract_number:number};
}
function entryByContractId(contractId){
  const id=norm(contractId);
  if(!id)return null;
  if(state.entries.has(id))return state.entries.get(id);
  for(const entry of state.entries.values())if(norm(entry.context?.contract_id)===id)return entry;
  return null;
}
function frozenContexts(){
  try{
    if(typeof CLIENT_CONTEXTS!=='undefined'&&CLIENT_CONTEXTS&&typeof CLIENT_CONTEXTS==='object')return CLIENT_CONTEXTS;
  }catch{}
  return null;
}
function hydrateFrozenClientModel(){
  const model=frozenContexts();
  if(!model)return 0;
  let count=0;
  for(const entry of state.entries.values()){
    const ctx=entry.context||{},id=norm(ctx.contract_id),num=norm(ctx.current_external_contract_number);
    if(!id||!num)continue;
    const row=model[id];
    if(!row||typeof row!=='object')continue;
    row.contractNo=num.replace(/^№\s*/u,'');
    row.contractStateBlocked=String(ctx.contract_status||'').toUpperCase()!=='ACTIVE';
    if(!row.contractStateBlocked&&/уточн/i.test(String(row.status||'')))row.status='Действует';
    count++;
  }
  if(count)document.documentElement.dataset.ronaClientContractModel='authoritative';
  return count;
}
function selectedContextEntry(){
  const select=document.getElementById('clientContextSelect');
  const selected=entryByContractId(select?.value);
  if(selected){state.currentKey=norm(selected.context?.contract_id);return selected}
  for(const el of document.querySelectorAll('.context-banner,[class*="context-banner"],[data-client-id],[data-contract-id]')){
    if(!visible(el))continue;
    const text=low(el.textContent),marker=text.includes('выбрана компания')||text.includes('активный контекст')||text.includes('текущая компания');
    if(!marker&&!el.hasAttribute('data-contract-id'))continue;
    const direct=resolveEntry(el,12);
    if(direct){state.currentKey=norm(direct.context?.contract_id);return direct}
  }
  for(const el of document.querySelectorAll('button,a,span,small,strong,p,div')){
    if(!visible(el)||el.childElementCount!==0||low(el.textContent)!=='текущая компания')continue;
    const entry=resolveEntry(el,12);
    if(entry){state.currentKey=norm(entry.context?.contract_id);return entry}
  }
  const prior=entryByContractId(state.currentKey);
  if(prior)return prior;
  if(state.entries.size===1){
    const only=[...state.entries.values()][0];
    state.currentKey=norm(only.context?.contract_id);
    return only;
  }
  return null;
}
async function refresh(force=false){
  if(state.loading)return;
  if(!force&&Date.now()-state.lastLoad<REFRESH_MS){render();return}
  state.loading=true;
  try{
    const boot=await request('/v1/client/bootstrap'),contexts=Array.isArray(boot?.data?.contexts)?boot.data.contexts:[];
    const rows=await mapLimit(contexts,4,async base=>{
      try{
        const detail=await request('/v1/client/context?clientId='+encodeURIComponent(base.client_id)+'&contractId='+encodeURIComponent(base.contract_id));
        const data=detail?.data||{};
        return{context:effectiveContext(base,data),document:currentContractDocument(data.documents)};
      }catch(error){
        console.error('RONA contract context',base?.contract_id,error);
        return{context:base,document:null};
      }
    });
    state.entries=new Map(rows.map((r,i)=>[String(r.context?.contract_id||r.context?.client_id||i),r]));
    state.lastLoad=Date.now();
    hydrateFrozenClientModel();
    const current=selectedContextEntry();
    window.__RONA_CLIENT_CONTRACT_DOWNLOAD_STATE__={
      version:MARK,
      current_contract_id:current?.context?.contract_id||state.currentKey||null,
      entries:rows.map(r=>({
        client_id:r.context?.client_id||null,
        legal_name:r.context?.legal_name||null,
        contract_id:r.context?.contract_id||null,
        current_external_contract_number:r.context?.current_external_contract_number||null,
        contract_status:r.context?.contract_status||null,
        document_id:r.document?.document_id||null,
        storage_object_id:r.document?.storage_object_id||null
      })),
      loadedAt:new Date().toISOString()
    };
    render();
  }catch(error){
    console.error('RONA contract bootstrap',error);
  }finally{
    state.loading=false;
  }
}
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`button[data-rona-contract-download-v3]{appearance:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;min-height:30px!important;padding:6px 11px!important;border:1px solid rgba(230,190,82,.38)!important;border-radius:999px!important;background:linear-gradient(180deg,rgba(230,190,82,.13),rgba(230,190,82,.07))!important;color:#ecd27e!important;font-family:inherit!important;font-size:10.5px!important;line-height:1.15!important;font-weight:820!important;letter-spacing:.02em!important;white-space:nowrap!important;cursor:pointer!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)!important}button[data-rona-contract-download-v3]::before{content:'↓';font-size:13px;font-weight:900;color:#67d9fb}@media(hover:hover) and (pointer:fine){button[data-rona-contract-download-v3]:hover{border-color:rgba(101,217,255,.55)!important;background:rgba(101,217,255,.11)!important;color:#ddf9ff!important}}button[data-rona-contract-download-v3][disabled]{cursor:wait!important;opacity:.72!important}[data-rona-current-company-status]{background:transparent!important;border-color:transparent!important;box-shadow:none!important;cursor:default!important;pointer-events:none!important;transform:none!important}`;
  document.head.appendChild(s);
}
function resolveEntry(node,maxDepth=10){
  const scopes=[];
  let n=node instanceof Element?node:node?.parentElement||null;
  for(let i=0;n&&n!==document.body&&i<maxDepth;i++,n=n.parentElement)scopes.push(low(n.textContent));
  let best=null,bestScore=0,nextScore=0;
  for(const entry of state.entries.values()){
    const c=entry.context||{},contract=low(c.contract_id),client=low(c.client_id),number=low(c.current_external_contract_number),tokens=identityTokens(c);
    let score=0;
    for(const s of scopes){
      if(contract&&s.includes(contract))score=Math.max(score,10000);
      if(client&&s.includes(client))score=Math.max(score,3000);
      if(number&&s.includes(number))score=Math.max(score,1200);
      let tokenScore=0;
      const compact=tokenKey(s);
      for(const t of tokens)if(compact.includes(t))tokenScore+=40;
      score=Math.max(score,tokenScore);
    }
    if(score>bestScore){nextScore=bestScore;bestScore=score;best=entry}
    else if(score>nextScore)nextScore=score;
  }
  return bestScore>=40&&bestScore>nextScore?best:null;
}
function leafByText(root,predicate){
  return [...root.querySelectorAll('button,a,span,small,strong,p,div')].find(e=>e.childElementCount===0&&predicate(low(e.textContent)))||null;
}
function companyCardCandidates(){return [...document.querySelectorAll('article,section,li,div')].filter(visible)}
function findCompanyCard(ctx){
  const contractKey=low(ctx?.contract_id),clientKey=low(ctx?.client_id),tokens=identityTokens(ctx),c=[];
  for(const node of companyCardCandidates()){
    const t=low(node.textContent);
    if(!t||t.length>9000||(!t.includes('подписанный контракт')&&!t.includes('текущая компания')&&!t.includes('открыть компанию')&&!t.includes('переключиться')))continue;
    const compact=tokenKey(t),hc=contractKey&&t.includes(contractKey),hi=clientKey&&t.includes(clientKey);
    let tokenScore=0;
    for(const x of tokens)if(compact.includes(x))tokenScore+=40;
    if(!hc&&!hi&&tokenScore<40)continue;
    const score=(hc?10000:0)+(hi?3000:0)+tokenScore+500-Math.min(t.length,8000)/8;
    c.push({node,score,len:t.length});
  }
  c.sort((a,b)=>b.score-a.score||a.len-b.len);
  return c[0]?.node||null;
}
function numberEntryFor(node,current){
  const direct=resolveEntry(node,14);
  if(direct)return direct;
  let n=node instanceof Element?node:node?.parentElement||null;
  for(let i=0;n&&n!==document.body&&i<12;i++,n=n.parentElement){
    const t=low(n.textContent);
    if(t.includes('выбрана компания')||t.includes('активный контекст'))return current||selectedContextEntry();
  }
  const r=node?.getBoundingClientRect?.();
  if(r&&r.top>=0&&r.top<260)return current||selectedContextEntry();
  return current||selectedContextEntry();
}
function authoritativeContractText(value,num){
  const n=norm(num);
  if(!n)return String(value||'');
  let next=String(value||'');
  next=next.replace(/(контракт|договор)\s*(?:№|номер|:)?\s*(?:(?:номер\s+)?уточняется|[0-9][A-Za-zА-Яа-яЁё0-9/._-]{2,})/giu,(_,kind)=>kind+' № '+n);
  if(/^номер\s+уточняется$/iu.test(norm(next)))return '№ '+n;
  next=next.replace(/номер\s+уточняется/giu,n);
  return next;
}
function syncContractNumberLabels(current){
  const root=document.body;
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),pending=[];
  let node;
  while((node=walker.nextNode())){
    const v=norm(node.nodeValue);
    if(/номер\s+уточняется/i.test(v)||/(?:контракт|договор)\s*(?:№|номер|:)?\s*(?:[0-9][A-Za-zА-Яа-яЁё0-9/._-]{2,}|(?:номер\s+)?уточняется)/iu.test(v))pending.push(node);
  }
  for(const t of pending){
    const parent=t.parentElement;
    if(!parent||!visible(parent))continue;
    const entry=numberEntryFor(parent,current),num=norm(entry?.context?.current_external_contract_number);
    if(!num)continue;
    const before=String(t.nodeValue||''),after=authoritativeContractText(before,num);
    if(after!==before){
      t.nodeValue=after;
      parent.dataset.ronaContractNumberSynced='authoritative';
    }
  }
}
function escapeRe(v){return String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function flexibleCanonicalWordRe(word){
  let out='';
  for(const ch of String(word)){
    if(APOSTROPHES.includes(ch))out+='['+escapeRe(APOSTROPHES)+']?';
    else out+=escapeRe(ch);
  }
  return new RegExp('\\b'+out+'\\b','giu');
}
function syncCompanyNameSpelling(){
  for(const entry of state.entries.values()){
    const ctx=entry.context||{},words=canonicalBusinessWords(ctx);
    if(!words.length)continue;
    const canonicals=words.filter(w=>tokenKey(w).length>=3),card=findCompanyCard(ctx),scopes=[];
    if(card)scopes.push(card);
    for(const el of document.querySelectorAll('header,[class*="top"],[class*="context"],[class*="company"]')){
      if(!visible(el))continue;
      const resolved=resolveEntry(el,14);
      if(resolved===entry&&!scopes.includes(el))scopes.push(el);
    }
    for(const scope of scopes){
      const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);
      let t;
      while((t=walker.nextNode())){
        const parent=t.parentElement;
        if(!parent||!visible(parent))continue;
        const value=String(t.nodeValue||'');
        let next=value;
        for(const canonical of canonicals){
          const key=tokenKey(canonical),raw=canonical.replace(new RegExp('['+APOSTROPHES+']','g'),'');
          if(tokenKey(raw)===key)next=next.replace(new RegExp('\\b'+escapeRe(raw)+'\\b','giu'),canonical);
          next=next.replace(flexibleCanonicalWordRe(canonical),canonical);
        }
        if(next!==value){
          t.nodeValue=next;
          parent.dataset.ronaCompanyNameSynced='authoritative';
        }
      }
    }
  }
}
function currentStatusNode(card){return leafByText(card,t=>t==='текущая компания'||t==='текущий контекст')}
function switchNode(card){return leafByText(card,t=>t==='открыть компанию'||t==='переключиться')}
function preventCurrentCompanyAction(e){e.preventDefault();e.stopImmediatePropagation()}
function syncCompanyControls(){
  ensureStyle();
  for(const entry of state.entries.values()){
    const card=findCompanyCard(entry.context);
    if(!card)continue;
    const current=currentStatusNode(card);
    if(current){
      const control=current.closest('button,a,[role="button"]')||current;
      if(low(current.textContent)!=='текущая компания')current.textContent='Текущая компания';
      control.dataset.ronaCurrentCompanyStatus='true';
      control.setAttribute('aria-current','true');
      control.setAttribute('aria-disabled','true');
      control.setAttribute('role','status');
      if('disabled'in control)control.disabled=true;
      if(control.matches('a'))control.removeAttribute('href');
      control.tabIndex=-1;
      if(!control.dataset.ronaCurrentCompanyGuard){
        control.dataset.ronaCurrentCompanyGuard='true';
        control.addEventListener('click',preventCurrentCompanyAction,true);
      }
    }else{
      const action=switchNode(card);
      if(action){
        if(low(action.textContent)!=='переключиться')action.textContent='Переключиться';
        const control=action.closest('button,a,[role="button"]')||action;
        control.setAttribute('aria-label','Переключиться на '+norm(entry.context?.legal_name||entry.context?.client_id));
      }
    }
  }
}
const unavailableNode=card=>leafByText(card,t=>t.includes('контракт пока недоступен для скачивания')||t==='контракт недоступен для скачивания'||t.includes('файл подписанного контракта не опубликован в кабинете'));
const contractAnchor=card=>leafByText(card,t=>t==='подписанный контракт');
function downloadName(entry,issued){return norm(issued?.object?.filename||entry?.document?.authoritative_filename||'Договор.pdf')||'Договор.pdf'}
function withDownloadDisposition(url,filename){try{const u=new URL(String(url));u.searchParams.set('download',filename);return u.toString()}catch{return String(url||'')}}
async function beginDownload(entry,b){
  if(b.disabled||!entry?.document?.storage_object_id)return;
  const idle='Скачать договор PDF';
  b.disabled=true;
  b.textContent='Подготовка PDF…';
  try{
    const issued=await request('/v1/client/storage/'+encodeURIComponent(entry.document.storage_object_id)+'/signed-url'),url=issued?.signed_url||issued?.data?.signed_url;
    if(!url)throw new Error('SIGNED_URL_MISSING');
    const filename=downloadName(entry,issued),a=document.createElement('a');
    a.href=withDownloadDisposition(url,filename);
    a.target='_blank';
    a.rel='noopener';
    a.download=filename;
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    b.textContent='Договор открыт';
  }catch(error){
    console.error('RONA contract download',error);
    b.textContent='Не удалось скачать';
    b.title='Не удалось получить защищённую ссылку. Повторите попытку.';
  }finally{
    setTimeout(()=>{if(b.isConnected){b.disabled=false;b.textContent=idle}},1200);
  }
}
function makeButton(entry,template){
  ensureStyle();
  const b=document.createElement('button');
  b.type='button';
  if(template&&typeof template.className==='string')b.className=template.className;
  b.dataset.ronaContractDownloadV3=String(entry.context?.contract_id||'');
  b.dataset.storageObjectId=String(entry.document?.storage_object_id||'');
  b.textContent='Скачать договор PDF';
  b.title=norm(entry.document?.authoritative_filename)||'Скачать действующий подписанный договор';
  b.setAttribute('aria-label','Скачать подписанный договор '+norm(entry.context?.current_external_contract_number||entry.context?.contract_id));
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();beginDownload(entry,b)},true);
  return b;
}
function renderEntry(entry){
  const card=findCompanyCard(entry.context);
  if(!card)return false;
  card.dataset.ronaClientContractId=String(entry.context?.contract_id||'');
  card.dataset.ronaClientId=String(entry.context?.client_id||'');
  for(const old of card.querySelectorAll('button[data-rona-contract-download],button[data-rona-contract-download-v2]'))old.remove();
  const existing=card.querySelector('button[data-rona-contract-download-v3]'),unavailable=unavailableNode(card),active=String(entry.context?.contract_status||'').toUpperCase()==='ACTIVE';
  if(!active){if(existing)existing.remove();return false}
  if(!entry.document?.storage_object_id){
    if(existing)existing.remove();
    if(unavailable){
      const msg='Файл подписанного контракта не опубликован в кабинете';
      if(unavailable.textContent!==msg)unavailable.textContent=msg;
      unavailable.setAttribute('aria-disabled','true');
      unavailable.dataset.ronaContractUnavailable='authoritative-storage-not-materialized';
    }
    return false;
  }
  if(existing&&existing.dataset.storageObjectId===String(entry.document.storage_object_id))return true;
  if(existing)existing.remove();
  const b=makeButton(entry,unavailable);
  if(unavailable){unavailable.replaceWith(b);return true}
  const anchor=contractAnchor(card),host=anchor?.parentElement||card;
  host.appendChild(b);
  return true;
}
function hookContextSetter(){
  if(state.setterHooked)return;
  const original=window.setClientContext;
  if(typeof original!=='function')return;
  const wrapped=function(contractId,...args){
    const id=norm(contractId);
    if(entryByContractId(id))state.currentKey=id;
    const out=original.apply(this,[contractId,...args]);
    scheduleRender(40);
    return out;
  };
  Object.defineProperty(wrapped,'__ronaAuthoritativeWrapped',{value:true});
  window.setClientContext=wrapped;
  state.setterHooked=true;
}
function render(){
  if(state.rendering)return false;
  state.rendering=true;
  try{
    ensureStyle();
    hydrateFrozenClientModel();
    hookContextSetter();
    const current=selectedContextEntry();
    syncContractNumberLabels(current);
    syncCompanyNameSpelling();
    syncCompanyControls();
    let count=0;
    for(const entry of state.entries.values())if(renderEntry(entry))count++;
    document.documentElement.dataset.ronaClientContractDownloads=String(count);
    document.documentElement.dataset.ronaClientContractRuntime='v5';
    if(window.__RONA_CLIENT_CONTRACT_DOWNLOAD_STATE__)window.__RONA_CLIENT_CONTRACT_DOWNLOAD_STATE__.current_contract_id=current?.context?.contract_id||state.currentKey||null;
    return true;
  }finally{
    state.rendering=false;
  }
}
function scheduleRender(delay=120){
  clearTimeout(state.renderTimer);
  state.renderTimer=setTimeout(render,delay);
}
function startObserver(){
  if(state.observer||!document.documentElement)return;
  state.observer=new MutationObserver(records=>{
    if(state.rendering)return;
    if(records.some(r=>r.type==='childList'||r.type==='characterData'))scheduleRender(80);
  });
  state.observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
}
function start(){
  startObserver();
  hookContextSetter();
  refresh(true);
  document.addEventListener('click',()=>scheduleRender(140),true);
  document.addEventListener('change',e=>{
    if(e.target?.id==='clientContextSelect'){
      const entry=entryByContractId(e.target.value);
      if(entry)state.currentKey=norm(entry.context?.contract_id);
    }
    scheduleRender(80);
  },true);
  window.addEventListener('pageshow',()=>{scheduleRender(0);if(Date.now()-state.lastLoad>10000)refresh(true)});
  window.addEventListener('popstate',()=>scheduleRender(80));
  window.addEventListener('hashchange',()=>scheduleRender(80));
  setInterval(()=>{if(document.visibilityState==='visible')refresh(true)},REFRESH_MS);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
