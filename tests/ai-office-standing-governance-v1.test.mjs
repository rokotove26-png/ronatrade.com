import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const staff=readFileSync(new URL('../supabase/migrations/20260929010000_ai_office_staff_directory_v1.sql',import.meta.url),'utf8');
const governance=readFileSync(new URL('../supabase/migrations/20260929010100_ai_office_competence_governance_v1.sql',import.meta.url),'utf8');
const state=readFileSync(new URL('../supabase/migrations/20260929010200_ai_office_role_state_v6.sql',import.meta.url),'utf8');

test('AI Office staff directory preserves canonical topology',()=>{
  assert.match(staff,/ai_staff_directory_v1/);
  assert.match(staff,/Операционный директор/);
  assert.match(staff,/Флеш Роман Караевич/);
  assert.match(staff,/ASSISTANT',null,null,'ADMIN_CONTOUR/);
});

test('competence gate is mandatory and fail closed',()=>{
  assert.match(governance,/RONA_AI_COMPETENCE_GATE_V1/);
  assert.match(governance,/DO_NOT_ACCEPT_OR_EXECUTE/);
  assert.match(governance,/HELPFUL_OVERRIDE_PROHIBITED/);
  assert.match(governance,/MARKET_ANALYST','COMMERCIAL_DIRECTOR/);
});

test('role recovery V6 carries persistent office context',()=>{
  assert.match(state,/RONA_ROLE_STATE_RECOVERY_V6/);
  for(const key of ['identity_profile','office_directory','competence_contract','mailbox','canonical_document_resources','canonical_report_catalog']){
    assert.match(state,new RegExp(key));
  }
  assert.match(state,/DO_NOT_INVENT_REPORT_TYPES/);
});
