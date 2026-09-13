const PREVIEW_HOST=/^[0-9a-f]{8}\.rona-trade-public\.pages\.dev$/i;
const QA_HEADER='x-rona-v6-real-preview-qa';
const QA_VALUES=new Set(['exact-head-v6','exact-head-v6-r2']);

function json(status,body){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-rona-v6-real-preview-route':'reached'}})}

export async function onRequest(context){
  const request=context.request;
  if(!['GET','HEAD'].includes(request.method))return json(405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  const url=new URL(request.url);
  if(!PREVIEW_HOST.test(url.hostname))return json(404,{ok:false,code:'PREVIEW_ONLY'});
  if(!QA_VALUES.has(request.headers.get(QA_HEADER)||''))return json(403,{ok:false,code:'QA_HEADER_REQUIRED'});
  if(!context.env?.ASSETS?.fetch)return json(503,{ok:false,code:'ASSET_BINDING_UNAVAILABLE'});

  const assetUrl=new URL(request.url);
  assetUrl.pathname='/portal/admin.html';
  assetUrl.search='';
  const asset=await context.env.ASSETS.fetch(new Request(assetUrl.toString(),{method:request.method,headers:{accept:'text/html,application/xhtml+xml'}}));
  const headers=new Headers(asset.headers);
  headers.set('cache-control','no-store');
  headers.set('x-rona-v6-real-preview-route','reached');
  headers.set('x-rona-v6-real-preview-asset','DEPLOYED_ADMIN_CURRENT');
  headers.set('x-content-type-options','nosniff');
  headers.delete('content-length');
  return new Response(request.method==='HEAD'?null:asset.body,{status:asset.status,statusText:asset.statusText,headers});
}
