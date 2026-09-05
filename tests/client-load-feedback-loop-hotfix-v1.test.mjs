import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const read=p=>readFile(p,'utf8');
const [context,deals,background,messages,prices,dealDocs,lifecycle,rail,home]=await Promise.all([
  read('assets/portal-runtime/client-context-selection-authority-v1.js'),
  read('assets/portal-runtime/client-deals-authoritative-v1.js'),
  read('assets/portal-runtime/client-background-section-preload-v1.js'),
  read('assets/portal-runtime/client-messages-archive-v1.js'),
  read('assets/portal-runtime/client-price-sync-v1.js'),
  read('assets/portal-runtime/client-deal-documents-v5.js'),
  read('assets/portal-runtime/client-deal-lifecycle-v1.js'),
  read('functions/portal/client-rail-current-ui.js'),
  read('assets/portal-runtime/client-home-command-center-v2.js')
]);

assert.match(context,/loadCurrentProjection/);
assert.match(context,/x-rona-client-source/);
assert.match(context,/__RONA_CLIENT_CALLER_MAP__/);
assert.match(context,/getCurrentProjection/);
assert.match(context,/CLIENT_CONTEXT_PROJECTION_SCOPE_MISMATCH/);

assert.doesNotMatch(deals,/observe\(document\.documentElement/);
assert.doesNotMatch(deals,/attributeFilter:\[[^\]]*(?:hidden|aria-hidden)/s);
assert.doesNotMatch(deals,/setInterval\([^\n]*refresh/);
assert.doesNotMatch(deals,/addEventListener\('focus'[^\n]*refresh/);
assert.match(deals,/state\.observer\.observe\(r,\{childList:true,subtree:true\}\)/);
assert.match(deals,/function setHidden/);
assert.match(deals,/CLIENT_CONTEXT_PROJECTION_SCOPE_MISMATCH|contextMatchesPayload/);

assert.doesNotMatch(background,/\bfetch\s*\(/);
assert.doesNotMatch(background,/setInterval/);
assert.match(background,/LAZY_BY_SECTION/);

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

const startTo=rail.match(/const START_TO="([^"]*)";/)?.[1]||'';
assert.ok(startTo,'Client Rail START_TO contract missing');
assert.doesNotMatch(startTo,/setInterval/);
assert.match(rail,/client-rail-current-ui:shipments/);
assert.match(rail,/client-rail-current-ui:rail/);

// Home must consume the single current-context coordinator and must not own a
// self-exciting whole-document MutationObserver or periodic/focus/visibility refresh.
assert.match(home,/whenCurrentProjection/);
assert.doesNotMatch(home,/new MutationObserver/);
assert.doesNotMatch(home,/setInterval\([^\n]*schedule\(true\)/);
assert.doesNotMatch(home,/addEventListener\('focus'/);
assert.doesNotMatch(home,/visibilitychange/);

console.log('CLIENT_LOAD_FEEDBACK_LOOP_HOTFIX_V1=PASS');
console.log('VISUAL_DIFF=NONE_BY_SOURCE_SCOPE');
console.log('BUSINESS_DATA_MUTATION=NONE_BY_SOURCE_SCOPE');
