(()=>{
  'use strict';
  const MARK='20260829-deal-documents-v2-universal-stable-ui-v3';
  if(window.__RONA_CLIENT_DEAL_DOCUMENTS_V2__===MARK)return;
  window.__RONA_CLIENT_DEAL_DOCUMENTS_V2__=MARK;

  const API='/portal/api';
  const PANEL='rona-deal-documents-v2';
  const HOST='rona-deal-host-v2';
  const LEGACY_RE=/^(?:ДС\s*(?:(?:И|\/|&)\s*)?(?:ИНВОЙС(?:Ы)?|INVOICES?)|DS\s*(?:(?:AND|\/|&)\s*)?INVOICES?)$/i;
  const DEAL_RE=/^DEAL-\d{4}-\d{3,}$/;
  const STATUS_RE=/^(?:В\s+ИСПОЛНЕНИИ|СДЕЛКА\s+ОТКРЫТА|РЕСУРС\s+ПОДТВЕРЖД[ЕЁ]Н|ПОДТВЕРЖД[ЕЁ]Н|НЕ\s+ПОДТВЕРЖД[ЕЁ]Н|РЕСУРС\s+НЕ\s+ПОДТВЕРЖД[ЕЁ]Н|ПЛАТЕЖИ|ОЖИДАЕТ\s+ОПЛАТЫ|ОПЛАЧЕН(?:О|А)?|ЗАВЕРШЕН(?:А|О)?|ЗАКРЫТ(?:А|О)?|ОТМЕНЕН(?:А|О)?|НА\s+СОГЛАСОВАНИИ)$/i;
  const state={deals:new Map(),busy:false,lastLoad:0};
  let scanTimer=null;
  let loadTimer=null;

  const text=v=>String(v??'').replace(/\s+/g,' ').trim();
  const visible=n=>{if(!n||!n.isConnected)return false;const s=getComputedStyle(n);return s.display!=='none'&&s.visibility!=='hidden'&&n.getClientRects().length>0};
  const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n};
  const cssEscape=v=>window.CSS&&typeof CSS.escape==='function'?CSS.escape(String(v)):String(v).replace(/["\\]/g,'\\$&');

  function ensureStyle(){
    let s=document.getElementById(`${PANEL}-style`);
    if(s)s.remove();
    s=el('style');s.id=`${PANEL}-style`;
    s.textContent=`
      .${HOST}{min-width:0!important;min-height:72px!important;box-sizing:border-box!important;padding-top:10px!important;padding-bottom:10px!important;align-items:center!important;overflow:visible!important}
      .${HOST} *{box-sizing:border-box}
      .${HOST}__dealid{font-size:13.4px!important;font-weight:820!important;line-height:1.28!important;letter-spacing:.015em!important;color:rgba(244,249,255,.98)!important;white-space:nowrap!important}
      .${HOST}__detail{font-size:11.45px!important;font-weight:540!important;line-height:1.45!important;color:rgba(203,213,225,.78)!important;white-space:normal!important;overflow:visible!important}
      .${HOST}__sumlabel{font-size:10.5px!important;font-weight:690!important;line-height:1.25!important;color:rgba(148,163,184,.76)!important;white-space:nowrap!important}
      .${HOST}__amount{font-size:13.1px!important;font-weight:810!important;line-height:1.25!important;color:rgba(226,252,239,.94)!important;white-space:nowrap!important}
      .${HOST}__status{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:26px!important;height:26px!important;box-sizing:border-box!important;padding:0 11px!important;border-radius:999px!important;font-size:10.7px!important;font-weight:760!important;line-height:1!important;white-space:nowrap!important;vertical-align:middle!important;margin-top:0!important;margin-bottom:0!important;transform:none!important;align-self:center!important}
      .${HOST}__resource-ok{gap:5px!important;border:1px solid rgba(74,222,128,.25)!important;background:rgba(34,197,94,.065)!important;color:rgba(187,247,208,.92)!important}
      .${HOST}__resource-ok::before{content:'';display:block;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.9}
      .${HOST}__resource-no{gap:5px!important;border:1px solid rgba(250,204,21,.30)!important;background:rgba(234,179,8,.07)!important;color:rgba(254,240,138,.92)!important}
      .${HOST}__resource-no::before{content:'';display:block;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.88}
      .${HOST}__open{min-height:30px!important;height:30px!important;padding:0 12px!important;font-size:10.8px!important;font-weight:750!important;line-height:1!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}
      .${PANEL}{width:100%!important;min-width:0!important;box-sizing:border-box!important;grid-column:1/-1!important;flex:0 0 100%!important;display:flex!important;align-items:center!important;gap:10px!important;margin:0!important;padding:10px 2px 7px!important;border-top:1px solid rgba(113,154,184,.13)!important;font-family:inherit!important;color:inherit!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important}
      .${PANEL}::-webkit-scrollbar{display:none}
      .${PANEL}__label{flex:0 0 auto;font-size:10.8px;font-weight:780;line-height:1;color:rgba(203,213,225,.62);white-space:nowrap;text-transform:none}
      .${PANEL}__actions{display:flex!important;align-items:center!important;gap:9px!important;flex:0 0 auto!important;flex-wrap:nowrap!important;min-width:0!important}
      .${PANEL}__action{position:relative;appearance:none;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;flex:0 0 auto!important;min-height:34px!important;height:34px!important;padding:0 12px!important;border:1px solid rgba(93,180,226,.42)!important;border-radius:9px!important;background:linear-gradient(180deg,rgba(19,66,97,.92),rgba(8,39,62,.94))!important;box-shadow:0 4px 12px rgba(1,8,16,.19),inset 0 1px 0 rgba(255,255,255,.07)!important;color:rgba(244,250,255,.96)!important;font:760 11.2px/1 inherit!important;letter-spacing:.004em!important;cursor:pointer!important;white-space:nowrap!important;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,filter .16s ease!important}
      .${PANEL}__action::before{display:grid;place-items:center;width:18px;height:18px;flex:0 0 18px;border-radius:6px;background:rgba(125,211,252,.10);border:1px solid rgba(125,211,252,.18);font-size:11px;font-weight:800;line-height:1;color:rgba(186,230,253,.96)}
      .${PANEL}__action--download::before{content:'↓'}
      .${PANEL}__action--signed::before{content:'✓';background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.18);color:rgba(187,247,208,.96)}
      .${PANEL}__action:hover{transform:translateY(-1px)!important;border-color:rgba(125,211,252,.70)!important;box-shadow:0 7px 18px rgba(1,8,16,.27),0 0 0 1px rgba(56,189,248,.07),inset 0 1px 0 rgba(255,255,255,.10)!important;filter:brightness(1.08)!important}
      .${PANEL}__action:active{transform:translateY(0)!important}
      .${PANEL}__action:disabled{opacity:.56!important;cursor:wait!important;transform:none!important;filter:none!important}
      .${PANEL}__action--upload{overflow:hidden!important;border-color:rgba(248,113,113,.70)!important;background:linear-gradient(105deg,#7d1c2a,#b82e3b,#7d1c2a)!important;background-size:220% 100%!important;box-shadow:0 6px 18px rgba(127,29,29,.28),0 0 0 1px rgba(239,68,68,.06),inset 0 1px 0 rgba(255,255,255,.10)!important;animation:ronaSignedDsStablePulse 2.4s ease-in-out infinite,ronaSignedDsStableFlow 4s linear infinite!important;color:#fff5f5!important}
      .${PANEL}__action--upload::before{content:'↑';background:rgba(255,255,255,.10);border-color:rgba(254,202,202,.32);color:#fff1f2}
      .${PANEL}__action--upload::after{content:'';position:absolute;top:-35%;bottom:-35%;left:-48%;width:34%;transform:skewX(-18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent);animation:ronaSignedDsStableSweep 3.1s ease-in-out infinite;pointer-events:none}
      .${PANEL}__stage{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;height:26px;box-sizing:border-box;padding:0 10px;border-radius:999px;border:1px solid rgba(96,165,250,.24);background:rgba(59,130,246,.07);color:rgba(191,219,254,.90);font-size:10.7px;font-weight:760;line-height:1;white-space:nowrap;flex:0 0 auto}
      .${PANEL}__empty{font-size:10.8px;line-height:1.3;color:rgba(203,213,225,.48);white-space:nowrap}
      .${PANEL}__error{font-size:10.8px;line-height:1.25;color:#fca5a5;white-space:nowrap}
      @keyframes ronaSignedDsStableFlow{0%{background-position:100% 0}100%{background-position:-100% 0}}
      @keyframes ronaSignedDsStablePulse{0%,100%{box-shadow:0 6px 18px rgba(127,29,29,.22),0 0 0 1px rgba(239,68,68,.05)}50%{box-shadow:0 8px 24px rgba(127,29,29,.38),0 0 18px rgba(239,68,68,.22)}}
      @keyframes ronaSignedDsStableSweep{0%,24%{left:-48%;opacity:0}40%{opacity:1}62%{left:116%;opacity:0}100%{left:116%;opacity:0}}
      @media(max-width:760px){.${HOST}{min-height:76px!important}.${PANEL}{gap:8px!important}.${PANEL}__action{min-height:36px!important;height:36px!important}}
      @media(prefers-reduced-motion:reduce){.${PANEL}__action--upload,.${PANEL}__action--upload::after{animation:none!important}}
    `;
    document.head.appendChild(s);
  }

  async function getJson(url,init={}){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...init});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Object.assign(new Error(j?.code||`HTTP_${r.status}`),{status:r.status,payload:j});
    return j;
  }

  async function loadData(){
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
      state.lastLoad=Date.now();
    }catch(err){console.error('RONA universal deal documents load failed',err)}
    finally{state.busy=false;scan()}
  }

  function navExact(label){
    const wanted=text(label).toLowerCase();
    return [...document.querySelectorAll('a,button,[role="tab"],[role="menuitem"]')].find(n=>visible(n)&&text(n.textContent).toLowerCase()===wanted)||null;
  }

  function removeLegacySection(){
    const dealNav=navExact('Сделки');
    const nodes=[...document.querySelectorAll('a,button,[role="tab"],[role="menuitem"],li')].filter(n=>LEGACY_RE.test(text(n.textContent)));
    for(const n of nodes){
      const active=n.getAttribute('aria-selected')==='true'||!!n.getAttribute('aria-current')||/(^|\s)(active|selected)(\s|$)/i.test(String(n.className||''));
      if(active&&dealNav)try{dealNav.click()}catch{}
      const li=n.closest('li');
      const target=n.tagName==='LI'?n:(li&&LEGACY_RE.test(text(li.textContent))?li:n);
      if(target&&target!==dealNav)target.remove();
    }
  }

  function isDealsView(){
    return [...document.querySelectorAll('h1,h2,h3')].some(n=>visible(n)&&/^СДЕЛКИ$/i.test(text(n.textContent)));
  }

  function hasOtherDeal(node,dealId,allIds){
    const t=text(node.innerText||node.textContent);
    return allIds.some(id=>id!==dealId&&t.includes(id));
  }

  function exactDealLeaves(dealId){
    return [...document.querySelectorAll('span,p,strong,b,a,div')].filter(n=>visible(n)&&text(n.textContent)===dealId);
  }

  function hasOpenControl(node){
    return [...node.querySelectorAll('button,a,[role="button"]')].some(n=>visible(n)&&/^ОТКРЫТЬ$/i.test(text(n.textContent)));
  }

  function dealHost(dealId,allIds){
    const candidates=[];
    for(const leaf of exactDealLeaves(dealId)){
      let n=leaf;
      for(let depth=0;n&&n!==document.body&&depth<10;depth++,n=n.parentElement){
        if(!visible(n))continue;
        const t=text(n.innerText||n.textContent);
        if(!t.includes(dealId))continue;
        if(hasOtherDeal(n,dealId,allIds))break;
        const r=n.getBoundingClientRect();
        if(r.width<420||r.height<36||r.height>180)continue;
        candidates.push({node:n,open:hasOpenControl(n),area:r.width*r.height,height:r.height});
      }
    }
    if(!candidates.length)return null;
    const unique=[];const seen=new Set();
    for(const c of candidates){if(seen.has(c.node))continue;seen.add(c.node);unique.push(c)}
    unique.sort((a,b)=>{
      if(a.open!==b.open)return a.open?-1:1;
      if(a.height!==b.height)return a.height-b.height;
      return a.area-b.area;
    });
    return unique[0].node;
  }

  function smallestTextNodes(host){
    const nodes=[...host.querySelectorAll('span,small,p,strong,b,div,label')].filter(n=>visible(n)&&!n.closest(`.${PANEL}`)&&!n.closest('button,a,[role="button"]'));
    return nodes.filter(n=>{
      const t=text(n.textContent);if(!t||t.length>240)return false;
      return ![...n.children].some(c=>visible(c)&&text(c.textContent));
    });
  }

  function normalizeResourceStatus(host){
    const leaves=smallestTextNodes(host);
    const resourceLabels=leaves.filter(n=>/^РЕСУРС$/i.test(text(n.textContent)));
    const confirmed=leaves.find(n=>/^(?:РЕСУРС\s+)?ПОДТВЕРЖД[ЕЁ]Н$/i.test(text(n.textContent)));
    const unconfirmed=leaves.find(n=>/^(?:РЕСУРС\s+)?НЕ\s+ПОДТВЕРЖД[ЕЁ]Н$/i.test(text(n.textContent))||/^НЕ\s+ПОДТВЕРЖД[ЕЁ]Н$/i.test(text(n.textContent)));
    if(confirmed){confirmed.textContent='Ресурс подтвержден';confirmed.classList.add(`${HOST}__status`,`${HOST}__resource-ok`);resourceLabels.forEach(n=>n.remove())}
    else if(unconfirmed){unconfirmed.textContent='Ресурс не подтвержден';unconfirmed.classList.add(`${HOST}__status`,`${HOST}__resource-no`);resourceLabels.forEach(n=>n.remove())}
  }

  function decorateHost(host,dealId){
    host.classList.add(HOST);
    normalizeResourceStatus(host);
    const leaves=smallestTextNodes(host);
    for(const n of leaves){
      const t=text(n.textContent);
      if(!t)continue;
      if(t===dealId){n.classList.add(`${HOST}__dealid`);continue}
      if(STATUS_RE.test(t)){n.classList.add(`${HOST}__status`);continue}
      if(/^СУММА$/i.test(t)){n.classList.add(`${HOST}__sumlabel`);continue}
      if(/\d[\d\s.,]*\s*(?:ДОЛЛ\.?\s*США|USD|EUR|РУБ\.?|СОМ)(?:\b|$)/i.test(t)){n.classList.add(`${HOST}__amount`);continue}
      if(t.length>=6)n.classList.add(`${HOST}__detail`);
    }
    for(const n of [...host.querySelectorAll('button,a,[role="button"]')])if(/^ОТКРЫТЬ$/i.test(text(n.textContent)))n.classList.add(`${HOST}__open`);
  }

  function typeDocs(info,type){return info.documents.filter(d=>text(d.document_type).toUpperCase()===type)}

  async function signedUrl(doc){
    const id=text(doc.storage_object_id);
    if(!id)throw new Error('STORAGE_OBJECT_REQUIRED');
    const j=await getJson(`${API}/v1/client/storage/${encodeURIComponent(id)}/signed-url`);
    const url=j?.signed_url||j?.signedUrl;
    if(!url)throw new Error('SIGNED_URL_MISSING');
    return url;
  }

  async function markDownload(info,doc){
    const kind=text(doc.document_type).toUpperCase();
    if(!['ADDENDUM','INVOICE'].includes(kind))return true;
    await getJson(`${API}/v1/client/deals/${encodeURIComponent(info.dealId)}/documents/${encodeURIComponent(text(doc.document_id))}/downloaded`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    return true;
  }

  async function download(info,doc,button){
    if(button.disabled)return;
    button.disabled=true;
    const old=button.textContent;
    button.textContent='Открываю…';
    let tab=null;
    try{
      tab=window.open('about:blank','_blank');if(tab)try{tab.opener=null}catch{}
      const url=await signedUrl(doc);
      if(tab)tab.location.replace(url);else{const a=el('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.style.display='none';document.body.appendChild(a);a.click();a.remove()}
      try{await markDownload(info,doc)}catch(err){console.warn('deal document download mark failed',err)}
      if(text(doc.document_type).toUpperCase()==='ADDENDUM'){
        info.workflow={...info.workflow,client_addendum_downloaded_at:new Date().toISOString()};
        renderDeal(info.dealId);
        setTimeout(loadData,350);
      }
    }catch(err){
      if(tab)try{tab.close()}catch{}
      console.error('deal document download failed',err);
      button.textContent='Не удалось открыть';
      setTimeout(()=>{if(button.isConnected){button.disabled=false;button.textContent=old}},1800);
      return;
    }
    if(button.isConnected){button.disabled=false;button.textContent=old}
  }

  function docButton(info,doc,label,signed=false){
    const b=el('button',`${PANEL}__action ${PANEL}__action--download${signed?` ${PANEL}__action--signed`:''}`,label);b.type='button';
    const filename=text(doc.authoritative_filename)||text(doc.document_id)||'PDF';
    b.title=filename;b.setAttribute('aria-label',`${label}. ${filename}`);b.addEventListener('click',()=>download(info,doc,b));
    return b;
  }

  function uploadErrorMessage(code){
    const map={ADDENDUM_DOWNLOAD_REQUIRED:'Сначала скачайте дополнительное соглашение.',CURRENT_ADDENDUM_REQUIRED:'Актуальное дополнительное соглашение недоступно.',PDF_REQUIRED:'Выберите PDF-файл.',PDF_SIGNATURE_INVALID:'Файл не является корректным PDF.',PDF_SIZE_INVALID:'Размер PDF превышает допустимый лимит.',STORAGE_UPLOAD_FAILED:'Не удалось загрузить файл в защищённое хранилище.',STORAGE_OBJECT_ID_MISSING:'Не удалось зарегистрировать файл в защищённом хранилище.',SIGNED_ADDENDUM_REGISTER_FAILED:'Не удалось зарегистрировать подписанное ДС.'};
    return map[code]||'Не удалось загрузить подписанное ДС.';
  }

  function appendUpload(info,panel,actions){
    const input=el('input');input.type='file';input.accept='application/pdf,.pdf';input.hidden=true;
    const b=el('button',`${PANEL}__action ${PANEL}__action--upload`,'Загрузить подписанное ДС');b.type='button';b.addEventListener('click',()=>input.click());
    input.addEventListener('change',async()=>{
      const file=input.files?.[0];if(!file)return;
      b.disabled=true;b.textContent='Загружаю…';panel.querySelector(`.${PANEL}__error`)?.remove();
      try{
        const fd=new FormData();fd.append('file',file,file.name);
        await getJson(`${API}/v1/client/deals/${encodeURIComponent(info.dealId)}/signed-addendum`,{method:'POST',body:fd});
        info.workflow={...info.workflow,client_stage:'PAYMENTS',payment_handoff_state:'READY'};
        b.textContent='Подписанное ДС загружено';await loadData();
      }catch(err){
        panel.append(el('div',`${PANEL}__error`,uploadErrorMessage(err?.payload?.code||err?.message)));
        b.disabled=false;b.textContent='Загрузить подписанное ДС';input.value='';
      }
    });
    actions.append(b,input);
  }

  function panelSignature(info){
    return JSON.stringify({docs:info.documents.map(d=>[text(d.document_id),text(d.document_type),text(d.storage_object_id),text(d.updated_at)]),downloaded:text(info.workflow?.client_addendum_downloaded_at),stage:text(info.workflow?.client_stage),handoff:text(info.workflow?.payment_handoff_state)});
  }

  function buildPanel(info){
    const panel=el('div',PANEL);panel.dataset.dealId=info.dealId;panel.dataset.signature=panelSignature(info);
    panel.append(el('div',`${PANEL}__label`,'Документы'));
    const actions=el('div',`${PANEL}__actions`);
    const ds=typeDocs(info,'ADDENDUM'),invoices=typeDocs(info,'INVOICE'),signed=typeDocs(info,'SIGNED_ADDENDUM');
    ds.forEach((d,i)=>actions.append(docButton(info,d,ds.length>1?`Дополнительное соглашение ${i+1}`:'Дополнительное соглашение')));
    invoices.forEach((d,i)=>actions.append(docButton(info,d,invoices.length>1?`Инвойс ${i+1}`:'Инвойс')));
    signed.forEach((d,i)=>actions.append(docButton(info,d,signed.length>1?`Подписанное ДС ${i+1}`:'Подписанное ДС',true)));
    if(info.workflow?.client_addendum_downloaded_at&&!signed.length)appendUpload(info,panel,actions);
    if(actions.querySelector('button'))panel.append(actions);else panel.append(el('div',`${PANEL}__empty`,'Документы пока не опубликованы'));
    const payment=text(info.workflow?.client_stage)==='PAYMENTS'||['READY','SENT'].includes(text(info.workflow?.payment_handoff_state));
    if(payment)panel.append(el('div',`${PANEL}__stage`,'Платежи'));
    return panel;
  }

  function panelFor(dealId){
    return [...document.querySelectorAll(`.${PANEL}`)].find(n=>n.dataset.dealId===dealId)||null;
  }

  function renderDeal(dealId){
    if(!isDealsView())return;
    const info=state.deals.get(dealId);if(!info)return;
    const allIds=[...state.deals.keys()];
    const host=dealHost(dealId,allIds);if(!host)return;
    decorateHost(host,dealId);
    let panel=panelFor(dealId);
    if(panel&&panel.previousElementSibling!==host){panel.remove();panel=null}
    const sig=panelSignature(info);
    if(panel&&panel.dataset.signature===sig)return;
    const next=buildPanel(info);
    if(panel)panel.replaceWith(next);else host.insertAdjacentElement('afterend',next);
  }

  function cleanupStalePanels(){
    for(const panel of [...document.querySelectorAll(`.${PANEL}`)]){
      const id=text(panel.dataset.dealId);if(!state.deals.has(id))panel.remove();
    }
    document.querySelectorAll('.rona-deal-documents-v1').forEach(n=>n.remove());
  }

  function scan(){
    removeLegacySection();
    if(!isDealsView())return;
    cleanupStalePanels();
    for(const dealId of state.deals.keys())renderDeal(dealId);
  }

  function start(){
    ensureStyle();
    removeLegacySection();
    loadData();
    scanTimer=setInterval(scan,900);
    loadTimer=setInterval(loadData,30000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-state.lastLoad>10000)loadData()},{passive:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
