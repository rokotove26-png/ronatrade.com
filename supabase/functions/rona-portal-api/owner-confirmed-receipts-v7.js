const CONTRACT = 'OWNER_CONFIRMED_RECEIPTS_V7';

function upper(value) {
  return String(value ?? '').trim().toUpperCase();
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function money(amount, currency, refs = []) {
  return {
    amount: String(amount),
    currency: upper(currency),
    status: 'AUTHORITATIVE',
    reason: null,
    authority_refs: refs,
  };
}

function addUniqueRefs(current = [], extra = []) {
  const map = new Map();
  for (const ref of [...(Array.isArray(current) ? current : []), ...(Array.isArray(extra) ? extra : [])]) {
    const key = `${ref?.source_type || ''}:${ref?.source_id || ref?.id || JSON.stringify(ref)}`;
    if (!map.has(key)) map.set(key, ref);
  }
  return [...map.values()];
}

function projectionFrom(payload) {
  return payload?.data?.paymentsV7Projection
    || payload?.data?.payments_v7_projection
    || payload?.paymentsV7Projection
    || null;
}

function alreadyReflected(deal, row) {
  const refs = deal?.verified_received?.authority_refs;
  if (!Array.isArray(refs)) return false;
  const ids = new Set([
    String(row?.payment_key || ''),
    String(row?.payment_id || ''),
    String(row?.allocation_id || ''),
    String(row?.attribution_id || ''),
  ].filter(Boolean));
  return refs.some((ref) => ids.has(String(ref?.source_id || ref?.id || '')));
}

function recomputeFinancialStatus(deal) {
  const total = finite(deal?.total_to_receive?.amount);
  const received = finite(deal?.verified_received?.amount);
  const due = finite(deal?.due_now?.amount);
  const expected = finite(deal?.expected_not_due?.amount);
  const future = finite(deal?.future_conditional?.amount);
  if ([total, received, due, expected, future].some((value) => value === null)) return 'TO_VERIFY';
  if (received > total + 0.000001) return 'OVERRECEIVED';
  if (Math.abs(total - received) <= 0.000001) return 'PAID';
  if (upper(deal?.finance_status) === 'OVERDUE') return 'OVERDUE';
  if (due > 0) return 'DUE';
  if (expected > 0) return 'EXPECTED';
  if (future > 0) return 'CONDITIONAL';
  return 'OPEN';
}

function markPendingDealsToVerify(payload, reason) {
  const projection = projectionFrom(payload);
  if (!projection || !Array.isArray(projection.deals)) return payload;
  for (const deal of projection.deals) {
    if (upper(deal?.documentary_status) !== 'BANK_STATEMENT_PENDING') continue;
    const currency = upper(deal?.accounting_currency?.currency || deal?.total_to_receive?.currency) || null;
    deal.verified_received = { amount: null, currency, status: 'TO_VERIFY', reason, authority_refs: [] };
    deal.remaining_to_receive = { amount: null, currency, status: 'TO_VERIFY', reason, authority_refs: [] };
    deal.payment_progress = { ratio: null, percent: null, status: 'TO_VERIFY', reason };
    deal.financial_status = 'TO_VERIFY';
  }
  projection.owner_confirmed_receipts_contract = CONTRACT;
  projection.owner_confirmed_receipts_status = 'TO_VERIFY';
  return payload;
}

function updateAggregates(projection, appliedByCurrency) {
  const verified = projection?.currency_aggregates?.verified_received;
  if (verified && Array.isArray(verified.groups)) {
    for (const [currency, delta] of appliedByCurrency.entries()) {
      let group = verified.groups.find((item) => upper(item?.currency) === currency);
      if (!group) {
        group = { currency, amount: '0', status: 'AUTHORITATIVE', completeness_status: 'COMPLETE', confirmed_deal_ids: [], unresolved_deal_ids: [] };
        verified.groups.push(group);
      }
      const current = finite(group.amount) ?? 0;
      group.amount = String(current + delta);
      group.status = 'AUTHORITATIVE';
    }
  }

  if (Array.isArray(projection?.funding_aggregate)) {
    for (const [currency, delta] of appliedByCurrency.entries()) {
      const group = projection.funding_aggregate.find((item) => upper(item?.currency) === currency);
      if (!group) continue;
      const current = finite(group.funding_received);
      if (current !== null) group.funding_received = String(current + delta);
    }
  }
}

export function applyOwnerConfirmedReceiptsToAdminProjection(payload, rows = []) {
  const projection = projectionFrom(payload);
  if (!projection || !Array.isArray(projection.deals) || !Array.isArray(rows) || !rows.length) return payload;

  const dealsById = new Map(projection.deals.map((deal) => [String(deal?.deal_id || ''), deal]));
  const appliedByCurrency = new Map();
  let applied = 0;

  for (const row of rows) {
    const deal = dealsById.get(String(row?.deal_id || ''));
    if (!deal || alreadyReflected(deal, row)) continue;

    const amount = finite(row?.amount);
    const currency = upper(row?.currency);
    const received = finite(deal?.verified_received?.amount);
    const receivedCurrency = upper(deal?.verified_received?.currency || deal?.accounting_currency?.currency || deal?.total_to_receive?.currency);
    if (amount === null || amount < 0 || !currency || received === null || receivedCurrency !== currency || upper(deal?.verified_received?.status) !== 'AUTHORITATIVE') {
      const reason = 'OWNER_CONFIRMED_RECEIPT_PROJECTION_RECONCILIATION_REQUIRED';
      deal.verified_received = { amount: null, currency: receivedCurrency || currency || null, status: 'TO_VERIFY', reason, authority_refs: deal?.verified_received?.authority_refs || [] };
      deal.remaining_to_receive = { amount: null, currency: receivedCurrency || currency || null, status: 'TO_VERIFY', reason, authority_refs: [] };
      deal.payment_progress = { ratio: null, percent: null, status: 'TO_VERIFY', reason };
      deal.financial_status = 'TO_VERIFY';
      continue;
    }

    const refs = [{
      source_type: 'OWNER_CONFIRMED_FINANCE_AI_V7',
      source_id: String(row.payment_key),
      source_version: row.source_version || 'OWNER_CONFIRMED_RECEIPT_V1',
      source_timestamp: row.source_timestamp || null,
      authority_state: row.authority_state || 'CONFIRMED',
      lifecycle_state: row.lifecycle_state || 'ACTIVE',
    }, {
      source_type: 'PAYMENT_ALLOCATION',
      source_id: String(row.allocation_id),
      source_version: row.allocation_source_version || row.source_version || 'OWNER_CONFIRMED_RECEIPT_V1',
      source_timestamp: row.allocation_source_timestamp || row.source_timestamp || null,
      authority_state: row.allocation_authority_state || 'CONFIRMED',
      lifecycle_state: row.allocation_lifecycle_state || 'ACTIVE',
    }];

    const nextReceived = received + amount;
    const receivedRefs = addUniqueRefs(deal?.verified_received?.authority_refs, refs);
    deal.verified_received = money(nextReceived, currency, receivedRefs);

    const total = finite(deal?.total_to_receive?.amount);
    if (total !== null && upper(deal?.total_to_receive?.status) === 'AUTHORITATIVE' && upper(deal?.total_to_receive?.currency) === currency) {
      deal.remaining_to_receive = money(total - nextReceived, currency, addUniqueRefs(deal?.total_to_receive?.authority_refs, receivedRefs));
      if (total > 0) {
        const ratio = nextReceived / total;
        deal.payment_progress = { ratio: String(ratio), percent: String(ratio * 100), status: 'AUTHORITATIVE', reason: null };
      }
    }

    if (deal?.payment_passport && typeof deal.payment_passport === 'object') {
      deal.payment_passport.funding_received = deal.verified_received;
      if (upper(deal?.remaining_execution?.status) === 'AUTHORITATIVE') deal.payment_passport.funding_remaining = deal.remaining_execution;
    }

    deal.authority_refs = addUniqueRefs(deal.authority_refs, refs);
    deal.owner_confirmed_receipt_status = 'BANK_STATEMENT_PENDING';
    deal.financial_status = recomputeFinancialStatus(deal);
    appliedByCurrency.set(currency, (appliedByCurrency.get(currency) || 0) + amount);
    applied += 1;
  }

  updateAggregates(projection, appliedByCurrency);
  projection.owner_confirmed_receipts_contract = CONTRACT;
  projection.owner_confirmed_receipts_status = applied ? 'AUTHORITATIVE' : (projection.owner_confirmed_receipts_status || 'NO_PENDING_RECEIPTS');
  projection.owner_confirmed_receipts_applied = applied;
  return payload;
}

export async function projectAdminOwnerConfirmedReceiptsV7(req, response, { sql, apiRoute }) {
  let payload = null;
  try {
    const url = new URL(req.url);
    const route = apiRoute(url);
    if (req.method !== 'GET' || route !== '/v1/admin/bootstrap' || !response.ok || !(response.headers.get('content-type') || '').includes('application/json')) return response;
    payload = await response.clone().json();
    const projection = projectionFrom(payload);
    const deals = Array.isArray(projection?.deals) ? projection.deals : [];
    const dealIds = [...new Set(deals.map((deal) => String(deal?.deal_id || '').trim()).filter(Boolean))];
    if (!dealIds.length) return response;

    const rows = await sql`
      select d.deal_id,
             p.id::text as payment_key,
             p.payment_id,
             p.amount,
             trim(p.currency::text) as currency,
             p.source_version,
             p.source_timestamp,
             p.authority_state::text as authority_state,
             p.lifecycle_state::text as lifecycle_state,
             pa.id::text as allocation_id,
             pa.source_version as allocation_source_version,
             pa.source_timestamp as allocation_source_timestamp,
             pa.authority_state::text as allocation_authority_state,
             pa.lifecycle_state::text as allocation_lifecycle_state
        from portal_private.payments p
        join portal_private.payment_allocations pa on pa.payment_key=p.id
        join portal_private.deals d on d.id=pa.deal_key
       where d.deal_id in (select value from jsonb_array_elements_text(${sql.json(dealIds)}::jsonb))
         and p.payment_direction::text='INCOMING'
         and p.payment_kind::text='CLIENT_PAYMENT'
         and p.bank_fact_status::text='RECEIVED_UNVERIFIED'
         and p.finance_verification_status::text='VERIFIED'
         and p.source_system='OWNER_CONFIRMED_FINANCE_AI_V7'
         and p.authority_state::text in ('VERIFIED','CONFIRMED')
         and p.lifecycle_state::text='ACTIVE'
         and pa.allocation_status::text in ('ALLOCATED','VERIFIED')
         and pa.source_system='OWNER_CONFIRMED_FINANCE_AI_V7'
         and pa.authority_state::text in ('VERIFIED','CONFIRMED')
         and pa.lifecycle_state::text='ACTIVE'
       order by d.deal_id,p.payment_at,p.payment_id,pa.id
    `;

    if (!rows.length) return response;
    applyOwnerConfirmedReceiptsToAdminProjection(payload, rows);
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('content-type', 'application/json; charset=utf-8');
    headers.set('cache-control', 'no-store');
    headers.set('x-rona-owner-confirmed-receipts-v7', `${CONTRACT}:authoritative`);
    return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    console.error('OWNER_CONFIRMED_RECEIPTS_V7_FAIL', error);
    if (!payload) return response;
    markPendingDealsToVerify(payload, 'OWNER_CONFIRMED_RECEIPT_PROJECTION_ERROR');
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('content-type', 'application/json; charset=utf-8');
    headers.set('cache-control', 'no-store');
    headers.set('x-rona-owner-confirmed-receipts-v7', `${CONTRACT}:fail-closed`);
    return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers });
  }
}
