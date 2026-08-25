const MAPLIBRE_VERSION='5.16.0';
const STATIC_ASSETS={
  'maplibre-gl.js':{
    type:'application/javascript; charset=utf-8',
    cache:'public, max-age=86400, s-maxage=604800, immutable',
    upstreams:[
      `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`,
      `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`
    ]
  },
  'maplibre-gl.css':{
    type:'text/css; charset=utf-8',
    cache:'public, max-age=86400, s-maxage=604800, immutable',
    upstreams:[
      `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`,
      `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`
    ]
  }
};

function responseHeaders(type,cache,upstream){
  const h=new Headers({
    'content-type':type,
    'cache-control':cache,
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer',
    'cross-origin-resource-policy':'same-origin'
  });
  if(upstream)h.set('x-rona-map-upstream',new URL(upstream).hostname);
  return h;
}

async function fetchWithTimeout(url,timeoutMs=4500){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort('timeout'),timeoutMs);
  try{
    return await fetch(url,{
      signal:controller.signal,
      redirect:'follow',
      headers:{
        'accept':'*/*',
        'user-agent':'RONA-Trade-Rail-Map/1.0 (+https://ronaoil.com)'
      }
    });
  }finally{
    clearTimeout(timer);
  }
}

function cacheApi(){
  try{return typeof caches!=='undefined'&&caches.default?caches.default:null}catch(_){return null}
}

async function cached(request){
  const cache=cacheApi();
  if(!cache)return null;
  try{return await cache.match(request)}catch(_){return null}
}

function cachePut(context,request,response){
  const cache=cacheApi();
  if(!cache)return;
  const work=cache.put(request,response.clone()).catch(()=>{});
  if(context&&typeof context.waitUntil==='function')context.waitUntil(work);
}

async function proxyAllowed(context,upstreams,type,cacheControl){
  const hit=await cached(context.request);
  if(hit)return hit;
  let lastStatus=0;
  for(const upstream of upstreams){
    try{
      const r=await fetchWithTimeout(upstream);
      lastStatus=r.status;
      if(!r.ok)continue;
      const body=await r.arrayBuffer();
      if(!body.byteLength)continue;
      const out=new Response(body,{status:200,headers:responseHeaders(type,cacheControl,upstream)});
      cachePut(context,context.request,out);
      return out;
    }catch(_){
      // Try the next allowlisted upstream.
    }
  }
  return new Response('MAP_ASSET_UPSTREAM_UNAVAILABLE',{status:503,headers:{
    'content-type':'text/plain; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'x-rona-map-upstream-status':String(lastStatus||0)
  }});
}

function tileSpec(path){
  const m=/^osm\/(\d{1,2})\/(\d+)\/(\d+)\.png$/.exec(path);
  if(!m)return null;
  const z=Number(m[1]),x=Number(m[2]),y=Number(m[3]);
  if(!Number.isInteger(z)||!Number.isInteger(x)||!Number.isInteger(y)||z<0||z>19)return null;
  const n=2**z;
  if(x<0||y<0||x>=n||y>=n)return null;
  return {z,x,y};
}

export async function onRequest(context){
  const url=new URL(context.request.url);
  const prefix='/portal/map-assets/';
  const path=url.pathname.startsWith(prefix)?decodeURIComponent(url.pathname.slice(prefix.length)):'';
  const asset=STATIC_ASSETS[path];
  if(asset){
    return proxyAllowed(context,asset.upstreams,asset.type,asset.cache);
  }
  const tile=tileSpec(path);
  if(tile){
    return proxyAllowed(
      context,
      [`https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`],
      'image/png',
      'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
    );
  }
  return new Response('NOT_FOUND',{status:404,headers:{
    'content-type':'text/plain; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff'
  }});
}
