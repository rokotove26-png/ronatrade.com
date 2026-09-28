import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const gateway=fs.readFileSync('supabase/functions/rona-mcp-gateway/index.ts','utf8');

test('gateway exposes exception-first and terminal task tools',()=>{
  assert.match(gateway,/name: "exception_cockpit"/);
  assert.match(gateway,/name: "task_complete"/);
  assert.match(gateway,/name: "task_close"/);
  assert.match(gateway,/TASK_TERMINAL_ACTION/);
});

test('task completion is evidence and conclusion gated',()=>{
  assert.match(gateway,/conclusion_record_id/);
  assert.match(gateway,/evidence_refs/);
  assert.match(gateway,/TASK_NOT_ASSIGNED_TO_ROLE/);
  assert.match(gateway,/taskTerminalAction\(ctx, req, msg, "COMPLETED"\)/);
});

test('administrative close remains restricted',()=>{
  assert.match(gateway,/\["OPERATIONS_DIRECTOR","SYSTEM_ADMIN"\]\.includes\(ctx\.role\)/);
  assert.match(gateway,/SUPERSEDED/);
  assert.match(gateway,/DUPLICATE/);
  assert.match(gateway,/OBSOLETE_SOURCE/);
  assert.match(gateway,/NO_LONGER_APPLICABLE/);
});

test('gateway consumes registry-driven routing and current state v4',()=>{
  assert.match(gateway,/ai_role_routing_contract_v3/);
  assert.match(gateway,/canonical_ai_handoff_targets/);
  assert.match(gateway,/ai_role_state_current_v4/);
  assert.match(gateway,/RONA_ROLE_STATE_RECOVERY_V4/);
});


test('oversized role state compacts policies but preserves exact detail retrieval',()=>{
  assert.match(gateway,/name: "global_policy_detail"/);
  assert.match(gateway,/READ_EACH_GLOBAL_POLICY_DETAIL_BY_ID/);
  assert.match(gateway,/global_policy_details_embedded/);
  assert.match(gateway,/ai_role_global_policies_current_v1/);
  assert.match(gateway,/ROLE_STATE_V4_RESPONSE_BUDGET_EXCEEDED/);
});
