(()=>{
'use strict';
const MARK='20260902-client-deal-documents-v7-current-context';
if(window.__RONA_CLIENT_DEAL_DOCUMENTS_V5__===MARK)return;
window.__RONA_CLIENT_DEAL_DOCUMENTS_V5__=MARK;
window.__RONA_CLIENT_DEAL_DOCUMENTS_V4__=MARK;
window.__RONA_CLIENT_DEAL_DOCUMENTS_V3__=MARK;
const API='/portal/api',PANEL='rona-deal-documents-v5',HOST='rona-deal-card-v5';
const DEAL_RE=/^DEAL-\d{4}-\d{3,}$/;
const STATUS_RE=/^(?:В\s+ИСПОЛНЕНИИ|СДЕЛКА\s+ОТКРЫТА|РЕСУРС\s+ПОДТВЕРЖД[ЕЁ]Н|ПОДТВЕРЖД[ЕЁ]Н|НЕ\s+ПОДТВЕРЖД[ЕЁ]Н|РЕСУРС\s+НЕ\s+ПОДТВЕРЖД[ЕЁ]Н|ПЛАТЕЖИ|ОЖИДАЕТ\s+ОПЛАТЫ|ОПЛАЧЕН(?:О|А)?|ЗАВЕРШЕН(?:А|О)?|ЗАКРЫТ(?:А|О)?|ОТМЕНЕН(?:А|О)?|НА\s+СОГЛАСОВАНИИ)$/i;
const RESOURCE_OK=/^(?:РЕСУРС\s+)?ПОДТВЕРЖД[ЕЁ]Н$/i;
const RESOURCE_NO=/^(?:РЕСУРС\s+)?НЕ\s+ПОДТВЕРЖД[ЕЁ]Н$/i;
const state={deals:new Map(),busy:false,lastLoad:0,scanTimer:0,bootReleased:false,contextKey:'',unsubscribe:null};
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>text(v).toLocaleLowerCase('ru-RU');
const visible=n=>{if(!n||!n.isConnected)return false;const s=getComputedStyle(n);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&n.getClientRects().length>0};
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n};
function legacyLabel(v){const t=text(v).replace(/[•·]/g,' ');return /^(?:ДС|DS)\s*(?:(?:И|AND|\/|&)\s*)?(?:ИНВОЙС(?:Ы)?|INVOICES?)$/i.test(t)}
function ensureStyle(){
  for(const id of ['rona-deal-documents-v1-style','rona-deal-documents-v2-style','rona-deal-documents-v3-style','rona-deal-documents-v4-style','rona-client-deal-canonical-visual-v1-style'])document.getElementById(id)?.remove();
  let s=document.getElementById(`${PANEL}-style`);if(s)s.remove();
  s=el('style');s.id=`${PANEL}-style`;s.textContent=`
.${HOST}{width:100%!important;max-width:100%!important;min-width:0!important;min-height:104px!important;box-sizing:border-box!important;padding:17px 18px 15px!important;margin:10px 0!important;border:1px solid rgba(79,139,182,.30)!important;border-radius:12px!important;background:linear-gradient(180deg,rgba(7,27,46,.82),rgba(5,20,34,.76))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important;overflow:visible!important;row-gap:13px!important;column-gap:18px!important}
.${HOST} *{box-sizing:border-box}
.${HOST}__dealid{font-size:19px!important;font-weight:840!important;line-height:1.22!important;letter-spacing:.006em!important;color:#f4f9ff!important;white-space:nowrap!important}
.${HOST}__detail{font-size:15.5px!important;font-weight:580!important;line-height:1.44!important;color:rgba(224,234,244,.90)!important;white-space:normal!important;overflow:visible!important}
.${HOST}__sumlabel{font-size:13px!important;font-weight:740!important;line-height:1.2!important;color:rgba(170,188,205,.90)!important;white-space:nowrap!important}
.${HOST}__amount{font-size:17.5px!important;font-weight:840!important;line-height:1.2!important;color:rgba(217,252,233,.98)!important;white-space:nowrap!important}
.${HOST}__status{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:38px!important;height:38px!important;padding:0 14px!important;border-radius:999px!important;font-size:15px!important;font-weight:780!important;line-height:1!important;white-space:nowrap!important;vertical-align:middle!important;margin:0!important;transform:none!important;align-self:center!important}
.${HOST}__resource-ok{gap:7px!important;border:1px solid rgba(74,222,128,.28)!important;background:rgba(34,197,94,.075)!important;color:rgba(202,255,219,.96)!important}
.${HOST}__resource-no{gap:7px!important;border:1px solid rgba(250,204,21,.32)!important;background:rgba(234,179,8,.08)!important;color:rgba(255,242,157,.96)!important}
.${HOST}__resource-ok::before,.${HOST}__resource-no::before{content:'';display:block;width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.92}
.${HOST}__open{min-height:36px!important;height:36px!important;padding:0 15px!important;border-radius:9px!important;font-size:14px!important;font-weight:780!important;line-height:1!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important}
.${PANEL}{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;grid-column:1/-1!important;flex:0 0 100%!important;display:flex!important;align-items:center!important;gap:11px!important;margin:11px 0 0!important;padding:12px 0 1px!important;border-top:1px solid rgba(113,154,184,.18)!important;font-family:inherit!important;color:inherit!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important}
.${PANEL}::-webkit-scrollbar{display:none}
.${PANEL}__label{flex:0 0 auto;font-size:13px!important;font-weight:780!important;line-height:1!important;color:rgba(203,213,225,.72)!important;white-space:nowrap!important}
.${PANEL}__actions{display:flex!important;align-items:center!important;gap:9px!important;flex:0 0 auto!important;flex-wrap:nowrap!important;min-width:0!important}
.${PANEL}__action{position:relative;appearance:none;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;flex:0 0 auto!important;min-height:38px!important;height:38px!important;padding:0 13px!important;border:1px solid rgba(93,180,226,.44)!important;border-radius:9px!important;background:linear-gradient(180deg,rgba(19,66,97,.93),rgba(8,39,62,.95))!important;box-shadow:0 4px 12px rgba(1,8,16,.18),inset 0 1px 0 rgba(255,255,255,.07)!important;color:rgba(244,250,255,.97)!important;font:770 13px/1 inherit!important;letter-spacing:.003em!important;cursor:pointer!important;white-space:nowrap!important}
.${PANEL}__action::before{display:grid;place-items:center;width:19px;height:19px;flex:0 0 19px;border-radius:6px;background:rgba(125,211,252,.10);border:1px solid rgba(125,211,252,.18);font-size:12px;font-weight:800;line-height:1;color:rgba(186,230,253,.96)}
.${PANEL}__action--download::before{content:'↓'}
.${PANEL}__action--signed::before{content:'✓';background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.18);color:rgba(187,247,208,.96)}
.${PANEL}__action--upload{overflow:hidden!important;border-color:rgba(248,113,113,.70)!important;background:linear-gradient(105deg,#7d1c2a,#b82e3b,#7d1c2a)!important;background-size:220% 100%!important;box-shadow:0 6px 18px rgba(127,29,29,.28),0 0 0 1px rgba(239,68,68,.06),inset 0 1px 0 rgba(255,255,255,.10)!important;animation:ronaSignedDsV5Pulse 2.4s ease-in-out infinite,ronaSignedDsV5Flow 4s linear infinite!important;color:#fff5f5!important}
.${PANEL}__action--upload::before{content:'↑';background:rgba(255,255,255,.10);border-color:rgba(254,202,202,.32);color:#fff1f2}
.${PANEL}__action--uploaded,.${PANEL}__action--uploaded:disabled{opacity:1!important;cursor:default!important;border-color:rgba(74,222,128,.40)!important;background:linear-gradient(180deg,rgba(22,101,52,.82),rgba(15,73,42,.90))!important;color:rgba(236,253,245,.98)!important;box-shadow:0 4px 12px rgba(5,46,22,.18),inset 0 1px 0 rgba(255,255,255,.06)!important}
.${PANEL}__action--uploaded::before{content:'✓';background:rgba(255,255,255,.08);border-color:rgba(187,247,208,.22);color:#dcfce7}
.${PANEL}__stage{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;min-height:34px;height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(96,165,250,.24);background:rgba(59,130,246,.07);color:rgba(191,219,254,.92);font-size:13px;font-weight:760;line-height:1;white-space:nowrap;flex:0 0 auto}
.${PANEL}__stage--signed{border-color:rgba(74,222,128,.30)!important;background:rgba(34,197,94,.08)!important;color:rgba(220,252,231,.96)!important}
.${PANEL}__empty,.${PANEL}__error{font-size:12.5px;line-height:1.3;white-space:nowrap}.${PANEL}__empty{color:rgba(203,213,225,.52)}.${PANEL}__error{color:#fca5a5}
@keyframes ronaSignedDsV5Flow{0%{background-position:100% 0}100%{background-position:-100% 0}}@keyframes ronaSignedDsV5Pulse{0%,100%{box-shadow:0 6px 18px rgba(127,29,29,.22)}50%{box-shadow:0 8px 24px rgba(127,29,29,.38),0 0 18px rgba(239,68,68,.22)}}
@media(max-width:900px){.${HOST}{padding:15px 15px 14px!important}.${HOST}__dealid{font-size:17px!important}.${HOST}__detail{font-size:14px!important}.${HOST}__status{height:35px!important;min-height:35px!important;font-size:14px!important}}
@media(max-width:760px){.${PANEL}{align-items:flex-start!important;flex-wrap:wrap!important;overflow:visible!important}.${PANEL}__actions{flex-wrap:wrap!important}.${PANEL}__stage{margin-left:0!important}}
@media(prefers-reduced-motion:reduce){.${PANEL}__action--upload{animation:none!important}}
`;document.head.appendChild(s);document.documentElement.dataset.ronaDealVisual='role-canonical-v5'}
async function getJson(url,init={}){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...init});const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false)throw Object.assign(new Error(j?.code||`HTTP_${r.status}`),{status:r.status,payload:j});return j}
function contextAuthority(){return window.RONA_CLIENT_CONTEXT||null}
async function currentContext(){const authority=contextAuthority();if(!authority)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');return authority.getCurrentContext()||await authority.whenReady()}
function ctxKey(ctx){return text(ctx?.client_id)+'|'+text(ctx?.contract_id)}
function releaseBoot(){if(state.bootReleased)return;state.bootReleased=true;document.documentElement.dataset.ronaClientCanonReady='1'}
async function loadData(){
  if(state.busy)return;state.busy=true;
  try{
    const ctx=await currentContext();
    if(!ctx){state.contextKey='';state.deals=new Map();state.lastLoad=Date.now();return}
    const clientId=text(ctx.client_id),contractId=text(ctx.contract_id),key=ctxKey(ctx);
    if(!clientId||!contractId)throw new Error('CLIENT_CONTEXT_INVALID');
    const [context,workflow]=await Promise.all([
      getJson(`${API}/v1/client/context?clientId=${encodeURIComponent(clientId)}&contractId=${encodeURIComponent(contractId)}`),
      getJson(`${API}/v1/client/deal-documents/state?clientId=${encodeURIComponent(clientId)}&contractId=${encodeURIComponent(contractId)}`).catch(()=>({deals:[]}))
    ]);
    if(ctxKey(contextAuthority()?.getCurrentContext())!==key)return;
    const data=context?.data||{},wfMap=new Map((Array.isArray(workflow?.deals)?workflow.deals:[]).map(w=>[text(w.deal_id),w])),docs=Array.isArray(data.documents)?data.documents:[],next=new Map();
    for(const d of Array.isArray(data.deals)?data.deals:[]){
      const dealId=text(d.deal_id);if(!DEAL_RE.test(dealId))continue;
      const dealDocs=docs.filter(doc=>text(doc.deal_id)===dealId&&['ADDENDUM','SIGNED_ADDENDUM','INVOICE'].includes(text(doc.document_type).toUpperCase())&&text(doc.storage_object_id));
      next.set(dealId,{dealId,clientId,contractId,deal:d,workflow:wfMap.get(dealId)||{},documents:dealDocs});
    }
    state.contextKey=key;state.deals=next;state.lastLoad=Date.now();
  }catch(err){console.error('RONA canonical deal load failed',err)}finally{state.busy=false;scan();requestAnimationFrame(()=>requestAnimationFrame(releaseBoot))}
}
function navExact(label){const wanted=low(label);return [...document.querySelectorAll('a,button,[role="tab"],[role="menuitem"]')].find(n=>visible(n)&&low(n.textContent)===wanted)||null}
function removeLegacySection(){const dealNav=navExact('Сделки'),legacyPage=[...document.querySelectorAll('h1,h2,h3')].some(n=>visible(n)&&legacyLabel(n.textContent));if(legacyPage&&dealNav)try{dealNav.click()}catch{};for(const n of [...document.querySelectorAll('a,button,[role="tab"],[role="menuitem"],li')]){if(!legacyLabel(n.textContent))continue;const target=n.closest('li,[role="menuitem"]')||n;if(target!==dealNav)target.remove()}}
function isDealsView(){return [...document.querySelectorAll('h1,h2,h3')].some(n=>visible(n)&&/^СДЕЛКИ$/i.test(text(n.textContent)))}
function domDealIds(){const out=[];for(const n of document.querySelectorAll('span,p,strong,b,a,div')){if(!visible(n))continue;const t=text(n.textContent);if(DEAL_RE.test(t))out.push(t)}return[...new Set(out)]}
function exactDealLeaves(id){return [...document.querySelectorAll('span,p,strong,b,a,div')].filter(n=>visible(n)&&text(n.textContent)===id)}
function hasOtherDeal(node,id,ids){const t=text(node.innerText||node.textContent);return ids.some(x=>x!==id&&t.includes(x))}
function hasOpen(node){return [...node.querySelectorAll('button,a,[role="button"]')].some(n=>visible(n)&&/^ОТКРЫТЬ$/i.test(text(n.textContent)))}
function dealHost(id,ids){const prior=document.querySelector(`.${HOST}[data-rona-canonical-deal-id="${id}"]`);if(prior?.isConnected)return prior;const c=[];for(const leaf of exactDealLeaves(id)){let n=leaf;for(let depth=0;n&&n!==document.body&&depth<9;depth++,n=n.parentElement){if(!visible(n))continue;const t=text(n.innerText||n.textContent);if(!t.includes(id))continue;if(hasOtherDeal(n,id,ids))break;const r=n.getBoundingClientRect();if(r.width<420||r.height<32||r.height>260)continue;c.push({node:n,open:hasOpen(n),height:r.height,area:r.width*r.height,depth,width:r.width})}}if(!c.length)return null;const u=[],seen=new Set();for(const x of c){if(seen.has(x.node))continue;seen.add(x.node);u.push(x)}const open=u.filter(x=>x.open),pool=open.length?open:u;pool.sort((a,b)=>a.height-b.height||a.area-b.area||a.depth-b.depth||b.width-a.width);return pool[0]?.node||null}
function leaves(host){return [...host.querySelectorAll('span,small,p,strong,b,div,label')].filter(n=>visible(n)&&!n.closest(`.${PANEL}`)&&!n.closest('button,a,[role="button"]')).filter(n=>{const t=text(n.textContent);return t&&t.length<=340&&![...n.children].some(c=>visible(c)&&text(c.textContent))})}
function clearClasses(host){for(const n of host.querySelectorAll('[class*="rona-deal-card-v"]')){if(n===host)continue}for(const n of host.querySelectorAll(`.${HOST}__dealid,.${HOST}__detail,.${HOST}__sumlabel,.${HOST}__amount,.${HOST}__status,.${HOST}__resource-ok,.${HOST}__resource-no,.${HOST}__open`))n.classList.remove(`${HOST}__dealid`,`${HOST}__detail`,`${HOST}__sumlabel`,`${HOST}__amount`,`${HOST}__status`,`${HOST}__resource-ok`,`${HOST}__resource-no`,`${HOST}__open`)}
function normalizeResource(host){const ls=leaves(host),labels=ls.filter(n=>/^РЕСУРС$/i.test(text(n.textContent))),no=ls.find(n=>RESOURCE_NO.test(text(n.textContent))),ok=ls.find(n=>RESOURCE_OK.test(text(n.textContent))&&!RESOURCE_NO.test(text(n.textContent)));if(no){no.textContent='Ресурс не подтвержден';no.classList.add(`${HOST}__status`,`${HOST}__resource-no`);labels.forEach(n=>n.remove())}else if(ok){ok.textContent='Ресурс подтвержден';ok.classList.add(`${HOST}__status`,`${HOST}__resource-ok`);labels.forEach(n=>n.remove())}}
function decorate(host,id){host.classList.remove('rona-deal-card-v1','rona-deal-card-v2','rona-deal-card-v3','rona-deal-card-v4','rona-deal-card-polished-v1');host.classList.add(HOST);host.dataset.ronaCanonicalDealId=id;clearClasses(host);normalizeResource(host);for(const n of leaves(host)){const t=text(n.textContent);if(t===id){n.classList.add(`${HOST}__dealid`);continue}if(STATUS_RE.test(t)){n.classList.add(`${HOST}__status`);continue}if(/^СУММА$/i.test(t)){n.classList.add(`${HOST}__sumlabel`);continue}if(/\d[\d\s.,]*\s*(?:МЛН\.?\s*)?(?:ДОЛЛ\.?\s*США|USD|EUR|РУБ\.?|СОМ|CNY|ЮАН(?:Ь|Я|ЕЙ)?)(?:\b|$)/i.test(t)){n.classList.add(`${HOST}__amount`);continue}if(t.length>=5)n.classList.add(`${HOST}__detail`)}for(const n of host.querySelectorAll('button,a,[role="button"]'))if(/^ОТКРЫТЬ$/i.test(text(n.textContent)))n.classList.add(`${HOST}__open`)}
const typeDocs=(info,type)=>info.documents.filter(d=>text(d.document_type).toUpperCase()===type);
async function signedUrl(doc){const id=text(doc.storage_object_id);if(!id)throw new Error('STORAGE_OBJECT_REQUIRED');const j=await getJson(`${API}/v1/client/storage/${encodeURIComponent(id)}/signed-url`);const url=j?.signed_url||j?.signedUrl||j?.data?.signed_url||j?.data?.signedUrl;if(!url)throw new Error('SIGNED_URL_MISSING');return url}
async function markDownload(info,doc){const kind=text(doc.document_type).toUpperCase();if(!['ADDENDUM','INVOICE'].includes(kind))return;await getJson(`${API}/v1/client/deals/${encodeURIComponent(info.dealId)}/documents/${encodeURIComponent(text(doc.document_id))}/downloaded`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})}
async function download(info,doc,b){if(b.disabled)return;const old=b.textContent;b.disabled=true;b.textContent='Открываю…';let tab=null;try{tab=window.open('about:blank','_blank');if(tab)try{tab.opener=null}catch{};const url=await signedUrl(doc);if(tab)tab.location.replace(url);else{const a=el('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.style.display='none';document.body.appendChild(a);a.click();a.remove()}try{await markDownload(info,doc)}catch{}if(text(doc.document_type).toUpperCase()==='ADDENDUM'){info.workflow={...info.workflow,client_addendum_downloaded_at:new Date().toISOString()};renderDeal(info.dealId);setTimeout(loadData,400)}}catch(err){if(tab)try{tab.close()}catch{};console.error('deal document download failed',err);b.textContent='Не удалось открыть';setTimeout(()=>{if(b.isConnected){b.disabled=false;b.textContent=old}},1800);return}if(b.isConnected){b.disabled=false;b.textContent=old}}
function docButton(info,doc,label,signed=false){const b=el('button',`${PANEL}__action ${PANEL}__action--download${signed?` ${PANEL}__action--signed`:''}`,label);b.type='button';const fn=text(doc.authoritative_filename)||text(doc.document_id)||'PDF';b.title=fn;b.addEventListener('click',()=>download(info,doc,b));return b}
function uploadedButton(){const b=el('button',`${PANEL}__action ${PANEL}__action--uploaded`,'Загружено');b.type='button';b.disabled=true;b.setAttribute('aria-disabled','true');b.title='Подписанное дополнительное соглашение успешно зарегистрировано';return b}
function appendUpload(info,actions,sourceDoc){const input=el('input');input.type='file';input.accept='application/pdf,.pdf';input.hidden=true;const b=el('button',`${PANEL}__action ${PANEL}__action--upload`,'Загрузить подписанное доп. соглашение');b.type='button';b.addEventListener('click',()=>input.click());input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;b.disabled=true;b.textContent='Загружаю…';try{const sourceId=text(sourceDoc?.document_id);if(!sourceId)throw new Error('SOURCE_ADDENDUM_REQUIRED');const fd=new FormData();fd.append('file',file,file.name);fd.append('sourceUnsignedDocumentId',sourceId);const result=await getJson(`${API}/v1/client/deals/${encodeURIComponent(info.dealId)}/signed-addendum`,{method:'POST',body:fd});const signed=result?.signed_document||result?.document;if(!signed?.document_id||text(result?.supersedes_document_id)!==sourceId||text(signed.document_type).toUpperCase()!=='SIGNED_ADDENDUM')throw new Error('SIGNED_ADDENDUM_CONFIRMATION_INVALID');info.documents=info.documents.filter(d=>text(d.document_id)!==sourceId&&text(d.document_type).toUpperCase()!=='SIGNED_ADDENDUM');info.documents.push(signed);info.workflow={...info.workflow,...(result.workflow||{}),client_stage:'DOCUMENTS_SIGNED',signed_addendum_document_id:text(signed.document_id)};renderDeal(info.dealId);await loadData()}catch(err){console.error('signed addendum upload failed',err);b.disabled=false;b.textContent='Загрузить подписанное доп. соглашение';input.value='';if(err?.payload?.code==='ADDENDUM_SOURCE_CHANGED'||err?.payload?.code==='SIGNED_ADDENDUM_ALREADY_CURRENT')setTimeout(loadData,150)}});actions.append(b,input)}
function signature(info){return JSON.stringify({docs:info.documents.map(d=>[text(d.document_id),text(d.document_type),text(d.storage_object_id),text(d.updated_at)]),downloaded:text(info.workflow?.client_addendum_downloaded_at),stage:text(info.workflow?.client_stage),handoff:text(info.workflow?.payment_handoff_state),signed:text(info.workflow?.signed_addendum_document_id)})}
function buildPanel(info){const p=el('div',PANEL);p.dataset.dealId=info.dealId;p.dataset.signature=signature(info);p.append(el('div',`${PANEL}__label`,'Документы'));const a=el('div',`${PANEL}__actions`),ds=typeDocs(info,'ADDENDUM'),inv=typeDocs(info,'INVOICE'),signed=typeDocs(info,'SIGNED_ADDENDUM');if(signed.length){signed.forEach((d,i)=>a.append(docButton(info,d,signed.length>1?`Дополнительное соглашение ${i+1}`:'Дополнительное соглашение',true)))}else{ds.forEach((d,i)=>a.append(docButton(info,d,ds.length>1?`Дополнительное соглашение ${i+1}`:'Дополнительное соглашение')))}inv.forEach((d,i)=>a.append(docButton(info,d,inv.length>1?`Инвойс ${i+1}`:'Инвойс')));if(signed.length)a.append(uploadedButton());else if(info.workflow?.client_addendum_downloaded_at&&ds.length)appendUpload(info,a,ds[0]);if(a.querySelector('button'))p.append(a);else p.append(el('div',`${PANEL}__empty`,'Документы пока не опубликованы'));if(signed.length)p.append(el('div',`${PANEL}__stage ${PANEL}__stage--signed`,'Документы подписаны'));else if(text(info.workflow?.payment_handoff_state)==='SENT')p.append(el('div',`${PANEL}__stage`,'Платежи'));return p}
function panelFor(id){return [...document.querySelectorAll(`.${PANEL}`)].find(n=>n.dataset.dealId===id)||null}
function renderDeal(id){if(!isDealsView())return;const info=state.deals.get(id);if(!info)return;const ids=domDealIds();const host=dealHost(id,ids);if(!host)return;decorate(host,id);let p=panelFor(id);if(p&&p.parentElement!==host){p.remove();p=null}const sig=signature(info);if(p&&p.dataset.signature===sig)return;const next=buildPanel(info);if(p)p.replaceWith(next);else host.appendChild(next)}
function cleanup(ids){for(const p of document.querySelectorAll(`.${PANEL}`)){const id=text(p.dataset.dealId);if(!ids.includes(id)||!state.deals.has(id))p.remove()}for(const n of document.querySelectorAll('.rona-deal-documents-v1,.rona-deal-documents-v2,.rona-deal-documents-v3,.rona-deal-documents-v4'))n.remove()}
function scan(){removeLegacySection();if(!isDealsView())return;const ids=domDealIds();cleanup(ids);for(const id of ids)if(state.deals.has(id))renderDeal(id)}
function scheduleScan(delay=80){clearTimeout(state.scanTimer);state.scanTimer=setTimeout(scan,delay)}
function topbarControl(target){const n=target?.closest?.('button,[role="button"],[role="combobox"],select');if(!n)return false;const t=low(n.textContent);if(t==='выход'||t==='выйти'||t==='logout')return false;return Boolean(n.closest?.('header,.topbar,[class*="topbar"],[class*="header"],[data-user-menu],.user-menu,.user-actions,.header-actions,.topbar-actions'))}
function start(){
  ensureStyle();removeLegacySection();
  const authority=contextAuthority();
  if(authority)state.unsubscribe=authority.subscribe(ctx=>{const key=ctxKey(ctx);if(key!==state.contextKey){state.contextKey=key;state.deals=new Map();state.lastLoad=0;cleanup(domDealIds())}loadData()});
  else console.error('RONA canonical deal documents: context authority unavailable');
  loadData();
  document.addEventListener('click',e=>{const n=e.target?.closest?.('a,button,[role="tab"],[role="menuitem"],[role="button"],[role="combobox"]');const t=text(n?.textContent);if(/^СДЕЛКИ$/i.test(t)||legacyLabel(t)||topbarControl(e.target)){scheduleScan(90);setTimeout(scan,240);setTimeout(scan,600)}else if(isDealsView())scheduleScan(120)},true);
  document.addEventListener('change',()=>{scheduleScan(100);setTimeout(scan,320)},true);
  window.addEventListener('pageshow',()=>{scan();if(Date.now()-state.lastLoad>10000)loadData()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-state.lastLoad>10000)loadData()},{passive:true});
  setInterval(()=>{if(document.visibilityState==='visible'&&isDealsView())scan()},1800);
  setInterval(()=>{if(document.visibilityState==='visible')loadData()},30000)
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
