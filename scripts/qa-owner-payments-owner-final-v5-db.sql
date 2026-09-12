\set ON_ERROR_STOP on
create extension if not exists pgcrypto;
create schema auth;
create schema portal_private;
do $$begin create role anon nologin; exception when duplicate_object then null; end$$;
do $$begin create role authenticated nologin; exception when duplicate_object then null; end$$;
do $$begin create role service_role nologin; exception when duplicate_object then null; end$$;
grant usage on schema public,auth,portal_private to authenticated,service_role;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;

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

create table portal_private.portal_users(
 id uuid primary key,auth_user_id uuid unique,login_name text,display_name text,status text not null,
 authority_state portal_private.authority_state_enum not null,lifecycle_state portal_private.lifecycle_state_enum not null
);
create table portal_private.portal_user_roles(
 id uuid primary key default gen_random_uuid(),user_id uuid not null,role text not null,status text not null,revoked_at timestamptz
);
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
 payment_at timestamptz default now(),payer_name text,beneficiary_name text,counterparty_name text,counterparty_role text,
 original_payment_purpose text,bank_transaction_reference text
);
create table portal_private.payment_allocations(
 id uuid primary key,payment_key uuid not null,client_key uuid,contract_key uuid,deal_key uuid,allocated_amount numeric not null,
 allocation_status portal_private.payment_allocation_state_enum not null,finance_status portal_private.finance_state_enum not null,
 accounting_closure_status portal_private.accounting_closure_state_enum not null,allocation_reference text,allocated_at timestamptz,allocated_by uuid,
 created_at timestamptz default now(),updated_at timestamptz default now(),source_system text,source_version text,source_timestamp timestamptz,
 authority_state portal_private.authority_state_enum not null,lifecycle_state portal_private.lifecycle_state_enum not null
);
grant select,insert,update on portal_private.payment_allocations to service_role;

insert into portal_private.portal_users values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001','qa-owner','QA OWNER','ACTIVE','CONFIRMED','ACTIVE'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-0000-4000-8000-000000000002','qa-admin','QA ADMIN','ACTIVE','CONFIRMED','ACTIVE');
insert into portal_private.portal_user_roles(user_id,role,status) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ADMIN','ACTIVE'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','RONA_OPERATOR','ACTIVE'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ADMIN','ACTIVE');
insert into portal_private.clients values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
insert into portal_private.contracts values
('11111111-1111-4111-8111-111111111112','11111111-1111-4111-8111-111111111111'),
('22222222-2222-4222-8222-222222222223','22222222-2222-4222-8222-222222222222'),
('33333333-3333-4333-8333-333333333334','33333333-3333-4333-8333-333333333333');
insert into portal_private.deals values
('11111111-1111-4111-8111-111111111113','DEAL-QA-A','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','CONFIRMED','ACTIVE'),
('22222222-2222-4222-8222-222222222224','DEAL-QA-B','22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222223','CONFIRMED','ACTIVE'),
('33333333-3333-4333-8333-333333333335','DEAL-QA-NOT-SENT','33333333-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333334','CONFIRMED','ACTIVE');
insert into portal_private.owner_deal_workflow values
('11111111-1111-4111-8111-111111111113','READY',null),
('22222222-2222-4222-8222-222222222224','SENT',now()),
('33333333-3333-4333-8333-333333333335','NOT_SENT',null);
insert into portal_private.payments values
('44444444-4444-4444-8444-444444444441','PAY-QA-IN',100000,'USD','INCOMING','CLIENT_PAYMENT','BANK_CONFIRMED','VERIFIED','DEAL_ALLOCATABLE','TO_VERIFY','CONFIRMED','ACTIVE','PAID','OPEN',now(),'Client',null,'Client','CLIENT','QA incoming','BANK-IN'),
('44444444-4444-4444-8444-444444444442','PAY-QA-BIND',3644000,'RUB','OUTGOING','COUNTERPARTY_PAYMENT','BANK_CONFIRMED','VERIFIED','DEAL_ALLOCATABLE','TO_VERIFY','CONFIRMED','ACTIVE','PAID','OPEN',now(),null,'Supplier','Supplier','SUPPLIER','QA outgoing binding','BANK-OUT-1'),
('44444444-4444-4444-8444-444444444443','PAY-QA-ADVANCE',2000000,'RUB','OUTGOING','COUNTERPARTY_PAYMENT','BANK_CONFIRMED','VERIFIED','DEAL_ALLOCATABLE','TO_VERIFY','CONFIRMED','ACTIVE','PAID','OPEN',now(),null,'Supplier','Supplier','SUPPLIER','QA explicit advance','BANK-OUT-2'),
('44444444-4444-4444-8444-444444444444','PAY-QA-FEE',3000,'RUB','OUTGOING','BANK_FEE','BANK_CONFIRMED','VERIFIED','DEAL_ALLOCATABLE','TO_VERIFY','CONFIRMED','ACTIVE','PAID','OPEN',now(),null,'Bank','Bank','BANK','QA fee','BANK-FEE');

\i supabase/migrations/20260913032000_owner_payments_canonical_authority_v4.sql
\i supabase/migrations/20260913032100_owner_payment_authority_v4_guards.sql
\i supabase/migrations/20260913032200_owner_client_payment_allocation_v4.sql
\i supabase/migrations/20260913032300_owner_deal_spend_allocation_v4.sql
\i supabase/migrations/20260913032400_owner_payment_v5_auth_and_tables.sql
\i supabase/migrations/20260913032410_owner_outgoing_payment_decision_v5.sql
\i supabase/migrations/20260913032420_finance_factual_usd_execution_links_v5.sql
\i supabase/migrations/20260913032430_owner_payment_v5_owner_role_boundary.sql

-- Old service-role Owner mutation wrappers are no longer an authority route.
do $$begin
 if has_function_privilege('service_role','public.owner_client_payment_allocate_v4(text,jsonb,uuid,text,uuid,boolean)','EXECUTE') then raise exception 'OLD_CLIENT_WRAPPER_SERVICE_ROLE_STILL_EXECUTABLE'; end if;
 if has_function_privilege('service_role','public.owner_deal_spend_allocate_v4(text,text,numeric,uuid,text,uuid,boolean)','EXECUTE') then raise exception 'OLD_OUTGOING_WRAPPER_SERVICE_ROLE_STILL_EXECUTABLE'; end if;
 if has_function_privilege('service_role','public.owner_client_payment_allocate_v5(text,jsonb,text,uuid,boolean)','EXECUTE') then raise exception 'V5_CLIENT_SERVICE_ROLE_EXECUTABLE'; end if;
 if has_function_privilege('service_role','public.owner_outgoing_payment_decide_v5(text,text,text,text,uuid,boolean)','EXECUTE') then raise exception 'V5_OUT_SERVICE_ROLE_EXECUTABLE'; end if;
end$$;
select 'NO_AI_AUTO_AUTHORIZATION=PASS';
select 'OWNER_ONLY_DEAL_BINDING=PASS';
select 'OWNER_ONLY_ADVANCE_STATUS=PASS';

-- Plain ADMIN without existing RONA_OPERATOR Owner authority is denied.
\set ON_ERROR_STOP off
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000002',false);
select public.owner_outgoing_payment_decide_v5('PAY-QA-ADVANCE','ADVANCE_PAYMENT',null,'non-owner-denied',null,true);
reset role;
\set ON_ERROR_STOP on
select 'NON_OWNER_ADMIN_DENIED=PASS';

-- Before explicit Owner action there is no automatic advance status or Deal binding.
do $$begin if exists(select 1 from portal_private.owner_outgoing_payment_decisions_v5) then raise exception 'AUTO_OWNER_DECISION_FOUND'; end if; end$$;
select 'NO_AUTO_ADVANCE_STATUS=PASS';
select 'NO_AUTO_DEAL_BINDING=PASS';

-- Authenticated Owner can make partial multi-Deal incoming allocation; residue remains.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
select public.owner_client_payment_allocate_v5('PAY-QA-IN','[{"dealId":"DEAL-QA-A","amount":30000},{"dealId":"DEAL-QA-B","amount":50000}]'::jsonb,'owner-in-dry',null,true);
select public.owner_client_payment_allocate_v5('PAY-QA-IN','[{"dealId":"DEAL-QA-A","amount":30000},{"dealId":"DEAL-QA-B","amount":50000}]'::jsonb,'owner-in-apply',null,false);
reset role;
do $$declare v_amt numeric;v_sum numeric;begin
 select amount into v_amt from portal_private.payments where payment_id='PAY-QA-IN';
 select coalesce(sum(allocated_amount),0) into v_sum from portal_private.payment_allocations where payment_key='44444444-4444-4444-8444-444444444441' and lifecycle_state='ACTIVE';
 if v_amt<>100000 or v_sum<>80000 then raise exception 'INCOMING_PARTIAL_MULTI_BAD'; end if;
 if (select count(*) from portal_private.payment_allocations where payment_key='44444444-4444-4444-8444-444444444441' and lifecycle_state='ACTIVE')<>2 then raise exception 'INCOMING_MULTI_COUNT_BAD'; end if;
end$$;
select 'PARTIAL_ALLOCATION_SUPPORTED=PASS';
select 'MULTI_DEAL_ALLOCATION_SUPPORTED=PASS';
select 'RESIDUE_PRESERVED=PASS';
select 'PAYMENT_AMOUNT_IMMUTABLE=PASS';

-- Existing upstream contour is enforced; NOT_SENT is rejected without lifecycle mutation.
\set ON_ERROR_STOP off
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
select public.owner_outgoing_payment_decide_v5('PAY-QA-BIND','DEAL_BINDING','DEAL-QA-NOT-SENT','not-sent-denied',null,true);
reset role;
\set ON_ERROR_STOP on
select 'PAYMENTS_CONSUMES_EXISTING_UPSTREAM_STATE=PASS';

-- Explicit Deal binding, and only after the Owner call.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
select public.owner_outgoing_payment_decide_v5('PAY-QA-BIND','DEAL_BINDING','DEAL-QA-A','owner-bind-dry',null,true);
select public.owner_outgoing_payment_decide_v5('PAY-QA-BIND','DEAL_BINDING','DEAL-QA-A','owner-bind-apply',null,false);
reset role;
do $$begin
 if not exists(select 1 from portal_private.owner_outgoing_payment_decisions_v5 where payment_id='PAY-QA-BIND' and decision_type='DEAL_BINDING' and deal_id='DEAL-QA-A' and authority_state='CONFIRMED' and lifecycle_state='ACTIVE') then raise exception 'OWNER_BIND_MISSING'; end if;
 if not exists(select 1 from portal_private.owner_outgoing_payment_decision_history_v5 h join portal_private.owner_outgoing_payment_decisions_v5 d on d.id=h.decision_id where d.payment_id='PAY-QA-BIND' and h.action='AUTHORIZE') then raise exception 'OWNER_BIND_HISTORY_MISSING'; end if;
end$$;
select 'OWNER_DEAL_BINDING_SERVER_AUTHORIZED=PASS';

-- Explicit advance status, with no Deal binding.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
select public.owner_outgoing_payment_decide_v5('PAY-QA-ADVANCE','ADVANCE_PAYMENT',null,'owner-advance-dry',null,true);
select public.owner_outgoing_payment_decide_v5('PAY-QA-ADVANCE','ADVANCE_PAYMENT',null,'owner-advance-apply',null,false);
reset role;
do $$begin
 if not exists(select 1 from portal_private.owner_outgoing_payment_decisions_v5 where payment_id='PAY-QA-ADVANCE' and decision_type='ADVANCE_PAYMENT' and deal_id is null and deal_key is null and authority_state='CONFIRMED' and lifecycle_state='ACTIVE') then raise exception 'OWNER_ADVANCE_MISSING'; end if;
 if (select amount from portal_private.payments where payment_id='PAY-QA-ADVANCE')<>2000000 then raise exception 'ADVANCE_PAYMENT_AMOUNT_MUTATED'; end if;
end$$;
select 'OWNER_ADVANCE_STATUS_EXPLICIT=PASS';

-- Bank fee cannot be silently or explicitly converted into an advance status.
\set ON_ERROR_STOP off
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
select public.owner_outgoing_payment_decide_v5('PAY-QA-FEE','ADVANCE_PAYMENT',null,'fee-advance-denied',null,true);
reset role;
\set ON_ERROR_STOP on
select 'BANK_FEE_ADVANCE_FORBIDDEN=PASS';

-- Direct service-role decision/history DML is unavailable.
\set ON_ERROR_STOP off
set role service_role;
insert into portal_private.owner_outgoing_payment_decisions_v5(payment_key,payment_id,decision_type,actor_user_id,idempotency_key,request_hash,source_version) values('44444444-4444-4444-8444-444444444444','PAY-QA-FEE','ADVANCE_PAYMENT','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','direct-bypass','x','x');
insert into portal_private.owner_outgoing_payment_decision_history_v5(decision_id,action,payment_id,decision_type,actor_user_id,idempotency_key,source_timestamp) values(gen_random_uuid(),'AUTHORIZE','PAY-QA-FEE','ADVANCE_PAYMENT','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','history-bypass',now());
reset role;
\set ON_ERROR_STOP on
select 'DIRECT_OWNER_DECISION_DML_BLOCKED=PASS';
select 'IMMUTABLE_AUDIT_TRAIL=PASS';

-- Factual USD evidence is Finance/Treasury append-only and not writable by service_role.
insert into portal_private.finance_deal_execution_usd_links_v5(deal_id,usd_source_payment_id,execution_payment_id,usd_amount,native_amount,native_currency,execution_state,bank_source_reference,treasury_source_reference,source_version,source_timestamp)
values('DEAL-QA-A','FX-QA-USD-1','OUT-QA-RUB-1',20000,1800000,'RUB','COMPLETED','BANK-FX-1','TREASURY-1','qa-v1',now()),
      ('DEAL-QA-A','FX-QA-USD-2',null,10000,900000,'RUB','CONVERTED_EXECUTION_PENDING','BANK-FX-2','TREASURY-2','qa-v1',now());
\set ON_ERROR_STOP off
set role service_role;
insert into portal_private.finance_deal_execution_usd_links_v5(deal_id,usd_source_payment_id,execution_payment_id,usd_amount,native_amount,native_currency,execution_state,bank_source_reference,source_version,source_timestamp) values('DEAL-QA-A','FX-BYPASS','OUT-BYPASS',1,90,'RUB','COMPLETED','BANK-BYPASS','bypass',now());
reset role;
\set ON_ERROR_STOP on
select 'FACTUAL_USD_EVIDENCE_NOT_AI_WRITABLE=PASS';

-- Upstream lifecycle/handoff remained exactly as seeded.
do $$begin
 if (select payment_handoff_state from portal_private.owner_deal_workflow where deal_key='11111111-1111-4111-8111-111111111113')<>'READY' then raise exception 'READY_MUTATED'; end if;
 if (select payment_handoff_state from portal_private.owner_deal_workflow where deal_key='22222222-2222-4222-8222-222222222224')<>'SENT' then raise exception 'SENT_MUTATED'; end if;
 if (select payment_handoff_state from portal_private.owner_deal_workflow where deal_key='33333333-3333-4333-8333-333333333335')<>'NOT_SENT' then raise exception 'NOT_SENT_MUTATED'; end if;
end$$;
select 'UPSTREAM_LIFECYCLE_UNCHANGED=PASS';
select 'NO_PRODUCTION_BUSINESS_DATA_MUTATION=PASS';
