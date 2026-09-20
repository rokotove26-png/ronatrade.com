import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveOperationsMissionCurrentRows } from '../../functions/portal/admin-operations-command-center-v8.js';

const docs=(id)=>[
  {deal_id:id,document_kind:'SIGNED_ADDENDUM',checked_by_admin:true},
  {deal_id:id,document_kind:'INVOICE',checked_by_admin:true}
];

function baseDeal(id,extra={}){
  return {
    deal_id:id,
    lifecycle_state:'ACTIVE',
    business_status:'EXECUTING',
    product_confirmed_at:'2026-09-01T00:00:00Z',
    quantity_confirmed_at:'2026-09-01T00:00:00Z',
    delivery_basis:'DAP',
    contract_status:'ACTIVE',
    finance_projection_version:'FINANCE_V8',
    finance_status:'PAID',
    due_now:0,
    expected_not_due:0,
    future_conditional:0,
    client_remaining_amount:0,
    execution_status:'CONFIRMED_EXECUTION_STATE',
    documentary_status:'CONFIRMED',
    accounting_status:'OPEN',
    ...extra
  };
}

test('WAGONS_ACTIVE mission uses canonical Rail V4 positions and reports nine wagons',()=>{
  const id='DEAL-FUTURE-ALPHA';
  const snapshot={
    deals:[baseDeal(id)],
    documents:docs(id),
    rail:[{
      deal_id:id,
      rail_state:'WAGONS_ACTIVE',
      route_resolution_state:'RESOLVED',
      gu12_count:1,
      trusted_wagon_count:9,
      unresolved_or_conflict_count:0,
      wagon_positions:Array.from({length:9},(_,i)=>({wagonNumber:String(i+1),positionStatus:'TRUSTED',effectiveResolutionStatus:'MATCHED'}))
    }]
  };
  const [row]=deriveOperationsMissionCurrentRows([{deal_id:id}],snapshot);
  assert.equal(row.stage,'ЖД / исполнение');
  assert.equal(row.rail_trusted_wagons,9);
  assert.equal(row.rail_gu12_count,1);
  assert.equal(row.next_action_text,'Контроль движения 9 вагонов');
  assert.equal(row.next_action_target,'monitoring');
  assert.equal(row.current_action_required,false);
});

test('Finance V8 due-now wins over obsolete payment handoff state',()=>{
  const id='DEAL-FUTURE-BETA';
  const snapshot={
    deals:[baseDeal(id,{
      finance_status:'PARTIAL',
      due_now:470750,
      client_remaining_amount:470750,
      payment_handoff_state:'READY',
      payment_expectation_state:'NOT_CREATED'
    })],
    documents:docs(id),
    rail:[{deal_id:id,rail_state:'ROUTE_RESOLVED',route_resolution_state:'RESOLVED',gu12_count:0,trusted_wagon_count:0,unresolved_or_conflict_count:0}]
  };
  const [row]=deriveOperationsMissionCurrentRows([],snapshot);
  assert.equal(row.stage,'Оплата');
  assert.equal(row.next_action_text,'Контроль оплаты по наступившему сроку');
  assert.equal(row.next_action_target,'payments');
  assert.equal(row.current_action_required,true);
  assert.notEqual(row.next_action_text,'Передать сделку в оплату');
});

test('Finance V8 future conditional balance is monitoring, not a false current-payment action',()=>{
  const id='DEAL-FUTURE-GAMMA';
  const snapshot={
    deals:[baseDeal(id,{
      business_status:'REGISTERED',
      finance_status:'NOT_DUE',
      client_remaining_amount:527100,
      future_conditional:527100,
      due_now:0
    })],
    documents:docs(id),
    rail:[{deal_id:id,rail_state:'ROUTE_RESOLVED',route_resolution_state:'RESOLVED',gu12_count:0,trusted_wagon_count:0,unresolved_or_conflict_count:0}]
  };
  const [row]=deriveOperationsMissionCurrentRows([],snapshot);
  assert.equal(row.stage,'Оплата');
  assert.equal(row.next_action_text,'Следующий условный этап оплаты');
  assert.equal(row.next_action_target,'payments');
  assert.equal(row.current_action_required,false);
});

test('Current snapshot is authoritative and admits future deal identifiers without hardcode',()=>{
  const current='ANY-DEAL-ID-2031-X';
  const stale='LEGACY-STALE-ID';
  const snapshot={
    deals:[baseDeal(current)],
    documents:docs(current),
    rail:[{deal_id:current,rail_state:'NOT_STARTED',gu12_count:0,trusted_wagon_count:0,unresolved_or_conflict_count:0}]
  };
  const rows=deriveOperationsMissionCurrentRows([{deal_id:stale,business_status:'EXECUTING'}],snapshot);
  assert.deepEqual(rows.map(x=>x.deal_id),[current]);
});

test('Document review is surfaced without inventing payment or Rail facts',()=>{
  const id='DEAL-FUTURE-DELTA';
  const snapshot={
    deals:[baseDeal(id,{business_status:'REGISTERED',documentary_status:'TO_VERIFY',finance_status:'NOT_DUE',future_conditional:1000,client_remaining_amount:1000})],
    documents:[
      {deal_id:id,document_kind:'SIGNED_ADDENDUM',checked_by_admin:true},
      {deal_id:id,document_kind:'INVOICE',checked_by_admin:false}
    ],
    rail:[{deal_id:id,rail_state:'ROUTE_RESOLVED',route_resolution_state:'RESOLVED',gu12_count:0,trusted_wagon_count:0,unresolved_or_conflict_count:0}]
  };
  const [row]=deriveOperationsMissionCurrentRows([],snapshot);
  assert.equal(row.stage,'Документы');
  assert.equal(row.next_action_text,'Проверить документы: 1');
  assert.equal(row.next_action_domain,'DOCUMENTS');
  assert.equal(row.current_action_required,false);
});
