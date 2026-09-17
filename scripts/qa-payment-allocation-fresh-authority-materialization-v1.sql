\set ON_ERROR_STOP on
create extension if not exists pgcrypto;
create schema if not exists portal_private;
create schema if not exists auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

do $$ begin
  create type portal_private.authority_state_enum as enum ('DRAFT','SOURCE_RECEIVED','VERIFIED','CONFIRMED','SUPERSEDED','REJECTED');
  create type portal_private.lifecycle_state_enum as enum ('DRAFT','ACTIVE','SUSPENDED','CLOSED','ARCHIVED','SUPERSEDED');
  create type portal_private.payment_allocation_state_enum as enum ('UNALLOCATED','PARTIAL','ALLOCATED','VERIFIED','REVERSED');
  create type portal_private.finance_state_enum as enum ('NOT_DUE','DUE','PARTIAL','PAID','OVERDUE','DISPUTED');
  create type portal_private.accounting_closure_state_enum as enum ('OPEN','PENDING_RECONCILIATION','CLOSED');
  create type portal_private.payment_direction_enum as enum ('INCOMING','OUTGOING');
  create type portal_private.payment_kind_enum as enum ('CLIENT_PAYMENT','COUNTERPARTY_PAYMENT','BANK_FEE','FX_CONVERSION','INTERNAL_TRANSFER','OTHER');
  create type portal_private.deal_allocation_applicability_enum as enum ('DEAL_ALLOCATABLE','NOT_APPLICABLE');
  create type portal_private.payment_bank_state_enum as enum ('RECEIVED_UNVERIFIED','BANK_CONFIRMED');
  create type portal_private.finance_verification_state_enum as enum ('TO_VERIFY','VERIFIED');
  create type portal_private.ai_business_role_enum as enum ('FINANCE','OPERATIONS_DIRECTOR');
end $$;

create table portal_private.payments(
  id uuid primary key default gen_random_uuid(),
  payment_id text not null unique,
  amount numeric not null,
  currency char(3) not null,
  payment_direction portal_private.payment_direction_enum not null,
  payment_kind portal_private.payment_kind_enum not null,
  deal_allocation_applicability portal_private.deal_allocation_applicability_enum not null,
  bank_fact_status portal_private.payment_bank_state_enum not null,
  finance_verification_status portal_private.finance_verification_state_enum not null,
  authority_state portal_private.authority_state_enum not null,
  lifecycle_state portal_private.lifecycle_state_enum not null,
  finance_status portal_private.finance_state_enum not null,
  accounting_closure_status portal_private.accounting_closure_state_enum not null
);

create table portal_private.deals(
  id uuid primary key,
  deal_id text not null unique,
  client_key uuid not null,
  contract_key uuid not null
);

create table portal_private.ai_coordination_records(
  record_id uuid primary key,
  record_type text not null,
  functional_role portal_private.ai_business_role_enum not null,
  target_type text not null,
  target_id text not null,
  status text not null,
  qa_only boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table portal_private.payment_allocations(
  id uuid primary key default gen_random_uuid(),
  payment_key uuid not null references portal_private.payments(id) on delete restrict,
  client_key uuid not null,
  contract_key uuid not null,
  deal_key uuid references portal_private.deals(id) on delete restrict,
  allocated_amount numeric not null check(allocated_amount>0),
  allocation_status portal_private.payment_allocation_state_enum not null,
  finance_status portal_private.finance_state_enum not null,
  accounting_closure_status portal_private.accounting_closure_state_enum not null,
  allocation_reference text,
  allocated_at timestamptz,
  allocated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_system text not null,
  source_version text,
  source_timestamp timestamptz,
  import_batch_id uuid,
  authority_state portal_private.authority_state_enum not null,
  lifecycle_state portal_private.lifecycle_state_enum not null
);

create or replace function portal_private.resolve_deal_resource_state(p_deal uuid)
returns table(resource_status text)
language sql stable
as $$ select 'RESOURCE_CONFIRMED'::text $$;

\ir ../supabase/migrations/20260913005000_payment_allocation_fresh_authority_materialization_v1.sql

-- Authorization proof: only service_role has RPC execute privilege.
do $$ begin
  if has_function_privilege('anon','public.payment_allocation_fresh_authority_materialize_v1(text,uuid,text,uuid,uuid,text,boolean)','execute') then
    raise exception 'ANON_EXECUTE_NOT_REVOKED';
  end if;
  if has_function_privilege('authenticated','public.payment_allocation_fresh_authority_materialize_v1(text,uuid,text,uuid,uuid,text,boolean)','execute') then
    raise exception 'AUTHENTICATED_EXECUTE_NOT_REVOKED';
  end if;
  if not has_function_privilege('service_role','public.payment_allocation_fresh_authority_materialize_v1(text,uuid,text,uuid,uuid,text,boolean)','execute') then
    raise exception 'SERVICE_ROLE_EXECUTE_MISSING';
  end if;
end $$;

-- PAYEV-000001 fixture mirrors the production dry-run facts but lives only in ephemeral CI Postgres.
insert into portal_private.payments values(
  '8a757f03-3ad4-5656-984a-c942d91b07db','PAYEV-2026-000001',236250,'USD','INCOMING','CLIENT_PAYMENT',
  'DEAL_ALLOCATABLE','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE','PAID','OPEN');
insert into portal_private.deals values(
  '17503586-9909-58cc-99f6-92b2ba4d8797','DEAL-2026-004',
  'f4029d84-325d-5fb0-8347-a77ffd6a4824','97dc00d5-6fae-5eab-a987-7a6ea0cec6fa');
insert into portal_private.payment_allocations(
  id,payment_key,client_key,contract_key,deal_key,allocated_amount,allocation_status,finance_status,
  accounting_closure_status,allocation_reference,allocated_at,source_system,source_version,source_timestamp,
  authority_state,lifecycle_state)
values(
  '6fb5974e-887a-50de-a183-bde7facff1b9','8a757f03-3ad4-5656-984a-c942d91b07db',
  'f4029d84-325d-5fb0-8347-a77ffd6a4824','97dc00d5-6fae-5eab-a987-7a6ea0cec6fa',
  '17503586-9909-58cc-99f6-92b2ba4d8797',236250,'VERIFIED','PAID','OPEN','PAYEV-2026-000001',
  '2026-08-10T00:00:00Z','SOURCE_FREEZE_V5/ACCOUNTING','v006','2026-08-13T17:16:00Z','CONFIRMED','ACTIVE');
insert into portal_private.ai_coordination_records values(
  'a87f867e-fceb-4a75-bd15-0be8b77d046d','FUNCTIONAL_CONCLUSION','FINANCE','PAYMENT','PAYEV-2026-000001','APPROVED',false,
  '{"confirmed":true,"entity_type":"PAYMENT","entity_id":"PAYEV-2026-000001","open_issues":[]}'::jsonb,'[]'::jsonb,
  '2026-09-12T21:19:31.629596Z');
insert into portal_private.ai_coordination_records values(
  '579985e2-dd74-401e-9b48-47840f4ff68e','BUSINESS_CHANGE_PROPOSAL','FINANCE','PAYMENT','PAYEV-2026-000001','PROPOSED',false,
  '{"proposed_action":"RECONCILE_CURRENT_PAYMENT_ALLOCATION","proposed_field":"payment_allocation.current","proposed_value":{"currency":"USD","payment_id":"PAYEV-2026-000001","payment_amount":236250,"allocations":[{"deal_id":"DEAL-2026-004","allocated_amount":236250,"allocation_status":"VERIFIED_SOURCE_LOCKED"}],"allocated_total":236250,"unallocated_residue":0,"preserve_audit_history":true,"preserve_payment_amount":true}}'::jsonb,
  '["FINANCE_CONCLUSION:a87f867e-fceb-4a75-bd15-0be8b77d046d"]'::jsonb,'2026-09-12T21:20:55.007829Z');

-- Dry-run must be pure: no supersede, no insert, no history row.
set role service_role;
select public.payment_allocation_fresh_authority_materialize_v1(
  'PAYEV-2026-000001','6fb5974e-887a-50de-a183-bde7facff1b9','v006',
  'a87f867e-fceb-4a75-bd15-0be8b77d046d','579985e2-dd74-401e-9b48-47840f4ff68e',
  'qa-payev-000001-fresh-authority-v1',true);
reset role;
do $$ begin
  if (select count(*) from portal_private.payment_allocations where payment_key='8a757f03-3ad4-5656-984a-c942d91b07db')<>1 then raise exception 'DRY_RUN_INSERTED_ALLOCATION'; end if;
  if (select authority_state::text||'/'||lifecycle_state::text from portal_private.payment_allocations where id='6fb5974e-887a-50de-a183-bde7facff1b9')<>'CONFIRMED/ACTIVE' then raise exception 'DRY_RUN_CHANGED_OLD'; end if;
  if exists(select 1 from portal_private.payment_allocation_authority_history_v1) then raise exception 'DRY_RUN_WROTE_HISTORY'; end if;
end $$;

-- Apply once; old is preserved/superseded, new is sole active authority, payment amount is unchanged.
set role service_role;
select public.payment_allocation_fresh_authority_materialize_v1(
  'PAYEV-2026-000001','6fb5974e-887a-50de-a183-bde7facff1b9','v006',
  'a87f867e-fceb-4a75-bd15-0be8b77d046d','579985e2-dd74-401e-9b48-47840f4ff68e',
  'qa-payev-000001-fresh-authority-v1',false);
reset role;
do $$ begin
  if (select amount from portal_private.payments where payment_id='PAYEV-2026-000001')<>236250 then raise exception 'PAYMENT_AMOUNT_CHANGED'; end if;
  if (select authority_state::text||'/'||lifecycle_state::text from portal_private.payment_allocations where id='6fb5974e-887a-50de-a183-bde7facff1b9')<>'SUPERSEDED/SUPERSEDED' then raise exception 'OLD_NOT_SUPERSEDED'; end if;
  if (select count(*) from portal_private.payment_allocations pa join portal_private.payments p on p.id=pa.payment_key where p.payment_id='PAYEV-2026-000001' and pa.lifecycle_state='ACTIVE')<>1 then raise exception 'ACTIVE_AUTHORITY_COUNT_NOT_ONE'; end if;
  if not exists(select 1 from portal_private.payment_allocations pa join portal_private.payments p on p.id=pa.payment_key where p.payment_id='PAYEV-2026-000001' and pa.lifecycle_state='ACTIVE' and pa.source_system='FINANCE_SOURCE_LOCKED_RECONCILIATION' and pa.source_version like 'PAYMENT_ALLOCATION_FRESH_AUTHORITY_V1/FINANCE_CONCLUSION:%/FINANCE_PROPOSAL:%') then raise exception 'FRESH_PROVENANCE_MISSING'; end if;
  if (select count(*) from portal_private.payment_allocation_authority_history_v1)<>1 then raise exception 'HISTORY_COUNT_NOT_ONE'; end if;
end $$;

-- Same key + same normalized request is a no-op replay.
set role service_role;
select public.payment_allocation_fresh_authority_materialize_v1(
  'PAYEV-2026-000001','6fb5974e-887a-50de-a183-bde7facff1b9','v006',
  'a87f867e-fceb-4a75-bd15-0be8b77d046d','579985e2-dd74-401e-9b48-47840f4ff68e',
  'qa-payev-000001-fresh-authority-v1',false)->>'idempotentReplay' as idempotent_replay;
reset role;
do $$ begin
  if (select count(*) from portal_private.payment_allocations where payment_key='8a757f03-3ad4-5656-984a-c942d91b07db')<>2 then raise exception 'IDEMPOTENT_REPLAY_DUPLICATED_ALLOCATION'; end if;
  if (select count(*) from portal_private.payment_allocation_authority_history_v1)<>1 then raise exception 'IDEMPOTENT_REPLAY_DUPLICATED_HISTORY'; end if;
end $$;

-- Same key + different request must abort as idempotency conflict.
do $$ begin
  begin
    perform public.payment_allocation_fresh_authority_materialize_v1(
      'PAYEV-2026-000001','6fb5974e-887a-50de-a183-bde7facff1b9','stale-version',
      'a87f867e-fceb-4a75-bd15-0be8b77d046d','579985e2-dd74-401e-9b48-47840f4ff68e',
      'qa-payev-000001-fresh-authority-v1',false);
    raise exception 'EXPECTED_IDEMPOTENCY_CONFLICT_NOT_RAISED';
  exception when unique_violation then null;
  end;
end $$;

-- Independent stale-CAS fixture.
insert into portal_private.payments values(
  '11111111-1111-4111-8111-111111111111','PAYEV-QA-CAS',100,'USD','INCOMING','CLIENT_PAYMENT',
  'DEAL_ALLOCATABLE','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE','PAID','OPEN');
insert into portal_private.deals values(
  '22222222-2222-4222-8222-222222222222','DEAL-QA-CAS',
  '33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444');
insert into portal_private.payment_allocations(
  id,payment_key,client_key,contract_key,deal_key,allocated_amount,allocation_status,finance_status,accounting_closure_status,
  source_system,source_version,source_timestamp,authority_state,lifecycle_state)
values('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222',100,'VERIFIED','PAID','OPEN','OLD','qa-v1',now(),'CONFIRMED','ACTIVE');
do $$ begin
  begin
    perform public.payment_allocation_fresh_authority_materialize_v1(
      'PAYEV-QA-CAS','55555555-5555-4555-8555-555555555555','qa-stale',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','qa-stale-cas-proof-key',false);
    raise exception 'EXPECTED_CAS_CONFLICT_NOT_RAISED';
  exception when serialization_failure then null;
  end;
  if (select authority_state::text||'/'||lifecycle_state::text from portal_private.payment_allocations where id='55555555-5555-4555-8555-555555555555')<>'CONFIRMED/ACTIVE' then raise exception 'CAS_CONFLICT_MUTATED_ROW'; end if;
end $$;

-- Atomic rollback proof: force the new insert to fail after the old row is superseded.
create or replace function portal_private.qa_fail_fresh_insert_v1() returns trigger language plpgsql as $$
begin
  if new.source_system='FINANCE_SOURCE_LOCKED_RECONCILIATION' and coalesce(current_setting('qa.fail_fresh_insert',true),'')='1' then
    raise exception using errcode='P0001',message='QA_FORCED_INSERT_FAILURE';
  end if;
  return new;
end $$;
create trigger trg_qa_fail_fresh_insert_v1 before insert on portal_private.payment_allocations
for each row execute function portal_private.qa_fail_fresh_insert_v1();
insert into portal_private.payments values(
  '66666666-6666-4666-8666-666666666666','PAYEV-QA-ROLLBACK',100,'USD','INCOMING','CLIENT_PAYMENT',
  'DEAL_ALLOCATABLE','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE','PAID','OPEN');
insert into portal_private.deals values(
  '77777777-7777-4777-8777-777777777777','DEAL-QA-ROLLBACK',
  '88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999');
insert into portal_private.payment_allocations(
  id,payment_key,client_key,contract_key,deal_key,allocated_amount,allocation_status,finance_status,accounting_closure_status,
  source_system,source_version,source_timestamp,authority_state,lifecycle_state)
values('10101010-1010-4010-8010-101010101010','66666666-6666-4666-8666-666666666666','88888888-8888-4888-8888-888888888888',
  '99999999-9999-4999-8999-999999999999','77777777-7777-4777-8777-777777777777',100,'VERIFIED','PAID','OPEN','OLD','rollback-v1',now(),'CONFIRMED','ACTIVE');
insert into portal_private.ai_coordination_records values(
  '12121212-1212-4212-8212-121212121212','FUNCTIONAL_CONCLUSION','FINANCE','PAYMENT','PAYEV-QA-ROLLBACK','APPROVED',false,
  '{"confirmed":true,"entity_type":"PAYMENT","entity_id":"PAYEV-QA-ROLLBACK","open_issues":[]}'::jsonb,'[]'::jsonb,now());
insert into portal_private.ai_coordination_records values(
  '13131313-1313-4313-8313-131313131313','BUSINESS_CHANGE_PROPOSAL','FINANCE','PAYMENT','PAYEV-QA-ROLLBACK','PROPOSED',false,
  '{"proposed_action":"RECONCILE_CURRENT_PAYMENT_ALLOCATION","proposed_field":"payment_allocation.current","proposed_value":{"currency":"USD","payment_id":"PAYEV-QA-ROLLBACK","payment_amount":100,"allocations":[{"deal_id":"DEAL-QA-ROLLBACK","allocated_amount":100,"allocation_status":"VERIFIED_SOURCE_LOCKED"}],"allocated_total":100,"unallocated_residue":0,"preserve_audit_history":true,"preserve_payment_amount":true}}'::jsonb,
  '["FINANCE_CONCLUSION:12121212-1212-4212-8212-121212121212"]'::jsonb,now());
do $$ begin
  perform set_config('qa.fail_fresh_insert','1',true);
  begin
    perform public.payment_allocation_fresh_authority_materialize_v1(
      'PAYEV-QA-ROLLBACK','10101010-1010-4010-8010-101010101010','rollback-v1',
      '12121212-1212-4212-8212-121212121212','13131313-1313-4313-8313-131313131313','qa-rollback-atomic-proof-key',false);
    raise exception 'EXPECTED_FORCED_FAILURE_NOT_RAISED';
  exception when raise_exception then null;
  end;
  if (select authority_state::text||'/'||lifecycle_state::text from portal_private.payment_allocations where id='10101010-1010-4010-8010-101010101010')<>'CONFIRMED/ACTIVE' then raise exception 'ROLLBACK_DID_NOT_RESTORE_OLD'; end if;
  if exists(select 1 from portal_private.payment_allocations where payment_key='66666666-6666-4666-8666-666666666666' and source_system='FINANCE_SOURCE_LOCKED_RECONCILIATION') then raise exception 'ROLLBACK_LEFT_NEW_ROW'; end if;
end $$;

-- Immutable audit/fresh authority proof.
do $$ begin
  begin
    update portal_private.payment_allocation_authority_history_v1 set payment_id='MUTATED';
    raise exception 'HISTORY_UPDATE_SHOULD_FAIL';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    update portal_private.payment_allocations set allocated_amount=1
     where payment_key='8a757f03-3ad4-5656-984a-c942d91b07db' and source_system='FINANCE_SOURCE_LOCKED_RECONCILIATION';
    raise exception 'FRESH_AUTHORITY_UPDATE_SHOULD_FAIL';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo DRY_RUN_DB_PURITY=PASS
\echo AUTHORIZATION_SERVICE_ROLE_ONLY=PASS
\echo CAS_DB_CONFLICT_ABORT=PASS
\echo IDEMPOTENCY_DB_REPLAY=PASS
\echo IDEMPOTENCY_DB_CONFLICT=PASS
\echo EXACTLY_ONE_ACTIVE_AUTHORITY_DB=PASS
\echo PAYMENT_AMOUNT_IMMUTABLE_DB=PASS
\echo ROLLBACK_DB_ATOMIC=PASS
\echo IMMUTABLE_AUDIT_DB=PASS
\echo PAYMENT_ALLOCATION_FRESH_AUTHORITY_DB_HARNESS=PASS
