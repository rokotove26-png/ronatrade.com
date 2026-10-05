import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest as closeoutRuntime} from '../functions/portal/deals-current-state-ui.js';

const migration=readFileSync('supabase/migrations/20261005055000_admin_deal_closeout_projection_v1.sql','utf8');
const uiSource=readFileSync('functions/portal/deals-current-state-ui.js','utf8');

test('Admin CLOSEOUT read model is projection-only and source locked',()=>{
  assert.match(migration,/create or replace function public\.owner_deals_current_v4\(\)/i);
  assert.match(migration,/rail_operational_current_position_v1/i);
  assert.match(migration,/rail_xlsx_resolution_effective_v1/i);
  assert.match(migration,/cp\.position_status='TRUSTED'/);
  assert.match(migration,/count\(distinct wo\.cargo_weight_tonnes\)/);
  assert.match(migration,/actual_shipped_quantity_tonnes/);
  assert.match(migration,/source_proposed_price/);
  assert.match(migration,/source_quantity_tonnes/);
  assert.match(migration,/obligation_amount/);
  assert.match(migration,/closeout_actual_amount/);
  assert.match(migration,/closeout_balance_amount/);
  assert.match(migration,/CLIENT_OWES_RONA/);
  assert.match(migration,/RONA_OWES_CLIENT/);
  assert.match(migration,/SETTLED/);
  assert.doesNotMatch(migration,/\b(update|delete\s+from|truncate|insert\s+into)\b/i);
  assert.doesNotMatch(migration,/DEAL-2026-004/);
});

test('Generated Admin CLOSEOUT runtime is isolated to ATTENTION and preserves standard rows',async()=>{
  const response=await closeoutRuntime();
  assert.equal(response.status,200);
  assert.equal(response.headers.get('x-rona-deals-closeout'),'admin-closeout-v1');
  const ui=await response.text();
  assert.match(ui,/ADMIN_DEAL_CLOSEOUT_V1/);
  assert.match(ui,/filter==='ATTENTION'\?visible\.filter\(isPostExecutionAttention\)/);
  assert.match(ui,/closeout_actual_quantity_tonnes/);
  assert.match(ui,/closeout_paid_amount/);
  assert.match(ui,/closeout_actual_amount/);
  assert.match(ui,/closeout_balance_amount/);
  assert.match(ui,/Факт\. объём/);
  assert.match(ui,/Фактическая сумма/);
  assert.match(ui,/Задолженность/);
  assert.match(ui,/queue=card\('CLOSEOUT'/);
  assert.match(ui,/CLIENT_OWES_RONA/);
  assert.match(ui,/RONA_OWES_CLIENT/);
  assert.match(ui,/Клиент должен RONA/);
  assert.match(ui,/RONA должна клиенту/);
  assert.match(ui,/Finance · оплачено \/ остаток/);
  assert.match(ui,/Logistics/);
  assert.match(ui,/Documents/);
  assert.match(ui,/Accounting/);
  assert.match(ui,/Статус/);
  assert.doesNotMatch(ui,/DEAL-2026-004/);
  assert.doesNotMatch(uiSource,/DEAL-2026-004/);
});
