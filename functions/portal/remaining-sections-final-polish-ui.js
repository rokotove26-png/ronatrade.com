const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_REMAINING_FINAL_POLISH__)return;
window.__RONA_REMAINING_FINAL_POLISH__='20260824-1515';
const style=document.createElement('style');
style.id='ronaRemainingFinalPolishStyle';
style.textContent=`
.rona-rs-root[data-kind="clients"],
.rona-rs-root[data-kind="analytics"],
.rona-rs-root[data-kind="news"]{
  width:min(100%,1360px)!important;
  max-width:1360px!important;
  margin-inline:auto!important;
  gap:12px!important;
}
.rona-rs-root[data-kind="clients"] .rona-rs-hero,
.rona-rs-root[data-kind="analytics"] .rona-rs-hero,
.rona-rs-root[data-kind="news"] .rona-rs-hero{
  margin:0!important;
}
.rona-rs-root[data-kind="clients"] .rona-rs-kpis,
.rona-rs-root[data-kind="analytics"] .rona-rs-kpis,
.rona-rs-root[data-kind="news"] .rona-rs-kpis{
  gap:12px!important;
}
.rona-rs-root[data-kind="clients"] .rona-rs-kpi,
.rona-rs-root[data-kind="analytics"] .rona-rs-kpi,
.rona-rs-root[data-kind="news"] .rona-rs-kpi{
  min-height:112px!important;
}
.rona-rs-root[data-kind="clients"]>.rona-rs-controls{
  padding:11px 12px!important;
  border-radius:12px!important;
  background:rgba(255,255,255,.022)!important;
}
.rona-rs-root[data-kind="clients"] .rona-rs-table th,
.rona-rs-root[data-kind="clients"] .rona-rs-table td{
  padding:10px 8px!important;
  line-height:1.35!important;
}
.rona-rs-root[data-kind="clients"] .rona-rs-table th:first-child,
.rona-rs-root[data-kind="clients"] .rona-rs-table td:first-child{
  min-width:230px!important;
}
.rona-rs-root[data-kind="analytics"] .rona-rs-sourcebar,
.rona-rs-root[data-kind="news"] .rona-rs-sourcebar{
  padding:10px 13px!important;
  border-color:rgba(59,130,246,.24)!important;
  background:rgba(59,130,246,.04)!important;
}
.rona-rs-root[data-kind="analytics"] .rona-rs-market-grid{
  grid-template-columns:minmax(0,1.28fr) minmax(300px,.72fr)!important;
  gap:12px!important;
}
.rona-rs-root[data-kind="analytics"] .rona-rs-entry,
.rona-rs-root[data-kind="news"] .rona-rs-entry{
  padding:13px 14px!important;
  border-radius:11px!important;
  background:rgba(255,255,255,.022)!important;
}
.rona-rs-root[data-kind="analytics"] .rona-rs-entry-text,
.rona-rs-root[data-kind="news"] .rona-rs-entry-text{
  line-height:1.5!important;
}
.rona-rs-root[data-kind="news"] .rona-rs-feed{
  gap:9px!important;
}
@media(max-width:1100px){
  .rona-rs-root[data-kind="analytics"] .rona-rs-market-grid{grid-template-columns:1fr!important}
}
@media(max-width:680px){
  .rona-rs-root[data-kind="clients"],
  .rona-rs-root[data-kind="analytics"],
  .rona-rs-root[data-kind="news"]{width:100%!important;max-width:none!important}
}
`;
document.head.append(style);
window.__RONA_REMAINING_FINAL_POLISH_READY__='clients-market-final-v1';
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-remaining-final-polish':'clients-market-final-v1'}})}
