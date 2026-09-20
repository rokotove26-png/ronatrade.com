import assert from 'node:assert/strict';
import { test } from 'node:test';
import { patchAdminOperationsCommandCenterV6, deriveOperationsDealCurrentRows } from '../functions/portal/admin-operations-command-center-v6.js';

const SOURCE='function renderAdminHome(){}\nfunction renderPrices(){}';

test('Operations Center V6 keeps one owner and exposes eight functional gauges', () => {
  const generated=patchAdminOperationsCommandCenterV6(SOURCE);
  assert.equal((generated.match(/function renderAdminHome\(\)\{/g)||[]).length,1);
  assert.equal((generated.match(/gauge\('/g)||[]).length,8);
  assert.match(generated,/data-rona-color-network':'v6/);
  assert.match(generated,/NET-07','Клиенты в сети',networkClientCount/);
  assert.match(generated,/NET-08','Агенты в сети',networkAgentCount/);
  assert.match(generated,/adminHomeNavigate\(target\)/);
  assert.match(generated,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(generated,/finance_event_submit/i);
});

test('network counters use only current Admin bootstrap identities', () => {
  const generated=patchAdminOperationsCommandCenterV6(SOURCE);
  assert.match(generated,/Array\.isArray\(d\.clients\)\?d\.clients:\[\]/);
  assert.match(generated,/Array\.isArray\(d\.agents\)\?d\.agents:\[\]/);
  assert.match(generated,/agent_person_id\|\|x\?\.agent_id/);
  assert.doesNotMatch(generated,/fetch\(|ownerApi\(|mutate\(/);
});


test('Operations Center active deal contour enriches only Admin-authorized deals with current Deals facts', () => {
  const base=[
    {deal_id:'DEAL-004',business_status:'EXECUTING',client_id:'C1',contract_id:'CTR1'},
    {deal_id:'DEAL-005',business_status:'EXECUTING',client_id:'C2',contract_id:'CTR2'},
    {deal_id:'DEAL-006',business_status:'EXECUTING',client_id:'C2',contract_id:'CTR2'},
    {deal_id:'DEAL-009',business_status:'EXECUTING',client_id:'C3',contract_id:'CTR3'},
    {deal_id:'DEAL-010',business_status:'REGISTERED',client_id:'C4',contract_id:'CTR4'},
    {deal_id:'DEAL-011',business_status:'REGISTERED',client_id:'C4',contract_id:'CTR4'},
  ];
  const snapshot={
    deals:[
      {deal_id:'DEAL-004',business_status:'EXECUTING',lifecycle_state:'ACTIVE',product_confirmed_at:'2026-09-01T00:00:00Z',quantity_confirmed_at:'2026-09-01T00:00:00Z',delivery_basis:'DAP',client_remaining_amount:0,finance_status:'PAID',payment_handoff_state:'READY',payment_expectation_state:'NOT_CREATED'},
      {deal_id:'DEAL-005',business_status:'EXECUTING',lifecycle_state:'ACTIVE',product_confirmed_at:'2026-09-01T00:00:00Z',quantity_confirmed_at:'2026-09-01T00:00:00Z',delivery_basis:'DAP',client_remaining_amount:470750,finance_status:'PARTIALLY_PAID',payment_handoff_state:'READY',payment_expectation_state:'NOT_CREATED'},
      {deal_id:'DEAL-006',business_status:'EXECUTING',lifecycle_state:'ACTIVE',product_confirmed_at:'2026-09-01T00:00:00Z',quantity_confirmed_at:'2026-09-01T00:00:00Z',delivery_basis:'DAP',client_remaining_amount:115080,finance_status:'PARTIALLY_PAID',payment_handoff_state:'READY',payment_expectation_state:'NOT_CREATED'},
      {deal_id:'DEAL-009',business_status:'EXECUTING',lifecycle_state:'ACTIVE',product_confirmed_at:'2026-09-01T00:00:00Z',quantity_confirmed_at:'2026-09-01T00:00:00Z',delivery_basis:'CPT',client_remaining_amount:362600,finance_status:'DUE',payment_handoff_state:'SENT',payment_expectation_state:'ACTIVE'},
      {deal_id:'DEAL-010',business_status:'REGISTERED',lifecycle_state:'ACTIVE',product_confirmed_at:'2026-09-01T00:00:00Z',quantity_confirmed_at:'2026-09-01T00:00:00Z',delivery_basis:'CPT',client_remaining_amount:131775,finance_status:'DUE',payment_handoff_state:'SENT',payment_expectation_state:'ACTIVE'},
      {deal_id:'DEAL-011',business_status:'REGISTERED',lifecycle_state:'ACTIVE',product_confirmed_at:'2026-09-01T00:00:00Z',quantity_confirmed_at:'2026-09-01T00:00:00Z',delivery_basis:'CPT',client_remaining_amount:753000,finance_status:'DUE',payment_handoff_state:'SENT',payment_expectation_state:'ACTIVE'},
      {deal_id:'DEAL-ARCHIVED-NOT-IN-ADMIN',business_status:'REGISTERED',lifecycle_state:'ARCHIVED',product_confirmed_at:'2026-09-01T00:00:00Z',quantity_confirmed_at:'2026-09-01T00:00:00Z',delivery_basis:'DAP'},
    ],
    documents:[
      ...['DEAL-004','DEAL-005','DEAL-006','DEAL-009','DEAL-010','DEAL-011'].flatMap(id=>[
        {deal_id:id,document_kind:'SIGNED_ADDENDUM'},
        {deal_id:id,document_kind:'INVOICE'},
      ]),
    ],
    rail:[{deal_id:'DEAL-004',rail_document_id:'GU12-1',wagons:[]}],
  };

  const rows=deriveOperationsDealCurrentRows(base,snapshot);
  assert.equal(rows.length,6,'snapshot may enrich but must not widen Admin-authorized deal scope');
  assert.equal(rows.some(x=>x.deal_id==='DEAL-ARCHIVED-NOT-IN-ADMIN'),false,'archived/foreign snapshot row must not enter Operations scope');
  assert.equal(rows.find(x=>x.deal_id==='DEAL-005').next_action_text,'Передать в оплату');
  assert.equal(rows.find(x=>x.deal_id==='DEAL-006').stage,'Передача в оплату');
  assert.equal(rows.find(x=>x.deal_id==='DEAL-009').next_action_text,'Контроль поступления оплаты');
  assert.equal(rows.find(x=>x.deal_id==='DEAL-010').stage,'Оплата');
  assert.equal(rows.find(x=>x.deal_id==='DEAL-011').current_projection_source,'DEALS_CURRENT_STATE_V1');
  assert.equal(rows.find(x=>x.deal_id==='DEAL-004').stage,'Исполнение поставки');
  assert.equal(rows.find(x=>x.deal_id==='DEAL-004').delivery_status,'ГУ-12 зарегистрирована');
});

test('Operations Center generated runtime listens for authoritative Deals refreshes', () => {
  const generated=patchAdminOperationsCommandCenterV6(SOURCE);
  assert.match(generated,/deriveOperationsDealCurrentRows\(Array\.isArray\(d\.deals\)\?d\.deals:\[\],window\.__RONA_DEALS_CURRENT_STATE_SNAPSHOT__\)/);
  assert.match(generated,/rona:deals-current-state/);
  assert.match(generated,/v1-authoritative-deals-snapshot/);
  assert.doesNotMatch(generated,/DEAL-2026-|RONA-C00|FARG|SOLYARIS|НИК-ОЙЛ|GAZON/i);
});
