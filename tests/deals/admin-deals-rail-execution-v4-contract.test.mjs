import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20260920144304_admin_deals_rail_execution_v4.sql','utf8');
const api=fs.readFileSync('functions/portal/owner-api.js','utf8');
const ui=fs.readFileSync('functions/portal/deals-current-state-ui.js','utf8');

test('Deals Rail Execution V4 is generic, source-locked and read-only',()=>{
  assert.match(migration,/create or replace function public\.owner_deals_rail_execution_v4\(p_deal_id text/i);
  assert.match(migration,/rail_xlsx_dislocation_current_position_v1/);
  assert.match(migration,/rail_xlsx_dislocation_current_audit_v1/);
  assert.match(migration,/rail_deal_route_assignments_v1/);
  assert.match(migration,/rail_documents/);
  assert.match(migration,/position_status='TRUSTED'/);
  assert.match(migration,/effective_resolution_status/i);
  assert.match(migration,/trusted_wagon_count/);
  assert.match(migration,/position_groups/);
  assert.match(migration,/unresolved_or_conflict_count/);
  assert.match(migration,/NO_CONFIRMED_POSITION_SOURCE/);
  assert.doesNotMatch(migration,/\bfrom\s+portal_private\.rail_wagons\b/i);
  assert.doesNotMatch(migration,/\bfrom\s+portal_private\.rail_movement_events\b/i);
  assert.doesNotMatch(migration,/DEAL-2026-/);
  assert.doesNotMatch(migration,/\b(insert|update|delete|truncate)\s+(into\s+)?portal_private\./i);
});

test('Deals Current V4 preserves V3 non-Rail payload and replaces Rail only',()=>{
  assert.match(migration,/create or replace function public\.owner_deals_current_v4\(\)/i);
  assert.match(migration,/v_base := public\.owner_deals_current_v3\(\)/);
  assert.match(migration,/v_rail := public\.owner_deals_rail_execution_v4\(null\)/);
  assert.match(migration,/v_base - 'rail' - 'readModelVersion' - 'generatedAt'/);
  assert.match(migration,/ADMIN_DEALS_CURRENT_V4/);
  assert.match(migration,/ADMIN_DEALS_RAIL_EXECUTION_V4/);
});

test('Owner API and Deals UI activate V4 narrowly',()=>{
  assert.match(api,/path==='\/admin\/deals-current-v4'&&method==='GET'/);
  assert.match(api,/return\['owner_deals_current_v4',\{\}\]/);
  assert.match(api,/path==='\/admin\/deals-current-v3'&&method==='GET'/);
  assert.match(ui,/api\('\/admin\/deals-current-v4'\)/);
  assert.match(ui,/trusted_wagon_count/);
  assert.match(ui,/position_groups/);
  assert.match(ui,/Нет подтверждённых данных о дислокации/);
  assert.match(ui,/локальное время источника/);
  assert.match(ui,/admin-deals-current-v4-finance-v8-rail-execution-v4/);
  assert.doesNotMatch(ui,/DEAL-2026-/);
  assert.doesNotMatch(ui,/String\(Number\(rr\.wagon_count\|\|0\)\)/);
});

test('Stable Finance and readiness markers remain intact',()=>{
  assert.match(ui,/paidNode\.title='Оплачено фактически'/);
  assert.match(ui,/Осталось:/);
  assert.match(ui,/Finance · оплачено \/ остаток/);
  assert.match(ui,/if\(structuralIssue\(d\)\|\|!hasClientSignedAddendum\(d\)\)return'HOLD';return'GO'/);
  assert.match(ui,/send\.disabled=overall\(d\)!=='GO'/);
  assert.match(ui,/inFinance\?'В платежном контуре'/);
});
