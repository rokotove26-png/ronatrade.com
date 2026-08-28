(()=>{
  'use strict';
  const MARK='20260829-deal-documents-v1-6-document-buttons';
  if(window.__RONA_CLIENT_DEAL_DOCUMENTS_V1__===MARK)return;
  window.__RONA_CLIENT_DEAL_DOCUMENTS_V1__=MARK;

  const API='/portal/api';
  const PANEL_CLASS='rona-deal-documents-v1';
  const CARD_CLASS='rona-deal-card-polished-v1';
  const LEGACY_RE=/^(?:ДС\s*(?:(?:И|\/|&)\s*)?(?:ИНВОЙС(?:Ы)?|INVOICES?)|DS\s*(?:(?:AND|\/|&)\s*)?INVOICES?)$/i;
  const DEAL_RE=/^DEAL-\d{4}-\d{3,}$/;
  const RESOURCE_STATUS_RE=/^(?:РЕСУРС\s+)?ПОДТВЕРЖД[ЕЁ]Н$/i;
  const state={deals:new Map(),busy:false,lastError:null};
  let observerActive=false;

  function text(v){return String(v??'').replace(/\s+/g,' ').trim()}
  function visible(node){if(!node||!node.isConnected)return false;const s=getComputedStyle(node);return s.display!=='none'&&s.visibility!=='hidden'&&node.getClientRects().length>0}
  function el(tag,cls,txt){const node=document.createElement(tag);if(cls)node.className=cls;if(txt!=null)node.textContent=txt;return node}

  function ensureStyle(){
    if(document.getElementById('rona-client-deal-documents-v1-style'))return;
    const s=document.createElement('style');
    s.id='rona-client-deal-documents-v1-style';
    s.textContent=`
      .${PANEL_CLASS}{width:100%;min-width:0;box-sizing:border-box;margin-top:14px;padding-top:12px;border-top:1px solid rgba(113,154,184,.15);font-family:inherit;color:inherit}
      .${PANEL_CLASS}__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 1px 9px}
      .${PANEL_CLASS}__title{font-size:11.8px;font-weight:760;line-height:1.2;letter-spacing:.015em;color:rgba(203,213,225,.72)}
      .${PANEL_CLASS}__stage{font-size:10.2px;font-weight:760;line-height:1;padding:4px 8px;border-radius:999px;border:1px solid rgba(96,165,250,.24);background:rgba(59,130,246,.07);color:rgba(191,219,254,.90);white-space:nowrap}
      .${PANEL_CLASS}__actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%;min-width:0}
      .${PANEL_CLASS}__action{position:relative;appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:39px;padding:0 16px;border:1px solid rgba(93,180,226,.42);border-radius:9px;background:linear-gradient(180deg,rgba(19,66,97,.92),rgba(8,39,62,.94));box-shadow:0 5px 14px rgba(1,8,16,.20),inset 0 1px 0 rgba(255,255,255,.07);color:rgba(244,250,255,.96);font:760 11.5px/1.15 inherit;letter-spacing:.005em;cursor:pointer;white-space:nowrap;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,filter .16s ease}
      .${PANEL_CLASS}__action::before{display:grid;place-items:center;width:20px;height:20px;flex:0 0 20px;border-radius:6px;background:rgba(125,211,252,.10);border:1px solid rgba(125,211,252,.18);font-size:13px;font-weight:800;line-height:1;color:rgba(186,230,253,.96)}
      .${PANEL_CLASS}__action--download::before{content:'↓'}
      .${PANEL_CLASS}__action--signed::before{content:'✓';background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.18);color:rgba(187,247,208,.96)}
      .${PANEL_CLASS}__action:hover{transform:translateY(-1px);border-color:rgba(125,211,252,.70);box-shadow:0 8px 20px rgba(1,8,16,.28),0 0 0 1px rgba(56,189,248,.07),inset 0 1px 0 rgba(255,255,255,.10);filter:brightness(1.08)}
      .${PANEL_CLASS}__action:active{transform:translateY(0)}
      .${PANEL_CLASS}__action:disabled{opacity:.56;cursor:wait;transform:none;filter:none}
      .${PANEL_CLASS}__action--upload{overflow:hidden;border-color:rgba(248,113,113,.66);background:linear-gradient(105deg,#7d1c2a,#b82e3b,#7d1c2a);background-size:220% 100%;box-shadow:0 6px 18px rgba(127,29,29,.26),0 0 0 1px rgba(239,68,68,.06),inset 0 1px 0 rgba(255,255,255,.10);animation:ronaSignedDsButtonPulse 2.4s ease-in-out infinite,ronaSignedDsButtonFlow 4s linear infinite;color:#fff5f5}
      .${PANEL_CLASS}__action--upload::before{content:'↑';background:rgba(255,255,255,.10);border-color:rgba(254,202,202,.32);color:#fff1f2}
      .${PANEL_CLASS}__action--upload::after{content:'';position:absolute;top:-35%;bottom:-35%;left:-48%;width:34%;transform:skewX(-18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent);animation:ronaSignedDsButtonSweep 3.1s ease-in-out infinite;pointer-events:none}
      .${PANEL_CLASS}__action--upload:hover{border-color:rgba(254,202,202,.96);box-shadow:0 9px 24px rgba(127,29,29,.38),0 0 20px rgba(239,68,68,.18),inset 0 1px 0 rgba(255,255,255,.13)}
      .${PANEL_CLASS}__empty{padding:6px 1px;font-size:10.8px;color:rgba(203,213,225,.48)}
      .${PANEL_CLASS}__error{margin-top:8px;padding:0 1px;font-size:11px;color:#fca5a5}
      .${CARD_CLASS}__resource{display:inline-flex!important;align-items:center!important;gap:5px!important;min-height:20px!important;padding:3px 8px!important;border-radius:999px!important;border:1px solid rgba(74,222,128,.20)!important;background:rgba(34,197,94,.045)!important;color:rgba(187,247,208,.82)!important;font-size:10.3px!important;font-weight:700!important;line-height:1!important;white-space:nowrap!important}
      .${CARD_CLASS}__resource::before{content:'';display:block;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.82}
      @keyframes ronaSignedDsButtonFlow{0%{background-position:100% 0}100%{background-position:-100% 0}}
      @keyframes ronaSignedDsButtonPulse{0%,100%{box-shadow:0 6px 18px rgba(127,29,29,.22),0 0 0 1px rgba(239,68,68,.05)}50%{box-shadow:0 8px 24px rgba(127,29,29,.36),0 0 18px rgba(239,68,68,.20)}}
      @keyframes ronaSignedDsButtonSweep{0%,24%{left:-48%;opacity:0}40%{opacity:1}62%{left:116%;opacity:0}100%{left:116%;opacity:0}}
      @media(max-width:760px){.${PANEL_CLASS}__actions{align-items:stretch}.${PANEL_CLASS}__action{width:100%;justify-content:flex-start;min-height:42px}}
      @media(prefers-reduced-motion:reduce){.${PANEL_CLASS}__action--upload,.${PANEL_CLASS}__action--upload::after{animation:none}}
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
      state.lastError=null;
    }catch(err){state.lastError=err;console.error('RONA client deal documents load failed',err)}
    finally{state.busy=false;render()}
  }

  function findNavExact(label){
    const wanted=text(label).toLowerCase();
    return [...document.querySelectorAll('a,button,[role="tab"],[role="menuitem"]')].find(n=>text(n.textContent).toLowerCase()===wanted&&visible(n))||null;
  }

  function removeLegacySection(){
    const dealNav=findNavExact('Сделки');
    const candidates=[...document.querySelectorAll('a,button,[role="tab"],[role="menuitem"],li')].filter(n=>LEGACY_RE.test(text(n.textContent)));
    for(const n of candidates){
      const active=n.getAttribute('aria-selected')==='true'||n.getAttribute('aria-current')||/(^|\s)(active|selected)(\s|$)/i.test(String(n.className||''));
      if(active&&dealNav)try{dealNav.click()}catch{}
      const item=n.closest('li');
      const target=n.tagName==='LI'?n:(item&&LEGACY_RE.test(text(item.textContent))?item:n);
      if(target&&target!==dealNav)target.remove();
    }
  }

  function dealHosts(dealId,allIds){
    const leaf=[...document.querySelectorAll('span,div,p,strong,b,a,td')].filter(n=>visible(n)&&text(n.textContent)===dealId);
    const found=[];
    for(const start of leaf){
      let n=start;
      for(let depth=0;n&&n!==document.body&&depth<9;depth++,n=n.parentElement){
        if(!visible(n))continue;
        const t=text(n.innerText||n.textContent);
        if(!t.includes(dealId))continue;
        if(allIds.some(id=>id!==dealId&&t.includes(id)))continue;
        const r=n.getBoundingClientRect();
        if(r.width<260||r.height<70)continue;
        if(n.matches('article,section,li,[role="row"],[class*="card" i],[class*="deal" i]')){found.push(n);break}
        if(depth>=2){found.push(n);break}
      }
    }
    const unique=[...new Set(found)];
    unique.sort((a,b)=>{const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return ar.width*ar.height-br.width*br.height});
    return unique.slice(0,1);
  }

  function widenDealHost(host,dealId,allIds){
    let best=host;
    let bestRect=host.getBoundingClientRect();
    let n=host.parentElement;
    for(let depth=0;n&&n!==document.body&&depth<6;depth++,n=n.parentElement){
      if(!visible(n))break;
      const t=text(n.innerText||n.textContent);
      if(!t.includes(dealId)||allIds.some(id=>id!==dealId&&t.includes(id)))break;
      const r=n.getBoundingClientRect();
      if(r.height>480)break;
      if(r.width>bestRect.width*1.08){best=n;bestRect=r}
    }
    return best;
  }

  function smallestExact(host,wanted){
    const nodes=[...host.querySelectorAll('span,small,label,p,strong,b,div')].filter(n=>visible(n)&&text(n.textContent)===wanted);
    nodes.sort((a,b)=>{
      const ac=a.childElementCount,bc=b.childElementCount;
      if(ac!==bc)return ac-bc;
      const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
      return ar.width*ar.height-br.width*br.height;
    });
    return nodes[0]||null;
  }

  function statusNode(host){
    const nodes=[...host.querySelectorAll('span,small,label,p,strong,b,div')].filter(n=>visible(n)&&RESOURCE_STATUS_RE.test(text(n.textContent)));
    nodes.sort((a,b)=>{
      const ac=a.childElementCount,bc=b.childElementCount;
      if(ac!==bc)return ac-bc;
      const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
      return ar.width*ar.height-br.width*br.height;
    });
    return nodes[0]||null;
  }

  function replaceStatusText(node,value){
    const direct=[...node.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&RESOURCE_STATUS_RE.test(text(n.nodeValue)));
    if(direct.length){direct[0].nodeValue=` ${value}`;return}
    node.textContent=value;
  }

  function polishDealHost(host){
    host.classList.add(CARD_CLASS);
    const resourceLabel=smallestExact(host,'Ресурс');
    if(resourceLabel)resourceLabel.remove();
    const status=statusNode(host);
    if(status){replaceStatusText(status,'Ресурс подтвержден');status.classList.add(`${CARD_CLASS}__resource`)}
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

  function openSignedUrl(url,tab){
    if(tab){tab.location.replace(url);return}
    const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.style.display='none';document.body.appendChild(a);a.click();a.remove();
  }

  async function download(info,doc,button){
    if(button.disabled)return;
    button.disabled=true;
    const old=button.textContent;
    button.textContent='Открываю…';
    let tab=null;
    try{
      tab=window.open('about:blank','_blank');
      if(tab)try{tab.opener=null}catch{}
      const url=await signedUrl(doc);
      openSignedUrl(url,tab);
      let marked=false;
      try{marked=await markDownload(info,doc)}catch(err){console.warn('deal document download mark failed',err)}
      if(marked&&text(doc.document_type).toUpperCase()==='ADDENDUM'){
        info.workflow={...info.workflow,client_addendum_downloaded_at:new Date().toISOString()};
        render();
        load();
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

  function documentButton(info,doc,label,signed=false){
    const cls=`${PANEL_CLASS}__action ${PANEL_CLASS}__action--download${signed?` ${PANEL_CLASS}__action--signed`:''}`;
    const b=el('button',cls,label);b.type='button';
    const filename=text(doc.authoritative_filename)||text(doc.document_id)||'PDF';
    b.title=filename;
    b.setAttribute('aria-label',`${label}. ${filename}`);
    b.addEventListener('click',()=>download(info,doc,b));
    return b;
  }

  function uploadErrorMessage(code){
    const map={ADDENDUM_DOWNLOAD_REQUIRED:'Сначала скачайте дополнительное соглашение.',CURRENT_ADDENDUM_REQUIRED:'Актуальное дополнительное соглашение недоступно.',PDF_REQUIRED:'Выберите PDF-файл.',PDF_SIGNATURE_INVALID:'Файл не является корректным PDF.',PDF_SIZE_INVALID:'Размер PDF превышает допустимый лимит.',STORAGE_UPLOAD_FAILED:'Не удалось загрузить файл в защищённое хранилище.',STORAGE_OBJECT_ID_MISSING:'Не удалось зарегистрировать файл в защищённом хранилище.',SIGNED_ADDENDUM_REGISTER_FAILED:'Не удалось зарегистрировать подписанное ДС.'};
    return map[code]||'Не удалось загрузить подписанное ДС.';
  }

  function appendUploadAction(info,panel,actions){
    const input=el('input');input.type='file';input.accept='application/pdf,.pdf';input.hidden=true;
    const b=el('button',`${PANEL_CLASS}__action ${PANEL_CLASS}__action--upload`,'Загрузить подписанное ДС');b.type='button';
    b.addEventListener('click',()=>input.click());
    input.addEventListener('change',async()=>{
      const file=input.files?.[0];if(!file)return;
      b.disabled=true;b.textContent='Загружаю…';
      panel.querySelector(`.${PANEL_CLASS}__error`)?.remove();
      try{
        const fd=new FormData();fd.append('file',file,file.name);
        await getJson(`${API}/v1/client/deals/${encodeURIComponent(info.dealId)}/signed-addendum`,{method:'POST',body:fd});
        info.workflow={...info.workflow,client_stage:'PAYMENTS',payment_handoff_state:'READY'};
        b.textContent='Подписанное ДС загружено';
        await load();
      }catch(err){
        const e=el('div',`${PANEL_CLASS}__error`,uploadErrorMessage(err?.payload?.code||err?.message));
        panel.append(e);
        b.disabled=false;b.textContent='Загрузить подписанное ДС';input.value='';
      }
    });
    actions.append(b,input);
  }

  function buildPanel(info){
    const panel=el('div',PANEL_CLASS);panel.dataset.dealId=info.dealId;
    const head=el('div',`${PANEL_CLASS}__head`);
    head.append(el('div',`${PANEL_CLASS}__title`,'Документы сделки'));
    const paymentStage=text(info.workflow?.client_stage)==='PAYMENTS'||['READY','SENT'].includes(text(info.workflow?.payment_handoff_state));
    if(paymentStage)head.append(el('div',`${PANEL_CLASS}__stage`,'Платежи'));
    panel.append(head);

    const actions=el('div',`${PANEL_CLASS}__actions`);
    const ds=typeDocs(info,'ADDENDUM');
    const invoices=typeDocs(info,'INVOICE');
    const signed=typeDocs(info,'SIGNED_ADDENDUM');

    ds.forEach((d,i)=>actions.append(documentButton(info,d,ds.length>1?`Дополнительное соглашение ${i+1}`:'Дополнительное соглашение')));
    invoices.forEach((d,i)=>actions.append(documentButton(info,d,invoices.length>1?`Инвойс ${i+1}`:'Инвойс')));
    signed.forEach((d,i)=>actions.append(documentButton(info,d,signed.length>1?`Подписанное ДС ${i+1}`:'Подписанное ДС',true)));
    if(info.workflow?.client_addendum_downloaded_at&&!signed.length)appendUploadAction(info,panel,actions);

    if(actions.querySelector('button'))panel.append(actions);
    else panel.append(el('div',`${PANEL_CLASS}__empty`,'Документы по сделке пока не опубликованы.'));
    return panel;
  }

  function observe(){if(observerActive)observer.observe(document.body,{childList:true,subtree:true})}

  function render(){
    if(observerActive)observer.disconnect();
    ensureStyle();
    removeLegacySection();
    document.querySelectorAll(`.${PANEL_CLASS}`).forEach(p=>p.remove());
    const allIds=[...state.deals.keys()];
    for(const [dealId,info] of state.deals){
      const hosts=dealHosts(dealId,allIds);
      for(const host of hosts){
        polishDealHost(host);
        const target=widenDealHost(host,dealId,allIds);
        target.append(buildPanel(info));
      }
    }
    observe();
  }

  let renderQueued=false;
  const observer=new MutationObserver(()=>{
    if(renderQueued)return;renderQueued=true;
    queueMicrotask(()=>{renderQueued=false;render()});
  });
  const start=()=>{
    ensureStyle();
    removeLegacySection();
    observerActive=true;
    observe();
    load();
    setInterval(load,15000);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();