const ADMIN_APPLICATIONS_READABILITY_V5=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_APPLICATIONS_READABILITY_V5__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_APPLICATIONS_READABILITY_V5__='20260914-v5';
const STYLE_ID='ronaAdminApplicationsReadabilityV5Style';
function install(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=[
    /* Second block: exactly double the small operational typography while keeping its frame geometry. */
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*{font-size:20px!important;line-height:1!important;height:42px!important;min-height:42px!important;padding:0 8px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button{font-size:20px!important;line-height:1!important;height:36px!important;min-height:36px!important;padding:0 14px!important}',
    /* Last block: double table/status/action typography; outer queue frame dimensions/border/radius stay untouched. */
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-owner-table{font-size:22px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-owner-table thead th{font-size:17px!important;line-height:1.05!important;padding:6px 10px!important;letter-spacing:.055em!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-owner-table tbody td{font-size:22px!important;line-height:1.08!important;padding:5px 10px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-app-status-chip{font-size:17px!important;line-height:1.05!important;min-height:27px!important;padding:3px 8px!important;letter-spacing:.02em!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-owner-actions button,html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 button[data-rona-app-passport-open]{font-size:19px!important;line-height:1!important;min-height:34px!important;padding:0 12px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-app-price .rona-owner-muted{font-size:20px!important;line-height:1.08!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 td[data-app-col="client"]{white-space:normal!important;max-width:360px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-client-wrap-v5{display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important;overflow:hidden!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;line-height:1.08!important;max-width:360px!important}',
    '@media(max-width:900px){html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*{font-size:18px!important}html.rona-applications-premium-pass3 #page-applications .rona-app-filter button{font-size:18px!important}}'
  ].join('');
  document.head.appendChild(s);
}
let queued=false,wrapping=false;
function wrapClients(){
  queued=false;
  const root=document.getElementById('page-applications');
  if(!root)return;
  wrapping=true;
  try{
    for(const cell of root.querySelectorAll('td[data-app-col="client"]')){
      if(cell.querySelector(':scope>.rona-app-client-wrap-v5'))continue;
      const wrap=document.createElement('span');
      wrap.className='rona-app-client-wrap-v5';
      while(cell.firstChild)wrap.appendChild(cell.firstChild);
      cell.appendChild(wrap);
    }
  }finally{wrapping=false}
}
function schedule(){if(queued)return;queued=true;queueMicrotask(wrapClients)}
install();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:admin-pagechange',schedule);
const root=document.getElementById('page-applications');
if(root)new MutationObserver(mutations=>{
  if(wrapping)return;
  if(mutations.some(m=>m.type==='childList'||(m.type==='attributes'&&m.attributeName==='data-app-col')))schedule();
}).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-app-col']});
})();
`;
export default ADMIN_APPLICATIONS_READABILITY_V5;
