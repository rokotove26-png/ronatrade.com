import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(p,'utf8');
const sha=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0'+s).digest('hex');
const g=JSON.parse(read('governance/analytics-v6-single-owner-retirement-20261011.json'));
test('V6 preserves approved Admin visual and frozen Client V20',()=>{
  assert.equal(g.approval,'OWNER_IN_CHAT');
  for(const [path,field] of [
    ['functions/portal/admin-main-ui-current.js','admin_main_post'],
    ['portal-src/current/admin.html','admin_html_post'],
    ['functions/portal/analytics-v2-ui.js','admin_analytics_post'],
    ['functions/portal/analytics-canonical-live-hydration.js','admin_hydration_unchanged'],
    ['assets/portal-runtime/client-market-intelligence-v1.js','client_v20_unchanged']
  ])assert.equal(sha(read(path)),g.source_locks[field],path);
});
test('obsolete scripts really gone, canonical lazy load remains',()=>{
  for(const path of g.retired_paths)assert.equal(existsSync(path),false,path);
  const html=read('portal-src/current/admin.html');
  assert.ok(html.includes('id="page-analytics"')&&html.includes('portal-admin-shell-fast-v1.js'));
  assert.ok(!html.includes('rona-admin-approved-analytics-v455-loader'));
  const canonical=read('functions/portal/analytics-v2-ui.js');
  assert.ok(!canonical.includes('LPG_GAP_RUNTIME'));
});
test('actual emitted Admin main JS has no old table writer or callback',async()=>{
  const {onRequest}=await import('../functions/portal/admin-main-ui-current.js?retirement=V6');
  const output=await (await onRequest({})).text();
  new Function(output);
  assert.ok(output.includes('__RONA_ADMIN_ANALYTICS_LEGACY_OWNER_RETIRED__'));
  for(const marker of ["function renderAnalytics(){","replacePage('analytics'",'renderAnalytics();','analytics:renderAnalytics'])
    assert.ok(!output.includes(marker),marker);
  assert.ok(output.includes('function renderOwnedAdminPage(id){'));
  assert.ok(output.includes("'analytics','access'])"));
});
test('canonical Admin Analytics emits just one R4 SVG painter',async()=>{
  const {onRequest}=await import('../functions/portal/analytics-v2-ui.js?retirement=V6');
  const source=await (await onRequest({})).text();
  new Function(source);
  assert.equal((source.match(/function adminCompactChart\(root,product,key\)/g)||[]).length,1);
  for(const marker of ['__RONA_LPG_OBSERVATION_GAPS_V13__','source-observation-gaps-v13'])
    assert.ok(!source.includes(marker),marker);
});
test('retired remaining-sections Analytics is not emitted; Radio kept',async()=>{
  const {onRequest}=await import('../functions/portal/remaining-sections-ui.js?retirement=V6');
  const text=await (await onRequest({})).text();
  assert.ok(!text.includes('function renderAnalytics(){'));
  assert.ok(text.includes('function renderRadio()'));
});
test('Client V20 remains protected, publication-scoped, unmodified',()=>{
  const runtime=read('assets/portal-runtime/client-market-intelligence-v1.js');
  assert.ok(runtime.includes("const original=root.querySelector(':scope > #rona-analytics-v2')"));
  assert.ok(runtime.includes('if(substitute)substitute.remove();'));
  assert.ok(!runtime.includes("fetch('/portal/api/v1/admin/analytics'"));
});
