(()=>{
  'use strict';
  if(!matchMedia('(max-width:767px)').matches)return;
  if(window.__RONA_MOBILE_DESIGN_LOCK_V1__)return;
  window.__RONA_MOBILE_DESIGN_LOCK_V1__=true;

  const IDS=new Set(['rona-mobile-outer-v2','rona-mobile-remediation-v2','rona-mobile-home-style-v1']);
  const FORBIDDEN=new Set([
    'background','background-color','background-image','background-size','background-position','background-repeat','background-clip','background-origin','background-attachment','background-blend-mode',
    'border','border-top','border-right','border-bottom','border-left','border-color','border-top-color','border-right-color','border-bottom-color','border-left-color','border-style','border-top-style','border-right-style','border-bottom-style','border-left-style','border-width','border-top-width','border-right-width','border-bottom-width','border-left-width','border-radius','border-start-start-radius','border-start-end-radius','border-end-start-radius','border-end-end-radius',
    'box-shadow','backdrop-filter','-webkit-backdrop-filter','mask','mask-image','-webkit-mask','-webkit-mask-image'
  ]);
  const seenDocs=new WeakSet(),seenFrames=new WeakSet();

  function strip(rule){
    try{
      if(rule.style)for(const prop of [...rule.style])if(FORBIDDEN.has(prop.toLowerCase()))rule.style.removeProperty(prop);
      if(rule.cssRules)for(const child of [...rule.cssRules])strip(child);
    }catch(_){}
  }
  function sanitizeOwner(owner){
    if(!owner||!IDS.has(owner.id||''))return;
    try{if(owner.sheet?.cssRules)for(const rule of [...owner.sheet.cssRules])strip(rule)}catch(_){}
  }
  function bindFrame(frame){
    if(!frame)return;
    const apply=()=>{try{scan(frame.contentDocument)}catch(_){}};
    if(!seenFrames.has(frame)){seenFrames.add(frame);frame.addEventListener('load',apply,{passive:true})}
    apply();
  }
  function scan(doc){
    if(!doc?.documentElement)return;
    doc.querySelectorAll('style[id],link[id][rel~="stylesheet"]').forEach(sanitizeOwner);
    doc.querySelectorAll('iframe').forEach(bindFrame);
    if(seenDocs.has(doc))return;
    seenDocs.add(doc);
    new MutationObserver(()=>{
      doc.querySelectorAll('style[id],link[id][rel~="stylesheet"]').forEach(sanitizeOwner);
      doc.querySelectorAll('iframe').forEach(bindFrame);
    }).observe(doc.documentElement,{childList:true,subtree:true});
  }

  const structural=document.createElement('style');
  structural.id='rona-mobile-design-lock-structural-v1';
  structural.textContent=`
    #rona-mobile-brand:before,#rona-mobile-menu-button:before,#rona-mobile-menu-button:after,#rona-mobile-drawer a.active:before,#rona-mobile-drawer .portal:before{display:none!important}
    #rona-mobile-menu-button span{display:block!important;width:auto!important;height:auto!important;opacity:1!important;color:#fff!important;font:700 28px/1 "Segoe UI Symbol","Segoe UI",Arial,sans-serif!important}
    #rona-mobile-menu-button.open span{opacity:1!important}
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
    const sync=()=>{const open=drawer.classList.contains('open');span.textContent=open?'×':'☰';document.documentElement.classList.toggle('rona-mobile-menu-visible',open)};
    if(drawer.dataset.ronaDesignLockBound!=='1'){
      drawer.dataset.ronaDesignLockBound='1';
      new MutationObserver(sync).observe(drawer,{attributes:true,attributeFilter:['class']});
    }
    sync();
  }
  const apply=()=>{scan(document);bindMenu()};
  apply();
  new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('load',apply,{once:true});
  window.__RONA_MOBILE_DESIGN_LOCK_V1_STATE__={status:'active',scope:'mobile-wip-only'};
})();
