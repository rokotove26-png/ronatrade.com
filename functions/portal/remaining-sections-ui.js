import { onRequest as baseRemaining } from './remaining-sections-r2-base.js';

export async function onRequest(context){
  const response=await baseRemaining(context);
  let source=await response.text();

  // Analytics has a dedicated canonical owner. Market News intentionally remains
  // in remaining-sections-r2 so the source contract matches the static build route.
  source=source.replaceAll("'аналитика':'analytics',",'');
  source=source.replaceAll(',.rona-rs-root[data-kind=\\"analytics\\"]','');

  const start=source.indexOf('function publicationCard(){');
  const end=source.indexOf('function renderNews(){',start);
  if(start<0||end<=start){
    return new Response('REMAINING_CANONICAL_SPLIT_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.slice(0,start)+source.slice(end);

  source=source.replaceAll("if(kind==='analytics')return renderAnalytics();",'');
  source=source.replaceAll("if(kind==='analytics'||kind==='news'){refreshMarket(true).then(()=>render(kind));return}","if(kind==='news'){refreshMarket(true).then(()=>render(kind));return}");

  const forbidden=[
    "'аналитика':'analytics'",
    'function renderAnalytics(){',
    'function publicationCard(){',
    "root('analytics'",
    'ronaMarketNewsTopRuntimeV8',
    '__RONA_MARKET_NEWS_TOP_RUNTIME_V8__'
  ];
  if(forbidden.some(token=>source.includes(token))||!source.includes("'новости топливного рынка снг':'news'")||!source.includes('function renderNews(){')){
    return new Response('REMAINING_CANONICAL_SPLIT_FAILED',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-remaining-sections','r2-canonical-split-no-analytics-v3');
  headers.set('x-rona-market-news-owner','remaining-sections-r2-canonical-news-v1');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
