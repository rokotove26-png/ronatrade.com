import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const hardening=readFileSync('supabase/functions/rona-portal-api/payments-v8-production-hardening.ts','utf8');
const proxy=readFileSync('functions/portal/api/[[path]].js','utf8');
const renderer=readFileSync('assets/portal-runtime/client-deals-authoritative-v1.js','utf8');
const attach=readFileSync('scripts/attach-client-deals-authoritative-v1.mjs','utf8');

test('Client CLOSEOUT projection is scoped, read-only, and source locked',()=>{
  assert.match(hardening,/CLIENT_DEAL_CLOSEOUT_PROJECTION_V1/);
  assert.match(hardening,/closeoutIds\.length/);
  assert.match(hardening,/rail_operational_current_position_v1/);
  assert.match(hardening,/rail_xlsx_resolution_effective_v1/);
  assert.match(hardening,/position_status='TRUSTED'/);
  assert.match(hardening,/count\(distinct wo\.cargo_weight_tonnes\)/);
  assert.match(hardening,/deal_finance_authority_payments_v8_read_v1/);
  assert.match(hardening,/source_proposed_price\*s\.source_quantity_tonnes-s\.obligation_amount/);
  assert.match(hardening,/closeout_actual_quantity_tonnes/);
  assert.match(hardening,/closeout_actual_amount/);
  assert.match(hardening,/closeout_balance_amount/);
  assert.match(hardening,/CLIENT_OWES_RONA/);
  assert.match(hardening,/RONA_OWES_CLIENT/);
  assert.match(hardening,/RAIL_LOGISTICS_TRUSTED_WAGONS_STABLE_WEIGHT_HISTORY_V1/);
  assert.match(hardening,/CLIENT_APPLICATION_PRICE_RECONCILED_TO_FINANCE_V8_V1/);
  assert.match(hardening,/cl\.client_id=\$\{responseClientId\}/);
  assert.match(hardening,/ct\.contract_id=\$\{responseContractId\}/);
  assert.doesNotMatch(hardening,/DEAL-2026-004/);
  assert.doesNotMatch(hardening,/\b(update|delete\s+from|truncate|insert\s+into)\b/i);
});

test('Client ATTENTION CLOSEOUT renderer is isolated from ACTIVE cards',()=>{
  assert.match(renderer,/20261005-client-deals-authoritative-closeout-v13/);
  assert.match(renderer,/function closeoutCard\(d,a\)/);
  assert.match(renderer,/dealStage\(d\)==='ATTENTION'&&upper\(d\?\.closeout_stage\)==='CLOSEOUT'/);
  assert.match(renderer,/data-rona-client-closeout/);
  assert.match(renderer,/CURRENT_CLIENT_CONTEXT_CLOSEOUT/);
  assert.match(renderer,/Отгружено/);
  assert.match(renderer,/Факт\. объём/);
  assert.match(renderer,/Оплачено/);
  assert.match(renderer,/Фактическая сумма/);
  assert.match(renderer,/Клиент должен RONA/);
  assert.match(renderer,/RONA должна клиенту/);
  assert.match(renderer,/data-open-deal/);
  assert.match(renderer,/panel\.style\.setProperty\('display','none','important'\)/);
  assert.match(renderer,/function card\(d,a\).*CURRENT_CLIENT_CONTEXT/s);
  assert.doesNotMatch(renderer,/DEAL-2026-004/);
});

test('Client gateway preserves CLOSEOUT fields without widening tenant scope',()=>{
  for(const field of [
    'closeout_stage','closeout_product_status','closeout_product_status_label','closeout_projection_state',
    'closeout_actual_quantity_tonnes','closeout_deal_unit_price','closeout_currency','closeout_paid_amount',
    'closeout_actual_amount','closeout_balance_amount','closeout_balance_direction','closeout_contract_number',
    'closeout_delivery_basis','closeout_product','closeout_quantity_source','closeout_price_source','closeout_projection_source'
  ]) assert.ok(proxy.includes(field),field+' missing from Client safe projection');
  assert.match(proxy,/closeout=railCompleted&&fullyPaid&&!terminal/);
  assert.match(proxy,/RAIL_COMPLETED_AND_100_PERCENT_PAID_OWNER_RULE_EDGE_V2/);
  assert.doesNotMatch(proxy,/DEAL-2026-004/);
});

test('Client CLOSEOUT runtime is cache-busted and remains passport-capable',()=>{
  assert.match(attach,/client-deals-authoritative-v1\.js\?v=20261005-authoritative-v16-client-closeout/);
  assert.match(attach,/20261005-client-deals-authoritative-closeout-v13/);
  assert.match(renderer,/open\.textContent='Открыть'/);
  assert.match(renderer,/open\.setAttribute\('data-open-deal',id\)/);
});
