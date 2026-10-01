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

test('gateway advertises canonical handoff routing and current state v6',()=>{
  assert.match(gateway,/CANONICAL_AI_HANDOFF_TARGETS/);
  assert.match(gateway,/CANONICAL_AI_HANDOFF_TARGET_SET/);
  assert.match(gateway,/canonical_ai_handoff_targets/);
  assert.match(gateway,/ai_role_state_current_v6/);
  assert.match(gateway,/RONA_ROLE_STATE_RECOVERY_V6/);
});


test('cross-role handoff requires target role to support the entity type',()=>{
  assert.match(gateway,/if \(!primaryTechnicalCtx\(ctx\) && !roleCanUseEntity\(targetRole, type\)\) return null;/);
  assert.doesNotMatch(gateway,/if \(!primaryTechnicalCtx\(ctx\) && roleCanUseEntity\(targetRole, type\)\) return null;/);
  assert.match(gateway,/OPERATIONS_DIRECTOR: new Set\(\["CLIENT","CONTRACT","APPLICATION","DEAL","DOCUMENT","PAYMENT","SHIPMENT","RAIL_DOCUMENT","PUBLICATION","TASK"\]\)/);
  assert.match(gateway,/RAIL_LOGISTICS: new Set\(\["DEAL","SHIPMENT","RAIL_DOCUMENT","TASK"\]\)/);
});
