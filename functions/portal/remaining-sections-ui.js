import { onRequest as baseRemaining } from './_remaining-sections-r2-source.mjs';

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

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-remaining-sections','r2-canonical-split-no-analytics-v1');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
