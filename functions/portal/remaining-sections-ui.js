import { onRequest as baseRemaining } from './remaining-sections-r2-base.js';

const MARKET_NEWS_TITLE_LOCK=String.raw`
;(()=>{'use strict';
if(window.__RONA_MARKET_NEWS_TITLE_INLINE_LOCK__)return;
window.__RONA_MARKET_NEWS_TITLE_INLINE_LOCK__='20260826-inline-important-v1';
const TITLE='Новости топливного рынка СНГ';
let observer=null,observedPage=null,queued=false;
function imp(el,prop,value){if(!el)return;if(el.style.getPropertyValue(prop)!==value||el.style.getPropertyPriority(prop)!=='important')el.style.setProperty(prop,value,'important')}
function lock(){
  const page=document.getElementById('page-market-news');
  if(!page)return false;
  const host=page.querySelector(':scope > .rona-owner-page-content')||page.querySelector('.rona-owner-page-content');
  if(!host)return false;
  const hero=host.querySelector(':scope > .rona-news-hero')||host.querySelector('.rona-news-hero');
  if(!hero)return false;
  const inner=hero.firstElementChild;
  const brand=hero.querySelector('.rona-news-brand');
  const title=hero.querySelector('.rona-news-title');
  const deck=hero.querySelector('.rona-news-deck');
  const edition=hero.querySelector('.rona-news-edition');
  const narrow=window.innerWidth<=900;

  imp(host,'box-sizing','border-box');
  imp(host,'width','min(100%, 1480px)');
  imp(host,'max-width','1480px');
  imp(host,'min-width','0px');
  imp(host,'margin-left','auto');
  imp(host,'margin-right','auto');
  imp(host,'grid-template-columns','minmax(0, 1fr)');

  imp(hero,'position','relative');
  imp(hero,'display','block');
  imp(hero,'box-sizing','border-box');
  imp(hero,'width','100%');
  imp(hero,'max-width','none');
  imp(hero,'min-width','0px');
  imp(hero,'margin','0px');
  imp(hero,'padding','8px 0px 20px');
  imp(hero,'overflow','visible');
  imp(hero,'grid-column','1 / -1');

  if(inner){
    imp(inner,'display','block');
    imp(inner,'box-sizing','border-box');
    imp(inner,'width','100%');
    imp(inner,'max-width','none');
    imp(inner,'min-width','0px');
    imp(inner,'margin','0px');
    imp(inner,'padding',narrow?'0px':'0px 220px 0px 0px');
    imp(inner,'grid-column','1 / -1');
  }

  if(brand){
    imp(brand,'display','block');
    imp(brand,'width','auto');
    imp(brand,'max-width','none');
    imp(brand,'min-width','0px');
    imp(brand,'margin','0px 0px 14px');
  }

  if(title){
    if(String(title.textContent||'').replace(/\s+/g,' ').trim()!==TITLE||title.children.length)title.replaceChildren(document.createTextNode(TITLE));
    imp(title,'display','block');
    imp(title,'box-sizing','border-box');
    imp(title,'width','100%');
    imp(title,'max-width','none');
    imp(title,'min-width','0px');
    imp(title,'margin','0px');
    imp(title,'padding','0px');
    imp(title,'white-space','normal');
    imp(title,'overflow-wrap','normal');
    imp(title,'word-break','normal');
    imp(title,'font','800 clamp(40px, 4.25vw, 62px) / 0.96 Georgia, "Times New Roman", serif');
    imp(title,'letter-spacing','-0.045em');
    imp(title,'grid-column','1 / -1');
  }

  if(deck){
    imp(deck,'display','block');
    imp(deck,'box-sizing','border-box');
    imp(deck,'width','100%');
    imp(deck,'max-width','900px');
    imp(deck,'min-width','0px');
    imp(deck,'margin','13px 0px 0px');
    imp(deck,'white-space','normal');
    imp(deck,'overflow-wrap','normal');
    imp(deck,'word-break','normal');
    imp(deck,'grid-column','1 / -1');
  }

  if(edition){
    if(narrow){
      imp(edition,'position','static');
      imp(edition,'inset','auto');
      imp(edition,'display','block');
      imp(edition,'width','auto');
      imp(edition,'margin','0px 0px 12px');
      imp(edition,'text-align','left');
      imp(edition,'white-space','normal');
    }else{
      imp(edition,'position','absolute');
      imp(edition,'top','9px');
      imp(edition,'right','0px');
      imp(edition,'bottom','auto');
      imp(edition,'left','auto');
      imp(edition,'display','block');
      imp(edition,'width','auto');
      imp(edition,'margin','0px');
      imp(edition,'text-align','right');
      imp(edition,'white-space','nowrap');
    }
  }

  host.dataset.ronaMarketNewsTitleLock='inline-important-v1';
  return true;
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;lock();attach()})}
function attach(){
  const page=document.getElementById('page-market-news');
  if(!page||page===observedPage)return;
  if(observer)observer.disconnect();
  observedPage=page;
  observer=new MutationObserver(schedule);
  observer.observe(page,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
}
function start(){attach();schedule();setTimeout(schedule,60);setTimeout(schedule,250);setTimeout(schedule,900)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('rona:admin-pagechange',event=>{if(String(event?.detail?.page||'')==='market-news')schedule()});
window.addEventListener('resize',schedule,{passive:true});
})();
`;

export async function onRequest(context){
  const response=await baseRemaining(context);
  let source=await response.text();

  // Analytics and Market News have dedicated canonical owners in the current Admin runtime.
  // The remaining-sections runtime must never take ownership of either page after first paint.
  source=source.replaceAll("'аналитика':'analytics',",'');
  source=source.replaceAll("'новости топливного рынка снг':'news',",'');
  source=source.replaceAll(',.rona-rs-root[data-kind=\\"analytics\\"]','');
  source=source.replaceAll(',.rona-rs-root[data-kind=\\"news\\"]','');

  const start=source.indexOf('function publicationCard(){');
  const end=source.indexOf('function renderAgents(){',start);
  if(start<0||end<=start){
    return new Response('REMAINING_CANONICAL_SPLIT_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.slice(0,start)+source.slice(end);

  source=source.replaceAll("if(kind==='analytics')return renderAnalytics();",'');
  source=source.replaceAll("if(kind==='news')return renderNews();",'');
  source=source.replaceAll("if(kind==='analytics'||kind==='news'){refreshMarket(true).then(()=>render(kind));return}",'');

  const forbidden=[
    "'аналитика':'analytics'",
    "'новости топливного рынка снг':'news'",
    'function renderAnalytics(){',
    'function renderNews(){',
    'function publicationCard(){',
    "root('news'",
    "root('analytics'",
    'ronaMarketNewsTopRuntimeV8',
    '__RONA_MARKET_NEWS_TOP_RUNTIME_V8__'
  ];
  if(forbidden.some(token=>source.includes(token))){
    return new Response('REMAINING_CANONICAL_SPLIT_FAILED',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }

  source+=MARKET_NEWS_TITLE_LOCK;

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-remaining-sections','r2-canonical-split-no-analytics-no-news-v3-title-lock');
  headers.set('x-rona-market-news-owner','main-ui-canonical-v3');
  headers.set('x-rona-market-news-title-lock','inline-important-v1');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
