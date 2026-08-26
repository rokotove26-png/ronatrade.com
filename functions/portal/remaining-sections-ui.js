import { onRequest as baseRemaining } from './remaining-sections-r2-base.js';
import { onRequest as premiumNews } from './news-current-ui.js';

export async function onRequest(context){
  const [response,newsResponse]=await Promise.all([baseRemaining(context),premiumNews(context)]);
  let source=await response.text();
  const newsSource=await newsResponse.text();

  source=source.replaceAll("'аналитика':'analytics',",'');
  source=source.replaceAll("'новости топливного рынка снг':'news',",'');
  source=source.replaceAll(',.rona-rs-root[data-kind=\\"analytics\\"]','');
  source=source.replaceAll(',.rona-rs-root[data-kind=\\"news\\"]','');
  source=source.replace('const S={};let M=null,marketPromise=null;','const S={};');

  const refreshMarketStart=source.indexOf('async function refreshMarket(');
  const refreshMarketEnd=source.indexOf('function notice(',refreshMarketStart);
  if(refreshMarketStart<0||refreshMarketEnd<=refreshMarketStart){
    return new Response('REMAINING_MARKET_REFRESH_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.slice(0,refreshMarketStart)+source.slice(refreshMarketEnd);

  const helperStart=source.indexOf('function sourceBar(){');
  const helperEnd=source.indexOf('function renderClients(){',helperStart);
  if(helperStart<0||helperEnd<=helperStart){
    return new Response('REMAINING_MARKET_HELPERS_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.slice(0,helperStart)+source.slice(helperEnd);

  const marketStart=source.indexOf('function publicationCard(){');
  const marketEnd=source.indexOf('function renderAgents(){',marketStart);
  if(marketStart<0||marketEnd<=marketStart){
    return new Response('REMAINING_MARKET_RENDERERS_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.slice(0,marketStart)+source.slice(marketEnd);
  source=source.replace("if(kind==='analytics')return renderAnalytics();",'');
  source=source.replace("if(kind==='news')return renderNews();",'');
  source=source.replace("if(kind==='analytics'||kind==='news'){refreshMarket(true).then(()=>render(kind));return}",'');
  source=source.replace("if(kind==='news'){refreshMarket(true).then(()=>render(kind));return}",'');
  source=source.replace('function bind(){style();void refreshMarket();','function bind(){style();');

  const forbidden=["'аналитика':'analytics'","'новости топливного рынка снг':'news'",'function renderAnalytics(){','function publicationCard(){','function renderNews(){','function sourceBar(){','function tagsFor(','function entry(', 'async function refreshMarket(',"kind==='analytics'","kind==='news'",'data-kind=\\"analytics\\"','data-kind=\\"news\\"',"kpi('Выводов'",'Аналитическая лента','Высокий приоритет','Лента рынка'];
  if(forbidden.some(token=>source.includes(token))){
    return new Response('REMAINING_CANONICAL_MARKET_SPLIT_FAILED',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  for(const token of ['Радиорубка','Вознаграждения агентов','renderRadio','renderRewards']){
    if(!source.includes(token))return new Response('REMAINING_APPROVED_SECTION_LOST',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  for(const token of ['20260826-international-newsroom-v1','RONA TRADE · MARKET INTELLIGENCE','Главная лента','Сводка ленты','География','Источники']){
    if(!newsSource.includes(token))return new Response('PREMIUM_NEWS_SOURCE_INVALID',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-remaining-sections','r2-canonical-split-premium-news-v2');
  headers.set('x-rona-market-news-ui','international-newsroom-v1');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source+'\n'+newsSource,{status:response.status,statusText:response.statusText,headers});
}
