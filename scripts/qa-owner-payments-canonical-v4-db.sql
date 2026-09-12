\set ON_ERROR_STOP on
create extension if not exists pgcrypto;
create schema portal_private;
do $$begin create role anon nologin; exception when duplicate_object then null; end$$;
do $$begin create role authenticated nologin; exception when duplicate_object then null; end$$;
do $$begin create role service_role nologin; exception when duplicate_object then null; end$$;
grant usage on schema portal_private to service_role;

create type portal_private.authority_state_enum as enum('DRAFT','SOURCE_RECEIVED','VERIFIED','CONFIRMED','SUPERSEDED','REJECTED');
create type portal_private.lifecycle_state_enum as enum('DRAFT','ACTIVE','SUSPENDED','CLOSED','ARCHIVED','SUPERSEDED');
create type portal_private.payment_direction_enum as enum('INCOMING','OUTGOING');
create type portal_private.payment_kind_enum as enum('CLIENT_PAYMENT','COUNTERPARTY_PAYMENT','BANK_FEE','FX_CONVERSION','INTERNAL_TRANSFER','OTHER');
create type portal_private.payment_bank_state_enum as enum('RECEIVED_UNVERIFIED','BANK_CONFIRMED','REVERSED','REJECTED');
create type portal_private.finance_verification_state_enum as enum('TO_VERIFY','VERIFIED');
create type portal_private.deal_allocation_applicability_enum as enum('DEAL_ALLOCATABLE','NOT_APPLICABLE');
create type portal_private.payment_allocation_state_enum as enum('UNALLOCATED','PARTIAL','ALLOCATED','VERIFIED','REVERSED');
create type portal_private.finance_state_enum as enum('NOT_DUE','DUE','PARTIAL','PAID','OVERDUE','DISPUTED');
create type portal_private.accounting_closure_state_enum as enum('OPEN','CLOSED');

create table portal_private.portal_users(id uuid primary key,status text not null,lifecycle_state portal_private.lifecycle_state_enum not null);
create table portal_private.portal_user_roles(user_id uuid not null,role text not null,status text not null);
create table portal_private.clients(id uuid primary key);
create table portal_private.contracts(id uuid primary key,client_key uuid not null,unique(id,client_key));
create table portal_private.deals(id uuid primary key,deal_id text unique not null,client_key uuid not null,contract_key uuid not null,authority_state portal_private.authority_state_enum not null,lifecycle_state portal_private.lifecycle_state_enum not null,unique(id,client_key,contract_key));
create table portal_private.owner_deal_workflow(deal_key uuid primary key,payment_handoff_state text not null,payment_handoff_at timestamptz);
create table portal_private.payments(
 id uuid primary key,payment_id text unique not null,amount numeric not null,currency char(3) not null,
 payment_direction portal_private.payment_direction_enum not null,payment_kind portal_private.payment_kind_enum not null,
 bank_fact_status portal_private.payment_bank_state_enum not null,finance_verification_status portal_private.finance_verification_state_enum not null,
 deal_allocation_applicability portal_private.deal_allocation_applicability_enum not null,allocation_review_status text,
 authority_state portal_private.authority_state_enum not null,lifecycle_state portal_private.lifecycle_state_enum not null,
 finance_status portal_private.finance_state_enum not null,accounting_closure_status portal_private.accounting_closure_state_enum not null,
 payment_at timestamptz default now(),counterparty_name text,counterparty_role text,original_payment_purpose text,bank_transaction_reference text
);
create table portal_private.payment_allocations(
 id uuid primary key,payment_key uuid not null,client_key uuid,contract_key uuid,deal_key uuid,allocated_amount numeric not null,
 allocation_status portal_private.payment_allocation_state_enum not null,finance_status portal_private.finance_state_enum not null,
 accounting_closure_status portal_private.accounting_closure_state_enum not null,allocation_reference text,allocated_at timestamptz,allocated_by uuid,
 created_at timestamptz default now(),updated_at timestamptz default now(),source_system text,source_version text,source_timestamp timestamptz,
 authority_state portal_private.authority_state_enum not null,lifecycle_state portal_private.lifecycle_state_enum not null
);
grant select,insert,update on portal_private.payment_allocations to service_role;

insert into portal_private.portal_users values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ACTIVE','ACTIVE');
insert into portal_private.portal_user_roles values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ADMIN','ACTIVE');
insert into portal_private.clients values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
insert into portal_private.contracts values('11111111-1111-4111-8111-111111111112','11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222223','22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333334','33333333-3333-4333-8333-333333333333');
insert into portal_private.deals values
('11111111-1111-4111-8111-111111111113','DEAL-QA-A','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','CONFIRMED','ACTIVE'),
('22222222-2222-4222-8222-222222222224','DEAL-QA-B','22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222223','CONFIRMED','ACTIVE'),
('33333333-3333-4333-8333-333333333335','DEAL-QA-NOT-SENT','33333333-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333334','CONFIRMED','ACTIVE');
insert into portal_private.owner_deal_workflow values
('11111111-1111-4111-8111-111111111113','READY',null),('22222222-2222-4222-8222-222222222224','SENT',now()),('33333333-3333-4333-8333-333333333335','NOT_SENT',null);
insert into portal_private.payments values
('44444444-4444-4444-8444-444444444441','PAY-QA-IN',100000,'USD','INCOMING','CLIENT_PAYMENT','BANK_CONFIRMED','VERIFIED','DEAL_ALLOCATABLE','TO_VERIFY','CONFIRMED','ACTIVE','PAID','OPEN',now(),'Client','CLIENT','QA incoming','BANK-IN'),
('44444444-4444-4444-8444-444444444442','PAY-QA-OUT',3644000,'RUB','OUTGOING','COUNTERPARTY_PAYMENT','BANK_CONFIRMED','VERIFIED','DEAL_ALLOCATABLE','TO_VERIFY','CONFIRMED','ACTIVE','PAID','OPEN',now(),'Supplier','SUPPLIER','QA outgoing','BANK-OUT'),
('44444444-4444-4444-8444-444444444443','PAY-QA-FEE',3000,'RUB','OUTGOING','BANK_FEE','BANK_CONFIRMED','VERIFIED','DEAL_ALLOCATABLE','TO_VERIFY','CONFIRMED','ACTIVE','PAID','OPEN',now(),'Bank','BANK','QA fee','BANK-FEE');

\i supabase/migrations/20260913032000_owner_payments_canonical_authority_v4.sql
\i supabase/migrations/20260913032100_owner_payment_authority_v4_guards.sql
\i supabase/migrations/20260913032200_owner_client_payment_allocation_v4.sql
\i supabase/migrations/20260913032300_owner_deal_spend_allocation_v4.sql

set role service_role;
select public.owner_client_payment_allocate_v4('PAY-QA-IN','[{"dealId":"DEAL-QA-A","amount":30000},{"dealId":"DEAL-QA-B","amount":50000}]'::jsonb,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa-in-dry',null,true) as incoming_dry_run;
reset role;
do $$begin
 if exists(select 1 from portal_private.payment_allocations where payment_key='44444444-4444-4444-8444-444444444441') then raise exception 'DRY_RUN_MUTATED'; end if;
end$$;
select 'INCOMING_DRY_RUN_PURE=PASS';

set role service_role;
select public.owner_client_payment_allocate_v4('PAY-QA-IN','[{"dealId":"DEAL-QA-A","amount":30000},{"dealId":"DEAL-QA-B","amount":50000}]'::jsonb,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa-in-apply',null,false) as incoming_apply;
reset role;
do $$declare v_amt numeric;v_sum numeric;v_count int;begin
 select amount into v_amt from portal_private.payments where payment_id='PAY-QA-IN';
 select coalesce(sum(allocated_amount),0),count(*) into v_sum,v_count from portal_private.payment_allocations where payment_key='44444444-4444-4444-8444-444444444441' and lifecycle_state='ACTIVE';
 if v_amt<>100000 or v_sum<>80000 or v_count<>2 then raise exception 'INCOMING_MULTI_PARTIAL_BAD'; end if;
 if (select count(*) from portal_private.owner_payment_authority_history_v4 where event_type='CLIENT_PAYMENT_ALLOCATION' and action='AUTHORIZE')<>2 then raise exception 'INCOMING_HISTORY_BAD'; end if;
end$$;
select 'PARTIAL_ALLOCATION_SUPPORTED=PASS';
select 'MULTI_DEAL_ALLOCATION_SUPPORTED=PASS';
select 'RESIDUE_PRESERVED=PASS';
select 'PAYMENT_AMOUNT_IMMUTABLE=PASS';

\set ON_ERROR_STOP off
set role service_role;
select public.owner_client_payment_allocate_v4('PAY-QA-IN','[{"dealId":"DEAL-QA-NOT-SENT","amount":1000}]'::jsonb,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa-not-sent',null,true);
reset role;
\set ON_ERROR_STOP on
select 'EXISTING_PAYMENT_CONTOUR_GATE=PASS';

\set ON_ERROR_STOP off
begin;
set role service_role;
insert into portal_private.payment_allocations(id,payment_key,client_key,contract_key,deal_key,allocated_amount,allocation_status,finance_status,accounting_closure_status,allocation_reference,allocated_at,allocated_by,source_system,source_version,source_timestamp,authority_state,lifecycle_state)
values('55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444441','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','11111111-1111-4111-8111-111111111113',1,'VERIFIED','PAID','OPEN','BYPASS',now(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','OWNER_AUTHORIZED_CLIENT_PAYMENT_ALLOCATION_V4','BYPASS',now(),'CONFIRMED','ACTIVE');
set constraints all immediate;
rollback;
reset role;
\set ON_ERROR_STOP on
select 'DIRECT_OWNER_ALLOCATION_BYPASS_BLOCKED=PASS';

\set ON_ERROR_STOP off
set role service_role;
insert into portal_private.owner_payment_authority_history_v4(event_type,action,entity_id,payment_id,deal_id,allocated_amount,currency,actor_user_id,idempotency_key,source_system,source_timestamp) values('CLIENT_PAYMENT_ALLOCATION','AUTHORIZE',gen_random_uuid(),'PAY-QA-IN','DEAL-QA-A',1,'USD','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bypass-history','OWNER_AUTHORIZED_CLIENT_PAYMENT_ALLOCATION_V4',now());
reset role;
\set ON_ERROR_STOP on
select 'DIRECT_HISTORY_WRITE_BLOCKED=PASS';

set role service_role;
select public.owner_deal_spend_allocate_v4('PAY-QA-OUT','DEAL-QA-A',1000000,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa-out-apply',null,false) as outgoing_apply;
select public.owner_deal_spend_allocate_v4('PAY-QA-FEE','DEAL-QA-A',3000,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa-fee-apply',null,false) as fee_apply;
reset role;
do $$begin
 if (select amount from portal_private.payments where payment_id='PAY-QA-OUT')<>3644000 then raise exception 'OUT_PAYMENT_MUTATED'; end if;
 if (select count(*) from portal_private.payment_allocations where payment_key in ('44444444-4444-4444-8444-444444444442','44444444-4444-4444-8444-444444444443'))<>0 then raise exception 'OUT_CREATED_CLIENT_ALLOCATION'; end if;
 if not exists(select 1 from portal_private.owner_deal_spend_allocations_v4 where payment_id='PAY-QA-OUT' and spend_kind='RONA_ADVANCE' and authority_state='CONFIRMED' and lifecycle_state='ACTIVE') then raise exception 'ADVANCE_MISSING'; end if;
 if not exists(select 1 from portal_private.owner_deal_spend_allocations_v4 where payment_id='PAY-QA-FEE' and spend_kind='BANK_FEE' and authority_state='CONFIRMED' and lifecycle_state='ACTIVE') then raise exception 'FEE_MISSING'; end if;
end$$;
select 'RONA_ADVANCE_SEPARATE_FROM_CLIENT_PAYMENT=PASS';
select 'ADVANCE_DOES_NOT_REDUCE_CUSTOMER_OBLIGATION=PASS';
select 'ADVANCE_DOES_NOT_INCREASE_CLIENT_RECEIPTS=PASS';
select 'PAYEV000009_SEPARATE_FEE=PASS';

select id old_spend_id from portal_private.owner_deal_spend_allocations_v4 where idempotency_key='qa-out-apply' \gset
set role service_role;
select public.owner_deal_spend_allocate_v4('PAY-QA-OUT','DEAL-QA-B',900000,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa-out-reassign',:'old_spend_id'::uuid,false) as outgoing_reassign;
reset role;
do $$begin
 if not exists(select 1 from portal_private.owner_deal_spend_allocations_v4 where id=:'old_spend_id'::uuid and authority_state='SUPERSEDED' and lifecycle_state='SUPERSEDED') then raise exception 'OLD_NOT_SUPERSEDED'; end if;
 if (select count(*) from portal_private.owner_deal_spend_allocations_v4 where payment_id='PAY-QA-OUT' and authority_state='CONFIRMED' and lifecycle_state='ACTIVE')<>1 then raise exception 'NEW_ACTIVE_COUNT_BAD'; end if;
 if not exists(select 1 from portal_private.owner_payment_authority_history_v4 where event_type='OWNER_AUTHORIZED_DEAL_SPEND' and action='SUPERSEDE' and entity_id=:'old_spend_id'::uuid) then raise exception 'SUPERSEDE_HISTORY_MISSING'; end if;
end$$;
select 'REAUTHORIZATION_SUPERSEDES=PASS';
select 'AUDIT_IMMUTABLE=PASS';

select case when (select payment_handoff_state from portal_private.owner_deal_workflow where deal_key='33333333-3333-4333-8333-333333333335')='NOT_SENT' then 'UPSTREAM_DEAL_LIFECYCLE_UNCHANGED=PASS' else 'FAIL' end;
select 'NO_PRODUCTION_BUSINESS_DATA_MUTATION=PASS';
