import { onRequest as baseRailV4 } from './rail-current-v4-ui.js';

const FROM=`function bind(){var nav=q('#nav button[data-page="monitoring"]');if(!nav||nav.__ronaRailV4Bound)return;nav.__ronaRailV4Bound=true;nav.addEventListener('click',function(){setTimeout(paint,0);setTimeout(paint,120);setTimeout(function(){sync()},350)})}
function start(){ensureStyle();snapshot=window.__RONA_OWNER_ADMIN_SNAPSHOT__||null;paint();bind();sync();[180,700,1600].forEach(function(ms){setTimeout(function(){bind();paint()},ms)});timer=setInterval(sync,30000)}
if(location.pathname==='/portal/admin'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()}`;

const TO=`function activateRailV5(){qa('#nav button[data-page]').forEach(function(b){var on=b.dataset.page==='monitoring';b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});qa('[id^="page-"]').forEach(function(p){p.classList.toggle('active',p.id==='page-monitoring')});paint();setTimeout(function(){sync()},0)}
function bind(){var nav=q('#nav button[data-page="monitoring"]');if(nav&&!nav.__ronaRailV4Bound){nav.__ronaRailV4Bound=true;nav.addEventListener('click',function(){setTimeout(paint,0);setTimeout(paint,120);setTimeout(function(){sync()},350)})}if(!document.__ronaRailV5Owner){document.__ronaRailV5Owner=true;document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest&&ev.target.closest('#nav button[data-page="monitoring"]');if(!b)return;ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();activateRailV5()},true)}}
function waitAdminReady(){var n=0,t=setInterval(function(){n++;if(window.__RONA_OWNER_ADMIN_READY__===true){clearInterval(t);paint();return}if(n>200)clearInterval(t)},100)}
function start(){ensureStyle();snapshot=window.__RONA_OWNER_ADMIN_SNAPSHOT__||null;paint();bind();sync();waitAdminReady();timer=setInterval(sync,30000)}
if(location.pathname==='/portal/admin'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()}`;

export async function onRequest(context){
  const response=await baseRailV4(context);
  let source=await response.text();
  if(!source.includes(FROM))return new Response('RAIL_V5_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  source=source.replace(FROM,TO)
    .replace("window.__RONA_RAIL_CURRENT_V4__='20260824-0252-v4'","window.__RONA_RAIL_CURRENT_V4__='20260824-0304-v5';window.__RONA_RAIL_CURRENT_V5__='20260824-0304-v5'")
    .replace("version:'v4'","version:'v5'");
  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('x-rona-rail-ui','current-v5-owner');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
