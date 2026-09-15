(()=>{'use strict';
if(window.__RONA_ADMIN_RUNTIME_WATCHDOG__)return;
window.__RONA_ADMIN_RUNTIME_WATCHDOG__='page-aware-v9-radio-heading-owned';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const state=window.__RONA_ADMIN_RUNTIME_RECOVERY__={version:'page-aware-v9-radio-heading-owned',status:'BOOTING',pageAttempts:Object.create(null),events:[],lastError:null};
let running=false,timer=null,marketNewsRecoveryLoading=false,radioHeadingObserver=null,radioHeadingTimer=null;
function note(stage,error){const item={stage:String(stage),error:String(error?.message||error||'UNKNOWN'),at:new Date().toISOString()};state.lastError=item;state.events.push(item);if(state.events.length>30)state.events.shift();console.warn('[RONA Admin watchdog]',item.stage,item.error)}
function selected(){try{const f=window.__RONA_ADMIN_SELECTED_PAGE__;if(typeof f==='function'){const p=f();if(p)return String(p)}}catch(_){ }return String(document.documentElement.dataset.ronaAdminPage||'home')}
function pageNode(p){return document.getElementById('page-'+p)}
function marketNewsRoot(){const n=pageNode('market-news');return n?.querySelector(':scope > #rona-market-news-current.rona-market-news-current')||null}
function marketNewsReady(){const root=marketNewsRoot();return !!(root&&window.__RONA_MARKET_NEWS_CURRENT_V1__&&root.querySelector(':scope > .mn-masthead')&&root.querySelector(':scope > .mn-toolbar')&&root.querySelector(':scope > .mn-statusline')&&root.querySelector(':scope > main'))}
function ready(p){const n=pageNode(p);if(!n)return false;if(p==='home')return window.__RONA_OWNER_ADMIN_READY__===true&&!!n.querySelector(':scope > .rona-owner-page-content')&&!n.querySelector(':scope > .current-loading:not(.rona-owner-original-hidden)');if(p==='access')return !!n.querySelector('#rona-ca4 [data-rona-create-access="primary"]');if(p==='claims')return !!n.querySelector(':scope > .rona-claims-r2-root');if(p==='monitoring')return !!n.querySelector('[data-rail-current-v4="ready"],[data-rail-current-root]');if(p==='agent-settlements')return !!n.querySelector(':scope > .rona-rs-root[data-kind="rewards"]');if(p==='messages')return !!n.querySelector(':scope > .rona-rs-root[data-kind="radio"]');if(p==='analytics')return !!n.querySelector('#rona-analytics-v2 .an2-head')&&!!n.querySelector('#rona-analytics-v2 .an2-controls')&&!!n.querySelector('#rona-analytics-v2 .an2-main');if(p==='market-news')return marketNewsReady();if(p==='prices')return n.children.length>0&&!n.querySelector(':scope > .current-loading');return true}
function moduleFor(p){if(p==='home')return'main';if(p==='access')return'clients-agents-current';if(p==='claims')return'claims';if(p==='monitoring')return'rail';if(p==='analytics')return'analytics';if(p==='market-news')return'market-news-current';if(['agent-settlements','messages'].includes(p))return'remaining';if(p==='prices')return'prices';return''}
function clearError(p){pageNode(p)?.querySelector(':scope > .rona-module-error')?.remove()}
function ensureRadioHeadingStyle(){if(document.getElementById('rona-radio-clean-head-owned-style'))return;const s=document.createElement('style');s.id='rona-radio-clean-head-owned-style';s.textContent=`
#page-messages>.rona-rs-root[data-kind="radio"]>.rona-radio-clean-head{width:100%!important;max-width:none!important;margin:4px 0 0!important;padding:0 2px 3px!important;box-sizing:border-box!important;display:flex!important;align-items:flex-end!important;justify-content:space-between!important;gap:24px!important;grid-column:1/-1!important;background:none!important;background-image:none!important;border:0!important;box-shadow:none!important;filter:none!important;position:relative!important;overflow:visible!important;z-index:2!important}
#page-messages>.rona-rs-root[data-kind="radio"]>.rona-radio-clean-head:before,#page-messages>.rona-rs-root[data-kind="radio"]>.rona-radio-clean-head:after,#page-messages>.rona-rs-root[data-kind="radio"]>.rona-radio-clean-head>*:before,#page-messages>.rona-rs-root[data-kind="radio"]>.rona-radio-clean-head>*:after{display:none!important;content:none!important}
#page-messages>.rona-rs-root[data-kind="radio"]>.rona-radio-clean-head .rona-radio-clean-title{margin:0!important;padding:0!important;font-size:28px!important;line-height:1.05!important;font-weight:900!important;letter-spacing:-.04em!important;color:#f7fbff!important;background:none!important;background-image:none!important;border:0!important;box-shadow:none!important;filter:none!important;text-shadow:0 3px 24px rgba(79,211,255,.10)!important}
#page-messages>.rona-rs-root[data-kind="radio"]>.rona-radio-clean-head .rona-radio-clean-sub{margin:0 0 3px!important;padding:0!important;max-width:520px!important;font-size:11.5px!important;line-height:1.45!important;color:#7895a6!important;text-align:right!important;background:none!important;background-image:none!important;border:0!important;box-shadow:none!important;filter:none!important}
@media(max-width:640px){#page-messages>.rona-rs-root[data-kind="radio"]>.rona-radio-clean-head{align-items:flex-start!important;flex-direction:column!important;gap:6px!important}#page-messages>.rona-rs-root[data-kind="radio"]>.rona-radio-clean-head .rona-radio-clean-sub{text-align:left!important}}
`;document.head.appendChild(s)}
function ensureRadioHeading(){const host=pageNode('messages');const root=host?.querySelector(':scope > .rona-rs-root[data-kind="radio"]');if(!host||!root)return;ensureRadioHeadingStyle();host.querySelector(':scope > .rona-radio-clean-head')?.remove();let head=root.querySelector(':scope > .rona-radio-clean-head');if(!head){head=document.createElement('div');head.className='rona-radio-clean-head';const title=document.createElement('h1');title.className='rona-radio-clean-title';title.textContent='Радиорубка';const sub=document.createElement('div');sub.className='rona-radio-clean-sub';sub.textContent='Оперативные сообщения, уведомления и объявления клиентам и агентам.';head.append(title,sub);root.prepend(head)}else if(root.firstElementChild!==head){root.prepend(head)}}
function scheduleRadioHeading(ms=50){clearTimeout(radioHeadingTimer);radioHeadingTimer=setTimeout(ensureRadioHeading,ms)}
function observeRadioHeading(){const host=pageNode('messages');if(!host||radioHeadingObserver)return;radioHeadingObserver=new MutationObserver(()=>{if(selected()==='messages')scheduleRadioHeading(35)});radioHeadingObserver.observe(host,{childList:true,subtree:true})}
function activateMarketNews(source='watchdog-content-repair'){if(selected()!=='market-news')return;window.dispatchEvent(new CustomEvent('rona:admin-pagechange',{detail:{page:'market-news',source}}))}
function retryMarketNews(){
  if(marketNewsRecoveryLoading||marketNewsReady())return;
  if(window.__RONA_MARKET_NEWS_CURRENT_V1__&&marketNewsRoot()){activateMarketNews('watchdog-content-repair');return}
  marketNewsRecoveryLoading=true;
  clearError('market-news');
  const host=pageNode('market-news');
  host?.querySelector(':scope > #rona-market-news-current')?.remove();
  document.getElementById('rona-market-news-current-recovery')?.remove();
  window.__RONA_MARKET_NEWS_CURRENT_V1__=null;
  const s=document.createElement('script');
  s.id='rona-market-news-current-recovery';
  s.src='/assets/portal-market-news-current-v1.js?v=20260827-content-health-v6&ts='+Date.now();
  s.async=false;
  s.dataset.ronaMarketNewsRecovery='watchdog-v5';
  s.onload=()=>{marketNewsRecoveryLoading=false;activateMarketNews('watchdog-recovery-load-v5');schedule(350)};
  s.onerror=()=>{marketNewsRecoveryLoading=false;note('market-news-recovery','SCRIPT_LOAD_FAILED');schedule(900)};
  document.body.appendChild(s)
}
function repairMarketNews(){
  if(marketNewsReady())return;
  clearError('market-news');
  if(window.__RONA_MARKET_NEWS_CURRENT_V1__&&marketNewsRoot()){activateMarketNews('watchdog-content-repair');return}
  retryMarketNews()
}
function showError(p,module){const host=pageNode(p);if(!host||host.querySelector(':scope > .rona-module-error')||ready(p))return;const wrap=document.createElement('div');wrap.className='rona-module-error';wrap.dataset.ronaModuleError=module;const box=document.createElement('div'),title=document.createElement('strong'),text=document.createElement('div'),btn=document.createElement('button');title.textContent='Раздел не завершил загрузку';text.textContent='Сессия и выбранный раздел сохранены. Можно повторить загрузку модуля без перехода на «Главную».';text.style.marginTop='7px';btn.type='button';btn.textContent='Повторить загрузку';btn.onclick=()=>{wrap.remove();state.pageAttempts[p]=0;if(p==='market-news'){repairMarketNews();schedule(450)}else{window.dispatchEvent(new CustomEvent('rona:admin-module-retry',{detail:{module,page:p}}));schedule(400)}};box.append(title,text,btn);wrap.append(box);host.prepend(wrap)}
function requestRetry(p){const module=moduleFor(p);if(!module)return;state.pageAttempts[p]=(state.pageAttempts[p]||0)+1;if(p==='market-news'){repairMarketNews();return}window.dispatchEvent(new CustomEvent('rona:admin-module-retry',{detail:{module,page:p,attempt:state.pageAttempts[p]}}))}
function schedule(ms=1000){clearTimeout(timer);timer=setTimeout(run,ms)}
async function run(){if(running)return;running=true;try{const p=selected();state.status='CHECKING:'+p;if(ready(p)){clearError(p);state.pageAttempts[p]=0;state.status='READY:'+p;window.__RONA_ADMIN_RUNTIME_RECOVERY_READY__=true;if(p==='messages'){loadRadioFinal();ensureRadioHeading();observeRadioHeading()}return}const module=moduleFor(p);if(!module)return;const attempt=state.pageAttempts[p]||0;if(attempt<3){requestRetry(p);await sleep(p==='market-news'?650:1800+attempt*800);if(ready(p)){clearError(p);state.pageAttempts[p]=0;state.status='RECOVERED:'+p;if(p==='messages'){loadRadioFinal();ensureRadioHeading();observeRadioHeading()}return}}if((state.pageAttempts[p]||0)>=3&&!ready(p)){state.status='DEGRADED:'+p;showError(p,module)}}catch(e){note('watchdog',e)}finally{running=false;schedule(5000)}}
function loadRadioFinal(){
  ensureRadioHeading();observeRadioHeading();
  if(window.__RONA_ADMIN_RADIO_FINAL_V9__){scheduleRadioHeading(80);return}
  document.getElementById('rona-admin-radio-icc-loader')?.remove();
  document.getElementById('rona-admin-radio-final-v9-loader')?.remove();
  const s=document.createElement('script');
  s.id='rona-admin-radio-final-v9-loader';
  s.src='/assets/portal-admin-radio-final-v9.js?v=20260915-final-v9-r1&ts='+Date.now();
  s.async=false;
  s.dataset.ronaVisualOnly='radio-final-v9';
  s.onload=()=>{[0,80,250,700].forEach(ms=>setTimeout(ensureRadioHeading,ms))};
  s.onerror=()=>note('radio-final-v9','SCRIPT_LOAD_FAILED');
  document.body.appendChild(s)
}
function boot(){loadRadioFinal();window.addEventListener('rona:admin-pagechange',event=>{const p=String(event?.detail?.page||'');if(p==='messages'){loadRadioFinal();[80,250,700].forEach(ms=>setTimeout(ensureRadioHeading,ms))}if(p==='market-news'&&!marketNewsReady())setTimeout(()=>{if(selected()==='market-news'&&!marketNewsReady())repairMarketNews()},180);schedule(450)},{passive:true});window.addEventListener('rona:admin-single-owner-ready',()=>schedule(300),{passive:true});window.addEventListener('online',()=>schedule(500),{passive:true});window.addEventListener('pageshow',()=>{loadRadioFinal();scheduleRadioHeading(120);schedule(500)},{passive:true});schedule(1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();