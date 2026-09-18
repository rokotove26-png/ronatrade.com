import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ui=await readFile(new URL('../functions/portal/payments-v8-ui.js',import.meta.url),'utf8');

test('Payments V8 refreshes authoritative bootstrap on all live triggers without reload',()=>{
  assert.match(ui,/rona:finance-sync[^\n]*event\?\.detail\?\.source===OWNER[^\n]*refreshIfOpen\('finance-sync'\)/);
  assert.match(ui,/data-page="payments"[^\n]*scheduleRefresh\('navigation'\)/);
  assert.match(ui,/addEventListener\('focus'[^\n]*refreshIfOpen\('focus'\)/);
  assert.match(ui,/visibilitychange[^\n]*refreshIfOpen\('visibilitychange'\)/);
  assert.match(ui,/setInterval\(\(\)=>refreshIfOpen\('interval'\),REFRESH_MS\)/);
  assert.match(ui,/const REFRESH_MS=30000/);
  assert.match(ui,/cache:'no-store'/);
  assert.match(ui,/if\(loading\)return loading/);
});

test('refresh is version-gated and preserves last confirmed snapshot on failure',()=>{
  assert.match(ui,/previousKey=versionKeyOf\(previous\),nextKey=versionKeyOf\(next\),changed=!previous\|\|previousKey!==nextKey/);
  assert.match(ui,/projection=changed\?next:\(previous\|\|next\)/);
  assert.match(ui,/catch\(error\)[\s\S]*return projection/);
  assert.doesNotMatch(ui,/catch\(error\)[\s\S]{0,300}projection=null/);
});


test('Payments V8 is a data/passport bridge and never competes for Payments page DOM',()=>{
  assert.match(ui,/DATA_AND_PASSPORT_BRIDGE/);
  assert.match(ui,/VISUAL_OWNER='admin-payments-v7-native-v2'/);
  assert.match(ui,/__RONA_OWNER_AI_SYNC_SNAPSHOT__=\{[\s\S]*paymentsV7Projection:projection/);
  assert.match(ui,/dispatchEvent\(new CustomEvent\('rona:finance-sync'/);
  assert.match(ui,/page\.querySelector\(':scope > #ronaPaymentsV8Root'\)\?\.remove\(\)/);
  assert.doesNotMatch(ui,/page\.replaceChildren\(/);
  assert.doesNotMatch(ui,/function observePage\(\)/);
});
