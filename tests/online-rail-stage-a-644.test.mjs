import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest as railV6 } from '../functions/portal/rail-current-v6-ui.js';
import { onRequest as railV7 } from '../functions/portal/rail-current-v7-real-map-ui.js';
import { onRequest as railV81 } from '../functions/portal/rail-current-v81-maplibre-ui.js';
import { onRequest as adminMainUi } from '../functions/portal/admin-main-ui-current.js';

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

test('Background rail sync is data-change-only and repair is viewport-safe',()=>{
  assert.match(v81,/function railDataSignature\(data\)/);
  assert.match(v81,/if\(!railRootReady\(\)\|\|sig!==lastRailSignature\)\{render\(snapshot\);lastRailSignature=sig\}/);
  assert.match(v81,/mode:'DATA_CHANGE_ONLY'/);
  assert.match(v81,/var page=q\('#page-monitoring'\),ready=page&&q\('\[data-rail-current-v4="ready"\],\[data-rail-current-root="ready"\]'/);
  assert.match(v81,/if\(!ready\)paint\(\)/);
  assert.doesNotMatch(v81,/ensureRailCompactDarkStyle\(\);\s*paint\(\);\s*ensureRailTariffPanel\(\);\s*sync\(\)/);
});

test('Map data contract is source-only and prepared for expeditor XLSX via Rail AI',()=>{
  assert.match(v81,/RAIL_MAP_DATA_CONTRACT_V1/);
  assert.match(v81,/EXPEDITOR_XLSX_VIA_RAIL_AI/);
  assert.match(v81,/geometryPolicy:'SOURCE_ONLY_NO_GEOCODING'/);
  assert.match(v81,/coordinatesPolicy:'TRUSTED_SOURCE_ONLY'/);
  assert.match(v81,/externalProviderIntegration:false/);
  assert.match(v81,/productionPolling:false/);
  assert.match(v81,/plannedRoute:\{status:/);
  assert.match(v81,/wagonPositions:positions/);
  assert.doesNotMatch(v81,/MOVIZOR/i);
});

test('Admin single-owner rail shell remains intact and neighboring owners are untouched',()=>{
  assert.match(admin,/monitoring:renderRailCurrentShell,/);
  assert.match(admin,/deals:renderDealsCurrentShell,/);
  assert.match(admin,/prices:renderPricesCurrentShell,/);
  assert.match(admin,/payments/);
  assert.match(admin,/authority-change-only-v2/);
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


test('Route is visually restrained, unlabeled, and station wagon markers stay clustered',()=>{
  assert.match(v81,/function railMapClusterKey\(w,coord\)/);
  assert.match(v81,/groups=new Map\(\)/);
  assert.match(v81,/el\('button','rona-rail-v7-marker',String\(g\.wagons\.length\)\)/);
  assert.match(v81,/g\.station\+': '\+g\.wagons\.length\+' вагонов'/);
  assert.match(v81,/function railMapRouteDraw\(state,left,top,width,height,z\)/);
  assert.match(v81,/rona-rail-v7-route-casing/);
  assert.match(v81,/rona-rail-v7-route-line/);
  assert.doesNotMatch(v81,/Плановый маршрут/);
  assert.doesNotMatch(v81,/пунктир — плановый маршрут/i);
  assert.match(v81,/\.rona-rail-v7-map-status\{display:none!important\}/);
  assert.match(v81,/\.rona-rail-v7-real \.rona-rail-v4-map-note\{display:none!important\}/);
  assert.doesNotMatch(v81,/actualRoute|actualTrack|GPS_TRACK_CONFIRMED/);
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
