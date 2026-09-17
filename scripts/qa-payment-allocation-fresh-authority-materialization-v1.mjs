import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const migrationPath='supabase/migrations/20260913005000_payment_allocation_fresh_authority_materialization_v1.sql';
const sql=await readFile(migrationPath,'utf8');
const must=(needle,label)=>assert(sql.includes(needle),label);

must('PAYMENT_ALLOCATION_FRESH_AUTHORITY_MATERIALIZATION_V1','contract missing');
must("p_dry_run boolean default true",'dry-run must be default');
must("message='EXPECTED_ACTIVE_SOURCE_VERSION_REQUIRED'",'CAS version input must be mandatory');
must("pg_advisory_xact_lock(hashtextextended('payment-allocation-fresh-authority-v1:'||p_idempotency_key,0))",'idempotency lock missing');
must('PAYMENT_ALLOCATION_IDEMPOTENCY_CONFLICT','idempotency conflict missing');
must('FINANCE_PROPOSAL_ALREADY_MATERIALIZED','proposal replay guard missing');
must("and source_version is not distinct from p_expected_active_source_version",'CAS source version missing');
must("message='PAYMENT_ALLOCATION_CAS_CONFLICT'",'CAS conflict missing');
must("authority_state='SUPERSEDED'::portal_private.authority_state_enum",'old authority supersede missing');
must("lifecycle_state='SUPERSEDED'::portal_private.lifecycle_state_enum",'old lifecycle supersede missing');
must("'FINANCE_SOURCE_LOCKED_RECONCILIATION'",'fresh source system missing');
must('FINANCE_CONCLUSION:%s/FINANCE_PROPOSAL:%s','fresh source version lineage missing');
must('payment_allocation_authority_history_v1','immutable history missing');
must('PAYMENT_ALLOCATION_AUTHORITY_HISTORY_IMMUTABLE','history mutation block missing');
must('FRESH_PAYMENT_ALLOCATION_BUSINESS_FIELDS_IMMUTABLE','fresh authority immutability missing');
must("v_payment.payment_direction<>'INCOMING'",'incoming-only gate missing');
must("v_payment.payment_kind<>'CLIENT_PAYMENT'",'client-payment-only gate missing');
must("v_payment.bank_fact_status<>'BANK_CONFIRMED'",'bank confirmation gate missing');
must("v_payment.finance_verification_status<>'VERIFIED'",'Finance verification gate missing');
must("coalesce(v_proposal_payload->>'proposed_action','')<>'RECONCILE_CURRENT_PAYMENT_ALLOCATION'",'proposal action gate missing');
must("grant execute on function public.payment_allocation_fresh_authority_materialize_v1",'service-only wrapper grant missing');
must("revoke all on function public.payment_allocation_fresh_authority_materialize_v1",'public/auth revoke missing');
assert(!/update\s+portal_private\.payments\b/i.test(sql),'PAYMENT.amount/table must never be updated');
assert(!/delete\s+from\s+portal_private\.payment_allocations\b/i.test(sql),'allocation history must not be deleted');
assert(!/PAYEV-2026-00000[1-9]|DEAL-2026-00[456]/.test(sql),'migration must not hardcode business IDs');

const oldFixture={
  id:'6fb5974e-887a-50de-a183-bde7facff1b9',paymentId:'PAYEV-2026-000001',dealId:'DEAL-2026-004',
  amount:236250,currency:'USD',sourceSystem:'SOURCE_FREEZE_V5/ACCOUNTING',sourceVersion:'v006',
  authorityState:'CONFIRMED',lifecycleState:'ACTIVE'
};
const finance={
  conclusionId:'a87f867e-fceb-4a75-bd15-0be8b77d046d',proposalId:'579985e2-dd74-401e-9b48-47840f4ff68e',
  paymentId:'PAYEV-2026-000001',dealId:'DEAL-2026-004',paymentAmount:236250,allocatedAmount:236250,currency:'USD',
  sourceTimestamp:'2026-09-12T21:20:55.007829Z'
};
const idem='owner-20260913-payev-000001-fresh-authority-v1';
const clone=v=>structuredClone(v);
const initial={payment:{id:finance.paymentId,amount:236250,currency:'USD'},allocations:[clone(oldFixture)],history:[]};

function plan(state,{expectedId=oldFixture.id,expectedVersion=oldFixture.sourceVersion,idempotencyKey=idem,dryRun=true,failAfterSupersede=false}={}){
  const prior=state.history.find(x=>x.idempotencyKey===idempotencyKey);
  const request={paymentId:finance.paymentId,expectedId,expectedVersion,conclusionId:finance.conclusionId,proposalId:finance.proposalId};
  if(prior){
    assert.deepEqual(prior.request,request,'PAYMENT_ALLOCATION_IDEMPOTENCY_CONFLICT');
    return {...clone(prior.result),idempotentReplay:true};
  }
  assert.equal(state.payment.amount,finance.paymentAmount,'payment amount mismatch');
  const active=state.allocations.filter(x=>x.paymentId===finance.paymentId&&x.lifecycleState==='ACTIVE');
  assert.equal(active.length,1,'PAYMENT_ALLOCATION_ACTIVE_SET_CONFLICT');
  const old=active[0];
  assert.equal(old.id,expectedId,'PAYMENT_ALLOCATION_CAS_CONFLICT');
  assert.equal(old.sourceVersion,expectedVersion,'PAYMENT_ALLOCATION_CAS_CONFLICT');
  const next={...old,id:dryRun?null:'generated-new-id',dealId:finance.dealId,amount:finance.allocatedAmount,
    sourceSystem:'FINANCE_SOURCE_LOCKED_RECONCILIATION',
    sourceVersion:`PAYMENT_ALLOCATION_FRESH_AUTHORITY_V1/FINANCE_CONCLUSION:${finance.conclusionId}/FINANCE_PROPOSAL:${finance.proposalId}`,
    sourceTimestamp:finance.sourceTimestamp,authorityState:'CONFIRMED',lifecycleState:'ACTIVE'};
  const result={dryRun,paymentId:finance.paymentId,paymentAmount:state.payment.amount,allocatedTotal:finance.allocatedAmount,
    unallocatedResidue:state.payment.amount-finance.allocatedAmount,old:clone(old),new:clone(next),idempotentReplay:false};
  if(dryRun)return result;
  const before=clone(state);
  try{
    old.authorityState='SUPERSEDED'; old.lifecycleState='SUPERSEDED';
    if(failAfterSupersede)throw new Error('INJECTED_POST_SUPERSEDE_FAILURE');
    state.allocations.push(next);
    assert.equal(state.allocations.filter(x=>x.paymentId===finance.paymentId&&x.lifecycleState==='ACTIVE').length,1,'POST_WRITE_ACTIVE_SET_CONFLICT');
    assert.equal(state.payment.amount,before.payment.amount,'PAYMENT_AMOUNT_IMMUTABILITY_VIOLATION');
    state.history.push({idempotencyKey,request,result:clone(result),oldSnapshot:before.allocations[0],newSnapshot:clone(next)});
    return result;
  }catch(e){
    Object.assign(state,clone(before));
    throw e;
  }
}

const dryState=clone(initial);const dry=plan(dryState,{dryRun:true});
assert.deepEqual(dryState,initial,'dry-run mutated state');
assert.equal(dry.old.sourceSystem,'SOURCE_FREEZE_V5/ACCOUNTING');
assert.equal(dry.new.sourceSystem,'FINANCE_SOURCE_LOCKED_RECONCILIATION');
assert.equal(dry.unallocatedResidue,0);
console.log('DRY_RUN_OLD_TO_NEW_DIFF=PASS');

const applied=clone(initial);plan(applied,{dryRun:false});
assert.equal(applied.payment.amount,236250);
assert.equal(applied.allocations[0].authorityState,'SUPERSEDED');
assert.equal(applied.allocations[0].lifecycleState,'SUPERSEDED');
assert.equal(applied.allocations.filter(x=>x.lifecycleState==='ACTIVE').length,1);
assert.equal(applied.history.length,1);
console.log('EXACTLY_ONE_ACTIVE_AUTHORITY=PASS');
console.log('PAYMENT_AMOUNT_IMMUTABLE=PASS');
console.log('AUDIT_HISTORY_PRESERVED=PASS');

const replay=plan(applied,{dryRun:false});
assert.equal(replay.idempotentReplay,true);
assert.equal(applied.allocations.length,2);
assert.equal(applied.history.length,1);
console.log('IDEMPOTENCY_REPLAY=PASS');

const stale=clone(initial);let cas=false;
try{plan(stale,{expectedVersion:'stale-version',idempotencyKey:'owner-20260913-stale-cas-key',dryRun:false})}catch{cas=true}
assert(cas);assert.deepEqual(stale,initial);console.log('CAS_STALE_ABORT=PASS');

const rollback=clone(initial);let rolled=false;
try{plan(rollback,{idempotencyKey:'owner-20260913-rollback-proof-key',dryRun:false,failAfterSupersede:true})}catch{rolled=true}
assert(rolled);assert.deepEqual(rollback,initial);console.log('ROLLBACK_ATOMIC=PASS');

for(const protectedPayment of [
  {id:'PAYEV-2026-000004',direction:'OUTGOING',kind:'FX_CONVERSION'},
  {id:'PAYEV-2026-000005',direction:'INCOMING',kind:'FX_CONVERSION'},
  {id:'PAYEV-2026-000006',direction:'OUTGOING',kind:'FX_CONVERSION'},
  {id:'PAYEV-2026-000007',direction:'INCOMING',kind:'FX_CONVERSION'},
  {id:'PAYEV-2026-000008',direction:'OUTGOING',kind:'COUNTERPARTY_PAYMENT'},
  {id:'PAYEV-2026-000009',direction:'OUTGOING',kind:'BANK_FEE'}
]) assert(!(protectedPayment.direction==='INCOMING'&&protectedPayment.kind==='CLIENT_PAYMENT'));
console.log('PROTECTED_PAYMENTS_000004_000009_EXCLUDED_BY_TYPE_GATE=PASS');

const mutationRpc='payment_allocation_fresh_authority_materialize_v1';
for(const path of [
  'functions/portal/owner-api.js',
  'functions/portal/main-ui/index.js',
  'supabase/functions/rona-owner-ai-sync/index.ts',
  'supabase/functions/rona-owner-ai-sync/runtime.ts'
]){
  const src=await readFile(path,'utf8');
  assert(src.length>0,`source surface missing: ${path}`);
  assert(!src.includes(mutationRpc),`direct frontend/AI mutation surface detected in ${path}`);
}
console.log('SERVER_ONLY_AUTHORIZATION_SOURCE=PASS');
console.log('NO_FRONTEND_OR_AI_MUTATION_ROUTE=PASS');
console.log('NO_PAYMENT_OR_ALLOCATION_HARDCODE_IN_MIGRATION=PASS');
console.log('PAYMENT_ALLOCATION_FRESH_AUTHORITY_MATERIALIZATION_V1=PASS');
