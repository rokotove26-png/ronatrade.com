import { onRequest as adminRailCurrent } from './rail-current-v81-maplibre-ui.js';

const CLIENT_MARKER="window.__RONA_CLIENT_RAIL_PRODUCTION__='20260831-admin-canonical-v1';";
const ADMIN_MARKER="window.__RONA_RAIL_CURRENT_V81__='20260825-raster-first-v8.2';";
const API_VAR_FROM="var API='/portal/owner-api',snapshot=null,selected='ALL',timer=null,matrixNode=null;";
const API_VAR_TO="var snapshot=null,selected='ALL',timer=null,matrixNode=null;";
const API_FROM="function api(path){return fetch(API+'?path='+encodeURIComponent(path),{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok||j&&j.ok===false)throw new Error(String(j&&j.code||'HTTP_'+r.status));return j&&j.data||{}})})}";
const WAIT_FROM="function waitAdminReady(){var n=0,t=setInterval(function(){n++;if(window.__RONA_OWNER_ADMIN_READY__===true){clearInterval(t);paint();return}if(n>200)clearInterval(t)},100)}";
const START_FROM="function start(){ensureStyle();snapshot=window.__RONA_OWNER_ADMIN_SNAPSHOT__||null;paint();bind();sync();waitAdminReady();timer=setInterval(sync,30000)}";
const START_TO="function start(){ensureClientCanonicalOwnerStyle();if(!ensureClientRailMount())return;snapshot=null;paint();bind();sync();waitAdminReady();window.__RONA_CLIENT_RAIL_REFRESH__=function(){return sync()};timer=setInterval(sync,30000)}";
const LOCATION_FROM="if(location.pathname==='/portal/admin'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()}";
const LOCATION_TO="if(location.pathname==='/portal/client'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()}";
const BIND_FROM="function bind(){var nav=q('#nav button[data-page=\"monitoring\"]');if(nav&&!nav.__ronaRailV4Bound){nav.__ronaRailV4Bound=true;nav.addEventListener('click',function(){setTimeout(paint,0);setTimeout(paint,120);setTimeout(function(){sync()},350)})}}";
const BIND_TO="function bind(){if(document.documentElement.dataset.ronaClientRailNavBound==='true')return;document.documentElement.dataset.ronaClientRailNavBound='true';document.addEventListener('click',function(ev){var n=ev.target&&ev.target.closest?ev.target.closest('button,a,[role=\"button\"]'):null;if(!n)return;var key=String(n.getAttribute('data-page')||n.getAttribute('data-section')||n.getAttribute('data-target')||'').toLowerCase(),label=String(n.textContent||'').replace(/\\s+/g,' ').trim().toLowerCase();if(key!=='rail'&&key!=='monitoring'&&label!=='онлайн жд')return;setTimeout(function(){ensureClientRailMount();paint()},0);setTimeout(paint,120);setTimeout(function(){sync()},350)},true)}";

const CLIENT_PREAMBLE=String.raw`
${CLIENT_MARKER}
function clientRailOuter(){
  var selectors=['#page-rail','#page-monitoring','[data-page-panel="rail"]','[data-page-panel="monitoring"]','[data-page-id="rail"]','[data-page-id="monitoring"]'];
  for(var i=0;i<selectors.length;i++){var n=document.querySelector(selectors[i]);if(n)return n}
  var hs=Array.from(document.querySelectorAll('h1,h2,h3'));
  for(var j=0;j<hs.length;j++){if(String(hs[j].textContent||'').replace(/\s+/g,' ').trim()==='Онлайн ЖД')return hs[j].closest('section[id^="page-"],[data-page-panel],[data-page-id],main')||null}
  return null
}
function ensureClientCanonicalOwnerStyle(){
  if(document.getElementById('ronaClientRailAdminCanonicalCoreStyle'))return;
  var s=document.createElement('style');s.id='ronaClientRailAdminCanonicalCoreStyle';s.textContent=[
    '.rona-owner-card{padding:16px;border:1px solid var(--line,rgba(255,255,255,.18));border-radius:14px;margin:0 0 14px;background:transparent;color:inherit}',
    '.rona-owner-card h2,.rona-owner-card h3{margin:0 0 12px}',
    '.rona-owner-muted{opacity:.72;font-size:12px}',
    '.rona-owner-hide{display:none!important}',
    '.rona-owner-original-hidden{display:none!important}',
    '.rona-owner-page-content{display:block!important}',
    '#page-rail>[data-rona-client-rail-admin-canonical-mount],#page-monitoring[data-rona-client-rail-admin-canonical-mount]{width:100%;min-width:0;max-width:none}',
    '#page-rail .rona-rail-v4-root,#page-monitoring .rona-rail-v4-root{font-family:inherit}'
  ].join('');document.head.appendChild(s)
}
function ensureClientRailMount(){
  var outer=clientRailOuter();if(!outer)return null;
  if(outer.id==='page-monitoring'){
    if(outer.getAttribute('data-rona-client-rail-admin-canonical-mount')!=='v1'){
      outer.replaceChildren();outer.setAttribute('data-rona-client-rail-admin-canonical-mount','v1')
    }
    outer.setAttribute('data-rona-client-rail-owner','admin-current-v81-client-authority-v1');
    document.documentElement.dataset.ronaClientRailVisual='ADMIN_CURRENT_V81_CANONICAL';
    document.documentElement.dataset.ronaClientRailOwner='admin-current-v81-client-authority-v1';
    return outer
  }
  var mount=outer.querySelector(':scope > #page-monitoring[data-rona-client-rail-admin-canonical-mount="v1"]');
  if(!mount){mount=document.createElement('div');mount.id='page-monitoring';mount.setAttribute('data-rona-client-rail-admin-canonical-mount','v1');outer.replaceChildren(mount)}
  else Array.from(outer.children).forEach(function(n){if(n!==mount)n.remove()});
  outer.setAttribute('data-rona-client-rail-owner','admin-current-v81-client-authority-v1');
  mount.setAttribute('data-rona-client-rail-owner','admin-current-v81-client-authority-v1');
  document.documentElement.dataset.ronaClientRailVisual='ADMIN_CURRENT_V81_CANONICAL';
  document.documentElement.dataset.ronaClientRailOwner='admin-current-v81-client-authority-v1';
  return mount
}
`;

const CLIENT_API=String.raw`
function clientRailText(v){return v===null||v===undefined?'':String(v).trim()}
function clientRailUpper(v){return clientRailText(v).toUpperCase()}
function clientRailArray(v){return Array.isArray(v)?v:[]}
function clientRailPick(o,keys){if(!o)return'';for(var i=0;i<keys.length;i++){var v=o[keys[i]];if(v!==null&&v!==undefined&&String(v).trim()!=='')return v}return''}
function clientRailNumber(v,fallback){var n=Number(v);return Number.isFinite(n)?n:(fallback===undefined?0:fallback)}
function clientRailShipmentKey(row){return clientRailText(clientRailPick(row,['gu12_number','gu12Number','document_number','documentNumber','rail_document_id','railDocumentId','shipment_id','shipmentId','id']))}
function clientRailMovementKey(row){return clientRailText(clientRailPick(row,['shipment_id','shipmentId','gu12_number','gu12Number','document_number','documentNumber','rail_document_id','railDocumentId','parent_shipment_id','parentShipmentId']))}
function clientRailRoute(row){var direct=clientRailText(clientRailPick(row,['route_text','routeText','route']));if(direct)return direct;var from=clientRailText(clientRailPick(row,['origin_location','originLocation','origin','departure_station','departureStation'])),to=clientRailText(clientRailPick(row,['destination_location','destinationLocation','destination','arrival_station','arrivalStation']));return[from,to].filter(Boolean).join(' → ')||'—'}
function clientRailWagon(row){var copy=Object.assign({},row||{});copy.wagonNumber=clientRailText(clientRailPick(row,['wagonNumber','wagon_number','number','railcar_number','railcarNumber']))||'—';copy.station=clientRailText(clientRailPick(row,['station','currentStation','current_station','stationName','station_name']))||'—';copy.stationCode=clientRailText(clientRailPick(row,['stationCode','station_code','currentStationCode','current_station_code']))||'—';copy.operation=clientRailText(clientRailPick(row,['operation','lastOperation','last_operation']))||'—';copy.status=clientRailText(clientRailPick(row,['status','movement_status','movementStatus']))||'—';copy.lastPositionAt=clientRailPick(row,['lastPositionAt','last_position_at','position_at','positionAt','updated_at','updatedAt'])||null;return copy}
function clientRailUniqueWagons(rows){var out=[],seen=new Set();clientRailArray(rows).forEach(function(row){var w=clientRailWagon(row),key=clientRailText(w.wagonNumber);if(key&&key!=='—'){if(seen.has(key))return;seen.add(key)}out.push(w)});return out}
function clientRailProviderBody(payload){return payload&&payload.data&&typeof payload.data==='object'?Object.assign({},payload,payload.data):payload||{}}
async function clientRailFetch(url,required){try{var r=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}}),j=await r.json().catch(function(){return{}});if(required&&(!r.ok||j&&j.ok===false))throw new Error(String(j&&j.code||'HTTP_'+r.status));return{ok:r.ok&&(!j||j.ok!==false),payload:j||{},status:r.status}}catch(e){if(required)throw e;return{ok:false,payload:{code:String(e&&e.message||e||'REQUEST_FAILED')},status:0}}}
async function api(path){
  var shipmentResult=await clientRailFetch('/portal/api/v1/client/shipments',true),providerResult=await clientRailFetch('/portal/api/v1/client/rail',false),shipmentPayload=shipmentResult.payload||{},provider=clientRailProviderBody(providerResult.payload),shipments=clientRailArray(shipmentPayload.shipments),declared=clientRailUpper(clientRailPick(provider,['provider','movement_source','movementSource'])),production=providerResult.ok&&declared==='MOVIZOR'&&(provider.production_enabled===true||provider.enabled===true),publication=provider.movement_publication===true||provider.client_publication_enabled===true||provider.publication_enabled===true,movementSource=declared==='MOVIZOR'?'MOVIZOR':'NOT_CONNECTED',movementRows=publication?clientRailArray(provider.movements||provider.positions||provider.wagons||provider.railcars):[],byKey=new Map();
  movementRows.forEach(function(row){var key=clientRailMovementKey(row);if(!key)return;if(!byKey.has(key))byKey.set(key,[]);byKey.get(key).push(row)});
  var rail=shipments.map(function(row){var key=clientRailShipmentKey(row),nested=clientRailArray(row.wagons||row.railcars||row.cars||row.positions),matched=key&&byKey.has(key)?byKey.get(key):[],wagons=clientRailUniqueWagons(nested.concat(matched));return{gu12_number:clientRailPick(row,['gu12_number','gu12Number'])||null,document_number:clientRailPick(row,['document_number','documentNumber'])||null,rail_document_id:clientRailPick(row,['rail_document_id','railDocumentId','shipment_id','shipmentId','id'])||null,deal_id:clientRailPick(row,['deal_id','dealId'])||null,route_text:clientRailRoute(row),wagons:wagons}}),activeRaw=clientRailPick(provider,['active_targets','activeTargets']),active=production&&publication?(activeRaw!==''?clientRailNumber(activeRaw,0):1):0,exchange={active_targets:active,conflicts:clientRailNumber(clientRailPick(provider,['conflicts','attention_count','attentionCount']),0)};
  window.__RONA_CLIENT_RAIL_AUTHORITY_STATE__={source:'AUTHORITATIVE_SERVER_CLIENT_SHIPMENTS',shipment_source:'/portal/api/v1/client/shipments',provider_source:'/portal/api/v1/client/rail',provider:declared||'NOT_CONNECTED',provider_live:production,movement_publication:publication,movement_source:movementSource,movement_count:movementRows.length,rail_count:rail.length,active_targets:active,updated_at:new Date().toISOString()};
  document.documentElement.dataset.ronaClientRailSource='AUTHORITATIVE_SERVER_CLIENT_SHIPMENTS';
  document.documentElement.dataset.ronaClientRailProvider=declared||'NOT_CONNECTED';
  document.documentElement.dataset.ronaClientRailOperational=production&&publication?'true':'false';
  window.dispatchEvent(new CustomEvent('rona:client-rail:authority',{detail:window.__RONA_CLIENT_RAIL_AUTHORITY_STATE__}));
  return{rail:rail,exchange:exchange}
}
`;

export async function onRequest(context){
  const response=await adminRailCurrent(context);
  let source=await response.text();
  const required=[ADMIN_MARKER,API_VAR_FROM,API_FROM,WAIT_FROM,START_FROM,LOCATION_FROM,BIND_FROM,'rona-rail-v4-root','rona-rail-v4-work','rona-rail-v6-selector','rona-rail-v6-wagon-box','rona-rail-v7-real',"/portal/map-assets/osm/"];
  if(response.status!==200||required.some(marker=>!source.includes(marker))){
    return new Response('CLIENT_RAIL_ADMIN_CANONICAL_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source
    .replace("'use strict';","'use strict';\n"+CLIENT_PREAMBLE)
    .replace(API_VAR_FROM,API_VAR_TO)
    .replace(API_FROM,CLIENT_API)
    .replace(WAIT_FROM,'function waitAdminReady(){}')
    .replace(START_FROM,START_TO)
    .replace(BIND_FROM,BIND_TO)
    .replace(LOCATION_FROM,LOCATION_TO)
    .split("'/admin/bootstrap'").join("'/client/rail-canonical'");
  if(source.includes("/portal/owner-api")||source.includes("/admin/bootstrap")||source.includes("location.pathname==='/portal/admin'")){
    return new Response('CLIENT_RAIL_ADMIN_AUTHORITY_LEAK',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  for(const forbidden of ['rona-rail-ws','rona-movizor-blocker','Онлайн ЖД не введён в эксплуатацию','Железнодорожные отправки']){
    if(source.includes(forbidden))return new Response('CLIENT_RAIL_LEGACY_VISUAL_PRESENT',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  const headers=new Headers(response.headers);
  headers.set('content-type','application/javascript; charset=utf-8');
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-client-rail-ui','admin-current-v81-canonical-client-authority-v1');
  headers.set('x-rona-client-rail-visual-canon','/portal/rail-current-v81-maplibre-ui');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:200,headers});
}
