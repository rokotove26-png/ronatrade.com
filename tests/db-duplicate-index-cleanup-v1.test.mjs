import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const sql=readFileSync(new URL('../supabase/migrations/20260920041600_drop_exact_duplicate_indexes_v1.sql',import.meta.url),'utf8');

test('duplicate-index cleanup drops only the four selected redundant indexes',()=>{
  const expected=[
    'portal_private.ux_client_applications_v12_idempotency',
    'portal_private.finance_signed_schedule_jobs_v8_deal_idx',
    'portal_private.owner_deal_documents_active_kind_idx',
    'portal_private.owner_price_change_proposals_status_idx',
  ];
  const drops=[...sql.matchAll(/drop\s+index\s+if\s+exists\s+([a-z0-9_.]+)/gi)].map(m=>m[1].toLowerCase());
  assert.deepEqual(drops,expected);
});

test('cleanup preserves the selected canonical counterpart indexes and contains no business-row DML',()=>{
  for(const keep of [
    'client_application_submit_intent_unique_v2',
    'finance_signed_schedule_jobs_v8_deal_status_idx',
    'owner_deal_documents_deal_idx',
    'owner_price_change_proposals_open_idx',
  ]) assert.doesNotMatch(sql,new RegExp('drop\\s+index[^;]*'+keep,'i'));
  assert.doesNotMatch(sql,/\b(delete\s+from|truncate\s+|update\s+|insert\s+into)\b/i);
  assert.doesNotMatch(sql,/\b(drop\s+table|alter\s+table|drop\s+constraint)\b/i);
});
