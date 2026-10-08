import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql=await readFile('supabase/migrations/20261008145500_market_source_ingestion_v2.sql','utf8');

test('Market source ingestion V2 adds source-neutral inbox and adapter dispatcher',()=>{
  for(const token of [
    'market_intelligence_source_inbox',
    'MANUAL_APPROVED_PAYLOAD',
    'market_intelligence_process_inbox_one_v1',
    'market_intelligence_source_processor_cron_tick_v3',
    'SOURCE_INBOX_V2',
    'TELEGRAM_V1'
  ]) assert.ok(sql.includes(token),'missing ingestion v2 token: '+token);
});

test('Manual source adapter is authority-locked and fail closed',()=>{
  for(const token of [
    "functional_role::text='COMMERCIAL_DIRECTOR'",
    "payload->>'proposed_field'='market_intelligence.manual_source_backfill_v1'",
    "functional_role::text='OPERATIONS_DIRECTOR'",
    "status='APPROVE_FOR_NEXT_STAGE'",
    "no_synthetic_records",
    "BNK composite not synthesized without second component"
  ]) assert.ok(sql.includes(token),'missing authority/fail-closed guard: '+token);
  assert.ok(sql.includes('enable row level security'));
  assert.ok(sql.includes('revoke all on table portal_private.market_intelligence_source_inbox from public,anon,authenticated,service_role'));
});
