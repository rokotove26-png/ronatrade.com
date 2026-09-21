(()=>{
  'use strict';
  if(location.pathname!=='/portal/client')return;
  const MARK='20260921-client-rail-premium-map-markers-v3';
  const QA_COMPAT='CLIENT_CANONICAL_HERO_V1_ADMIN_OPERATIONAL_BODY CLIENT_ADMIN_RAIL_VISUAL_PARITY_V2 CLIENT_RAIL_PREMIUM_MAP_MARKERS_V1';
  if(window.__RONA_CLIENT_RAIL_CANONICAL_HERO__===MARK)return;
  window.__RONA_CLIENT_RAIL_CANONICAL_HERO__=MARK;

  const HOST='[data-rona-client-rail-current-only="current-only-v2"]';
  const KICKER='RONA Trade · Operations';
  const TITLE='Онлайн ЖД';
  const SUBTITLE='Операционная картина железнодорожных отправок по данным клиентского контура.';
  let timer=0,observer=null,applying=false;

  const norm=value=>String(value??'').replace(/\s+/g,' ').trim();

  function ensureStyle(){
    if(document.getElementById('rona-client-rail-canonical-hero-v1-style'))return;
    const style=document.createElement('style');
    style.id='rona-client-rail-canonical-hero-v1-style';
    style.textContent=`
      ${HOST} .rona-rail-v7-route-layer{display:block!important;visibility:visible!important;opacity:1!important;z-index:3!important}
      ${HOST} .rona-rail-v7-route-svg{display:block!important;visibility:visible!important;opacity:1!important}
      ${HOST} .rona-rail-v7-route-casing{fill:none!important;stroke:rgba(4,24,36,.56)!important;stroke-width:7.2!important;stroke-linecap:round!important;stroke-linejoin:round!important}
      ${HOST} .rona-rail-v7-route-line{fill:none!important;stroke:#63d8ff!important;stroke-width:3.6!important;stroke-linecap:round!important;stroke-linejoin:round!important;filter:drop-shadow(0 1px 3px rgba(28,175,222,.26))!important}
      ${HOST} .rona-rail-v7-route-remaining-casing{fill:none!important;stroke:rgba(5,28,39,.48)!important;stroke-width:6.4!important;stroke-linecap:round!important;stroke-linejoin:round!important}
      ${HOST} .rona-rail-v7-route-remaining{fill:none!important;stroke:rgba(83,166,196,.78)!important;stroke-width:2.8!important;stroke-linecap:round!important;stroke-linejoin:round!important;stroke-dasharray:6 6!important}
      ${HOST} .rona-rail-v7-route-actual-casing{fill:none!important;stroke:rgba(3,20,31,.64)!important;stroke-width:8.4!important;stroke-linecap:round!important;stroke-linejoin:round!important}
      ${HOST} .rona-rail-v7-route-actual{fill:none!important;stroke:#25cfc0!important;stroke-width:4.2!important;stroke-linecap:round!important;stroke-linejoin:round!important;filter:drop-shadow(0 1px 3px rgba(37,207,192,.28))!important}
      ${HOST} .rona-rail-v7-route-node{display:none!important}
      ${HOST} .rona-client-rail-route-pin{shape-rendering:geometricPrecision!important}
      ${HOST} .rona-client-rail-route-pin--origin{fill:#63d8ff!important}
      ${HOST} .rona-client-rail-route-pin--destination{fill:#5ee7d5!important}
      ${HOST} .rona-client-rail-route-pin--border{fill:#ffc86a!important}
      ${HOST} .rona-client-rail-route-pin--waypoint{fill:#9be9ff!important}
      ${HOST} .rona-rail-v7-marker{min-width:30px!important;width:auto!important;height:24px!important;margin:-12px 0 0 -15px!important;padding:0 8px!important;border:1px solid rgba(121,226,244,.55)!important;border-radius:7px!important;background:linear-gradient(180deg,rgba(8,35,49,.98),rgba(5,24,36,.98))!important;box-shadow:0 6px 16px rgba(1,14,23,.32),0 0 0 1px rgba(95,211,233,.10),0 0 14px rgba(99,216,255,.16)!important;color:#dffbff!important;font-size:10.5px!important;font-weight:850!important;letter-spacing:.01em!important}
      ${HOST} .rona-rail-v7-marker::before{content:""!important;display:inline-block!important;width:5px!important;height:5px!important;margin-right:5px!important;border-radius:1.5px!important;background:#5ee7d5!important;box-shadow:0 0 8px rgba(94,231,213,.72)!important;vertical-align:1px!important}
      ${HOST} .rona-rail-v7-marker::after{display:none!important;content:none!important}
      ${HOST} .rona-rail-v7-marker:hover,.rona-rail-v7-marker.is-open{transform:translateY(-1px)!important;border-color:rgba(151,239,252,.86)!important;box-shadow:0 8px 20px rgba(1,14,23,.38),0 0 18px rgba(99,216,255,.22)!important}
      ${HOST} .rona-rail-v7-marker-label{left:50%!important;top:-10px!important;transform:translate(-50%,-100%)!important;padding:7px 9px!important;border:1px solid rgba(110,214,232,.22)!important;border-radius:8px!important;background:rgba(4,20,31,.96)!important;color:#e9fbff!important;box-shadow:0 10px 24px rgba(0,0,0,.30)!important;font-size:10.5px!important;font-weight:720!important}
    `;
    document.head.appendChild(style);
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
      const oldActions=hero.querySelector(':scope > .rona-client-rail-hero-actions');if(oldActions)oldActions.remove();
      removeCompetingTitle(host,hero);
      if(hero.getAttribute('data-rona-client-rail-canonical-hero')!=='v1')hero.setAttribute('data-rona-client-rail-canonical-hero','v1');
      document.documentElement.dataset.ronaClientRailVisual='CLIENT_CANONICAL_HERO_V1_ADMIN_OPERATIONAL_BODY';
      document.documentElement.dataset.ronaClientRailTitleOwner='CLIENT_CANONICAL_HERO_V1';
      window.__RONA_CLIENT_RAIL_CANONICAL_HERO_STATE__={
        version:MARK,kicker:KICKER,title:TITLE,subtitle:SUBTITLE,
        visual_reference:'ADMIN_CURRENT_V81_CANONICAL',premium_map_markers:'CLIENT_RAIL_PREMIUM_MAP_MARKERS_V1',
        qa_compat:QA_COMPAT,
        operational_body:'ADMIN_CURRENT_V81_CANONICAL',
        layout_override:'NONE_OPERATIONAL_BODY',
        client_authority:'AUTHORITATIVE_CLIENT_RAIL_CANONICAL_READ_MODEL_V1'
      };
      return true;
    }finally{applying=false}
  }

  function schedule(){clearTimeout(timer);timer=window.setTimeout(canonicalize,0)}
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
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{ensureObserver();schedule();setTimeout(canonicalize,180)},{once:true});
  else{ensureObserver();schedule()}
})();
