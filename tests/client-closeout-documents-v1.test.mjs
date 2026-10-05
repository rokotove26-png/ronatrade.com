// OWNER_VISUAL_APPROVAL: CLIENT_DEALS_ATTENTION_CLOSEOUT_PARITY_V1
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const deals=readFileSync('assets/portal-runtime/client-deals-authoritative-v1.js','utf8');
const closeout=readFileSync('assets/portal-runtime/client-closeout-documents-v1.js','utf8');
const attach=readFileSync('scripts/attach-client-deals-authoritative-v1.mjs','utf8');
const owner=readFileSync('supabase/functions/rona-owner-acceptance/index.ts','utf8');
const cache=readFileSync('scripts/emit-client-runtime-cache-policy.mjs','utf8');

test('Client ATTENTION CLOSEOUT opens dedicated client workspace instead of native deal passport',()=>{
  assert.match(deals,/20261005-client-deals-authoritative-closeout-v14/);
  assert.match(deals,/dealStage\(d\)==='ATTENTION'/);
  assert.match(deals,/closeout_stage/);
  assert.match(deals,/rona:client:closeout-open/);
  assert.match(deals,/event\.stopImmediatePropagation\(\)/);
  assert.match(closeout,/20261005-client-closeout-documents-v1/);
  assert.match(closeout,/rona:client:closeout-open/);
});

test('Client CLOSEOUT workspace mirrors six-document set but preserves Owner completion authority',()=>{
  for(const value of [
    'Подписанное дополнительное соглашение',
    'Инвойс',
    'Инструкция по возврату порожних вагонов',
    'ЖД коды на возврат порожних вагонов',
    'СМГС с отметкой о выдаче груза',
    'СМГС №2 на порожние вагоны',
    'SMGS_DELIVERY_STAMP',
    'SMGS_EMPTY_WAGONS',
    'Клиент не может самостоятельно перевести сделку в «Завершенные»'
  ]) assert.ok(closeout.includes(value),value);
  assert.doesNotMatch(closeout,/Завершить сделку/);
  assert.doesNotMatch(closeout,/\/admin\/deals\//);
});

test('Client can upload only two CLOSEOUT SMGS kinds and Admin impersonation stays read-only',()=>{
  assert.match(owner,/CLIENT_CLOSEOUT_DOCUMENT_KINDS/);
  assert.match(owner,/'delivery-stamp':'SMGS_DELIVERY_STAMP'/);
  assert.match(owner,/'empty-wagons':'SMGS_EMPTY_WAGONS'/);
  assert.match(owner,/clientCloseoutDealAccess/);
  assert.match(owner,/client_user_has_deal_access/);
  assert.match(owner,/DEAL_NOT_IN_CLOSEOUT/);
  assert.match(owner,/CLIENT_CLOSEOUT_DOCUMENT_ALREADY_UPLOADED/);
  assert.match(owner,/ctx\.impersonation\?\.subjectMode==='ADMIN_ENTITY'/);
  assert.match(closeout,/ADMIN ENTITY · READ ONLY/);
  assert.match(closeout,/Загрузка недоступна в режиме просмотра/);
});

test('Client CLOSEOUT document routes are narrow and use existing storage/download workflow',()=>{
  assert.ok(owner.includes('closeout-documents'));
  assert.match(owner,/delivery-stamp\|empty-wagons/);
  assert.match(owner,/registerClientCloseoutPdf/);
  assert.match(owner,/registerDealPdf\(ctx,req,dealId,kind,true\)/);
  assert.match(closeout,/\/client\/documents\//);
  assert.match(closeout,/\/download/);
  assert.match(closeout,/FormData/);
  assert.match(closeout,/application\/pdf/);
});

test('Canonical Client build attaches one closeout runtime with no-store cache policy',()=>{
  assert.match(attach,/client-closeout-documents-v1\.js\?v=20261005-client-closeout-v1/);
  assert.match(attach,/20261005-client-closeout-documents-v1/);
  assert.match(attach,/CLIENT_CLOSEOUT_DOCUMENTS_RUNTIME_NOT_SINGLE/);
  assert.match(cache,/client-closeout-documents-v\*\.js/);
});
