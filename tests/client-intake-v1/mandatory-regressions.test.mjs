import assert from 'node:assert/strict';
import { createClientIntakeEngine } from '../../supabase/functions/_shared/client-intake-v1/index.mjs';

function reverse(id, idempotencyKey, quantity=1000, overrides={}) {
  return {
    source_kind:'PORTAL_REVERSE_EVENT',
    source_record_id:id,
    source_event_type:'CLIENT_MESSAGE_SUBMIT',
    actor_role:'CLIENT',
    idempotency_key:idempotencyKey,
    client_key:'client-generic',
    contract_key:'contract-generic',
    deal_key:null,
    payload:{
      source:'CLIENT_PRICE_CALCULATION_REQUEST',
      message_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',
      quantity_tonnes:quantity,
    },
    ...overrides,
  };
}

// Mandatory: two distinct sequential successful submissions remain distinct and exactly-once.
{
  const e=createClientIntakeEngine();
  const first=e.ingest(reverse('PORTAL-EVT-SEQUENTIAL-A','IDEMP-SEQUENTIAL-A',1000));
  const second=e.ingest(reverse('PORTAL-EVT-SEQUENTIAL-B','IDEMP-SEQUENTIAL-B',175));
  e.processAll();
  const snap=e.snapshot();
  assert.notEqual(first.intake_id,second.intake_id);
  assert.equal(snap.intakes.length,2);
  assert.equal(snap.outbox.length,2);
  assert.equal(snap.tasks.length,2);
  assert.equal(e.projection(first.intake_id,'CLIENT').effective_quantity_tonnes,1000);
  assert.equal(e.projection(second.intake_id,'CLIENT').effective_quantity_tonnes,175);
  console.log('TWO_SEQUENTIAL_SUBMISSIONS=PASS');
}

// Mandatory: a non-actionable source cannot create routing work.
{
  const e=createClientIntakeEngine();
  const result=e.ingest({
    source_kind:'PORTAL_REVERSE_EVENT',
    source_record_id:'PORTAL-EVT-NON-ACTIONABLE',
    source_event_type:'SESSION_PING',
    actor_role:'CLIENT',
    idempotency_key:'IDEMP-NON-ACTIONABLE',
    payload:{quantity_tonnes:1000},
  });
  e.processAll();
  const snap=e.snapshot();
  assert.equal(result,null);
  assert.equal(snap.intakes.length,0);
  assert.equal(snap.outbox.length,0);
  assert.equal(snap.tasks.length,0);
  console.log('NON_ACTIONABLE_NO_TASK=PASS');
}

// Mandatory: historical source inventory can be recovered through the same idempotent reconciler.
{
  const e=createClientIntakeEngine();
  const historical=reverse('PORTAL-EVT-HISTORICAL-GENERIC','IDEMP-HISTORICAL-GENERIC',250);
  e.rememberSource(historical);
  assert.equal(e.snapshot().intakes.length,0);
  e.reconcile([historical]);
  const snap=e.snapshot();
  assert.equal(snap.intakes.length,1);
  assert.equal(snap.outbox.length,1);
  assert.equal(snap.tasks.length,1);
  const intake=snap.intakes[0];
  assert.ok(e.projection(intake.intake_id,'CLIENT'));
  assert.ok(e.projection(intake.intake_id,'ADMIN'));
  assert.equal(e.metrics().unrouted_client_intake_count,0);
  console.log('HISTORICAL_INTAKE_RECOVERY=PASS');
}

console.log('P1_MANDATORY_REGRESSIONS=PASS');
