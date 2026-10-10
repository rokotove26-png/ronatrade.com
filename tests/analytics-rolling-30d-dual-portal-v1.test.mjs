import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(p,'utf8');
const sha=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0'+s).digest('hex');
const g=JSON.parse(read('governance/analytics-rolling-30d-owner-scope-20261010.json'));
const admin=read('functions/portal/api/v1/admin/analytics.js');
const runtime=read('functions/portal/analytics-canonical-live-hydration.js');
const edge=read('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts');
test('owner source-lock and exact rolling 30 day successors',()=>{
  assert.equal(g.approval,'OWNER_IN_CHAT');
  assert.equal(g.rolling_window.days,30);
  assert.equal(sha(admin),g.current_admin_endpoint_blob_sha);
  assert.equal(sha(runtime),g.current_admin_blob_sha);
  assert.equal(sha(edge),g.current_client_edge_blob_sha);
});
test('admin filters dated numeric points and passes filtered series to both graph and conclusion',()=>{
  for(const t of ['const rolling30Floor=','utc-29*86400000','function observationDay(','function last30Series(','ms>=floor&&ms<=today',"v!==null&&v!==''",'products[key]=last30Series('])assert.ok(admin.includes(t),t);
  assert.ok(runtime.includes('lastApplied=sig;lastSource=livePayload;'));
  assert.ok(runtime.includes('decorate(livePayload);'));
  assert.ok(!runtime.includes('lastApplied=sig;lastSource=payload;'));
});
test('client removes empty and old points prior to trend and graphical publication',()=>{
  for(const t of ['const rollingFloor = rollingToday - 29 * 86400000','const chartObservationMs =','const enforceRolling30 =','ms>=rollingFloor&&ms<=rollingToday','enforceRolling30(output,text(source.latestTradeDate));','const first = Number(output.values[0])','const last = Number(output.values[output.values.length - 1])'])assert.ok(edge.includes(t),t);
  assert.ok(edge.indexOf('enforceRolling30(output,text(source.latestTradeDate));')<edge.indexOf('const first = Number(output.values[0])'));
  assert.ok(edge.includes('permissionToForecast(key)'));
  assert.ok(edge.includes('authorizedClientKeys(c)'));
});
test('preserves original visual, model and source authority; no mutation',()=>{
  assert.ok(runtime.includes('root.dataset.ronaGapInterpolation=\'OFF\''));
  assert.ok(edge.includes('daily?.noInterpolation === true'));
  assert.ok(!edge.includes('update portal_private.'));
  assert.ok(!edge.includes('output.rona ='));
});
