const BUILD='owner-fast-shell-v2-20260826-0251';
const ADMIN_CSP="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https://tiles.openfreemap.org; connect-src 'self' https://tiles.openfreemap.org; font-src 'self' data: https://tiles.openfreemap.org; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'";

function hasPortalCookie(request){
  const raw=String(request.headers.get('cookie')||'');
  return /(?:^|;\s*)rona_portal_(?:at|rt)=/.test(raw);
}

function securityHeaders(source){
  const h=new Headers(source||{});
  h.set('cache-control','no-store, no-cache, must-revalidate');
  h.set('pragma','no-cache');
  h.set('expires','0');
  h.set('referrer-policy','no-referrer');
  h.set('x-content-type-options','nosniff');
  h.set('x-frame-options','DENY');
  h.set('permissions-policy','camera=(), microphone=(), geolocation=(), payment=()');
  h.set('cross-origin-opener-policy','same-origin');
  h.set('cross-origin-resource-policy','same-origin');
  h.set('content-security-policy',ADMIN_CSP);
  h.set('x-rona-admin-shell','fast-static-v1');
  h.set('x-rona-admin-shell-render','build-injected-static');
  h.set('x-rona-ui-build',BUILD);
  h.delete('content-length');
  h.delete('etag');
  return h;
}

function loginRedirect(request){
  const u=new URL('/portal/login',request.url);
  u.searchParams.set('next','/portal/admin');
  const h=securityHeaders();
  h.set('location',u.toString());
  return new Response(null,{status:302,headers:h});
}

async function canonicalAdminAsset(context){
  if(context.env?.ASSETS?.fetch){
    const u=new URL(context.request.url);
    u.pathname='/portal/admin';
    u.search='';
    return context.env.ASSETS.fetch(new Request(u.toString(),{
      method:context.request.method,
      headers:{accept:'text/html,application/xhtml+xml'}
    }));
  }
  return context.next();
}

export async function onRequest(context){
  const request=context.request;
  if(!['GET','HEAD'].includes(request.method)){
    const h=securityHeaders({'content-type':'application/json; charset=utf-8','allow':'GET, HEAD'});
    return new Response(JSON.stringify({ok:false,code:'METHOD_NOT_ALLOWED'}),{status:405,headers:h});
  }
  if(!hasPortalCookie(request))return loginRedirect(request);

  const started=Date.now();
  const response=await canonicalAdminAsset(context);
  const h=securityHeaders(response.headers);
  h.set('server-timing',`admin_shell;dur=${Math.max(0,Date.now()-started)}`);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
}
