import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync('assets/portal-runtime/client-content-responsive-v1.css','utf8');
const attach=readFileSync('scripts/attach-client-content-responsive-v1.mjs','utf8');
const approval=JSON.parse(readFileSync('governance/client-deals-visual-hierarchy-owner-approval-20261005.json','utf8'));

test('Client Deals visual hierarchy v2 is owner-scoped and cache-busted',()=>{
  assert.equal(approval.approval,'OWNER_IN_CHAT');
  assert.equal(approval.scope,'CLIENT_DEALS_VISUAL_HIERARCHY_V2');
  assert.equal(approval.requirements.deals_section_only,true);
  assert.equal(approval.requirements.business_data_changed,false);
  assert.equal(approval.requirements.business_logic_changed,false);
  assert.equal(approval.requirements.wildcard_exception,false);
  assert.match(css,/RONA_CLIENT_DEALS_VISUAL_HIERARCHY_V14/);
  assert.match(attach,/client-content-responsive-v1\.css\?v=20261005-client-deals-visual-v14/);
});

test('Lifecycle tabs have distinct semantic visual tones without changing lifecycle labels',()=>{
  for(const stage of ['ACTIVE','ATTENTION','COMPLETED']){
    assert.ok(css.includes(`data-rona-deal-stage-tab="${stage}"`),stage);
  }
  assert.match(css,/--rona-deal-cyan:/);
  assert.match(css,/--rona-deal-amber:/);
  assert.match(css,/--rona-deal-green:/);
});

test('CLOSEOUT metrics use scoped visual status cues and contain no hardcoded business entities',()=>{
  for(const marker of [
    'data-rona-closeout-product-status="SHIPPED"',
    'data-rona-closeout-stage="CLOSEOUT"',
    'data-rona-closeout-metric="Факт. объём"',
    'data-rona-closeout-metric="Оплачено"',
    'data-rona-closeout-metric="Фактическая сумма"',
    'data-rona-closeout-metric="RONA должна клиенту"',
    'data-rona-closeout-metric="Клиент должен RONA"',
    'data-rona-closeout-metric="Баланс закрыт"'
  ]) assert.ok(css.includes(marker),marker);
  assert.doesNotMatch(css,/DEAL-\d{4}-\d{3}/);
  assert.doesNotMatch(css,/RONA-C\d{3}/);
  assert.doesNotMatch(css,/FARGONA|UNIVERSAL\s+SOLYARIS/iu);
});
