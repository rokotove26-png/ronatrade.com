do $$
declare
  v_count int;
  v_amount numeric;
  v_reversed numeric;
  v_effective numeric;
  v_status text;
begin
  select count(*) into v_count from portal_private.finance_cash_operations_current_v1;
  if v_count<>43 then raise exception 'raw operation count changed: %',v_count; end if;

  select count(distinct operation_fingerprint) into v_count from portal_private.finance_cash_operations_current_v1;
  if v_count<>43 then raise exception 'raw fingerprint count changed: %',v_count; end if;

  select count(*) into v_count from portal_private.finance_cash_reversal_pairs_v1 where reversal_pair_status='MATCHED';
  if v_count<>6 then raise exception 'expected 6 matched reversals, got %',v_count; end if;

  select count(*) into v_count from portal_private.finance_cash_reversal_pairs_v1 where reversal_pair_status<>'MATCHED';
  if v_count<>0 then raise exception 'unresolved reversal pairs: %',v_count; end if;

  select count(*) into v_count
  from portal_private.finance_cash_reversal_pairs_v1
  where (reversal_bank_document_number,matched_original_bank_document_number) in
    (('2371994','2261853'),('2371992','2261857'),('2270386','2880741'),
     ('2270384','2880743'),('2026460','2313932'),('2026458','2313934'));
  if v_count<>6 then raise exception 'mandatory reversal pairs mismatch: %',v_count; end if;

  select gross_amount,reversed_amount,effective_external_payment_amount,effective_payment_status
    into v_amount,v_reversed,v_effective,v_status
  from portal_private.finance_cash_operations_effective_v1 where bank_document_number='2261853';
  if v_amount<>25444800 or v_reversed<>25444800 or v_effective<>0 or v_status<>'REVERSED'
    then raise exception 'ORIENT original mismatch %,%,%,%',v_amount,v_reversed,v_effective,v_status; end if;

  select effective_external_payment_amount,effective_payment_status into v_effective,v_status
  from portal_private.finance_cash_operations_effective_v1 where bank_document_number='1808256';
  if v_effective<>25444800 or v_status<>'SETTLED'
    then raise exception 'ORIENT success mismatch %,%',v_effective,v_status; end if;

  select sum(effective_external_payment_amount) into v_effective
  from portal_private.finance_cash_operations_effective_v1
  where canonical_counterparty_id='COUNTERPARTY:SGTRANS' and currency='RUB' and bank_fee=false and operation_type='EXTERNAL_PAYMENT';
  if v_effective<>5899358.90 then raise exception 'SGTRANS effective mismatch %',v_effective; end if;

  select sum(effective_external_payment_amount) into v_effective
  from portal_private.finance_cash_operations_effective_v1
  where canonical_counterparty_id='COUNTERPARTY:ORIENT_LOGISTIC' and currency='KZT' and bank_fee=false and operation_type='EXTERNAL_PAYMENT';
  if v_effective<>25444800 then raise exception 'ORIENT effective mismatch %',v_effective; end if;

  select effective_external_payment into v_effective from portal_private.finance_cash_effective_daily_v1
  where operation_date='2026-09-17' and currency='RUB';
  if v_effective<>8350000 then raise exception '17.09 RUB effective mismatch %',v_effective; end if;

  select effective_external_payment into v_effective from (
    select currency,sum(effective_external_payment) effective_external_payment
    from portal_private.finance_cash_effective_daily_v1
    where operation_date between '2026-08-01' and '2026-09-17'
    group by currency
  ) x where currency='RUB';
  if v_effective<>43226528.90 then raise exception 'full RUB effective mismatch %',v_effective; end if;

  select effective_external_payment into v_effective from (
    select currency,sum(effective_external_payment) effective_external_payment
    from portal_private.finance_cash_effective_daily_v1
    where operation_date between '2026-08-01' and '2026-09-17'
    group by currency
  ) x where currency='KZT';
  if v_effective<>25464800 then raise exception 'full KZT effective mismatch %',v_effective; end if;

  select count(*) into v_count from portal_private.finance_cash_statement_checkpoint_audit_v2 where checkpoint_status='PASS';
  if v_count<>20 then raise exception 'checkpoint PASS count changed %',v_count; end if;

  select max(abs(ledger_checkpoint_difference)) into v_amount from portal_private.finance_cash_statement_checkpoint_audit_v2;
  if v_amount<>0 then raise exception 'checkpoint difference %',v_amount; end if;

  select max(abs(balance_check)) into v_amount from portal_private.finance_cash_daily_summary_v1;
  if v_amount<>0 then raise exception 'daily balance difference %',v_amount; end if;

  select closing_balance into v_amount from portal_private.finance_cash_daily_summary_v1 where operation_date='2026-09-17' and currency='RUB';
  if v_amount<>1756237.63 then raise exception 'RUB closing changed %',v_amount; end if;
  select closing_balance into v_amount from portal_private.finance_cash_daily_summary_v1 where operation_date='2026-09-17' and currency='USD';
  if v_amount<>231557.04 then raise exception 'USD closing changed %',v_amount; end if;
  select closing_balance into v_amount from portal_private.finance_cash_daily_summary_v1 where operation_date='2026-09-17' and currency='KZT';
  if v_amount<>0.91 then raise exception 'KZT closing changed %',v_amount; end if;
end $$;
