import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const deals=read('functions/portal/deals-r1-r11-ui.js');
const claims=read('functions/portal/claims-r2-ui.js');
const prices=read('functions/portal/prices-current-ui.js');
const rail=read('functions/portal/rail-current-v81-maplibre-ui.js');

test('Deals R1.1 preserves cadence but suppresses hidden-tab polling and DOM sync',()=>{
  assert.match(deals,/function visible\(\)\{return document\.visibilityState==='visible'\}/);
  assert.match(deals,/setInterval\(function\(\)\{if\(visible\(\)\)refreshState\(\)\},12000\)/);
  assert.match(deals,/setInterval\(function\(\)\{if\(visible\(\)\)syncViews\(\)\},450\)/);
  assert.match(deals,/visibilitychange/);
  assert.doesNotMatch(deals,/setInterval\(refreshState,12000\)/);
});

test('Claims keeps active-page semantics and also stops when document is hidden',()=>{
  assert.match(claims,/document\.visibilityState==='visible'.*page-claims/s);
  assert.match(claims,/setInterval\(function\(\)\{if\(active\(\)&&!loading\)refresh\(false\)\},20000\)/);
  assert.match(claims,/visibilitychange/);
});

test('Prices keeps 30s active-page cadence and gates it by document visibility',()=>{
  assert.match(prices,/document\.visibilityState==='visible'&&page\(\)\?\.classList\.contains\('active'\).*30000/s);
  assert.match(prices,/visibilitychange/);
});

test('Rail wrapper fail-closes unless the inherited 30s polling anchor exists and replaces it with visibility plus active-page gating',()=>{
  assert.match(rail,/const POLL_FROM="timer=setInterval\(sync,30000\)"/);
  assert.match(rail,/!source\.includes\(POLL_FROM\)/);
  assert.match(rail,/\.replace\(POLL_FROM,POLL_TO\)/);
  assert.match(rail,/document\.visibilityState==='visible'/);
  assert.match(rail,/page\.classList\.contains\('active'\)/);
});
