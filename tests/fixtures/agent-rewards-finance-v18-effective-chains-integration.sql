-- Run only in ephemeral PostgreSQL CI, never in RONA production.
-- Uses v16 integration as a clean baseline and tests v18 + v19 against 009/010/011.
\set ON_ERROR_STOP on
\i tests/fixtures/agent-rewards-finance-v16-integration.sql

alter table portal_private.payment_resource_chains_effective_v8
  add column id uuid not null default gen_random_uuid(),
  add column is_effective_execution_authority boolean not null default false,
  add column effective_lifecycle_state text not null default 'SUPERSEDED_FOR_EXECUTION',
  add column effective_at timestamptz not null default '2026-09-17T17:57:40Z',
  add column created_at timestamptz not null default '2026-09-17T18:00:00Z';

-- Freeze the preexisting v13 fixture before installing multi-deal provider.
create table portal_private.qa_source_v13_fixture(payload jsonb not null);
insert into portal_private.qa_source_v13_fixture select public.rona_admin_agent_rewards_workspace_v13();

insert into portal_private.deals(id,deal_id) values
 ('aaaaaaaa-0000-4000-8000-000000000009','DEAL-2026-009'),
 ('aaaaaaaa-0000-4000-8000-000000000010','DEAL-2026-010'),
 ('aaaaaaaa-0000-4000-8000-000000000011','DEAL-2026-011');

insert into portal_private.ai_coordination_records(record_id,record_type,functional_role,target_type,target_id,status,payload)
values
 ('aaaaaaaa-4000-4000-8000-000000000009','BUSINESS_CHANGE_PROPOSAL','FINANCE','DEAL','DEAL-2026-009','PROPOSED',
  '{"proposed_field":"agent_rewards.fact.dds_authority_v3","proposed_value":{"cash_received":10000000,"counterparty_cash_out":3528000,"bank_fees":3000,"net_cash_flow":6469000,"payment_ids":["PAYEV-2026-000016","PAYEV-2026-000017"]}}'),
 ('aaaaaaaa-4000-4000-8000-000000000010','BUSINESS_CHANGE_PROPOSAL','FINANCE','DEAL','DEAL-2026-010','PROPOSED',
  '{"proposed_field":"agent_rewards.fact.dds_authority_v3","proposed_value":{"cash_received":0,"counterparty_cash_out":79872.06743983,"bank_fees":62.51204815,"net_cash_flow":-79934.57948798,"payment_ids":["PAYEV-2026-000008","PAYEV-2026-000009","PAYEV-2026-000018","PAYEV-2026-000019"]}}'),
 ('aaaaaaaa-4000-4000-8000-000000000011','BUSINESS_CHANGE_PROPOSAL','FINANCE','DEAL','DEAL-2026-011','PROPOSED',
  '{"proposed_field":"agent_rewards.fact.dds_authority_v3","proposed_value":{"cash_received":225900,"counterparty_cash_out":208247.57133975,"bank_fees":151.90743039,"net_cash_flow":17500.52122986,"payment_ids":["PAYEV-2026-000008","PAYEV-2026-000009","PAYEV-2026-000018","PAYEV-2026-000019"]}}');

insert into portal_private.deal_finance_authority_payments_v8_read_v1(
 id,deal_key,actual_spend,remaining_execution,execution_currency,source_version,
 effective_at,created_at,source_refs,source_locked,authority_state,lifecycle_state,
 actual_spend_status,remaining_execution_status
) values
 ('aaaaaaaa-3000-4000-8000-000000000009','aaaaaaaa-0000-4000-8000-000000000009',
  3531000,6469000,'RUB','KUZMASH_SEPTEMBER_2026_OWNER_VERIFIED_V1',
  '2026-09-17 11:06:54+00','2026-09-17 11:07:00+00','[]',true,'AUTHORITATIVE','CURRENT','AUTHORITATIVE','AUTHORITATIVE'),
 ('aaaaaaaa-3000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000010',
  14998.22363736,-14998.22363736,'USD','FINANCE_GLOBAL_PAYMENT_SEMANTICS_V5',
  '2026-09-17 17:57:40+00','2026-09-17 18:00:00+00','[]',true,'AUTHORITATIVE','CURRENT','AUTHORITATIVE','AUTHORITATIVE'),
 ('aaaaaaaa-3000-4000-8000-000000000011','aaaaaaaa-0000-4000-8000-000000000011',
  85704.13483303,140195.86516697,'USD','FINANCE_GLOBAL_PAYMENT_SEMANTICS_V5',
  '2026-09-17 17:57:40+00','2026-09-17 18:00:00+00','[]',true,'AUTHORITATIVE','CURRENT','AUTHORITATIVE','AUTHORITATIVE');

insert into portal_private.payments(
 id,payment_id,counterparty_name,payment_kind,bank_fact_status,
 finance_verification_status,authority_state,lifecycle_state
) values
 ('cccccccc-0000-4000-8000-000000000008','PAYEV-2026-000008','ЧПТУП «КУЗМАШ»','COUNTERPARTY_PAYMENT','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE'),
 ('cccccccc-0000-4000-8000-000000000009','PAYEV-2026-000009','ОАО «БАКАЙ БАНК»','BANK_FEE','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE'),
 ('cccccccc-0000-4000-8000-000000000016','PAYEV-2026-000016','ЧПТУП «КУЗМАШ»','COUNTERPARTY_PAYMENT','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE'),
 ('cccccccc-0000-4000-8000-000000000017','PAYEV-2026-000017','ОАО «БАКАЙ БАНК»','BANK_FEE','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE'),
 ('cccccccc-0000-4000-8000-000000000018','PAYEV-2026-000018','ЧПТУП «КУЗМАШ»','COUNTERPARTY_PAYMENT','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE'),
 ('cccccccc-0000-4000-8000-000000000019','PAYEV-2026-000019','ОАО «БАКАЙ БАНК»','BANK_FEE','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE');

-- 009: single version of each payment. 010/011: old versions must not count.
insert into portal_private.payment_resource_chains_effective_v8(
 deal_key,payment_key,source_locked,accounting_amount,accounting_currency,
 native_amount,native_currency,effective_lifecycle_state,effective_at,created_at
) values
 ('aaaaaaaa-0000-4000-8000-000000000009','cccccccc-0000-4000-8000-000000000016',true,3528000,'RUB',3528000,'RUB','SUPERSEDED_FOR_EXECUTION','2026-09-17 11:06:54+00','2026-09-17 11:07:00+00'),
 ('aaaaaaaa-0000-4000-8000-000000000009','cccccccc-0000-4000-8000-000000000017',true,3000,'RUB',3000,'RUB','SUPERSEDED_FOR_EXECUTION','2026-09-17 11:06:54+00','2026-09-17 11:07:00+00'),

 ('aaaaaaaa-0000-4000-8000-000000000010','cccccccc-0000-4000-8000-000000000008',true,43428.74251497,'USD',3644000,'RUB','SUPERSEDED','2026-09-16 21:16:51+00','2026-09-16 21:20:00+00'),
 ('aaaaaaaa-0000-4000-8000-000000000010','cccccccc-0000-4000-8000-000000000008',true,6468.11053662,'USD',542723.4,'RUB','SUPERSEDED','2026-09-16 22:00:05+00','2026-09-16 22:01:00+00'),
 ('aaaaaaaa-0000-4000-8000-000000000010','cccccccc-0000-4000-8000-000000000008',true,6466.17044228,'USD',542723.4,'RUB','SUPERSEDED_FOR_EXECUTION','2026-09-17 17:57:40+00','2026-09-17 17:58:00+00'),
 ('aaaaaaaa-0000-4000-8000-000000000010','cccccccc-0000-4000-8000-000000000009',true,35.92814371,'USD',3000,'RUB','SUPERSEDED','2026-09-16 21:16:51+00','2026-09-16 21:20:00+00'),
 ('aaaaaaaa-0000-4000-8000-000000000010','cccccccc-0000-4000-8000-000000000009',true,5.30822162,'USD',446.81,'RUB','SUPERSEDED_FOR_EXECUTION','2026-09-17 17:57:40+00','2026-09-17 17:58:00+00'),
 ('aaaaaaaa-0000-4000-8000-000000000010','cccccccc-0000-4000-8000-000000000018',true,8521.43675184,'USD',717276.6,'RUB','SUPERSEDED_FOR_EXECUTION','2026-09-17 17:57:40+00','2026-09-17 17:58:00+00'),
 ('aaaaaaaa-0000-4000-8000-000000000010','cccccccc-0000-4000-8000-000000000019',true,5.30822162,'USD',446.81,'RUB','SUPERSEDED_FOR_EXECUTION','2026-09-17 17:57:40+00','2026-09-17 17:58:00+00'),

 ('aaaaaaaa-0000-4000-8000-000000000011','cccccccc-0000-4000-8000-000000000008',true,36960.63197835,'USD',3101276.6,'RUB','SUPERSEDED','2026-09-16 22:00:05+00','2026-09-16 22:01:00+00'),
 ('aaaaaaaa-0000-4000-8000-000000000011','cccccccc-0000-4000-8000-000000000008',true,36949.54572391,'USD',3101276.6,'RUB','SUPERSEDED_FOR_EXECUTION','2026-09-17 17:57:40+00','2026-09-17 17:58:00+00'),
 ('aaaaaaaa-0000-4000-8000-000000000011','cccccccc-0000-4000-8000-000000000009',true,30.57712575,'USD',2553.19,'RUB','SUPERSEDED','2026-09-16 22:00:05+00','2026-09-16 22:01:00+00'),
 ('aaaaaaaa-0000-4000-8000-000000000011','cccccccc-0000-4000-8000-000000000009',true,30.33257616,'USD',2553.19,'RUB','SUPERSEDED_FOR_EXECUTION','2026-09-17 17:57:40+00','2026-09-17 17:58:00+00'),
 ('aaaaaaaa-0000-4000-8000-000000000011','cccccccc-0000-4000-8000-000000000018',true,48693.92395679,'USD',4098723.4,'RUB','SUPERSEDED_FOR_EXECUTION','2026-09-17 17:57:40+00','2026-09-17 17:58:00+00'),
 ('aaaaaaaa-0000-4000-8000-000000000011','cccccccc-0000-4000-8000-000000000019',true,30.33257616,'USD',2553.19,'RUB','SUPERSEDED_FOR_EXECUTION','2026-09-17 17:57:40+00','2026-09-17 17:58:00+00');

-- Replace the stub only inside this isolated test with Finance+Operations-approved
-- older snapshots whose cumulative details were polluted by old allocation versions.
create or replace function public.rona_admin_agent_rewards_workspace_v13()
returns jsonb language sql as $$
select (select payload from portal_private.qa_source_v13_fixture limit 1)
  || jsonb_build_object('deals',
    (select payload->'deals' from portal_private.qa_source_v13_fixture limit 1)
    || (select coalesce(jsonb_agg(
       jsonb_build_object(
         'dealId',p.target_id,
         'financialCurrency',case when p.target_id='DEAL-2026-009' then 'RUB' else 'USD' end,
         'cashFlow',jsonb_build_object(
           'status','APPROVED_CASH_FLOW_DDS',
           'currency',case when p.target_id='DEAL-2026-009' then 'RUB' else 'USD' end,
           'cashReceived',(p.payload->'proposed_value'->>'cash_received')::numeric,
           'counterpartyCashOut',(p.payload->'proposed_value'->>'counterparty_cash_out')::numeric,
           'bankFees',(p.payload->'proposed_value'->>'bank_fees')::numeric,
           'totalCashOut',(p.payload->'proposed_value'->>'counterparty_cash_out')::numeric
             +(p.payload->'proposed_value'->>'bank_fees')::numeric,
           'netCashFlow',(p.payload->'proposed_value'->>'net_cash_flow')::numeric
         ),
         'cashFlowAuthority',jsonb_build_object(
           'financeProposalRecordId',p.record_id,
           'financeProposalCreatedAt','2026-10-07T09:53:25Z'
         ),
         'cashPaymentLines','[]'::jsonb,
         'ownerResultBridge',jsonb_build_object(
           'recognition_status','APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE',
           'open_settlement_adjustment',jsonb_build_object('amount',0),
           'actual_financial_result',jsonb_build_object('amount',(p.payload->'proposed_value'->>'net_cash_flow')::numeric)
         ),
         'ownerCorrectionAuthority',jsonb_build_object(
           'status','APPROVED_FOR_OWNER_CORRECTION',
           'contract','PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT'
         )
       ) order by p.target_id),'[]'::jsonb)
       from portal_private.ai_coordination_records p
       where p.target_id in ('DEAL-2026-009','DEAL-2026-010','DEAL-2026-011')
         and p.payload->>'proposed_field'='agent_rewards.fact.dds_authority_v3')
  )
$$;

\echo 'apply only the new production v18/v19 SQL to the clean isolated fixture'
\i supabase/migrations/20261014120000_agent_rewards_current_finance_effective_chains_v18.sql
\i supabase/migrations/20261014121500_agent_rewards_effective_chain_owner_correction_v19.sql

do $$
declare v jsonb; got jsonb; d text; e numeric; n numeric; fees numeric; paid numeric; count_expected int;
begin
  for d,e,n,paid,fees,count_expected in
     select * from (values
      ('DEAL-2026-005'::text,577291.79996579::numeric,95208.20003421::numeric,577205.13244588::numeric,86.66751991::numeric,3::int),
      ('DEAL-2026-009',3531000,6469000,3528000,3000,1),
      ('DEAL-2026-010',14998.22363736,-14998.22363736,14987.60719412,10.61644324,2),
      ('DEAL-2026-011',85704.13483303,140195.86516697,85643.46968070,60.66515232,2)
     ) x(deal_id,actual_spend,expected_dds,party_paid,bank_fees,party_payment_count)
  loop
    select x.value into v from jsonb_array_elements(public.rona_admin_agent_rewards_workspace_v15()->'deals') x(value)
      where x.value->>'dealId'=d;
    if v is null then raise exception 'Missing deal %',d;end if;
    if v->'financeSourceReconciliation'->>'status'<>'RECONCILED_CURRENT_FINANCE_V8' then
      raise exception 'Deal % must reconcile current Finance V8; got %',d,v->'financeSourceReconciliation';
    end if;
    if abs((v->'cashFlow'->>'counterpartyCashOut')::numeric-paid)>0.000001 then
      raise exception 'Payment sum wrong %: %',d,v->'cashFlow';
    end if;
    if abs((v->'cashFlow'->>'bankFees')::numeric-fees)>0.000001 then
      raise exception 'Bank fees wrong %: %',d,v->'cashFlow';
    end if;
    if abs((v->'cashFlow'->>'netCashFlow')::numeric-n)>0.005 then
      raise exception 'DDS wrong %: %',d,v->'cashFlow';
    end if;
    if abs((v->'financeSourceReconciliation'->>'chainSpend')::numeric-e)>0.000001 then
      raise exception 'Historical resource chain versions double counted for %: %',d,v->'financeSourceReconciliation';
    end if;
    if jsonb_array_length(v->'cashPaymentLines')<>count_expected then
      raise exception 'Must use one version per source payment %: %',d,v->'cashPaymentLines';
    end if;
    if d in ('DEAL-2026-010','DEAL-2026-011') and (
      select count(distinct x->>'canonicalCounterpartyId')
      from jsonb_array_elements(v->'cashPaymentLines') x
    )<>1 then raise exception 'Expected one Kuzmash canonical entity for %',d;end if;
  end loop;
end;
$$;

do $$
declare v jsonb; caught boolean:=false;
begin
  v:=public.rona_admin_agent_rewards_correct_v9('DEAL-2026-010',null,
      '{"paymentLineAmounts":{"PAYEV-2026-000018":8521.4},"openSettlementAdjustment":0}'::jsonb,'','TEST-V19');
  if v->>'delegated'<>'true' then raise exception 'Existing audited correction v7 gate not called';end if;
  begin
    perform public.rona_admin_agent_rewards_correct_v9('DEAL-2026-010',null,
      '{"paymentLineAmounts":{"FOREIGN-PAYMENT":12},"openSettlementAdjustment":0}'::jsonb,'','TEST-V19');
  exception when others then
    if SQLERRM like 'PAYMENT_LINE_NOT_IN_RECONCILED_FINANCE_SOURCE%' then caught:=true;end if;
  end;
  if not caught then raise exception 'Foreign payment correction was not rejected';end if;
end;
$$;

-- Require strict HOLD when a genuinely newer Finance authority has mismatch.
update portal_private.deal_finance_authority_payments_v8_read_v1
  set actual_spend=15020,effective_at='2026-10-13T13:00:00+00'
where source_version='FINANCE_GLOBAL_PAYMENT_SEMANTICS_V5'
  and deal_key='aaaaaaaa-0000-4000-8000-000000000010';
do $$
declare v jsonb;
begin
  select x.value into v from jsonb_array_elements(public.rona_admin_agent_rewards_workspace_v15()->'deals') x(value)
   where x.value->>'dealId'='DEAL-2026-010';
  if v->'financeSourceReconciliation'->>'status'<>'HOLD_CURRENT_FINANCE_SOURCE_MISMATCH' then
     raise exception 'Genuinely newer inconsistent source must HOLD';
  end if;
  if v->'cashFlow'->>'status'<>'TO_VERIFY_CURRENT_FINANCE_RECONCILIATION' then
     raise exception 'Stale cash outcome must never be approved after source divergence';
  end if;
end;
$$;
\echo 'AGENT_REWARDS_V18_FINANCE_ALL_FOUR_DEALS=PASS'
