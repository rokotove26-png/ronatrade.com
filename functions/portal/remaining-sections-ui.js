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

  const analyticsStart=source.indexOf('function publicationCard(){');
  const analyticsEnd=source.indexOf('function renderNews(){',analyticsStart);
  if(analyticsStart<0||analyticsEnd<=analyticsStart){
    return new Response('REMAINING_ANALYTICS_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.slice(0,analyticsStart)+source.slice(analyticsEnd);
  source=source.replace("if(kind==='analytics')return renderAnalytics();",'');
  source=source.replace("if(kind==='analytics'||kind==='news')","if(kind==='news')");

  const newsStart=source.indexOf('function renderNews(){');
  const newsEnd=source.indexOf('function renderAgents(){',newsStart);
  if(newsStart<0||newsEnd<=newsStart){
    return new Response('REMAINING_NEWS_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.slice(0,newsStart)+source.slice(newsEnd);
  source=source.replace("if(kind==='news')return renderNews();",'');
  source=source.replace("if(kind==='news'){refreshMarket(true).then(()=>render(kind));return}",'');

  const forbidden=["'аналитика':'analytics'","'новости топливного рынка снг':'news'",'function renderAnalytics(){','function publicationCard(){','function renderNews(){',"kind==='analytics'","kind==='news'",'data-kind=\\"analytics\\"','data-kind=\\"news\\"',"kpi('Выводов'",'Аналитическая лента','Высокий приоритет','Лента рынка'];
  if(forbidden.some(token=>source.includes(token))){
    return new Response('REMAINING_CANONICAL_SPLIT_FAILED',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  for(const token of ['20260826-international-newsroom-v1','RONA TRADE · MARKET INTELLIGENCE','Главная лента','Сводка ленты','География','Источники']){
    if(!newsSource.includes(token))return new Response('PREMIUM_NEWS_SOURCE_INVALID',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-remaining-sections','r2-canonical-split-premium-news-v1');
  headers.set('x-rona-market-news-ui','international-newsroom-v1');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source+'\n'+newsSource,{status:response.status,statusText:response.statusText,headers});
}
