const ADMIN_VISUAL_REVISION_V2_POLISH=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_VISUAL_REVISION_V2_POLISH__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_VISUAL_REVISION_V2_POLISH__='20260912-v2.1';
const STYLE_ID='ronaAdminVisualRevisionV2PolishStyle';
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;
  s.textContent=''
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-applications,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals{background:radial-gradient(980px 390px at 10% -8%,rgba(234,241,246,.21),transparent 62%),radial-gradient(820px 360px at 91% 1%,rgba(171,190,204,.18),transparent 68%),linear-gradient(132deg,#35424d 0%,#202d37 47%,#2b3944 100%)!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home>.rona-owner-page-content,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-applications>.rona-owner-page-content,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals>.rona-owner-page-content{padding-top:22px!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home #ronaAdminV2HomeTitle{display:flex!important;visibility:visible!important;opacity:1!important;min-height:58px!important;align-items:flex-end!important;margin:0 0 16px!important;padding:0 3px!important;position:relative!important;z-index:3!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home #ronaAdminV2HomeTitle h1{display:block!important;visibility:visible!important;opacity:1!important;margin:0!important;color:#fff!important;font-size:48px!important;line-height:.94!important;font-weight:950!important;letter-spacing:-.052em!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 .rona-admin-v2-hero{position:relative!important;overflow:hidden!important;border:1px solid rgba(244,248,251,.28)!important;border-radius:24px!important;background:radial-gradient(650px 250px at 91% -30%,rgba(255,255,255,.28),transparent 61%),linear-gradient(128deg,rgba(125,140,152,.96) 0%,rgba(75,91,103,.98) 49%,rgba(39,53,64,.99) 100%)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.24),inset 0 -1px 0 rgba(0,0,0,.20),0 24px 54px rgba(0,7,14,.18)!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 .rona-admin-v2-hero:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.13) 0%,rgba(255,255,255,.035) 24%,transparent 45%,rgba(255,255,255,.035) 72%,transparent 100%)}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 .rona-admin-v2-hero h1{position:relative;z-index:1;font-size:48px!important;line-height:.98!important;font-weight:950!important;letter-spacing:-.048em!important;color:#fff!important;text-shadow:0 1px 0 rgba(255,255,255,.08),0 7px 22px rgba(0,0,0,.18)!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 .rona-admin-v2-hero p,.rona-admin-redesign-v1.rona-admin-visual-v2 .rona-admin-v2-hero .rona-owner-muted{position:relative;z-index:1;color:rgba(242,247,250,.82)!important;font-size:13.5px!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home .rona-ops-v4__commandbar{background:radial-gradient(650px 240px at 86% -24%,rgba(255,255,255,.24),transparent 61%),linear-gradient(128deg,rgba(112,127,139,.97),rgba(66,82,94,.98) 52%,rgba(36,50,61,.99))!important;border-color:rgba(241,247,250,.27)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),inset 0 -1px 0 rgba(0,0,0,.2),0 24px 52px rgba(0,7,14,.16)!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home .rona-ops-v4__title{font-size:44px!important;line-height:.98!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home .rona-ops-v4-metric,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home .rona-home-kpis>.rona-owner-card,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-current-deal-kpi{border-color:rgba(238,245,249,.27)!important;background:radial-gradient(360px 150px at 15% -8%,rgba(255,255,255,.18),transparent 62%),linear-gradient(145deg,rgba(101,115,126,.97),rgba(60,75,87,.98) 55%,rgba(38,51,62,.99))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.21),inset 0 -1px 0 rgba(0,0,0,.18),0 15px 34px rgba(0,7,14,.13)!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home .rona-ops-v4-metric__value,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home .rona-home-kpis .rona-owner-kpi{font-size:42px!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-current-deal-kpi .rona-owner-kpi{font-size:38px!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home .rona-ops-v4-panel,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home .rona-owner-card,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-applications .rona-owner-card,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-owner-card,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-current-deal-queue{border-color:rgba(232,240,246,.23)!important;background:radial-gradient(520px 180px at 8% -8%,rgba(255,255,255,.13),transparent 64%),linear-gradient(148deg,rgba(79,93,104,.97),rgba(51,65,76,.98) 58%,rgba(34,47,57,.99))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -1px 0 rgba(0,0,0,.18),0 18px 40px rgba(0,7,14,.14)!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-applications .rona-app-filter,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-current-deal-filter{border-color:rgba(234,242,247,.25)!important;background:linear-gradient(180deg,rgba(87,101,112,.92),rgba(52,66,77,.96))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 10px 24px rgba(0,7,14,.11)!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-applications .rona-app-filter button.active,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-applications .rona-app-filter button[aria-pressed="true"],.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-current-deal-filter button[aria-pressed="true"]{background:linear-gradient(135deg,rgba(188,201,211,.38),rgba(112,132,147,.42))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.23),inset 0 0 0 1px rgba(238,245,249,.25),0 6px 14px rgba(0,0,0,.09)!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-applications .rona-owner-table thead tr,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-owner-table thead tr,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-current-deal-table thead tr{background:linear-gradient(180deg,rgba(69,84,95,.98),rgba(45,58,68,.99))!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-applications .rona-owner-table thead th,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-owner-table thead th,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-current-deal-table thead th{background:transparent!important;color:rgba(238,244,248,.76)!important;border-top:1px solid rgba(238,245,249,.14)!important;border-bottom:1px solid rgba(0,0,0,.18)!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-applications .rona-owner-table tbody td,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-owner-table tbody td,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-current-deal-table tbody td{background:linear-gradient(102deg,rgba(91,105,116,.96),rgba(61,75,86,.97) 54%,rgba(45,58,69,.98))!important;border-top-color:rgba(239,245,249,.20)!important;border-bottom-color:rgba(239,245,249,.16)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.075)!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-applications [data-rona-col="application-id"],.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals [data-rona-col="deal-id"],.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-current-deal-table tbody td:first-child{font-size:14px!important;font-weight:950!important;color:#fff!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-applications td[data-rona-col="client"],.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals td[data-rona-col="client"],.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-current-deal-company{font-size:13.5px!important;font-weight:900!important}'
  +'.rona-admin-redesign-v1.rona-admin-visual-v2 #page-applications td[data-rona-col="quantity"],.rona-admin-redesign-v1.rona-admin-visual-v2 #page-applications td[data-rona-col="value"],.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals td[data-rona-col="quantity"],.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals td[data-rona-col="value"]{font-size:13.5px!important;font-weight:950!important}'
  +'@media(max-width:1440px){.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home #ronaAdminV2HomeTitle h1{font-size:44px!important}.rona-admin-redesign-v1.rona-admin-visual-v2 .rona-admin-v2-hero h1{font-size:44px!important}.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home .rona-ops-v4__title{font-size:40px!important}.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home .rona-ops-v4-metric__value,.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home .rona-home-kpis .rona-owner-kpi{font-size:39px!important}.rona-admin-redesign-v1.rona-admin-visual-v2 #page-deals .rona-current-deal-kpi .rona-owner-kpi{font-size:35px!important}}'
  +'@media(max-width:1180px){.rona-admin-redesign-v1.rona-admin-visual-v2 #page-home #ronaAdminV2HomeTitle h1{font-size:40px!important}.rona-admin-redesign-v1.rona-admin-visual-v2 .rona-admin-v2-hero h1{font-size:40px!important}}';
  document.head.appendChild(s);
}
function ensureHomeTitle(){
  const page=document.getElementById('page-home');if(!page)return;
  const host=page.querySelector(':scope > .rona-owner-page-content')||page;
  let title=document.getElementById('ronaAdminV2HomeTitle');
  if(!title){title=document.createElement('header');title.id='ronaAdminV2HomeTitle';title.className='rona-admin-v2-page-title';title.dataset.ronaVisualPresentation='home-title-v2';const h=document.createElement('h1');h.textContent='Главная';title.appendChild(h)}
  if(title.parentElement!==host)host.prepend(title);else if(host.firstElementChild!==title)host.prepend(title);
}
function markHero(id,titleText){
  const page=document.getElementById('page-'+id);if(!page)return;
  const h=Array.from(page.querySelectorAll('h1')).find(x=>String(x.textContent||'').trim()===titleText);if(!h)return;
  let node=h.parentElement,candidate=node;
  while(node&&node!==page&&!node.classList.contains('rona-owner-page-content')){
    const hasWork=node.querySelector('.rona-admin-metric,.rona-current-deal-kpi,.rona-app-filter,.rona-current-deal-filter,.rona-owner-table,.rona-current-deal-table,table');
    if(!hasWork&&node.querySelectorAll('h1').length===1&&node.querySelectorAll('button').length<=2)candidate=node;
    node=node.parentElement;
  }
  candidate?.classList.add('rona-admin-v2-hero');
}
function apply(){installStyle();ensureHomeTitle();markHero('applications','Заявки');markHero('deals','Сделки')}
let queued=false;function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;apply()})}
installStyle();apply();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
window.addEventListener('rona:admin-pagechange',schedule);
for(const id of ['page-home','page-applications','page-deals']){const node=document.getElementById(id);if(node)new MutationObserver(schedule).observe(node,{childList:true,subtree:true})}
})();
`;

export default ADMIN_VISUAL_REVISION_V2_POLISH;
