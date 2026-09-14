const ADMIN_DEALS_SEMANTIC_CORRECTIONS_V1=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_DEALS_SEMANTIC_CORRECTIONS_V1__==='20260914-live-dom-bind-v3')return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_DEALS_SEMANTIC_CORRECTIONS_V1__='20260914-live-dom-bind-v3';
const STYLE_ID='ronaAdminDealsSemanticCorrectionsV1Style';
const ROOT_ID='page-deals';
function norm(v){return String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU')}
function toneFor(text){
  const t=norm(text);
  if(t.includes('требует'))return'attention';
  if(t.includes('заверш'))return'completed';
  if(t.includes('аннулир'))return'annulled';
  if(t.includes('актив'))return'active';
  return'';
}
function findStatusControls(root){
  const buttons=Array.from(root.querySelectorAll('button,[role="button"]')).filter(x=>toneFor(x.textContent));
  const byTone={};
  for(const b of buttons){const tone=toneFor(b.textContent);if(tone&&!byTone[tone])byTone[tone]=b}
  const ordered=['active','attention','completed','annulled'].map(k=>byTone[k]).filter(Boolean);
  if(ordered.length!==4)return null;
  let host=ordered[0].parentElement;
  while(host&&host!==root&&!ordered.every(b=>host.contains(b)))host=host.parentElement;
  if(!host||host===root)return null;
  host.classList.add('rona-deal-filter-live-v3');
  host.dataset.ronaDealFilterBound='live-v3';
  for(const b of ordered){
    b.classList.remove('is-active','is-attention','is-completed','is-annulled');
    const tone=toneFor(b.textContent);
    b.classList.add('is-'+tone);
    b.dataset.ronaDealSemantic=tone;
  }
  return host;
}
function findDealTable(root){
  const tables=Array.from(root.querySelectorAll('table'));
  const table=tables.find(t=>{const h=norm(t.querySelector('thead')?.textContent);return h.includes('deal')&&h.includes('клиент')&&h.includes('продукт')})||tables.find(t=>norm(t.textContent).includes('deal-'));
  if(!table)return null;
  table.classList.add('rona-deal-table-live-v3');
  table.dataset.ronaDealTableBound='live-v3';
  return table;
}
function install(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;s.textContent=[
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;align-items:stretch!important;margin:0 0 15px!important;padding:10px!important;border:1px solid rgba(126,204,241,.18)!important;border-radius:16px!important;background:linear-gradient(180deg,rgba(7,21,34,.88),rgba(3,13,22,.82))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 16px 38px rgba(0,0,0,.18)!important;backdrop-filter:blur(16px) saturate(125%);-webkit-backdrop-filter:blur(16px) saturate(125%)}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3>button,html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3>[role="button"]{--live-accent:#63dcff;position:relative;isolation:isolate;overflow:hidden;width:100%!important;min-height:56px!important;padding:0 18px 0 36px!important;border:1px solid color-mix(in srgb,var(--live-accent) 42%,rgba(126,177,207,.20))!important;border-radius:13px!important;background:radial-gradient(180px 90px at 100% 0,color-mix(in srgb,var(--live-accent) 17%,transparent),transparent 72%),linear-gradient(180deg,rgba(15,35,52,.97),rgba(5,17,28,.97))!important;color:color-mix(in srgb,var(--live-accent) 38%,#e8f3f8)!important;font-size:13px!important;line-height:1.15!important;font-weight:900!important;letter-spacing:.005em!important;text-align:left!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.075),inset 0 -1px 0 rgba(0,0,0,.32),0 10px 24px rgba(0,0,0,.18),0 0 0 1px color-mix(in srgb,var(--live-accent) 5%,transparent)!important;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,filter .16s ease,color .16s ease!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3>button::before,html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3>[role="button"]::before{content:""!important;position:absolute!important;left:15px!important;top:50%!important;width:8px!important;height:8px!important;transform:translateY(-50%)!important;border-radius:999px!important;background:var(--live-accent)!important;box-shadow:0 0 0 4px color-mix(in srgb,var(--live-accent) 10%,transparent),0 0 15px color-mix(in srgb,var(--live-accent) 65%,transparent)!important;pointer-events:none!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3>.is-active{--live-accent:#63dcff}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3>.is-attention{--live-accent:#ffc86f}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3>.is-completed{--live-accent:#58e3bc}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3>.is-annulled{--live-accent:#ff7180}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3>button:hover,html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3>[role="button"]:hover{transform:translateY(-2px)!important;filter:brightness(1.08);border-color:color-mix(in srgb,var(--live-accent) 70%,transparent)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 15px 31px rgba(0,0,0,.24),0 0 24px color-mix(in srgb,var(--live-accent) 12%,transparent)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3>button[aria-pressed="true"],html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3>[role="button"][aria-pressed="true"]{color:#fff!important;border-color:color-mix(in srgb,var(--live-accent) 82%,transparent)!important;background:radial-gradient(220px 100px at 100% 0,color-mix(in srgb,var(--live-accent) 26%,transparent),transparent 68%),linear-gradient(180deg,color-mix(in srgb,var(--live-accent) 18%,rgba(15,35,52,.99)),rgba(5,17,28,.99))!important;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--live-accent) 32%,transparent),inset 0 1px 0 rgba(255,255,255,.12),0 14px 34px rgba(0,0,0,.24),0 0 26px color-mix(in srgb,var(--live-accent) 15%,transparent)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 thead th{position:relative!important;font-weight:900!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 thead th::after{content:"";position:absolute;left:10px;right:10px;bottom:0;height:2px;border-radius:999px;background:currentColor;opacity:.38}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 thead th:nth-child(1){color:#86e8ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 thead th:nth-child(2){color:#d2c8ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 thead th:nth-child(3){color:#a9ecff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 thead th:nth-child(4){color:#ffd489!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 thead th:nth-child(5){color:#cbbcff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 thead th:nth-child(6){color:#ffd28a!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 thead th:nth-child(7){color:#9ddcff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 thead th:nth-child(8){color:#8fe3c7!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 thead th:nth-child(9){color:#8ccfff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 thead th:nth-child(10){color:#f0c7ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 tbody td:nth-child(2){color:#d7cdff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 tbody td:nth-child(3){color:#b9efff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 tbody td:nth-child(4){color:#ffd58e!important;font-weight:850!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 tbody td:nth-child(5){color:#cabaff!important;font-weight:820!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 tbody td:nth-child(6){color:#ffd28a!important;font-weight:850!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 tbody td:nth-child(7){color:#a9ddff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 tbody td:nth-child(8){color:#9ce9cf!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table-live-v3 tbody td:nth-child(9){color:#9bd2ff!important}',
    '@media(max-width:1100px){html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3{grid-template-columns:repeat(2,minmax(0,1fr))!important}}',
    '@media(max-width:620px){html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3{grid-template-columns:1fr!important}html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3>button,html.rona-deals-premium-v1 #page-deals .rona-deal-filter-live-v3>[role="button"]{min-height:50px!important}}'
  ].join('');document.head.appendChild(s);
}
function bind(){
  const root=document.getElementById(ROOT_ID);if(!root)return false;
  document.documentElement.classList.add('rona-deals-premium-v1');
  findStatusControls(root);findDealTable(root);
  return true;
}
install();bind();
let queued=false;
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;bind()})}
const root=document.getElementById(ROOT_ID);
if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
window.addEventListener('rona:admin-pagechange',ev=>{if(ev?.detail?.page==='deals')[0,60,180,420].forEach(ms=>setTimeout(schedule,ms))});
document.addEventListener('click',ev=>{if(ev.target?.closest?.('#nav [data-page="deals"]'))[0,60,180,420].forEach(ms=>setTimeout(schedule,ms))},true);
})();
`;
export default ADMIN_DEALS_SEMANTIC_CORRECTIONS_V1;
