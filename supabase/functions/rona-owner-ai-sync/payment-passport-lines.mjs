export const PAYMENT_PASSPORT_LINES_CONTRACT = 'ADMIN_PAYMENTS_V7_PAYMENT_PASSPORT_LINES_V1';
export const PAYMENT_PASSPORT_LINES_READ_ROLE = 'rona_payments_v7_reader';
export const PAYMENT_PASSPORT_LINES_SNAPSHOT_OPTIONS = 'isolation level repeatable read read only';

function text(value) { return String(value ?? '').trim(); }
function upper(value) { return text(value).toUpperCase(); }

export function normalizePaymentPassportLines(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const status = upper(row?.line_status) === 'AUTHORITATIVE' ? 'AUTHORITATIVE' : 'TO_VERIFY';
    return {
      deal_id: text(row?.deal_id) || null,
      payment_id: text(row?.payment_id) || null,
      payment_at: row?.payment_at ?? null,
      row_type: upper(row?.payment_kind) === 'BANK_FEE' ? 'COMMISSION' : 'EXPENSE',
      recipient: text(row?.recipient) || null,
      purpose: text(row?.original_payment_purpose) || null,
      native_amount: row?.attributed_amount === null || row?.attributed_amount === undefined ? null : text(row.attributed_amount),
      native_currency: upper(row?.attributed_currency) || null,
      deal_equivalent_amount: status === 'AUTHORITATIVE' && row?.accounting_amount !== null && row?.accounting_amount !== undefined ? text(row.accounting_amount) : null,
      deal_equivalent_currency: status === 'AUTHORITATIVE' ? (upper(row?.accounting_currency) || null) : null,
      conversion_source_basis: status === 'AUTHORITATIVE' ? (upper(row?.conversion_source_basis) || null) : null,
      bank_transaction_reference: text(row?.bank_transaction_reference) || null,
      bank_account_reference: text(row?.bank_account_reference) || null,
      bank_statement_date: row?.bank_statement_date ?? null,
      status,
      reason: status === 'AUTHORITATIVE' ? null : (text(row?.line_reason) || 'PAYMENT_PASSPORT_LINE_TO_VERIFY'),
    };
  });
}

export function createPaymentPassportLinesReader(sql, options = {}) {
  if (typeof sql !== 'function' || typeof sql.begin !== 'function') throw new TypeError('POSTGRES_TRANSACTION_SQL_REQUIRED');
  const readRole = options.readRole || PAYMENT_PASSPORT_LINES_READ_ROLE;
  return () => sql.begin(PAYMENT_PASSPORT_LINES_SNAPSHOT_OPTIONS, async (transactionSql) => {
    if (readRole === PAYMENT_PASSPORT_LINES_READ_ROLE) await transactionSql`set local role rona_payments_v7_reader`;
    else throw new Error('PAYMENT_PASSPORT_LINES_READ_ROLE_INVALID');

    const rows = await transactionSql`
      with current_finance as (
        select a.id, a.payment_key,
               count(*) over (partition by a.payment_key) as current_finance_claims
        from portal_private.payment_business_attributions_v7 a
        where a.source_locked = true
          and upper(coalesce(a.authority_state::text,'')) = 'AUTHORITATIVE'
          and upper(coalesce(a.lifecycle_state::text,'')) = 'CURRENT'
          and upper(coalesce(a.attribution_mode,'')) = 'EXACT'
          and replace(upper(coalesce(a.authority_kind,'')), '_', '-') in ('FINANCE','FINANCE-AI','AI-FINANCE')
      ), finance_lines as (
        select cf.id attribution_id, cf.payment_key, l.deal_key, l.amount, l.currency
        from current_finance cf
        join portal_private.payment_business_attribution_lines_v7 l on l.attribution_id = cf.id
        where cf.current_finance_claims = 1
          and upper(coalesce(l.amount_status,'')) = 'EXACT'
          and l.deal_key is not null
          and l.amount is not null
      )
      select d.deal_id,
             p.payment_id, p.payment_at, p.payment_kind::text payment_kind,
             coalesce(nullif(p.beneficiary_name,''), nullif(p.counterparty_name,'')) recipient,
             p.original_payment_purpose,
             p.bank_transaction_reference, p.bank_account_reference, p.bank_statement_date,
             fl.amount::text attributed_amount, fl.currency attributed_currency,
             case
               when cc.chain_count = 0 then null
               when cc.chain_count <> 1 then null
               when c.native_amount is distinct from fl.amount then null
               when upper(trim(c.native_currency)) is distinct from upper(trim(fl.currency)) then null
               when c.accounting_amount is null or nullif(trim(c.accounting_currency),'') is null then null
               else c.accounting_amount::text
             end accounting_amount,
             case
               when cc.chain_count = 1
                and c.native_amount is not distinct from fl.amount
                and upper(trim(c.native_currency)) is not distinct from upper(trim(fl.currency))
                and c.accounting_amount is not null
                and nullif(trim(c.accounting_currency),'') is not null
               then c.accounting_currency
               else null
             end accounting_currency,
             case
               when cc.chain_count = 1
                and c.native_amount is not distinct from fl.amount
                and upper(trim(c.native_currency)) is not distinct from upper(trim(fl.currency))
                and c.accounting_amount is not null
                and nullif(trim(c.accounting_currency),'') is not null
               then c.conversion_source_basis
               else null
             end conversion_source_basis,
             case
               when cc.chain_count = 0 then 'TO_VERIFY'
               when cc.chain_count <> 1 then 'TO_VERIFY'
               when c.native_amount is distinct from fl.amount
                 or upper(trim(c.native_currency)) is distinct from upper(trim(fl.currency)) then 'TO_VERIFY'
               when c.accounting_amount is null or nullif(trim(c.accounting_currency),'') is null then 'TO_VERIFY'
               else 'AUTHORITATIVE'
             end line_status,
             case
               when cc.chain_count = 0 then 'EXACT_RESOURCE_CHAIN_MISSING'
               when cc.chain_count <> 1 then 'RESOURCE_CHAIN_AUTHORITY_CONFLICT'
               when c.native_amount is distinct from fl.amount
                 or upper(trim(c.native_currency)) is distinct from upper(trim(fl.currency)) then 'RESOURCE_CHAIN_SCOPE_MISMATCH'
               when c.accounting_amount is null or nullif(trim(c.accounting_currency),'') is null then 'EXACT_RESOURCE_CHAIN_MISSING'
               else null
             end line_reason
      from finance_lines fl
      join portal_private.payments p on p.id = fl.payment_key
      join portal_private.deals d on d.id = fl.deal_key
      left join lateral (
        select rc.native_amount, rc.native_currency, rc.accounting_amount, rc.accounting_currency,
               rc.conversion_source_basis
        from portal_private.payment_resource_chains_v7 rc
        where rc.payment_key = fl.payment_key
          and rc.deal_key = fl.deal_key
          and rc.source_locked = true
          and upper(coalesce(rc.authority_state::text,'')) = 'AUTHORITATIVE'
          and upper(coalesce(rc.lifecycle_state::text,'')) = 'CURRENT'
        order by rc.id
        limit 1
      ) c on true
      left join lateral (
        select count(*)::int chain_count
        from portal_private.payment_resource_chains_v7 rc
        where rc.payment_key = fl.payment_key
          and rc.deal_key = fl.deal_key
          and rc.source_locked = true
          and upper(coalesce(rc.authority_state::text,'')) = 'AUTHORITATIVE'
          and upper(coalesce(rc.lifecycle_state::text,'')) = 'CURRENT'
      ) cc on true
      where p.lifecycle_state::text = 'ACTIVE'
        and p.authority_state::text in ('VERIFIED','CONFIRMED')
        and p.bank_fact_status::text = 'BANK_CONFIRMED'
        and upper(coalesce(p.finance_verification_status::text,p.finance_status::text,'')) in ('VERIFIED','PAID','CONFIRMED')
        and p.payment_direction::text = 'OUTGOING'
        and p.payment_kind::text <> 'FX_CONVERSION'
        and d.lifecycle_state::text <> 'ARCHIVED'
      order by d.deal_id, p.payment_at, p.payment_id`;

    return normalizePaymentPassportLines(rows);
  });
}
