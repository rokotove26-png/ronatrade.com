(()=>{
  'use strict';
  if(location.pathname!=='/portal/client')return;
  if(window.__RONA_CLIENT_RAIL_PRODUCTION__==='20260830-map-auto-v1')return;
  window.__RONA_CLIENT_RAIL_PRODUCTION__='20260830-map-auto-v1';

  const TILE_SELECTOR='img.rona-rail-v7-tile';
  const RETRY_AFTER_MS=30000;

  function tileSpec(src){
    const raw=String(src||'');
    let m=/^https:\/\/tile\.openstreetmap\.org\/(\d{1,2})\/(\d+)\/(\d+)\.png(?:\?.*)?$/i.exec(raw);
    if(m)return{z:m[1],x:m[2],y:m[3]};
    try{
      const u=new URL(raw,location.origin);
      m=/^\/portal\/map-assets\/osm\/(\d{1,2})\/(\d+)\/(\d+)\.png$/.exec(u.pathname);
      if(m)return{z:m[1],x:m[2],y:m[3]};
    }catch(_){ }
    return null;
  }

  function direct(spec){
    return `https://tile.openstreetmap.org/${spec.z}/${spec.x}/${spec.y}.png`;
  }

  function proxy(spec){
    return `/portal/map-assets/osm/${spec.z}/${spec.x}/${spec.y}.png`;
  }

  function sourceKind(img){
    const raw=String(img.currentSrc||img.src||'');
    return raw.includes('/portal/map-assets/osm/')?'proxy':raw.includes('tile.openstreetmap.org/')?'direct':'other';
  }

  function switchSource(img,target){
    const spec=tileSpec(img.currentSrc||img.src);
    if(!spec)return false;
    if(target==='proxy'){
      if(img.dataset.ronaRailProxyTried==='1')return false;
      img.dataset.ronaRailProxyTried='1';
      img.src=proxy(spec);
      return true;
    }
    if(target==='direct'){
      if(img.dataset.ronaRailDirectTried==='1')return false;
      img.dataset.ronaRailDirectTried='1';
      img.referrerPolicy='strict-origin-when-cross-origin';
      img.src=direct(spec);
      return true;
    }
    return false;
  }

  function recover(img){
    if(!(img instanceof HTMLImageElement))return;
    const kind=sourceKind(img);
    if(kind==='direct'){
      img.dataset.ronaRailDirectTried='1';
      if(switchSource(img,'proxy'))return;
    }else if(kind==='proxy'){
      img.dataset.ronaRailProxyTried='1';
      if(switchSource(img,'direct'))return;
    }
    img.dataset.ronaRailFailedAt=String(Date.now());
  }

  function manage(img){
    if(!(img instanceof HTMLImageElement)||!tileSpec(img.currentSrc||img.src))return;
    if(img.dataset.ronaRailManaged!=='1'){
      img.dataset.ronaRailManaged='1';
      img.addEventListener('load',()=>{
        img.dataset.ronaRailFailedAt='';
      });
      img.addEventListener('error',()=>recover(img));
    }
    if(img.complete&&img.naturalWidth===0){
      const failedAt=Number(img.dataset.ronaRailFailedAt||0);
      if(failedAt&&Date.now()-failedAt>=RETRY_AFTER_MS){
        img.dataset.ronaRailDirectTried='';
        img.dataset.ronaRailProxyTried='';
        img.dataset.ronaRailFailedAt='';
      }
      recover(img);
    }
  }

  function scan(){
    if(document.visibilityState==='hidden')return;
    document.querySelectorAll(TILE_SELECTOR).forEach(manage);
  }

  document.addEventListener('DOMContentLoaded',scan,{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scan()});
  window.addEventListener('pageshow',scan);
  window.addEventListener('focus',scan);
  window.setInterval(scan,5000);
  scan();
})();
