import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixMigration = fs.readFileSync(
  path.resolve(__dirname, '../../supabase/migrations/20260915034500_finance_global_policy_effective_at_activation_fix.sql'),
  'utf8',
);
const bootstrapMigration = fs.readFileSync(
  path.resolve(__dirname, '../../supabase/migrations/20260915033000_finance_global_payment_semantics_v1.sql'),
  'utf8',
);

function resolveAt(policies, asOf) {
  const effective = policies
    .filter(p => p.authority_kind === 'OWNER_INSTRUCTION' && p.effective_at <= asOf)
    .sort((a, b) => b.policy_version - a.policy_version || b.effective_at - a.effective_at);
  return effective[0] ?? null;
}

const t0 = Date.parse('2026-09-15T00:00:00Z');
const policies = [
  { policy_id: 'V1', policy_version: 1, authority_kind: 'OWNER_INSTRUCTION', effective_at: t0 },
  { policy_id: 'V2', policy_version: 2, authority_kind: 'OWNER_INSTRUCTION', effective_at: t0 + 86_400_000 },
];

test('V1 effective now and V2 effective tomorrow resolves V1 today', () => {
  assert.equal(resolveAt(policies, t0 + 1_000)?.policy_id, 'V1');
});

test('after V2 effective_at the resolver returns V2', () => {
  assert.equal(resolveAt(policies, t0 + 86_400_001)?.policy_id, 'V2');
});

test('future V2 never suppresses effective V1 before activation', () => {
  assert.equal(resolveAt(policies, t0 + 43_200_000)?.policy_id, 'V1');
  assert.match(fixMigration, /p\.effective_at\s*<=\s*p_as_of/);
  assert.match(fixMigration, /partition by p\.functional_role, p\.policy_key/);
  assert.match(fixMigration, /order by p\.policy_version desc/);
  assert.match(fixMigration, /where p\.rn = 1/);
  assert.match(fixMigration, /ai_role_global_policies_at_v1\(p_role, now\(\)\)/);
});

test('Finance bootstrap still loads global role policy before active task projection', () => {
  const policyLoad = bootstrapMigration.indexOf('v_policies := portal_private.ai_role_global_policies_current_v1(p_role);');
  const taskRead = bootstrapMigration.indexOf('from portal_private.staff_tasks t');
  assert.ok(policyLoad >= 0);
  assert.ok(taskRead >= 0);
  assert.ok(policyLoad < taskRead, 'global policy must load before task projection');
});
