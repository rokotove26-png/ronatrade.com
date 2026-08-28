(()=>{
  'use strict';
  const MARK='20260829-deal-documents-v1-5-wide-actions';
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
      .${PANEL_CLASS}{width:100%;min-width:0;box-sizing:border-box;margin-top:15px;padding-top:13px;border-top:1px solid rgba(113,154,184,.17);font-family:inherit;color:inherit}
      .${PANEL_CLASS}__head{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:24px;margin:0 2px 10px}
      .${PANEL_CLASS}__title{font-size:12.8px;font-weight:760;line-height:1.2;letter-spacing:.01em;color:rgba(226,232,240,.92)}
      .${PANEL_CLASS}__stage{font-size:10.5px;font-weight:750;line-height:1;padding:4px 8px;border-radius:999px;border:1px solid rgba(96,165,250,.24);background:rgba(59,130,246,.07);color:rgba(191,219,254,.90);white-space:nowrap}
      .${PANEL_CLASS}__list{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));align-items:stretch;gap:12px;width:100%;min-width:0}
      .${PANEL_CLASS}__row,.${PANEL_CLASS}__upload{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;min-height:52px;padding:8px 9px 8px 14px;border:1px solid rgba(113,154,184,.19);border-radius:11px;background:linear-gradient(180deg,rgba(8,27,45,.62),rgba(4,16,29,.47));box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 6px 18px rgba(1,8,16,.10)}
      .${PANEL_CLASS}__row{position:relative;overflow:hidden}
      .${PANEL_CLASS}__row::before{content:'';position:absolute;left:0;top:9px;bottom:9px;width:2px;border-radius:2px;background:rgba(56,189,248,.30)}
      .${PANEL_CLASS}__upload{position:relative;overflow:hidden;border-color:rgba(248,113,113,.46);background:linear-gradient(110deg,rgba(72,13,22,.52),rgba(127,29,29,.25),rgba(72,13,22,.52));background-size:240% 100%;box-shadow:0 0 0 1px rgba(239,68,68,.07),0 0 22px rgba(239,68,68,.11),inset 0 1px 0 rgba(255,255,255,.025);animation:ronaSignedDsGlow 2.6s ease-in-out infinite,ronaSignedDsShimmer 4.2s linear infinite}
      .${PANEL_CLASS}__upload::after{content:'';position:absolute;inset:-30% auto -30% -45%;width:36%;transform:skewX(-18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.11),transparent);animation:ronaSignedDsSweep 3.2s ease-in-out infinite;pointer-events:none}
      .${PANEL_CLASS}__kind{flex:1 1 auto;min-width:0;font-size:12px;font-weight:760;line-height:1.2;color:rgba(226,232,240,.90);white-space:normal}
      .${PANEL_CLASS}__file{display:none}
      .${PANEL_CLASS}__btn{position:relative;z-index:1;appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;flex:0 0 auto;min-height:36px;border:1px solid rgba(125,211,252,.54);border-radius:8px;background:linear-gradient(180deg,#1c638f,#0d456b);box-shadow:0 6px 16px rgba(2,12,22,.28),inset 0 1px 0 rgba(255,255,255,.11);color:#f7fbff;padding:8px 14px;font:760 11.6px/1.15 inherit;cursor:pointer;white-space:nowrap;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease,filter .15s ease}
      .${PANEL_CLASS}__btn--download::before{content:'↓';font-size:13px;font-weight:800;line-height:1;opacity:.88}
      .${PANEL_CLASS}__btn--upload::before{content:'↑';font-size:13px;font-weight:800;line-height:1;opacity:.92}
      .${PANEL_CLASS}__btn:hover{transform:translateY(-1px);border-color:rgba(186,230,253,.86);box-shadow:0 8px 20px rgba(2,12,22,.34),0 0 0 1px rgba(56,189,248,.11),inset 0 1px 0 rgba(255,255,255,.14);filter:brightness(1.09)}
      .${PANEL_CLASS}__btn:active{transform:translateY(0)}
      .${PANEL_CLASS}__btn:disabled{opacity:.55;cursor:wait;transform:none;filter:none}
      .${PANEL_CLASS}__upload .${PANEL_CLASS}__kind{color:#fee2e2;font-weight:780}
      .${PANEL_CLASS}__upload .${PANEL_CLASS}__hint{display:none}
      .${PANEL_CLASS}__upload .${PANEL_CLASS}__btn{border-color:rgba(254,202,202,.76);background:linear-gradient(180deg,#c73745,#8d2031);box-shadow:0 7px 20px rgba(127,29,29,.34),inset 0 1px 0 rgba(255,255,255,.14)}
      .${PANEL_CLASS}__upload .${PANEL_CLASS}__btn:hover{border-color:rgba(254,226,226,.98);box-shadow:0 9px 24px rgba(127,29,29,.46),0 0 20px rgba(239,68,68,.22),inset 0 1px 0 rgba(255,255,255,.16)}
      .${PANEL_CLASS}__hint{font-size:10.7px;line-height:1.25;color:rgba(203,213,225,.50)}
      .${PANEL_CLASS}__list>.${PANEL_CLASS}__hint{display:block;padding:11px 10px}
      .${PANEL_CLASS}__error{margin-top:6px;padding:0 2px;font-size:11px;color:#fca5a5}
      .${CARD_CLASS}__resource{display:inline-flex!important;align-items:center!important;gap:5px!important;min-height:20px!important;padding:3px 8px!important;border-radius:999px!important;border:1px solid rgba(74,222,128,.20)!important;background:rgba(34,197,94,.045)!important;color:rgba(187,247,208,.82)!important;font-size:10.3px!important;font-weight:700!important;line-height:1!important;white-space:nowrap!important}
      .${CARD_CLASS}__resource::before{content:'';display:block;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.82}
      @keyframes ronaSignedDsShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
      @keyframes ronaSignedDsGlow{0%,100%{box-shadow:0 0 0 1px rgba(239,68,68,.05),0 0 14px rgba(239,68,68,.09)}50%{box-shadow:0 0 0 1px rgba(248,113,113,.18),0 0 28px rgba(239,68,68,.23)}}
      @keyframes ronaSignedDsSweep{0%,22%{left:-45%;opacity:0}38%{opacity:1}62%{left:118%;opacity:0}100%{left:118%;opacity:0}}
      @media(max-width:1050px){.${PANEL_CLASS}__list{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.${PANEL_CLASS}__btn{padding-left:11px;padding-right:11px}}
      @media(max-width:760px){.${PANEL_CLASS}__list{grid-template-columns:1fr}.${PANEL_CLASS}__row,.${PANEL_CLASS}__upload{width:100%;box-sizing:border-box}}
      @media(prefers-reduced-motion:reduce){.${PANEL_CLASS}__upload,.${PANEL_CLASS}__upload::after{animation:none}}
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
      button.textContent='Не удалось скачать';
      setTimeout(()=>{if(button.isConnected){button.disabled=false;button.textContent=old}},1800);
      return;
    }
    if(button.isConnected){button.disabled=false;button.textContent=old}
  }

  function row(info,doc,label,buttonLabel){
    const r=el('div',`${PANEL_CLASS}__row`);
    r.append(el('div',`${PANEL_CLASS}__kind`,label));
    const file=el('div',`${PANEL_CLASS}__file`,text(doc.authoritative_filename)||text(doc.document_id)||'PDF');
    file.title=file.textContent;
    r.append(file);
    const b=el('button',`${PANEL_CLASS}__btn ${PANEL_CLASS}__btn--download`,buttonLabel);b.type='button';b.title=file.textContent;b.addEventListener('click',()=>download(info,doc,b));r.append(b);
    return r;
  }

  function uploadErrorMessage(code){
    const map={ADDENDUM_DOWNLOAD_REQUIRED:'Сначала скачайте дополнительное соглашение.',CURRENT_ADDENDUM_REQUIRED:'Актуальное дополнительное соглашение недоступно.',PDF_REQUIRED:'Выберите PDF-файл.',PDF_SIGNATURE_INVALID:'Файл не является корректным PDF.',PDF_SIZE_INVALID:'Размер PDF превышает допустимый лимит.',STORAGE_UPLOAD_FAILED:'Не удалось загрузить файл в защищённое хранилище.',STORAGE_OBJECT_ID_MISSING:'Не удалось зарегистрировать файл в защищённом хранилище.',SIGNED_ADDENDUM_REGISTER_FAILED:'Не удалось зарегистрировать подписанное ДС.'};
    return map[code]||'Не удалось загрузить подписанное ДС.';
  }

  function uploadControl(info,panel){
    const wrap=el('div',`${PANEL_CLASS}__upload`);
    const input=el('input');input.type='file';input.accept='application/pdf,.pdf';input.hidden=true;
    const kind=el('div',`${PANEL_CLASS}__kind`,'Требуется подписанное ДС');
    const hint=el('span',`${PANEL_CLASS}__hint`,'PDF · до 20 МБ');
    const b=el('button',`${PANEL_CLASS}__btn ${PANEL_CLASS}__btn--upload`,'Загрузить подписанное ДС');b.type='button';
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
        wrap.insertAdjacentElement('afterend',e);
        b.disabled=false;b.textContent='Загрузить подписанное ДС';input.value='';
      }
    });
    wrap.append(kind,hint,b,input);
    return wrap;
  }

  function buildPanel(info){
    const panel=el('div',PANEL_CLASS);panel.dataset.dealId=info.dealId;
    const head=el('div',`${PANEL_CLASS}__head`);
    head.append(el('div',`${PANEL_CLASS}__title`,'Документы сделки'));
    const paymentStage=text(info.workflow?.client_stage)==='PAYMENTS'||['READY','SENT'].includes(text(info.workflow?.payment_handoff_state));
    if(paymentStage)head.append(el('div',`${PANEL_CLASS}__stage`,'Платежи'));
    panel.append(head);
    const list=el('div',`${PANEL_CLASS}__list`);
    const ds=typeDocs(info,'ADDENDUM');
    const invoices=typeDocs(info,'INVOICE');
    const signed=typeDocs(info,'SIGNED_ADDENDUM');
    for(const d of ds)list.append(row(info,d,'Дополнительное соглашение','Скачать ДС'));
    for(const d of invoices)list.append(row(info,d,'Инвойс','Скачать инвойс'));
    for(const d of signed)list.append(row(info,d,'Подписанное ДС','Скачать ДС'));
    if(info.workflow?.client_addendum_downloaded_at&&!signed.length)list.append(uploadControl(info,panel));
    if(!list.children.length)list.append(el('div',`${PANEL_CLASS}__hint`,'Документы по сделке пока не опубликованы.'));
    panel.append(list);
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
        const wideHost=widenDealHost(host,dealId,allIds);
        polishDealHost(wideHost);
        wideHost.append(buildPanel(info));
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