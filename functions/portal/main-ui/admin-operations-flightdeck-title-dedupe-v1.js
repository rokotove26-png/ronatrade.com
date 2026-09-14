export default String.raw`
(()=>{
  if(window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_TITLE_DEDUPE_V1__)return;
  window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_TITLE_DEDUPE_V1__='20260914-canonical-title-only';
  const id='ronaAdminOperationsFlightdeckTitleDedupeV1Style';
  if(!document.getElementById(id)){
    const s=document.createElement('style');
    s.id=id;
    s.textContent=
      '#page-home .rona-flightdeck-v5 .rona-fd-v5__overhead .rona-ops-v4__title{display:none!important}'+
      '#page-home .rona-flightdeck-v5 .rona-fd-v5__overhead{min-height:72px!important;padding:12px 16px 12px 18px!important}'+
      '#page-home .rona-flightdeck-v5 .rona-fd-v5__identity{display:flex!important;align-items:center!important;gap:16px!important;flex-wrap:wrap!important}'+
      '#page-home .rona-flightdeck-v5 .rona-fd-v5__subtitle{margin-top:0!important}'+
      '@media(max-width:720px){#page-home .rona-flightdeck-v5 .rona-fd-v5__overhead{min-height:0!important;padding:12px!important}#page-home .rona-flightdeck-v5 .rona-fd-v5__identity{gap:8px!important}}';
    document.head.appendChild(s);
  }
  const clean=()=>document.querySelectorAll('#page-home .rona-flightdeck-v5 .rona-fd-v5__overhead .rona-ops-v4__title').forEach(n=>n.remove());
  clean();
  const host=document.getElementById('page-home');
  if(host)new MutationObserver(clean).observe(host,{childList:true,subtree:true});
})();
`;