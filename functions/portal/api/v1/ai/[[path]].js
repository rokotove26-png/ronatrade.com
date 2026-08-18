const BASE='/portal/api/v1/ai';
const ALLOWED=new Map([
  ['/token',new Set(['POST'])],
  ['/current-state',new Set(['GET'])],
  ['/history',new Set(['GET'])],
]);

function json(body,status=200,extra={}){
  return new Response(JSON.stringify(body),{status,headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'referrer-policy':'no-referrer',
    'x-content-type-options':'nosniff',
    ...extra,
  }});
}
function routeOf(url){
  const p=url.pathname.startsWith(BASE)?url.pathname.slice(BASE.length):'';
  return p||'/';
}

export async function onRequest(context){
  const req=context.request;
  const url=new URL(req.url);
  const route=routeOf(url);
  const allowed=ALLOWED.get(route);
  if(!allowed) return json({ok:false,code:'AI_ROUTE_NOT_FOUND'},404);
  if(!allowed.has(req.method)) return json({ok:false,code:'AI_READ_ONLY_METHOD_DENIED'},405,{allow:[...allowed].join(', ')});
  const supabaseUrl=context.env.SUPABASE_URL;
  if(!supabaseUrl) return json({ok:false,code:'AI_UPSTREAM_NOT_CONFIGURED'},503);

  const upstream=new URL(`${String(supabaseUrl).replace(/\/$/,'')}/functions/v1/rona-ai-read-only${route}`);
  upstream.search=url.search;
  const headers=new Headers();
  for(const name of ['authorization','x-request-id','x-correlation-id','x-rona-ai-identity-id','x-rona-ai-bootstrap-key']){
    const value=req.headers.get(name); if(value) headers.set(name,value);
  }
  headers.set('accept','application/json');
  if(req.method==='POST') headers.set('content-type','application/json');

  const upstreamResponse=await fetch(upstream.toString(),{
    method:req.method,
    headers,
    body:req.method==='POST'?await req.text():undefined,
    redirect:'manual',
  });
  const outHeaders=new Headers();
  const ct=upstreamResponse.headers.get('content-type'); if(ct) outHeaders.set('content-type',ct);
  const requestId=upstreamResponse.headers.get('x-request-id'); if(requestId) outHeaders.set('x-request-id',requestId);
  outHeaders.set('cache-control','no-store, no-cache, must-revalidate');
  outHeaders.set('pragma','no-cache');
  outHeaders.set('referrer-policy','no-referrer');
  outHeaders.set('x-content-type-options','nosniff');
  return new Response(upstreamResponse.body,{status:upstreamResponse.status,statusText:upstreamResponse.statusText,headers:outHeaders});
}
