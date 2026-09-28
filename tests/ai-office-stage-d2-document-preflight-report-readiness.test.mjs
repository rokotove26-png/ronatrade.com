import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migration=readFileSync(new URL('../supabase/migrations/20260929010800_document_generation_preflight_stage_d2.sql',import.meta.url),'utf8');
const rollback=readFileSync(new URL('../supabase/rollback/20260929010800_document_generation_preflight_stage_d2.rollback.sql',import.meta.url),'utf8');

test('Stage D.2 document generation is fail-closed on active V2 and exact Stage D.1 asset preflight',()=>{
  assert.match(migration,/owner_document_generation_preflight_v1/);
  assert.match(migration,/owner_document_standard_v2_preflight_v1\(\)/);
  assert.match(migration,/ACTIVE_DOCUMENT_STANDARD_NOT_V2/);
  assert.match(migration,/CANONICAL_ASSET_PREFLIGHT_NOT_READY/);
  assert.match(migration,/CANONICAL_ASSET_SET_INCOMPLETE/);
  assert.match(migration,/RONA_DOCUMENT_GENERATION_PREFLIGHT_V1/);
  assert.match(migration,/must_assert_before_generation_or_issuance',true/);
  assert.match(migration,/fail_closed_on_missing_or_conflicting_standard',true/);
});

test('current-state document resources expose preflight metadata without binary asset content',()=>{
  assert.match(migration,/'generation_preflight',portal_private\.owner_document_generation_preflight_v1\(null\)/);
  assert.match(migration,/'binary_assets_exposed_in_projection',false/);
  assert.doesNotMatch(migration,/jsonb_build_object\([\s\S]{0,800}'content',a\.content/);
});

test('assert contract raises rather than allowing stale generation',()=>{
  assert.match(migration,/owner_document_generation_assert_v1/);
  assert.match(migration,/RONA_DOCUMENT_GENERATION_PREFLIGHT_FAILED/);
  assert.match(migration,/revoke all on function portal_private\.owner_document_generation_assert_v1\(text\)/);
});

test('Finance ACTIVE report rows require source lock and Owner approval',()=>{
  assert.match(migration,/finance_canonical_report_registry_guard_v1/);
  assert.match(migration,/FINANCE_CANONICAL_REPORT_OWNER_APPROVAL_REQUIRED/);
  assert.match(migration,/FINANCE_CANONICAL_REPORT_SOURCE_REF_REQUIRED/);
  assert.match(migration,/FINANCE_CANONICAL_REPORT_AUTHORITATIVE_SOURCES_REQUIRED/);
  assert.match(migration,/FINANCE_CANONICAL_REPORT_TEMPLATE_OR_METHODOLOGY_REQUIRED/);
});

test('SYSTEM_ADMIN does not invent or populate Finance report content in Stage D.2',()=>{
  assert.match(migration,/FINANCE_REPORT_POPULATION=SOURCE_ABSENT_DO_NOT_INVENT/);
  assert.match(migration,/content_owner','FINANCE'/);
  assert.match(migration,/system_admin_scope','TECHNICAL_MATERIALIZATION_ONLY'/);
  assert.match(migration,/NO_OWNER_APPROVED_SOURCE_LOCKED_FINANCE_REPORT_DEFINITION/);
  assert.doesNotMatch(migration,/insert\s+into\s+portal_private\.finance_canonical_report_registry_v1/i);
});

test('Finance catalog projects readiness and source-absent semantics',()=>{
  assert.match(migration,/finance_canonical_report_registry_readiness_v1/);
  assert.match(migration,/population_status',case when active_count>0 then 'READY' else 'SOURCE_ABSENT' end/);
  assert.match(migration,/'readiness',portal_private\.finance_canonical_report_registry_readiness_v1\(\)/);
  assert.match(migration,/DO_NOT_INVENT_REPORT_TYPES__SOURCE_LOCK_OWNER_APPROVED_REPORTS_BEFORE_INSERT/);
});

test('rollback is non-destructive and restores pre-D.2 projections',()=>{
  assert.match(rollback,/non-destructive rollback/i);
  assert.match(rollback,/ai_canonical_document_resources_v1/);
  assert.match(rollback,/finance_canonical_report_catalog_v1/);
  assert.doesNotMatch(rollback,/delete\s+from/i);
  assert.doesNotMatch(rollback,/drop\s+table/i);
});
