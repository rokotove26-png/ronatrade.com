-- Read-only production acceptance for System Admin HOLD #629.
-- Expected production scope: 2026-08-01..2026-09-17.

do $$
declare
  v_count int;
  v_amount numeric;
  v_ids int;
  v_id text;
  v_max numeric;
begin
  select count(*) into v_count
  from portal_private.finance_cash_operations_identity_v1
  where operation_date between date '2026-08-01' and date '2026-09-17'
    and canonical_counterparty_id like 'PAYMENT:%';
  if v_count <> 0 then
    raise exception 'HOLD629_PAYMENT_CANONICAL_ID count=%',v_count;
  end if;

  select count(*) into v_count
  from portal_private.finance_cash_operations_identity_v1
  where operation_date between date '2026-08-01' and date '2026-09-17'
    and canonical_counterparty_id is not null
    and canonical_counterparty_id !~ '^(CLIENT|SUPPLIER|COUNTERPARTY|BANK):';
  if v_count <> 0 then
    raise exception 'HOLD629_INVALID_ENTITY_PREFIX count=%',v_count;
  end if;

  select count(*) into v_count
  from (
    select canonical_counterparty_name,currency
    from portal_private.finance_cash_operations_identity_v1
    where operation_date between date '2026-08-01' and date '2026-09-17'
      and canonical_counterparty_name is not null
    group by canonical_counterparty_name,currency
    having count(distinct canonical_counterparty_id)>1
  ) q;
  if v_count <> 0 then
    raise exception 'HOLD629_DUPLICATE_CANONICAL_NAME_CURRENCY count=%',v_count;
  end if;

  select count(*),sum(amount),count(distinct canonical_counterparty_id),min(canonical_counterparty_id)
    into v_count,v_amount,v_ids,v_id
  from portal_private.finance_cash_operations_identity_v1
  where operation_date between date '2026-08-01' and date '2026-09-17'
    and canonical_counterparty_name='ЧПТУП «КУЗМАШ»'
    and currency='RUB';
  if v_count<>4 or v_amount<>28524960 or v_ids<>1 or v_id<>'SUPPLIER:S-009' then
    raise exception 'HOLD629_KUZMASH_FAIL ops=% amount=% ids=% id=%',v_count,v_amount,v_ids,v_id;
  end if;

  select count(*),sum(amount),count(distinct canonical_counterparty_id),min(canonical_counterparty_id)
    into v_count,v_amount,v_ids,v_id
  from portal_private.finance_cash_operations_identity_v1
  where operation_date between date '2026-08-01' and date '2026-09-17'
    and canonical_counterparty_name='Совместное предприятие Общество с ограниченной ответственностью «UNVERSAL SOLYARIS GRAND»'
    and currency='USD';
  if v_count<>2 or v_amount<>251070 or v_ids<>1 or v_id<>'CLIENT:RONA-C003' then
    raise exception 'HOLD629_UNIVERSAL_FAIL ops=% amount=% ids=% id=%',v_count,v_amount,v_ids,v_id;
  end if;

  select count(*) into v_count from portal_private.finance_cash_operations_current_v1;
  if v_count<>43 then raise exception 'HOLD629_OPERATION_COUNT %',v_count; end if;

  select count(distinct operation_fingerprint) into v_count from portal_private.finance_cash_operations_current_v1;
  if v_count<>43 then raise exception 'HOLD629_FINGERPRINT_COUNT %',v_count; end if;

  select max(abs(balance_check)) into v_max from portal_private.finance_cash_daily_summary_v1;
  if coalesce(v_max,0)<>0 then raise exception 'HOLD629_BALANCE_DIFF %',v_max; end if;

  select count(*) into v_count
  from portal_private.finance_cash_statement_checkpoint_audit_v2
  where checkpoint_status='PASS';
  if v_count<>20 then raise exception 'HOLD629_CHECKPOINT_PASS_COUNT %',v_count; end if;

  select max(abs(ledger_checkpoint_difference)) into v_max
  from portal_private.finance_cash_statement_checkpoint_audit_v2;
  if coalesce(v_max,0)<>0 then raise exception 'HOLD629_CHECKPOINT_DIFF %',v_max; end if;

  if (select (array_agg(closing_balance order by operation_date desc))[1]
      from portal_private.finance_cash_daily_summary_v1 where currency='KZT') <> 0.91
  then raise exception 'HOLD629_KZT_CLOSING_CHANGED'; end if;

  if (select (array_agg(closing_balance order by operation_date desc))[1]
      from portal_private.finance_cash_daily_summary_v1 where currency='RUB') <> 1756237.63
  then raise exception 'HOLD629_RUB_CLOSING_CHANGED'; end if;

  if (select (array_agg(closing_balance order by operation_date desc))[1]
      from portal_private.finance_cash_daily_summary_v1 where currency='USD') <> 231557.04
  then raise exception 'HOLD629_USD_CLOSING_CHANGED'; end if;
end
$$;
