import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../../supabase/migrations/20261019185900_deal_registration_resource_gate_execution_shell_v1.sql',import.meta.url),'utf8');

test('operator deal-registration checks supplier resource approval, not just Owner commercial acceptance',()=>{
  assert.match(src,/server_executive_register_deal_v12/);
  assert.match(src,/w\.application_key=a\.id/);
  assert.match(src,/w\.supplier_approved_at is not null/);
  assert.match(src,/w\.business_status in \('SUPPLIER_APPROVED','DEAL'\)/);
  assert.match(src,/SUPPLIER_RESOURCE_CONFIRMATION_REQUIRED_BEFORE_DEAL_REGISTRATION/);
});

test('successful registration initializes only an unconfirmed workflow shell',()=>{
  assert.match(src,/insert into portal_private\.owner_deal_workflow\(deal_key\)/);
  assert.match(src,/values\(dk\) on conflict \(deal_key\) do nothing/);
  assert.match(src,/on conflict \(deal_key\) do nothing;/);
  assert.doesNotMatch(src,/product_confirmed_at\s*=\s*now\(\)/);
  assert.doesNotMatch(src,/quantity_confirmed_at\s*=\s*now\(\)/);
  assert.doesNotMatch(src,/payment_handoff_state\s*=\s*'SENT'/);
  assert.doesNotMatch(src,/update\s+portal_private\.client_applications/i);
  assert.doesNotMatch(src,/update\s+portal_private\.owner_application_workflow/i);
});

test('migration preserves rollback source and refuses drift',()=>{
  assert.match(src,/operations_rpc_source_backups_v1/);
  assert.match(src,/REGISTRATION_FUNCTION_SOURCE_CHANGED_REVIEW_REQUIRED/);
  assert.match(src,/REGISTRATION_GUARD_PARTIAL_PATCH/);
});
