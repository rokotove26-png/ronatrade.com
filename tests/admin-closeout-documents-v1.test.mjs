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
  assert.match(ui,/admin-closeout-documents-v1\.js\?v=20261005-v4/);
  assert.match(ui,/function buildDetail\(d\)/);
  assert.match(ui,/Карточка сделки/);
  assert.match(uiSource,/admin-closeout-documents-v1\.js\?v=20261005-v4/);
});

test('Closing-documents workspace uses the exact Owner document set and Client CLOSEOUT gets only its two upload kinds',()=>{
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
  assert.match(ownerAcceptance,/CLIENT_CLOSEOUT_DOCUMENT_KINDS/);
  assert.match(ownerAcceptance,/'delivery-stamp':'SMGS_DELIVERY_STAMP'/);
  assert.match(ownerAcceptance,/'empty-wagons':'SMGS_EMPTY_WAGONS'/);
  assert.match(ownerAcceptance,/clientCloseoutDocuments/);
  assert.match(ownerAcceptance,/registerClientCloseoutPdf/);
  assert.doesNotMatch(ownerAcceptance,/\/client\/deals\/\(\[\^\/\]\+\)\/complete/);
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
  assert.match(ownerAcceptance,/ensureCloseoutAssistantArchiveTask/);
  assert.match(ownerAcceptance,/assigned_functional_role/);
  assert.match(ownerAcceptance,/'ASSISTANT'::portal_private\.staff_functional_role_enum/);
  assert.match(ownerAcceptance,/DEAL_CLOSEOUT_DOCUMENT_ARCHIVE/);
  assert.match(ownerAcceptance,/ADMIN_DEAL_CLOSEOUT_ARCHIVE_V1/);
  assert.match(ownerAcceptance,/RONA Trade — Канонические документы/);
  assert.match(ownerAcceptance,/30_Сделки спецификации инвойсы/);
  assert.match(ownerAcceptance,/CLOSEOUT_PACKAGE=/);
  assert.match(ownerAcceptance,/assistantArchiveTaskId/);
  assert.match(closeoutRuntime,/Ассистенту RONA Trade/);
  assert.match(closeoutRuntime,/Google Drive/);
  assert.match(closeoutRuntime,/\/admin\/deals\/'\+encodeURIComponent\(deal\.deal_id\)\+'\/complete/);
  assert.match(closeoutRuntime,/\.is-completed/);
});


test('CLOSEOUT runtime DOM patch is idempotent and cannot self-trigger a MutationObserver loop',()=>{
  assert.match(closeoutRuntime,/if\(th&&th\.textContent!==label\)th\.textContent=label/);
  assert.match(closeoutRuntime,/if\(b\.textContent!==label\)b\.textContent=label/);
  assert.match(closeoutRuntime,/if\(b\.dataset\.ronaCloseoutDocsBound==='1'\)return/);
  assert.match(closeoutRuntime,/new MutationObserver\(schedule\)/);
});


test('Admin CLOSEOUT visual v3 has optimal density and readable typography',()=>{
  const runtime=closeoutRuntime;
  assert.match(runtime,/ADMIN_CLOSEOUT_VISUAL_V3/);
  assert.match(runtime,/width:clamp\(560px,36vw,680px\)/);
  assert.match(runtime,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
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
