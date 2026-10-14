-- Isolated PostgreSQL fixture for the production read model. Never run on production.
\set ON_ERROR_STOP on
create role authenticated;
create role anon;
create schema portal_private;

create table portal_private.deals(id uuid primary key,deal_id text unique not null);
create table portal_private.ai_coordination_records(
  record_id uuid primary key,record_type text,functional_role text,target_type text,
  target_id text,status text,payload jsonb
);
create table portal_private.deal_finance_authority_payments_v8_read_v1(
  id uuid primary key,deal_key uuid,actual_spend numeric,remaining_execution numeric,
  execution_currency text,source_version text,effective_at timestamptz,created_at timestamptz,
  source_refs jsonb,source_locked boolean,authority_state text,lifecycle_state text,
  actual_spend_status text,remaining_execution_status text
);
create table portal_private.payment_resource_chains_effective_v8(
  deal_key uuid,payment_key uuid,source_locked boolean,accounting_amount numeric,
  accounting_currency text,native_amount numeric,native_currency text
);
create table portal_private.payments(
  id uuid primary key,payment_id text unique not null,counterparty_name text,
  payment_kind text,bank_fact_status text,finance_verification_status text,
  authority_state text,lifecycle_state text
);
create table portal_private.finance_counterparty_identities_v1(
  canonical_counterparty_id text,canonical_counterparty_name text,source_locked boolean,lifecycle_state text
);
create function portal_private.owner_r1_actor(p_role text) returns uuid
language sql as 'select ''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''::uuid';

insert into portal_private.deals values
 ('aaaaaaaa-0000-4000-8000-000000000005','DEAL-2026-005');
insert into portal_private.ai_coordination_records values
 ('27ccb442-f90a-473c-9cd9-ebdde92b6d7e','BUSINESS_CHANGE_PROPOSAL','FINANCE','DEAL','DEAL-2026-005','PROPOSED',
  '{"proposed_field":"agent_rewards.fact.dds_authority_v3","proposed_value":{"payment_ids":["OUT-2026-005006-KUZMASH","OUT-2026-005006-KUZMASH-FEE","PAYEV-2026-000023","PAYEV-2026-000024"]}}'::jsonb);

insert into portal_private.deal_finance_authority_payments_v8_read_v1 values
 ('aaaaaaaa-1000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000005',
  205794.90465892,466705.09534108,'USD','UID92_EXECUTION_RECONCILIATION_V1',
  '2026-09-25 11:20:18+00','2026-09-25 11:21:00+00','[]',true,
  'AUTHORITATIVE','CURRENT','AUTHORITATIVE','AUTHORITATIVE'),
 ('aaaaaaaa-1000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000005',
  577291.79996579,95208.20003421,'USD','UID96_EXECUTION_RECONCILIATION_V1',
  '2026-10-13 13:57:32+00','2026-10-13 13:59:00+00',
  '[{"source_type":"PAYMENT","source_id":"PAYEV-2026-000025"}]'::jsonb,true,
  'AUTHORITATIVE','CURRENT','AUTHORITATIVE','AUTHORITATIVE');

insert into portal_private.finance_counterparty_identities_v1 values
  ('SUPPLIER:S-009','ЧПТУП «КУЗМАШ»',true,'ACTIVE'),
  ('COUNTERPARTY:GARANT','ООО ГАРАНТ',true,'ACTIVE');

insert into portal_private.payments values
 ('bbbbbbbb-0000-4000-8000-000000000001','OUT-2026-005006-KUZMASH','ЧПТУП «КУЗМАШ»','COUNTERPARTY_PAYMENT','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE'),
 ('bbbbbbbb-0000-4000-8000-000000000002','OUT-2026-005006-KUZMASH-FEE','BAKAI Bank','BANK_FEE','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE'),
 ('bbbbbbbb-0000-4000-8000-000000000003','PAYEV-2026-000023','ООО ГАРАНТ','COUNTERPARTY_PAYMENT','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE'),
 ('bbbbbbbb-0000-4000-8000-000000000004','PAYEV-2026-000024','ОАО «БАКАЙ БАНК»','BANK_FEE','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE'),
 ('bbbbbbbb-0000-4000-8000-000000000005','PAYEV-2026-000025','ЧПТУП «КУЗМАШ»','COUNTERPARTY_PAYMENT','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE'),
 ('bbbbbbbb-0000-4000-8000-000000000006','PAYEV-2026-000026','ОАО «БАКАЙ БАНК»','BANK_FEE','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE');

insert into portal_private.payment_resource_chains_effective_v8 values
 ('aaaaaaaa-0000-4000-8000-000000000005','bbbbbbbb-0000-4000-8000-000000000001',true,162708.48000000,'USD',13229568,'RUB'),
 ('aaaaaaaa-0000-4000-8000-000000000005','bbbbbbbb-0000-4000-8000-000000000002',true,29.52000000,'USD',2400,'RUB'),
 ('aaaaaaaa-0000-4000-8000-000000000005','bbbbbbbb-0000-4000-8000-000000000003',true,43028.63800545,'USD',3630384,'RUB'),
 ('aaaaaaaa-0000-4000-8000-000000000005','bbbbbbbb-0000-4000-8000-000000000004',true,28.26665348,'USD',2400,'RUB'),
 ('aaaaaaaa-0000-4000-8000-000000000005','bbbbbbbb-0000-4000-8000-000000000005',true,371468.01444043,'USD',30868992,'RUB'),
 ('aaaaaaaa-0000-4000-8000-000000000005','bbbbbbbb-0000-4000-8000-000000000006',true,28.88086643,'USD',2400,'RUB');

create function public.rona_admin_agent_rewards_workspace_v13() returns jsonb
language sql as $$
select jsonb_build_object('deals',jsonb_build_array(
  jsonb_build_object(
    'dealId','DEAL-2026-005','financialCurrency','USD',
    'cashFlow',jsonb_build_object('status','APPROVED_CASH_FLOW_DDS','currency','USD',
      'cashReceived',672500,'counterpartyCashOut',205737.11800545,
      'bankFees',57.78665347,'totalCashOut',205794.90465892,
      'netCashFlow',466705.09534108,'realizedFxReference',5873.4),
    'cashFlowAuthority',jsonb_build_object('financeProposalRecordId','27ccb442-f90a-473c-9cd9-ebdde92b6d7e',
      'financeProposalCreatedAt','2026-10-07T09:53:25.224589Z'),
    'cashPaymentLines',jsonb_build_array(
      jsonb_build_object('paymentId','OUT-2026-005006-KUZMASH',
        'counterparty','ЧПТУП «КУЗМАШ»','amount',162708.48000000,'currency','USD',
        'source','SOURCE_LOCKED_PAYMENT_RESOURCE_CHAIN'),
      jsonb_build_object('paymentId','PAYEV-2026-000023',
        'counterparty','ООО ГАРАНТ','amount',43028.63800545,'currency','USD',
        'source','SOURCE_LOCKED_PAYMENT_RESOURCE_CHAIN'),
      jsonb_build_object('paymentId','PAYEV-2026-000025',
        'counterparty','ЧПТУП «КУЗМАШ»','amount',371468.01444043,'currency','USD',
        'source','SOURCE_LOCKED_PAYMENT_RESOURCE_CHAIN')
    ),
    'ownerResultBridge',jsonb_build_object('recognition_status','APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE',
      'open_settlement_adjustment',jsonb_build_object('amount',0),
      'actual_financial_result',jsonb_build_object('amount',466705.09534108)),
    'ownerCorrectionAuthority',jsonb_build_object(
      'status','APPROVED_FOR_OWNER_CORRECTION','contract','PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT')
  )
))
$$;
create function public.rona_admin_agent_rewards_correct_v7(
 p_deal_id text,p_assignment_id uuid,p_corrected_payload jsonb,p_note text,p_idempotency_key text)
returns jsonb language sql as $$
 select jsonb_build_object('delegated',true,'dealId',p_deal_id,'paymentLineAmounts',p_corrected_payload->'paymentLineAmounts')
$$;

\echo 'load production migrations'
\i supabase/migrations/20261014113000_agent_rewards_current_finance_reconciled_v16.sql
\i supabase/migrations/20261014114500_agent_rewards_reconciled_owner_correction_v17.sql

do $$
declare v jsonb;
begin
  select x.value into v from jsonb_array_elements(public.rona_admin_agent_rewards_workspace_v14()->'deals') x(value);
  if v->'financeSourceReconciliation'->>'status'<>'RECONCILED_CURRENT_FINANCE_V8' then
    raise exception 'Current UID96 Finance source not reconciled: %',v->'financeSourceReconciliation';
  end if;
  if (v->'cashFlow'->>'counterpartyCashOut')::numeric<>577205.13244588 then
    raise exception 'Current counterparty cash out incorrect: %',v->'cashFlow';
  end if;
  if (v->'cashFlow'->>'bankFees')::numeric<>86.66751991 then
    raise exception 'Bank fee error: %',v->'cashFlow';
  end if;
  if (v->'cashFlow'->>'netCashFlow')::numeric<>95208.20003421 then
    raise exception 'Finance net DDS incorrect: %',v->'cashFlow';
  end if;
  if jsonb_array_length(v->'cashPaymentLines')<>3 then
    raise exception 'Only 3 verified counterparty payments should appear: %',v->'cashPaymentLines';
  end if;
  if (select count(distinct x->>'canonicalCounterpartyId') from
         jsonb_array_elements(v->'cashPaymentLines') x) <> 2 then
    raise exception 'Canonical party identity mismatch: %',v->'cashPaymentLines';
  end if;
  if v->'cashFlow'->>'realizedFxReference' is not null then
    raise exception 'Prior snapshot FX must not be reused as current FX';
  end if;
end;
$$;

-- Wrapper permits validated current source line IDs and rejects foreign/missing IDs.
do $$
declare v jsonb; caught boolean:=false;
begin
  v:=public.rona_admin_agent_rewards_correct_v8('DEAL-2026-005',null,
      '{"paymentLineAmounts":{"PAYEV-2026-000025":371468.0},"openSettlementAdjustment":0}'::jsonb,'','TEST');
  if v->>'delegated'<>'true' then raise exception 'Legacy authoritative write gate not called';end if;
  begin
    perform public.rona_admin_agent_rewards_correct_v8('DEAL-2026-005',null,
      '{"paymentLineAmounts":{"FOREIGN-PAYMENT-ID":99},"openSettlementAdjustment":0}'::jsonb,'','TEST');
  exception when others then
    if SQLERRM like 'PAYMENT_LINE_NOT_IN_RECONCILED_FINANCE_SOURCE%' then caught:=true;end if;
  end;
  if not caught then raise exception 'Stale or foreign payment ID should have been rejected';end if;
end;
$$;

-- The current Finance source cannot be published without reconciling every payment.
update portal_private.deal_finance_authority_payments_v8_read_v1
   set actual_spend=577300.0000
 where source_version='UID96_EXECUTION_RECONCILIATION_V1';

do $$
declare v jsonb;
begin
  select x.value into v from jsonb_array_elements(public.rona_admin_agent_rewards_workspace_v14()->'deals') x(value);
  if v->'financeSourceReconciliation'->>'status'<>'HOLD_CURRENT_FINANCE_SOURCE_MISMATCH' then
    raise exception 'Expected fail-closed reconciliation status';
  end if;
  if v->'cashFlow'->>'status'<>'TO_VERIFY_CURRENT_FINANCE_RECONCILIATION' then
    raise exception 'Stale approved DDS improperly exposed under mismatch';
  end if;
  if jsonb_array_length(v->'cashPaymentLines')<>0 then
    raise exception 'Payment source details must not be shown as approved on mismatch';
  end if;
end;
$$;

-- If current Finance source is no newer than approved DDS, only prior approved
-- payment_ids may be displayed, never later unapproved payments.
update portal_private.deal_finance_authority_payments_v8_read_v1
   set actual_spend=577291.79996579,effective_at='2026-10-06 10:00:00+00'
 where source_version='UID96_EXECUTION_RECONCILIATION_V1';

do $$
declare v jsonb;
begin
  select x.value into v from jsonb_array_elements(public.rona_admin_agent_rewards_workspace_v14()->'deals') x(value);
  if v->'financeSourceReconciliation'->>'status'<>'LEGACY_APPROVED_PAYMENT_SCOPE_RECONCILED' then
    raise exception 'Expected prior DDS approved payment scope';
  end if;
  if jsonb_array_length(v->'cashPaymentLines')<>2 then
    raise exception 'Later payment must not be included in older approved snapshot';
  end if;
  if v->'cashFlow'->>'netCashFlow'<>'466705.09534108' then
    raise exception 'Historical approved cash fact must remain intact';
  end if;
end;
$$;
\echo 'AGENT_REWARDS_FINANCE_V16_INTEGRATION=PASS'
