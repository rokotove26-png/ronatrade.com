import { buildAdminPaymentsV7FromRawSources } from '../supabase/functions/_shared/admin-payments-v7/index.mjs';
import { createAdminPaymentsV7SourceReader } from '../supabase/functions/rona-owner-ai-sync/admin-payments-v7-source-reader.mjs';

export async function runAdminPaymentsV7RealReaderDryRun(sql) {
  const readRawSources = createAdminPaymentsV7SourceReader(sql);
  const raw = await readRawSources();
  const projection = buildAdminPaymentsV7FromRawSources(raw);
  if (!projection || projection.contract !== 'ADMIN_PAYMENTS_V7') throw new Error('ADMIN_PAYMENTS_V7_DRY_RUN_PROJECTION_INVALID');
  return {
    contract: projection.contract,
    source_as_of: projection.source_as_of,
    source_reader_contract: raw.sourceReaderContract,
    snapshot_contract: raw.snapshotContract,
    provider_presence: raw.providerPresence,
    capabilities: raw.capabilities,
    source_counts: {
      deals: raw.deals.length,
      workflows: raw.workflows.length,
      payments: raw.payments.length,
      payment_allocations: raw.paymentAllocations.length,
      payment_allocation_history: raw.paymentAllocationHistory.length,
      owner_outgoing_payment_facts: raw.ownerOutgoingPaymentFacts.length,
      payment_business_attributions: raw.paymentBusinessAttributions.length,
      payment_business_attribution_lines: raw.paymentBusinessAttributionLines.length,
      deal_finance_authorities: raw.dealFinanceAuthorities.length,
      resource_chains: raw.resourceChains.length,
    },
    projection_summary: projection.reconciliation_summary,
    owner_exception_queue_count: projection.owner_exception_queue.length,
    deal_states: projection.deals.map((deal) => ({
      deal_id: deal.deal_id,
      accounting_currency_status: deal.accounting_currency.status,
      verified_received_status: deal.verified_received.status,
      total_to_receive_status: deal.total_to_receive.status,
      actual_spend_status: deal.actual_spend_status,
      financial_status: deal.financial_status,
    })),
  };
}
