import { buildAdminPaymentsV7FromRawSources } from '../_shared/admin-payments-v7/index.mjs';
import { createAdminPaymentsV7TruthSourceReader } from '../rona-owner-ai-sync/admin-payments-v7-source-reader-truth.mjs';
import {
  applyOwnerConfirmedReceiptsV7,
  readOwnerConfirmedReceiptsV7,
} from '../rona-owner-ai-sync/owner-confirmed-receipt-projection.mjs';
import { applyFinanceAuthorityProjectionV8 } from '../rona-owner-ai-sync/finance-authority-projection-v8.mjs';

export const ADMIN_PAYMENTS_V8_BOOTSTRAP_CONTRACT = 'ADMIN_PAYMENTS_V8_BOOTSTRAP_PROJECTION_V1';

async function readPaymentsV8FinanceAuthorities(sql) {
  return sql`
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

export async function readAdminPaymentsV8Projection(sql) {
  if (typeof sql !== 'function' || typeof sql.begin !== 'function') throw new TypeError('POSTGRES_TRANSACTION_SQL_REQUIRED');
  const readBaseRawSources = createAdminPaymentsV7TruthSourceReader(sql);
  const raw = await readBaseRawSources();
  const [ownerConfirmedReceipts, dealFinanceAuthorities] = await Promise.all([
    readOwnerConfirmedReceiptsV7(sql, raw?.sourceAsOf || null),
    readPaymentsV8FinanceAuthorities(sql),
  ]);
  const completeRaw = { ...raw, ownerConfirmedReceipts, dealFinanceAuthorities };
  const base = buildAdminPaymentsV7FromRawSources(completeRaw);
  const receipts = applyOwnerConfirmedReceiptsV7(base, ownerConfirmedReceipts);
  const projection = applyFinanceAuthorityProjectionV8(receipts, dealFinanceAuthorities);
  if (!projection || projection.contract !== 'ADMIN_PAYMENTS_V7' || !Array.isArray(projection.deals)) {
    throw new Error('ADMIN_PAYMENTS_V8_BOOTSTRAP_PROJECTION_INVALID');
  }
  return projection;
}

function jsonResponse(base, payload, state) {
  const headers = new Headers(base.headers);
  headers.delete('content-length');
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-rona-admin-payments-v8-bootstrap', `${ADMIN_PAYMENTS_V8_BOOTSTRAP_CONTRACT}:${state}`);
  return new Response(JSON.stringify(payload), { status: base.status, statusText: base.statusText, headers });
}

function failureResponse(base, code) {
  const headers = new Headers(base.headers);
  headers.delete('content-length');
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-rona-admin-payments-v8-bootstrap', `${ADMIN_PAYMENTS_V8_BOOTSTRAP_CONTRACT}:fail-closed`);
  return new Response(JSON.stringify({
    ok: false,
    code,
    component: 'ADMIN_PAYMENTS_V8_BOOTSTRAP',
  }), { status: 502, headers });
}

export function createAdminPaymentsV8BootstrapProjector({ sql, apiRoute, readProjection = readAdminPaymentsV8Projection, logger = console } = {}) {
  if (typeof apiRoute !== 'function') throw new TypeError('API_ROUTE_REQUIRED');
  if (typeof readProjection !== 'function') throw new TypeError('ADMIN_PAYMENTS_V8_PROJECTION_READER_REQUIRED');
  return async function projectAdminPaymentsV8Bootstrap(req, response) {
    const route = apiRoute(new URL(req.url));
    if (req.method !== 'GET' || route !== '/v1/admin/bootstrap' || !response.ok || !(response.headers.get('content-type') || '').includes('application/json')) return response;
    let payload;
    try {
      payload = await response.clone().json();
      const projection = await readProjection(sql);
      if (!projection || projection.contract !== 'ADMIN_PAYMENTS_V7' || !Array.isArray(projection.deals)) {
        throw new Error('ADMIN_PAYMENTS_V8_BOOTSTRAP_PROJECTION_INVALID');
      }
      if (!payload?.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) payload = { ...(payload || {}), data: {} };
      payload.data.paymentsV7Projection = projection;
      payload.data.payments_v8_projection_contract = ADMIN_PAYMENTS_V8_BOOTSTRAP_CONTRACT;
      return jsonResponse(response, payload, 'authoritative');
    } catch (error) {
      logger.error?.('ADMIN_PAYMENTS_V8_BOOTSTRAP_PROJECTION_FAIL', error);
      return failureResponse(response, String(error?.message || 'ADMIN_PAYMENTS_V8_BOOTSTRAP_PROJECTION_FAILURE'));
    }
  };
}
