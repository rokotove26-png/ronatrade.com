(()=>{
  'use strict';
  if(location.pathname!=='/portal/client')return;
  const MARK='20260831-client-rail-canonical-hero-v1';
  if(window.__RONA_CLIENT_RAIL_CANONICAL_HERO__===MARK)return;
  window.__RONA_CLIENT_RAIL_CANONICAL_HERO__=MARK;

  const HOST='[data-rona-client-rail-current-only="current-only-v2"]';
  const KICKER='RONA Trade · Operations';
  const TITLE='Онлайн ЖД';
  const SUBTITLE='Операционная картина железнодорожных отправок по данным клиентского контура.';
  let timer=0;

  const norm=value=>String(value??'').replace(/\s+/g,' ').trim();

  function ensureStyle(){
    if(document.getElementById('rona-client-rail-canonical-hero-v1-style'))return;
    const style=document.createElement('style');
    style.id='rona-client-rail-canonical-hero-v1-style';
    style.textContent=`
      ${HOST} .rona-rail-v4-root{
        gap:12px!important;
      }
      ${HOST} .rona-rail-v4-hero{
        display:flex!important;
        position:relative!important;
        z-index:3!important;
        align-items:center!important;
        justify-content:space-between!important;
        gap:12px!important;
        padding:14px 16px!important;
        margin:0 0 10px!important;
        border:1px solid rgba(113,169,194,.18)!important;
        border-radius:12px!important;
        background:linear-gradient(135deg,rgba(10,31,43,.94),rgba(6,18,27,.9))!important;
        box-shadow:0 10px 30px rgba(0,0,0,.14)!important;
        color:#eaf4f8!important;
        font-family:Inter,Arial,sans-serif!important;
        box-sizing:border-box!important;
      }
      ${HOST} .rona-rail-v4-hero .rona-visual-kicker{
        display:block!important;
        margin:0 0 4px!important;
        color:#71b9d2!important;
        font-family:Inter,Arial,sans-serif!important;
        font-size:8.5px!important;
        font-weight:800!important;
        letter-spacing:.12em!important;
        text-transform:uppercase!important;
      }
      ${HOST} .rona-rail-v4-hero .rona-visual-title{
        display:block!important;
        margin:0!important;
        color:#eaf4f8!important;
        font-family:Inter,Arial,sans-serif!important;
        font-size:18px!important;
        line-height:1.2!important;
        font-weight:800!important;
        letter-spacing:-.01em!important;
      }
      ${HOST} .rona-rail-v4-hero .rona-visual-sub{
        display:block!important;
        margin:5px 0 0!important;
        color:#8ea6b2!important;
        font-family:Inter,Arial,sans-serif!important;
        font-size:10.5px!important;
        line-height:1.4!important;
        font-weight:400!important;
      }
      ${HOST} .rona-client-rail-hero-actions{
        display:flex!important;
        align-items:center!important;
        gap:7px!important;
        flex-wrap:wrap!important;
        justify-content:flex-end!important;
      }
      ${HOST} .rona-client-rail-hero-pill,
      ${HOST} .rona-client-rail-hero-btn{
        border:1px solid rgba(111,188,218,.25)!important;
        border-radius:999px!important;
        background:rgba(12,34,46,.72)!important;
        color:#b9d5df!important;
        font-family:Inter,Arial,sans-serif!important;
        font-size:9px!important;
        font-weight:750!important;
        line-height:normal!important;
        white-space:nowrap!important;
        box-sizing:border-box!important;
      }
      ${HOST} .rona-client-rail-hero-pill{padding:6px 9px!important}
      ${HOST} .rona-client-rail-hero-btn{padding:6px 10px!important;cursor:pointer!important}
      ${HOST} .rona-client-rail-hero-btn:hover{background:rgba(19,54,70,.9)!important;color:#fff!important}
      ${HOST} .rona-client-rail-hero-btn:disabled{opacity:.55!important;cursor:default!important}

      ${HOST} .rona-rail-v4-work{
        grid-template-columns:minmax(250px,.68fr) minmax(0,1.55fr)!important;
        gap:12px!important;
      }
      ${HOST} .rona-rail-v4-left{gap:12px!important}
      ${HOST} .rona-rail-v4-card{
        padding:12px 14px!important;
        border-radius:12px!important;
      }
      ${HOST} .rona-rail-v4-card h2{
        margin:0 0 9px!important;
        font-size:13px!important;
        line-height:1.25!important;
      }
      ${HOST} .rona-rail-v4-kpis{gap:8px!important}
      ${HOST} .rona-rail-v4-kpi{
        padding:10px 11px!important;
        border-radius:11px!important;
      }
      ${HOST} .rona-rail-v4-kpi span{font-size:10px!important}
      ${HOST} .rona-rail-v4-kpi strong{margin-top:5px!important;font-size:20px!important}
      ${HOST} .rona-rail-v6-selector{margin-top:10px!important}
      ${HOST} .rona-rail-v6-select-wrap{gap:5px!important}
      ${HOST} .rona-rail-v6-select{min-height:36px!important;border-radius:10px!important}
      ${HOST} .rona-rail-v6-wagon-box{
        gap:8px!important;
        margin:0 0 10px!important;
        padding:10px 11px!important;
        border-radius:11px!important;
        min-height:66px!important;
      }
      ${HOST} .rona-rail-v6-wagon-count{min-width:24px!important;height:24px!important}
      ${HOST} .rona-rail-v4-map,
      ${HOST} .rona-rail-v7-real{
        min-height:300px!important;
        margin-bottom:10px!important;
        border-radius:14px!important;
      }
      ${HOST} .rona-rail-v7-real .rona-rail-v4-map-canvas{
        inset:38px 8px 40px!important;
        border-radius:11px!important;
      }
      ${HOST} .rona-rail-v4-map-title{left:12px!important;top:10px!important}
      ${HOST} .rona-rail-v4-map-badge{right:10px!important;top:9px!important}
      ${HOST} .rona-rail-v4-map-note{left:12px!important;right:12px!important;bottom:9px!important}

      @media(max-width:1040px){
        ${HOST} .rona-rail-v4-work{grid-template-columns:1fr!important}
        ${HOST} .rona-rail-v4-map,${HOST} .rona-rail-v7-real{min-height:280px!important}
      }
      @media(max-width:720px){
        ${HOST} .rona-rail-v4-hero{align-items:flex-start!important;flex-direction:column!important}
        ${HOST} .rona-client-rail-hero-actions{justify-content:flex-start!important}
        ${HOST} .rona-rail-v4-map,${HOST} .rona-rail-v7-real{min-height:260px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function addActions(hero){
    let actions=hero.querySelector(':scope > .rona-client-rail-hero-actions');
    if(actions)return actions;
    actions=document.createElement('div');
    actions.className='rona-client-rail-hero-actions';

    const pill=document.createElement('span');
    pill.className='rona-client-rail-hero-pill';
    pill.textContent='Обновление · по изменению';

    const button=document.createElement('button');
    button.type='button';
    button.className='rona-client-rail-hero-btn';
    button.textContent='Обновить';
    button.addEventListener('click',()=>{
      const refresh=window.__RONA_CLIENT_RAIL_REFRESH__;
      if(typeof refresh==='function')refresh();
    });

    actions.append(pill,button);
    hero.append(actions);
    return actions;
  }

  function removeCompetingTitle(host,hero){
    for(const heading of host.querySelectorAll('h1,h2,h3,.page-title,.section-title')){
      if(heading.closest('.rona-rail-v4-hero')===hero)continue;
      if(norm(heading.textContent)!==TITLE)continue;
      const frame=heading.closest('[data-rona-client-rail-title-frame],.page-title-frame,.section-header,.page-header');
      if(frame&&frame!==host&&!frame.contains(hero))frame.remove();
      else heading.remove();
    }
  }

  function canonicalize(){
    ensureStyle();
    const host=document.querySelector(HOST);
    if(!host)return false;
    const hero=host.querySelector('.rona-rail-v4-hero');
    if(!hero)return false;

    const kicker=hero.querySelector('.rona-visual-kicker');
    const title=hero.querySelector('.rona-visual-title');
    const subtitle=hero.querySelector('.rona-visual-sub');
    if(!kicker||!title||!subtitle)return false;

    if(norm(kicker.textContent)!==KICKER)kicker.textContent=KICKER;
    if(norm(title.textContent)!==TITLE)title.textContent=TITLE;
    if(norm(subtitle.textContent)!==SUBTITLE)subtitle.textContent=SUBTITLE;
    addActions(hero);
    removeCompetingTitle(host,hero);

    hero.setAttribute('data-rona-client-rail-canonical-hero','v1');
    document.documentElement.dataset.ronaClientRailVisual='CLIENT_CANONICAL_HERO_V1_ADMIN_OPERATIONAL_BODY';
    document.documentElement.dataset.ronaClientRailTitleOwner='CLIENT_CANONICAL_HERO_V1';
    document.documentElement.dataset.ronaClientRailDensity='COMPACT_STANDARD_V1';
    window.__RONA_CLIENT_RAIL_CANONICAL_HERO_STATE__={
      version:MARK,
      kicker:KICKER,
      title:TITLE,
      subtitle:SUBTITLE,
      title_px:18,
      density:'COMPACT_STANDARD_V1',
      refresh_mode:'EVENT_DRIVEN_PLUS_MANUAL',
      operational_body:'ADMIN_CURRENT_V81_CANONICAL',
      client_authority:'AUTHORITATIVE_SERVER_CLIENT_SHIPMENTS'
    };
    return true;
  }

  function schedule(){
    clearTimeout(timer);
    timer=window.setTimeout(canonicalize,0);
  }

  function isRailNav(target){
    const node=target?.closest?.('button,a,[role="button"]');
    if(!node)return false;
    const key=norm(node.getAttribute('data-page')||node.getAttribute('data-section')||node.getAttribute('data-target')).toLowerCase();
    const label=norm(node.textContent).toLowerCase();
    return key==='rail'||key==='monitoring'||label==='онлайн жд';
  }

  document.addEventListener('rona:client-rail:authority',schedule);
  document.addEventListener('rona:client-rail:changed',schedule);
  document.addEventListener('click',event=>{if(isRailNav(event.target)){schedule();setTimeout(canonicalize,140);setTimeout(canonicalize,420)}},true);
  window.addEventListener('pageshow',()=>{schedule();setTimeout(canonicalize,160)});
  window.addEventListener('focus',schedule);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{schedule();setTimeout(canonicalize,180)},{once:true});
  else schedule();
})();
