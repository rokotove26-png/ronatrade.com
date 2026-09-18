import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root=process.cwd();
const sql=fs.readFileSync(
  path.join(root,'supabase/migrations/20260918171000_finance_cash_counterparty_identity_v1.sql'),
  'utf8'
);

test('Finance Cash identity contract exposes canonical/raw/intermediary resolution fields',()=>{
  for(const field of [
    'canonical_counterparty_id',
    'canonical_counterparty_name',
    'raw_counterparty_name',
    'counterparty_role',
    'counterparty_resolution_status',
    'counterparty_resolution_source',
    'counterparty_resolution_evidence_refs',
    'intermediary_name'
  ]) assert.ok(sql.includes(field),field);
  assert.ok(sql.includes('FINANCE_COUNTERPARTY_IDENTITY_V1'));
  assert.ok(sql.includes('TO_VERIFY'));
  assert.ok(sql.includes('UNRESOLVED_RAW_SOURCE'));
});

test('controlled aliases are source-locked and do not use unrestricted fuzzy matching',()=>{
  for(const id of [
    'FARGONA_RAW_1','SGTRANS_RAW_1','ORIENT_RAW_1',
    'BAKAI_PAY_1','BAKAI_PAY_2','BNK_INTERMEDIARY_FULL'
  ]) assert.ok(sql.includes(id),id);
  assert.ok(sql.includes('required_purpose_regex'));
  assert.ok(sql.includes('BANK_PURPOSE_UNP+VERIFIED_PAYMENT+SUPPLIER_CONTRACT'));
  assert.ok(sql.includes('finance_counterparty_normalize_name_v1'));
  assert.ok(!sql.includes('similarity('));
  assert.ok(!sql.includes('levenshtein('));
});

test('Belarusbank is retained as intermediary while BNK is source-resolved business counterparty',()=>{
  assert.ok(sql.includes('ОАО АКЦИОНЕРНЫЙ СБЕРЕГАТЕЛЬНЫЙ БАНК БЕЛАРУСБАНК'));
  assert.ok(sql.includes('ЗАО «Белорусская нефтяная компания»'));
  assert.ok(sql.includes('190832326'));
  assert.ok(sql.includes('PAYMENT:OUT-2026-004-BNK'));
  assert.ok(sql.includes('CONTRACT:RONA-S001-CTR-2026-001'));
  assert.ok(sql.includes('intermediary_from_raw'));
});

test('Admin RPC identity wrapper contains no UI identity hardcode',()=>{
  const start=sql.indexOf('create or replace function portal_private.finance_cash_source_projection_payload_v2_identity');
  assert.ok(start>=0);
  const wrapper=sql.slice(start);
  assert.ok(wrapper.includes('select portal_private.finance_cash_source_projection_payload_v1(p_from,p_to)'));
  assert.ok(!wrapper.includes("when o.finance_payment_id='PAYEV-2026-000001'"));
  assert.ok(!wrapper.includes("'COUNTERPARTY:SGTRANS'"));
  assert.ok(!wrapper.includes("'COUNTERPARTY:ORIENT_LOGISTIC'"));
});
