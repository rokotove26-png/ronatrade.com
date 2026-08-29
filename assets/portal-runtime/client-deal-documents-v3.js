(()=>{
'use strict';
const MARK='20260829-client-deal-documents-v3-canonical-native-v3-2';
if(window.__RONA_CLIENT_DEAL_DOCUMENTS_V3__===MARK)return;
window.__RONA_CLIENT_DEAL_DOCUMENTS_V3__=MARK;
window.__RONA_CLIENT_DEAL_DOCUMENTS_V2__=MARK;
const API='/portal/api',PANEL='rona-deal-documents-v3',HOST='rona-deal-card-v3';
const DEAL_RE=/^DEAL-\d{4}-\d{3,}$/;
const STATUS_RE=/^(?:В\s+ИСПОЛНЕНИИ|СДЕЛКА\s+ОТКРЫТА|РЕСУРС\s+ПОДТВЕРЖД[ЕЁ]Н|ПОДТВЕРЖД[ЕЁ]Н|НЕ\s+ПОДТВЕРЖД[ЕЁ]Н|РЕСУРС\s+НЕ\s+ПОДТВЕРЖД[ЕЁ]Н|ПЛАТЕЖИ|ОЖИДАЕТ\s+ОПЛАТЫ|ОПЛАЧЕН(?:О|А)?|ЗАВЕРШЕН(?:А|О)?|ЗАКРЫТ(?:А|О)?|ОТМЕНЕН(?:А|О)?|НА\s+СОГЛАСОВАНИИ)$/i;
const RESOURCE_RE=/^(?:РЕСУРС\s+)?(?:НЕ\s+)?ПОДТВЕРЖД[ЕЁ]Н$/i;
const state={deals:new Map(),busy:false,lastLoad:0,scanTimer:0};
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>text(v).toLocaleLowerCase('ru-RU');
const visible=n=>{if(!n||!n.isConnected)return false;const s=getComputedStyle(n);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&n.getClientRects().length>0};
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n};
function legacyLabel(v){const t=text(v).replace(/[•·]/g,' ');return /^(?:ДС|DS)\s*(?:(?:И|AND|\/|&)\s*)?(?:ИНВОЙС(?:Ы)?|INVOICES?)$/i.test(t)}
function ensureStyle(){
  document.getElementById('rona-client-deal-canonical-visual-v1-style')?.remove();
  let s=document.getElementById(`${PANEL}-style`);if(s)s.remove();
  s=el('style');s.id=`${PANEL}-style`;s.textContent=`
.${HOST}{min-width:0!important;box-sizing:border-box!important;overflow:visible!important}
.${HOST} *{box-sizing:border-box}
.${HOST}__status{display:inline-flex!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important;vertical-align:middle!important;margin-top:0!important;margin-bottom:0!important;transform:none!important;align-self:center!important;box-sizing:border-box!important}
.${HOST}__resource-ok{gap:6px!important;border:1px solid rgba(74,222,128,.25)!important;background:rgba(34,197,94,.065)!important;color:rgba(187,247,208,.92)!important}
.${HOST}__resource-no{gap:6px!important;border:1px solid rgba(250,204,21,.30)!important;background:rgba(234,179,8,.07)!important;color:rgba(254,240,138,.92)!important}
.${HOST}__resource-ok::before,.${HOST}__resource-no::before{content:'';display:block;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.9}
.${PANEL}{width:100%!important;min-width:0!important;box-sizing:border-box!important;grid-column:1/-1!important;flex:0 0 100%!important;display:flex!important;align-items:center!important;gap:10px!important;margin:8px 0 0!important;padding:10px 0 2px!important;border-top:1px solid rgba(113,154,184,.15)!important;font-family:inherit!important;color:inherit!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important}
.${PANEL}::-webkit-scrollbar{display:none}
.${PANEL}__label{flex:0 0 auto;font-size:11.5px!important;font-weight:760!important;line-height:1!important;color:rgba(203,213,225,.64)!important;white-space:nowrap!important}
.${PANEL}__actions{display:flex!important;align-items:center!important;gap:9px!important;flex:0 0 auto!important;flex-wrap:nowrap!important;min-width:0!important}
.${PANEL}__action{position:relative;appearance:none;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;flex:0 0 auto!important;min-height:34px!important;height:34px!important;padding:0 12px!important;border:1px solid rgba(93,180,226,.42)!important;border-radius:9px!important;background:linear-gradient(180deg,rgba(19,66,97,.92),rgba(8,39,62,.94))!important;box-shadow:0 4px 12px rgba(1,8,16,.19),inset 0 1px 0 rgba(255,255,255,.07)!important;color:rgba(244,250,255,.96)!important;font:760 12px/1 inherit!important;letter-spacing:.004em!important;cursor:pointer!important;white-space:nowrap!important;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,filter .16s ease!important}
.${PANEL}__action::before{display:grid;place-items:center;width:18px;height:18px;flex:0 0 18px;border-radius:6px;background:rgba(125,211,252,.10);border:1px solid rgba(125,211,252,.18);font-size:11px;font-weight:800;line-height:1;color:rgba(186,230,253,.96)}
.${PANEL}__action--download::before{content:'↓'}
.${PANEL}__action--signed::before{content:'✓';background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.18);color:rgba(187,247,208,.96)}
.${PANEL}__action:hover{transform:translateY(-1px)!important;border-color:rgba(125,211,252,.70)!important;box-shadow:0 7px 18px rgba(1,8,16,.27),0 0 0 1px rgba(56,189,248,.07),inset 0 1px 0 rgba(255,255,255,.10)!important;filter:brightness(1.08)!important}
.${PANEL}__action:active{transform:translateY(0)!important}
.${PANEL}__action:disabled{opacity:.56!important;cursor:wait!important;transform:none!important;filter:none!important}
.${PANEL}__action--upload{overflow:hidden!important;border-color:rgba(248,113,113,.70)!important;background:linear-gradient(105deg,#7d1c2a,#b82e3b,#7d1c2a)!important;background-size:220% 100%!important;box-shadow:0 6px 18px rgba(127,29,29,.28),0 0 0 1px rgba(239,68,68,.06),inset 0 1px 0 rgba(255,255,255,.10)!important;animation:ronaSignedDsV3Pulse 2.4s ease-in-out infinite,ronaSignedDsV3Flow 4s linear infinite!important;color:#fff5f5!important}
.${PANEL}__action--upload::before{content:'↑';background:rgba(255,255,255,.10);border-color:rgba(254,202,202,.32);color:#fff1f2}
.${PANEL}__stage{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;min-height:30px;height:30px;box-sizing:border-box;padding:0 12px;border-radius:999px;border:1px solid rgba(96,165,250,.24);background:rgba(59,130,246,.07);color:rgba(191,219,254,.90);font-size:12.5px;font-weight:760;line-height:1;white-space:nowrap;flex:0 0 auto}
.${PANEL}__empty,.${PANEL}__error{font-size:11.5px;line-height:1.3;white-space:nowrap}
.${PANEL}__empty{color:rgba(203,213,225,.48)}
.${PANEL}__error{color:#fca5a5}
@keyframes ronaSignedDsV3Flow{0%{background-position:100% 0}100%{background-position:-100% 0}}
@keyframes ronaSignedDsV3Pulse{0%,100%{box-shadow:0 6px 18px rgba(127,29,29,.22),0 0 0 1px rgba(239,68,68,.05)}50%{box-shadow:0 8px 24px rgba(127,29,29,.38),0 0 18px rgba(239,68,68,.22)}}
@media(max-width:760px){.${PANEL}{gap:8px!important}.${PANEL}__action{min-height:36px!important;height:36px!important}}
@media(prefers-reduced-motion:reduce){.${PANEL}__action--upload{animation:none!important}}
`;document.head.appendChild(s);
  document.documentElement.dataset.ronaDealVisual='canonical-native-v3-2';
}
async function getJson(url,init={}){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...init});const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false)throw Object.assign(new Error(j?.code||`HTTP_${r.status}`),{status:r.status,payload:j});return j}
async function loadData(){if(state.busy)return;state.busy=true;try{const boot=await getJson(`${API}/v1/client/bootstrap`);const contexts=Array.isArray(boot?.data?.contexts)?boot.data.contexts:[];const next=new Map();await Promise.all(contexts.map(async ctx=>{const clientId=text(ctx.client_id),contractId=text(ctx.contract_id);if(!clientId||!contractId)return;const [context,workflow]=await Promise.all([getJson(`${API}/v1/client/context?clientId=${encodeURIComponent(clientId)}&contractId=${encodeURIComponent(contractId)}`),getJson(`${API}/v1/client/deal-documents/state?clientId=${encodeURIComponent(clientId)}&contractId=${encodeURIComponent(contractId)}`).catch(()=>({deals:[]}))]);const data=context?.data||{},wfMap=new Map((Array.isArray(workflow?.deals)?workflow.deals:[]).map(w=>[text(w.deal_id),w])),docs=Array.isArray(data.documents)?data.documents:[];for(const d of Array.isArray(data.deals)?data.deals:[]){const dealId=text(d.deal_id);if(!DEAL_RE.test(dealId))continue;const dealDocs=docs.filter(doc=>text(doc.deal_id)===dealId&&['ADDENDUM','SIGNED_ADDENDUM','INVOICE'].includes(text(doc.document_type).toUpperCase())&&text(doc.storage_object_id));next.set(dealId,{dealId,clientId,contractId,deal:d,workflow:wfMap.get(dealId)||{},documents:dealDocs})}}));state.deals=next;state.lastLoad=Date.now()}catch(err){console.error('RONA universal deal role load failed',err)}finally{state.busy=false;scan()}}
function navExact(label){const wanted=low(label);return [...document.querySelectorAll('a,button,[role="tab"],[role="menuitem"]')].find(n=>visible(n)&&low(n.textContent)===wanted)||null}
function removeLegacySection(){const dealNav=navExact('Сделки'),legacyPage=[...document.querySelectorAll('h1,h2,h3')].some(n=>visible(n)&&legacyLabel(n.textContent));if(legacyPage&&dealNav)try{dealNav.click()}catch{};for(const n of [...document.querySelectorAll('a,button,[role="tab"],[role="menuitem"],li')]){if(!legacyLabel(n.textContent))continue;const target=n.closest('li,[role="menuitem"]')||n;if(target!==dealNav)target.remove()}}
function isDealsView(){return [...document.querySelectorAll('h1,h2,h3')].some(n=>visible(n)&&/^СДЕЛКИ$/i.test(text(n.textContent)))}
function hasOtherDeal(node,dealId,ids){const t=text(node.innerText||node.textContent);return ids.some(id=>id!==dealId&&t.includes(id))}
function exactDealLeaves(dealId){return [...document.querySelectorAll('span,p,strong,b,a,div')].filter(n=>visible(n)&&text(n.textContent)===dealId)}
function hasOpen(node){return [...node.querySelectorAll('button,a,[role="button"]')].some(n=>visible(n)&&/^ОТКРЫТЬ$/i.test(text(n.textContent)))}
function dealHost(dealId,ids){const prior=document.querySelector(`.${HOST}[data-rona-canonical-deal-id="${dealId}"]`);if(prior?.isConnected)return prior;const c=[];for(const leaf of exactDealLeaves(dealId)){let n=leaf;for(let depth=0;n&&n!==document.body&&depth<10;depth++,n=n.parentElement){if(!visible(n))continue;const t=text(n.innerText||n.textContent);if(!t.includes(dealId))continue;if(hasOtherDeal(n,dealId,ids))break;const r=n.getBoundingClientRect();if(r.width<420||r.height<34||r.height>155)continue;c.push({node:n,open:hasOpen(n),width:r.width,area:r.width*r.height,height:r.height})}}if(!c.length)return null;const u=[],seen=new Set();for(const x of c){if(seen.has(x.node))continue;seen.add(x.node);u.push(x)}u.sort((a,b)=>{if(a.open!==b.open)return a.open?-1:1;if(a.width!==b.width)return b.width-a.width;return b.area-a.area});return u[0]?.node||null}
function leaves(host){return [...host.querySelectorAll('span,small,p,strong,b,div,label')].filter(n=>visible(n)&&!n.closest(`.${PANEL}`)&&!n.closest('button,a,[role="button"]')).filter(n=>{const t=text(n.textContent);return t&&t.length<=320&&![...n.children].some(c=>visible(c)&&text(c.textContent))})}
function normalizeResource(host){const ls=leaves(host),labels=ls.filter(n=>/^РЕСУРС$/i.test(text(n.textContent))),ok=ls.find(n=>/^(?:РЕСУРС\s+)?ПОДТВЕРЖД[ЕЁ]Н$/i.test(text(n.textContent))),no=ls.find(n=>/^(?:РЕСУРС\s+)?НЕ\s+ПОДТВЕРЖД[ЕЁ]Н$/i.test(text(n.textContent))||/^НЕ\s+ПОДТВЕРЖД[ЕЁ]Н$/i.test(text(n.textContent)));if(ok){ok.textContent='Ресурс подтвержден';ok.classList.add(`${HOST}__status`,`${HOST}__resource-ok`);labels.forEach(n=>n.remove())}else if(no){no.textContent='Ресурс не подтвержден';no.classList.add(`${HOST}__status`,`${HOST}__resource-no`);labels.forEach(n=>n.remove())}}
function harmonizeStatuses(host){
  const nodes=leaves(host).filter(n=>STATUS_RE.test(text(n.textContent)));
  if(!nodes.length)return;
  const anchor=nodes.find(n=>!RESOURCE_RE.test(text(n.textContent)))||nodes[0];
  const cs=getComputedStyle(anchor),rect=anchor.getBoundingClientRect();
  const px=v=>Number.parseFloat(v)||0;
  const fontSize=Math.max(px(cs.fontSize),12.5);
  const height=Math.max(Math.round(rect.height||0),30);
  const padX=Math.max(px(cs.paddingLeft),px(cs.paddingRight),12);
  const weight=Number.parseInt(cs.fontWeight,10)||760;
  const radius=cs.borderRadius&&cs.borderRadius!=='0px'?cs.borderRadius:'999px';
  for(const n of nodes){
    n.classList.add(`${HOST}__status`);
    n.style.setProperty('font-size',`${fontSize}px`,'important');
    n.style.setProperty('font-weight',String(Math.max(weight,720)),'important');
    n.style.setProperty('line-height','1','important');
    n.style.setProperty('height',`${height}px`,'important');
    n.style.setProperty('min-height',`${height}px`,'important');
    n.style.setProperty('padding',`0 ${padX}px`,'important');
    n.style.setProperty('border-radius',radius,'important');
  }
}
function decorate(host,dealId){host.classList.add(HOST);host.dataset.ronaCanonicalDealId=dealId;normalizeResource(host);harmonizeStatuses(host);for(const n of leaves(host)){const t=text(n.textContent);if(t===dealId){n.classList.add(`${HOST}__dealid`);continue}if(/^СУММА$/i.test(t)){n.classList.add(`${HOST}__sumlabel`);continue}if(/\d[\d\s.,]*\s*(?:ДОЛЛ\.?\s*США|USD|EUR|РУБ\.?|СОМ)(?:\b|$)/i.test(t)){n.classList.add(`${HOST}__amount`);continue}if(t.length>=5&&!STATUS_RE.test(t))n.classList.add(`${HOST}__detail`)}}
const typeDocs=(info,type)=>info.documents.filter(d=>text(d.document_type).toUpperCase()===type);
async function signedUrl(doc){const id=text(doc.storage_object_id);if(!id)throw new Error('STORAGE_OBJECT_REQUIRED');const j=await getJson(`${API}/v1/client/storage/${encodeURIComponent(id)}/signed-url`);const url=j?.signed_url||j?.signedUrl||j?.data?.signed_url||j?.data?.signedUrl;if(!url)throw new Error('SIGNED_URL_MISSING');return url}
async function markDownload(info,doc){const kind=text(doc.document_type).toUpperCase();if(!['ADDENDUM','INVOICE'].includes(kind))return;await getJson(`${API}/v1/client/deals/${encodeURIComponent(info.dealId)}/documents/${encodeURIComponent(text(doc.document_id))}/downloaded`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})}
async function download(info,doc,b){if(b.disabled)return;const old=b.textContent;b.disabled=true;b.textContent='Открываю…';let tab=null;try{tab=window.open('about:blank','_blank');if(tab)try{tab.opener=null}catch{};const url=await signedUrl(doc);if(tab)tab.location.replace(url);else{const a=el('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.style.display='none';document.body.appendChild(a);a.click();a.remove()}try{await markDownload(info,doc)}catch(err){console.warn('deal document mark failed',err)}if(text(doc.document_type).toUpperCase()==='ADDENDUM'){info.workflow={...info.workflow,client_addendum_downloaded_at:new Date().toISOString()};renderDeal(info.dealId);setTimeout(loadData,400)}}catch(err){if(tab)try{tab.close()}catch{};console.error('deal document download failed',err);b.textContent='Не удалось открыть';setTimeout(()=>{if(b.isConnected){b.disabled=false;b.textContent=old}},1800);return}if(b.isConnected){b.disabled=false;b.textContent=old}}
function docButton(info,doc,label,signed=false){const b=el('button',`${PANEL}__action ${PANEL}__action--download${signed?` ${PANEL}__action--signed`:''}`,label);b.type='button';const fn=text(doc.authoritative_filename)||text(doc.document_id)||'PDF';b.title=fn;b.setAttribute('aria-label',`${label}. ${fn}`);b.addEventListener('click',()=>download(info,doc,b));return b}
function uploadMessage(code){return({ADDENDUM_DOWNLOAD_REQUIRED:'Сначала скачайте дополнительное соглашение.',CURRENT_ADDENDUM_REQUIRED:'Актуальное дополнительное соглашение недоступно.',PDF_REQUIRED:'Выберите PDF-файл.',PDF_SIGNATURE_INVALID:'Файл не является корректным PDF.',PDF_SIZE_INVALID:'Размер PDF превышает допустимый лимит.',STORAGE_UPLOAD_FAILED:'Не удалось загрузить файл.',SIGNED_ADDENDUM_REGISTER_FAILED:'Не удалось зарегистрировать подписанное ДС.'})[code]||'Не удалось загрузить подписанное ДС.'}
function appendUpload(info,panel,actions){const input=el('input');input.type='file';input.accept='application/pdf,.pdf';input.hidden=true;const b=el('button',`${PANEL}__action ${PANEL}__action--upload`,'Загрузить подписанное ДС');b.type='button';b.addEventListener('click',()=>input.click());input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;b.disabled=true;b.textContent='Загружаю…';panel.querySelector(`.${PANEL}__error`)?.remove();try{const fd=new FormData();fd.append('file',file,file.name);await getJson(`${API}/v1/client/deals/${encodeURIComponent(info.dealId)}/signed-addendum`,{method:'POST',body:fd});info.workflow={...info.workflow,client_stage:'PAYMENTS',payment_handoff_state:'READY'};b.textContent='Подписанное ДС загружено';await loadData()}catch(err){panel.append(el('div',`${PANEL}__error`,uploadMessage(err?.payload?.code||err?.message)));b.disabled=false;b.textContent='Загрузить подписанное ДС';input.value=''}});actions.append(b,input)}
function signature(info){return JSON.stringify({docs:info.documents.map(d=>[text(d.document_id),text(d.document_type),text(d.storage_object_id),text(d.updated_at)]),downloaded:text(info.workflow?.client_addendum_downloaded_at),stage:text(info.workflow?.client_stage),handoff:text(info.workflow?.payment_handoff_state)})}
function buildPanel(info){const p=el('div',PANEL);p.dataset.dealId=info.dealId;p.dataset.signature=signature(info);p.append(el('div',`${PANEL}__label`,'Документы'));const a=el('div',`${PANEL}__actions`),ds=typeDocs(info,'ADDENDUM'),inv=typeDocs(info,'INVOICE'),signed=typeDocs(info,'SIGNED_ADDENDUM');ds.forEach((d,i)=>a.append(docButton(info,d,ds.length>1?`Дополнительное соглашение ${i+1}`:'Дополнительное соглашение')));inv.forEach((d,i)=>a.append(docButton(info,d,inv.length>1?`Инвойс ${i+1}`:'Инвойс')));signed.forEach((d,i)=>a.append(docButton(info,d,signed.length>1?`Подписанное ДС ${i+1}`:'Подписанное ДС',true)));if(info.workflow?.client_addendum_downloaded_at&&!signed.length)appendUpload(info,p,a);if(a.querySelector('button'))p.append(a);else p.append(el('div',`${PANEL}__empty`,'Документы пока не опубликованы'));const payment=text(info.workflow?.client_stage)==='PAYMENTS'||['READY','SENT'].includes(text(info.workflow?.payment_handoff_state));if(payment)p.append(el('div',`${PANEL}__stage`,'Платежи'));return p}
function panelFor(id){return [...document.querySelectorAll(`.${PANEL}`)].find(n=>n.dataset.dealId===id)||null}
function renderDeal(id){if(!isDealsView())return;const info=state.deals.get(id);if(!info)return;const host=dealHost(id,[...state.deals.keys()]);if(!host)return;decorate(host,id);let p=panelFor(id);if(p&&p.parentElement!==host){p.remove();p=null}const sig=signature(info);if(p&&p.dataset.signature===sig)return;const next=buildPanel(info);if(p)p.replaceWith(next);else host.appendChild(next)}
function cleanup(){for(const p of document.querySelectorAll(`.${PANEL}`)){const id=text(p.dataset.dealId);if(!state.deals.has(id))p.remove()}document.querySelectorAll('.rona-deal-documents-v1,.rona-deal-documents-v2').forEach(n=>{if(!n.classList.contains(PANEL))n.remove()})}
function scan(){removeLegacySection();if(!isDealsView())return;cleanup();for(const id of state.deals.keys())renderDeal(id)}
function scheduleScan(){clearTimeout(state.scanTimer);state.scanTimer=setTimeout(scan,160)}
function relevantInteraction(target){if(isDealsView())return true;const n=target?.closest?.('a,button,[role="tab"],[role="menuitem"]');if(!n)return false;const t=text(n.textContent);return /^СДЕЛКИ$/i.test(t)||legacyLabel(t)}
function start(){ensureStyle();removeLegacySection();loadData();setInterval(()=>{if(document.visibilityState==='visible'&&isDealsView())scan()},3000);setInterval(()=>{if(document.visibilityState==='visible')loadData()},30000);document.addEventListener('click',e=>{if(relevantInteraction(e.target))scheduleScan()},true);document.addEventListener('change',e=>{if(isDealsView())scheduleScan()},true);window.addEventListener('pageshow',()=>{scan();if(Date.now()-state.lastLoad>10000)loadData()});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-state.lastLoad>10000)loadData()},{passive:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
