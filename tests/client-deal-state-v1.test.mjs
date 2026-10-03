import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectClientCanonicalDealState,CLIENT_DEAL_STATE_CONTRACT} from '../supabase/functions/rona-portal-api-candidate-20260817/client-deal-state-v1.mjs';

const context={client_id:'QA-CLIENT',contract_id:'QA-CONTRACT',legal_name:'QA Client',current_external_contract_number:'QA-EXT'};
const application={application_id:'QA-APP',deal_id:'DEAL-2099-101',product:'QA Product',quantity_tonnes:100,delivery_basis:'CPT',destination:'QA Station',proposed_price:10,proposed_currency:'USD'};
const resource={resource_status:'RESOURCE_CONFIRMED',resource_source:'QA_RESOURCE',resource_confirmed_at:'2099-01-01T00:00:00Z',signed_documents_confirmed:true,documents_source:'QA_DOCS'};

test('paid deal with real rail facts becomes logistics-current',()=>{
  const deal={
    deal_id:'DEAL-2099-101',business_status:'EXECUTING',confirmed_quantity_tonnes:100,
    passport_unit_price:10,passport_amount:1000,passport_currency:'USD',passport_application_id:'QA-APP',
    payment_authority_state:'AUTHORITATIVE',payment_obligation_amount:1000,payment_received_amount:1000,payment_remaining_amount:0,payment_currency:'USD',payment_percent:100,
    payment_finance_status:'PAID',payment_due_now:0,payment_expected_not_due:0,payment_future_conditional:0,payment_source:'FINANCE_V7_AUTHORITATIVE'
  };
  const railModel={modelVersion:'RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4',generatedAt:'2099-01-02T00:00:00Z',sourcePolicy:'QA_RAIL',deals:[{
    dealId:'DEAL-2099-101',
    railDocuments:[{documentId:'QA-RD-1'}],
    wagonPositions:[{wagonNumber:'123',station:'Current QA Station',eventTimestamp:'2099-01-02T12:00:00Z'}],
    actualRoute:{points:[{lat:1,lng:1},{lat:2,lng:2}]},
    remainingRoute:{points:[{lat:3,lng:3}]},
    routeAssignment:{resolutionState:'RESOLVED'}
  }]};
  const state=projectClientCanonicalDealState({context,deal,application,meta:resource,railModel,generatedAt:'2099-01-02T12:01:00Z'});
  assert.equal(state.source,CLIENT_DEAL_STATE_CONTRACT);
  assert.equal(state.realization_status.current_stage_key,'logistics');
  assert.equal(state.realization_status.stages.find(x=>x.key==='payment').state,'DONE');
  assert.equal(state.realization_status.stages.find(x=>x.key==='logistics').state,'CURRENT');
  assert.equal(state.facts.rail.started,true);
  assert.equal(state.facts.rail.wagon_count,1);
  assert.match(state.next_step,/Отгрузка выполняется/);
  assert.match(state.next_step,/Current QA Station/);
});

test('authoritative NOT_DUE finance with no rail movement stays payment-current',()=>{
  const deal={
    deal_id:'DEAL-2099-102',business_status:'REGISTERED',confirmed_quantity_tonnes:50,
    passport_unit_price:20,passport_amount:1000,passport_currency:'USD',
    payment_authority_state:'AUTHORITATIVE',payment_obligation_amount:1000,payment_received_amount:0,payment_remaining_amount:1000,payment_currency:'USD',payment_percent:0,
    payment_finance_status:'NOT_DUE',payment_due_now:0,payment_expected_not_due:0,payment_future_conditional:700,payment_source:'FINANCE_V7_AUTHORITATIVE'
  };
  const app={...application,application_id:'QA-APP-2',deal_id:'DEAL-2099-102',quantity_tonnes:50};
  const railModel={modelVersion:'RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4',generatedAt:'2099-01-02T00:00:00Z',sourcePolicy:'QA_RAIL',deals:[{
    dealId:'DEAL-2099-102',railDocuments:[],wagonPositions:[],actualRoute:{points:[]},remainingRoute:{points:[{lat:1,lng:1},{lat:2,lng:2}]},routeAssignment:{resolutionState:'RESOLVED'}
  }]};
  const state=projectClientCanonicalDealState({context,deal,application:app,meta:resource,railModel});
  assert.equal(state.facts.payment.status,'NOT_DUE');
  assert.equal(state.facts.payment.label,'Срок оплаты ещё не наступил');
  assert.equal(state.facts.rail.started,false);
  assert.equal(state.realization_status.current_stage_key,'payment');
  assert.equal(state.realization_status.stages.find(x=>x.key==='payment').state,'CURRENT');
  assert.equal(state.realization_status.stages.find(x=>x.key==='logistics').state,'PENDING');
  assert.equal(state.next_step,'Срок оплаты ещё не наступил');
});

test('early deal remains valid when Finance and Rail facts do not exist yet',()=>{
  const deal={
    deal_id:'DEAL-2099-103',business_status:'REGISTERED',confirmed_quantity_tonnes:25,
    passport_unit_price:30,passport_amount:750,passport_currency:'USD',
    payment_status:'TO_VERIFY',payment_authority_state:'TO_VERIFY',payment_received_amount:'TO_VERIFY',payment_obligation_amount:'TO_VERIFY'
  };
  const app={...application,application_id:'QA-APP-3',deal_id:'DEAL-2099-103',quantity_tonnes:25};
  const meta={...resource,signed_documents_confirmed:false};
  const railModel={modelVersion:'RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4',generatedAt:'2099-01-02T00:00:00Z',sourcePolicy:'QA_RAIL',deals:[{dealId:'DEAL-2099-103',railDocuments:[],wagonPositions:[],actualRoute:{points:[]},remainingRoute:{points:[]},routeAssignment:{resolutionState:'UNRESOLVED'}}]};
  const state=projectClientCanonicalDealState({context,deal,application:app,meta,railModel});
  assert.equal(state.facts.payment.status,'TO_VERIFY');
  assert.equal(state.facts.rail.available,true);
  assert.equal(state.facts.rail.operational_data_present,false);
  assert.equal(state.realization_status.current_stage_key,'documents');
  assert.equal(state.realization_status.stages.find(x=>x.key==='documents').state,'CURRENT');
  assert.equal(state.realization_status.stages.find(x=>x.key==='logistics').detail,'ЖД-данные появятся после начала отгрузки');
  assert.equal(state.next_step,'Ожидается подписание документов');
});


test('Rail source outage is not misreported as no shipment',()=>{
  const deal={
    deal_id:'DEAL-2099-104',business_status:'EXECUTING',confirmed_quantity_tonnes:25,
    passport_unit_price:30,passport_amount:750,passport_currency:'USD',
    payment_authority_state:'AUTHORITATIVE',payment_obligation_amount:750,payment_received_amount:750,payment_remaining_amount:0,payment_currency:'USD',payment_percent:100,
    payment_finance_status:'PAID',payment_due_now:0,payment_expected_not_due:0,payment_future_conditional:0
  };
  const app={...application,application_id:'QA-APP-4',deal_id:'DEAL-2099-104',quantity_tonnes:25};
  const state=projectClientCanonicalDealState({context,deal,application:app,meta:resource,railModel:null});
  assert.equal(state.facts.rail.available,false);
  assert.equal(state.realization_status.current_stage_key,'logistics');
  assert.equal(state.realization_status.stages.find(x=>x.key==='logistics').state,'CURRENT');
  assert.equal(state.next_step,'Актуальные ЖД-данные временно недоступны');
});


test('missing canonical deal price does not fall back to application proposal',()=>{
  const deal={
    deal_id:'DEAL-2099-105',business_status:'REGISTERED',confirmed_quantity_tonnes:25,
    passport_unit_price:null,passport_amount:null,passport_currency:null,
    passport_amount_source:'FINALIZED_COUNTEROFFER_NOT_ACCEPTED',
    payment_status:'TO_VERIFY',payment_authority_state:'TO_VERIFY'
  };
  const app={...application,application_id:'QA-APP-5',deal_id:'DEAL-2099-105',proposed_price:999,proposed_currency:'EUR'};
  const state=projectClientCanonicalDealState({context,deal,application:app,meta:resource,railModel:null});
  assert.equal(state.deal.unit_price,null);
  assert.equal(state.deal.amount,null);
  assert.equal(state.deal.currency,null);
  assert.equal(state.deal.economics_source,'FINALIZED_COUNTEROFFER_NOT_ACCEPTED');
});


test('authoritative Rail monitoring completion advances active deal to closing-current',()=>{
  const deal={
    deal_id:'DEAL-2099-106',business_status:'EXECUTING',accounting_closure_status:'OPEN',confirmed_quantity_tonnes:315,
    passport_unit_price:750,passport_amount:236250,passport_currency:'USD',
    payment_authority_state:'AUTHORITATIVE',payment_obligation_amount:236250,payment_received_amount:236250,payment_remaining_amount:0,payment_currency:'USD',payment_percent:100,
    payment_finance_status:'PAID',payment_due_now:0,payment_expected_not_due:0,payment_future_conditional:0
  };
  const app={...application,application_id:'QA-APP-6',deal_id:'DEAL-2099-106',quantity_tonnes:315,destination:'Киргили'};
  const meta={
    ...resource,
    rail_monitoring_state:'COMPLETED',
    rail_monitoring_completed_at:'2099-01-03T18:30:24Z',
    rail_monitoring_completion_wagon_count:9,
    rail_monitoring_completion_destination_esr_code:'742705',
    rail_monitoring_source_authority:'OWNER_INSTRUCTION:QA'
  };
  const railModel={modelVersion:'RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4',generatedAt:'2099-01-03T18:31:00Z',sourcePolicy:'QA_RAIL',deals:[{
    dealId:'DEAL-2099-106',
    railDocuments:[{documentId:'QA-GU12'}],
    wagonPositions:Array.from({length:9},(_,i)=>({wagonNumber:String(100+i),station:'Киргили',stationCode:'742705',eventTimestamp:'2099-01-03T17:21:50Z'})),
    actualRoute:{points:[{lat:1,lng:1},{lat:2,lng:2}]},
    remainingRoute:{points:[]},
    routeAssignment:{resolutionState:'RESOLVED'}
  }]};
  const state=projectClientCanonicalDealState({context,deal,application:app,meta,railModel,generatedAt:'2099-01-03T18:31:01Z'});
  assert.equal(state.facts.rail.completed,true);
  assert.equal(state.facts.rail.monitoring_state,'COMPLETED');
  assert.equal(state.facts.rail.completion_wagon_count,9);
  assert.equal(state.facts.rail.completion_destination_esr_code,'742705');
  assert.equal(state.realization_status.current_stage_key,'close');
  assert.equal(state.realization_status.stages.find(x=>x.key==='logistics').state,'DONE');
  assert.match(state.realization_status.stages.find(x=>x.key==='logistics').detail,/9 ваг/);
  assert.equal(state.realization_status.stages.find(x=>x.key==='close').state,'CURRENT');
  assert.equal(state.realization_status.completed_count,5);
  assert.equal(state.next_step,'Ожидаются закрывающие документы и завершение сделки');
});


test('candidate deal-state runtime passes authoritative Rail monitoring control into passport projector',()=>{
  const source=readFileSync(new URL('../supabase/functions/rona-portal-api-candidate-20260817/client-rail-isolated-runtime-v1.ts',import.meta.url),'utf8');
  assert.match(source,/MONITORING_PARITY_V3/);
  assert.match(source,/rail_deal_monitoring_control_v1/);
  assert.match(source,/rail_monitoring_state:meta\.rail_monitoring_state/);
  assert.match(source,/rail_monitoring_completion_wagon_count:meta\.rail_monitoring_completion_wagon_count/);
  assert.match(source,/rail_monitoring_completion_destination_esr_code:meta\.rail_monitoring_completion_destination_esr_code/);
  assert.match(source,/rona_rail_deal_map_read_model_core_v2/);
  assert.match(source,/PRODUCTION_CONTEXT_FINANCE_V8_RESOURCE_RAIL_V4_MONITORING_CONTROL_V1/);
});
