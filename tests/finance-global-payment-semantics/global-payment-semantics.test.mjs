import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20260915033000_finance_global_payment_semantics_v1.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

function between(start, end) {
  const a = sql.indexOf(start);
  const b = sql.indexOf(end, a + start.length);
  assert.ok(a >= 0, `missing start marker: ${start}`);
  assert.ok(b > a, `missing end marker: ${end}`);
  return sql.slice(a, b);
}

test('canonical policy is global, versioned and not task-scoped', () => {
  assert.match(sql, /FINANCE_GLOBAL_PAYMENT_SEMANTICS_V1/);
  assert.match(sql, /'GLOBAL_FINANCE_ROLE'/);
  assert.match(sql, /'FINANCE'::portal_private\.ai_business_role_enum/);
  assert.match(sql, /task_scoped boolean not null default false check \(task_scoped = false\)/);
  assert.match(sql, /GLOBAL_ROLE_POLICY_IMMUTABLE_APPEND_SUPERSESSION_ONLY/);
  assert.match(sql, /GLOBAL_ROLE_POLICY_OWNER_INSTRUCTION_REQUIRED/);
  assert.match(sql, /NEW_VERSIONED_OWNER_INSTRUCTION/);
});

test('CURRENT_STATE_FIRST resolves global policy before any active-task query', () => {
  const policyLoad = sql.indexOf('v_policies := portal_private.ai_role_global_policies_current_v1(p_role);');
  const taskRead = sql.indexOf('from portal_private.staff_tasks t');
  assert.ok(policyLoad >= 0);
  assert.ok(taskRead >= 0);
  assert.ok(policyLoad < taskRead, 'global policy must load before task projection');
  assert.match(sql, /'GLOBAL_ROLE_POLICY','ROLE_CHECKPOINT','ACTIVE_TASK'/);
  assert.match(sql, /'APPLY_GLOBAL_ROLE_POLICIES_BEFORE_ACTIVE_TASK'/);
});

test('policy resolver is role-scoped and independent from staff tasks', () => {
  const resolver = between(
    'create or replace function portal_private.ai_role_global_policies_current_v1',
    'create or replace function portal_private.finance_primary_spend_semantics_v1'
  );
  assert.match(resolver, /where p\.functional_role = p_role/);
  assert.doesNotMatch(resolver, /staff_tasks/i);
  assert.doesNotMatch(resolver, /active_task/i);
});

test('primary spend guard rejects reverse FX and never derives funding amount from settlement', () => {
  const primary = between(
    'create or replace function portal_private.finance_primary_spend_semantics_v1',
    'create or replace function portal_private.finance_multi_deal_proportional_allocation_v1'
  );
  assert.match(primary, /BANK_CONFIRMED/);
  assert.match(primary, /FUNDING_SIDE_DEBIT/);
  assert.match(primary, /NO_REVERSE_FX_AS_PRIMARY/);
  assert.match(primary, /'funding_amount',p_funding_amount/);
  assert.match(primary, /resource_chain_accounting_amount_ignored_for_primary/);
  assert.doesNotMatch(primary, /p_settlement_amount\s*\//);
  assert.doesNotMatch(primary, /p_resource_chain_accounting_amount\s*\//);
});

test('confirmed multi-deal allocation is proportional and authoritative override has priority', () => {
  const allocation = between(
    'create or replace function portal_private.finance_multi_deal_proportional_allocation_v1',
    'create or replace function portal_private.ai_role_state_current_v2'
  );
  assert.match(allocation, /AUTHORITATIVE_OVERRIDE/);
  assert.match(allocation, /CONFIRMED_PROPORTIONAL_SHARES/);
  assert.match(allocation, /DEAL_SET_OR_SHARE_UNCONFIRMED/);
  assert.match(allocation, /v_sum <> 1/);
  assert.match(allocation, /p_funding_amount \* \(item->>'share'\)::numeric/);
  assert.match(allocation, /'synthetic_allocation',false/);
});
