import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequest as dealsUi } from '../functions/portal/deals-current-state-ui.js';

const migration=readFileSync('supabase/migrations/20261003171500_admin_deal_attention_after_rail_completed_and_paid_v1.sql','utf8');

test('Admin deal attention gate is source-locked to manual Rail completion and authoritative 100% Finance V8',()=>{
  assert.match(migration,/rail_deal_monitoring_control_v1/);
  assert.match(migration,/monitoring_state/);
  assert.match(migration,/COMPLETED/);
  assert.match(migration,/finance_projection_version/);
  assert.match(migration,/FINANCE_V8/);
  assert.match(migration,/finance_status/);
  assert.match(migration,/PAID/);
  assert.match(migration,/finance_authority_state/);
  assert.match(migration,/AUTHORITATIVE/);
  assert.match(migration,/finance_lifecycle_state/);
  assert.match(migration,/CURRENT/);
  assert.match(migration,/finance_source_locked/);
  assert.match(migration,/finance_is_terminal/);
  assert.match(migration,/client_remaining_amount/);
  assert.match(migration,/received_amount/);
  assert.match(migration,/obligation_amount/);
  assert.match(migration,/post_rail_completion_attention/);
  assert.match(migration,/RAIL_COMPLETED_AND_100_PERCENT_PAID/);
  assert.doesNotMatch(migration,/update\s+portal_private\.deals/i);
  assert.doesNotMatch(migration,/delete\s+from|truncate\s+table|drop\s+table/i);
});

test('Admin Deals UI places the derived lifecycle signal in Требует внимания and HOLD',async()=>{
  const response=await dealsUi();
  assert.equal(response.status,200);
  const js=await response.text();
  assert.match(js,/post_rail_completion_attention===true/);
  assert.match(js,/return !!\(d&&d\.post_rail_completion_attention===true\)\|\|structuralIssue\(d\)\|\|needsPaymentHandoffAction\(d\)/);
  assert.match(js,/if\(d&&d\.post_rail_completion_attention===true\|\|structuralIssue\(d\)\|\|!hasClientSignedAddendum\(d\)\)return'HOLD'/);
  assert.match(js,/\['ATTENTION','Требует внимания · '/);
});

test('This stage remains Admin-only',()=>{
  const migrationLower=migration.toLowerCase();
  assert.equal(migrationLower.includes('client portal'),true);
  assert.doesNotMatch(migration,/rona_client_|client_deal_state/i);
  assert.doesNotMatch(migration,/closing_document|закрывающ/i);
});
