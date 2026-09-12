\set ON_ERROR_STOP on

-- This script runs after qa-payment-allocation-fresh-authority-materialization-v1.sql
-- in the same ephemeral PostgreSQL database and reuses its isolated fixtures.
\ir ../supabase/migrations/20260913021000_payment_allocation_authority_exclusivity_v1.sql

-- Match production service_role: BYPASSRLS + SELECT/INSERT/UPDATE, no DELETE.
alter role service_role nosuperuser nocreaterole nocreatedb noreplication bypassrls;
grant usage on schema portal_private to service_role;
grant select,insert,update on portal_private.payment_allocations to service_role;
revoke delete on portal_private.payment_allocations from service_role;

do $$
declare r record;
begin
  select rolsuper,rolbypassrls into r from pg_roles where rolname='service_role';
  if r.rolsuper or not r.rolbypassrls then raise exception 'SERVICE_ROLE_ROLE_FLAGS_NOT_PRODUCTION_EQUIVALENT'; end if;
  if not has_table_privilege('service_role','portal_private.payment_allocations','select,insert,update') then raise exception 'SERVICE_ROLE_DML_GRANTS_MISSING'; end if;
  if has_table_privilege('service_role','portal_private.payment_allocations','delete') then raise exception 'SERVICE_ROLE_DELETE_MUST_BE_ABSENT'; end if;
  if has_table_privilege('service_role','portal_private.payment_allocation_authority_history_v1','insert') then raise exception 'SERVICE_ROLE_HISTORY_INSERT_MUST_BE_ABSENT'; end if;
  if has_table_privilege('service_role','portal_private.payment_allocation_authority_history_v1','update') then raise exception 'SERVICE_ROLE_HISTORY_UPDATE_MUST_BE_ABSENT'; end if;
end $$;
\echo PRODUCTION_EQUIVALENT_PRIVILEGES=PASS

-- A. Direct fresh INSERT is permitted by table grant, but COMMIT must fail without history.
set role service_role;
\set ON_ERROR_STOP off
begin;
insert into portal_private.payment_allocations(
  id,payment_key,client_key,contract_key,deal_key,allocated_amount,allocation_status,finance_status,
  accounting_closure_status,source_system,source_version,source_timestamp,authority_state,lifecycle_state)
select 'aaaaaaaa-0000-4000-8000-000000000001',p.id,d.client_key,d.contract_key,d.id,p.amount,
       'VERIFIED','PAID','OPEN','FINANCE_SOURCE_LOCKED_RECONCILIATION','DIRECT-BYPASS',now(),'CONFIRMED','ACTIVE'
  from portal_private.payments p join portal_private.deals d on d.deal_id='DEAL-2026-004'
 where p.payment_id='PAYEV-2026-000001';
commit;
\set direct_fresh_insert_state :SQLSTATE
\set ON_ERROR_STOP on
reset role;
select case when :'direct_fresh_insert_state'='23514' then 1 else 1/0 end;
do $$ begin
  if exists(select 1 from portal_private.payment_allocations where id='aaaaaaaa-0000-4000-8000-000000000001') then raise exception 'DIRECT_FRESH_INSERT_SURVIVED'; end if;
end $$;
\echo DIRECT_FRESH_INSERT_BYPASS_BLOCKED=PASS

-- C. service_role cannot write immutable authority history directly.
set role service_role;
\set ON_ERROR_STOP off
insert into portal_private.payment_allocation_authority_history_v1 default values;
\set direct_history_write_state :SQLSTATE
\set ON_ERROR_STOP on
reset role;
select case when :'direct_history_write_state'='42501' then 1 else 1/0 end;
\echo DIRECT_HISTORY_WRITE_BLOCKED=PASS

-- B. Forge the old custom GUC and attempt fresh ACTIVE -> SUPERSEDED directly.
select id::text as fresh_allocation_id from portal_private.payment_allocations
 where payment_key='8a757f03-3ad4-5656-984a-c942d91b07db'
   and source_system='FINANCE_SOURCE_LOCKED_RECONCILIATION'
   and authority_state='CONFIRMED' and lifecycle_state='ACTIVE' \gset
set role service_role;
\set ON_ERROR_STOP off
begin;
select set_config('rona.payment_allocation_authority_mutation_v1','supersede',true);
update portal_private.payment_allocations set authority_state='SUPERSEDED',lifecycle_state='SUPERSEDED'
 where id=:'fresh_allocation_id'::uuid;
commit;
\set manual_guc_update_state :SQLSTATE
\set ON_ERROR_STOP on
reset role;
select case when :'manual_guc_update_state'='23514' then 1 else 1/0 end;
do $$ begin
  if (select authority_state::text||'/'||lifecycle_state::text from portal_private.payment_allocations where id=:'fresh_allocation_id'::uuid)<>'CONFIRMED/ACTIVE' then raise exception 'MANUAL_GUC_UPDATE_SURVIVED'; end if;
end $$;
\echo MANUAL_GUC_UPDATE_BYPASS_BLOCKED=PASS

-- D/E. Controlled SECURITY DEFINER RPC succeeds with the same direct-DML service_role grants.
-- Reuse the rollback fixture from the prior QA; its previous forced failure left OLD intact.
set role service_role;
select public.payment_allocation_fresh_authority_materialize_v1(
  'PAYEV-QA-ROLLBACK','10101010-1010-4010-8010-101010101010','rollback-v1',
  '12121212-1212-4212-8212-121212121212','13131313-1313-4313-8313-131313131313',
  'qa-controlled-rpc-exclusivity-v1',false);
reset role;
do $$ begin
  if (select amount from portal_private.payments where payment_id='PAYEV-QA-ROLLBACK')<>100 then raise exception 'PAYMENT_AMOUNT_CHANGED'; end if;
  if (select authority_state::text||'/'||lifecycle_state::text from portal_private.payment_allocations where id='10101010-1010-4010-8010-101010101010')<>'SUPERSEDED/SUPERSEDED' then raise exception 'CONTROLLED_OLD_NOT_SUPERSEDED'; end if;
  if (select count(*) from portal_private.payment_allocations pa join portal_private.payments p on p.id=pa.payment_key where p.payment_id='PAYEV-QA-ROLLBACK' and pa.lifecycle_state='ACTIVE')<>1 then raise exception 'CONTROLLED_ACTIVE_COUNT_NOT_ONE'; end if;
  if (select count(*) from portal_private.payment_allocation_authority_history_v1 h where h.finance_proposal_id='13131313-1313-4313-8313-131313131313')<>1 then raise exception 'CONTROLLED_HISTORY_MISSING'; end if;
end $$;
\echo CONTROLLED_RPC_ONLY_COMMIT=PASS

-- F. Force history INSERT failure after old supersede + fresh insert; entire RPC rolls back.
create or replace function portal_private.qa_fail_authority_history_insert_v1()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('qa.fail_authority_history_insert',true),'')='1' then
    raise exception using errcode='P0001',message='QA_FORCED_HISTORY_INSERT_FAILURE';
  end if;
  return new;
end $$;
create trigger trg_qa_fail_authority_history_insert_v1 before insert on portal_private.payment_allocation_authority_history_v1
for each row execute function portal_private.qa_fail_authority_history_insert_v1();

insert into portal_private.payments values(
  '14141414-1414-4414-8414-141414141414','PAYEV-QA-HISTORY-ROLLBACK',100,'USD','INCOMING','CLIENT_PAYMENT',
  'DEAL_ALLOCATABLE','BANK_CONFIRMED','VERIFIED','CONFIRMED','ACTIVE','PAID','OPEN');
insert into portal_private.deals values(
  '15151515-1515-4515-8515-151515151515','DEAL-QA-HISTORY-ROLLBACK',
  '16161616-1616-4616-8616-161616161616','17171717-1717-4717-8717-171717171717');
insert into portal_private.payment_allocations(
  id,payment_key,client_key,contract_key,deal_key,allocated_amount,allocation_status,finance_status,accounting_closure_status,
  source_system,source_version,source_timestamp,authority_state,lifecycle_state)
values('18181818-1818-4818-8818-181818181818','14141414-1414-4414-8414-141414141414','16161616-1616-4616-8616-161616161616',
  '17171717-1717-4717-8717-171717171717','15151515-1515-4515-8515-151515151515',100,'VERIFIED','PAID','OPEN','OLD','history-rollback-v1',now(),'CONFIRMED','ACTIVE');
insert into portal_private.ai_coordination_records values(
  '19191919-1919-4919-8919-191919191919','FUNCTIONAL_CONCLUSION','FINANCE','PAYMENT','PAYEV-QA-HISTORY-ROLLBACK','APPROVED',false,
  '{"confirmed":true,"entity_type":"PAYMENT","entity_id":"PAYEV-QA-HISTORY-ROLLBACK","open_issues":[]}'::jsonb,'[]'::jsonb,now());
insert into portal_private.ai_coordination_records values(
  '20202020-2020-4020-8020-202020202020','BUSINESS_CHANGE_PROPOSAL','FINANCE','PAYMENT','PAYEV-QA-HISTORY-ROLLBACK','PROPOSED',false,
  '{"proposed_action":"RECONCILE_CURRENT_PAYMENT_ALLOCATION","proposed_field":"payment_allocation.current","proposed_value":{"currency":"USD","payment_id":"PAYEV-QA-HISTORY-ROLLBACK","payment_amount":100,"allocations":[{"deal_id":"DEAL-QA-HISTORY-ROLLBACK","allocated_amount":100,"allocation_status":"VERIFIED_SOURCE_LOCKED"}],"allocated_total":100,"unallocated_residue":0,"preserve_audit_history":true,"preserve_payment_amount":true}}'::jsonb,
  '["FINANCE_CONCLUSION:19191919-1919-4919-8919-191919191919"]'::jsonb,now());
set role service_role;
\set ON_ERROR_STOP off
begin;
select set_config('qa.fail_authority_history_insert','1',true);
select public.payment_allocation_fresh_authority_materialize_v1(
  'PAYEV-QA-HISTORY-ROLLBACK','18181818-1818-4818-8818-181818181818','history-rollback-v1',
  '19191919-1919-4919-8919-191919191919','20202020-2020-4020-8020-202020202020','qa-history-rollback-v1',false);
\set history_failure_state :SQLSTATE
rollback;
\set ON_ERROR_STOP on
reset role;
select case when :'history_failure_state'='P0001' then 1 else 1/0 end;
do $$ begin
  if (select authority_state::text||'/'||lifecycle_state::text from portal_private.payment_allocations where id='18181818-1818-4818-8818-181818181818')<>'CONFIRMED/ACTIVE' then raise exception 'HISTORY_FAILURE_DID_NOT_RESTORE_OLD'; end if;
  if exists(select 1 from portal_private.payment_allocations where payment_key='14141414-1414-4414-8414-141414141414' and source_system='FINANCE_SOURCE_LOCKED_RECONCILIATION') then raise exception 'HISTORY_FAILURE_LEFT_NEW'; end if;
end $$;
\echo ROLLBACK_HISTORY_ATOMIC=PASS
\echo SERVER_ONLY_AUTHORITY_EXCLUSIVITY=PASS
