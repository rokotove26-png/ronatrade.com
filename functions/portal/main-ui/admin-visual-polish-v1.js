const ADMIN_VISUAL_POLISH_V1=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_VISUAL_POLISH_V1__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_VISUAL_POLISH_V1__='20260912-v2';
const s=document.createElement('style');
s.id='ronaAdminVisualPolishV1Style';
s.textContent=''
+'/* Home: canonical operations command center is the single visual page hero. */'
+'.rona-admin-redesign-v1 #page-home .rona-admin-dashboard__hero{display:none!important}'
+'.rona-admin-redesign-v1 #page-home .rona-admin-visual-duplicate-hero{display:none!important}'
+'.rona-admin-redesign-v1 #page-home .rona-admin-dashboard{gap:14px!important;padding-top:0!important}'
+'.rona-admin-redesign-v1 #page-home .rona-ops-v4__commandbar{margin-top:0!important}'
+'/* Canonical current Deals owner: keep dense data, but give it the same surface hierarchy as the redesigned Admin. */'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deals-owned{display:grid;gap:14px}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-kpi-grid{grid-template-columns:repeat(6,minmax(0,1fr));gap:9px;margin:0!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-kpi{position:relative;overflow:hidden;min-height:116px!important;padding:16px 16px 14px!important;border:1px solid var(--ra-line)!important;border-radius:16px!important;background:linear-gradient(155deg,rgba(14,32,52,.92),rgba(8,20,35,.96))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 12px 30px rgba(0,7,18,.10)!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-kpi:before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:2px;border-radius:5px;background:var(--ra-cyan)}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-kpi--active:before{background:var(--ra-cyan)}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-kpi--attention:before,.rona-admin-redesign-v1 #page-deals .rona-current-deal-kpi--waiting:before{background:var(--ra-amber)}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-kpi--complete:before{background:var(--ra-green)}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-kpi--total:before{background:rgba(148,170,187,.7)}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-kpi h2{padding:0!important;border:0!important;font-size:10px!important;font-weight:900!important;letter-spacing:.065em!important;text-transform:uppercase;color:rgba(183,215,233,.62)!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-kpi .rona-owner-kpi{margin-top:12px;font-size:29px!important;line-height:1!important;font-weight:950!important;letter-spacing:-.035em;color:#f5fbff}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-kpi .rona-owner-muted{margin-top:8px;font-size:9px!important;line-height:1.35;color:rgba(184,215,233,.48)!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-filter{display:flex;gap:5px;width:max-content;max-width:100%;margin:0!important;padding:5px;border:1px solid var(--ra-line)!important;border-radius:14px;background:rgba(5,13,22,.72);overflow:auto;flex-wrap:nowrap!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-filter button{min-height:36px;padding:0 13px!important;border:0!important;border-radius:10px!important;background:transparent!important;color:var(--ra-muted)!important;font-size:11px!important;font-weight:850!important;white-space:nowrap;box-shadow:none!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-filter button:hover{color:#fff!important;background:rgba(97,216,255,.055)!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-filter button[aria-pressed="true"]{color:#fff!important;background:rgba(97,216,255,.095)!important;box-shadow:inset 0 0 0 1px rgba(97,216,255,.18)!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-filter .is-attention[aria-pressed="true"]{background:rgba(245,158,11,.075)!important;box-shadow:inset 0 0 0 1px rgba(251,191,36,.2)!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-filter .is-completed[aria-pressed="true"]{background:rgba(34,197,94,.07)!important;box-shadow:inset 0 0 0 1px rgba(74,222,128,.18)!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-filter .is-annulled[aria-pressed="true"]{background:rgba(225,29,72,.065)!important;box-shadow:inset 0 0 0 1px rgba(251,113,133,.18)!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-queue{padding:0!important;border:1px solid var(--ra-line)!important;border-radius:20px!important;background:linear-gradient(155deg,var(--ra-surface-2),var(--ra-surface))!important;overflow:hidden;box-shadow:0 14px 36px rgba(0,7,18,.12)!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-queue>h2{margin:0!important;padding:19px 20px 15px!important;border-bottom:1px solid rgba(128,191,222,.105)!important;font-size:18px!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-table-wrap{padding:7px 12px 14px!important;overflow:auto!important;scrollbar-color:rgba(97,216,255,.22) transparent}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-table{border-collapse:separate!important;border-spacing:0 6px!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-table thead th{padding:7px 9px!important;border:0!important;color:rgba(183,215,233,.54)!important;font-size:9px!important;font-weight:900!important;letter-spacing:.075em!important;text-transform:uppercase!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-table tbody td{padding:11px 9px!important;border-top:1px solid rgba(128,191,222,.11)!important;border-bottom:1px solid rgba(128,191,222,.11)!important;background:rgba(10,24,40,.74)!important;color:#dfeaf1!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-table tbody td:first-child{border-left:1px solid rgba(128,191,222,.11)!important;border-radius:12px 0 0 12px!important;box-shadow:inset 2px 0 0 rgba(97,216,255,.48);font-weight:950;color:#f4fbff!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-table tbody td:last-child{border-right:1px solid rgba(128,191,222,.11)!important;border-radius:0 12px 12px 0!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-company{color:#f0f7fb!important;font-weight:780!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-main{color:#e9f4fa!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-fin-pill{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:24px!important;padding:3px 8px!important;border-radius:999px!important;font-size:9px!important;font-weight:850!important;line-height:1.2!important}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-open{min-height:32px!important;padding:0 11px!important;border:1px solid rgba(97,216,255,.3)!important;border-radius:9px!important;background:rgba(56,189,248,.07)!important;color:#dff6ff!important;font-size:10px!important;font-weight:900!important;transition:transform .14s ease,border-color .14s ease,background .14s ease}'
+'.rona-admin-redesign-v1 #page-deals .rona-current-deal-open:hover{transform:translateY(-1px);border-color:rgba(97,216,255,.5)!important;background:rgba(56,189,248,.115)!important}'
+'/* Current Deal drawer is an operational object, not a generic modal. */'
+'.rona-admin-redesign-v1 .rona-current-deal-drawer-layer{background:rgba(1,7,14,.68)!important;backdrop-filter:blur(6px)!important}'
+'.rona-admin-redesign-v1 .rona-current-deal-drawer{border-left:1px solid rgba(97,216,255,.18)!important;background:linear-gradient(180deg,rgba(7,18,31,.995),rgba(5,14,25,.995))!important;box-shadow:-28px 0 84px rgba(0,5,14,.5)!important}'
+'.rona-admin-redesign-v1 .rona-current-deal-drawer-head{padding:17px 20px!important;border-bottom:1px solid rgba(128,191,222,.13)!important;background:rgba(8,20,34,.985)!important}'
+'.rona-admin-redesign-v1 .rona-current-deal-drawer-head>strong{font-size:18px!important;font-weight:950!important;letter-spacing:-.015em!important}'
+'.rona-admin-redesign-v1 .rona-current-deal-drawer-body{padding:18px 20px 26px!important}'
+'.rona-admin-redesign-v1 .rona-current-deal-drawer .rona-owner-card{border:1px solid rgba(128,191,222,.13)!important;border-radius:15px!important;background:rgba(11,26,43,.8)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.02)!important}'
+'.rona-admin-redesign-v1 .rona-current-deal-drawer .rona-current-deal-actions{gap:7px!important;padding-top:4px}'
+'.rona-admin-redesign-v1 .rona-current-deal-drawer .rona-current-deal-actions button{min-height:35px!important;border-radius:9px!important;background:rgba(255,255,255,.025)!important;font-size:10px!important}'
+'.rona-admin-redesign-v1 .rona-current-deal-drawer .rona-current-deal-primary{border-color:rgba(74,222,128,.3)!important;background:rgba(34,197,94,.075)!important;color:#d7f9e1!important}'
+'.rona-admin-redesign-v1 .rona-current-deal-drawer .rona-current-deal-danger{border-color:rgba(251,113,133,.3)!important;background:rgba(225,29,72,.065)!important;color:#ffd6dc!important}'
+'@media(max-width:1440px){.rona-admin-redesign-v1 #page-deals .rona-current-deal-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}'
+'@media(max-width:1180px){.rona-admin-redesign-v1 #page-deals .rona-current-deal-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}'
+'@media(prefers-reduced-motion:reduce){.rona-admin-redesign-v1 #page-deals .rona-current-deal-open{transition:none!important}}';
document.head.appendChild(s);

function dedupeHomeHero(){
  const page=document.getElementById('page-home'),canonical=page?.querySelector('.rona-ops-v4__commandbar');
  if(!page||!canonical)return;
  const canonicalTitle=String(canonical.querySelector('h1')?.textContent||'').replace(/\s+/g,' ').trim();
  if(!canonicalTitle)return;
  const candidates=Array.from(page.querySelectorAll('section,header,div'));
  for(const node of candidates){
    if(node===canonical||node.contains(canonical)||canonical.contains(node))continue;
    const h1=node.querySelector(':scope > h1, :scope > div > h1');
    if(!h1||String(h1.textContent||'').replace(/\s+/g,' ').trim()!==canonicalTitle)continue;
    if(node.compareDocumentPosition(canonical)&Node.DOCUMENT_POSITION_FOLLOWING){
      node.classList.add('rona-admin-visual-duplicate-hero');
      node.dataset.ronaVisualDuplicateHero='hidden';
    }
  }
}
let queued=false;
function scheduleDedupe(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;dedupeHomeHero()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleDedupe,{once:true});else scheduleDedupe();
const home=document.getElementById('page-home');
if(home)new MutationObserver(scheduleDedupe).observe(home,{childList:true,subtree:true});
window.addEventListener('rona:admin-pagechange',scheduleDedupe);
})();
`;

export default ADMIN_VISUAL_POLISH_V1;
