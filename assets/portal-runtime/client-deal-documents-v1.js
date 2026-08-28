(()=>{
  'use strict';
  const MARK='20260829-deal-documents-v1';
  if(window.__RONA_CLIENT_DEAL_DOCUMENTS_V1__===MARK)return;
  window.__RONA_CLIENT_DEAL_DOCUMENTS_V1__=MARK;

  const API='/portal/api';
  const PANEL_CLASS='rona-deal-documents-v1';
  const LEGACY_RE=/^(?:ДС\s*(?:И|\/|&)\s*ИНВОЙС(?:Ы)?|DS\s*(?:AND|\/|&)\s*INVOICES?)$/i;
  const DEAL_RE=/^DEAL-\d{4}-\d{3,}$/;
  const state={deals:new Map(),busy:false,lastError:null};

  function text(v){return String(v??'').replace(/\s+/g,' ').trim()}
  function visible(el){if(!el||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0}
  function el(tag,cls,txt){const node=document.createElement(tag);if(cls)node.className=cls;if(txt!=null)node.textContent=txt;return node}

  function ensureStyle(){
    if(document.getElementById('rona-client-deal-documents-v1-style'))return;
    const s=document.createElement('style');
    s.id='rona-client-deal-documents-v1-style';
    s.textContent=`
      .${PANEL_CLASS}{margin-top:18px;padding-top:16px;border-top:1px solid rgba(148,163,184,.25);font-family:inherit;color:inherit}
      .${PANEL_CLASS}__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
      .${PANEL_CLASS}__title{font-size:14px;font-weight:700;letter-spacing:.01em}
      .${PANEL_CLASS}__stage{font-size:12px;font-weight:700;padding:5px 9px;border-radius:999px;border:1px solid rgba(148,163,184,.28);white-space:nowrap}
      .${PANEL_CLASS}__list{display:grid;gap:8px}
      .${PANEL_CLASS}__row{display:grid;grid-template-columns:minmax(130px,.8fr) minmax(180px,1.7fr) auto;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(148,163,184,.22);border-radius:10px;background:rgba(15,23,42,.18)}
      .${PANEL_CLASS}__kind{font-size:12px;font-weight:700}
      .${PANEL_CLASS}__file{font-size:12px;opacity:.82;overflow-wrap:anywhere}
      .${PANEL_CLASS}__btn{appearance:none;border:1px solid rgba(148,163,184,.38);border-radius:8px;background:transparent;color:inherit;padding:7px 10px;font:600 12px/1.2 inherit;cursor:pointer;white-space:nowrap}
      .${PANEL_CLASS}__btn:hover{border-color:currentColor}
      .${PANEL_CLASS}__btn:disabled{opacity:.55;cursor:wait}
      .${PANEL_CLASS}__upload{margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .${PANEL_CLASS}__hint{font-size:12px;opacity:.72}
      .${PANEL_CLASS}__error{margin-top:8px;font-size:12px;color:#ef4444}
      @media(max-width:760px){.${PANEL_CLASS}__row{grid-template-columns:1fr}.${PANEL_CLASS}__row .${PANEL_CLASS}__btn{justify-self:start}}
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
      const active=n.getAttribute('aria-selected')==='true'||n.getAttribute('aria-current')||/(^|\s)(active|selected)(\s|$)/i.test(n.className||'');
      if(active&&dealNav)try{dealNav.click()}catch{}
      const target=n.tagName==='LI'?n:(n.closest('li')&&LEGACY_RE.test(text(n.closest('li').textContent))?n.closest('li'):n);
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
    return [...new Set(found)];
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
    if(!['ADDENDUM','INVOICE'].includes(kind))return;
    await getJson(`${API}/v1/client/deals/${encodeURIComponent(info.dealId)}/documents/${encodeURIComponent(text(doc.document_id))}/downloaded`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
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
      if(tab)tab.location.replace(url);else window.location.assign(url);
      await markDownload(info,doc).catch(err=>console.warn('deal document download mark failed',err));
      if(text(doc.document_type).toUpperCase()==='ADDENDUM'){
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
    r.append(el('div',`${PANEL_CLASS}__file`,text(doc.authoritative_filename)||text(doc.document_id)||'PDF'));
    const b=el('button',`${PANEL_CLASS}__btn`,buttonLabel);b.type='button';b.addEventListener('click',()=>download(info,doc,b));r.append(b);
    return r;
  }

  function uploadErrorMessage(code){
    const map={ADDENDUM_DOWNLOAD_REQUIRED:'Сначала скачайте дополнительное соглашение.',CURRENT_ADDENDUM_REQUIRED:'Актуальное дополнительное соглашение недоступно.',PDF_REQUIRED:'Выберите PDF-файл.',PDF_SIGNATURE_INVALID:'Файл не является корректным PDF.',PDF_SIZE_INVALID:'Размер PDF превышает допустимый лимит.',STORAGE_UPLOAD_FAILED:'Не удалось загрузить файл в защищённое хранилище.',SIGNED_ADDENDUM_REGISTER_FAILED:'Не удалось зарегистрировать подписанный DS.'};
    return map[code]||'Не удалось загрузить подписанный DS.';
  }

  function uploadControl(info,panel){
    const wrap=el('div',`${PANEL_CLASS}__upload`);
    const input=el('input');input.type='file';input.accept='application/pdf,.pdf';input.hidden=true;
    const b=el('button',`${PANEL_CLASS}__btn`,'Загрузить подписанный DS');b.type='button';
    const hint=el('span',`${PANEL_CLASS}__hint`,'PDF до 20 МБ');
    b.addEventListener('click',()=>input.click());
    input.addEventListener('change',async()=>{
      const file=input.files?.[0];if(!file)return;
      b.disabled=true;b.textContent='Загружаю…';
      panel.querySelector(`.${PANEL_CLASS}__error`)?.remove();
      try{
        const fd=new FormData();fd.append('file',file,file.name);
        await getJson(`${API}/v1/client/deals/${encodeURIComponent(info.dealId)}/signed-addendum`,{method:'POST',body:fd});
        info.workflow={...info.workflow,client_stage:'PAYMENTS',payment_handoff_state:'READY'};
        b.textContent='Подписанный DS загружен';
        await load();
      }catch(err){
        const e=el('div',`${PANEL_CLASS}__error`,uploadErrorMessage(err?.payload?.code||err?.message));
        wrap.insertAdjacentElement('afterend',e);
        b.disabled=false;b.textContent='Загрузить подписанный DS';input.value='';
      }
    });
    wrap.append(b,input,hint);
    return wrap;
  }

  function buildPanel(info){
    const panel=el('div',PANEL_CLASS);panel.dataset.dealId=info.dealId;
    const head=el('div',`${PANEL_CLASS}__head`);
    head.append(el('div',`${PANEL_CLASS}__title`,'Документы сделки'));
    const stage=text(info.workflow?.client_stage)==='PAYMENTS'||['READY','SENT'].includes(text(info.workflow?.payment_handoff_state))?'Платежи':'Документы сделки';
    head.append(el('div',`${PANEL_CLASS}__stage`,stage));panel.append(head);
    const list=el('div',`${PANEL_CLASS}__list`);
    const ds=typeDocs(info,'ADDENDUM');
    const invoices=typeDocs(info,'INVOICE');
    const signed=typeDocs(info,'SIGNED_ADDENDUM');
    for(const d of ds)list.append(row(info,d,'Дополнительное соглашение (DS)','Скачать DS'));
    for(const d of invoices)list.append(row(info,d,'Invoice','Скачать Invoice'));
    for(const d of signed)list.append(row(info,d,'Подписанный DS','Скачать подписанный DS'));
    if(!list.children.length)list.append(el('div',`${PANEL_CLASS}__hint`,'Документы по сделке пока не опубликованы.'));
    panel.append(list);
    if(info.workflow?.client_addendum_downloaded_at&&!signed.length)panel.append(uploadControl(info,panel));
    return panel;
  }

  function render(){
    ensureStyle();
    removeLegacySection();
    document.querySelectorAll(`.${PANEL_CLASS}`).forEach(p=>p.remove());
    const allIds=[...state.deals.keys()];
    for(const [dealId,info] of state.deals){
      const hosts=dealHosts(dealId,allIds);
      for(const host of hosts){
        if(host.querySelector(`:scope > .${PANEL_CLASS}`))continue;
        host.append(buildPanel(info));
      }
    }
  }

  let renderQueued=false;
  const observer=new MutationObserver(()=>{
    if(renderQueued)return;renderQueued=true;
    queueMicrotask(()=>{renderQueued=false;render()});
  });
  const start=()=>{
    ensureStyle();
    removeLegacySection();
    observer.observe(document.body,{childList:true,subtree:true});
    load();
    setInterval(load,15000);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
