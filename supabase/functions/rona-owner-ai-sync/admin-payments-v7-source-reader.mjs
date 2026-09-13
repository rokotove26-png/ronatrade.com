const RELATIONS = Object.freeze({
  paymentBusinessAttributions: 'portal_private.payment_business_attributions_v7',
  paymentBusinessAttributionLines: 'portal_private.payment_business_attribution_lines_v7',
  financeAuthority: 'portal_private.deal_finance_authority_v7',
  resourceChain: 'portal_private.payment_resource_chains_v7',
});

export const ADMIN_PAYMENTS_V7_SNAPSHOT_OPTIONS = 'isolation level repeatable read read only';
export const ADMIN_PAYMENTS_V7_READ_ROLE = 'rona_payments_v7_reader';

function cloneRows(rows) { return Array.isArray(rows) ? rows : []; }

export async function activateAdminPaymentsV7ReadRole(sql) {
  if (typeof sql !== 'function') throw new TypeError('POSTGRES_TRANSACTION_SQL_REQUIRED');
  await sql`set local role rona_payments_v7_reader`;
}

export async function readAdminPaymentsV7RawSources(port) {
  if (!port || typeof port.relationExists !== 'function' || typeof port.readSnapshotTimestamp !== 'function') {
    throw new TypeError('ADMIN_PAYMENTS_V7_READ_PORT_REQUIRED');
  }

  const snapshotTimestamp = await port.readSnapshotTimestamp();
  if (!snapshotTimestamp) throw new Error('ADMIN_PAYMENTS_V7_SNAPSHOT_TIMESTAMP_REQUIRED');

  const [paymentHeadersPresent, paymentLinesPresent, financePresent, resourceChainPresent] = await Promise.all([
    port.relationExists(RELATIONS.paymentBusinessAttributions),
    port.relationExists(RELATIONS.paymentBusinessAttributionLines),
    port.relationExists(RELATIONS.financeAuthority),
    port.relationExists(RELATIONS.resourceChain),
  ]);

  const capabilities = {
    paymentBusinessAuthority: paymentHeadersPresent && paymentLinesPresent,
    financeAuthority: financePresent,
    resourceChain: resourceChainPresent,
  };

  const [deals, workflows, clients, contracts, payments, paymentAllocations, paymentAllocationHistory, ownerOutgoingPaymentFacts] = await Promise.all([
    port.readDeals(), port.readWorkflows(), port.readClients(), port.readContracts(),
    port.readPayments(), port.readPaymentAllocations(), port.readPaymentAllocationHistory(), port.readOwnerOutgoingPaymentFacts(),
  ]);

  const [paymentBusinessAttributions, paymentBusinessAttributionLines, dealFinanceAuthorities, resourceChains] = await Promise.all([
    capabilities.paymentBusinessAuthority ? port.readPaymentBusinessAttributions() : [],
    capabilities.paymentBusinessAuthority ? port.readPaymentBusinessAttributionLines() : [],
    capabilities.financeAuthority ? port.readDealFinanceAuthorities() : [],
    capabilities.resourceChain ? port.readResourceChains() : [],
  ]);

  const asOf = String(snapshotTimestamp);
  return {
    generatedAt: asOf,
    sourceAsOf: asOf,
    sourceReaderContract: 'ADMIN_PAYMENTS_V7_RAW_SOURCE_V1',
    snapshotContract: {
      isolation: 'REPEATABLE READ',
      access: 'READ ONLY',
      sourceAsOf: 'DB_TRANSACTION_TIMESTAMP',
      dbRole: ADMIN_PAYMENTS_V7_READ_ROLE,
    },
    providerPresence: {
      paymentBusinessAttributions: paymentHeadersPresent,
      paymentBusinessAttributionLines: paymentLinesPresent,
      financeAuthority: financePresent,
      resourceChain: resourceChainPresent,
    },
    capabilities,
    deals: cloneRows(deals),
    workflows: cloneRows(workflows),
    clients: cloneRows(clients),
    contracts: cloneRows(contracts),
    payments: cloneRows(payments),
    paymentAllocations: cloneRows(paymentAllocations),
    paymentAllocationHistory: cloneRows(paymentAllocationHistory),
    ownerOutgoingPaymentFacts: cloneRows(ownerOutgoingPaymentFacts),
    paymentBusinessAttributions: cloneRows(paymentBusinessAttributions),
    paymentBusinessAttributionLines: cloneRows(paymentBusinessAttributionLines),
    dealFinanceAuthorities: cloneRows(dealFinanceAuthorities),
    resourceChains: cloneRows(resourceChains),
  };
}

export function createPostgresAdminPaymentsV7ReadPort(sql) {
  if (typeof sql !== 'function') throw new TypeError('POSTGRES_SQL_TAG_REQUIRED');
  return {
    async readSnapshotTimestamp() {
      const rows = await sql`select transaction_timestamp()::text as source_as_of`;
      return rows?.[0]?.source_as_of || null;
    },
    async relationExists(qualifiedName) {
      const rows = await sql`select to_regclass(${qualifiedName})::text as relation`;
      return Boolean(rows?.[0]?.relation);
    },
    readDeals: () => sql`
      select id::text id, deal_id, client_key::text client_key, contract_key::text contract_key,
             business_status, finance_status::text finance_status, accounting_closure_status::text accounting_closure_status,
             source_system, source_version, source_timestamp, authority_state::text authority_state, lifecycle_state::text lifecycle_state
      from portal_private.deals
      where lifecycle_state::text <> 'ARCHIVED'
      order by deal_id`,
    readWorkflows: () => sql`
      select deal_key::text deal_key, payment_handoff_state::text payment_handoff_state,
             cancellation_state::text cancellation_state, updated_at
      from portal_private.owner_deal_workflow
      order by deal_key`,
    readClients: () => sql`
      select id::text id, client_id, legal_name, source_system, source_version, source_timestamp,
             authority_state::text authority_state, lifecycle_state::text lifecycle_state
      from portal_private.clients
      where lifecycle_state::text <> 'ARCHIVED'
      order by client_id`,
    readContracts: () => sql`
      select id::text id, contract_id, client_key::text client_key, current_external_contract_number,
             source_system, source_version, source_timestamp, authority_state::text authority_state, lifecycle_state::text lifecycle_state
      from portal_private.contracts
      where lifecycle_state::text <> 'ARCHIVED'
      order by contract_id`,
    readPayments: () => sql`
      select id::text id, payment_id, payment_at, amount::text amount, currency,
             payment_direction::text payment_direction, payment_kind::text payment_kind,
             bank_fact_status::text bank_fact_status, finance_status::text finance_status,
             finance_verification_status::text finance_verification_status,
             deal_allocation_applicability::text deal_allocation_applicability,
             allocation_review_status::text allocation_review_status, candidate_deal_ids,
             counterparty_name, bank_transaction_reference, source_system, source_version, source_timestamp,
             authority_state::text authority_state, lifecycle_state::text lifecycle_state
      from portal_private.payments
      where lifecycle_state::text = 'ACTIVE'
        and authority_state::text in ('VERIFIED','CONFIRMED')
        and bank_fact_status::text = 'BANK_CONFIRMED'
      order by payment_at, payment_id`,
    readPaymentAllocations: () => sql`
      select id::text id, payment_key::text payment_key, deal_key::text deal_key,
             allocated_amount::text allocated_amount, allocation_status::text allocation_status,
             finance_status::text finance_status, allocation_reference, allocated_at,
             source_system, source_version, source_timestamp,
             authority_state::text authority_state, lifecycle_state::text lifecycle_state,
             created_at, updated_at
      from portal_private.payment_allocations
      where lifecycle_state::text <> 'ARCHIVED'
      order by created_at, id`,
    readPaymentAllocationHistory: () => sql`
      select payment_key::text payment_key, old_allocation_id::text old_allocation_id,
             new_allocation_id::text new_allocation_id
      from portal_private.payment_allocation_authority_history_v1
      order by payment_key, old_allocation_id`,
    readOwnerOutgoingPaymentFacts: () => sql`
      select id::text id, fact_id, payment_at, amount::text amount, currency, deal_ids,
             deal_allocation_status::text deal_allocation_status, flow_kind::text flow_kind,
             bank_fact_status::text bank_fact_status, source_document, source_version, source_timestamp,
             authority_state::text authority_state, lifecycle_state::text lifecycle_state
      from portal_private.owner_outgoing_payment_facts
      where lifecycle_state::text = 'ACTIVE'
        and authority_state::text = 'CONFIRMED'
        and bank_fact_status::text = 'BANK_CONFIRMED'
      order by payment_at, fact_id`,
    readPaymentBusinessAttributions: () => sql`
      select id::text id, payment_key::text payment_key, classification, attribution_mode, decision_type, authority_kind,
             authority_source_ref, business_scope_refs, scope_deal_keys, principal_payment_key::text principal_payment_key,
             materialization_status, authority_state, lifecycle_state, effective_at,
             supersedes_id::text supersedes_id, supersedes_authority_refs,
             source_version, source_timestamp, source_refs, source_locked, actor_id::text actor_id, actor_role,
             idempotency_key, created_at
      from portal_private.payment_business_attributions_v7
      order by effective_at, id`,
    readPaymentBusinessAttributionLines: () => sql`
      select id::text id, attribution_id::text attribution_id, deal_key::text deal_key,
             amount::text amount, currency, amount_status, source_refs, created_at
      from portal_private.payment_business_attribution_lines_v7
      order by attribution_id, deal_key`,
    readDealFinanceAuthorities: () => sql`
      select id::text id, deal_key::text deal_key, total_to_receive::text total_to_receive,
             due_now::text due_now, expected_not_due::text expected_not_due,
             future_conditional::text future_conditional, obligation_currency,
             contractual_payment_currency, mixed_inbound_accounting_currency,
             finance_status, documentary_status, authority_state, lifecycle_state, effective_at,
             supersedes_id::text supersedes_id, supersedes_authority_refs,
             source_version, source_timestamp, source_refs, source_locked, created_at
      from portal_private.deal_finance_authority_v7
      order by deal_key, effective_at, id`,
    readResourceChains: () => sql`
      select id::text id, payment_key::text payment_key, deal_key::text deal_key,
             native_amount::text native_amount, native_currency,
             accounting_amount::text accounting_amount, accounting_currency,
             source_locked, authority_state, lifecycle_state,
             supersedes_id::text supersedes_id, supersedes_authority_refs
      from portal_private.payment_resource_chains_v7
      order by payment_key, deal_key, id`,
  };
}

export function createAdminPaymentsV7SourceReader(sql, options = {}) {
  if (typeof sql !== 'function' || typeof sql.begin !== 'function') throw new TypeError('POSTGRES_TRANSACTION_SQL_REQUIRED');
  const createReadPort = options.createReadPort || createPostgresAdminPaymentsV7ReadPort;
  const activateReadRole = options.activateReadRole || activateAdminPaymentsV7ReadRole;
  return () => sql.begin(ADMIN_PAYMENTS_V7_SNAPSHOT_OPTIONS, async (transactionSql) => {
    await activateReadRole(transactionSql);
    const port = createReadPort(transactionSql);
    return readAdminPaymentsV7RawSources(port);
  });
}

export { RELATIONS as ADMIN_PAYMENTS_V7_OPTIONAL_RELATIONS };
