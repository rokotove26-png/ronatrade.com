import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest as closeoutRuntime} from '../functions/portal/deals-current-state-ui.js';

const migration=readFileSync('supabase/migrations/20261005055000_admin_deal_closeout_projection_v1.sql','utf8');
const uiSource=readFileSync('functions/portal/deals-current-state-ui.js','utf8');
const closingRuntime=readFileSync('assets/portal-runtime/admin-closeout-documents-v1.js','utf8');
const ownerAcceptance=readFileSync('supabase/functions/rona-owner-acceptance/index.ts','utf8');

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
  assert.match(ui,/function productOperationalStatus\(d\)/);
  assert.match(ui,/Отгружено/);
  assert.match(ui,/В пути/);
  assert.match(ui,/'Этап','Паспорт'/);
  assert.match(ui,/closeoutStageCell\(d\),button\(selected===d\.deal_id\?'Свернуть':'Открыть'/);
  assert.match(ui,/Finance · оплачено \/ остаток/);
  assert.match(ui,/Logistics/);
  assert.match(ui,/Documents/);
  assert.match(ui,/Accounting/);
  assert.match(ui,/Статус/);
  assert.doesNotMatch(ui,/DEAL-2026-004/);
  assert.doesNotMatch(uiSource,/DEAL-2026-004/);
});


test('Admin CLOSEOUT closing documents are a separate Owner workspace',async()=>{
  const response=await closeoutRuntime();
  const ui=await response.text();
  assert.match(ui,/ADMIN_CLOSEOUT_DOCUMENTS_V1/);
  assert.match(ui,/admin-closeout-documents-v1\.js\?v=20261005-v4/);
  for(const label of [
    'Закрывающие документы',
    'Подписанное дополнительное соглашение',
    'Инвойс',
    'Инструкция по возврату порожних вагонов',
    'ЖД коды на возврат порожних вагонов',
    'СМГС с отметкой о выдаче груза',
    'СМГС №2 на порожние вагоны',
    'Завершить сделку'
  ]) assert.ok(closingRuntime.includes(label),label);
  assert.match(closingRuntime,/EMPTY_WAGON_RETURN_INSTRUCTION/);
  assert.match(closingRuntime,/EMPTY_WAGON_RETURN_RAIL_CODES/);
  assert.match(closingRuntime,/SMGS_DELIVERY_STAMP/);
  assert.match(closingRuntime,/SMGS_EMPTY_WAGONS/);
  assert.match(ui,/function buildDetail\(d\)/);
});

test('Admin CLOSEOUT completion is gated by the canonical CLOSEOUT projection and audited',()=>{
  assert.match(ownerAcceptance,/async function completeDealFromCloseout/);
  assert.match(ownerAcceptance,/select public\.owner_deals_current_v4\(\) as data/);
  assert.match(ownerAcceptance,/post_rail_completion_attention!==true/);
  assert.match(ownerAcceptance,/closeout_stage/);
  assert.match(ownerAcceptance,/DEAL_NOT_IN_CLOSEOUT/);
  assert.match(ownerAcceptance,/for update/);
  assert.match(ownerAcceptance,/business_status='CLOSED'/);
  assert.match(ownerAcceptance,/lifecycle_state='CLOSED'::portal_private\.lifecycle_state_enum/);
  assert.match(ownerAcceptance,/OWNER_DEAL_COMPLETED/);
  assert.match(ownerAcceptance,/ADMIN_CLOSEOUT_DOCUMENT_KINDS/);
});


test('Completed CLOSEOUT deals are exclusive to Completed and cannot remain in Attention',async()=>{
  const response=await closeoutRuntime();
  const ui=await response.text();
  assert.match(ui,/function isCompleted\(d\).*\['CLOSED','COMPLETED','SETTLED'\]\.includes\(bs\)\|\|ls==='CLOSED'/s);
  assert.match(ui,/function needsAttention\(d\)\{if\(isActive\(d\)&&isPostExecutionAttention\(d\)\)return true;if\(!isExecutionMonitoringActive\(d\)\)return false;/);
  assert.match(ui,/if\(filter==='COMPLETED'\)return ds\.filter\(isCompleted\)/);
});


test('CLOSEOUT runtime DOM patch is idempotent and cannot self-trigger a MutationObserver loop',()=>{
  assert.match(closingRuntime,/if\(th&&th\.textContent!==label\)th\.textContent=label/);
  assert.match(closingRuntime,/if\(b\.textContent!==label\)b\.textContent=label/);
  assert.match(closingRuntime,/if\(b\.dataset\.ronaCloseoutDocsBound==='1'\)return/);
  assert.match(closingRuntime,/new MutationObserver\(schedule\)/);
});


test('Admin CLOSEOUT visual v3 has optimal density and readable typography',()=>{
  const runtime=closingRuntime;
  assert.match(runtime,/ADMIN_CLOSEOUT_VISUAL_V3/);
  assert.match(runtime,/width:clamp\(760px,48vw,1040px\)/);
  assert.match(runtime,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(runtime,/rona-closeout-doc-status--ready/);
  assert.match(runtime,/rona-closeout-doc-status--required/);
  assert.match(runtime,/rona-closeout-doc-status--waiting/);
  assert.match(runtime,/Документы сделки/);
  assert.match(runtime,/Загружает администратор/);
  assert.match(runtime,/Документы от клиента/);
  assert.match(runtime,/position:sticky;bottom:-1px/);
  assert.match(runtime,/width:180px/);
  assert.match(runtime,/RONA Trade · финальная стадия/);
  assert.match(runtime,/font-size:13.5px/);
  assert.match(runtime,/font-size:14.5px/);
  assert.match(runtime,/grid-template-columns:1fr;gap:10px;align-items:stretch/);
});
