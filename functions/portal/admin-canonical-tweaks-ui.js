const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_ADMIN_CANONICAL_TWEAKS__)return;
window.__RONA_ADMIN_CANONICAL_TWEAKS__='20260825-2115-v6-prices-runtime-refresh';
if(location.pathname!=='/portal/admin')return;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
const PRICES_STRUCTURE='prices-2a-canonical-v4',PRICES_RELOAD_KEY='rona-prices-canonical-v4-runtime-reload',PRICES_LOADER_CONTRACT='/portal/prices-current-ui?v=20260825-1900',PRICES_LEGACY_VERSION_CONTRACT='20260825-1900-v5-prices',PRICES_DATASET_CONTRACT="ronaPricesCurrentLoader='v2'";void PRICES_LOADER_CONTRACT;void PRICES_LEGACY_VERSION_CONTRACT;void PRICES_DATASET_CONTRACT;
function leafByText(root,text,selector='a,button,div,span,strong,h1,h2,h3'){const target=norm(text),xs=qa(selector,root||document).filter(el=>norm(el.textContent)===target);return xs.find(el=>!Array.from(el.children||[]).some(c=>norm(c.textContent)===target))||xs[0]||null}
function findBrand(root=document){return leafByText(root,'RONA Trade','a,div,span,strong,h1,h2')}
function findLogout(root=document){return qa('button,a',root).find(el=>['выход','выйти'].includes(norm(el.textContent)))||q('form[action*="logout"] button',root)}
function findHeader(){const logout=findLogout(),brand=findBrand();for(const seed of [logout,brand]){if(!seed)continue;const direct=seed.closest('header,.topbar,.top-bar,.header,[data-header],[class*="topbar"],[class*="header"]');if(direct)return direct;let p=seed.parentElement;while(p&&p!==document.body){const box=p.getBoundingClientRect();if(findBrand(p)&&findLogout(p)&&box.height>0&&box.height<150)return p;p=p.parentElement}}return q('header,.topbar,.top-bar,.header,[data-header],[class*="topbar"],[class*="header"]')}
function directChild(root,node){let p=node;while(p&&p.parentElement!==root)p=p.parentElement;return p&&p.parentElement===root?p:null}
function commonAncestor(a,b,stop){if(!a||!b)return null;const set=new Set();let p=a;while(p&&p!==stop.parentElement){set.add(p);if(p===stop)break;p=p.parentElement}p=b;while(p&&p!==stop.parentElement){if(set.has(p))return p;if(p===stop)break;p=p.parentElement}return null}
function ensureStyle(){if(q('#ronaAdminCanonicalTweaksStyle'))return;const s=document.createElement('style');s.id='ronaAdminCanonicalTweaksStyle';s.textContent=[
'.rona-admin-ruby-logo{text-shadow:0 0 5px rgba(255,64,104,.82),0 0 14px rgba(210,25,70,.52),0 0 28px rgba(132,0,40,.32)!important}',
'.rona-owner-session-right{position:absolute!important;right:18px!important;left:auto!important;top:50%!important;transform:translateY(-50%)!important;margin:0!important;z-index:24!important;display:flex!important;align-items:center!important;justify-content:flex-end!important}',
'#rona-admin-version-ticker{position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;width:min(46vw,680px)!important;height:24px!important;overflow:hidden!important;pointer-events:none!important;z-index:20!important;mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}',
'#rona-admin-version-ticker .rona-admin-version-track{position:absolute;white-space:nowrap;will-change:transform;color:var(--rv-muted,#9fb4c0);font:750 11px/24px Inter,Arial,sans-serif;letter-spacing:.045em;animation:ronaAdminTicker 16s linear infinite}',
'#rona-owner-build-indicator{display:none!important}',
'@keyframes ronaAdminTicker{from{transform:translateX(100%)}to{transform:translateX(-100%)}}',
'@media(max-width:980px){#rona-admin-version-ticker{width:38vw!important}.rona-owner-session-right{right:12px!important}#rona-admin-version-ticker .rona-admin-version-track{font-size:10px!important}}',
'@media(max-width:720px){#rona-admin-version-ticker{width:32vw!important}.rona-owner-session-right{right:8px!important}}'
].join('');document.head.appendChild(s)}
function headerFix(){const h=findHeader();if(!h)return false;ensureStyle();if(getComputedStyle(h).position==='static')h.style.setProperty('position','relative','important');const brand=findBrand(h);if(brand)brand.classList.add('rona-admin-ruby-logo');const admin=leafByText(h,'Администратор','div,span,strong,button'),logout=findLogout(h);if(admin&&logout){let group=commonAncestor(admin,logout,h);if(group===h||!group)group=directChild(h,admin)||admin.parentElement;const direct=directChild(h,group)||group;if(direct&&direct!==h)direct.classList.add('rona-owner-session-right')}let ticker=q('#rona-admin-version-ticker');if(!ticker){ticker=document.createElement('div');ticker.id='rona-admin-version-ticker';ticker.setAttribute('aria-label','Версия кабинета и состояние подключения');const track=document.createElement('span');track.className='rona-admin-version-track';ticker.appendChild(track);h.appendChild(ticker)}else if(ticker.parentElement!==h)h.appendChild(ticker);return true}
function connectionLabel(){if(window.__RONA_OWNER_ADMIN_ERROR__||window.__RONA_OWNER_AI_SYNC_ERROR__)return'ошибка';if(document.documentElement.dataset.ronaOwnerPaint==='fallback')return'резервный режим';if(window.__RONA_OWNER_ADMIN_READY__===true)return'активно';if(document.body&&document.body.classList.contains('admin-auth-server-verified'))return'устанавливается';return'загрузка'}
function updateTicker(){const t=q('#rona-admin-version-ticker .rona-admin-version-track');if(!t)return;const meta=q('meta[name="rona-ui-build"]')?.content||'',build=String(meta||window.__RONA_UI_BUILD__||'owner-main-v2'),text='Версия кабинета: '+build+'   ·   Подключение: '+connectionLabel();if(t.textContent!==text)t.textContent=text}
function analyticsFix(){for(const h of qa('#rona-analytics-v2 h1,#rona-analytics-v2 h2,#rona-analytics-v2 h3'))if(norm(h.textContent)==='комментарий коммерческого директора')h.textContent='Аналитический вывод'}
function agentsFix(){const root=q('#rona-ca4');if(!root)return;const active=qa('.ca4-tabs button',root).find(b=>b.getAttribute('aria-pressed')==='true');if(!active||norm(active.textContent)!=='агенты')return;const snap=window.__RONA_OWNER_ADMIN_SNAPSHOT__||{},agents=Array.isArray(snap.agents)?snap.agents:[];for(const card of qa('.ca4-grid>.ca4-card',root)){const id=String(q('.ca4-id',card)?.textContent||'').trim(),name=q('.ca4-name',card);if(!id||!name)continue;const rows=agents.filter(a=>String(a.agent_person_id||a.id||'')===id),agent=rows[0],base=String(agent?.agent_name||agent?.display_name||agent?.full_name||name.textContent||'Агент').replace(/\s*\([^)]*\)\s*$/,'').trim(),legalEntities=rows.map(a=>String(a.agent_legal_name||'').trim()).filter(Boolean),unique=Array.from(new Set(legalEntities)),next=unique.length?base+' ('+unique.join(', ')+')':base;if(name.textContent!==next)name.textContent=next}}
function resizeRailMap(){const page=q('#page-monitoring');if(!page||!page.classList.contains('active'))return;for(const canvas of qa('.rona-rail-v81 .rona-rail-v4-map-canvas',page)){const map=canvas.__ronaV81Map;if(map&&typeof map.resize==='function'){try{map.resize();setTimeout(()=>{try{map.resize()}catch(_){}},120)}catch(_){}}}}
function ensurePricesUI(){
 const structure=String(window.__RONA_PRICES_STRUCTURE__||'');
 if(structure===PRICES_STRUCTURE){try{sessionStorage.removeItem(PRICES_RELOAD_KEY)}catch(_){}return}
 const loaded=q('script[data-rona-prices-current-loader]');
 if(window.__RONA_PRICES_CURRENT_UI__||loaded){
   let reloaded=false;
   try{if(sessionStorage.getItem(PRICES_RELOAD_KEY)!=='1'){sessionStorage.setItem(PRICES_RELOAD_KEY,'1');reloaded=true}}catch(_){}
   if(reloaded){location.reload();return}
   if(loaded)loaded.remove();
   window.__RONA_PRICES_CURRENT_UI__=null;window.__RONA_PRICES_STRUCTURE__=null;
   q('#ronaPricesCurrentStyle')?.remove();
 }
 if(q('script[data-rona-prices-current-loader]'))return;
 const s=document.createElement('script');s.src='/portal/prices-current-ui?v=20260825-2055-centered-modal-v4';s.defer=true;s.dataset.ronaPricesCurrentLoader='v4';s.onerror=()=>{window.__RONA_PRICES_CURRENT_LOADER_ERROR__='LOAD_FAILED'};document.body.appendChild(s)
}
function apply(){headerFix();updateTicker();analyticsFix();agentsFix();resizeRailMap();ensurePricesUI()}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
document.addEventListener('click',ev=>{const nav=ev.target?.closest?.('#nav button[data-page]');if(nav?.dataset.page==='monitoring')[0,120,360,900,1800,3200].forEach(ms=>setTimeout(resizeRailMap,ms));if(nav?.dataset.page==='access'||nav?.dataset.page==='analytics'||nav?.dataset.page==='prices')[0,80,240,700].forEach(ms=>setTimeout(schedule,ms))},true);
window.addEventListener('resize',()=>setTimeout(resizeRailMap,80),{passive:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
setInterval(()=>{headerFix();updateTicker();analyticsFix();agentsFix();ensurePricesUI()},1000);
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-admin-canonical-tweaks':'20260825-2115-v6-prices-runtime-refresh'}})}