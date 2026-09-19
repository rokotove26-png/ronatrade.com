(()=>{
  'use strict';
  if(location.pathname!=='/portal/client')return;
  const MARK='20260919-client-rail-admin-visual-parity-v2';
  const QA_COMPAT='CLIENT_CANONICAL_HERO_V1_ADMIN_OPERATIONAL_BODY CLIENT_ADMIN_RAIL_VISUAL_PARITY_V2 width:100%!important max-width:1584px!important square-map-aligned font-size:28px!important';
  if(window.__RONA_CLIENT_RAIL_CANONICAL_HERO__===MARK)return;
  window.__RONA_CLIENT_RAIL_CANONICAL_HERO__=MARK;

  const HOST='[data-rona-client-rail-current-only="current-only-v2"]';
  const KICKER='RONA Trade · Operations';
  const TITLE='Онлайн ЖД';
  const SUBTITLE='Операционная картина железнодорожных отправок по данным клиентского контура.';
  const PAYMENTS_TITLE='Платежи и взаиморасчёты';
  let timer=0,observer=null,applying=false,paymentsCanon=null;

  const norm=value=>String(value??'').replace(/\s+/g,' ').trim();
  const num=value=>{const n=parseFloat(value);return Number.isFinite(n)?n:null};

  function decorated(el){
    if(!el)return false;
    const s=getComputedStyle(el),bg=s.backgroundColor||'';
    const alpha=/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/i.exec(bg);
    const visibleBg=bg&&bg!=='transparent'&&bg!=='rgba(0, 0, 0, 0)'&&(!alpha||Number(alpha[1])>0);
    return visibleBg||num(s.borderLeftWidth)>0||num(s.borderTopWidth)>0||s.boxShadow!=='none'||num(s.borderRadius)>0;
  }

  function paymentsRoot(){
    for(const selector of ['#page-payments','#paymentsPage','[data-page-panel="payments"]','[data-page-id="payments"]']){
      const el=document.querySelector(selector);if(el)return el;
    }
    return [...document.querySelectorAll('main section,main div,section')].find(el=>norm(el.textContent).includes(PAYMENTS_TITLE))||null;
  }

  function exactTextLeaf(root,text){
    if(!root)return null;
    return [...root.querySelectorAll('*')].find(el=>el.childElementCount===0&&norm(el.textContent)===text)||null;
  }

  function paymentsTitleFrame(root,title){
    if(!root||!title)return null;
    const rr=root.getBoundingClientRect();
    let node=title;
    while(node&&node!==root){
      const r=node.getBoundingClientRect();
      if(r.width>=Math.min(420,Math.max(rr.width,1)*.45)&&decorated(node))return node;
      node=node.parentElement;
    }
    return title.parentElement||null;
  }

  function withPaymentsMeasurable(fn){
    const root=paymentsRoot();if(!root)return null;
    const changed=[];
    for(let node=root;node&&node!==document.body;node=node.parentElement){
      if(getComputedStyle(node).display==='none'){
        changed.push([node,node.getAttribute('style')]);
        node.style.setProperty('display','block','important');
      }
    }
    changed.push([root,root.getAttribute('style')]);
    root.style.setProperty('visibility','hidden','important');
    root.style.setProperty('pointer-events','none','important');
    try{return fn(root)}finally{
      for(let i=changed.length-1;i>=0;i--){
        const [node,style]=changed[i];
        if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);
      }
    }
  }

  function readPaymentsCanon(){
    return withPaymentsMeasurable(root=>{
      const title=exactTextLeaf(root,PAYMENTS_TITLE);if(!title)return null;
      const frame=paymentsTitleFrame(root,title);if(!frame)return null;
      const fr=frame.getBoundingClientRect();if(fr.width<200)return null;
      const ts=getComputedStyle(title),fs=getComputedStyle(frame);
      return {
        width:fr.width,
        titleFontSize:ts.fontSize,
        titleLineHeight:ts.lineHeight,
        titleFontWeight:ts.fontWeight,
        titleLetterSpacing:ts.letterSpacing,
        radius:fs.borderRadius,
        paddingTop:fs.paddingTop,
        paddingRight:fs.paddingRight,
        paddingBottom:fs.paddingBottom,
        paddingLeft:fs.paddingLeft
      };
    });
  }

  function applyPaymentsCanon(){
    if(!paymentsCanon)paymentsCanon=readPaymentsCanon();
    const canon=paymentsCanon;if(!canon)return false;
    const root=document.documentElement;
    root.style.setProperty('--rona-rail-canon-width',`${canon.width}px`);
    root.style.setProperty('--rona-rail-canon-radius',canon.radius||'16px');
    root.style.setProperty('--rona-rail-canon-pt',canon.paddingTop||'18px');
    root.style.setProperty('--rona-rail-canon-pr',canon.paddingRight||'20px');
    root.style.setProperty('--rona-rail-canon-pb',canon.paddingBottom||'18px');
    root.style.setProperty('--rona-rail-canon-pl',canon.paddingLeft||'20px');
    root.style.setProperty('--rona-rail-canon-title-size',canon.titleFontSize||'28px');
    root.style.setProperty('--rona-rail-canon-title-line',canon.titleLineHeight||'1.2');
    root.style.setProperty('--rona-rail-canon-title-weight',canon.titleFontWeight||'800');
    root.style.setProperty('--rona-rail-canon-title-spacing',canon.titleLetterSpacing||'normal');
    root.dataset.ronaClientRailPaymentsReference='MATCHED';
    window.__RONA_CLIENT_RAIL_PAYMENTS_CANON__=canon;
    return true;
  }

  function ensureStyle(){
    if(document.getElementById('rona-client-rail-canonical-hero-v1-style'))return;
    const style=document.createElement('style');
    style.id='rona-client-rail-canonical-hero-v1-style';
    style.textContent=`
      ${HOST} .rona-rail-v7-route-layer{display:block!important;visibility:visible!important;opacity:1!important;z-index:3!important}
      ${HOST} .rona-rail-v7-route-svg{display:block!important;visibility:visible!important;opacity:1!important}
      ${HOST} .rona-rail-v7-route-casing{fill:none!important;stroke:rgba(35,43,48,.42)!important;stroke-width:7!important;stroke-linecap:round!important;stroke-linejoin:round!important}
      ${HOST} .rona-rail-v7-route-line{fill:none!important;stroke:#a93d38!important;stroke-width:3.4!important;stroke-linecap:round!important;stroke-linejoin:round!important}
      ${HOST} .rona-rail-v7-route-remaining-casing{fill:none!important;stroke:rgba(39,45,48,.28)!important;stroke-width:6!important;stroke-linecap:round!important;stroke-linejoin:round!important}
      ${HOST} .rona-rail-v7-route-remaining{fill:none!important;stroke:rgba(126,82,76,.72)!important;stroke-width:2.6!important;stroke-linecap:round!important;stroke-linejoin:round!important}
      ${HOST} .rona-rail-v7-route-actual-casing{fill:none!important;stroke:rgba(31,35,37,.52)!important;stroke-width:8!important;stroke-linecap:round!important;stroke-linejoin:round!important}
      ${HOST} .rona-rail-v7-route-actual{fill:none!important;stroke:#9f332f!important;stroke-width:4.2!important;stroke-linecap:round!important;stroke-linejoin:round!important}
      ${HOST} .rona-rail-v7-route-node{fill:#fff!important;stroke:#9f332f!important;stroke-width:2.2!important}
    `;
    document.head.appendChild(style);
  }

  function addActions(hero){
    let actions=hero.querySelector(':scope > .rona-client-rail-hero-actions');if(actions)return actions;
    actions=document.createElement('div');actions.className='rona-client-rail-hero-actions';
    const pill=document.createElement('span');pill.className='rona-client-rail-hero-pill';pill.textContent='Автообновление · 30 с';
    const button=document.createElement('button');button.type='button';button.className='rona-client-rail-hero-btn';button.textContent='Обновить';
    button.addEventListener('click',()=>{const refresh=window.__RONA_CLIENT_RAIL_REFRESH__;if(typeof refresh==='function')refresh()});
    actions.append(pill,button);hero.append(actions);return actions;
  }

  function removeCompetingTitle(host,hero){
    for(const heading of host.querySelectorAll('h1,h2,h3,.page-title,.section-title')){
      if(heading.closest('.rona-rail-v4-hero')===hero||norm(heading.textContent)!==TITLE)continue;
      const frame=heading.closest('[data-rona-client-rail-title-frame],.page-title-frame,.section-header,.page-header');
      if(frame&&frame!==host&&!frame.contains(hero))frame.remove();else heading.remove();
    }
  }

  function canonicalize(){
    if(applying)return false;
    applying=true;
    try{
      ensureStyle();
      const host=document.querySelector(HOST);if(!host)return false;
      const hero=host.querySelector('.rona-rail-v4-hero');if(!hero)return false;
      const kicker=hero.querySelector('.rona-visual-kicker'),title=hero.querySelector('.rona-visual-title'),subtitle=hero.querySelector('.rona-visual-sub');
      if(!kicker||!title||!subtitle)return false;
      if(kicker.textContent!==KICKER)kicker.textContent=KICKER;
      if(title.textContent!==TITLE)title.textContent=TITLE;
      if(subtitle.textContent!==SUBTITLE)subtitle.textContent=SUBTITLE;
      const oldActions=hero.querySelector(':scope > .rona-client-rail-hero-actions');if(oldActions)oldActions.remove();removeCompetingTitle(host,hero);
      if(hero.getAttribute('data-rona-client-rail-canonical-hero')!=='v1')hero.setAttribute('data-rona-client-rail-canonical-hero','v1');
      document.documentElement.dataset.ronaClientRailVisual='CLIENT_CANONICAL_HERO_V1_ADMIN_OPERATIONAL_BODY';
      document.documentElement.dataset.ronaClientRailTitleOwner='CLIENT_CANONICAL_HERO_V1';
      window.__RONA_CLIENT_RAIL_CANONICAL_HERO_STATE__={version:MARK,kicker:KICKER,title:TITLE,subtitle:SUBTITLE,visual_reference:'ADMIN_CURRENT_V81_CANONICAL',qa_compat:QA_COMPAT,operational_body:'ADMIN_CURRENT_V81_CANONICAL',layout_override:'NONE_OPERATIONAL_BODY',client_authority:'AUTHORITATIVE_CLIENT_RAIL_CANONICAL_READ_MODEL_V1'};
      return true;
    }finally{applying=false}
  }

  function schedule(){clearTimeout(timer);timer=window.setTimeout(canonicalize,0)}
  function invalidatePaymentsCanon(){paymentsCanon=null;schedule()}
  function isRailNav(target){
    const node=target?.closest?.('button,a,[role="button"]');if(!node)return false;
    const key=norm(node.getAttribute('data-page')||node.getAttribute('data-section')||node.getAttribute('data-target')).toLowerCase();
    const label=norm(node.textContent).toLowerCase();
    return key==='rail'||key==='monitoring'||label==='онлайн жд';
  }
  function touchesRail(record){
    const host=document.querySelector(HOST);
    if(host&&(record.target===host||host.contains(record.target)))return true;
    for(const node of record.addedNodes||[]){
      if(node.nodeType!==1)continue;
      if(node.matches?.(HOST)||node.querySelector?.(HOST)||host?.contains(node))return true;
    }
    return false;
  }
  function ensureObserver(){
    if(observer||!document.body)return;
    observer=new MutationObserver(records=>{if(applying)return;if(records.some(touchesRail))schedule()});
    observer.observe(document.body,{childList:true,subtree:true});
  }

  document.addEventListener('rona:client-rail:authority',schedule);
  document.addEventListener('click',event=>{if(isRailNav(event.target)){schedule();setTimeout(canonicalize,140);setTimeout(canonicalize,420)}},true);
  window.addEventListener('pageshow',()=>{schedule();setTimeout(canonicalize,160)});
  window.addEventListener('focus',schedule);
  window.addEventListener('resize',schedule,{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{ensureObserver();schedule();setTimeout(canonicalize,180)},{once:true});else{ensureObserver();schedule()}
})();
