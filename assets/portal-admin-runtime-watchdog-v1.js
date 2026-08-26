(()=>{'use strict';
if(window.__RONA_ADMIN_RUNTIME_WATCHDOG__)return;
window.__RONA_ADMIN_RUNTIME_WATCHDOG__='page-aware-v4-market-news-current';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const state=window.__RONA_ADMIN_RUNTIME_RECOVERY__={version:'page-aware-v4-market-news-current',status:'BOOTING',pageAttempts:Object.create(null),events:[],lastError:null};
let running=false,timer=null,marketNewsRecoveryLoading=false;
function note(stage,error){const item={stage:String(stage),error:String(error?.message||error||'UNKNOWN'),at:new Date().toISOString()};state.lastError=item;state.events.push(item);if(state.events.length>30)state.events.shift();console.warn('[RONA Admin watchdog]',item.stage,item.error)}
function selected(){try{const f=window.__RONA_ADMIN_SELECTED_PAGE__;if(typeof f==='function'){const p=f();if(p)return String(p)}}catch(_){ }return String(document.documentElement.dataset.ronaAdminPage||'home')}
function pageNode(p){return document.getElementById('page-'+p)}
function marketNewsReady(){const n=pageNode('market-news');return !!(n&&window.__RONA_MARKET_NEWS_CURRENT_V1__&&n.querySelector(':scope > #rona-market-news-current.rona-market-news-current'))}
function ready(p){const n=pageNode(p);if(!n)return false;if(p==='home')return window.__RONA_OWNER_ADMIN_READY__===true&&!n.querySelector(':scope > .current-loading');if(p==='access')return !!n.querySelector('#rona-ca4 [data-rona-create-access="primary"]');if(p==='claims')return !!n.querySelector(':scope > .rona-claims-r2-root');if(p==='monitoring')return !!n.querySelector('[data-rail-current-v4="ready"],[data-rail-current-root]');if(p==='agent-settlements')return !!n.querySelector(':scope > .rona-rs-root[data-kind="rewards"]');if(p==='messages')return !!n.querySelector(':scope > .rona-rs-root[data-kind="radio"]');if(p==='analytics')return window.__RONA_ANALYTICS_V2_READY__===true&&!!n.querySelector('#rona-analytics-v2');if(p==='market-news')return marketNewsReady();if(p==='prices')return n.children.length>0&&!n.querySelector(':scope > .current-loading');return true}
function moduleFor(p){if(p==='home')return'main';if(p==='access')return'clients-agents-current';if(p==='claims')return'claims';if(p==='monitoring')return'rail';if(p==='analytics')return'analytics';if(p==='market-news')return'market-news-current';if(['agent-settlements','messages'].includes(p))return'remaining';if(p==='prices')return'prices';return''}
function clearError(p){pageNode(p)?.querySelector(':scope > .rona-module-error')?.remove()}
function activateMarketNews(source='watchdog-recovery'){if(selected()!=='market-news')return;window.dispatchEvent(new CustomEvent('rona:admin-pagechange',{detail:{page:'market-news',source}}))}
function retryMarketNews(){
  if(marketNewsRecoveryLoading||marketNewsReady())return;
  marketNewsRecoveryLoading=true;
  clearError('market-news');
  const host=pageNode('market-news');
  host?.querySelector(':scope > #rona-market-news-current')?.remove();
  document.getElementById('rona-market-news-current-recovery')?.remove();
  window.__RONA_MARKET_NEWS_CURRENT_V1__=null;
  const s=document.createElement('script');
  s.id='rona-market-news-current-recovery';
  s.src='/assets/portal-market-news-current-v1.js?v=20260826-clean-rebuild-recovery-v4&ts='+Date.now();
  s.async=false;
  s.dataset.ronaMarketNewsRecovery='watchdog-v4';
  s.onload=()=>{marketNewsRecoveryLoading=false;activateMarketNews('watchdog-recovery-load');schedule(350)};
  s.onerror=()=>{marketNewsRecoveryLoading=false;note('market-news-recovery','SCRIPT_LOAD_FAILED');schedule(900)};
  document.body.appendChild(s)
}
function showError(p,module){const host=pageNode(p);if(!host||host.querySelector(':scope > .rona-module-error'))return;const wrap=document.createElement('div');wrap.className='rona-module-error';wrap.dataset.ronaModuleError=module;const box=document.createElement('div'),title=document.createElement('strong'),text=document.createElement('div'),btn=document.createElement('button');title.textContent='Раздел не завершил загрузку';text.textContent='Сессия и выбранный раздел сохранены. Можно повторить загрузку модуля без перехода на «Главную».';text.style.marginTop='7px';btn.type='button';btn.textContent='Повторить загрузку';btn.onclick=()=>{wrap.remove();state.pageAttempts[p]=0;if(p==='market-news'){retryMarketNews();schedule(450)}else{window.dispatchEvent(new CustomEvent('rona:admin-module-retry',{detail:{module,page:p}}));schedule(400)}};box.append(title,text,btn);wrap.append(box);host.prepend(wrap)}
function requestRetry(p){const module=moduleFor(p);if(!module)return;state.pageAttempts[p]=(state.pageAttempts[p]||0)+1;if(p==='market-news'){retryMarketNews();return}window.dispatchEvent(new CustomEvent('rona:admin-module-retry',{detail:{module,page:p,attempt:state.pageAttempts[p]}}))}
function schedule(ms=1000){clearTimeout(timer);timer=setTimeout(run,ms)}
async function run(){if(running)return;running=true;try{const p=selected();state.status='CHECKING:'+p;if(ready(p)){clearError(p);state.pageAttempts[p]=0;state.status='READY:'+p;window.__RONA_ADMIN_RUNTIME_RECOVERY_READY__=true;return}const module=moduleFor(p);if(!module)return;const attempt=state.pageAttempts[p]||0;if(attempt<3){requestRetry(p);await sleep(p==='market-news'?1200:1800+attempt*800);if(ready(p)){clearError(p);state.pageAttempts[p]=0;state.status='RECOVERED:'+p;return}}if((state.pageAttempts[p]||0)>=3&&!ready(p)){state.status='DEGRADED:'+p;showError(p,module)}}catch(e){note('watchdog',e)}finally{running=false;schedule(5000)}}
function boot(){window.addEventListener('rona:admin-pagechange',event=>{const p=String(event?.detail?.page||'');if(p==='market-news'&&!marketNewsReady())setTimeout(()=>{if(selected()==='market-news'&&!marketNewsReady())retryMarketNews()},250);schedule(500)},{passive:true});window.addEventListener('rona:admin-single-owner-ready',()=>schedule(300),{passive:true});window.addEventListener('online',()=>schedule(500),{passive:true});window.addEventListener('pageshow',()=>schedule(500),{passive:true});schedule(1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
