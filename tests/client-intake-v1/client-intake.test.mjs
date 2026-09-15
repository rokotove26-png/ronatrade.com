import assert from 'node:assert/strict';
import {
  ROUTING_STATES,
  DEFAULT_CLIENT_INTAKE_ROUTING_REGISTRY,
  createClientIntakeEngine,
  deriveActionableType,
  normalizeDomQuantity,
  selectRoutingPolicy,
} from '../../supabase/functions/_shared/client-intake-v1/index.mjs';

let count=0;
function test(name,fn){fn();count++;console.log(`ok ${count} - ${name}`)}
function reverse(overrides={}){
  return {
    source_kind:'PORTAL_REVERSE_EVENT', source_record_id:'PORTAL-EVT-FUTURE-A', source_event_type:'CLIENT_MESSAGE_SUBMIT',
    actor_role:'CLIENT', idempotency_key:'IDEMP-FUTURE-A', client_key:'client-a', contract_key:'contract-a', deal_key:null,
    payload:{source:'CLIENT_PRICE_CALCULATION_REQUEST',message_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',quantity_tonnes:1000},
    ...overrides,
  };
}
function application(overrides={}){
  return { source_kind:'CLIENT_APPLICATION', source_record_id:'APP-FUTURE-A', source_event_type:'CLIENT_APPLICATION_SUBMIT', idempotency_key:'APP-FUTURE-A', price_mode:'PUBLISHED_ACCEPT', quantity_tonnes:1000, payload:{price_mode:'PUBLISHED_ACCEPT',quantity_tonnes:1000}, ...overrides };
}

// Deterministic quantity behavior matching current Client browser code: Number(String(v).replace(',','.')).
test('DOM quantity 1000 stays exactly 1000',()=>assert.equal(normalizeDomQuantity('1000'),1000));
test('DOM quantity 175 stays exactly 175',()=>assert.equal(normalizeDomQuantity('175'),175));
test('decimal quantity dot stays decimal',()=>assert.equal(normalizeDomQuantity('12.5'),12.5));
test('decimal quantity comma normalizes to decimal dot value',()=>assert.equal(normalizeDomQuantity('12,5'),12.5));
test('space separated 1 000 is rejected rather than multiplied',()=>assert.equal(normalizeDomQuantity('1 000'),null));
test('NBSP separated 1 NBSP 000 is rejected rather than multiplied',()=>assert.equal(normalizeDomQuantity('1\u00a0000'),null));

test('delivered-price action derives from message_type',()=>assert.equal(deriveActionableType(reverse()),'DELIVERED_PRICE_CALCULATION_REQUEST_V1'));
test('published application derives dedicated actionable type',()=>assert.equal(deriveActionableType(application()),'PUBLISHED_PRICE_APPLICATION'));
test('client proposed application derives dedicated actionable type',()=>assert.equal(deriveActionableType(application({price_mode:'CLIENT_PROPOSED',payload:{price_mode:'CLIENT_PROPOSED',quantity_tonnes:1000}})),'CLIENT_PROPOSED_PRICE_APPLICATION'));
test('delivered-price policy routes to Operations Director',()=>assert.equal(selectRoutingPolicy(reverse())?.responsible_role,'OPERATIONS_DIRECTOR'));
test('claim policy routes to Legal',()=>assert.equal(selectRoutingPolicy(reverse({source_event_type:'CLIENT_CLAIM_SUBMIT',payload:{}}))?.responsible_role,'LEGAL'));
test('payment proof policy routes to Accounting',()=>assert.equal(selectRoutingPolicy(reverse({source_event_type:'CLIENT_PAYMENT_PROOF_SUBMIT',payload:{}}))?.responsible_role,'ACCOUNTING'));

test('one source creates exactly one canonical intake',()=>{const e=createClientIntakeEngine();const s=reverse();const a=e.ingest(s),b=e.ingest(s);assert.equal(a.intake_id,b.intake_id);assert.equal(e.snapshot().intakes.length,1)});
test('duplicate network retry with same source does not create duplicate',()=>{const e=createClientIntakeEngine();const s=reverse();e.ingest(s);e.ingest(structuredClone(s));assert.equal(e.snapshot().outbox.length,1)});
test('idempotency conflict fails closed',()=>{const e=createClientIntakeEngine();e.ingest(reverse());assert.throws(()=>e.ingest(reverse({source_record_id:'PORTAL-EVT-FUTURE-B',payload:{message_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',quantity_tonnes:999}})),/IDEMPOTENCY_CONFLICT/)});
test('double click with same source/idempotency is exactly once',()=>{const e=createClientIntakeEngine();const s=reverse();for(let i=0;i<5;i++)e.ingest(s);e.processAll();assert.equal(e.snapshot().tasks.length,1)});
test('one source produces one outbox routing stage',()=>{const e=createClientIntakeEngine();e.ingest(reverse());e.ingest(reverse());assert.equal(e.snapshot().outbox.length,1)});
test('task is exactly once for a stage',()=>{const e=createClientIntakeEngine();const i=e.ingest(reverse());e.processAll();e.processAll();e.reconcile([],{});assert.equal(e.snapshot().tasks.filter(t=>t.intake_id===i.intake_id).length,1)});

test('Client and Admin projections share durable ID',()=>{const e=createClientIntakeEngine();const i=e.ingest(reverse());assert.equal(e.projection(i.intake_id,'CLIENT').durable_id,e.projection(i.intake_id,'ADMIN').durable_id)});
test('refresh returns same durable ID',()=>{const e=createClientIntakeEngine();const i=e.ingest(reverse());const a=e.projection(i.intake_id,'CLIENT'),b=e.projection(i.intake_id,'CLIENT');assert.equal(a.durable_id,b.durable_id)});
test('logout/login semantic replay preserves durable ID',()=>{const e=createClientIntakeEngine();const s=reverse(),i=e.ingest(s);e.processAll();const before=e.projection(i.intake_id,'CLIENT').durable_id;e.ingest(s);assert.equal(e.projection(i.intake_id,'CLIENT').durable_id,before)});
test('successful known submission is never dual invisible',()=>{const e=createClientIntakeEngine();e.ingest(reverse());assert.equal(e.metrics().dual_invisible_actionable_intake_count,0)});

test('worker success reaches APPLIED',()=>{const e=createClientIntakeEngine();e.ingest(reverse());e.processAll();assert.equal(e.snapshot().outbox[0].state,'APPLIED')});
test('worker failure becomes retryable',()=>{const e=createClientIntakeEngine({maxAttempts:3});e.ingest(reverse());e.processAll({fail:true});assert.equal(e.snapshot().outbox[0].state,'FAILED_RETRYABLE')});
test('worker retry after transient failure reaches APPLIED',()=>{const e=createClientIntakeEngine({maxAttempts:3});e.ingest(reverse());e.processAll({fail:true});e.processAll();assert.equal(e.snapshot().outbox[0].state,'APPLIED')});
test('repeated worker failures dead-letter at threshold',()=>{const e=createClientIntakeEngine({maxAttempts:2});e.ingest(reverse());e.processAll({fail:true});e.processAll({fail:true});assert.equal(e.snapshot().outbox[0].state,'DEAD_LETTER')});
test('routing lifecycle vocabulary is complete',()=>assert.deepEqual(ROUTING_STATES,['PENDING','QUEUED','PROCESSING','APPLIED','FAILED_RETRYABLE','DEAD_LETTER']));

test('Owner correction overlays effective quantity',()=>{const e=createClientIntakeEngine();const i=e.ingest(reverse({payload:{message_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',quantity_tonnes:10000}}));e.appendCorrection({intake_id:i.intake_id,field_path:'payload.quantity_tonnes',source_value:10000,corrected_value:1000,correction_authority:'OWNER',correction_reason:'CLIENT_SUBMISSION_DATA_INTEGRITY_INCIDENT'});assert.equal(e.projection(i.intake_id,'ADMIN').effective_quantity_tonnes,1000)});
test('Owner correction never mutates raw source',()=>{const e=createClientIntakeEngine();const i=e.ingest(reverse({payload:{message_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',quantity_tonnes:10000}}));e.appendCorrection({intake_id:i.intake_id,field_path:'payload.quantity_tonnes',source_value:10000,corrected_value:1000,correction_authority:'OWNER',correction_reason:'CLIENT_SUBMISSION_DATA_INTEGRITY_INCIDENT'});assert.equal(e.snapshot().sources[0].payload.quantity_tonnes,10000)});
test('correction rejects incorrect source_value',()=>{const e=createClientIntakeEngine();const i=e.ingest(reverse());assert.throws(()=>e.appendCorrection({intake_id:i.intake_id,field_path:'payload.quantity_tonnes',source_value:999,corrected_value:1000,correction_authority:'OWNER'}),/SOURCE_VALUE_MISMATCH/)});
test('correction requires Owner authority',()=>{const e=createClientIntakeEngine();const i=e.ingest(reverse());assert.throws(()=>e.appendCorrection({intake_id:i.intake_id,field_path:'payload.quantity_tonnes',source_value:1000,corrected_value:999,correction_authority:'SYSTEM'}),/AUTHORITY_REQUIRED/)});

test('unknown actionable type fails closed but remains visible to both',()=>{const e=createClientIntakeEngine();const i=e.ingest(reverse({source_record_id:'PORTAL-EVT-UNKNOWN',idempotency_key:'UNKNOWN-1',source_event_type:'CLIENT_FUTURE_ACTIONABLE',payload:{}}));assert.equal(i.routing_state,'DEAD_LETTER');assert.equal(i.routing_reason,'ROUTING_POLICY_MISSING');assert.ok(e.projection(i.intake_id,'CLIENT'));assert.ok(e.projection(i.intake_id,'ADMIN'))});
test('unknown actionable has diagnosable outbox state',()=>{const e=createClientIntakeEngine();e.ingest(reverse({source_record_id:'PORTAL-EVT-UNKNOWN2',idempotency_key:'UNKNOWN-2',source_event_type:'CLIENT_FUTURE_ACTIONABLE',payload:{}}));assert.equal(e.snapshot().outbox[0].last_error_code,'ROUTING_POLICY_MISSING')});

test('reconciliation recovers missing canonical intake from source inventory',()=>{const e=createClientIntakeEngine();const s=reverse();e.rememberSource(s);assert.equal(e.snapshot().intakes.length,0);e.reconcile([s]);assert.equal(e.snapshot().intakes.length,1)});
test('reconciliation restores missing Client visibility',()=>{const e=createClientIntakeEngine();const i=e.ingest(reverse());e._unsafeTestMutateIntake(i.intake_id,{client_visible:false});e.reconcile([],{});assert.ok(e.projection(i.intake_id,'CLIENT'))});
test('reconciliation restores missing Admin visibility',()=>{const e=createClientIntakeEngine();const i=e.ingest(reverse());e._unsafeTestMutateIntake(i.intake_id,{admin_visible:false});e.reconcile([],{});assert.ok(e.projection(i.intake_id,'ADMIN'))});
test('reconciliation recovers missing required task exactly once',()=>{const e=createClientIntakeEngine();const i=e.ingest(reverse());e.processAll();e._unsafeTestDeleteTaskForIntake(i.intake_id);e.reconcile([],{});assert.equal(e.snapshot().tasks.filter(t=>t.intake_id===i.intake_id).length,1)});
test('reconciliation recovers stuck PROCESSING',()=>{let now=Date.parse('2032-01-01T00:00:00Z');const e=createClientIntakeEngine({clock:()=>now,stuckMs:1000});const i=e.ingest(reverse());e._unsafeTestMutateOutbox(i.intake_id,{state:'PROCESSING',processing_started_at:new Date(now-5000).toISOString()});e._unsafeTestMutateIntake(i.intake_id,{routing_state:'PROCESSING'});e.reconcile([],{});assert.equal(e.snapshot().outbox[0].state,'APPLIED')});
test('post-reconciliation metrics have no unrouted known intake',()=>{const e=createClientIntakeEngine();e.reconcile([reverse()]);assert.equal(e.metrics().unrouted_client_intake_count,0)});
test('post-reconciliation metrics have no invisible known intake',()=>{const e=createClientIntakeEngine();e.reconcile([reverse()]);const m=e.metrics();assert.equal(m.client_invisible_intake_count,0);assert.equal(m.admin_invisible_intake_count,0)});
test('post-reconciliation metrics have no stuck known intake',()=>{const e=createClientIntakeEngine();e.reconcile([reverse()]);assert.equal(e.metrics().stuck_intake_count,0)});

test('published-price application routes and creates one task',()=>{const e=createClientIntakeEngine();e.ingest(application());e.processAll();assert.equal(e.snapshot().tasks[0].assigned_functional_role,'OPERATIONS_DIRECTOR')});
test('client-proposed application routes and creates one task',()=>{const e=createClientIntakeEngine();e.ingest(application({source_record_id:'APP-PROPOSED',idempotency_key:'APP-PROPOSED',price_mode:'CLIENT_PROPOSED',payload:{price_mode:'CLIENT_PROPOSED',quantity_tonnes:25}}));e.processAll();assert.equal(e.snapshot().tasks.length,1)});
test('commercial terms request routes declaratively',()=>{const e=createClientIntakeEngine();const s=reverse({source_record_id:'PORTAL-EVT-TERMS',idempotency_key:'TERMS-1',payload:{message_type:'COMMERCIAL_TERMS_REQUEST_V1'}});const i=e.ingest(s);assert.equal(i.routing_policy_key,'COMMERCIAL_TERMS_REQUEST_V1')});
test('registry contains no event-id selector',()=>assert.ok(DEFAULT_CLIENT_INTAKE_ROUTING_REGISTRY.every(p=>!('source_record_id' in p)&&!('event_id' in p))));

// Recovery rehearsal: real source facts are input fixtures only; runtime contains no branches for these IDs.
{
  const engine=createClientIntakeEngine();
  const incident1=reverse({source_record_id:'PORTAL-EVT-2d8981c549484ec7a4b91dc22da78d96',idempotency_key:'PRICE-CALC-d1ead6b2-9bcc-4a53-aa4f-e35507d78291',payload:{source:'CLIENT_PRICE_CALCULATION_REQUEST',message_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',quantity_tonnes:10000}});
  const incident2=reverse({source_record_id:'PORTAL-EVT-d5cee7b90c1e4ce689f114b76814d208',idempotency_key:'PRICE-CALC-c462bf1b-320a-4910-81a1-1ae44ff8b3cc',payload:{source:'CLIENT_PRICE_CALCULATION_REQUEST',message_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',quantity_tonnes:175}});
  const i1=engine.ingest(incident1),i2=engine.ingest(incident2);
  engine.appendCorrection({intake_id:i1.intake_id,field_path:'payload.quantity_tonnes',source_value:10000,corrected_value:1000,correction_authority:'OWNER',correction_reason:'CLIENT_SUBMISSION_DATA_INTEGRITY_INCIDENT'});
  engine.reconcile([incident1,incident2]);
  const q1=engine.projection(i1.intake_id,'ADMIN').effective_quantity_tonnes;
  const q2=engine.projection(i2.intake_id,'ADMIN').effective_quantity_tonnes;
  const m=engine.metrics();
  assert.equal(q1,1000); assert.equal(q2,175);
  assert.equal(engine.snapshot().sources.find(s=>s.source_record_id===incident1.source_record_id).payload.quantity_tonnes,10000);
  assert.equal(engine.snapshot().tasks.length,2);
  assert.equal(m.unrouted_client_intake_count,0); assert.equal(m.dual_invisible_actionable_intake_count,0); assert.equal(m.stuck_intake_count,0);
  console.log(`INCIDENT_1_REHEARSAL_EFFECTIVE_QUANTITY=${q1}`);
  console.log(`INCIDENT_2_REHEARSAL_EFFECTIVE_QUANTITY=${q2}`);
  console.log(`UNROUTED_ACTIONABLE_INTAKES_REHEARSAL=${m.unrouted_client_intake_count}`);
  console.log(`DUAL_INVISIBLE_ACTIONABLE_INTAKES_REHEARSAL=${m.dual_invisible_actionable_intake_count}`);
  console.log(`STUCK_INTAKES_REHEARSAL=${m.stuck_intake_count}`);
  console.log('RAW_SOURCE_MUTATION=NONE');
}

console.log(`CLIENT_INTAKE_REGRESSION_COUNT=${count}`);
console.log('CLIENT_INTAKE_P1_STAGE2_REGRESSIONS=PASS');
