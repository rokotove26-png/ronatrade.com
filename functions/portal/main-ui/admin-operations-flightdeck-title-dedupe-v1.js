export default String.raw`
(()=>{
  if(window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_TITLE_DEDUPE_V1__)return;
  window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_TITLE_DEDUPE_V1__='20260915-dom-dedupe-only';
  const clean=()=>document.querySelectorAll('#page-home .rona-flightdeck-v5 .rona-fd-v5__overhead .rona-ops-v4__title').forEach(n=>n.remove());
  clean();
  const host=document.getElementById('page-home');
  if(host&&!window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_TITLE_DEDUPE_OBSERVER__){
    const observer=new MutationObserver(clean);
    observer.observe(host,{childList:true,subtree:true});
    window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_TITLE_DEDUPE_OBSERVER__=observer;
  }
})();
`;
