const ADMIN_DEALS_SEMANTIC_BUTTONS_V1=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_DEALS_SEMANTIC_BUTTONS_V1__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_DEALS_SEMANTIC_BUTTONS_V1__='20260914-semantic-buttons-v1';
const STYLE_ID='ronaAdminDealsSemanticButtonsV1Style';
function install(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=[
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter{gap:10px!important;padding:10px 11px!important;border-color:rgba(130,210,247,.17)!important;border-radius:15px!important;background:linear-gradient(180deg,rgba(8,24,38,.82),rgba(3,13,22,.74))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 14px 32px rgba(0,0,0,.18)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button{--sb-accent:#63dcff;position:relative;isolation:isolate;overflow:hidden;min-height:40px!important;padding:0 17px 0 34px!important;border:1px solid color-mix(in srgb,var(--sb-accent) 30%,rgba(126,177,207,.20))!important;border-radius:12px!important;background:linear-gradient(180deg,color-mix(in srgb,var(--sb-accent) 12%,rgba(14,35,52,.94)),rgba(5,17,28,.94))!important;color:color-mix(in srgb,var(--sb-accent) 34%,#dceaf2)!important;font-size:12px!important;font-weight:900!important;letter-spacing:.01em!important;text-shadow:0 1px 0 rgba(0,0,0,.4);box-shadow:inset 0 1px 0 rgba(255,255,255,.065),inset 0 -1px 0 rgba(0,0,0,.30),0 7px 18px rgba(0,0,0,.18)!important;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease,color .15s ease,background .15s ease}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button::before{content:"";position:absolute;left:14px;top:50%;width:7px;height:7px;transform:translateY(-50%);border-radius:50%;background:var(--sb-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--sb-accent) 10%,transparent),0 0 13px color-mix(in srgb,var(--sb-accent) 58%,transparent);pointer-events:none}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.055),transparent 30%,transparent 70%,color-mix(in srgb,var(--sb-accent) 8%,transparent));opacity:.9}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button.is-active{--sb-accent:#63dcff}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button.is-attention{--sb-accent:#ffc86f}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button.is-completed{--sb-accent:#58e3bc}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button.is-annulled{--sb-accent:#ff7180}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button:hover{transform:translateY(-2px);color:#fff!important;border-color:color-mix(in srgb,var(--sb-accent) 58%,transparent)!important;background:linear-gradient(180deg,color-mix(in srgb,var(--sb-accent) 18%,rgba(17,42,59,.98)),rgba(6,21,33,.98))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 12px 24px rgba(0,0,0,.25),0 0 18px color-mix(in srgb,var(--sb-accent) 8%,transparent)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button:active{transform:translateY(0);box-shadow:inset 0 2px 5px rgba(0,0,0,.36),0 4px 10px rgba(0,0,0,.18)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button[aria-pressed="true"]{color:#fff!important;border-color:color-mix(in srgb,var(--sb-accent) 72%,transparent)!important;background:linear-gradient(180deg,color-mix(in srgb,var(--sb-accent) 26%,rgba(17,43,61,.98)),color-mix(in srgb,var(--sb-accent) 10%,rgba(5,18,29,.98)))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.10),inset 0 0 0 1px color-mix(in srgb,var(--sb-accent) 24%,transparent),0 11px 26px rgba(0,0,0,.24),0 0 22px color-mix(in srgb,var(--sb-accent) 12%,transparent)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button[aria-pressed="true"]::before{box-shadow:0 0 0 4px color-mix(in srgb,var(--sb-accent) 13%,transparent),0 0 16px color-mix(in srgb,var(--sb-accent) 74%,transparent)}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(1){color:#86e8ff!important;font-weight:900!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(2){color:#ded7ff!important;font-weight:720!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(3){color:#a9ecff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(4){color:#ffd489!important;font-weight:900!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(5){color:#c8ddff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(6){color:#cbbcff!important;font-weight:820!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(7){color:#ffd28a!important;font-weight:850!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(8){color:#9ddcff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(9){color:#8fe3c7!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(10){color:#8ccfff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(3) .rona-fin-pill{color:#a9ecff!important;border-color:rgba(99,220,255,.28)!important;background:rgba(43,139,181,.10)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(4) .rona-fin-pill{color:#ffd489!important;border-color:rgba(255,200,111,.30)!important;background:rgba(167,109,34,.10)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(6) .rona-fin-pill{color:#cbbcff!important;border-color:rgba(179,156,255,.30)!important;background:rgba(105,82,171,.11)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(7) .rona-fin-pill{color:#ffd28a!important;border-color:rgba(255,200,111,.34)!important;background:rgba(174,108,25,.12)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(8) .rona-fin-pill{color:#9ddcff!important;border-color:rgba(101,169,255,.30)!important;background:rgba(52,101,176,.11)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(9) .rona-fin-pill{color:#8fe3c7!important;border-color:rgba(88,227,188,.30)!important;background:rgba(36,139,105,.11)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(10) .rona-fin-pill{color:#8ccfff!important;border-color:rgba(99,180,255,.30)!important;background:rgba(46,111,178,.11)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td:nth-child(11) .rona-fin-pill{font-weight:950!important;box-shadow:0 0 16px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.04)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-open{position:relative;overflow:hidden;min-height:36px!important;padding:0 14px!important;border-radius:10px!important;border-color:rgba(99,220,255,.45)!important;background:linear-gradient(180deg,rgba(48,144,188,.46),rgba(16,66,94,.38))!important;color:#e8fbff!important;font-size:11.5px!important;letter-spacing:.01em!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 9px 20px rgba(0,0,0,.22),0 0 16px rgba(99,220,255,.05)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-open:hover{border-color:rgba(126,232,255,.72)!important;background:linear-gradient(180deg,rgba(57,169,218,.58),rgba(19,83,116,.48))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 13px 28px rgba(0,0,0,.28),0 0 22px rgba(99,220,255,.10)!important}',
    '@media(max-width:720px){html.rona-deals-premium-v1 #page-deals .rona-deal-filter button{min-height:38px!important;padding-left:32px!important}}'
  ].join('');
  document.head.appendChild(s);
}
function apply(){
  const root=document.getElementById('page-deals');
  if(!root)return;
  document.documentElement.classList.add('rona-deals-semantic-buttons-v1');
  root.dataset.ronaDealsSemantic='premium-buttons-v1';
}
let queued=false;
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;install();apply()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:admin-pagechange',schedule);
window.addEventListener('rona:finance-sync',schedule);
const root=document.getElementById('page-deals');
if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
})();
`;
export default ADMIN_DEALS_SEMANTIC_BUTTONS_V1;
