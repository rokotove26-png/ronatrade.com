import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminPaymentsV7FromRawSources, createAdminPaymentsV7SourceBundle } from '../../supabase/functions/_shared/admin-payments-v7/index.mjs';
import { reconcileAllPayments } from '../../supabase/functions/_shared/admin-payments-v7/reconciliation.mjs';

const SOURCE_AS_OF = '2026-09-13T15:00:38.553024Z';
const OWNER_SOURCE_REF = 'OWNER_CONFIRMATION_2026-09-13_PAYEV_000008_000009_HIGH_LEVEL_ALLOCATION';
const D004 = '17503586-9909-58cc-99f6-92b2ba4d8797';
const D005 = '51352e24-23f2-56c0-b56b-4290a11a4267';
const D006 = '68a82fae-ac16-5c3b-9a3a-4cd008e10b68';
const D009 = '6a2af55b-a945-43c0-8078-7385970c8dc3';
const P001 = '8a757f03-3ad4-5656-984a-c942d91b07db';
const P002 = '06e2e846-45df-4f66-ab5a-7a8b04cb409a';
const P003 = '21e4d715-1c65-4e65-9e6b-496ad098c151';
const P008 = '9fda9905-e782-42f3-8441-71ca866bee0d';
const P009 = '7c6dba20-eb9f-47fe-a077-ec3bbf17bf29';

function deal(id, deal_id, client_key, contract_key, payment_handoff_state) {
  return { id, deal_id, client_key, contract_key, business_status: 'EXECUTING', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE', source_system: 'PRODUCTION_SNAPSHOT', source_version: '2026-09-13' , payment_handoff_state };
}
const DEAL_ROWS = [
  deal(D004, 'DEAL-2026-004', 'c004', 'ct004', 'READY'),
  deal(D005, 'DEAL-2026-005', 'c005', 'ct005', 'READY'),
  deal(D006, 'DEAL-2026-006', 'c005', 'ct005', 'READY'),
  deal(D009, 'DEAL-2026-009', 'c009', 'ct009', 'SENT'),
];
const WORKFLOWS = DEAL_ROWS.map((d) => ({ deal_key: d.id, payment_handoff_state: d.payment_handoff_state, cancellation_state: 'ACTIVE' }));
const CLIENTS = [
  { id: 'c004', client_id: 'RONA-C002', legal_name: 'FARGONA', lifecycle_state: 'ACTIVE', authority_state: 'CONFIRMED' },
  { id: 'c005', client_id: 'RONA-C003', legal_name: 'UNVERSAL SOLYARIS GRAND', lifecycle_state: 'ACTIVE', authority_state: 'CONFIRMED' },
  { id: 'c009', client_id: 'RONA-C005', legal_name: 'ГазОнэ', lifecycle_state: 'ACTIVE', authority_state: 'CONFIRMED' },
];
const CONTRACTS = [
  { id: 'ct004', contract_id: 'RONA-C002-CTR-2026-001', lifecycle_state: 'ACTIVE', authority_state: 'CONFIRMED' },
  { id: 'ct005', contract_id: 'RONA-C003-CTR-2026-001', lifecycle_state: 'ACTIVE', authority_state: 'CONFIRMED' },
  { id: 'ct009', contract_id: 'RONA-C005-CTR-2026-001', lifecycle_state: 'ACTIVE', authority_state: 'CONFIRMED' },
];

function payment(id, payment_id, payment_at, amount, currency, payment_direction, payment_kind, candidate_deal_ids = [], allocation_review_status = 'VERIFIED', bank_transaction_reference = null) {
  return {
    id, payment_id, payment_at, amount, currency, payment_direction, payment_kind,
    bank_fact_status: 'BANK_CONFIRMED', finance_status: 'PAID', finance_verification_status: 'VERIFIED',
    deal_allocation_applicability: payment_kind === 'FX_CONVERSION' ? 'NOT_APPLICABLE' : 'DEAL_ALLOCATABLE',
    allocation_review_status: payment_kind === 'FX_CONVERSION' ? 'NOT_APPLICABLE' : allocation_review_status,
    candidate_deal_ids, bank_transaction_reference, source_system: 'PRODUCTION_RAW_SNAPSHOT', source_version: '2026-09-13',
    source_timestamp: SOURCE_AS_OF, authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE',
  };
}
const PAYMENTS = [
  payment(P001, 'PAYEV-2026-000001', '2026-08-10T00:00:00Z', '236250.0000', 'USD', 'INCOMING', 'CLIENT_PAYMENT', ['DEAL-2026-004']),
  payment('8b8386b7-cb8e-4b50-8fcf-f3f21ab01a7f', 'OUT-2026-004-BNK', '2026-08-11T21:00:00Z', '8484210.0000', 'RUB', 'OUTGOING', 'COUNTERPARTY_PAYMENT', ['DEAL-2026-004']),
  payment('3351087d-6c4c-4f5e-938b-b4e9eeacd500', 'OUT-2026-004-BNK-FEE', '2026-08-11T21:00:00Z', '3000.0000', 'RUB', 'OUTGOING', 'BANK_FEE', ['DEAL-2026-004']),
  payment('2958b70e-1f01-4321-b529-708f468920fa', 'OUT-2026-004-ORIENT', '2026-08-12T21:00:00Z', '25444800.0000', 'KZT', 'OUTGOING', 'COUNTERPARTY_PAYMENT', ['DEAL-2026-004']),
  payment('a83feb91-ddf8-44bb-9b26-fbb15702ad33', 'OUT-2026-004-ORIENT-FEE', '2026-08-12T21:00:00Z', '20000.0000', 'KZT', 'OUTGOING', 'BANK_FEE', ['DEAL-2026-004']),
  payment(P002, 'PAYEV-2026-000002', '2026-08-14T00:00:00Z', '201750.0000', 'USD', 'INCOMING', 'CLIENT_PAYMENT', ['DEAL-2026-005']),
  payment(P003, 'PAYEV-2026-000003', '2026-08-14T00:00:00Z', '49320.0000', 'USD', 'INCOMING', 'CLIENT_PAYMENT', ['DEAL-2026-006']),
  payment('9547ddd9-d69e-4c7f-8b8c-b8c43c03c131', 'OUT-2026-004-SGTRANS', '2026-08-16T21:00:00Z', '5899358.9000', 'RUB', 'OUTGOING', 'COUNTERPARTY_PAYMENT', ['DEAL-2026-004']),
  payment('9586fde2-eb17-475e-9cbd-7c27ff98d267', 'OUT-2026-004-SGTRANS-FEE', '2026-08-16T21:00:00Z', '3000.0000', 'RUB', 'OUTGOING', 'BANK_FEE', ['DEAL-2026-004']),
  payment('9af600dd-25f4-4a00-8f71-58f0fe1fc156', 'OUT-2026-005006-KUZMASH', '2026-08-16T21:00:00Z', '16536960.0000', 'RUB', 'OUTGOING', 'COUNTERPARTY_PAYMENT', ['DEAL-2026-005','DEAL-2026-006'], 'TO_VERIFY', 'BAKAI doc 5631125'),
  payment('a9324b07-2b10-41b9-a962-7fd7907adf02', 'OUT-2026-005006-KUZMASH-FEE', '2026-08-16T21:00:00Z', '3000.0000', 'RUB', 'OUTGOING', 'BANK_FEE', ['DEAL-2026-005','DEAL-2026-006'], 'TO_VERIFY', 'BAKAI doc 5631127'),
  payment('eefe5f9b-20da-48bd-9166-fb0895c62144', 'PAYEV-2026-000004', '2026-09-07T05:20:11Z', '11800.0000', 'USD', 'OUTGOING', 'FX_CONVERSION'),
  payment('f5852cbb-af47-4ac6-8e64-5cee6ceffcac', 'PAYEV-2026-000005', '2026-09-07T05:20:11Z', '1003000.0000', 'RUB', 'INCOMING', 'FX_CONVERSION'),
  payment('f4f8ea2a-0568-4ad7-b479-e4d1b4813c16', 'PAYEV-2026-000006', '2026-09-10T09:51:27Z', '30000.0000', 'USD', 'OUTGOING', 'FX_CONVERSION'),
  payment('6d7068c1-11ae-4590-b77e-43cbd5191d75', 'PAYEV-2026-000007', '2026-09-10T09:51:27Z', '2505000.0000', 'RUB', 'INCOMING', 'FX_CONVERSION'),
  payment(P008, 'PAYEV-2026-000008', '2026-09-10T11:00:14Z', '3644000.0000', 'RUB', 'OUTGOING', 'COUNTERPARTY_PAYMENT', [], 'TO_VERIFY', 'BAKAI doc 2539516'),
  payment(P009, 'PAYEV-2026-000009', '2026-09-10T11:00:14Z', '3000.0000', 'RUB', 'OUTGOING', 'BANK_FEE', [], 'TO_VERIFY', 'BAKAI doc 2539518'),
];

function alloc(id, payment_key, deal_key, allocated_amount, authority_state = 'CONFIRMED', lifecycle_state = 'ACTIVE') {
  return { id, payment_key, deal_key, allocated_amount, allocation_status: 'VERIFIED', finance_status: 'PAID', source_system: 'PRODUCTION_RAW_SNAPSHOT', source_version: '2026-09-13', source_timestamp: SOURCE_AS_OF, authority_state, lifecycle_state };
}
const ALLOCATIONS = [
  alloc('6fb5974e-887a-50de-a183-bde7facff1b9', P001, D004, '236250.0000', 'SUPERSEDED', 'SUPERSEDED'),
  alloc('064c1d24-3214-4aa9-8eb1-fb7143002731', P003, D006, '49320.0000'),
  alloc('a6e93af0-4eeb-4cfb-afd6-58f112b2291d', P002, D005, '201750.0000'),
  alloc('187210fd-e02d-477e-9392-c2c2edc5c699', '9586fde2-eb17-475e-9cbd-7c27ff98d267', D004, '3000.0000'),
  alloc('1fcb5cd4-6b08-49bd-9335-c89d4790347b', '9547ddd9-d69e-4c7f-8b8c-b8c43c03c131', D004, '5899358.9000'),
  alloc('2db23ed0-f145-4279-9df3-7991e0dfe163', '2958b70e-1f01-4321-b529-708f468920fa', D004, '25444800.0000'),
  alloc('649c528d-7de3-48ee-a108-18d2fb4fbe4b', 'a83feb91-ddf8-44bb-9b26-fbb15702ad33', D004, '20000.0000'),
  alloc('8db362f5-58b3-4b67-92f1-248c7af92ad5', '3351087d-6c4c-4f5e-938b-b4e9eeacd500', D004, '3000.0000'),
  alloc('dbaa113a-6044-4307-9477-e3ec9bcd0a0a', '8b8386b7-cb8e-4b50-8fcf-f3f21ab01a7f', D004, '8484210.0000'),
  alloc('13a639bc-9ae6-4097-8e59-e98333869d1e', P001, D004, '236250.0000'),
];
const ALLOCATION_HISTORY = [{ payment_key: P001, old_allocation_id: '6fb5974e-887a-50de-a183-bde7facff1b9', new_allocation_id: '13a639bc-9ae6-4097-8e59-e98333869d1e' }];

function outgoingFact(id, fact_id, amount, currency, deal_ids, status, flow_kind) {
  return { id, fact_id, payment_id: fact_id, payment_at: '2026-08-16T21:00:00Z', amount, currency, deal_ids, deal_allocation_status: status, flow_kind, bank_fact_status: 'BANK_CONFIRMED', source_document: 'RONA_ACCOUNTING_CANONICAL_v011_20260818_0016.xlsx', source_version: 'v011', source_timestamp: '2026-08-17T21:16:00Z', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' };
}
const OUTGOING_FACTS = [
  outgoingFact('cb5bcdb0-f281-4b44-ac0e-db864672642b','OUT-2026-004-BNK','8484210','RUB',['DEAL-2026-004'],'CONFIRMED','COUNTERPARTY_PAYMENT'),
  outgoingFact('0a4319e2-f080-47d9-8752-27b11b93b94a','OUT-2026-004-BNK-FEE','3000','RUB',['DEAL-2026-004'],'CONFIRMED','BANK_FEE'),
  outgoingFact('fb9e58b0-30b8-4ec6-b973-f31dd4a5abcf','OUT-2026-004-ORIENT','25444800','KZT',['DEAL-2026-004'],'CONFIRMED','COUNTERPARTY_PAYMENT'),
  outgoingFact('4132f509-3b88-4ec1-becc-a2f6285f09da','OUT-2026-004-ORIENT-FEE','20000','KZT',['DEAL-2026-004'],'CONFIRMED','BANK_FEE'),
  outgoingFact('f9b53e8d-f3f6-4bf3-8998-002b5ce662a8','OUT-2026-004-SGTRANS','5899358.9','RUB',['DEAL-2026-004'],'CONFIRMED','COUNTERPARTY_PAYMENT'),
  outgoingFact('78b8dd64-167f-4237-b4b2-08c2fab745e2','OUT-2026-004-SGTRANS-FEE','3000','RUB',['DEAL-2026-004'],'CONFIRMED','BANK_FEE'),
  outgoingFact('49a97ddd-25dd-4808-a5a0-b64931bc5ec4','OUT-2026-005006-KUZMASH','16536960','RUB',['DEAL-2026-005','DEAL-2026-006'],'TO_VERIFY','COUNTERPARTY_PAYMENT'),
  outgoingFact('b9dea250-0a38-43f0-b3e0-9e4cfce49464','OUT-2026-005006-KUZMASH-FEE','3000','RUB',['DEAL-2026-005','DEAL-2026-006'],'TO_VERIFY','BANK_FEE'),
];

function raw(paymentBusinessAuthority = false) {
  return {
    generatedAt: SOURCE_AS_OF, sourceAsOf: SOURCE_AS_OF,
    capabilities: { paymentBusinessAuthority, financeAuthority: false, resourceChain: false },
    deals: DEAL_ROWS, workflows: WORKFLOWS, clients: CLIENTS, contracts: CONTRACTS,
    payments: PAYMENTS, paymentAllocations: ALLOCATIONS, paymentAllocationHistory: ALLOCATION_HISTORY,
    ownerOutgoingPaymentFacts: OUTGOING_FACTS,
    paymentBusinessAttributions: [], paymentBusinessAttributionLines: [], dealFinanceAuthorities: [], resourceChains: [],
  };
}

function ownerHighLevelRows() {
  return [
    {
      id: '11111111-aaaa-4111-8111-111111111111', payment_key: P008,
      classification: 'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED', attribution_mode: 'SCOPE_ONLY', decision_type: null,
      authority_kind: 'OWNER_CANON', authority_source_ref: OWNER_SOURCE_REF,
      business_scope_refs: ['OWNER_ASSERTION:PAYEV-2026-000008:BUSINESS_ALLOCATION_KNOWN'], scope_deal_keys: [], principal_payment_key: null,
      materialization_status: 'NOT_MATERIALIZED', authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', effective_at: SOURCE_AS_OF,
      supersedes_id: null, supersedes_authority_refs: [], source_version: 'STAGE3D_OWNER_CANON_V1', source_timestamp: SOURCE_AS_OF,
      source_refs: [OWNER_SOURCE_REF,'PAYEV-2026-000008','BAKAI doc 2539516'], source_locked: true, actor_id: null, actor_role: 'OWNER', idempotency_key: 'stage3d-owner-highlevel-payev-000008-v1',
    },
    {
      id: '22222222-bbbb-4222-8222-222222222222', payment_key: P009,
      classification: 'ASSOCIATED_BANK_FEE', attribution_mode: 'SCOPE_ONLY', decision_type: null,
      authority_kind: 'OWNER_CANON', authority_source_ref: OWNER_SOURCE_REF,
      business_scope_refs: ['OWNER_ASSERTION:PAYEV-2026-000009:ASSOCIATED_WITH:PAYEV-2026-000008'], scope_deal_keys: [], principal_payment_key: P008,
      materialization_status: 'NOT_MATERIALIZED', authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', effective_at: SOURCE_AS_OF,
      supersedes_id: null, supersedes_authority_refs: [], source_version: 'STAGE3D_OWNER_CANON_V1', source_timestamp: SOURCE_AS_OF,
      source_refs: [OWNER_SOURCE_REF,'PAYEV-2026-000009','PAYEV-2026-000008','BAKAI doc 2539518'], source_locked: true, actor_id: null, actor_role: 'OWNER', idempotency_key: 'stage3d-owner-highlevel-payev-000009-v1',
    },
  ];
}

function financeRows() {
  return [
    { id:'f0000004-0000-4000-8000-000000000004', deal_key:D004, total_to_receive:'236250', due_now:'0', expected_not_due:'0', future_conditional:'0', obligation_currency:'USD', contractual_payment_currency:'USD', mixed_inbound_accounting_currency:null, finance_status:'PAID', documentary_status:'TO_VERIFY', authority_state:'AUTHORITATIVE', lifecycle_state:'CURRENT', effective_at:SOURCE_AS_OF, supersedes_id:null, supersedes_authority_refs:[], source_version:'STAGE3C_FINANCE_CANON', source_timestamp:SOURCE_AS_OF, source_refs:['FINANCE_V23:eabba23f-70b9-4d40-86ef-3d0578c71d4a','FINANCE_V22:7737fdb2-ec00-47e1-b3e9-a45823ab6fd5'], source_locked:true },
    { id:'f0000005-0000-4000-8000-000000000005', deal_key:D005, total_to_receive:'672500', due_now:'0', expected_not_due:'470750', future_conditional:'0', obligation_currency:'USD', contractual_payment_currency:'USD', mixed_inbound_accounting_currency:null, finance_status:'NOT_DUE', documentary_status:'TO_VERIFY', authority_state:'AUTHORITATIVE', lifecycle_state:'CURRENT', effective_at:SOURCE_AS_OF, supersedes_id:null, supersedes_authority_refs:[], source_version:'STAGE3C_FINANCE_CANON', source_timestamp:SOURCE_AS_OF, source_refs:['FINANCE_SCHEDULE:6d1cac49-e5b6-49f6-8282-9bc37f6e8e97'], source_locked:true },
    { id:'f0000006-0000-4000-8000-000000000006', deal_key:D006, total_to_receive:'164400', due_now:'0', expected_not_due:'115080', future_conditional:'0', obligation_currency:'USD', contractual_payment_currency:'USD', mixed_inbound_accounting_currency:null, finance_status:'NOT_DUE', documentary_status:'TO_VERIFY', authority_state:'AUTHORITATIVE', lifecycle_state:'CURRENT', effective_at:SOURCE_AS_OF, supersedes_id:null, supersedes_authority_refs:[], source_version:'STAGE3C_FINANCE_CANON', source_timestamp:SOURCE_AS_OF, source_refs:['FINANCE_SCHEDULE:e72308be-3b07-4033-812a-329db4682404'], source_locked:true },
    { id:'f0000009-0000-4000-8000-000000000009', deal_key:D009, total_to_receive:'31002300', due_now:'0', expected_not_due:'9300690', future_conditional:'21701610', obligation_currency:'RUB', contractual_payment_currency:'RUB', mixed_inbound_accounting_currency:null, finance_status:'NOT_DUE', documentary_status:'TO_VERIFY', authority_state:'AUTHORITATIVE', lifecycle_state:'CURRENT', effective_at:SOURCE_AS_OF, supersedes_id:null, supersedes_authority_refs:[], source_version:'STAGE3C_FINANCE_CANON', source_timestamp:SOURCE_AS_OF, source_refs:['OWNER_CONFIRMATION_2026-09-13_GAZONE_RUB_ACCOUNTING','FINANCE_V23:eabba23f-70b9-4d40-86ef-3d0578c71d4a','FINANCE_PROPOSAL:49205d6f-4b63-473e-b596-5813ddeb966a'], source_locked:true },
  ];
}

function reconciliationsFor(rawInput) {
  const source = createAdminPaymentsV7SourceBundle(rawInput);
  return reconcileAllPayments(source.payments, source.attributionClaims, source.physicalAllocations, source.capabilities, source.validDealKeys);
}

test('AP — PROVIDER CAPABILITY FLIP DOES NOT CREATE FALSE OWNER QUEUE', () => {
  const a = raw(false);
  const b = raw(true);
  const recA = reconciliationsFor(a);
  const recB = reconciliationsFor(b);
  assert.equal(recA.length, 17);
  assert.equal(recB.length, 17);
  assert.deepEqual(recB.map((r) => [r.payment_id,r.reconciliation_class,r.owner_action_required]), recA.map((r) => [r.payment_id,r.reconciliation_class,r.owner_action_required]));
  for (const id of ['PAYEV-2026-000008','PAYEV-2026-000009']) {
    const ra = recA.find((r) => r.payment_id === id);
    const rb = recB.find((r) => r.payment_id === id);
    assert.equal(ra.reconciliation_class, 'AUTHORITY_MATERIALIZATION_REQUIRED');
    assert.equal(rb.reconciliation_class, 'AUTHORITY_MATERIALIZATION_REQUIRED');
    assert.equal(rb.owner_action_required, false);
  }
  assert.equal(buildAdminPaymentsV7FromRawSources(a).owner_exception_queue.length, 0);
  assert.equal(buildAdminPaymentsV7FromRawSources(b).owner_exception_queue.length, 0);
});

test('AQ — OWNER ASSERTED ALLOCATED UNKNOWN DEAL IS REPRESENTABLE', () => {
  const input = raw(true);
  input.paymentBusinessAttributions = [ownerHighLevelRows()[0]];
  const source = createAdminPaymentsV7SourceBundle(input);
  const claim = source.attributionClaims.find((c) => c.payment_key === P008 && c.authority_kind === 'OWNER_CANON');
  assert.equal(claim.attribution_mode, 'SCOPE_ONLY');
  assert.deepEqual(claim.scope_deal_keys, []);
  assert.deepEqual(claim.lines, []);
  assert.deepEqual(claim.business_scope_refs, ['OWNER_ASSERTION:PAYEV-2026-000008:BUSINESS_ALLOCATION_KNOWN']);
  const rec = reconcileAllPayments(source.payments, source.attributionClaims, source.physicalAllocations, source.capabilities, source.validDealKeys).find((r) => r.payment_id === 'PAYEV-2026-000008');
  assert.equal(rec.reconciliation_class, 'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED');
  assert.equal(rec.status, 'TO_VERIFY');
  assert.equal(rec.owner_action_required, false);
  assert.deepEqual(rec.current_lines, []);
  assert.deepEqual(rec.scope_deal_keys, []);
  assert.equal(buildAdminPaymentsV7FromRawSources(input).owner_exception_queue.length, 0);
});

test('AR — ASSOCIATED FEE UNKNOWN DEAL REMAINS NON-QUEUE', () => {
  const input = raw(true);
  input.paymentBusinessAttributions = ownerHighLevelRows();
  const source = createAdminPaymentsV7SourceBundle(input);
  const rec = reconcileAllPayments(source.payments, source.attributionClaims, source.physicalAllocations, source.capabilities, source.validDealKeys).find((r) => r.payment_id === 'PAYEV-2026-000009');
  assert.equal(rec.reconciliation_class, 'ASSOCIATED_BANK_FEE');
  assert.equal(rec.principal_payment_key, P008);
  assert.equal(rec.fee_attribution_state, 'TO_VERIFY');
  assert.equal(rec.status, 'TO_VERIFY');
  assert.equal(rec.owner_action_required, false);
  assert.deepEqual(rec.current_lines, []);
  assert.deepEqual(rec.scope_deal_keys, []);
  assert.equal(buildAdminPaymentsV7FromRawSources(input).owner_exception_queue.length, 0);
});

test('AS — POST-MATERIALIZATION CURRENT SNAPSHOT', () => {
  const input = raw(true);
  input.capabilities.financeAuthority = true;
  input.paymentBusinessAttributions = ownerHighLevelRows();
  input.dealFinanceAuthorities = financeRows();
  const projection = buildAdminPaymentsV7FromRawSources(input);
  assert.equal(projection.owner_exception_queue.length, 0);
  assert.equal(projection.reconciliation_summary.authority_conflict_count, 0);

  const expected = new Map([
    ['DEAL-2026-004',['236250','236250','0','0','100']],
    ['DEAL-2026-005',['672500','201750','470750','0','30']],
    ['DEAL-2026-006',['164400','49320','115080','0','30']],
    ['DEAL-2026-009',['31002300','0','9300690','21701610','0']],
  ]);
  for (const deal of projection.deals) {
    const e = expected.get(deal.deal_id);
    assert.ok(e, `unexpected deal ${deal.deal_id}`);
    assert.equal(deal.total_to_receive.amount, e[0]);
    assert.equal(deal.verified_received.amount, e[1]);
    assert.equal(deal.expected_not_due.amount, e[2]);
    assert.equal(deal.future_conditional.amount, e[3]);
    assert.equal(deal.payment_progress.percent, e[4]);
    assert.equal(deal.actual_spend.status, 'TO_VERIFY');
  }

  const p008 = projection.payment_exceptions.find((e) => e.payment_ids.includes('PAYEV-2026-000008'));
  const p009 = projection.payment_exceptions.find((e) => e.payment_ids.includes('PAYEV-2026-000009'));
  const shared = projection.payment_exceptions.find((e) => e.payment_ids.includes('OUT-2026-005006-KUZMASH'));
  assert.equal(p008.reconciliation_class, 'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED');
  assert.equal(p008.owner_action_required, false);
  assert.equal(p009.reconciliation_class, 'ASSOCIATED_BANK_FEE');
  assert.equal(p009.fee_attribution_state, 'TO_VERIFY');
  assert.equal(p009.owner_action_required, false);
  assert.equal(shared.reconciliation_class, 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY');
  assert.equal(shared.reason, 'EXACT_SPLIT_TO_VERIFY');
});
