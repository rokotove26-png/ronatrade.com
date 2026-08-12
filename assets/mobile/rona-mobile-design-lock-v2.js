(()=>{
  'use strict';
  if(!matchMedia('(max-width:767px)').matches)return;
  if(window.__RONA_MOBILE_DESIGN_LOCK_V2__)return;
  window.__RONA_MOBILE_DESIGN_LOCK_V2__=true;

  const state=window.__RONA_MOBILE_REMEDIATION_V2_STATE__||{};
  const path=(location.pathname||'').toLowerCase();
  const page=state.page||(
    path.includes('about')?'about':path.includes('products')?'products':path.includes('logistics')?'logistics':path.includes('geography')?'geography':path.includes('contacts')?'contacts':'home'
  );
  const tone=['home','logistics','contacts'].includes(page)?'light':'dark';
  document.documentElement.dataset.ronaMobileUiTone=tone;

  const IDS=new Set(['rona-mobile-outer-v2','rona-mobile-remediation-v2','rona-mobile-home-style-v1']);
  const FORBIDDEN=new Set([
    'background','background-color','background-image','background-size','background-position','background-repeat','background-clip','background-origin','background-attachment','background-blend-mode',
    'border','border-top','border-right','border-bottom','border-left','border-color','border-top-color','border-right-color','border-bottom-color','border-left-color','border-style','border-top-style','border-right-style','border-bottom-style','border-left-style','border-width','border-top-width','border-right-width','border-bottom-width','border-left-width','border-radius','border-start-start-radius','border-start-end-radius','border-end-start-radius','border-end-end-radius',
    'box-shadow','backdrop-filter','-webkit-backdrop-filter','mask','mask-image','-webkit-mask','-webkit-mask-image'
  ]);
  const seenFrames=new WeakSet();

  function strip(rule,ownerId){
    try{
      if(rule.style){
        for(const prop of [...rule.style])if(FORBIDDEN.has(prop.toLowerCase()))rule.style.removeProperty(prop);
        if(ownerId==='rona-mobile-remediation-v2'){
          const sel=rule.selectorText||'';
          if(sel==='html[data-rona-mobile-v2] body'||sel==='html[data-rona-mobile-v2] .lead')rule.style.removeProperty('color');
        }
      }
      if(rule.cssRules)for(const child of [...rule.cssRules])strip(child,ownerId);
    }catch(_){}
  }

  function sanitizeOwner(owner){
    if(!owner||!IDS.has(owner.id||''))return;
    try{if(owner.sheet?.cssRules)for(const rule of [...owner.sheet.cssRules])strip(rule,owner.id)}catch(_){}
  }

  function installSourcePreserveCorrections(doc){
    if(!doc||!doc.documentElement||doc.getElementById('rona-mobile-source-preserve-corrections-v1'))return;
    const style=doc.createElement('style');
    style.id='rona-mobile-source-preserve-corrections-v1';
    style.textContent=`
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .thesis-head,
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .rail-head-main{display:flex!important;align-items:center!important;gap:11px!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .thesis-icon,
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .rail-icon{flex:0 0 40px!important;width:40px!important;height:40px!important;display:grid!important;place-items:center!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .thesis-icon svg,
      html[data-rona-mobile-v2][data-rona-mobile-page="geography"] .rail-icon svg{width:27px!important;height:27px!important;stroke:currentColor!important;fill:none!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="home"] .request-close,
      html[data-rona-mobile-v2][data-rona-mobile-page="home"] .modal-close{min-width:46px!important;min-height:46px!important;display:grid!important;place-items:center!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .logo-strip,
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .partners{grid-template-columns:1fr!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .partner-card{grid-template-columns:82px minmax(0,1fr)!important}
      html[data-rona-mobile-v2][data-rona-mobile-page="logistics"] .partner-card.ops{grid-template-columns:96px minmax(0,1fr)!important}
    `;
    (doc.head||doc.documentElement).appendChild(style);
  }

  function bindFrame(frame){
    if(!frame)return;
    const apply=()=>{try{scan(frame.contentDocument)}catch(_){}};
    if(!seenFrames.has(frame)){
      seenFrames.add(frame);
      frame.addEventListener('load',apply,{passive:true});
    }
    apply();
  }

  function scan(doc){
    if(!doc?.documentElement)return;
    doc.querySelectorAll('style[id],link[id][rel~="stylesheet"]').forEach(sanitizeOwner);
    installSourcePreserveCorrections(doc);
    doc.querySelectorAll('iframe').forEach(bindFrame);
  }

  const structural=document.createElement('style');
  structural.id='rona-mobile-design-lock-structural-v2';
  structural.textContent=`
    #rona-mobile-brand:before,#rona-mobile-menu-button:before,#rona-mobile-menu-button:after,#rona-mobile-drawer a.active:before,#rona-mobile-drawer .portal:before{display:none!important}
    html[data-rona-mobile-ui-tone="light"] #rona-mobile-topbar,html[data-rona-mobile-ui-tone="light"] #rona-mobile-drawer{color:#17181a!important}
    html[data-rona-mobile-ui-tone="dark"] #rona-mobile-topbar,html[data-rona-mobile-ui-tone="dark"] #rona-mobile-drawer{color:#fff!important}
    #rona-mobile-brand,#rona-mobile-language,#rona-mobile-drawer a,#rona-mobile-drawer button{color:inherit!important}
    #rona-mobile-language{min-width:44px!important;height:44px!important}
    #rona-mobile-menu-button{all:unset;box-sizing:border-box!important;width:44px!important;height:44px!important;display:grid!important;place-items:center!important;cursor:pointer!important;color:inherit!important}
    #rona-mobile-menu-button span{display:block!important;width:auto!important;height:auto!important;opacity:1!important;color:inherit!important;font:700 28px/1 "Segoe UI Symbol","Segoe UI",Arial,sans-serif!important}
    #rona-mobile-drawer button.portal{all:unset;box-sizing:border-box!important;width:100%!important;min-height:52px!important;display:flex!important;align-items:center!important;padding:0 14px!important;cursor:pointer!important;color:inherit!important;font:800 17px/1.25 "Segoe UI",Arial,sans-serif!important;text-decoration:underline!important;text-underline-offset:5px!important}
    html.rona-mobile-menu-visible #stage,html.rona-mobile-menu-visible .compact-stage{visibility:hidden!important}
    @media(max-width:360px){#rona-mobile-menu-button span{font-size:26px!important}}
  `;
  document.head.appendChild(structural);

  function bindMenu(){
    const button=document.getElementById('rona-mobile-menu-button');
    const drawer=document.getElementById('rona-mobile-drawer');
    if(!button||!drawer)return;
    let span=button.querySelector('span');
    if(!span){span=document.createElement('span');button.appendChild(span)}
    const sync=()=>{
      const open=drawer.classList.contains('open');
      span.textContent=open?'×':'☰';
      document.documentElement.classList.toggle('rona-mobile-menu-visible',open);
    };
    if(drawer.dataset.ronaDesignLockV2Bound!=='1'){
      drawer.dataset.ronaDesignLockV2Bound='1';
      new MutationObserver(sync).observe(drawer,{attributes:true,attributeFilter:['class']});
    }
    sync();
  }

  const apply=()=>{scan(document);bindMenu()};
  apply();
  addEventListener('load',apply,{once:true});
  window.__RONA_MOBILE_DESIGN_LOCK_V2_STATE__={status:'active',scope:'mobile-wip-only',preserveSourceVisuals:true,observerLoopRemoved:true,page,tone};
})();
