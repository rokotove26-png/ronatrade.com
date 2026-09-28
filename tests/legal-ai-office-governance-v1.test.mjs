import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const gateway=readFileSync(new URL('../supabase/functions/rona-mcp-gateway/index.ts',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/20260928203500_legal_ai_office_governance_v1.sql',import.meta.url),'utf8');

test('gateway advertises only canonical AI handoff targets',()=>{
  assert.match(gateway,/CANONICAL_AI_HANDOFF_TARGETS/);
  for(const role of ['COMMERCIAL_DIRECTOR','FINANCE','LEGAL','OPERATIONS_DIRECTOR','RAIL_LOGISTICS','SYSTEM_ADMIN']){
    assert.match(gateway,new RegExp('"'+role+'"'));
  }
  assert.match(gateway,/handoff\.inputSchema\.properties\.target_role\.enum = \[\.\.\.CANONICAL_AI_HANDOFF_TARGETS\]/);
  assert.match(gateway,/CANONICAL_AI_HANDOFF_TARGET_SET\.has\(targetRole\)/);
});

test('legacy MARKET_ANALYST is not a canonical handoff target',()=>{
  const m=gateway.match(/CANONICAL_AI_HANDOFF_TARGETS = Object\.freeze\(\[([^\]]+)\]\)/);
  assert.ok(m);
  assert.doesNotMatch(m[1],/MARKET_ANALYST/);
});

test('Legal durable governance policy is owner-authorized and non task scoped',()=>{
  assert.match(migration,/LEGAL_AI_OFFICE_GOVERNANCE_V1/);
  assert.match(migration,/OWNER_INSTRUCTION:2026-09-28:LEGAL_AI_OFFICE_GOVERNANCE_V1/);
  assert.match(migration,/'LEGAL'::portal_private\.ai_business_role_enum/);
  assert.match(migration,/'GLOBAL_LEGAL_ROLE'/);
  assert.match(migration,/ONLY_OWNER_AND_TREASURY_ARE_HUMAN/);
  assert.match(migration,/NO_CROSS_ROLE_AUTHORITY_EXPANSION/);
  assert.match(migration,/LEGAL_AUTHORITY_SCOPE','UNCHANGED/);
  assert.match(migration,/ACCOUNTING','EXECUTIVE_DIRECTOR/);
});
