(()=>{
  'use strict';
  if(location.pathname!=='/portal/client')return;
  const MARK='20260830-client-home-current-only-v1';
  if(window.__RONA_CLIENT_HOME_CURRENT_ONLY__===MARK)return;
  window.__RONA_CLIENT_HOME_CURRENT_ONLY__=MARK;

  const OWNER='[data-rona-client-home-owner="command-center-v2"]';
  const ROOT_SELECTORS=['#page-home','#homePage','[data-page-panel="home"]','[data-page-id="home"]'];
  const LEGACY_LABELS=['АКТИВНЫЕ СДЕЛКИ','ОПЛАТА','ТЕКУЩИЙ СТАТУС','СЛЕДУЮЩИЙ ШАГ','Компания','Оплата','Цены','Заявки'];
  let observer=null;

  const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
  const navText=v=>norm(v).toLowerCase().replace(/ё/g,'е');

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
    window.__RONA_CLIENT_HOME_CURRENT_ONLY_STATE__={version:MARK,owner:'command-center-v2',legacy_dom:'PHYSICALLY_REMOVED',removed_last_pass:removed};
    return true;
  }

  function resetBeforeHomePaint(){
    document.documentElement.removeAttribute('data-rona-client-home-ready');
    document.documentElement.setAttribute('data-rona-client-home-state','loading');
    document.documentElement.setAttribute('data-rona-client-home-prepaint','blocked-until-command-center-v2');
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

  function start(){
    resetBeforeHomePaint();
    purgeLegacy();
    document.addEventListener('pointerdown',prepaint,true);
    document.addEventListener('mousedown',prepaint,true);
    document.addEventListener('click',prepaint,true);
    observer=new MutationObserver(()=>{purgeLegacy()});
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('pageshow',()=>{resetBeforeHomePaint();purgeLegacy()},{passive:true});
    document.addEventListener('rona:client-home:rendered',purgeLegacy);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
