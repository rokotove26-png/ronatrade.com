import { onRequest as baseRemaining } from './remaining-sections-r2-base.js';

export async function onRequest(context){
  const response=await baseRemaining(context);
  let source=await response.text();

  // Analytics and Market News are owned by dedicated current-only modules.
  // remaining-sections must not render, gate, refresh, or mutate either page.
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
  source=source.replaceAll("if(kind==='news'){refreshMarket(true).then(()=>render(kind));return}",'');
  source+="\n(()=>{if(window.__RONA_MARKET_NEWS_CURRENT_LOADER__)return;window.__RONA_MARKET_NEWS_CURRENT_LOADER__='20260826-clean-rebuild-v1';const s=document.createElement('script');s.src='/assets/portal-market-news-current-v1.js?v=20260826-clean-rebuild-v1';s.defer=true;s.dataset.ronaMarketNewsLoader='clean-rebuild-v1';document.head.appendChild(s)})();\n";

  const forbidden=[
    "'аналитика':'analytics'",
    "'новости топливного рынка снг':'news'",
    'function renderAnalytics(){',
    'function renderNews(){',
    'function publicationCard(){',
    "root('analytics'",
    "root('news'",
    "kind==='analytics'",
    'ronaMarketNewsTopRuntimeV8',
    '__RONA_MARKET_NEWS_TOP_RUNTIME_V8__'
  ];
  if(forbidden.some(token=>source.includes(token))){
    return new Response('REMAINING_CANONICAL_SPLIT_FAILED',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-remaining-sections','r2-canonical-split-no-analytics-no-news-v4');
  headers.set('x-rona-market-news-owner','dedicated-asset-clean-rebuild-v1');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
