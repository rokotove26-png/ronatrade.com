import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const sql=readFileSync(
  new URL('../supabase/migrations/20260920130000_owner_apply_price_guard_order_v1.sql',import.meta.url),
  'utf8'
);

test('owner price router authenticates before proposal lookup',()=>{
  const guard=sql.indexOf("perform portal_private.owner_r1_actor('ADMIN')");
  const lookup=sql.indexOf("from portal_private.owner_price_change_proposals");
  assert.ok(guard>=0,'ADMIN actor guard missing');
  assert.ok(lookup>=0,'proposal lookup missing');
  assert.ok(guard<lookup,'proposal lookup occurs before ADMIN authorization');
});

test('authorized routing semantics remain intact',()=>{
  for(const marker of [
    "FULL_PRICE_LIST_HANDOFF",
    "owner_apply_full_price_handoff_v2",
    "FULL_PRICE_LIST_SOURCE_HANDOFF",
    "owner_apply_full_price_source_handoff_v2",
    "owner_apply_price_change_proposal_legacy"
  ]) assert.ok(sql.includes(marker),marker);
});

test('migration does not alter proposal or price data directly',()=>{
  assert.doesNotMatch(sql,/\b(delete\s+from|truncate\s+|drop\s+table)\b/i);
  assert.doesNotMatch(sql,/update\s+portal_private\.owner_price_change_proposals\b/i);
  assert.doesNotMatch(sql,/insert\s+into\s+portal_private\.owner_price_change_proposals\b/i);
});
