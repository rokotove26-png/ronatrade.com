import {
  ADMIN_PAYMENTS_V7_READ_ROLE,
  ADMIN_PAYMENTS_V7_SNAPSHOT_OPTIONS,
  activateAdminPaymentsV7ReadRole,
  createPostgresAdminPaymentsV7ReadPort,
  readAdminPaymentsV7RawSources,
} from './admin-payments-v7-source-reader.mjs';

export const ADMIN_PAYMENTS_V7_TRUTH_RELATIONS = Object.freeze({
  deals: 'portal_private.deals',
  workflows: 'portal_private.owner_deal_workflow',
  clients: 'portal_private.clients',
  contracts: 'portal_private.contracts',
  payments: 'portal_private.payments',
  paymentAllocations: 'portal_private.payment_allocations',
  paymentAllocationHistory: 'portal_private.payment_allocation_authority_history_v1',
  ownerOutgoingPaymentFacts: 'portal_private.owner_outgoing_payment_facts',
  paymentBusinessAttributions: 'portal_private.payment_business_attributions_v7',
  paymentBusinessAttributionLines: 'portal_private.payment_business_attribution_lines_v7',
  providerReadiness: 'portal_private.admin_payments_v7_provider_readiness',
  financeAuthority: 'portal_private.deal_finance_authority_v7',
  resourceChain: 'portal_private.payment_resource_chains_v7',
});

const relationKeyByName = new Map(Object.entries(ADMIN_PAYMENTS_V7_TRUTH_RELATIONS).map(([key, value]) => [value, key]));
const readable = (state) => state?.present === true && state?.select_granted === true && state?.rls_select_path === true;

async function inspectRelation(sql, qualifiedName) {
  const rows = await sql`
    select
      c.oid::regclass::text as relation,
      has_table_privilege(current_user, c.oid, 'SELECT') as select_granted,
      c.relrowsecurity as rls_enabled,
      case
        when not c.relrowsecurity then true
        else exists (
          select 1
          from pg_policy p
          where p.polrelid = c.oid
            and p.polcmd in ('r','*')
            and (
              0 = any(p.polroles)
              or (select oid from pg_roles where rolname = current_user) = any(p.polroles)
            )
        )
      end as rls_select_path
    from pg_class c
    where c.oid = to_regclass(${qualifiedName})`;
  const row = rows?.[0];
  if (!row) return { relation: qualifiedName, present: false, select_granted: false, rls_enabled: false, rls_select_path: false, readable: false };
  const state = {
    relation: String(row.relation || qualifiedName),
    present: true,
    select_granted: row.select_granted === true,
    rls_enabled: row.rls_enabled === true,
    rls_select_path: row.rls_select_path === true,
  };
  return { ...state, readable: readable(state) };
}

export async function inspectAdminPaymentsV7SourceVisibility(sql) {
  if (typeof sql !== 'function') throw new TypeError('POSTGRES_TRANSACTION_SQL_REQUIRED');
  const relations = {};
  for (const [key, name] of Object.entries(ADMIN_PAYMENTS_V7_TRUTH_RELATIONS)) {
    relations[key] = await inspectRelation(sql, name);
  }
  const allReadable = (...keys) => keys.every((key) => readable(relations[key]));
  return {
    db_role: ADMIN_PAYMENTS_V7_READ_ROLE,
    relations,
    contourAuthority: allReadable('deals', 'workflows', 'clients', 'contracts'),
    bankReceiptAuthority: allReadable('payments', 'paymentAllocations', 'paymentAllocationHistory'),
    paymentBusinessAuthority: allReadable('paymentBusinessAttributions', 'paymentBusinessAttributionLines', 'providerReadiness'),
    financeAuthority: allReadable('financeAuthority'),
    resourceChain: allReadable('resourceChain'),
    ownerOutgoingPaymentFacts: allReadable('ownerOutgoingPaymentFacts'),
  };
}

function guardedPort(base, visibility) {
  const can = (key) => readable(visibility.relations[key]);
  const optionalRelationExists = async (qualifiedName) => {
    const key = relationKeyByName.get(String(qualifiedName));
    if (key && !can(key)) return false;
    return base.relationExists(qualifiedName);
  };
  return {
    ...base,
    relationExists: optionalRelationExists,
    readDeals: () => can('deals') ? base.readDeals() : [],
    readWorkflows: () => can('workflows') ? base.readWorkflows() : [],
    readClients: () => can('clients') ? base.readClients() : [],
    readContracts: () => can('contracts') ? base.readContracts() : [],
    readPayments: () => can('payments') ? base.readPayments() : [],
    readPaymentAllocations: () => can('paymentAllocations') ? base.readPaymentAllocations() : [],
    readPaymentAllocationHistory: () => can('paymentAllocationHistory') ? base.readPaymentAllocationHistory() : [],
    readOwnerOutgoingPaymentFacts: () => can('ownerOutgoingPaymentFacts') ? base.readOwnerOutgoingPaymentFacts() : [],
    readPaymentBusinessAttributions: () => can('paymentBusinessAttributions') ? base.readPaymentBusinessAttributions() : [],
    readPaymentBusinessAttributionLines: () => can('paymentBusinessAttributionLines') ? base.readPaymentBusinessAttributionLines() : [],
    readProviderReadiness: (providerKey) => can('providerReadiness') ? base.readProviderReadiness(providerKey) : null,
    readDealFinanceAuthorities: () => can('financeAuthority') ? base.readDealFinanceAuthorities() : [],
    readResourceChains: () => can('resourceChain') ? base.readResourceChains() : [],
  };
}

export function decorateAdminPaymentsV7RawTruth(raw, visibility) {
  const baseCapabilities = raw?.capabilities || {};
  return {
    ...raw,
    sourceVisibility: visibility,
    capabilities: {
      ...baseCapabilities,
      contourAuthority: visibility.contourAuthority === true,
      bankReceiptAuthority: visibility.bankReceiptAuthority === true,
      ownerOutgoingPaymentFacts: visibility.ownerOutgoingPaymentFacts === true,
      paymentBusinessAuthorityPresent: baseCapabilities.paymentBusinessAuthorityPresent === true && visibility.paymentBusinessAuthority === true,
      paymentBusinessAuthority: baseCapabilities.paymentBusinessAuthorityPresent === true && visibility.paymentBusinessAuthority === true,
      paymentBusinessAuthorityReady: baseCapabilities.paymentBusinessAuthorityReady === true && visibility.paymentBusinessAuthority === true,
      financeAuthority: baseCapabilities.financeAuthority === true && visibility.financeAuthority === true,
      resourceChain: baseCapabilities.resourceChain === true && visibility.resourceChain === true,
    },
  };
}

export function createAdminPaymentsV7TruthSourceReader(sql, options = {}) {
  if (typeof sql !== 'function' || typeof sql.begin !== 'function') throw new TypeError('POSTGRES_TRANSACTION_SQL_REQUIRED');
  const activateReadRole = options.activateReadRole || activateAdminPaymentsV7ReadRole;
  const createReadPort = options.createReadPort || createPostgresAdminPaymentsV7ReadPort;
  const inspectVisibility = options.inspectVisibility || inspectAdminPaymentsV7SourceVisibility;
  return () => sql.begin(ADMIN_PAYMENTS_V7_SNAPSHOT_OPTIONS, async (transactionSql) => {
    await activateReadRole(transactionSql);
    const visibility = await inspectVisibility(transactionSql);
    const port = guardedPort(createReadPort(transactionSql), visibility);
    const raw = await readAdminPaymentsV7RawSources(port);
    return decorateAdminPaymentsV7RawTruth(raw, visibility);
  });
}

export { ADMIN_PAYMENTS_V7_READ_ROLE, ADMIN_PAYMENTS_V7_SNAPSHOT_OPTIONS };
