(()=>{
  'use strict';
  if(location.pathname!=='/portal/client')return;
  const MARK='20260905-client-home-current-only-v1-fail-closed-generation-v7';
  if(window.__RONA_CLIENT_HOME_CURRENT_ONLY__===MARK)return;
  window.__RONA_CLIENT_HOME_CURRENT_ONLY__=MARK;

  const OWNER='[data-rona-client-home-owner="command-center-v2"]';
  const ROOT_SELECTORS=['#page-home','#homePage','[data-page-panel="home"]','[data-page-id="home"]'];
  const LEGACY_LABELS=['АКТИВНЫЕ СДЕЛКИ','ОПЛАТА','ТЕКУЩИЙ СТАТУС','СЛЕДУЮЩИЙ ШАГ','Компания','Оплата','Цены','Заявки'];
  const PREPAINT_MAX_MS=5000;
  const FIRST_PAINT_GUARD_ID='rona-client-home-first-paint-guard';
  const LOADING_MESSAGE='Загрузка центра управления…';
  const DEGRADED_MESSAGE='Данные временно недоступны. Центр управления повторит загрузку автоматически.';
  const SELECTION_MESSAGE='Выберите компанию и договор в верхней панели. После выбора центр управления загрузится автоматически.';
  let observer=null,homeStateObserver=null,rescueTimer=0,contextGeneration=1,expectedContextKey='',confirmedProjectionKey='',sanitizing=false;

  const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
  const navText=v=>norm(v).toLowerCase().replace(/ё/g,'е');
  const contextKey=c=>{const client=norm(c?.client_id),contract=norm(c?.contract_id);return client&&contract?`${client}|${contract}`:''};

  function contextAuthority(){return window.RONA_CLIENT_CONTEXT||null}
  function selectedContextKey(){return contextKey(contextAuthority()?.getCurrentContext?.())}
  function projectionKey(data=contextAuthority()?.getCurrentProjection?.()){
    if(!data||typeof data!=='object')return'';
    const contract=data.contract||{},context=data.context||{},client=data.client||{};
    const clientIds=[...new Set([data.client_id,context.client_id,client.client_id,contract.client_id].map(norm).filter(Boolean))];
    const contractIds=[...new Set([data.contract_id,context.contract_id,contract.contract_id].map(norm).filter(Boolean))];
    return clientIds.length===1&&contractIds.length===1?`${clientIds[0]}|${contractIds[0]}`:'';
  }
  function homeSnapshotKey(){return contextKey(window.__RONA_CLIENT_HOME_STATE__||null)}
  function currentProjectionConfirmed(){const selected=selectedContextKey();return Boolean(selected&&projectionKey()===selected)}
  function readyBelongsToCurrentGeneration(){
    const selected=selectedContextKey();
    return Boolean(selected&&selected===expectedContextKey&&projectionKey()===selected&&homeSnapshotKey()===selected&&confirmedProjectionKey===selected);
  }

  function publishState(reason){
    window.__RONA_CLIENT_HOME_CURRENT_ONLY_STATE__={
      version:MARK,owner:'command-center-v2',legacy_dom:'PHYSICALLY_REMOVED',prepaint_max_ms:PREPAINT_MAX_MS,
      degraded_error_owner:true,first_paint_guard:'REUSABLE_FAIL_CLOSED_NEUTRAL',stale_business_visibility:false,
      current_projection_required:true,context_generation_guard:true,context_generation:contextGeneration,
      projection_confirmed:currentProjectionConfirmed(),reason:norm(reason)||'sync'
    };
  }

  function homeRoot(){
    for(const selector of ROOT_SELECTORS){
      const el=document.querySelector(selector);
      if(el)return el;
    }
    return null;
  }

  function decorated(el){
    if(!el)return false;
    const s=getComputedStyle(el),bg=s.backgroundColor||'';
    const alpha=/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/i.exec(bg);
    const hasBg=bg&&bg!=='transparent'&&bg!=='rgba(0, 0, 0, 0)'&&(!alpha||Number(alpha[1])>0);
    return hasBg||parseFloat(s.borderTopWidth||'0')>0||parseFloat(s.borderLeftWidth||'0')>0||s.boxShadow!=='none'||parseFloat(s.borderRadius||'0')>0;
  }

  function frameFromText(root,needle){
    if(!root)return null;
    const rr=root.getBoundingClientRect();
    for(const leaf of root.querySelectorAll('*')){
      if(leaf.closest(OWNER)||leaf.childElementCount!==0||!norm(leaf.textContent).includes(needle))continue;
      let node=leaf;
      while(node&&node!==root){
        const r=node.getBoundingClientRect();
        if(r.width>=Math.min(460,rr.width*.48)&&r.width<=rr.width+2&&decorated(node))return node;
        node=node.parentElement;
      }
    }
    return null;
  }

  function directChild(root,node){
    let cur=node;
    if(!cur)return null;
    while(cur.parentElement&&cur.parentElement!==root)cur=cur.parentElement;
    return cur.parentElement===root?cur:null;
  }

  function removeLegacyCardByLeaf(root,text){
    for(const leaf of [...root.querySelectorAll('*')]){
      if(!leaf.isConnected||leaf.closest(OWNER)||leaf.childElementCount!==0||norm(leaf.textContent)!==text)continue;
      let chosen=leaf,node=leaf;
      for(let depth=0;node.parentElement&&node.parentElement!==root&&depth<8;depth++){
        const parent=node.parentElement,t=norm(parent.textContent),r=parent.getBoundingClientRect();
        if(t.includes('Главная')||t.includes('Выбрана компания')||r.width>root.getBoundingClientRect().width*.92)break;
        if(decorated(parent)&&t.length<2600)chosen=parent;
        node=parent;
      }
      if(chosen.isConnected&&!chosen.closest(OWNER))chosen.remove();
    }
  }

  function purgeLegacy(){
    const root=homeRoot();
    if(!root)return false;
    const owner=root.querySelector(OWNER);
    if(!owner)return false;

    const titleDirect=directChild(root,frameFromText(root,'Главная'));
    const contextDirect=directChild(root,frameFromText(root,'Выбрана компания'));
    let removed=0;

    if(titleDirect&&contextDirect&&titleDirect!==contextDirect){
      for(const child of [...root.children]){
        if(child===titleDirect||child===contextDirect||child===owner)continue;
        child.remove();
        removed++;
      }
    }else{
      for(const label of LEGACY_LABELS){
        const before=root.querySelectorAll('*').length;
        removeLegacyCardByLeaf(root,label);
        if(root.querySelectorAll('*').length<before)removed++;
      }
    }

    for(const stale of [...root.querySelectorAll('[data-rona-client-home-owner]')]){
      if(stale!==owner){stale.remove();removed++}
    }
    for(const hidden of [...root.querySelectorAll('[data-rona-home-legacy-hidden]')]){
      if(hidden!==owner){hidden.remove();removed++}
    }

    root.setAttribute('data-rona-client-home-current-only','command-center-v2');
    document.documentElement.setAttribute('data-rona-client-home-dom','CURRENT_ONLY_PHYSICAL_V1');
    document.documentElement.setAttribute('data-rona-client-home-legacy-nodes',String(root.querySelectorAll('[data-rona-home-legacy-hidden]').length));
    publishState(removed?'legacy-removed':'legacy-clean');
    return true;
  }

  function ensureOwner(){
    const root=homeRoot();
    if(!root)return null;
    let owner=root.querySelector(OWNER);
    if(owner)return owner;
    owner=document.createElement('section');
    owner.setAttribute('data-rona-client-home-owner','command-center-v2');
    const contextDirect=directChild(root,frameFromText(root,'Выбрана компания'));
    if(contextDirect?.parentElement===root)contextDirect.insertAdjacentElement('afterend',owner);
    else root.appendChild(owner);
    return owner;
  }

  function neutralizeOwner(mode='loading',reason='neutral'){
    const owner=ensureOwner();
    if(!owner)return false;
    const message=mode==='error'?DEGRADED_MESSAGE:(mode==='selection'?SELECTION_MESSAGE:LOADING_MESSAGE);
    const degraded=mode==='error'?'error-fallback':(mode==='selection'?'selection-required':'loading-neutral');
    const already=owner.getAttribute('data-rona-client-home-neutral')===mode&&norm(owner.textContent)===norm(message);
    if(!already){
      sanitizing=true;
      const node=document.createElement('div');
      node.className='rona-cc-context-required';
      node.setAttribute('data-rona-client-home-neutral-message','true');
      node.textContent=message;
      owner.replaceChildren(node);
      sanitizing=false;
    }
    owner.setAttribute('data-rona-client-home-neutral',mode);
    owner.setAttribute('data-rona-client-home-degraded',degraded);
    document.documentElement.setAttribute('data-rona-client-home-degraded',degraded);
    purgeLegacy();
    publishState(reason);
    return true;
  }

  function clearNeutralState(){
    document.documentElement.removeAttribute('data-rona-client-home-degraded');
    const owner=homeRoot()?.querySelector(OWNER);
    owner?.removeAttribute('data-rona-client-home-degraded');
    owner?.removeAttribute('data-rona-client-home-neutral');
  }

  function setFirstPaintGuardEnabled(enabled,reason){
    const guard=document.getElementById(FIRST_PAINT_GUARD_ID);
    const state=enabled?'armed':'hard-released';
    document.documentElement.setAttribute('data-rona-client-home-guard-recovery',String(reason||state));
    if(!guard)return false;
    guard.setAttribute('data-rona-client-home-guard-recovery',String(reason||state));
    guard.media=enabled?'all':'not all';
    return true;
  }

  function releasePrepaint(reason){
    if(rescueTimer){clearTimeout(rescueTimer);rescueTimer=0}
    document.documentElement.setAttribute('data-rona-client-home-prepaint','released');
    document.documentElement.setAttribute('data-rona-client-home-prepaint-release',String(reason||'released'));
    setFirstPaintGuardEnabled(false,reason||'released');
    publishState(reason||'released');
  }

  function armPrepaint(){
    if(rescueTimer){clearTimeout(rescueTimer);rescueTimer=0}
    const generation=contextGeneration;
    document.documentElement.setAttribute('data-rona-client-home-prepaint','blocked-until-command-center-v2');
    document.documentElement.removeAttribute('data-rona-client-home-prepaint-release');
    setFirstPaintGuardEnabled(true,'armed');
    rescueTimer=window.setTimeout(()=>{
      if(generation!==contextGeneration)return;
      const ready=document.documentElement.getAttribute('data-rona-client-home-ready')==='true';
      if(ready&&readyBelongsToCurrentGeneration()){
        clearNeutralState();
        releasePrepaint('command-center-ready');
        return;
      }
      neutralizeOwner('error','bounded-timeout');
      document.documentElement.removeAttribute('data-rona-client-home-ready');
      releasePrepaint('bounded-timeout');
    },PREPAINT_MAX_MS);
  }

  function markLoading(reason){
    document.documentElement.removeAttribute('data-rona-client-home-ready');
    if(document.documentElement.getAttribute('data-rona-client-home-state')!=='loading')document.documentElement.setAttribute('data-rona-client-home-state','loading');
    neutralizeOwner('loading',reason||'loading');
    if(document.documentElement.getAttribute('data-rona-client-home-prepaint')!=='blocked-until-command-center-v2')armPrepaint();
  }

  function syncExpectedContext(reason='context-sync'){
    const next=selectedContextKey();
    if(next===expectedContextKey)return false;
    contextGeneration+=1;
    expectedContextKey=next;
    confirmedProjectionKey='';
    window.__RONA_CLIENT_HOME_STATE__=null;
    markLoading(reason);
    publishState(reason);
    return true;
  }

  function syncPrepaint(){
    if(sanitizing)return;
    syncExpectedContext('context-detected');
    const html=document.documentElement;
    const ready=html.getAttribute('data-rona-client-home-ready')==='true';
    const state=String(html.getAttribute('data-rona-client-home-state')||'');
    const selected=selectedContextKey();
    const projection=projectionKey();
    if(selected&&projection===selected)confirmedProjectionKey=selected;

    if(ready||state==='ready'){
      if(!selected){
        neutralizeOwner('selection','selection-required');
        releasePrepaint('selection-required');
        return;
      }
      if(readyBelongsToCurrentGeneration()){
        clearNeutralState();
        purgeLegacy();
        releasePrepaint('command-center-ready');
        return;
      }
      markLoading('rejected-stale-ready');
      return;
    }
    if(state==='error'){
      neutralizeOwner('error','command-center-error');
      releasePrepaint('command-center-error');
      return;
    }
    neutralizeOwner('loading',state||'pending');
  }

  function resetBeforeHomePaint(){
    markLoading('navigation-prepaint');
    armPrepaint();
  }

  function isHomeNavigationTarget(target){
    const nav=target?.closest?.('nav a,nav button,aside a,aside button,[role="navigation"] a,[role="navigation"] button,a[href],button');
    if(!nav)return false;
    const label=navText(nav.textContent);
    if(label==='главная'||label==='home')return true;
    const href=navText(nav.getAttribute?.('href'));
    const page=navText(nav.getAttribute?.('data-page')||nav.getAttribute?.('data-section')||nav.getAttribute?.('data-target'));
    return /(?:^|[#/])home$/.test(href)||page==='home'||page==='главная';
  }

  function prepaint(event){
    if(!isHomeNavigationTarget(event.target))return;
    resetBeforeHomePaint();
    purgeLegacy();
  }

  function onContextEvent(){
    syncExpectedContext('context-change');
    markLoading('context-change');
  }

  function onProjection(event){
    const detail=event?.detail||{};
    const eventKey=contextKey({client_id:detail.client_id,contract_id:detail.contract_id});
    const selected=selectedContextKey();
    if(!selected||eventKey!==selected||projectionKey()!==selected)return;
    confirmedProjectionKey=selected;
    publishState('current-projection');
    syncPrepaint();
  }

  function onPageShow(){
    purgeLegacy();
    syncExpectedContext('pageshow-context');
    syncPrepaint();
    const html=document.documentElement;
    if(html.getAttribute('data-rona-client-home-prepaint')!=='released'&&html.getAttribute('data-rona-client-home-prepaint')!=='blocked-until-command-center-v2')armPrepaint();
  }

  function enforcePresentationInvariant(){
    if(sanitizing)return;
    purgeLegacy();
    const state=String(document.documentElement.getAttribute('data-rona-client-home-state')||'');
    const ready=document.documentElement.getAttribute('data-rona-client-home-ready')==='true';
    if((ready||state==='ready')&&readyBelongsToCurrentGeneration())return;
    if(state==='error')neutralizeOwner('error','dom-error-invariant');
    else neutralizeOwner('loading','dom-loading-invariant');
  }

  function start(){
    expectedContextKey=selectedContextKey();
    confirmedProjectionKey=projectionKey()===expectedContextKey?expectedContextKey:'';
    resetBeforeHomePaint();
    purgeLegacy();
    document.addEventListener('pointerdown',prepaint,true);
    document.addEventListener('mousedown',prepaint,true);
    document.addEventListener('click',prepaint,true);
    window.addEventListener('rona:client-context-changed',onContextEvent,{passive:true});
    window.addEventListener('rona:client-context-ready',onContextEvent,{passive:true});
    window.addEventListener('rona:client-current-projection',onProjection,{passive:true});
    observer=new MutationObserver(enforcePresentationInvariant);
    observer.observe(document.body,{childList:true,subtree:true});
    homeStateObserver=new MutationObserver(syncPrepaint);
    homeStateObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-rona-client-home-ready','data-rona-client-home-state']});
    window.addEventListener('pageshow',onPageShow,{passive:true});
    document.addEventListener('rona:client-home:rendered',()=>{purgeLegacy();syncPrepaint()});
    syncPrepaint();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();