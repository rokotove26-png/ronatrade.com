import assert from 'node:assert/strict';
import {
  ROUTING_STATES,PRICE_MODES,DEFAULT_CLIENT_INTAKE_ROUTING_REGISTRY,
  createClientIntakeEngine,deriveActionableType,normalizeDomQuantity,selectRoutingPolicy,
} from '../../supabase/functions/_shared/client-intake-v1/index.mjs';

let count=0;const test=(name,fn)=>{fn();count++;console.log(`ok ${count} - ${name}`)};
const reverse=(overrides={})=>({source_kind:'PORTAL_REVERSE_EVENT',source_record_id:'PORTAL-EVT-FUTURE-A',source_event_type:'CLIENT_MESSAGE_SUBMIT',actor_role:'CLIENT',idempotency_key:'IDEMP-FUTURE-A',client_key:'client-a',contract_key:'contract-a',deal_key:null,payload:{source:'CLIENT_PRICE_CALCULATION_REQUEST',message_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',quantity_tonnes:1000},...overrides});
const application=(overrides={})=>({source_kind:'CLIENT_APPLICATION',source_record_id:'APP-FUTURE-A',source_event_type:'CLIENT_APPLICATION_SUBMIT',idempotency_key:'APP-FUTURE-A',price_mode:'ACCEPT_PUBLISHED_PRICE',quantity_tonnes:1000,payload:{price_mode:'ACCEPT_PUBLISHED_PRICE',quantity_tonnes:1000},...overrides});

test('production price enum set is exact',()=>assert.deepEqual(PRICE_MODES,['ACCEPT_PUBLISHED_PRICE','CLIENT_PROPOSED_PRICE']));
test('ACCEPT_PUBLISHED_PRICE maps to published application',()=>assert.equal(deriveActionableType(application()),'PUBLISHED_PRICE_APPLICATION'));
test('CLIENT_PROPOSED_PRICE maps to proposed application',()=>assert.equal(deriveActionableType(application({price_mode:'CLIENT_PROPOSED_PRICE',payload:{price_mode:'CLIENT_PROPOSED_PRICE',quantity_tonnes:1000}})),'CLIENT_PROPOSED_PRICE_APPLICATION'));
test('legacy CLIENT_PROPOSED fails closed',()=>assert.equal(deriveActionableType(application({price_mode:'CLIENT_PROPOSED',payload:{price_mode:'CLIENT_PROPOSED'}})),'UNSUPPORTED_PRICE_MODE'));
test('unknown application price mode has no routing policy',()=>assert.equal(selectRoutingPolicy(application({price_mode:'UNKNOWN',payload:{price_mode:'UNKNOWN'}})),null));

test('DOM quantity 1000 stays 1000',()=>assert.equal(normalizeDomQuantity('1000'),1000));
test('DOM quantity 175 stays 175',()=>assert.equal(normalizeDomQuantity('175'),175));
test('space-separated number is rejected',()=>assert.equal(normalizeDomQuantity('1 000'),null));
test('delivered-price message type derives correctly',()=>assert.equal(deriveActionableType(reverse()),'DELIVERED_PRICE_CALCULATION_REQUEST_V1'));
test('delivered-price routes to Operations Director',()=>assert.equal(selectRoutingPolicy(reverse())?.responsible_role,'OPERATIONS_DIRECTOR'));
test('claim routes to Legal',()=>assert.equal(selectRoutingPolicy(reverse({source_event_type:'CLIENT_CLAIM_SUBMIT',payload:{}}))?.responsible_role,'LEGAL'));
test('payment proof routes to Accounting',()=>assert.equal(selectRoutingPolicy(reverse({source_event_type:'CLIENT_PAYMENT_PROOF_SUBMIT',payload:{}}))?.responsible_role,'ACCOUNTING'));

test('same source is idempotent',()=>{const e=createClientIntakeEngine(),s=reverse(),a=e.ingest(s),b=e.ingest(s);assert.equal(a.intake_id,b.intake_id);assert.equal(e.snapshot().intakes.length,1)});
test('same source produces one outbox',()=>{const e=createClientIntakeEngine(),s=reverse();e.ingest(s);e.ingest(s);assert.equal(e.snapshot().outbox.length,1)});
test('idempotency conflict fails closed',()=>{const e=createClientIntakeEngine();e.ingest(reverse());assert.throws(()=>e.ingest(reverse({source_record_id:'PORTAL-EVT-FUTURE-B',payload:{message_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',quantity_tonnes:999}})),/IDEMPOTENCY_CONFLICT/)});
test('worker creates exactly one task',()=>{const e=createClientIntakeEngine(),i=e.ingest(reverse());e.processAll();e.processAll();e.reconcile();assert.equal(e.snapshot().tasks.filter(t=>t.intake_id===i.intake_id).length,1)});
test('worker success reaches APPLIED',()=>{const e=createClientIntakeEngine();e.ingest(reverse());e.processAll();assert.equal(e.snapshot().outbox[0].state,'APPLIED')});
test('worker failure is retryable',()=>{const e=createClientIntakeEngine({maxAttempts:3});e.ingest(reverse());e.processAll({fail:true});assert.equal(e.snapshot().outbox[0].state,'FAILED_RETRYABLE')});
test('worker retry reaches APPLIED',()=>{const e=createClientIntakeEngine({maxAttempts:3});e.ingest(reverse());e.processAll({fail:true});e.processAll();assert.equal(e.snapshot().outbox[0].state,'APPLIED')});
test('routing lifecycle complete',()=>assert.deepEqual(ROUTING_STATES,['PENDING','QUEUED','PROCESSING','APPLIED','FAILED_RETRYABLE','DEAD_LETTER']));

test('Client and Admin share durable ID',()=>{const e=createClientIntakeEngine(),i=e.ingest(reverse());assert.equal(e.projection(i.intake_id,'CLIENT').durable_id,e.projection(i.intake_id,'ADMIN').durable_id)});
test('submit projection exposes durable contract fields',()=>{const e=createClientIntakeEngine(),i=e.ingest(reverse());e.processAll();const p=e.projection(i.intake_id,'CLIENT');for(const k of ['intake_id','durable_id','source_id','submitted_at','status'])assert.ok(p[k])});
test('known actionable is never dual invisible',()=>{const e=createClientIntakeEngine();e.ingest(reverse());assert.equal(e.metrics().dual_invisible_actionable_intake_count,0)});

test('Owner correction overlays effective quantity',()=>{const e=createClientIntakeEngine(),i=e.ingest(reverse({payload:{message_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',quantity_tonnes:10000}}));e.appendCorrection({intake_id:i.intake_id,field_path:'payload.quantity_tonnes',source_value:10000,corrected_value:1000,correction_authority:'OWNER',correction_reason:'QA'});assert.equal(e.projection(i.intake_id,'ADMIN').effective_quantity_tonnes,1000)});
test('Owner correction leaves raw source unchanged',()=>{const e=createClientIntakeEngine(),i=e.ingest(reverse({payload:{message_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',quantity_tonnes:10000}}));e.appendCorrection({intake_id:i.intake_id,field_path:'payload.quantity_tonnes',source_value:10000,corrected_value:1000,correction_authority:'OWNER',correction_reason:'QA'});assert.equal(e.snapshot().sources[0].payload.quantity_tonnes,10000)});
test('correction source mismatch fails',()=>{const e=createClientIntakeEngine(),i=e.ingest(reverse());assert.throws(()=>e.appendCorrection({intake_id:i.intake_id,field_path:'payload.quantity_tonnes',source_value:999,corrected_value:1,correction_authority:'OWNER'}),/SOURCE_VALUE_MISMATCH/)});

test('reconciliation restores Client visibility',()=>{const e=createClientIntakeEngine(),i=e.ingest(reverse());e._unsafeTestMutateIntake(i.intake_id,{client_visible:false});e.reconcile();assert.ok(e.projection(i.intake_id,'CLIENT'))});
test('reconciliation restores Admin visibility',()=>{const e=createClientIntakeEngine(),i=e.ingest(reverse());e._unsafeTestMutateIntake(i.intake_id,{admin_visible:false});e.reconcile();assert.ok(e.projection(i.intake_id,'ADMIN'))});
test('reconciliation recreates missing task exactly once',()=>{const e=createClientIntakeEngine(),i=e.ingest(reverse());e.processAll();e._unsafeTestDeleteTaskForIntake(i.intake_id);e.reconcile();assert.equal(e.snapshot().tasks.filter(t=>t.intake_id===i.intake_id).length,1)});
test('reconciliation heals stuck PROCESSING',()=>{let now=Date.parse('2032-01-01T00:00:00Z');const e=createClientIntakeEngine({clock:()=>now,stuckMs:1000}),i=e.ingest(reverse());e._unsafeTestMutateOutbox(i.intake_id,{state:'PROCESSING',processing_started_at:new Date(now-5000).toISOString()});e._unsafeTestMutateIntake(i.intake_id,{routing_state:'PROCESSING'});e.reconcile();assert.equal(e.snapshot().outbox[0].state,'APPLIED')});
test('reconciliation recovers source inventory',()=>{const e=createClientIntakeEngine(),s=reverse();e.rememberSource(s);e.reconcile([s]);assert.equal(e.snapshot().intakes.length,1)});

test('published application creates task',()=>{const e=createClientIntakeEngine();e.ingest(application());e.processAll();assert.equal(e.snapshot().tasks.length,1)});
test('proposed application creates task',()=>{const e=createClientIntakeEngine();e.ingest(application({source_record_id:'APP-PROPOSED',idempotency_key:'APP-PROPOSED',price_mode:'CLIENT_PROPOSED_PRICE',payload:{price_mode:'CLIENT_PROPOSED_PRICE',quantity_tonnes:25}}));e.processAll();assert.equal(e.snapshot().tasks.length,1)});
test('registry contains no source/event ID selector',()=>assert.ok(DEFAULT_CLIENT_INTAKE_ROUTING_REGISTRY.every(p=>!('source_record_id'in p)&&!('event_id'in p))));

// Recovery fixtures are tests only; runtime contains no branches for these IDs.
{
  const e=createClientIntakeEngine();
  const first=reverse({source_record_id:'PORTAL-EVT-2d8981c549484ec7a4b91dc22da78d96',idempotency_key:'PRICE-CALC-d1ead6b2-9bcc-4a53-aa4f-e35507d78291',payload:{source:'CLIENT_PRICE_CALCULATION_REQUEST',message_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',quantity_tonnes:10000}});
  const second=reverse({source_record_id:'PORTAL-EVT-d5cee7b90c1e4ce689f114b76814d208',idempotency_key:'PRICE-CALC-c462bf1b-320a-4910-81a1-1ae44ff8b3cc',payload:{source:'CLIENT_PRICE_CALCULATION_REQUEST',message_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',quantity_tonnes:175}});
  const i1=e.ingest(first),i2=e.ingest(second);
  e.appendCorrection({intake_id:i1.intake_id,field_path:'payload.quantity_tonnes',source_value:10000,corrected_value:1000,correction_authority:'OWNER',correction_reason:'CLIENT_SUBMISSION_DATA_INTEGRITY_INCIDENT'});
  e.reconcile([first,second]);
  const q1=e.projection(i1.intake_id,'ADMIN').effective_quantity_tonnes,q2=e.projection(i2.intake_id,'ADMIN').effective_quantity_tonnes,m=e.metrics();
  assert.equal(q1,1000);assert.equal(q2,175);assert.equal(e.snapshot().sources.find(s=>s.source_record_id===first.source_record_id).payload.quantity_tonnes,10000);assert.equal(e.snapshot().tasks.length,2);assert.equal(m.unrouted_client_intake_count,0);assert.equal(m.dual_invisible_actionable_intake_count,0);assert.equal(m.stuck_intake_count,0);
  console.log(`INCIDENT_1_REHEARSAL_EFFECTIVE_QUANTITY=${q1}`);console.log(`INCIDENT_2_REHEARSAL_EFFECTIVE_QUANTITY=${q2}`);console.log(`UNROUTED_ACTIONABLE_INTAKES_REHEARSAL=${m.unrouted_client_intake_count}`);console.log(`DUAL_INVISIBLE_ACTIONABLE_INTAKES_REHEARSAL=${m.dual_invisible_actionable_intake_count}`);console.log(`STUCK_INTAKES_REHEARSAL=${m.stuck_intake_count}`);console.log('RAW_SOURCE_MUTATION=NONE');
}

console.log(`CLIENT_INTAKE_REGRESSION_COUNT=${count}`);
console.log('CLIENT_INTAKE_P1_STAGE2_REGRESSIONS=PASS');
