\set ON_ERROR_STOP on
-- This file runs on the committed disposable seed, exercising real commit/deferred-trigger boundaries.
create function test_application_v2.expect_error(command text,expected text) returns void language plpgsql as $$
begin
 begin execute command; raise exception 'EXPECTED_ERROR_MISSING: %',expected;
 exception when others then if position(expected in sqlerrm)=0 then raise; end if; end;
 perform test_application_v2.check_true(true,'denied: '||expected);
end $$;
insert into test_application_v2.fixture values('initial_receipt',test_application_v2.submit(1,test_application_v2.bundle(1,'INITIAL',31.75))::text);
select test_application_v2.check_true((test_application_v2.get('initial_receipt')::jsonb->>'bundle_complete')::boolean,'atomic standard receipt committed');
select test_application_v2.check_true(test_application_v2.submit(1,test_application_v2.bundle(1,'INITIAL',31.75))->>'application_id'=test_application_v2.get('initial_receipt')::jsonb->>'application_id','committed retry preserves ID');

begin;
create temp table disabled_before as select (select count(*) from portal_private.client_applications) apps,
 (select count(*) from portal_private.client_application_number_reservations_v2) numbers,
 (select count(*) from portal_private.portal_reverse_events) events;
update portal_private.client_application_policy_v2 set enabled=false;
select test_application_v2.expect_error($q$select portal_private.next_application_business_id(test_application_v2.get('client1')::uuid)$q$,'APPLICATION_BUSINESS_POLICY_NOT_ACTIVE');
select test_application_v2.expect_error($q$select test_application_v2.submit(1,test_application_v2.bundle(1,'DISABLED',12))$q$,'APPLICATION_BUSINESS_POLICY_NOT_ACTIVE');
select test_application_v2.expect_error($q$select test_application_v2.submit(1,test_application_v2.bundle(1,'INITIAL',31.75))$q$,'APPLICATION_BUSINESS_POLICY_NOT_ACTIVE');
select test_application_v2.expect_error($q$select test_application_v2.request(1,test_application_v2.delivered(1,'DISABLED_REQUEST',15))$q$,'APPLICATION_BUSINESS_POLICY_NOT_ACTIVE');
select test_application_v2.check_true((select apps=(select count(*) from portal_private.client_applications) and numbers=(select count(*) from portal_private.client_application_number_reservations_v2) and events=(select count(*) from portal_private.portal_reverse_events) from disabled_before),'disabled policy creates no number/application/event including retries');
update portal_private.client_application_policy_v2 set enabled=true;
update portal_private.ai_service_identities set revoked_at=now();
select test_application_v2.expect_error($q$select test_application_v2.submit(1,test_application_v2.bundle(1,'REVOKED',12))$q$,'APPLICATION_OPERATIONS_AUTHORITY_UNAVAILABLE');
update portal_private.ai_service_identities set revoked_at=null;
select test_application_v2.expect_error($q$insert into portal_private.ai_service_identities(identity_id,business_role,status) values('QA-SECOND-ISSUER','OPERATIONS_DIRECTOR','ACTIVE')$q$,'application_one_active_operations_authority_v2');
commit;

-- Failed second-stage storage must roll back the first stage and its number in the SAME transaction.
create function test_application_v2.fail_details() returns trigger language plpgsql as $$
begin if current_setting('test_application_v2.fail_details',true)='true' and new.payload->>'message_type'='APPLICATION_DETAILS_V5'
 then raise exception 'TEST_DETAILS_STORAGE_UNAVAILABLE'; end if;return new;end $$;
create trigger test_details_failure before insert on portal_private.portal_reverse_events for each row execute function test_application_v2.fail_details();
begin;
create temp table failed_before as select (select count(*) from portal_private.client_applications) apps,
 (select count(*) from portal_private.client_application_number_reservations_v2) numbers,
 (select count(*) from portal_private.portal_reverse_events) events;
set local test_application_v2.fail_details='true';
select test_application_v2.expect_error($q$select test_application_v2.submit(1,test_application_v2.bundle(1,'FAIL_AND_RETRY',37))$q$,'TEST_DETAILS_STORAGE_UNAVAILABLE');
select test_application_v2.check_true((select apps=(select count(*) from portal_private.client_applications) and numbers=(select count(*) from portal_private.client_application_number_reservations_v2) and events=(select count(*) from portal_private.portal_reverse_events) from failed_before),'details failure rolls back business number and entire bundle');
set local test_application_v2.fail_details='false';
select test_application_v2.check_true((test_application_v2.submit(1,test_application_v2.bundle(1,'FAIL_AND_RETRY',37))->>'bundle_complete')::boolean,'same intent succeeds after storage recovers');
commit;
drop trigger test_details_failure on portal_private.portal_reverse_events;

insert into test_application_v2.fixture values('delivered_receipt',test_application_v2.request(1,test_application_v2.delivered(1,'DELIVERED',27.5))::text);
select test_application_v2.check_true(test_application_v2.request(1,test_application_v2.delivered(1,'DELIVERED',27.5))->>'application_id'=test_application_v2.get('delivered_receipt')::jsonb->>'application_id','delivered event retry preserves canonical number');
select test_application_v2.check_true((select count(*)=1 from portal_private.client_intake_task_links_v1 where intake_id=(test_application_v2.get('delivered_receipt')::jsonb->>'intake_id')::uuid),'exactly one Operations routing task for delivered request');
select test_application_v2.expect_error($q$select test_application_v2.request(1,test_application_v2.delivered(1,'DELIVERED',28.5))$q$,'APPLICATION_IDEMPOTENCY_PAYLOAD_CONFLICT');
select test_application_v2.expect_error($q$select test_application_v2.submit(1,test_application_v2.bundle(2,'CROSS_SCOPE',12))$q$,'CLIENT_PRICE_CONTEXT_DENIED');
select test_application_v2.expect_error($q$select portal_private.application_business_authorized_v2(test_application_v2.get('auth1')::uuid,test_application_v2.get('session1')::uuid,'ADMIN')$q$,'APPLICATION_SCOPE_DENIED');
select test_application_v2.expect_error($q$select portal_private.application_business_authorized_v2(test_application_v2.get('auth1')::uuid,test_application_v2.get('session1')::uuid,'CLIENT',test_application_v2.get('client_id2'),test_application_v2.get('contract_id2'))$q$,'APPLICATION_SCOPE_DENIED');
select test_application_v2.expect_error($q$select portal_private.application_business_authorized_v2(test_application_v2.get('auth1')::uuid,gen_random_uuid(),'CLIENT',test_application_v2.get('client_id1'),test_application_v2.get('contract_id1'))$q$,'APPLICATION_SESSION_DENIED');

do $$ declare role portal_private.ai_business_role_enum; common jsonb; id text:=test_application_v2.get('delivered_receipt')::jsonb->>'application_id';begin
 foreach role in array enum_range(null::portal_private.ai_business_role_enum) loop
  common:=portal_private.ai_role_state_current_v2(role);
  perform test_application_v2.check_true(exists(select 1 from jsonb_array_elements(common#>'{application_common_identity,references}') x
    where x->>'application_id'=id and x->>'numbering_origin'='OPERATIONS_EXECUTOR' and x->>'numbering_identity_id'=(select identity_id from portal_private.ai_service_identities where revoked_at is null)),
   'same canonical ID and actual issuer in common role state: '||role::text);
  perform test_application_v2.check_true(common->>'unrelated_sentinel'='UNCHANGED','non-application role state preserved: '||role::text);
 end loop;
 perform test_application_v2.check_true(portal_private.canonical_target_snapshot('APPLICATION',id)->>'canonical_application_id'=id,'actual shared canonical resolver resolves application');
 perform test_application_v2.check_true(portal_private.canonical_target_snapshot('PAYMENT','SENTINEL')->>'legacy_type'='PAYMENT','non-application shared resolver delegates unchanged');
end $$;

-- Resource denial is an authenticated Owner/Admin business action; deletion occurs
-- at transaction completion, with NO reconciliation call and no AI-originated refusal.
select set_config('request.jwt.claims',jsonb_build_object('sub',test_application_v2.get('auth3'),'session_id',test_application_v2.get('session3'))::text,false);
begin;
select public.owner_r1_application_business_action_v2(
 test_application_v2.get('delivered_receipt')::jsonb->>'application_id','RESOURCE_DENIED',
 jsonb_build_object('reason','ISOLATED_RESOURCE_DENIED'));
commit;
select test_application_v2.check_true(not exists(select 1 from portal_private.client_applications where application_id=test_application_v2.get('delivered_receipt')::jsonb->>'application_id'),'resource refusal removes business row at action commit');
select test_application_v2.check_true(portal_private.canonical_target_snapshot('APPLICATION',test_application_v2.get('delivered_receipt')::jsonb->>'application_id')->>'status'='DELETED','common resolver returns immutable deletion provenance, not active business row');
select test_application_v2.expect_error($q$select test_application_v2.request(1,test_application_v2.delivered(1,'DELIVERED',27.5))$q$,'APPLICATION_RETIRED_NO_RESUBMISSION');

insert into test_application_v2.fixture values('stale_receipt',test_application_v2.submit(1,test_application_v2.bundle(1,'STALE_SOURCE',41))::text);
insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
 values(test_application_v2.get('user3')::uuid,'ADMIN','APPLICATION_RETIREMENT_CONFIRMED','APPLICATION',
 test_application_v2.get('stale_receipt')::jsonb->>'application_id',jsonb_build_object('disposition','DELETE','reason_code','STALE'));
select test_application_v2.check_true(not exists(select 1 from portal_private.client_applications where application_id=test_application_v2.get('stale_receipt')::jsonb->>'application_id'),'authoritative stale action deletes immediately without periodic reconciliation');

-- Cancelled-and-closed Deal provenance survives physical application retirement.
insert into test_application_v2.fixture values('deal_retirement_receipt',test_application_v2.submit(2,test_application_v2.bundle(2,'DEAL_RETIREMENT',44))::text);
-- Owner authorizes the commercial lifecycle before the Operations-side Deal registration.
select public.owner_r1_application_business_action_v2(
 test_application_v2.get('deal_retirement_receipt')::jsonb->>'application_id','ACCEPT','{}'::jsonb);
select public.owner_r1_application_business_action_v2(
 test_application_v2.get('deal_retirement_receipt')::jsonb->>'application_id','RESOURCE_APPROVED','{}'::jsonb);
select public.owner_r1_application_business_action_v2(
 test_application_v2.get('deal_retirement_receipt')::jsonb->>'application_id','DEAL_HANDOFF','{}'::jsonb);
do $$ declare a uuid; d uuid; begin
 select id into a from portal_private.client_applications where application_id=test_application_v2.get('deal_retirement_receipt')::jsonb->>'application_id';
 insert into portal_private.deals(deal_id,client_key,contract_key,business_status,lifecycle_state)
 values('QA-DEAL-'||gen_random_uuid(),test_application_v2.get('client2')::uuid,test_application_v2.get('contract2')::uuid,'CANCELLED','CLOSED') returning id into d;
 update portal_private.client_applications set linked_deal_key=d,status='DEAL_REGISTERED',lifecycle_state='ARCHIVED' where id=a;
 insert into portal_private.deal_registrations(application_key,deal_key) values(a,d);
 insert into test_application_v2.fixture values('retired_app_key',a::text),('retained_deal_key',d::text),
 ('deal_before',(select to_jsonb(x)::text from portal_private.deals x where id=d)),
 ('registration_before',(select to_jsonb(x)::text from portal_private.deal_registrations x where application_key=a));
end $$;
select public.owner_r1_application_business_action_v2(
 test_application_v2.get('deal_retirement_receipt')::jsonb->>'application_id','RESOURCE_DENIED',
 jsonb_build_object('reason','ISOLATED_CLOSED_DEAL_CANCELLATION'));
select test_application_v2.check_true(not exists(select 1 from portal_private.client_applications where id=test_application_v2.get('retired_app_key')::uuid),'cancelled application with closed cancelled Deal physically retired');
select test_application_v2.check_true((select to_jsonb(x)::text=test_application_v2.get('deal_before') from portal_private.deals x where id=test_application_v2.get('retained_deal_key')::uuid),'linked Deal row byte-equivalent JSON before/after deletion');
select test_application_v2.check_true((select to_jsonb(x)::text=test_application_v2.get('registration_before') from portal_private.deal_registrations x where application_key=test_application_v2.get('retired_app_key')::uuid),'registration row and original application key preserved');
select test_application_v2.check_true(exists(select 1 from portal_private.client_application_deal_provenance_v2 where application_key=test_application_v2.get('retired_app_key')::uuid),'immutable application-to-deal provenance recorded');
alter table portal_private.deal_registrations validate constraint deal_registrations_application_registry_v2_fkey;
select test_application_v2.check_true((select convalidated from pg_constraint where conname='deal_registrations_application_registry_v2_fkey'),'permanent-identity registration FK validated');
select test_application_v2.expect_error($q$update portal_private.client_application_deal_provenance_v2 set source_sha256='ALTERED'$q$,'APPLICATION_AUDIT_IS_APPEND_ONLY');

-- Two independent reconciliation passes must not restore a retired application or a duplicate task.
create temp table before_reconcile as select (select count(*) from portal_private.client_applications) apps,(select count(*) from portal_private.staff_tasks) tasks;
select portal_private.reconcile_client_intake_v1(500,interval '5 minutes');
select portal_private.reconcile_client_applications_v2(500);
select portal_private.reconcile_client_intake_v1(500,interval '5 minutes');
select portal_private.reconcile_client_applications_v2(500);
select test_application_v2.check_true((select apps=(select count(*) from portal_private.client_applications) and tasks=(select count(*) from portal_private.staff_tasks) from before_reconcile),'no application/task resurrection across two legacy+new reconciliation passes');
select test_application_v2.check_true(not exists(select 1 from portal_private.client_applications a join portal_private.client_intake_v1 i on i.intake_id=a.source_intake_key where i.actionable_type like 'APPLICATION_DETAILS_%'),'technical detail event never becomes a separate business application');
select test_application_v2.check_true((select count(*)=(select count(*) from portal_private.client_application_number_reservations_v2) from portal_private.client_application_registry_v2 where numbering_origin='OPERATIONS_EXECUTOR'),'every number belongs to exactly one permanent canonical registry identity');
select test_application_v2.check_true((portal_private.application_business_projection_v2('ADMIN')#>>'{application_kpi,total}')::integer=(select count(*) from portal_private.client_applications),'server KPI equals actual retained business storage after lifecycle actions');
select test_application_v2.check_true((portal_private.application_business_projection_v2('ADMIN')#>>'{application_kpi,tonnage}')::numeric=(select sum(quantity_tonnes) from portal_private.client_applications),'server tonnage counts only live business rows');
select test_application_v2.check_true(not exists(select 1 from portal_private.client_application_bundle_receipts_v2 b left join portal_private.client_application_registry_v2 r on r.application_id=b.application_id where r.application_id is null),'every committed bundle receipt retains canonical identity even after deletion');
\echo REVIEW_LIFECYCLE_COMMIT_BOUNDARY_REGRESSIONS_COMPLETE
