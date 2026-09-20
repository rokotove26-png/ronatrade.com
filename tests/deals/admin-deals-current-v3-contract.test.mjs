import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20260920134402_admin_deals_current_v3_execution_read_model.sql','utf8');
const api=fs.readFileSync('functions/portal/owner-api.js','utf8');
const ui=fs.readFileSync('functions/portal/deals-current-state-ui.js','utf8');

test('Deals V3 read model is generic and read-only',()=>{
  assert.match(migration,/create or replace function public\.owner_deals_current_v3\(\)/i);
  assert.match(migration,/deal_finance_authority_payments_v8_read_v1/);
  assert.match(migration,/f\.is_terminal = true/);
  assert.match(migration,/f\.source_locked = true/);
  assert.match(migration,/rail_deal_route_assignments_v1/);
  assert.match(migration,/rail_documents/);
  assert.match(migration,/rail_wagons/);
  assert.match(migration,/rail_movement_events/);
  assert.doesNotMatch(migration,/DEAL-2026-/);
  assert.doesNotMatch(migration,/\b(insert|update|delete|truncate)\s+(into\s+)?portal_private\./i);
});

test('Owner API exposes only a read RPC for Deals V3',()=>{
  assert.match(api,/path==='\/admin\/deals-current-v3'&&method==='GET'/);
  assert.match(api,/return\['owner_deals_current_v3',\{\}\]/);
});

test('Deals UI reads V4 while preserving readiness GO gate',()=>{
  assert.match(ui,/api\('\/admin\/deals-current-v3'\)/);
  assert.match(ui,/projection==='FINANCE_V8'\)return due!==null&&due>0/);
  assert.match(ui,/finance_projection_version/);
  assert.match(ui,/route_resolution_state/);
  assert.match(ui,/if\(structuralIssue\(d\)\|\|!hasClientSignedAddendum\(d\)\)return'HOLD';return'GO'/);
  assert.match(ui,/send\.disabled=overall\(d\)!=='GO'/);
  assert.match(ui,/finance_projection_version\|\|''\)\.toUpperCase\(\)==='FINANCE_V8'/);
  assert.match(ui,/inFinance\?'В платежном контуре'/);
  assert.match(ui,/paidNode\.title='Оплачено фактически'/);
  assert.match(ui,/Осталось:/);
  assert.match(ui,/rona-current-fin-paid/);
  assert.match(ui,/rona-current-fin-remaining--open/);
  assert.match(ui,/rona-current-fin-remaining--danger/);
  assert.match(ui,/rona-current-fin-remaining--settled/);
  assert.match(ui,/Finance · оплачено \/ остаток/);
  assert.doesNotMatch(ui,/DEAL-2026-/);
});
