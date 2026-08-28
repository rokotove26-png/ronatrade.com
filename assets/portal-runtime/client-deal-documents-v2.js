(()=>{
  'use strict';
  const MARK='20260829-deal-documents-v2-universal-multideal';
  if(window.__RONA_CLIENT_DEAL_DOCUMENTS_V2__===MARK)return;
  window.__RONA_CLIENT_DEAL_DOCUMENTS_V2__=MARK;

  const API='/portal/api';
  const PANEL='rona-deal-documents-v2';
  const HOST='rona-deal-host-v2';
  const LEGACY_RE=/^(?:ДС\s*(?:(?:И|\/|&)\s*)?(?:ИНВОЙС(?:Ы)?|INVOICES?)|DS\s*(?:(?:AND|\/|&)\s*)?INVOICES?)$/i;
  const DEAL_RE=/^DEAL-\d{4}-\d{3,}$/;
  const RESOURCE_CONFIRMED_RE=/^(?:РЕСУРС\s+)?ПОДТВЕРЖД[ЕЁ]Н$/i;
  const DEAL_STATUS_RE=/^(?:В\s+ИСПОЛНЕНИИ|СДЕЛКА\s+ОТКРЫТА|РЕСУРС\s+ПОДТВЕРЖД[ЕЁ]Н|НЕ\s+ПОДТВЕРЖД[ЕЁ]Н|РЕСУРС\s+НЕ\s+ПОДТВЕРЖД[ЕЁ]Н|ПЛАТЕЖИ|ОЖИДАЕТ\s+ОПЛАТЫ|ОПЛАЧЕН(?:О|А)?|ЗАВЕРШЕН(?:А|О)?|ЗАКРЫТ(?:А|О)?|ОТМЕНЕН(?:А|О)?|НА\s+СОГЛАСОВАНИИ)$/i;
  const state={deals:new Map(),busy:false};
  let observing=false;

  const text=v=>String(v??'').replace(/\s+/g,' ').trim();
  const visible=n=>{if(!n||!n.isConnected)return false;const s=getComputedStyle(n);return s.display!=='none'&&s.visibility!=='hidden'&&n.getClientRects().length>0};
  const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n};

  function ensureStyle(){
    if(document.getElementById(`${PANEL}-style`))return;
    const s=el('style');s.id=`${PANEL}-style`;
    s.textContent=`
      .${HOST}{min-width:0!important}
      .${PANEL}{width:100%!important;min-width:0!important;box-sizing:border-box!important;grid-column:1/-1!important;flex:0 0 100%!important;margin-top:11px!important;padding-top:10px!important;border-top:1px solid rgba(113,154,184,.14)!important;font-family:inherit!important;color:inherit!important;overflow:visible!important}
      .${PANEL}__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 1px 8px}
      .${PANEL}__title{font-size:11.5px;font-weight:760;line-height:1.2;letter-spacing:.015em;color:rgba(203,213,225,.70)}
      .${PANEL}__stage{display:inline-flex;align-items:center;justify-content:center;height:22px;box-sizing:border-box;padding:0 9px;border-radius:999px;border:1px solid rgba(96,165,250,.24);background:rgba(59,130,246,.07);color:rgba(191,219,254,.90);font-size:10.3px;font-weight:720;line-height:1;white-space:nowrap}
      .${PANEL}__actions{display:flex!important;align-items:center!important;gap:9px!important;flex-wrap:nowrap!important;width:100%!important;min-width:0!important;overflow-x:auto!important;overflow-y:hidden!important;padding:1px 0 2px!important;scrollbar-width:none}
      .${PANEL}__actions::-webkit-scrollbar{display:none}
      .${PANEL}__action{position:relative;appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:0 0 auto;min-height:36px;padding:0 13px;border:1px solid rgba(93,180,226,.42);border-radius:9px;background:linear-gradient(180deg,rgba(19,66,97,.92),rgba(8,39,62,.94));box-shadow:0 5px 14px rgba(1,8,16,.20),inset 0 1px 0 rgba(255,255,255,.07);color:rgba(244,250,255,.96);font:760 11.3px/1.15 inherit;letter-spacing:.005em;cursor:pointer;white-space:nowrap;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,filter .16s ease}
      .${PANEL}__action::before{display:grid;place-items:center;width:19px;height:19px;flex:0 0 19px;border-radius:6px;background:rgba(125,211,252,.10);border:1px solid rgba(125,211,252,.18);font-size:12px;font-weight:800;line-height:1;color:rgba(186,230,253,.96)}
      .${PANEL}__action--download::before{content:'↓'}
      .${PANEL}__action--signed::before{content:'✓';background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.18);color:rgba(187,247,208,.96)}
      .${PANEL}__action:hover{transform:translateY(-1px);border-color:rgba(125,211,252,.70);box-shadow:0 8px 20px rgba(1,8,16,.28),0 0 0 1px rgba(56,189,248,.07),inset 0 1px 0 rgba(255,255,255,.10);filter:brightness(1.08)}
      .${PANEL}__action:active{transform:translateY(0)}
      .${PANEL}__action:disabled{opacity:.56;cursor:wait;transform:none;filter:none}
      .${PANEL}__action--upload{overflow:hidden;border-color:rgba(248,113,113,.66);background:linear-gradient(105deg,#7d1c2a,#b82e3b,#7d1c2a);background-size:220% 100%;box-shadow:0 6px 18px rgba(127,29,29,.26),0 0 0 1px rgba(239,68,68,.06),inset 0 1px 0 rgba(255,255,255,.10);animation:ronaSignedDsV2Pulse 2.4s ease-in-out infinite,ronaSignedDsV2Flow 4s linear infinite;color:#fff5f5}
      .${PANEL}__action--upload::before{content:'↑';background:rgba(255,255,255,.10);border-color:rgba(254,202,202,.32);color:#fff1f2}
      .${PANEL}__action--upload::after{content:'';position:absolute;top:-35%;bottom:-35%;left:-48%;width:34%;transform:skewX(-18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent);animation:ronaSignedDsV2Sweep 3.1s ease-in-out infinite;pointer-events:none}
      .${PANEL}__empty{padding:5px 1px;font-size:10.8px;color:rgba(203,213,225,.48)}
      .${PANEL}__error{margin-top:7px;padding:0 1px;font-size:11px;color:#fca5a5}
      .${HOST}__status{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:22px!important;height:22px!important;box-sizing:border-box!important;padding:0 9px!important;border-radius:999px!important;font-size:10.3px!important;font-weight:720!important;line-height:1!important;white-space:nowrap!important;vertical-align:middle!important;margin-top:0!important;margin-bottom:0!important;transform:none!important;align-self:center!important}
      .${HOST}__resource{gap:5px!important;border:1px solid rgba(74,222,128,.20)!important;background:rgba(34,197,94,.045)!important;color:rgba(187,247,208,.82)!important}
      .${HOST}__resource::before{content:'';display:block;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.82}
      @keyframes ronaSignedDsV2Flow{0%{background-position:100% 0}100%{background-position:-100% 0}}
      @keyframes ronaSignedDsV2Pulse{0%,100%{box-shadow:0 6px 18px rgba(127,29,29,.22),0 0 0 1px rgba(239,68,68,.05)}50%{box-shadow:0 8px 24px rgba(127,29,29,.36),0 0 18px rgba(239,68,68,.20)}}
      @keyframes ronaSignedDsV2Sweep{0%,24%{left:-48%;opacity:0}40%{opacity:1}62%{left:116%;opacity:0}100%{left:116%;opacity:0}}
      @media(max-width:760px){.${PANEL}__actions{gap:8px!important}.${PANEL}__action{min-height:38px;padding-left:12px;padding-right:12px}}
      @media(prefers-reduced-motion:reduce){.${PANEL}__action--upload,.${PANEL}__action--upload::after{animation:none}}
    `;
    document.head.appendChild(s);
  }

  async function getJson(url,init={}){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...init});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Object.assign(new Error(j?.code||`HTTP_${r.status}`),{status:r.status,payload:j});
    return j;
  }

  async function load(){
    if(state.busy)return;
    state.busy=true;
    try{
      const boot=await getJson(`${API}/v1/client/bootstrap`);
      const contexts=Array.isArray(boot?.data?.contexts)?boot.data.contexts:[];
      const next=new Map();
      await Promise.all(contexts.map(async ctx=>{
        const clientId=text(ctx.client_id),contractId=text(ctx.contract_id);
        if(!clientId||!contractId)return;
        const [context,workflow]=await Promise.all([
          getJson(`${API}/v1/client/context?clientId=${encodeURIComponent(clientId)}&contractId=${encodeURIComponent(contractId)}`),
          getJson(`${API}/v1/client/deal-documents/state?clientId=${encodeURIComponent(clientId)}&contractId=${encodeURIComponent(contractId)}`).catch(()=>({deals:[]}))
        ]);
        const data=context?.data||{};
        const wfMap=new Map((Array.isArray(workflow?.deals)?workflow.deals:[]).map(w=>[text(w.deal_id),w]));
        const docs=Array.isArray(data.documents)?data.documents:[];
        for(const d of Array.isArray(data.deals)?data.deals:[]){
          const dealId=text(d.deal_id);
          if(!DEAL_RE.test(dealId))continue;
          const dealDocs=docs.filter(doc=>text(doc.deal_id)===dealId&&['ADDENDUM','SIGNED_ADDENDUM','INVOICE'].includes(text(doc.document_type).toUpperCase())&&text(doc.storage_object_id));
          next.set(dealId,{dealId,clientId,contractId,deal:d,workflow:wfMap.get(dealId)||{},documents:dealDocs});
        }
      }));
      state.deals=next;
    }catch(err){console.error('RONA client deal documents v2 load failed',err)}
    finally{state.busy=false;render()}
  }

  function navExact(label){
    const wanted=text(label).toLowerCase();
    return [...document.querySelectorAll('a,button,[role="tab"],[role="menuitem"]')].find(n=>visible(n)&&text(n.textContent).toLowerCase()===wanted)||null;
  }

  function removeLegacySection(){
    const dealNav=navExact('Сделки');
    for(const n of [...document.querySelectorAll('a,button,[role="tab"],[role="menuitem"],li')].filter(n=>LEGACY_RE.test(text(n.textContent)))){
      const active=n.getAttribute('aria-selected')==='true'||n.getAttribute('aria-current')||/(^|\s)(active|selected)(\s|$)/i.test(String(n.className||''));
      if(active&&dealNav)try{dealNav.click()}catch{}
      const item=n.closest('li');
      const target=n.tagName==='LI'?n:(item&&LEGACY_RE.test(text(item.textContent))?item:n);
      if(target&&target!==dealNav)target.remove();
    }
  }

  function exactDealLeaves(dealId){
    return [...document.querySelectorAll('span,div,p,strong,b,a,td')].filter(n=>visible(n)&&text(n.textContent)===dealId);
  }

  function hasOtherDeal(node,dealId,allIds){
    const t=text(node.innerText||node.textContent);
    return allIds.some(id=>id!==dealId&&t.includes(id));
  }

  function dealHost(dealId,allIds){
    const candidates=[];
    for(const leaf of exactDealLeaves(dealId)){
      let best=null;
      let n=leaf;
      for(let depth=0;n&&n!==document.body&&depth<11;depth++,n=n.parentElement){
        if(!visible(n))continue;
        const t=text(n.innerText||n.textContent);
        if(!t.includes(dealId))continue;
        if(hasOtherDeal(n,dealId,allIds))break;
        const r=n.getBoundingClientRect();
        if(r.height>260)break;
        if(r.width>=260&&r.height>=26)best=n;
      }
      if(best)candidates.push(best);
    }
    const unique=[...new Set(candidates)];
    unique.sort((a,b)=>{
      const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
      const aOpen=[...a.querySelectorAll('button,a,[role="button"]')].some(x=>visible(x)&&/^ОТКРЫТЬ$/i.test(text(x.textContent)));
      const bOpen=[...b.querySelectorAll('button,a,[role="button"]')].some(x=>visible(x)&&/^ОТКРЫТЬ$/i.test(text(x.textContent)));
      if(aOpen!==bOpen)return aOpen?-1:1;
      return br.width*br.height-ar.width*ar.height;
    });
    return unique[0]||null;
  }

  function smallestExact(host,wanted){
    const nodes=[...host.querySelectorAll('span,small,label,p,strong,b,div')].filter(n=>visible(n)&&text(n.textContent)===wanted);
    nodes.sort((a,b)=>a.childElementCount-b.childElementCount||a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height);
    return nodes[0]||null;
  }

  function replaceConfirmedStatus(host){
    const nodes=[...host.querySelectorAll('span,small,label,p,strong,b,div')].filter(n=>visible(n)&&RESOURCE_CONFIRMED_RE.test(text(n.textContent)));
    nodes.sort((a,b)=>a.childElementCount-b.childElementCount||a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height);
    const n=nodes[0];if(!n)return;
    const direct=[...n.childNodes].find(x=>x.nodeType===Node.TEXT_NODE&&RESOURCE_CONFIRMED_RE.test(text(x.nodeValue)));
    if(direct)direct.nodeValue=' Ресурс подтвержден';else n.textContent='Ресурс подтвержден';
    n.classList.add(`${HOST}__resource`,`${HOST}__status`);
  }

  function normalizeStatuses(host){
    const nodes=[...host.querySelectorAll('span,small,label,p,strong,b,div')].filter(n=>visible(n)&&!n.closest(`.${PANEL}`)&&DEAL_STATUS_RE.test(text(n.textContent)));
    const selected=new Map();
    for(const n of nodes){
      const key=text(n.textContent).toUpperCase();
      const prior=selected.get(key);
      if(!prior){selected.set(key,n);continue}
      const nr=n.getBoundingClientRect(),pr=prior.getBoundingClientRect();
      const ns=n.childElementCount*100000+nr.width*nr.height,ps=prior.childElementCount*100000+pr.width*pr.height;
      if(ns<ps)selected.set(key,n);
    }
    selected.forEach(n=>n.classList.add(`${HOST}__status`));
  }

  function polishHost(host){
    host.classList.add(HOST);
    const label=smallestExact(host,'Ресурс');if(label)label.remove();
    replaceConfirmedStatus(host);
    normalizeStatuses(host);
  }

  const typeDocs=(info,type)=>info.documents.filter(d=>text(d.document_type).toUpperCase()===type);

  async function signedUrl(doc){
    const id=text(doc.storage_object_id);if(!id)throw new Error('STORAGE_OBJECT_REQUIRED');
    const j=await getJson(`${API}/v1/client/storage/${encodeURIComponent(id)}/signed-url`);
    const url=j?.signed_url||j?.signedUrl;if(!url)throw new Error('SIGNED_URL_MISSING');return url;
  }

  async function markDownload(info,doc){
    const kind=text(doc.document_type).toUpperCase();if(!['ADDENDUM','INVOICE'].includes(kind))return true;
    await getJson(`${API}/v1/client/deals/${encodeURIComponent(info.dealId)}/documents/${encodeURIComponent(text(doc.document_id))}/downloaded`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    return true;
  }

  async function download(info,doc,button){
    if(button.disabled)return;button.disabled=true;const old=button.textContent;button.textContent='Открываю…';let tab=null;
    try{
      tab=window.open('about:blank','_blank');if(tab)try{tab.opener=null}catch{}
      const url=await signedUrl(doc);
      if(tab)tab.location.replace(url);else{const a=el('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.hidden=true;document.body.appendChild(a);a.click();a.remove()}
      let marked=false;try{marked=await markDownload(info,doc)}catch(err){console.warn('deal document download mark failed',err)}
      if(marked&&text(doc.document_type).toUpperCase()==='ADDENDUM'){info.workflow={...info.workflow,client_addendum_downloaded_at:new Date().toISOString()};render();load()}
    }catch(err){if(tab)try{tab.close()}catch{};console.error('deal document download failed',err);button.textContent='Не удалось открыть';setTimeout(()=>{if(button.isConnected){button.disabled=false;button.textContent=old}},1800);return}
    if(button.isConnected){button.disabled=false;button.textContent=old}
  }

  function documentButton(info,doc,label,signed=false){
    const b=el('button',`${PANEL}__action ${PANEL}__action--download${signed?` ${PANEL}__action--signed`:''}`,label);b.type='button';
    const filename=text(doc.authoritative_filename)||text(doc.document_id)||'PDF';b.title=filename;b.setAttribute('aria-label',`${label}. ${filename}`);b.addEventListener('click',()=>download(info,doc,b));return b;
  }

  function uploadMessage(code){
    const map={ADDENDUM_DOWNLOAD_REQUIRED:'Сначала скачайте дополнительное соглашение.',CURRENT_ADDENDUM_REQUIRED:'Актуальное дополнительное соглашение недоступно.',PDF_REQUIRED:'Выберите PDF-файл.',PDF_SIGNATURE_INVALID:'Файл не является корректным PDF.',PDF_SIZE_INVALID:'Размер PDF превышает допустимый лимит.',STORAGE_UPLOAD_FAILED:'Не удалось загрузить файл в защищённое хранилище.',STORAGE_OBJECT_ID_MISSING:'Не удалось зарегистрировать файл в защищённом хранилище.',SIGNED_ADDENDUM_REGISTER_FAILED:'Не удалось зарегистрировать подписанное ДС.'};
    return map[code]||'Не удалось загрузить подписанное ДС.';
  }

  function appendUpload(info,panel,actions){
    const input=el('input');input.type='file';input.accept='application/pdf,.pdf';input.hidden=true;
    const b=el('button',`${PANEL}__action ${PANEL}__action--upload`,'Загрузить подписанное ДС');b.type='button';b.addEventListener('click',()=>input.click());
    input.addEventListener('change',async()=>{
      const file=input.files?.[0];if(!file)return;b.disabled=true;b.textContent='Загружаю…';panel.querySelector(`.${PANEL}__error`)?.remove();
      try{const fd=new FormData();fd.append('file',file,file.name);await getJson(`${API}/v1/client/deals/${encodeURIComponent(info.dealId)}/signed-addendum`,{method:'POST',body:fd});info.workflow={...info.workflow,client_stage:'PAYMENTS',payment_handoff_state:'READY'};b.textContent='Подписанное ДС загружено';await load()}
      catch(err){panel.append(el('div',`${PANEL}__error`,uploadMessage(err?.payload?.code||err?.message)));b.disabled=false;b.textContent='Загрузить подписанное ДС';input.value=''}
    });
    actions.append(b,input);
  }

  function buildPanel(info){
    const panel=el('div',PANEL);panel.dataset.dealId=info.dealId;
    const head=el('div',`${PANEL}__head`);head.append(el('div',`${PANEL}__title`,'Документы сделки'));
    const paymentStage=text(info.workflow?.client_stage)==='PAYMENTS'||['READY','SENT'].includes(text(info.workflow?.payment_handoff_state));if(paymentStage)head.append(el('div',`${PANEL}__stage`,'Платежи'));panel.append(head);
    const actions=el('div',`${PANEL}__actions`),ds=typeDocs(info,'ADDENDUM'),invoices=typeDocs(info,'INVOICE'),signed=typeDocs(info,'SIGNED_ADDENDUM');
    ds.forEach((d,i)=>actions.append(documentButton(info,d,ds.length>1?`Дополнительное соглашение ${i+1}`:'Дополнительное соглашение')));
    invoices.forEach((d,i)=>actions.append(documentButton(info,d,invoices.length>1?`Инвойс ${i+1}`:'Инвойс')));
    signed.forEach((d,i)=>actions.append(documentButton(info,d,signed.length>1?`Подписанное ДС ${i+1}`:'Подписанное ДС',true)));
    if(info.workflow?.client_addendum_downloaded_at&&!signed.length)appendUpload(info,panel,actions);
    if(actions.querySelector('button'))panel.append(actions);else panel.append(el('div',`${PANEL}__empty`,'Документы по сделке пока не опубликованы.'));
    return panel;
  }

  function observe(){if(observing)observer.observe(document.body,{childList:true,subtree:true})}

  function render(){
    if(observing)observer.disconnect();ensureStyle();removeLegacySection();document.querySelectorAll(`.${PANEL}`).forEach(n=>n.remove());
    const allIds=[...state.deals.keys()];
    for(const [dealId,info] of state.deals){const host=dealHost(dealId,allIds);if(!host)continue;polishHost(host);host.append(buildPanel(info))}
    observe();
  }

  let queued=false;
  const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;render()})});
  const start=()=>{ensureStyle();removeLegacySection();observing=true;observe();load();setInterval(load,15000)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
