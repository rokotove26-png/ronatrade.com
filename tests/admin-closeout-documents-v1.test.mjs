import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest as dealsRuntime} from '../functions/portal/deals-current-state-ui.js';

const uiSource=readFileSync('functions/portal/deals-current-state-ui.js','utf8');
const closeoutRuntime=readFileSync('assets/portal-runtime/admin-closeout-documents-v1.js','utf8');
const ownerAcceptance=readFileSync('supabase/functions/rona-owner-acceptance/index.ts','utf8');

test('Admin CLOSEOUT loads a separate closing-documents runtime without replacing deal passport',async()=>{
  const response=await dealsRuntime();
  assert.equal(response.status,200);
  const ui=await response.text();
  assert.match(ui,/ADMIN_CLOSEOUT_DOCUMENTS_V1/);
  assert.match(ui,/admin-closeout-documents-v1\.js\?v=20261005-v3/);
  assert.match(ui,/function buildDetail\(d\)/);
  assert.match(ui,/Карточка сделки/);
  assert.match(uiSource,/admin-closeout-documents-v1\.js\?v=20261005-v3/);
});

test('Closing-documents workspace uses the exact Owner document set and keeps client upload UI unchanged',()=>{
  for(const label of [
    'Закрывающие документы',
    'Подписанное дополнительное соглашение',
    'Инвойс',
    'Инструкция по возврату порожних вагонов',
    'ЖД коды на возврат порожних вагонов',
    'СМГС с отметкой о выдаче груза',
    'СМГС №2 на порожние вагоны',
    'Завершить сделку'
  ]) assert.ok(closeoutRuntime.includes(label),label);
  assert.match(closeoutRuntime,/EMPTY_WAGON_RETURN_INSTRUCTION/);
  assert.match(closeoutRuntime,/EMPTY_WAGON_RETURN_RAIL_CODES/);
  assert.match(closeoutRuntime,/SMGS_DELIVERY_STAMP/);
  assert.match(closeoutRuntime,/SMGS_EMPTY_WAGONS/);
  assert.match(closeoutRuntime,/Загружает клиент/);
  assert.doesNotMatch(ownerAcceptance,/\/client\/deals\/\(\[\^\/\]\+\)\/closeout-documents/);
});

test('Admin closeout document uploads persist through the existing document storage workflow',()=>{
  assert.match(ownerAcceptance,/ADMIN_CLOSEOUT_DOCUMENT_KINDS/);
  assert.match(ownerAcceptance,/return-instruction/);
  assert.match(ownerAcceptance,/return-rail-codes/);
  assert.match(ownerAcceptance,/registerDealPdf\(ctx,req,decodeURIComponent\(m\[1\]\),ADMIN_CLOSEOUT_DOCUMENT_KINDS\[m\[2\]\],false\)/);
  assert.match(closeoutRuntime,/\/admin\/documents\//);
  assert.match(closeoutRuntime,/Скачать/);
});

test('Deal completion is Owner-triggered, CLOSEOUT-gated, audited and idempotent',()=>{
  assert.match(ownerAcceptance,/async function completeDealFromCloseout/);
  assert.match(ownerAcceptance,/select public\.owner_deals_current_v4\(\) as data/);
  assert.match(ownerAcceptance,/post_rail_completion_attention!==true/);
  assert.match(ownerAcceptance,/closeout_stage/);
  assert.match(ownerAcceptance,/DEAL_NOT_IN_CLOSEOUT/);
  assert.match(ownerAcceptance,/for update/);
  assert.match(ownerAcceptance,/business_status='CLOSED'/);
  assert.match(ownerAcceptance,/lifecycle_state='CLOSED'::portal_private\.lifecycle_state_enum/);
  assert.match(ownerAcceptance,/closed_at=coalesce\(closed_at,now\(\)\)/);
  assert.match(ownerAcceptance,/OWNER_DEAL_COMPLETED/);
  assert.match(closeoutRuntime,/\/admin\/deals\/'\+encodeURIComponent\(deal\.deal_id\)\+'\/complete/);
  assert.match(closeoutRuntime,/\.is-completed/);
});


test('CLOSEOUT runtime DOM patch is idempotent and cannot self-trigger a MutationObserver loop',()=>{
  assert.match(closeoutRuntime,/if\(th&&th\.textContent!==label\)th\.textContent=label/);
  assert.match(closeoutRuntime,/if\(b\.textContent!==label\)b\.textContent=label/);
  assert.match(closeoutRuntime,/if\(b\.dataset\.ronaCloseoutDocsBound==='1'\)return/);
  assert.match(closeoutRuntime,/new MutationObserver\(schedule\)/);
});


test('Admin CLOSEOUT visual v2 has balanced hierarchy and restrained final action',()=>{
  const runtime=closeoutRuntime;
  assert.match(runtime,/ADMIN_CLOSEOUT_VISUAL_V2/);
  assert.match(runtime,/width:clamp\(760px,48vw,1040px\)/);
  assert.match(runtime,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(runtime,/rona-closeout-doc-status--ready/);
  assert.match(runtime,/rona-closeout-doc-status--required/);
  assert.match(runtime,/rona-closeout-doc-status--waiting/);
  assert.match(runtime,/Документы сделки/);
  assert.match(runtime,/Загружает администратор/);
  assert.match(runtime,/Документы от клиента/);
  assert.match(runtime,/position:sticky;bottom:-1px/);
  assert.match(runtime,/width:220px/);
  assert.match(runtime,/RONA Trade · финальная стадия/);
});
