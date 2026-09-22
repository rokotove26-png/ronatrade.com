import { onRequest as adminRailCurrent } from './rail-current-v81-maplibre-ui.js';

const CLIENT_MARKER="window.__RONA_CLIENT_RAIL_PRODUCTION__='20260921-admin-canonical-route-inherit-v1';window.__RONA_CLIENT_RAIL_PREMIUM_MAP__='20260921-premium-markers-v1';";
const CANONICAL_ROUTE_RENDERER_MARKER="window.__RONA_CLIENT_RAIL_CANONICAL_ROUTE_RENDERER__='ADMIN_CURRENT_V81_INHERITED_V1';";
const ROUTE_LAYER_FIX_MARKER="window.__RONA_CLIENT_RAIL_ROUTE_LAYER_FIX__='20260922-overlay-position-v1';";
const ADMIN_MARKER="window.__RONA_RAIL_CURRENT_V81__='20260825-raster-first-v8.2';";
const ADMIN_ROUTE_MARKER="window.__RONA_RAIL_ROUTE_DESTINATION_CONTINUATION__='20260921-final-destination-v3';";
const API_VAR_FROM="var API='/portal/owner-api',snapshot=null,selected='ALL',timer=null,matrixNode=null;var lastRailSignature='';";
const API_VAR_TO="var snapshot=null,selected='ALL',timer=null,matrixNode=null;var lastRailSignature='';";
const API_FROM="function api(path){return fetch(API+'?path='+encodeURIComponent(path),{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok||j&&j.ok===false)throw new Error(String(j&&j.code||'HTTP_'+r.status));return j&&j.data||{}})})}";
const WAIT_FROM="function waitAdminReady(){var n=0,t=setInterval(function(){n++;if(window.__RONA_OWNER_ADMIN_READY__===true){clearInterval(t);paint();return}if(n>200)clearInterval(t)},100)}";
const START_HEAD_FROM="function start(){ensureStyle();ensureV6Style();snapshot=window.__RONA_OWNER_ADMIN_SNAPSHOT__||null;paint();bind();sync();waitAdminReady();";
const START_HEAD_TO="function start(){ensureClientCanonicalOwnerStyle();ensureStyle();ensureV6Style();if(!ensureClientRailMount())return;if(typeof ensureRailCompactDarkStyle==='function')ensureRailCompactDarkStyle();snapshot=null;paint();if(typeof ensureRailTariffPanel==='function')ensureRailTariffPanel();bind();sync();waitAdminReady();[120,420,900].forEach(function(ms){setTimeout(function(){if(typeof ensureRailTariffPanel==='function')ensureRailTariffPanel()},ms)});window.__RONA_CLIENT_RAIL_REFRESH__=function(){return sync()};";
const LOCATION_FROM="if(location.pathname==='/portal/admin'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()}";
const LOCATION_TO="if(location.pathname==='/portal/client'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()}";
const BIND_FROM="function bind(){var nav=q('#nav button[data-page=\"monitoring\"]');if(nav&&!nav.__ronaRailV4Bound){nav.__ronaRailV4Bound=true;nav.addEventListener('click',function(){setTimeout(paint,0);setTimeout(paint,120);setTimeout(function(){sync()},350)})}}";
const BIND_TO="function bind(){if(document.documentElement.dataset.ronaClientRailNavBound==='true')return;document.documentElement.dataset.ronaClientRailNavBound='true';document.addEventListener('click',function(ev){var n=ev.target&&ev.target.closest?ev.target.closest('button,a,[role=\"button\"]'):null;if(!n)return;var key=String(n.getAttribute('data-page')||n.getAttribute('data-section')||n.getAttribute('data-target')||'').toLowerCase(),label=String(n.textContent||'').replace(/\\s+/g,' ').trim().toLowerCase();if(key!=='rail'&&key!=='monitoring'&&label!=='онлайн жд')return;setTimeout(function(){ensureClientRailMount();paint()},0);setTimeout(paint,120);setTimeout(function(){sync()},350)},true)}";
const CLIENT_LEGACY_TIMER_FROM=";timer=setInterval(sync,30000)";
const CLIENT_V81_POLL_FROM="timer=setInterval(function(){var page=q('#page-monitoring');if(document.visibilityState==='visible'&&page&&page.classList.contains('active'))sync()},30000);document.addEventListener('visibilitychange',function(){var page=q('#page-monitoring');if(document.visibilityState==='visible'&&page&&page.classList.contains('active'))sync()},{passive:true})";
const CLIENT_POLL_TO="timer=null";
const ADMIN_SINGLE_TITLE_HIDDEN_HERO="'.rona-rail-v4-hero{display:none!important}',";

const CLIENT_PREAMBLE=String.raw`
${CLIENT_MARKER}
${CANONICAL_ROUTE_RENDERER_MARKER}
${ROUTE_LAYER_FIX_MARKER}
window.__RONA_CLIENT_RAIL_COMPAT__='CLIENT_ADMIN_ROUTE_PARITY_V5 CLIENT_RAIL_CANONICAL_ROUTE_INHERIT_V1 CLIENT_RAIL_EVENT_DRIVEN_REFRESH_V2';
window.__RONA_CLIENT_RAIL_REFRESH_POLICY__='OPEN_CONTEXT_CHANGE_INVALIDATION';
window.__RONA_CLIENT_RAIL_CURRENT_CONTEXT__='20260903-client-contract-v1';
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
    '#page-rail .rona-rail-v4-root,#page-monitoring .rona-rail-v4-root{font-family:inherit}',
    '#page-rail .rona-rail-v7-map-viewport>.rona-rail-v7-tiles,#page-monitoring .rona-rail-v7-map-viewport>.rona-rail-v7-tiles{position:absolute!important;inset:0!important;z-index:1!important}',
    '#page-rail .rona-rail-v7-map-viewport>.rona-rail-v7-route-layer,#page-monitoring .rona-rail-v7-map-viewport>.rona-rail-v7-route-layer{position:absolute!important;inset:0!important;z-index:3!important;pointer-events:none!important;overflow:visible!important}',
    '#page-rail .rona-rail-v7-route-layer>.rona-rail-v7-route-svg,#page-monitoring .rona-rail-v7-route-layer>.rona-rail-v7-route-svg{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;overflow:visible!important}',
    '#page-rail .rona-rail-v7-map-viewport>.rona-rail-v7-markers,#page-monitoring .rona-rail-v7-map-viewport>.rona-rail-v7-markers{position:absolute!important;inset:0!important;z-index:4!important}',
    '#page-rail .rona-rail-v7-route-casing,#page-monitoring .rona-rail-v7-route-casing{stroke:rgba(4,24,36,.56)!important;stroke-width:7.2!important}',
    '#page-rail .rona-rail-v7-route-line,#page-monitoring .rona-rail-v7-route-line{stroke:#63d8ff!important;stroke-width:3.6!important;filter:drop-shadow(0 1px 3px rgba(28,175,222,.26))!important}',
    '#page-rail .rona-rail-v7-route-remaining-casing,#page-monitoring .rona-rail-v7-route-remaining-casing{stroke:rgba(5,28,39,.48)!important;stroke-width:6.4!important}',
    '#page-rail .rona-rail-v7-route-remaining,#page-monitoring .rona-rail-v7-route-remaining{stroke:rgba(83,166,196,.78)!important;stroke-width:2.8!important;stroke-dasharray:6 6!important}',
    '#page-rail .rona-rail-v7-route-actual-casing,#page-monitoring .rona-rail-v7-route-actual-casing{stroke:rgba(3,20,31,.64)!important;stroke-width:8.4!important}',
    '#page-rail .rona-rail-v7-route-actual,#page-monitoring .rona-rail-v7-route-actual{stroke:#25cfc0!important;stroke-width:4.2!important;filter:drop-shadow(0 1px 3px rgba(37,207,192,.28))!important}',
    '#page-rail .rona-rail-v7-route-node,#page-monitoring .rona-rail-v7-route-node{display:none!important}',
    '#page-rail .rona-client-rail-route-pin,#page-monitoring .rona-client-rail-route-pin{shape-rendering:geometricPrecision!important}',
    '#page-rail .rona-rail-v7-marker,#page-monitoring .rona-rail-v7-marker{min-width:30px!important;width:auto!important;height:24px!important;margin:-12px 0 0 -15px!important;padding:0 8px!important;border:1px solid rgba(121,226,244,.55)!important;border-radius:7px!important;background:linear-gradient(180deg,rgba(8,35,49,.98),rgba(5,24,36,.98))!important;box-shadow:0 6px 16px rgba(1,14,23,.32),0 0 0 1px rgba(95,211,233,.10),0 0 14px rgba(99,216,255,.16)!important;color:#dffbff!important;font-size:10.5px!important;font-weight:850!important;letter-spacing:.01em!important}',
    '#page-rail .rona-rail-v7-marker::before,#page-monitoring .rona-rail-v7-marker::before{content:""!important;display:inline-block!important;width:5px!important;height:5px!important;margin-right:5px!important;border-radius:1.5px!important;background:#5ee7d5!important;box-shadow:0 0 8px rgba(94,231,213,.72)!important;vertical-align:1px!important}',
    '#page-rail .rona-rail-v7-marker::after,#page-monitoring .rona-rail-v7-marker::after{display:none!important;content:none!important}',
    '#page-rail .rona-rail-v7-marker-label,#page-monitoring .rona-rail-v7-marker-label{left:50%!important;top:-10px!important;transform:translate(-50%,-100%)!important;padding:7px 9px!important;border:1px solid rgba(110,214,232,.22)!important;border-radius:8px!important;background:rgba(4,20,31,.96)!important;color:#e9fbff!important;box-shadow:0 10px 24px rgba(0,0,0,.30)!important;font-size:10.5px!important;font-weight:720!important}',
    '#page-rail .rona-rail-v7-marker:hover,#page-monitoring .rona-rail-v7-marker:hover,#page-rail .rona-rail-v7-marker.is-open,#page-monitoring .rona-rail-v7-marker.is-open{transform:translateY(-1px)!important;border-color:rgba(151,239,252,.86)!important;box-shadow:0 8px 20px rgba(1,14,23,.38),0 0 18px rgba(99,216,255,.22)!important}'
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
function clientRailRoutePoint(v){
  if(!v||typeof v!=='object')return null;
  var lat=Number(v.lat!==undefined?v.lat:v.latitude),lng=Number(v.lng!==undefined?v.lng:(v.lon!==undefined?v.lon:v.longitude));
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85.0512||Math.abs(lng)>180)return null;
  return Object.assign({},v,{
    lat:lat,
    lng:lng,
    station:v.station||v.name||null,
    stationCode:v.stationCode||v.station_code||v.esrCode||v.esr_code||v.esr||null,
    sequence:v.sequence!==undefined?v.sequence:null,
    borderRole:v.borderRole||v.border_role||null,
    waypointRole:v.waypointRole||v.waypoint_role||null,
    sourceKind:v.sourceKind||v.source_kind||null,
    countryCode:v.countryCode||v.country_code||null
  })
}
function clientRailRouteProjection(v,fallbackStatus){
  var source=v&&typeof v==='object'&&!Array.isArray(v)?v:null,points=source&&Array.isArray(source.points)?source.points.map(clientRailRoutePoint).filter(Boolean):[];
  return {status:source&&source.status||fallbackStatus,points:points,geometry:source&&source.geometry||null,provenance:source&&source.provenance||null}
}
function clientRailRouteAlias(target,key,id,value){
  if(!target||!value)return;
  if(key)target[key]=value;
  if(id)target[id]=value
}
function clientRailNormalizeRouteParity(payload){
  if(!payload||typeof payload!=='object')return payload;
  var deals=Array.isArray(payload.deals)?payload.deals:[],
      planned=payload.plannedRouteByDeal&&typeof payload.plannedRouteByDeal==='object'?payload.plannedRouteByDeal:{},
      actual=payload.actualRouteByDeal&&typeof payload.actualRouteByDeal==='object'?payload.actualRouteByDeal:{},
      remaining=payload.remainingRouteByDeal&&typeof payload.remainingRouteByDeal==='object'?payload.remainingRouteByDeal:{},
      progress=payload.routeProgressByDeal&&typeof payload.routeProgressByDeal==='object'?payload.routeProgressByDeal:{},
      stations=payload.routeStationsByDeal&&typeof payload.routeStationsByDeal==='object'?payload.routeStationsByDeal:{},
      assignments=payload.routeAssignmentByDeal&&typeof payload.routeAssignmentByDeal==='object'?payload.routeAssignmentByDeal:{},
      cohorts=payload.routeCohortsByDeal&&typeof payload.routeCohortsByDeal==='object'?payload.routeCohortsByDeal:{},
      ready=0,totalPoints=0;
  deals.forEach(function(d){
    if(!d)return;
    var key=clientRailText(d.deal_key||d.dealKey),id=clientRailText(d.deal_id||d.dealId),
        p=clientRailRouteProjection(planned[key]||planned[id]||null,'SOURCE_NOT_AVAILABLE'),
        a=clientRailRouteProjection(actual[key]||actual[id]||null,'NO_OBSERVED_HISTORY'),
        r=clientRailRouteProjection(remaining[key]||remaining[id]||null,'ROUTE_REMAINDER_UNAVAILABLE'),
        prog=progress[key]||progress[id]||null,
        routeStations=stations[key]||stations[id]||null,
        assignment=assignments[key]||assignments[id]||null,
        routeCohorts=cohorts[key]||cohorts[id]||[];
    if(p.points.length<2&&Array.isArray(routeStations)){
      var routePoints=routeStations.map(clientRailRoutePoint).filter(Boolean);
      if(routePoints.length>=2)p={status:assignment&&assignment.resolutionState==='RESOLVED'?'PUBLIC_SOURCE_ROUTE_RESOLVED':'SOURCE_NOT_AVAILABLE',points:routePoints,geometry:null,provenance:{source:'ROUTE_STATIONS_FALLBACK'}}
    }
    if(a.points.length<2&&prog&&Array.isArray(prog.actualPoints)){
      var actualPoints=prog.actualPoints.map(clientRailRoutePoint).filter(Boolean);
      if(actualPoints.length>=2)a={status:'OBSERVED_HISTORY',points:actualPoints,geometry:null,provenance:{source:'ROUTE_PROGRESS_ACTUAL_FALLBACK'}}
    }
    if(r.points.length<2&&prog&&Array.isArray(prog.remainingPoints)){
      var remainingPoints=prog.remainingPoints.map(clientRailRoutePoint).filter(Boolean);
      if(remainingPoints.length>=2)r={status:'ROUTE_REMAINDER',points:remainingPoints,geometry:null,provenance:{source:'ROUTE_PROGRESS_REMAINING_FALLBACK'}}
    }
    clientRailRouteAlias(planned,key,id,p);
    clientRailRouteAlias(actual,key,id,a);
    clientRailRouteAlias(remaining,key,id,r);
    clientRailRouteAlias(cohorts,key,id,Array.isArray(routeCohorts)?routeCohorts:[]);
    if(p.points.length>=2){ready++;totalPoints+=p.points.length}
  });
  payload.plannedRouteByDeal=planned;
  payload.actualRouteByDeal=actual;
  payload.remainingRouteByDeal=remaining;
  payload.routeCohortsByDeal=cohorts;
  window.__RONA_CLIENT_RAIL_ROUTE_PARITY__={version:'CLIENT_ADMIN_ROUTE_PARITY_V2',dealCount:deals.length,routeReadyDeals:ready,plannedPointCount:totalPoints,normalizedAt:new Date().toISOString()};
  document.documentElement.dataset.ronaClientRailRouteParity=ready>0?'READY':'NO_ROUTE';
  return payload
}
function clientRailRepairMapParity(){
  try{
    var mapData=window.__RONA_RAIL_MAP_DATA__,page=document.querySelector('#page-monitoring'),canvas=page&&page.querySelector('.rona-rail-v4-map-canvas'),state=canvas&&canvas.__ronaRailMapState;
    if(!mapData||!state)return false;
    var planned=mapData.plannedRoute&&Array.isArray(mapData.plannedRoute.points)?mapData.plannedRoute.points:[],
        actual=mapData.actualRoute&&Array.isArray(mapData.actualRoute.points)?mapData.actualRoute.points:[],
        remaining=mapData.remainingRoute&&Array.isArray(mapData.remainingRoute.points)?mapData.remainingRoute.points:[],
        cohortCount=Array.isArray(mapData.routeCohorts)?mapData.routeCohorts.length:0;
    if(planned.length<2&&actual.length<2&&remaining.length<2&&cohortCount===0)return false;
    state.context=Object.assign({},state.context||{},{
      dealKey:window.__RONA_RAIL_SELECTED_DEAL_KEY__||mapData.dealKey||null,
      dealId:window.__RONA_RAIL_SELECTED_DEAL_ID__||mapData.dealId||null,
      mapData:mapData
    });
    state.wagons=Array.isArray(mapData.wagonPositions)?mapData.wagonPositions:state.wagons;
    if(typeof railMapViewKey==='function')state.viewKey=railMapViewKey(state.context);
    if(typeof railMapFitPoints==='function'&&typeof railMapFitRoute==='function'){
      var rect=state.viewport.getBoundingClientRect(),fitPoints=railMapFitPoints(state.context),store=typeof railMapRuntimeStore==='function'?railMapRuntimeStore():null,saved=store&&store.views?store.views[state.viewKey]:null;
      if(fitPoints.length>=2&&!(saved&&saved.userTouched)){
        var fit=railMapFitRoute(fitPoints,Math.max(320,Math.round(rect.width||900)),Math.max(260,Math.round(rect.height||440)),state.minZoom||2,state.maxZoom||12);
        if(fit){
          state.lat=fit.lat;state.lng=fit.lng;state.zoom=fit.zoom;
          if(store&&store.views)store.views[state.viewKey]={lat:fit.lat,lng:fit.lng,zoom:fit.zoom,userTouched:false,routeFitApplied:true,reason:'ROUTE_FIT',updatedAt:Date.now()}
        }
      }
    }
    if(typeof railMapRequestDraw==='function')railMapRequestDraw(state);
    document.documentElement.dataset.ronaClientRailMapParity='ADMIN_CANONICAL_RENDERER_ACTIVE';
    document.documentElement.dataset.ronaClientRailRouteOverlay='RETIRED';
    window.__RONA_CLIENT_RAIL_MAP_PARITY_STATE__={
      version:'CLIENT_ADMIN_ROUTE_PARITY_V5_CANONICAL_RENDERER',
      renderer:'ADMIN_CURRENT_V81_CANONICAL',
      routeMode:window.__RONA_RAIL_ROUTE_COHORT_RENDER__&&window.__RONA_RAIL_ROUTE_COHORT_RENDER__.routeMode||null,
      plannedPoints:planned.length,
      actualPoints:actual.length,
      remainingPoints:remaining.length,
      routeCohortCount:cohortCount,
      dealKey:state.context&&state.context.dealKey||null,
      updatedAt:new Date().toISOString()
    };
    return true
  }catch(e){
    window.__RONA_CLIENT_RAIL_MAP_PARITY_ERROR__=String(e&&e.message||e);
    return false
  }
}
function clientRailScheduleMapParity(){[0,60,140,320,700,1400].forEach(function(ms){setTimeout(clientRailRepairMapParity,ms)})}
`;

const CLIENT_API=String.raw`
function clientRailText(v){return v===null||v===undefined?'':String(v).trim()}
function clientRailProviderBody(payload){return payload&&payload.data&&typeof payload.data==='object'?payload.data:(payload||{})}
async function clientRailFetch(url){var r=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}}),j=await r.json().catch(function(){return{}});if(!r.ok||j&&j.ok===false)throw new Error(String(j&&j.code||'HTTP_'+r.status));return j||{}}
function clientRailContextKey(ctx){return clientRailText(ctx&&ctx.client_id)+'|'+clientRailText(ctx&&ctx.contract_id)}
function clientRailAuthority(){return window.RONA_CLIENT_CONTEXT||null}
function clientRailBindContext(){var authority=clientRailAuthority();if(!authority||typeof authority.subscribe!=='function'||window.__RONA_CLIENT_RAIL_CONTEXT_BOUND__===true)return;window.__RONA_CLIENT_RAIL_CONTEXT_BOUND__=true;var initial=typeof authority.getCurrentContext==='function'?authority.getCurrentContext():null;window.__RONA_CLIENT_RAIL_CONTEXT_KEY__=clientRailContextKey(initial);window.__RONA_CLIENT_RAIL_CONTEXT_UNSUBSCRIBE__=authority.subscribe(function(ctx){var next=clientRailContextKey(ctx),prev=clientRailText(window.__RONA_CLIENT_RAIL_CONTEXT_KEY__);window.__RONA_CLIENT_RAIL_CONTEXT_KEY__=next;if(!prev||!next||next===prev)return;snapshot=null;lastRailSignature='';selected='';window.__RONA_RAIL_SELECTED_DEAL_KEY__=null;window.__RONA_RAIL_SELECTED_DEAL_ID__=null;window.__RONA_RAIL_MAP_DATA__=null;if(typeof renderShell==='function')renderShell();if(typeof sync==='function')setTimeout(function(){sync()},0)});window.addEventListener('rona:client-rail-invalidated',function(){if(typeof sync==='function')sync()},{passive:true})}
async function clientRailCurrentContext(){var authority=clientRailAuthority();if(!authority)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');clientRailBindContext();var ctx=typeof authority.getCurrentContext==='function'?authority.getCurrentContext():null;if(!ctx&&typeof authority.whenReady==='function')ctx=await authority.whenReady();if(!ctx||!clientRailText(ctx.client_id)||!clientRailText(ctx.contract_id))throw new Error('CLIENT_CONTRACT_CONTEXT_REQUIRED');return ctx}
function clientRailContextQuery(ctx){return'?clientId='+encodeURIComponent(clientRailText(ctx&&ctx.client_id))+'&contractId='+encodeURIComponent(clientRailText(ctx&&ctx.contract_id))}
async function api(path){
  var context=await clientRailCurrentContext(),contextKey=clientRailContextKey(context),query=clientRailContextQuery(context);
  window.__RONA_CLIENT_RAIL_CONTEXT_KEY__=contextKey;
  var envelope=await clientRailFetch('/portal/api/v1/client/rail-canonical'+query),payload=clientRailNormalizeRouteParity(clientRailProviderBody(envelope));
  var activeAuthority=clientRailAuthority(),activeContext=activeAuthority&&typeof activeAuthority.getCurrentContext==='function'?activeAuthority.getCurrentContext():null;
  if(clientRailContextKey(activeContext)!==contextKey)throw new Error('CLIENT_CONTEXT_CHANGED_DURING_RAIL_LOAD');
  if(!payload||!payload.railReadModel||!clientRailText(payload.railReadModel.modelVersion)||!clientRailText(payload.railReadModel.overlayMode))throw new Error('CLIENT_RAIL_CANONICAL_READ_MODEL_DEGRADED');
  if(clientRailText(payload.railReadModel.clientId)!==clientRailText(context.client_id)||clientRailText(payload.railReadModel.contractId)!==clientRailText(context.contract_id))throw new Error('CLIENT_RAIL_CANONICAL_CONTEXT_MISMATCH');
  window.__RONA_CLIENT_RAIL_AUTHORITY_STATE__={source:'AUTHORITATIVE_CLIENT_RAIL_CANONICAL_READ_MODEL_V1',context_source:'RONA_CLIENT_CONTEXT',server_scope:'AUTHENTICATED_CLIENT_CONTRACT',client_id:clientRailText(context.client_id),contract_id:clientRailText(context.contract_id),endpoint:'/portal/api/v1/client/rail-canonical',model_version:clientRailText(payload.railReadModel.modelVersion),source_policy:clientRailText(payload.railReadModel.sourcePolicy),deal_count:Array.isArray(payload.deals)?payload.deals.length:0,rail_count:Array.isArray(payload.rail)?payload.rail.length:0,updated_at:new Date().toISOString()};
  document.documentElement.dataset.ronaClientRailSource='AUTHORITATIVE_CLIENT_RAIL_CANONICAL_READ_MODEL_V1';
  document.documentElement.dataset.ronaClientRailOperational='true';
  window.dispatchEvent(new CustomEvent('rona:client-rail:authority',{detail:window.__RONA_CLIENT_RAIL_AUTHORITY_STATE__}));
  setTimeout(clientRailScheduleMapParity,0);
  return payload
}
`;

export async function onRequest(context){
  const response=await adminRailCurrent(context);
  let source=await response.text();
  const checks=[
    ['ADMIN_MARKER',ADMIN_MARKER],['ADMIN_ROUTE_MARKER',ADMIN_ROUTE_MARKER],['API_VAR_FROM',API_VAR_FROM],['API_FROM',API_FROM],['WAIT_FROM',WAIT_FROM],['START_HEAD_FROM',START_HEAD_FROM],['LOCATION_FROM',LOCATION_FROM],['BIND_FROM',BIND_FROM],['ADMIN_SINGLE_TITLE_HIDDEN_HERO',ADMIN_SINGLE_TITLE_HIDDEN_HERO],
    ['ROOT_CLASS','rona-rail-v4-root'],['WORK_CLASS','rona-rail-v4-work'],['SELECTOR_CLASS','rona-rail-v6-selector'],['WAGON_CLASS','rona-rail-v6-wagon-box'],['REAL_MAP_CLASS','rona-rail-v7-real'],['LOCAL_TILE','/portal/map-assets/osm/']
  ];
  const missing=checks.filter(([,marker])=>!source.includes(marker)).map(([name])=>name);
  if(response.status!==200||missing.length){
    return new Response(`CLIENT_RAIL_ADMIN_CANONICAL_SOURCE_MISMATCH status=${response.status} missing=${missing.join(',')||'NONE'}`,{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source
    .replace("'use strict';","'use strict';\n"+CLIENT_PREAMBLE)
    .replace(API_VAR_FROM,API_VAR_TO)
    .replace(API_FROM,CLIENT_API)
    .replace(WAIT_FROM,'function waitAdminReady(){}')
    .replace(START_HEAD_FROM,START_HEAD_TO)
    .replace(BIND_FROM,BIND_TO)
    .replace(CLIENT_V81_POLL_FROM,CLIENT_POLL_TO)
    .replace(CLIENT_LEGACY_TIMER_FROM,'')
    .replace(LOCATION_FROM,LOCATION_TO)
    .replace(ADMIN_SINGLE_TITLE_HIDDEN_HERO,'')
    .split("'/admin/bootstrap'").join("'/client/rail-canonical'");
  if(source.includes(ADMIN_SINGLE_TITLE_HIDDEN_HERO)){
    return new Response('CLIENT_RAIL_TITLE_HIDDEN_AFTER_ADAPT',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  if(source.includes(CLIENT_V81_POLL_FROM)||source.includes(CLIENT_LEGACY_TIMER_FROM)||source.includes("timer=setInterval(function(){var page=q('#page-monitoring')")||source.includes('timer=setInterval(sync,30000)')){
    return new Response('CLIENT_RAIL_PERIODIC_REFRESH_REMAINS',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
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
