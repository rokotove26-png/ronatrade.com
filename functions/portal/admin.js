const BUILD='owner-fast-shell-v1-20260826-0203';
const SHELL_RUNTIME='/assets/portal-admin-shell-fast-v1.js?v=20260826-0203';
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
    // Cloudflare Static Assets resolves HTML through the pretty pathname. Using
    // /portal/admin.html here can invoke canonicalization/redirect behavior.
    // ASSETS.fetch addresses the asset binding directly; it does not recurse
    // through this Pages Function route.
    u.pathname='/portal/admin';
    u.search='';
    return context.env.ASSETS.fetch(new Request(u.toString(),{
      method:context.request.method,
      headers:{accept:'text/html,application/xhtml+xml'}
    }));
  }
  return context.next();
}

class FastShellHeadInjector{
  element(el){
    el.append(`<meta name="rona-ui-primary" content="main-v2"><meta name="rona-ui-build" content="${BUILD}"><meta name="rona-admin-shell" content="fast-static-v1"><script id="rona-admin-fast-shell-runtime" src="${SHELL_RUNTIME}" defer></script>`,{html:true});
  }
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
  const ct=String(response.headers.get('content-type')||'').toLowerCase();
  const h=securityHeaders(response.headers);
  h.set('server-timing',`admin_shell;dur=${Math.max(0,Date.now()-started)}`);

  if(response.status!==200||!ct.includes('text/html')||request.method==='HEAD'){
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
  }

  if(typeof HTMLRewriter!=='function'){
    const source=await response.text();
    const tag=`<meta name="rona-ui-primary" content="main-v2"><meta name="rona-ui-build" content="${BUILD}"><meta name="rona-admin-shell" content="fast-static-v1"><script id="rona-admin-fast-shell-runtime" src="${SHELL_RUNTIME}" defer></script>`;
    const html=source.includes('rona-admin-fast-shell-runtime')?source:source.replace('</head>',tag+'</head>');
    return new Response(html,{status:200,headers:h});
  }

  const base=new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
  return new HTMLRewriter().on('head',new FastShellHeadInjector()).transform(base);
}
