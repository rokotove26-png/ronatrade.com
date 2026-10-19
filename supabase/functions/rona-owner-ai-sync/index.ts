// @ts-nocheck
import postgres from 'postgres';
import { buildAdminPaymentsV7FromRawSources } from '../_shared/admin-payments-v7/index.mjs';
import { createAdminPaymentsV7TruthSourceReader } from './admin-payments-v7-source-reader-truth.mjs';
import { createRonaOwnerAiSyncV7Handler } from './admin-payments-v7-integration.mjs';
import {
  applyOwnerConfirmedReceiptsV7,
  readOwnerConfirmedReceiptsV7,
} from './owner-confirmed-receipt-projection.mjs';
import { applyFinanceAuthorityProjectionV8 } from './finance-authority-projection-v8.mjs';
import { applyAdminPaymentsExecutionMonitoringScope } from './execution-monitoring-scope-v1.mjs';

const nativeServe = Deno.serve.bind(Deno);
const DB = Deno.env.get('SUPABASE_DB_URL');
const v7Sql = DB ? postgres(DB, { prepare: false, max: 1, idle_timeout: 1, max_lifetime: 30, connect_timeout: 5 }) : null;
let runtimeHandler = null;

const capturedServe = (...args) => {
  const handler = typeof args[0] === 'function' ? args[0] : args[1];
  if (typeof handler !== 'function') throw new Error('AI_SYNC_HANDLER_CAPTURE_FAILED');
  runtimeHandler = handler;
  return {
    finished: Promise.resolve(),
    ref() {},
    unref() {},
    shutdown() { return Promise.resolve(); },
    addr: { transport: 'tcp', hostname: '0.0.0.0', port: 0 },
  };
};

const serveDescriptor = Object.getOwnPropertyDescriptor(Deno, 'serve');
Object.defineProperty(Deno, 'serve', { value: capturedServe, configurable: true, writable: true });
await import('./runtime.ts');
if (serveDescriptor) Object.defineProperty(Deno, 'serve', serveDescriptor);
else Object.defineProperty(Deno, 'serve', { value: nativeServe, configurable: true, writable: true });
if (typeof runtimeHandler !== 'function') throw new Error('AI_SYNC_HANDLER_NOT_REGISTERED');
if (!v7Sql) throw new Error('ADMIN_PAYMENTS_V7_DB_UNAVAILABLE');

async function persistOwnerDecision({ envelope }) {
  // The authenticated runtime authorizes the request first. This trusted backend DB context then
  // performs exactly one business mutation call: the sealed Stage 4B persistence primitive.
  const expected = envelope.p_expected_current_authority_id || null;
  const authority = JSON.stringify(envelope.p_authority);
  const audit = JSON.stringify(envelope.p_audit);
  const rows = await v7Sql`
    select p.id::text as id,p.payment_key::text as payment_key,p.decision_type,p.idempotency_key
    from portal_private.persist_owner_payment_decision_v7(
      ${expected}::uuid,
      ${authority}::jsonb,
      ${audit}::jsonb
    ) p`;
  if (rows.length !== 1) throw new Error('OWNER_DECISION_PERSISTENCE_RESULT_INVALID');
  return rows[0];
}

async function readPostExecutionAttentionCandidateDealKeys() {
  // Exact lifecycle precursor for the closing-documents stage:
  // Rail monitoring was manually completed and the current terminal Finance V8 authority is locked and paid.
  // The projection layer below still verifies authoritative total/received/remaining money before exclusion.
  const rows=await v7Sql`
    select distinct f.deal_key::text as deal_key
      from portal_private.deal_finance_authority_payments_v8_read_v1 f
      join portal_private.rail_deal_monitoring_control_v1 c on c.deal_key=f.deal_key
     where upper(c.monitoring_state)='COMPLETED'
       and upper(f.finance_status)='PAID'
       and upper(f.authority_state)='AUTHORITATIVE'
       and upper(f.lifecycle_state)='CURRENT'
       and f.source_locked=true
       and f.is_terminal=true
       and coalesce(f.total_to_receive,0)>0
  `;
  return rows.map((row)=>String(row?.deal_key||'')).filter(Boolean);
}

async function readPaymentsV8FinanceAuthorityGate() {
  // Safety overlay: if a current confirmed signed document has not yet produced a MATERIALIZED V8
  // schedule, receivable amounts are deliberately NULL/TO_VERIFY instead of exposing stale legacy
  // application/offer terms. Execution/spend facts remain Finance-owned and are not rewritten here.
  return v7Sql`
    select id::text id, deal_key::text deal_key,
           total_to_receive::text total_to_receive,
           due_now::text due_now, expected_not_due::text expected_not_due,
           future_conditional::text future_conditional, obligation_currency,
           contractual_payment_currency, mixed_inbound_accounting_currency,
           actual_spend::text actual_spend, actual_spend_status,
           remaining_execution::text remaining_execution, remaining_execution_status,
           execution_currency, execution_status,
           finance_status, documentary_status, authority_state, lifecycle_state, effective_at,
           supersedes_id::text supersedes_id, supersedes_authority_refs,
           source_version, source_timestamp, source_refs, source_locked, created_at
      from portal_private.deal_finance_authority_payments_v8_read_v1
     order by deal_key, effective_at, id`;
}


/**
 * OWNER collection expectation is a display-only instruction, not a change to
 * the legally signed installment trigger. Read only audited FINANCE proposals
 * separately approved by OPERATIONS_DIRECTOR and explicitly sourced to OWNER.
 */
async function readOwnerCollectionInstructionsV1() {
  return v7Sql`
    select d.id::text as deal_key,
           d.deal_id,
           item.entry->>'amount' as claim_amount,
           item.entry->>'currency' as currency,
           a.record_id::text as proposal_id,
           ap.record_id::text as approval_id,
           a.payload->'proposed_state'->>'document_id' as document_id,
           a.created_at as source_timestamp,
           ap.created_at as approved_at
    from portal_private.ai_coordination_records a
    join portal_private.ai_coordination_records ap
      on ap.parent_record_id=a.record_id
     and ap.record_type='OPERATIONS_INTERNAL_DECISION'
     and ap.functional_role::text='OPERATIONS_DIRECTOR'
     and ap.identity_id='AI-OPERATIONS-DIRECTOR'
     and ap.status='APPROVE_FOR_NEXT_STAGE'
     and ap.qa_only is not true
    join lateral jsonb_array_elements(a.payload->'proposed_state'->'targets') as item(entry) on true
    join portal_private.deals d
      on d.deal_id=item.entry->>'deal_id'
     and d.lifecycle_state::text='ACTIVE'
    where a.record_type='BUSINESS_CHANGE_PROPOSAL'
      and a.tool_name='business_change_proposal_submit'
      and a.identity_id='AI-FINANCE'
      and a.functional_role::text='FINANCE'
      and a.status='PROPOSED'
      and a.qa_only is not true
      and a.payload->>'proposed_action'='OWNER_DIRECTED_COLLECTION_STATUS'
      and a.payload->>'proposed_field'='owner_payment_demand_now'
      and jsonb_typeof(a.payload->'proposed_state'->'targets')='array'
      and a.payload->'proposed_state'->>'contract_source_unchanged'='true'
      and a.payload->'proposed_state'->>'bank_receipts_unchanged'='true'
      and a.payload->'proposed_state'->>'document_id' like 'RONA-DOC-%'
      and exists (
        select 1 from jsonb_array_elements_text(a.evidence_refs) e(value)
        where e.value like 'OWNER_INSTRUCTION:%'
      )
    order by ap.created_at desc,a.created_at desc
  `;
}

function applyOwnerCollectionInstructionsV1(projection, rows) {
  const byDeal = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = String(row.deal_key || '');
    if (key && !byDeal.has(key)) byDeal.set(key,row);
  }
  const applied = [];
  const skipped = [];
  const current = (field, currency) => field
    && field.status === 'AUTHORITATIVE'
    && String(field.currency || '').trim().toUpperCase() === currency
    && Number.isFinite(Number(field.amount));
  const eq = (a,b) => Number.isFinite(Number(a)) && Number.isFinite(Number(b))
    && Math.abs(Number(a)-Number(b)) < 0.005;
  const deals = (projection.deals || []).map((deal) => {
    const instruction = byDeal.get(String(deal.deal_key || ''));
    if (!instruction) return deal;
    const currency = String(instruction.currency || '').trim().toUpperCase();
    const amount = String(instruction.claim_amount || '');
    const due = deal.due_now;
    const future = deal.future_conditional;
    const expected = deal.expected_not_due;
    const remaining = deal.remaining_to_receive;
    // Fail closed if the signed schedule, actual receipts or currency have changed.
    // This also prevents an obsolete OWNER request from surviving a new payment.
    if (!/^[A-Z]{3}$/.test(currency) || !Number.isFinite(Number(amount))
        || Number(amount)<=0
        || ![due, future, expected, remaining].every((m) => current(m,currency))
        || !eq(due.amount,0) || !eq(expected.amount,0)
        || !eq(future.amount,amount) || !eq(remaining.amount,amount)) {
      skipped.push({ deal_id: deal.deal_id, reason: 'OWNER_COLLECTION_SOURCE_NO_LONGER_MATCHES_CANONICAL_SCHEDULE' });
      return deal;
    }
    const refs = [
      {source_type:'OWNER_COLLECTION_INSTRUCTION',source_id:String(instruction.proposal_id),source_timestamp:instruction.source_timestamp},
      {source_type:'OPERATIONS_APPROVAL',source_id:String(instruction.approval_id),source_timestamp:instruction.approved_at},
      {source_type:'SUPPLIER_READINESS_NOTICE',source_id:String(instruction.document_id)},
    ];
    applied.push(deal.deal_id);
    return {
      ...deal,
      // The existing Payments V7 renderer takes its "Expected now" tile from due_now.
      // These two values are strictly presentation-layer only; canonical V8 is untouched.
      due_now: {...due,amount,reason:'OWNER_MANAGEMENT_COLLECTION_EXPECTATION',authority_refs:[...(due.authority_refs||[]),...refs]},
      future_conditional: {...future,amount:'0',reason:'OWNER_PRESENTATION_RECLASSIFICATION_ONLY',authority_refs:[...(future.authority_refs||[]),...refs]},
      financial_status: 'ОЖИДАЕТСЯ ОПЛАТА ПО РЕШЕНИЮ OWNER',
      contractual_payment_schedule: {due_now:due,expected_not_due:expected,future_conditional:future,financial_status:deal.financial_status},
      owner_management_collection: {status:'CURRENT_OWNER_EXPECTATION',amount,currency,document_id:instruction.document_id,proposal_id:instruction.proposal_id,approval_id:instruction.approval_id,contractual_trigger_unchanged:true},
      authority_refs: [...(deal.authority_refs||[]),...refs],
    };
  });
  return {
    ...projection,deals,
    owner_management_collection_overlay: {version:'OWNER_COLLECTION_PRESENTATION_V1',applied_deals:applied,skipped_deals:skipped,contractual_finance_authority_unchanged:true},
  };
}

const readBaseRawSources = createAdminPaymentsV7TruthSourceReader(v7Sql);
async function readRawSources() {
  const raw = await readBaseRawSources();
  const [ownerConfirmedReceipts, gatedFinanceAuthorities, postExecutionAttentionCandidateDealKeys, ownerCollectionInstructions] = await Promise.all([
    readOwnerConfirmedReceiptsV7(v7Sql, raw?.sourceAsOf || null),
    readPaymentsV8FinanceAuthorityGate(),
    readPostExecutionAttentionCandidateDealKeys(),
    readOwnerCollectionInstructionsV1(),
  ]);
  return {
    ...raw,
    dealFinanceAuthorities: gatedFinanceAuthorities,
    ownerConfirmedReceipts,
    postExecutionAttentionCandidateDealKeys,
    ownerCollectionInstructions,
  };
}

function buildProjection(raw) {
  const base = buildAdminPaymentsV7FromRawSources(raw);
  const receipts = applyOwnerConfirmedReceiptsV7(base, raw?.ownerConfirmedReceipts || []);
  const finance = applyFinanceAuthorityProjectionV8(receipts, raw?.dealFinanceAuthorities || []);
  const scoped = applyAdminPaymentsExecutionMonitoringScope(
    finance,
    raw?.postExecutionAttentionCandidateDealKeys || [],
  );
  return applyOwnerCollectionInstructionsV1(scoped, raw?.ownerCollectionInstructions || []);
}

nativeServe(createRonaOwnerAiSyncV7Handler({
  runtimeHandler,
  readRawSources,
  buildProjection,
  persistOwnerDecision,
  logger: console,
}));