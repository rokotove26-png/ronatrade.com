import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync('functions/portal/clients-agents-current-ui.js','utf8');
const proxy=fs.readFileSync('functions/portal/admin-authority/[[path]].js','utf8');
const authority=fs.readFileSync('supabase/functions/rona-admin-client-authority/index.ts','utf8');
const clientDirectory=fs.readFileSync('assets/portal-runtime/portal-client-company-directory-authority-v1.js','utf8');

test('Admin Clients/Agents exposes Add Company with CIS fields and signed PDF',()=>{
  assert.match(ui,/Добавить компанию/);
  assert.match(ui,/Название компании/);
  assert.match(ui,/ИНН/);
  assert.match(ui,/Страна регистрации/);
  assert.match(ui,/Прикрепить договор/);
  for(const country of ['Россия','Беларусь','Казахстан','Армения','Азербайджан','Кыргызстан','Таджикистан','Узбекистан','Туркменистан','Молдова']){
    assert.ok(ui.includes(country),country);
  }
});

test('company creation is isolated from user creation and preserves signed contract authority',()=>{
  assert.match(ui,/mutate\('\/companies'/);
  assert.match(ui,/attachPdf\(\{client_id:created\.clientId,contract_id:created\.contractId/);
  assert.match(ui,/ronaCompanyContractAttach/);
  assert.doesNotMatch(ui,/void choosePdf\(row,up\)/);
  assert.match(ui,/Договор прикрепляется в карточке компании/);
});

test('Add Company takes Contract ID and external contract number from the authoritative registry',()=>{
  assert.match(proxy,/path === '\/companies'/);
  assert.match(proxy,/signed-document\\\/attach/);
  assert.match(authority,/path === "\/companies"/);
  assert.match(authority,/ADMIN_CLIENT_LINKED_TO_REGISTERED_CONTRACT/);
  assert.match(authority,/current_external_contract_number/);
  assert.match(authority,/contractIdentityOrigin: "OPERATIONS_CONTRACT_REGISTRY"/);
  assert.match(authority,/synthetic_contract_allocation: false/);
  assert.doesNotMatch(authority,/RONA_CLIENT_ID_ALLOCATOR_V1/);
  assert.doesNotMatch(authority,/const contractId = clientId \+ '-CTR-'/);
  assert.match(ui,/registeredContractLinked!==true/);
  assert.match(ui,/Реестр подтверждён:/);
});

test('existing verified signed-document chain remains the client download authority',()=>{
  assert.match(authority,/BILATERAL_CONTRACT_ATTACH_CONFIRMED/);
  assert.match(authority,/SIGNED_CONTRACT_STORAGE_REGISTERED/);
  assert.match(authority,/clientDownloadAllowed: true/);
  assert.match(clientDirectory,/current_signed_contract/);
  assert.match(clientDirectory,/\/v1\/client\/storage\//);
  assert.match(clientDirectory,/signed-url/);
});
