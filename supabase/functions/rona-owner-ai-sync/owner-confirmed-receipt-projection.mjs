import {
  decimalAdd,
  decimalCompare,
  decimalDivide,
  decimalMulInteger,
  decimalSub,
  decimalToString,
  parseDecimal,
} from '../_shared/admin-payments-v7/decimal.mjs';
import { moneyValue } from '../_shared/admin-payments-v7/money.mjs';
import {
  buildConfirmedFundingAggregate,
  buildPaymentsCurrencyAggregates,
} from '../_shared/admin-payments-v7/confirmed-funding-aggregate.mjs';

export const OWNER_CONFIRMED_RECEIPT_PROJECTION_VERSION = 'OWNER_CONFIRMED_RECEIPT_PROJECTION_V1';
const OWNER_SOURCE_SYSTEM = 'OWNER_CONFIRMED_FINANCE_AI_V7';
const OWNER_SOURCE_VERSION = 'OWNER_CONFIRMED_RECEIPT_V1';
const OWNER_EVENT_TYPE = 'OWNER_CONFIRMED_RECEIPT_MATERIALIZED';

function text(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function upper(value) { return text(value).toUpperCase(); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function canonicalAmount(value) { return decimalToString(parseDecimal(String(value))); }

function ownerReceiptRef(row) {
  return {
    source_type: 'OWNER_CONFIRMED_RECEIPT',
    source_id: text(row.payment_id),
    source_version: text(row.source_version) || OWNER_SOURCE_VERSION,
    source_timestamp: row.source_timestamp || null,
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
  };
}

function ownerEventRef(row) {
  return {
    source_type: 'FINANCE_EVENT',
    source_id: text(row.finance_event_id),
    source_version: text(row.event_source_version) || OWNER_SOURCE_VERSION,
    source_timestamp: row.event_source_timestamp || null,
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
  };
}

function refTokens(refs) {
  const tokens = new Set();
  for (const ref of asArray(refs)) {
    if (!ref || typeof ref !== 'object') continue;
    const id = text(ref.source_id || ref.id);
    if (id) tokens.add(id);
  }
  return tokens;
}

function uniqueRefs(refs) {
  const seen = new Set();
  return asArray(refs).filter((ref) => {
    const key = JSON.stringify(ref || null);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function authoritativeMoney(value, currency) {
  return Boolean(
    value
    && upper(value.status) === 'AUTHORITATIVE'
    && value.amount !== null
    && value.amount !== undefined
    && upper(value.currency) === currency,
  );
}

function groupedByDeal(rows) {
  const grouped = new Map();
  for (const row of asArray(rows)) {
    const dealKey = text(row?.deal_key);
    const paymentKey = text(row?.payment_key);
    const paymentId = text(row?.payment_id);
    const eventId = text(row?.finance_event_id);
    const currency = upper(row?.currency);
    if (!dealKey || !paymentKey || !paymentId || !eventId || !currency || !/^[A-Z]{3}$/.test(currency)) continue;
    let amount;
    try { amount = canonicalAmount(row.amount); } catch { continue; }
    if (decimalCompare(amount, '0') <= 0) continue;
    if (!grouped.has(dealKey)) grouped.set(dealKey, []);
    grouped.get(dealKey).push({ ...row, amount, currency });
  }
  return grouped;
}

function applyDealReceipts(deal, rows) {
  if (!deal || !rows?.length) return deal;
  const baseReceived = deal.verified_received;
  const currency = upper(baseReceived?.currency || deal?.accounting_currency?.currency || deal?.total_to_receive?.currency);
  if (!currency || !authoritativeMoney(baseReceived, currency)) return deal;

  const existingRefs = refTokens(baseReceived.authority_refs);
  const unapplied = rows.filter((row) => !existingRefs.has(text(row.payment_id))
    && !existingRefs.has(text(row.payment_key))
    && !existingRefs.has(text(row.finance_event_id)));
  if (!unapplied.length) return deal;
  if (unapplied.some((row) => row.currency !== currency)) return deal;

  let received = parseDecimal(baseReceived.amount);
  const refs = [...asArray(baseReceived.authority_refs)];
  for (const row of unapplied) {
    received = decimalAdd(received, row.amount);
    refs.push(ownerReceiptRef(row), ownerEventRef(row));
  }
  const receivedAmount = decimalToString(received);
  const receivedMoney = moneyValue(receivedAmount, currency, 'AUTHORITATIVE', null, uniqueRefs(refs));

  let remaining = deal.remaining_to_receive;
  let progress = deal.payment_progress;
  let financialStatus = deal.financial_status;
  const total = deal.total_to_receive;
  if (authoritativeMoney(total, currency)) {
    const remainingAmount = decimalToString(decimalSub(total.amount, receivedAmount));
    remaining = moneyValue(remainingAmount, currency, 'AUTHORITATIVE', null, uniqueRefs([...(total.authority_refs || []), ...(receivedMoney.authority_refs || [])]));
    if (decimalCompare(total.amount, '0') > 0) {
      const ratio = decimalDivide(receivedAmount, total.amount, 12);
      progress = {
        ratio: decimalToString(ratio),
        percent: decimalToString(decimalMulInteger(ratio, 100)),
        status: 'AUTHORITATIVE',
        reason: null,
      };
    }
    if (decimalCompare(receivedAmount, total.amount) > 0) financialStatus = 'OVERRECEIVED';
    else if (decimalCompare(remainingAmount, '0') === 0) financialStatus = 'PAID';
  }

  const passport = deal.payment_passport
    ? {
        ...deal.payment_passport,
        funding_received: receivedMoney,
        authority_refs: uniqueRefs([...(deal.payment_passport.authority_refs || []), ...receivedMoney.authority_refs]),
      }
    : deal.payment_passport;

  return {
    ...deal,
    verified_received: receivedMoney,
    remaining_to_receive: remaining,
    payment_progress: progress,
    financial_status: financialStatus,
    payment_passport: passport,
    authority_refs: uniqueRefs([...(deal.authority_refs || []), ...receivedMoney.authority_refs]),
    owner_confirmed_receipt_authority: {
      status: 'AUTHORITATIVE',
      source: OWNER_SOURCE_SYSTEM,
      receipt_count: unapplied.length,
    },
  };
}

export async function readOwnerConfirmedReceiptsV7(sql, sourceAsOf = null) {
  if (typeof sql !== 'function') throw new TypeError('POSTGRES_SQL_REQUIRED');
  const cutoff = sourceAsOf ? String(sourceAsOf) : null;
  const rows = await sql`
    select
      p.id::text as payment_key,
      p.payment_id,
      p.amount::text as amount,
      trim(p.currency::text) as currency,
      p.source_version,
      p.source_timestamp,
      pa.id::text as allocation_id,
      pa.deal_key::text as deal_key,
      d.deal_id,
      e.id::text as finance_event_id,
      e.source_version as event_source_version,
      e.source_timestamp as event_source_timestamp
    from portal_private.payments p
    join portal_private.payment_allocations pa
      on pa.payment_key=p.id
     and pa.lifecycle_state::text='ACTIVE'
     and pa.authority_state::text in ('VERIFIED','CONFIRMED')
     and pa.allocation_status::text='ALLOCATED'
     and pa.source_system=${OWNER_SOURCE_SYSTEM}
     and pa.source_version=${OWNER_SOURCE_VERSION}
     and pa.allocated_amount=p.amount
    join portal_private.deals d
      on d.id=pa.deal_key
     and d.lifecycle_state::text='ACTIVE'
     and d.authority_state::text in ('VERIFIED','CONFIRMED')
    join lateral (
      select fe.id,fe.source_version,fe.source_timestamp
      from portal_private.finance_events_v7 fe
      where fe.payment_key=p.id
        and fe.event_type=${OWNER_EVENT_TYPE}
        and fe.actor_id='AI-FINANCE'
        and fe.actor_role='FINANCE'
        and coalesce((fe.result_snapshot->>'accepted')::boolean,false)=true
        and fe.result_snapshot->>'receipt_authority'='OWNER_CONFIRMED'
      order by fe.created_at desc,fe.id desc
      limit 1
    ) e on true
    where p.lifecycle_state::text='ACTIVE'
      and p.authority_state::text in ('VERIFIED','CONFIRMED')
      and p.payment_direction::text='INCOMING'
      and p.payment_kind::text='CLIENT_PAYMENT'
      and p.bank_fact_status::text='RECEIVED_UNVERIFIED'
      and p.finance_verification_status::text='VERIFIED'
      and p.source_system=${OWNER_SOURCE_SYSTEM}
      and p.source_version=${OWNER_SOURCE_VERSION}
      and (${cutoff}::timestamptz is null or (
        p.source_timestamp<=${cutoff}::timestamptz
        and pa.source_timestamp<=${cutoff}::timestamptz
        and e.source_timestamp<=${cutoff}::timestamptz
      ))
      and 1=(
        select count(*)
        from portal_private.payment_allocations x
        where x.payment_key=p.id
          and x.lifecycle_state::text='ACTIVE'
          and x.authority_state::text in ('VERIFIED','CONFIRMED')
          and x.source_system=${OWNER_SOURCE_SYSTEM}
          and x.source_version=${OWNER_SOURCE_VERSION}
      )
      and 1=(
        select count(*)
        from portal_private.finance_events_v7 fx
        where fx.payment_key=p.id
          and fx.event_type=${OWNER_EVENT_TYPE}
          and fx.actor_id='AI-FINANCE'
          and fx.actor_role='FINANCE'
          and coalesce((fx.result_snapshot->>'accepted')::boolean,false)=true
          and fx.result_snapshot->>'receipt_authority'='OWNER_CONFIRMED'
      )
    order by d.deal_id,p.payment_at,p.payment_id`;
  return asArray(rows);
}

export function applyOwnerConfirmedReceiptsV7(projection, receiptRows = []) {
  if (!projection || projection.contract !== 'ADMIN_PAYMENTS_V7') throw new Error('ADMIN_PAYMENTS_V7_PROJECTION_REQUIRED');
  const grouped = groupedByDeal(receiptRows);
  if (!grouped.size) {
    return {
      ...projection,
      owner_confirmed_receipt_projection: {
        version: OWNER_CONFIRMED_RECEIPT_PROJECTION_VERSION,
        status: 'AUTHORITATIVE_EMPTY',
        receipt_count: 0,
      },
    };
  }

  const deals = asArray(projection.deals).map((deal) => applyDealReceipts(deal, grouped.get(String(deal.deal_key)) || []));
  const matched = new Set(deals.filter((deal) => deal?.owner_confirmed_receipt_authority?.status === 'AUTHORITATIVE').map((deal) => String(deal.deal_key)));
  const unmatched = [...grouped.keys()].filter((dealKey) => !matched.has(String(dealKey)));

  return {
    ...projection,
    deals,
    payment_passports: deals.map((deal) => deal.payment_passport).filter(Boolean),
    funding_aggregate: buildConfirmedFundingAggregate(deals),
    currency_aggregates: buildPaymentsCurrencyAggregates(deals),
    owner_confirmed_receipt_projection: {
      version: OWNER_CONFIRMED_RECEIPT_PROJECTION_VERSION,
      status: unmatched.length ? 'PARTIAL_TO_VERIFY' : 'AUTHORITATIVE',
      receipt_count: asArray(receiptRows).length,
      matched_deal_count: matched.size,
      unmatched_deal_keys: unmatched,
    },
  };
}
