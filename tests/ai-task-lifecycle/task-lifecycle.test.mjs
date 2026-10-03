import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const lifecycle=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20260928160402_ai_task_lifecycle_v1.sql'),'utf8');
const progress=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20260928160748_ai_task_progress_settlement_v1.sql'),'utf8');
const gateway=fs.readFileSync(path.resolve(__dirname,'../../supabase/functions/rona-mcp-gateway/index.ts'),'utf8');

test('functional conclusion no longer implies task completion',()=>{
  assert.match(lifecycle,/FUNCTIONAL_CONCLUSION_IS_TASK_TERMINAL',false/);
  assert.match(lifecycle,/AUTO_CLOSE_ON_FUNCTIONAL_CONCLUSION',false/);
  assert.match(lifecycle,/TASK_TERMINAL_ACTION/);
  assert.match(lifecycle,/TASK_TERMINAL_ACTION_NOT_MATERIALIZED/);
});

test('task completion is explicit, role-scoped and evidence-gated',()=>{
  assert.match(lifecycle,/TASK_TERMINAL_ROLE_SCOPE_DENIED/);
  assert.match(lifecycle,/TASK_TERMINAL_EVIDENCE_REQUIRED/);
  assert.match(lifecycle,/TASK_COMPLETION_CONCLUSION_REQUIRED/);
  assert.match(lifecycle,/TASK_COMPLETION_APPROVED_CONCLUSION_NOT_CURRENT/);
  assert.match(lifecycle,/c\.status='APPROVED'/);
  assert.match(lifecycle,/confirmed/);
  assert.match(lifecycle,/mandatory_conditions/);
});

test('task close is narrow and cannot give System Admin business authority',()=>{
  assert.match(lifecycle,/TASK_CLOSE_ROLE_DENIED/);
  assert.match(lifecycle,/SUPERSEDED/);
  assert.match(lifecycle,/DUPLICATE/);
  assert.match(lifecycle,/OBSOLETE_SOURCE/);
  assert.match(lifecycle,/NO_LONGER_APPLICABLE/);
  assert.match(lifecycle,/TASK_CLOSE_SYSTEM_ADMIN_BUSINESS_SCOPE_DENIED/);
});

test('generic progress settlement covers non-reverse tasks without changing business data',()=>{
  assert.match(progress,/apply_generic_task_coordination_v1/);
  assert.match(progress,/source_reverse_event_key is not null/);
  assert.match(progress,/IN_PROGRESS/);
  assert.match(progress,/BLOCKED/);
  assert.match(progress,/business_mutation',false/);
});

test('gateway exposes explicit lifecycle tools only through fixed-role pilot context',()=>{
  assert.match(gateway,/name: "task_complete"/);
  assert.match(gateway,/name: "task_close"/);
  assert.match(gateway,/RONA_AI_TASK_LIFECYCLE_V1/);
  assert.match(gateway,/endsWith\("-pilot"\)/);
  assert.match(gateway,/TASK_COMPLETION_APPROVED_CONCLUSION_REQUIRED/);
  assert.match(gateway,/SYSTEM_ADMIN_BUSINESS_WRITE_BLOCKED/);
  assert.doesNotMatch(gateway,/functional_role:\s*\{/);
});
