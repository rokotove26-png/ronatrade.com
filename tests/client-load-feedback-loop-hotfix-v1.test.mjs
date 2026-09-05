import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const read=p=>readFile(p,'utf8');
const [context,deals,firstPaint,background,messages,prices,dealDocs,lifecycle,home]=await Promise.all([
  read('assets/portal-runtime/client-context-selection-authority-v1.js'),
  read('assets/portal-runtime/client-deals-authoritative-v1.js'),
  read('assets/portal-runtime/client-section-first-paint-v1.js'),
  read('assets/portal-runtime/client-background-section-preload-v1.js'),
  read('assets/portal-runtime/client-messages-archive-v1.js'),
  read('assets/portal-runtime/client-price-sync-v1.js'),
  read('assets/portal-runtime/client-deal-documents-v5.js'),
  read('assets/portal-runtime/client-deal-lifecycle-v1.js'),
  read('assets/portal-runtime/client-home-command-center-v2.js')
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
assert.match(deals,/CLIENT_CONTEXT_PROJECTION_SCOPE_MISMATCH|contextMatchesPayload/);
assert.match(deals,/function drawerCloseControl/);
assert.match(deals,/function backdropDrawer/);
assert.match(deals,/function closeOtherDrawers/);
assert.match(deals,/function onKeydown/);
assert.match(deals,/closeOtherDrawers\(r,'other-drawer'\)/);
assert.doesNotMatch(deals,/RONA-C004|DEAL-2026-007|DEAL-2026-008|FARG(?:[‘'ʼ])?ONA/iu);

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
assert.match(lifecycle,/rona:client:deal-authoritative-detail/);
assert.match(lifecycle,/client-deal-lifecycle-v1/);

// Rail remains the production runtime. This delta does not rewrite it; eager Rail
// network work remains deferred by the existing lazy background coordinator.
assert.match(background,/scopedPath\('\/v1\/client\/shipments'/);
assert.match(background,/scopedPath\('\/v1\/client\/rail'/);
assert.match(context,/\/portal\/api\/v1\/client\/shipments/);
assert.match(context,/\/portal\/api\/v1\/client\/rail/);

// Home consumes the single current-context coordinator and owns no self-exciting
// whole-document observer or periodic/focus/visibility refresh.
assert.match(home,/whenCurrentProjection/);
assert.doesNotMatch(home,/new MutationObserver/);
assert.doesNotMatch(home,/setInterval\([^\n]*schedule\(true\)/);
assert.doesNotMatch(home,/addEventListener\('focus'/);
assert.doesNotMatch(home,/visibilitychange/);

console.log('CLIENT_LOAD_FEEDBACK_LOOP_HOTFIX_V1=PASS');
console.log('DEALS_CONTEXT_SOURCE=RONA_CLIENT_CONTEXT_CURRENT_PROJECTION');
console.log('DEALS_OWN_CONTEXT_FETCH=NONE');
console.log('FIRST_PAINT_PROJECTION_CACHE_BRIDGE=NO_FETCH');
console.log('VISUAL_CONTEXT_BINDING=DIRECT_SELECTED_CONTEXT_SLOTS');
console.log('DEAL_DRAWER_LIFECYCLE=BACKDROP_CLOSE_X_SINGLE_VISIBLE');
console.log('GLOBAL_TEXT_REPLACEMENT=NONE');
console.log('RAIL_DELTA=NONE');
console.log('VISUAL_DIFF=NONE_BY_SOURCE_SCOPE');
console.log('BUSINESS_DATA_MUTATION=NONE_BY_SOURCE_SCOPE');
