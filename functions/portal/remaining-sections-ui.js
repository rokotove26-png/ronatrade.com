import { onRequest as baseRemaining } from './remaining-sections-r2-base.js';

const MARKET_NEWS_TOP_RUNTIME_PATCH=String.raw`
;(()=>{'use strict';
if(window.__RONA_MARKET_NEWS_TOP_RUNTIME_V8__)return;
window.__RONA_MARKET_NEWS_TOP_RUNTIME_V8__='20260826-runtime-grid-v8';
const STYLE_ID='ronaMarketNewsTopRuntimeV8';
function installMarketNewsTopRuntimeV8(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=[
    '#page-market-news .rona-owner-page-content[data-owner-page="market-news"]{display:block!important;width:min(100%,1480px)!important;max-width:1480px!important;margin:0 auto!important;padding:28px 32px 54px!important}',
    '#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-hero{position:relative!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:"brand edition" "title title" "deck deck"!important;column-gap:24px!important;row-gap:0!important;align-items:start!important;justify-items:stretch!important;width:100%!important;max-width:none!important;min-width:0!important;min-height:0!important;margin:0!important;padding:8px 0 20px!important;border:0!important;border-bottom:4px solid #c61f2f!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}',
    '#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-hero>div:first-child{display:contents!important;width:auto!important;max-width:none!important;min-width:0!important;margin:0!important;padding:0!important}',
    '#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-hero .rona-news-brand{grid-area:brand!important;align-self:center!important;display:block!important;width:auto!important;min-width:0!important;margin:0 0 14px!important;padding:0!important;color:#c61f2f!important;font:900 10px/1.15 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.17em!important;text-transform:uppercase!important;white-space:normal!important}',
    '#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-hero .rona-news-edition{grid-area:edition!important;position:static!important;inset:auto!important;align-self:center!important;justify-self:end!important;display:block!important;width:auto!important;margin:0 0 14px!important;padding:0!important;color:#6a6d69!important;text-align:right!important;font:800 9px/1.2 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.1em!important;text-transform:uppercase!important;white-space:nowrap!important}',
    '#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-hero .rona-news-title{grid-area:title!important;display:block!important;box-sizing:border-box!important;width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;padding:0!important;color:#11151a!important;font:800 clamp(38px,4vw,58px)/.98 Georgia,"Times New Roman",serif!important;letter-spacing:-.042em!important;text-transform:none!important;text-shadow:none!important;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important}',
    '#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-hero .rona-news-deck{grid-area:deck!important;display:block!important;width:100%!important;max-width:920px!important;min-width:0!important;margin:12px 0 0!important;padding:0!important;color:#4b5359!important;font:520 14px/1.5 Inter,Segoe UI,Arial,sans-serif!important;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important}',
    '#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-filter{display:grid!important;grid-template-columns:minmax(0,1fr) auto 168px auto!important;gap:10px!important;align-items:center!important;width:100%!important;max-width:none!important;min-width:0!important;min-height:50px!important;margin:0!important;padding:7px 0!important;border-bottom:1px solid #b9b4ab!important;background:transparent!important}',
    '#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-filter .rona-news-filter-context{box-sizing:border-box!important;width:auto!important;max-width:none!important;min-width:0!important;margin:0!important;padding:0!important;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important}',
    '#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-filter .rona-news-filter-label{margin:0!important;white-space:nowrap!important}',
    '#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-filter .rona-news-date-input{box-sizing:border-box!important;width:168px!important;min-width:168px!important;margin:0!important}',
    '#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-filter .rona-news-filter-reset{margin:0!important}',
    '#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-content{display:block!important;width:100%!important;max-width:none!important;min-width:0!important}',
    '@media(max-width:820px){#page-market-news .rona-owner-page-content[data-owner-page="market-news"]{padding:20px 18px 38px!important}#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-hero{grid-template-columns:1fr!important;grid-template-areas:"brand" "edition" "title" "deck"!important}#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-hero .rona-news-brand{margin-bottom:7px!important}#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-hero .rona-news-edition{justify-self:start!important;margin:0 0 12px!important;text-align:left!important;white-space:normal!important}#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-hero .rona-news-title{font-size:clamp(34px,7vw,48px)!important}#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-filter{grid-template-columns:1fr auto auto!important}#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-filter .rona-news-filter-context{grid-column:1/-1!important}}',
    '@media(max-width:560px){#page-market-news .rona-owner-page-content[data-owner-page="market-news"]{padding:16px 14px 30px!important}#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-hero .rona-news-title{font-size:32px!important;line-height:1!important}#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-hero .rona-news-deck{font-size:13px!important}#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-filter{grid-template-columns:1fr auto!important}#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-filter .rona-news-filter-label{grid-column:1/-1!important}#page-market-news .rona-owner-page-content[data-owner-page="market-news"]>.rona-news-filter .rona-news-date-input{width:100%!important;min-width:0!important}}'
  ].join('');
  document.head.appendChild(s);
  const host=document.querySelector('#page-market-news .rona-owner-page-content[data-owner-page="market-news"]');
  if(host)host.dataset.ronaMarketNewsTopOwner='runtime-grid-v8';
}
installMarketNewsTopRuntimeV8();
window.addEventListener('rona:admin-pagechange',event=>{if(String(event?.detail?.page||'')==='market-news'){requestAnimationFrame(installMarketNewsTopRuntimeV8);setTimeout(installMarketNewsTopRuntimeV8,120)}});
setTimeout(installMarketNewsTopRuntimeV8,0);
setTimeout(installMarketNewsTopRuntimeV8,350);
setTimeout(installMarketNewsTopRuntimeV8,1400);
})();
`;

export async function onRequest(context){
  const response=await baseRemaining(context);
  let source=await response.text();

  source=source.replaceAll("'аналитика':'analytics',",'');
  source=source.replaceAll(',.rona-rs-root[data-kind=\\"analytics\\"]','');

  const start=source.indexOf('function publicationCard(){');
  const end=source.indexOf('function renderNews(){',start);
  if(start<0||end<=start){
    return new Response('REMAINING_ANALYTICS_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.slice(0,start)+source.slice(end);
  source=source.replace("if(kind==='analytics')return renderAnalytics();",'');
  source=source.replace("if(kind==='analytics'||kind==='news')","if(kind==='news')");

  const forbidden=["'аналитика':'analytics'",'function renderAnalytics(){','function publicationCard(){',"kind==='analytics'",'data-kind=\\"analytics\\"',"kpi('Выводов'",'Аналитическая лента'];
  if(forbidden.some(token=>source.includes(token))){
    return new Response('REMAINING_ANALYTICS_STRIP_FAILED',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }

  source+=MARKET_NEWS_TOP_RUNTIME_PATCH;

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-remaining-sections','r2-canonical-split-no-analytics-v1');
  headers.set('x-rona-market-news-top','runtime-grid-v8');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}