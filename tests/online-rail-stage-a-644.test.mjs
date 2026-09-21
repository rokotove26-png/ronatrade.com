import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest as railV6 } from '../functions/portal/rail-current-v6-ui.js';
import { onRequest as railV7 } from '../functions/portal/rail-current-v7-real-map-ui.js';
import { onRequest as railV81 } from '../functions/portal/rail-current-v81-maplibre-ui.js';
import { onRequest as adminMainUi } from '../functions/portal/admin-main-ui-current.js';
import { overlayRailReadModel } from '../supabase/functions/rona-owner-acceptance/rail-admin-read-model-overlay.mjs';

async function scriptOf(fn){
  const response=await fn({});
  if(response.status!==200){
    const body=await response.text().catch(()=>'');
    assert.equal(response.status,200,body);
  }
  return response.text();
}

const [v6,v7,v81,admin]=await Promise.all([
  scriptOf(railV6),
  scriptOf(railV7),
  scriptOf(railV81),
  scriptOf(adminMainUi),
]);

test('Issue 644 Stage A generated rail runtimes compile',()=>{
  new Function(v6);
  new Function(v7);
  new Function(v81);
});

test('Deal is the sole top-level Online Rail selection owner',()=>{
  assert.match(v81,/rona-rail-v6-select-label','Сделка'/);
  assert.match(v81,/o\.value=d\.dealKey/);
  assert.match(v81,/railDealKey\(x,data\)===selectedDeal\.dealKey/);
  assert.match(v81,/selectedDealKey:selectedDeal&&selectedDeal\.dealKey/);
  assert.match(v81,/railCount:visible\.length/);
  assert.match(v81,/wagonCount:dealWagons\.length/);
  assert.match(v81,/chosenW=dealWagons/);
  assert.match(v81,/\['ГУ-12','Вагон','Текущая станция'/);
  assert.doesNotMatch(v81,/Все ГУ-12/);
});

test('Deal identity is canonical deal_key, not GU-12 text',()=>{
  assert.match(v81,/selectionOwner:'DEAL'/);
  assert.match(v81,/selectionKey:'deal_key'/);
  assert.match(v81,/function railDealForDoc\(doc,data\)/);
  assert.match(v81,/String\(d\.deal_key\|\|d\.deal_id\|\|''\)/);
  assert.match(v81,/railDealById\(data,doc\.deal_id\)/);
  assert.match(v81,/window\.__RONA_RAIL_SELECTED_DEAL_KEY__/);
});

test('Map viewport lives outside DOM and persists per deal',()=>{
  assert.match(v81,/RAIL_MAP_VIEWPORT_STATE_V1/);
  assert.match(v81,/window\.__RONA_RAIL_MAP_VIEWPORT_STATE__/);
  assert.match(v81,/return key\?'DEAL:'\+key:'DEAL:UNBOUND'/);
  assert.match(v81,/function railMapPersistViewport\(state,reason,userTouched\)/);
  assert.match(v81,/function railMapInitialViewport\(context,width,height,minZoom,maxZoom\)/);
  assert.match(v81,/railMapPersistViewport\(state,reason\|\|'USER_ZOOM',true\)/);
  assert.match(v81,/railMapPersistViewport\(state,'USER_PAN',true\)/);
  assert.match(v81,/railMapPersistViewport\(state,'HOME',true\)/);
  assert.match(v81,/function railMapDefaultViewport\(\)\{return\{lat:52\.5,lng:68,zoom:3\}\}/);
});

test('Route fit is one-time per deal and yields to user pan/zoom',()=>{
  assert.match(v81,/routeFitApplied/);
  assert.match(v81,/!saved\.userTouched&&!saved\.routeFitApplied&&route\.length>=2/);
  assert.match(v81,/reason:'ROUTE_FIT'/);
  assert.match(v81,/routeFitApplied:reason==='HOME'\?true:/);
});

test('First open never commits a non-authoritative inherited Admin snapshot',()=>{
  assert.match(v81,/if\(!railReadModelReady\(snapshot\)\)\{/);
  assert.match(v81,/__RONA_RAIL_FIRST_PAINT_AUTHORITY__/);
  assert.match(v81,/mode:'WAIT_FOR_AUTHORITATIVE_READ_MODEL'/);
  assert.match(v81,/mode:'AUTHORITATIVE_READ_MODEL'/);
  assert.match(v81,/if\(!railRootReady\(\)\)renderShell\(\);return false/);
});

test('Background refresh preserves the last authoritative Rail read model when the overlay degrades',()=>{
  assert.match(v81,/function railReadModelReady\(data\)/);
  assert.match(v81,/function railRefreshAcceptable\(next\)/);
  assert.match(v81,/if\(!railRefreshAcceptable\(next\)\)/);
  assert.match(v81,/PRESERVE_LAST_GOOD_ON_DEGRADED_READ_MODEL/);
  assert.match(v81,/WAIT_FOR_AUTHORITATIVE_READ_MODEL/);
  assert.match(v81,/RAIL_READ_MODEL_DEGRADED/);
});

test('Background rail sync is data-change-only and repair is viewport-safe',()=>{
  assert.match(v81,/function railDataSignature\(data\)/);
  assert.match(v81,/if\(!railRootReady\(\)\|\|sig!==lastRailSignature\)\{render\(snapshot\);lastRailSignature=sig;/);
  assert.match(v81,/mode:'DATA_CHANGE_ONLY'/);
  assert.match(v81,/var page=q\('#page-monitoring'\),ready=page&&q\('\[data-rail-current-v4="ready"\],\[data-rail-current-root="ready"\]'/);
  assert.match(v81,/if\(!ready\)paint\(\)/);
  assert.doesNotMatch(v81,/ensureRailCompactDarkStyle\(\);\s*paint\(\);\s*ensureRailTariffPanel\(\);\s*sync\(\)/);
});

test('Map data contract projects planned, traversed and remaining source-backed route state',()=>{
  assert.match(v81,/RAIL_MAP_DATA_CONTRACT_V3_COHORTS/);
  assert.match(v81,/function railDealMapValue\(data,name,dealKey,dealId\)/);
  assert.match(v81,/actualRouteByDeal/);
  assert.match(v81,/remainingRouteByDeal/);
  assert.match(v81,/routeProgressByDeal/);
  assert.match(v81,/routeStationsByDeal/);
  assert.match(v81,/routeAssignmentByDeal/);
  assert.match(v81,/plannedRoute:planned,actualRoute:actual,remainingRoute:remaining/);
  assert.match(v81,/wagonPositions:positions/);
  assert.doesNotMatch(v81,/MOVIZOR/i);
});

test('Admin single-owner rail shell remains intact and neighboring owners are untouched',()=>{
  assert.match(admin,/monitoring:renderRailCurrentShell,/);
  assert.match(admin,/deals:renderDealsCurrentShell,/);
  assert.match(admin,/prices:renderPricesCurrentShell,/);
  assert.match(admin,/payments/);
  assert.match(admin,/authority-change-only-v2/);
  assert.match(admin,/__RONA_RAIL_MAIN_UI_FALLBACK_SELF_HEAL__='20260921-dynamic-v1'/);
  assert.match(admin,/\[data-rail-safe-fallback\]/);
  assert.match(admin,/:not\(\[data-rail-safe-fallback\]\)/);
  assert.match(admin,/fallback\.remove\(\)/);
  assert.match(admin,/current-v81-main-ui-self-healed/);
  assert.match(admin,/OWNER_MAIN_CURRENT_SHELL_SELF_HEAL/);
});


test('Stage A.1 active Admin runtime physically retires the legacy Rail renderer',()=>{
  assert.match(admin,/__RONA_RAIL_SINGLE_OWNER__='stage-a1-current-only-v1'/);
  assert.match(admin,/monitoring:renderRailCurrentShell,/);
  assert.match(admin,/renderPayments\(\);renderCash\(\);renderRailCurrentShell\(\);renderRadio\(\);renderAnalytics\(\);/);
  assert.doesNotMatch(admin,/function renderRail\(\)\{/);
  assert.doesNotMatch(admin,/monitoring:renderRail,/);
  assert.doesNotMatch(admin,/renderRail\(\);/);
  assert.doesNotMatch(admin,/replacePage\('monitoring',/);
  assert.match(admin,/window\.__RONA_OWNER_ADMIN_RENDER__=renderAdmin/);
  assert.match(admin,/window\.__RONA_OWNER_ADMIN_REFRESH_TICK__=ownerAdminRefreshTick/);
  assert.match(admin,/window\.__RONA_OWNER_AI_REFRESH__=refreshAdmin/);
});

test('Stage A markers are exposed without removing prior current owner markers',()=>{
  assert.match(v81,/20260918-deal-owned-map-state-v1/);
  assert.match(v81,/20260918-deal-map-persistence-v1/);
  assert.match(v81,/20260918-square-map-aligned-v8\.9/);
  assert.match(v81,/20260825-raster-first-v8\.2/);
});



test('Current wagon clusters remain marker overlays and never rewrite route topology',()=>{
  assert.match(v81,/function railMapPlannedRoutePoints\(context\)/);
  assert.match(v81,/function railMapObservedRoutePoints\(context\)/);
  assert.match(v81,/waypointRole:'OBSERVED_CURRENT'/);
  assert.match(v81,/sourceKind:'OBSERVED_CURRENT'/);
  assert.match(v81,/function railMapRoutePoints\(context\)\{return railMapPlannedRoutePoints\(context\)\}/);
  assert.match(v81,/__RONA_RAIL_ROUTE_TOPOLOGY__='20260921-current-markers-independent-v1'/);
  assert.doesNotMatch(v81,/function railMapSegmentProjection\(point,a,b\)/);
  assert.doesNotMatch(v81,/buckets\[best\.segment\]\.push/);
  assert.doesNotMatch(v81,/out\.push\(x\.point\)/);
});

test('Route is split into observed traversal and remaining corridor without fake GPS semantics',()=>{
  assert.match(v81,/function railMapClusterKey\(w,coord\)/);
  assert.match(v81,/groups=new Map\(\)/);
  assert.match(v81,/el\('button','rona-rail-v7-marker',String\(g\.wagons\.length\)\)/);
  assert.match(v81,/g\.station\+': '\+g\.wagons\.length\+' вагонов'/);
  assert.match(v81,/function railMapActualRoutePoints\(context\)/);
  assert.match(v81,/function railMapRemainingRoutePoints\(context\)/);
  assert.match(v81,/rona-rail-v7-route-actual/);
  assert.match(v81,/rona-rail-v7-route-remaining/);
  assert.match(v81,/hasSplit=actual\.length>=2\|\|remaining\.length>=2/);
  assert.doesNotMatch(v81,/Плановый маршрут/);
  assert.doesNotMatch(v81,/GPS_TRACK_CONFIRMED|actualTrack/);
  assert.match(v81,/\.rona-rail-v7-map-status\{display:none!important\}/);
  assert.match(v81,/\.rona-rail-v7-real \.rona-rail-v4-map-note\{display:none!important\}/);
});

test('Split wagon histories keep the legacy route line visual while preserving cohort geometry',()=>{
  assert.match(v81,/function railMapRouteCohorts\(context\)/);
  assert.match(v81,/function railMapCohortSegments\(context\)/);
  assert.match(v81,/function railMapCohortDraw\(svg,context,left,top,z\)/);
  assert.match(v81,/railMapSvgPolyline\(svg,item\.points,left,top,z,'rona-rail-v7-cohort-casing',lineClass\)/);
  assert.match(v81,/\.rona-rail-v7-cohort-line\{[^}]*stroke:#9f332f;stroke-width:4\.2/);
  assert.match(v81,/\.rona-rail-v7-cohort-line\.is-unresolved\{stroke:#9f332f;stroke-dasharray:none;opacity:1\}/);
  assert.match(v81,/rona-rail-v7-border-crossing/);
  assert.match(v81,/rona-rail-v7-border-unresolved/);
  assert.match(v81,/точный погранпереход не подтвержден/);
  assert.match(v81,/__RONA_RAIL_ROUTE_COHORTS__='20260921-route-cohorts-v1'/);
  assert.doesNotMatch(v81,/function railMapRenderLegend\(state\)/);
  assert.doesNotMatch(v81,/Группы вагонов/);
  assert.doesNotMatch(v81,/OPERATIONAL_DEFAULT_WITH_FULL_ROUTE_TOGGLE_V1/);
});

test('All active deals drive the selector and monitoring state comes from trusted current positions',()=>{
  assert.match(v81,/Array\.isArray\(data&&data\.deals\)\?data\.deals:\[\]/);
  assert.match(v81,/life==='CLOSED'\|\|business==='CANCELLED'/);
  assert.match(v81,/function railDealMonitoringState\(dealWagons\)/);
  assert.match(v81,/active=monitorState\.count/);
  assert.match(v81,/attention=monitorState\.attention/);
  assert.match(v81,/Мониторинг активен/);
  assert.match(v81,/Мониторинг не запущен/);
  assert.doesNotMatch(v81,/Онлайн-мониторинг пока не запущен/);
});

test('Compact wagon table is owned by the left control card and has only the approved columns',()=>{
  assert.match(v81,/\['ГУ-12','Вагон','Текущая станция','Код станции','Последнее обновление'\]/);
  assert.match(v81,/compact\.classList\.add\('rona-rail-v6-position-table'\);control\.append\(compact\)/);
  assert.doesNotMatch(v81,/\['ГУ-12','Вагон','Текущая станция','Код','Операция','Статус','Последнее обновление'\]/);
});


test('Owner Rail view removes the tariff matrix from the Online Rail surface',()=>{
  assert.match(v81,/function removeRailTariffPanel\(\)/);
  assert.match(v81,/__RONA_RAIL_TARIFF_MATRIX_REMOVED__/);
  assert.doesNotMatch(v81,/Матрица ЖД-тарифов/);
  assert.doesNotMatch(v81,/tariffToggle\.textContent/);
  assert.doesNotMatch(v81,/host\.append\(tariff\)/);
  assert.doesNotMatch(v81,/if\(matrix\)host\.append\(matrix\)/);
});

test('Desktop map captures the owner DEAL-2026-004 frame-bottom baseline once and freezes it across deal selection',()=>{
  assert.match(v81,/RONA_RAIL_FALLBACK_DESKTOP_CARD_HEIGHT=960/);
  assert.match(v81,/function railFrozenDesktopCardHeight\(left,right\)/);
  assert.match(v81,/window\.__RONA_RAIL_FROZEN_DESKTOP_CARD_HEIGHT__/);
  assert.match(v81,/selectedId==='DEAL-2026-004'/);
  assert.match(v81,/leftRect\.bottom-rightRect\.top/);
  assert.match(v81,/window\.__RONA_RAIL_FROZEN_DESKTOP_CARD_HEIGHT__=measured/);
  assert.match(v81,/mode:'OWNER_FRAME_BOTTOM_FROZEN'/);
  assert.match(v81,/function alignRailMapHeightToOperations\(\)/);
  assert.match(v81,/var fixedHeight=railFrozenDesktopCardHeight\(left,right\)/);
  assert.match(v81,/right\.style\.setProperty\('height',fixedHeight\+'px','important'\)/);
  assert.match(v81,/right\.style\.setProperty\('min-height',fixedHeight\+'px','important'\)/);
  assert.match(v81,/right\.style\.setProperty\('max-height',fixedHeight\+'px','important'\)/);
  assert.match(v81,/mode:'FROZEN_OWNER_FRAME_BOTTOM'/);
  assert.match(v81,/scheduleRailMapHeightAlignment/);
  assert.match(v81,/\.rona-rail-v7-real \.rona-rail-v4-map-title\{[^}]*background:transparent!important/);
  assert.match(v81,/border:0!important/);
  assert.match(v81,/box-shadow:none!important/);
  assert.match(v81,/aspect-ratio:auto!important/);
});

test('Read-model overlay publishes per-deal route engine products without mutating business records',()=>{
  const body={data:{rail:[{rail_document_key:'doc-1',rail_document_id:'R1',wagons:[]}]}};
  const model={
    modelVersion:'RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4',
    sourcePolicy:'PUBLIC_SOURCE_ROUTE_GRAPH_PLUS_TRUSTED_DISLOCATION_HISTORY_V1',
    generatedAt:'2026-09-19T00:00:00Z',
    deals:[{
      dealKey:'deal-key-1',dealId:'DEAL-1',
      plannedRoute:[{status:'PUBLIC_SOURCE_ROUTE_RESOLVED',points:[{stationCode:'151408',lat:51,lng:29}]}],
      actualRoute:{status:'OBSERVED_HISTORY',points:[{stationCode:'151408',lat:51,lng:29},{stationCode:'625501',lat:51.4,lng:46.08}]},
      remainingRoute:{status:'ROUTE_REMAINDER',points:[{stationCode:'625501',lat:51.4,lng:46.08},{stationCode:'742705',lat:40.4,lng:71.8}]},
      routeProgress:{state:'OBSERVED_AND_MATCHED',furthestMatchedSequence:51},
      routeStations:[{sequence:1,stationCode:'151408'},{sequence:85,stationCode:'742705'}],
      routeAssignment:{resolutionState:'RESOLVED',originEsr:'151408',destinationEsr:'742705'},
      routeCohorts:[{cohortKey:'COHORT:test',wagonCount:1,wagonNumbers:['1'],observationSignature:'151408>625501',observations:[{station:'Origin',stationCode:'151408',lat:51,lng:29},{station:'Анисовка',stationCode:'625501',lat:51.4,lng:46.08}],segments:[]}],
      wagonPositions:[{wagonNumber:'1',railDocumentKey:'doc-1',railDocumentId:'R1',station:'Анисовка',stationCode:'625501',positionStatus:'TRUSTED',trustedCoordinates:{lat:51.4,lng:46.08,trusted:true}}]
    }]
  };
  const out=overlayRailReadModel(body,model);
  assert.equal(out.data.railReadModel.modelVersion,'RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4');
  assert.equal(out.data.railReadModel.overlayMode,'DISPLAY_ROUTE_HISTORY_AND_CURRENT_POSITION_V1');
  assert.equal(out.data.actualRouteByDeal['deal-key-1'].points.length,2);
  assert.equal(out.data.remainingRouteByDeal['DEAL-1'].points.length,2);
  assert.equal(out.data.routeProgressByDeal['deal-key-1'].furthestMatchedSequence,51);
  assert.equal(out.data.routeAssignmentByDeal['DEAL-1'].destinationEsr,'742705');
  assert.equal(out.data.routeCohortsByDeal['deal-key-1'][0].cohortKey,'COHORT:test');
  assert.equal(out.data.rail[0].wagons[0].stationCode,'625501');
});
