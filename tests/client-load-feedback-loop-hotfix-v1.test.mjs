import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const read=p=>readFile(p,'utf8');
const [context,deals,firstPaint,background,messages,prices,dealDocs,lifecycle,home,passport]=await Promise.all([
  read('assets/portal-runtime/client-context-selection-authority-v1.js'),
  read('assets/portal-runtime/client-deals-authoritative-v1.js'),
  read('assets/portal-runtime/client-section-first-paint-v1.js'),
  read('assets/portal-runtime/client-background-section-preload-v1.js'),
  read('assets/portal-runtime/client-messages-archive-v1.js'),
  read('assets/portal-runtime/client-price-sync-v1.js'),
  read('assets/portal-runtime/client-deal-documents-v5.js'),
  read('assets/portal-runtime/client-deal-lifecycle-v1.js'),
  read('assets/portal-runtime/client-home-command-center-v2.js'),
  read('assets/portal-runtime/client-deal-passport-v1.js')
]);

assert.match(context,/loadCurrentProjection/);
assert.match(context,/x-rona-client-source/);
assert.match(context,/__RONA_CLIENT_CALLER_MAP__/);
assert.match(context,/getCurrentProjection/);
assert.match(context,/CLIENT_CONTEXT_PROJECTION_SCOPE_MISMATCH/);
assert.match(context,/data-rona-current-context-slot/);
assert.match(context,/function bindLegacyScope/);
assert.match(context,/function bindHeaderSlots/);
assert.match(context,/function renderSlot/);
assert.match(context,/state\.observer\.observe\(document\.body,\{childList:true,subtree:true\}\)/);
assert.match(context,/if\(!pair\.clientIds\.length\|\|!pair\.contractIds\.length/);
assert.match(context,/if\(!el\|\|el\.childElementCount!==0\)return null/);
assert.match(context,/if\(!type\|\|el\.childElementCount!==0\)return/);
for(const forbidden of [
  'staleHeaderNames','companyCandidate','syncContextScope','replace(CONTRACT_RE','replace(CLIENT_RE','ronaClientBaseText',
  "document.querySelectorAll('body *')","attributeFilter:['value','data-client-id','data-contract-id']"
])assert.doesNotMatch(context,new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.doesNotMatch(context,/FARG(?:[‘'ʼ])?ONA/iu);

// Deals consumes the already coordinated current projection. It must never own a
// /context request and every current-projection event replaces state.payload.
assert.match(deals,/getCurrentProjection/);
assert.match(deals,/function currentProjection/);
assert.match(deals,/function adoptCurrentProjection/);
assert.match(deals,/state\.payload=projection/);
assert.match(deals,/rona:client-current-projection/);
assert.match(deals,/RONA_CLIENT_CONTEXT_CURRENT_PROJECTION/);
assert.doesNotMatch(deals,/\/v1\/client\/context/);
assert.doesNotMatch(deals,/whenCurrentProjection\s*\(/);
assert.doesNotMatch(deals,/observe\(document\.documentElement/);
assert.doesNotMatch(deals,/attributeFilter:\[[^\]]*(?:hidden|aria-hidden)/s);
assert.doesNotMatch(deals,/setInterval\([^\n]*refresh/);
assert.doesNotMatch(deals,/addEventListener\('focus'[^\n]*refresh/);
assert.match(deals,/state\.observer\.observe\(r,\{childList:true,subtree:true\}\)/);
assert.match(deals,/function setHidden/);
assert.match(deals,/function contextMatchesPayload/);
assert.match(deals,/!pair\.clientIds\.length\|\|!pair\.contractIds\.length/);

// The production passport owns the modal structure and visual system. The hotfix
// only binds explicit production field/context slots after the native drawer has
// opened for the exact requested deal and the exact workflow row has been loaded.
assert.match(passport,/20260831-client-deal-passport-v2-centered-status/);
assert.match(passport,/const ROOT_CLASS='rona-deal-command-center-v3'/);
assert.match(passport,/data-rona-command-field-value/);
assert.match(passport,/data-rona-command-grid/);
assert.match(passport,/font-size:20px!important/);
assert.match(deals,/function nativeCloseControl/);
assert.match(deals,/function nativeBackdrop/);
assert.match(deals,/control\.click\(\)/);
assert.match(deals,/function drawerFor\(id,key\)\{const all=drawers\(\)\.filter\(r=>visible\(r\)/);
assert.match(deals,/const exact=all\.filter\(r=>drawerId\(r\)===id/);
assert.match(deals,/return exact\.length===1\?exact\[0\]:null/);
assert.match(deals,/function passportSlotsReady/);
assert.match(deals,/function waitForExactDrawer/);
assert.match(deals,/function workflowRowValid/);
assert.match(deals,/SERVER_AUTHORITATIVE_REALIZATION_V1/);
assert.match(deals,/function clearDrawerBinding/);
assert.match(deals,/data-rona-current-context-slot/);
assert.match(deals,/setData\(r,'ronaAuthoritativeBinding','authoritative-binding'\)/);
assert.doesNotMatch(deals,/return unbound\.length===1/);
assert.doesNotMatch(deals,/scheduleDrawerBind\(id,null/);
assert.doesNotMatch(deals,/function rewriteTextNodes|function exactLeafs|function fieldContainer|function setCompanyContext|function setLegal/);
assert.doesNotMatch(deals,/Синхронизация с сервером/);
assert.doesNotMatch(deals,/closeDrawer\(r,'authoritative-binding'\)/);
assert.doesNotMatch(deals,/releaseDrawer\(r\)/);
assert.doesNotMatch(deals,/function drawerCloseControl|function backdropDrawer|function onKeydown|closeOtherDrawers/);
assert.match(deals,/\.rona-deal-command-center-v3,\[data-rona-deal-passport\]/);
assert.doesNotMatch(deals,/RONA-C004|DEAL-2026-007|DEAL-2026-008|FARG(?:[‘'ʼ])?ONA/iu);

// The approved production lifecycle visual contract remains intact. The binder
// clears an old lifecycle before a new deal is loaded, then the lifecycle owner
// recreates it from authoritative realization_status for the bound deal/context.
assert.match(lifecycle,/const FLOW_ID='rona-deal-realization-flow-v3'/);
assert.match(lifecycle,/SERVER_AUTHORITATIVE_REALIZATION_V1/);
assert.match(lifecycle,/data-lifecycle-stage/);
assert.match(lifecycle,/rona-deal-lifecycle-v1__progress/);
assert.match(lifecycle,/rona-deal-lifecycle-v1__node/);
assert.match(lifecycle,/Выполнено \$\{done\} из \$\{stages\.length\}/);
assert.match(lifecycle,/rootIsAuthoritative/);
assert.match(lifecycle,/rona:client:deal-authoritative-detail/);
assert.match(deals,/drawer\.querySelector\('#rona-deal-realization-flow-v3'\)\?\.remove\(\)/);
assert.doesNotMatch(deals,/function resetDrawer/);

// First-paint receives the same projection through its legacy cache contract.
// It may construct the legacy /context cache key, but it must perform no network
// call and must not invoke legacy background loader functions.
assert.match(firstPaint,/getCurrentProjection/);
assert.match(firstPaint,/seedCurrentProjectionCache/);
assert.match(firstPaint,/__RONA_CLIENT_BACKGROUND_CACHE__/);
assert.match(firstPaint,/RONA_CLIENT_CONTEXT_CURRENT_PROJECTION/);
assert.match(firstPaint,/rona:client-current-projection/);
assert.match(firstPaint,/body:\{ok:true,data:projection\}/);
assert.doesNotMatch(firstPaint,/\bfetch\s*\(/);
assert.doesNotMatch(firstPaint,/PRELOAD_LOADER_RE|runBackgroundPreloaders|__RONA_LOAD_CLIENT_|__RONA_REFRESH_CLIENT_/);
assert.doesNotMatch(firstPaint,/RONA-C004|DEAL-2026-007|DEAL-2026-008|FARG(?:[‘'ʼ])?ONA/iu);

// Existing build/QA still recognizes the legacy route contract. The hotfix keeps
// those routes as inert lazy-route metadata only; this runtime must not fetch or
// schedule an interval itself during initial load.
assert.doesNotMatch(background,/\bfetch\s*\(/);
assert.doesNotMatch(background,/setInterval\s*\(/);
assert.doesNotMatch(background,/setTimeout\s*\([^\n]*(?:marketPath|shipmentsPath|railPath)/);
assert.match(background,/mode:'LAZY_BY_SECTION'/);
assert.match(background,/function lazyRouteManifest/);
assert.match(background,/shipments:shipmentsPath\(current\)/);
assert.match(background,/rail:railPath\(current\)/);

assert.doesNotMatch(messages,/Promise\.all\s*\(/);
assert.match(messages,/loadMessages/);
assert.match(messages,/loadArchive/);
assert.match(messages,/client-messages-archive-v1:messages/);
assert.match(messages,/client-messages-archive-v1:archive/);
assert.doesNotMatch(messages,/function start\(\)[\s\S]*?refresh\(\)/);

assert.doesNotMatch(prices,/setInterval/);
assert.doesNotMatch(prices,/window\.addEventListener\('pageshow',[^\n]*refresh/);
assert.match(prices,/client-price-sync-v1:prices/);

assert.doesNotMatch(dealDocs,/setInterval/);
assert.doesNotMatch(dealDocs,/visibilitychange[^\n]*loadData/);
assert.match(dealDocs,/rona:client:deals-rendered/);
assert.match(dealDocs,/client-deal-documents-v5/);

assert.doesNotMatch(lifecycle,/new MutationObserver/);
assert.doesNotMatch(lifecycle,/addEventListener\('focus'/);
assert.doesNotMatch(lifecycle,/visibilitychange/);
assert.match(lifecycle,/client-deal-lifecycle-v1/);

// Rail remains the production runtime. This delta does not rewrite it; eager Rail
// network work remains deferred by the existing lazy background coordinator.
assert.match(background,/scopedPath\('\/v1\/client\/shipments'/);
assert.match(background,/scopedPath\('\/v1\/client\/rail'/);
assert.match(context,/\/portal\/api\/v1\/client\/shipments/);
assert.match(context,/\/portal\/api\/v1\/client\/rail/);

// Home keeps the production command-center owner, geometry and typography. Only
// its data source/scheduling changed for the anti-hang hotfix; no alternate Home
// renderer, font scale, width model or responsive grid is introduced here.
assert.match(home,/data-rona-client-home-owner=\"command-center-v2\"/);
assert.match(home,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
assert.match(home,/\.rona-cc-kpi-value\{[^}]*font-size:25px/s);
assert.match(home,/\.rona-cc-panel-title\{[^}]*font-size:11\.5px/s);
assert.match(home,/const width=tr\.width\+'px'/);
assert.match(home,/whenCurrentProjection/);
assert.doesNotMatch(home,/new MutationObserver/);
assert.doesNotMatch(home,/setInterval\([^\n]*schedule\(true\)/);
assert.doesNotMatch(home,/addEventListener\('focus'/);
assert.doesNotMatch(home,/visibilitychange/);
assert.doesNotMatch(home,/RONA-C004|DEAL-2026-007|DEAL-2026-008|FARG(?:[‘'ʼ])?ONA/iu);

console.log('CLIENT_LOAD_FEEDBACK_LOOP_HOTFIX_V1=PASS');
console.log('DEALS_CONTEXT_SOURCE=RONA_CLIENT_CONTEXT_CURRENT_PROJECTION');
console.log('DEALS_OWN_CONTEXT_FETCH=NONE');
console.log('DEAL_PASSPORT_BINDING=EXACT_NATIVE_DRAWER_PLUS_EXPLICIT_SLOTS');
console.log('DEAL_WORKFLOW_BINDING=EXACT_CLIENT_CONTRACT_DEAL');
console.log('DEAL_LIFECYCLE_OWNER=PRODUCTION_CLIENT_DEAL_LIFECYCLE_V1');
console.log('FIRST_PAINT_PROJECTION_CACHE_BRIDGE=NO_FETCH');
console.log('VISUAL_CONTEXT_BINDING=DIRECT_SELECTED_CONTEXT_SLOTS');
console.log('HOME_VISUAL_CONTRACT=PRODUCTION_COMMAND_CENTER_GEOMETRY');
console.log('GLOBAL_TEXT_REPLACEMENT=NONE');
console.log('RAIL_DELTA=NONE');
console.log('BUSINESS_DATA_MUTATION=NONE_BY_SOURCE_SCOPE');
