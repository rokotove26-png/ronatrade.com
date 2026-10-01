const UPSTREAM_BASE='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-mcp-gateway/assistant';

function upstreamUrl(requestUrl){
  const url=new URL(requestUrl);
  const prefix='/assistant';
  if(url.pathname!==prefix&&!url.pathname.startsWith(prefix+'/'))return null;
  const suffix=url.pathname.slice(prefix.length)||'/';
  const target=new URL(UPSTREAM_BASE+(suffix.startsWith('/')?suffix:'/'+suffix));
  target.search=url.search;
  return target;
}

function forwardHeaders(source){
  const headers=new Headers(source);
  for(const name of ['host','content-length','cf-connecting-ip','cf-ipcountry','cf-ray','cf-visitor']){
    headers.delete(name);
  }
  return headers;
}

function responseHeaders(source){
  const headers=new Headers(source);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return headers;
}

export async function onRequest(context){
  const request=context.request;
  const target=upstreamUrl(request.url);
  if(!target)return new Response('Not found',{status:404});

  const init={
    method:request.method,
    headers:forwardHeaders(request.headers),
    redirect:'manual',
  };
  if(request.method!=='GET'&&request.method!=='HEAD')init.body=request.body;

  const upstream=await fetch(target.toString(),init);
  return new Response(upstream.body,{
    status:upstream.status,
    statusText:upstream.statusText,
    headers:responseHeaders(upstream.headers),
  });
}
