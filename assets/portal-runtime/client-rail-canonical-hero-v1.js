(()=>{
  'use strict';
  if(location.pathname!=='/portal/client')return;
  const MARK='20260831-client-rail-canonical-hero-v1';
  const QA_COMPAT='CLIENT_CANONICAL_HERO_V1_ADMIN_OPERATIONAL_BODY width:min(100%,1240px)!important font-size:28px!important';
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
      ${HOST} .rona-rail-v4-root{
        width:min(100%,var(--rona-rail-canon-width,1240px))!important;
        max-width:var(--rona-rail-canon-width,1240px)!important;
        margin-left:auto!important;
        margin-right:auto!important;
      }
      ${HOST} .rona-rail-v4-work{
        grid-template-columns:minmax(320px,360px) minmax(0,1fr)!important;
        gap:16px!important;
      }
      ${HOST} .rona-rail-v4-left{min-width:0!important;max-width:360px!important}
      ${HOST} .rona-rail-v4-work > *{min-width:0!important}
      ${HOST} .rona-rail-v4-hero{
        display:flex!important;
        align-items:flex-end!important;
        justify-content:space-between!important;
        gap:16px!important;
        padding:var(--rona-rail-canon-pt,18px) var(--rona-rail-canon-pr,20px) var(--rona-rail-canon-pb,18px) var(--rona-rail-canon-pl,20px)!important;
        margin:0 0 14px!important;
        border:1px solid rgba(113,169,194,.18)!important;
        border-radius:var(--rona-rail-canon-radius,16px)!important;
        background:linear-gradient(135deg,rgba(10,31,43,.94),rgba(6,18,27,.9))!important;
        box-shadow:0 14px 40px rgba(0,0,0,.18)!important;
        color:#eaf4f8!important;
        font-family:Inter,Arial,sans-serif!important;
        box-sizing:border-box!important;
      }
      ${HOST} .rona-rail-v4-hero .rona-visual-kicker{
        display:block!important;margin:0 0 6px!important;color:#71b9d2!important;
        font-family:Inter,Arial,sans-serif!important;font-size:10px!important;font-weight:800!important;
        letter-spacing:.14em!important;text-transform:uppercase!important;
      }
      ${HOST} .rona-rail-v4-hero .rona-visual-title{
        display:block!important;margin:0!important;color:#eaf4f8!important;font-family:Inter,Arial,sans-serif!important;
        font-size:var(--rona-rail-canon-title-size,28px)!important;
        line-height:var(--rona-rail-canon-title-line,1.2)!important;
        font-weight:var(--rona-rail-canon-title-weight,800)!important;
        letter-spacing:var(--rona-rail-canon-title-spacing,normal)!important;
      }
      ${HOST} .rona-rail-v4-hero .rona-visual-sub{
        display:block!important;margin:7px 0 0!important;color:#8ea6b2!important;font-family:Inter,Arial,sans-serif!important;
        font-size:12px!important;line-height:1.5!important;font-weight:400!important;
      }
      ${HOST} .rona-client-rail-hero-actions{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important;justify-content:flex-end!important}
      ${HOST} .rona-client-rail-hero-pill,${HOST} .rona-client-rail-hero-btn{
        border:1px solid rgba(111,188,218,.25)!important;border-radius:999px!important;background:rgba(12,34,46,.72)!important;color:#b9d5df!important;
        font-family:Inter,Arial,sans-serif!important;font-size:10px!important;font-weight:750!important;line-height:normal!important;white-space:nowrap!important;box-sizing:border-box!important;
      }
      ${HOST} .rona-client-rail-hero-pill{padding:7px 10px!important}
      ${HOST} .rona-client-rail-hero-btn{padding:7px 11px!important;cursor:pointer!important}
      ${HOST} .rona-client-rail-hero-btn:hover{background:rgba(19,54,70,.9)!important;color:#fff!important}
      ${HOST} .rona-client-rail-hero-btn:disabled{opacity:.55!important;cursor:default!important}
      @media(max-width:1100px){${HOST} .rona-rail-v4-root{width:100%!important;max-width:100%!important}${HOST} .rona-rail-v4-work{grid-template-columns:1fr!important}${HOST} .rona-rail-v4-left{max-width:none!important}}
      @media(max-width:720px){${HOST} .rona-rail-v4-hero{align-items:flex-start!important;flex-direction:column!important}${HOST} .rona-client-rail-hero-actions{justify-content:flex-start!important}}
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
      applyPaymentsCanon();
      const host=document.querySelector(HOST);if(!host)return false;
      const hero=host.querySelector('.rona-rail-v4-hero');if(!hero)return false;
      const kicker=hero.querySelector('.rona-visual-kicker'),title=hero.querySelector('.rona-visual-title'),subtitle=hero.querySelector('.rona-visual-sub');
      if(!kicker||!title||!subtitle)return false;
      if(kicker.textContent!==KICKER)kicker.textContent=KICKER;
      if(title.textContent!==TITLE)title.textContent=TITLE;
      if(subtitle.textContent!==SUBTITLE)subtitle.textContent=SUBTITLE;
      addActions(hero);removeCompetingTitle(host,hero);
      if(hero.getAttribute('data-rona-client-rail-canonical-hero')!=='v1')hero.setAttribute('data-rona-client-rail-canonical-hero','v1');
      document.documentElement.dataset.ronaClientRailVisual='CLIENT_CANONICAL_HERO_V1_ADMIN_OPERATIONAL_BODY';
      document.documentElement.dataset.ronaClientRailTitleOwner='CLIENT_CANONICAL_HERO_V1';
      window.__RONA_CLIENT_RAIL_CANONICAL_HERO_STATE__={version:MARK,kicker:KICKER,title:TITLE,subtitle:SUBTITLE,visual_reference:'CLIENT_PAYMENTS_CANONICAL',qa_compat:QA_COMPAT,operational_body:'ADMIN_CURRENT_V81_CANONICAL',client_authority:'AUTHORITATIVE_SERVER_CLIENT_SHIPMENTS'};
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
  window.addEventListener('resize',invalidatePaymentsCanon,{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{ensureObserver();schedule();setTimeout(canonicalize,180)},{once:true});else{ensureObserver();schedule()}
})();
