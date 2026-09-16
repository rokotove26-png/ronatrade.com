\set ON_ERROR_STOP on
-- Disposable, actual SQL/ACL/trigger tests. No production authorization is granted here.
do $$ begin if to_regclass('portal_private.qa_session_roles') is null or to_regclass('test_application_v2.fixture') is null
 then raise exception 'DISPOSABLE_DATABASE_REQUIRED'; end if; end $$;
begin;
create temp table authority_before as select
 (select count(*) from portal_private.client_applications) applications,
 (select count(*) from portal_private.client_application_number_reservations_v2) reservations,
 (select count(*) from portal_private.portal_reverse_events) events;
update portal_private.client_application_policy_v2 set numbering_delegation_id=null;
select test_application_v2.expect_error($q$select portal_private.next_application_business_id(test_application_v2.get('client1')::uuid)$q$,'APPLICATION_NUMBERING_DELEGATION_NOT_APPROVED');
select test_application_v2.expect_error($q$select test_application_v2.submit(1,test_application_v2.bundle(1,'NO_APPROVAL',29))$q$,'APPLICATION_NUMBERING_DELEGATION_NOT_APPROVED');
select test_application_v2.expect_error($q$select portal_private.materialize_client_application_v2((select intake_id from portal_private.client_intake_v1 limit 1))$q$,'APPLICATION_NUMBERING_DELEGATION_NOT_APPROVED');
select test_application_v2.expect_error($q$select portal_private.application_business_projection_v2('ADMIN')$q$,'APPLICATION_NUMBERING_DELEGATION_NOT_APPROVED');
select test_application_v2.check_true((select applications=(select count(*) from portal_private.client_applications)
 and reservations=(select count(*) from portal_private.client_application_number_reservations_v2)
 and events=(select count(*) from portal_private.portal_reverse_events) from authority_before),'missing independent approval causes zero writes and no collection');
rollback;

begin;
delete from portal_private.client_application_policy_v2;
select test_application_v2.expect_error($q$select test_application_v2.submit(1,test_application_v2.bundle(1,'NO_POLICY',29))$q$,'APPLICATION_BUSINESS_POLICY_NOT_ACTIVE');
rollback;

select test_application_v2.check_true((select not rolcanlogin and not rolsuper and not rolcreaterole and not rolbypassrls from pg_roles where rolname='rona_application_executor_v2'),'numbering executor is a non-login non-superuser role');
select test_application_v2.check_true((select pg_get_userbyid(proowner)='rona_application_executor_v2' and prosecdef
 from pg_proc where oid='portal_private.operations_issue_application_number_v2(uuid)'::regprocedure),'issuance entrypoint runs as the protected executor, not a copied identity label');
do $$ declare r text; f text;begin
 foreach r in array array['anon','authenticated','service_role'] loop
  perform test_application_v2.check_true(not pg_has_role(r,'rona_application_executor_v2','MEMBER'),'no executor role membership: '||r);
  foreach f in array array[
   'portal_private.operations_issue_application_number_v2(uuid)',
   'portal_private.reserve_application_number_internal_v2(uuid)',
   'portal_private.next_application_business_id(uuid)',
   'portal_private.submit_client_application_bundle_v2(uuid,uuid,jsonb,uuid,uuid)',
   'portal_private.submit_delivered_application_bundle_v2(uuid,uuid,jsonb,uuid,uuid)',
   'portal_private.ensure_application_registry_v2(uuid)',
   'portal_private.materialize_client_application_v2(uuid)',
   'portal_private.retire_client_application_v2(uuid)'] loop
   perform test_application_v2.check_true(not has_function_privilege(r,f,'EXECUTE'),'private-only mutation: '||r||'/'||f);
  end loop;
  perform test_application_v2.check_true(not has_table_privilege(r,'portal_private.client_application_numbering_delegations_v2','INSERT'),'cannot fabricate independent approval: '||r);
 end loop;
end $$;

begin;
select test_application_v2.expect_error($q$update portal_private.client_application_numbering_delegations_v2 set approval_source_ref='FORGED'$q$,'APPLICATION_AUDIT_IS_APPEND_ONLY');
select test_application_v2.expect_error($q$delete from portal_private.client_application_number_reservations_v2$q$,'APPLICATION_NUMBER_RESERVATION_PERMANENT');
select test_application_v2.expect_error($q$update portal_private.client_application_number_reservations_v2 set executor_role='postgres'$q$,'APPLICATION_NUMBER_RESERVATION_IMMUTABLE');
select test_application_v2.expect_error($q$update portal_private.client_application_registry_v2 set application_id=application_id||'-FORGED'$q$,'APPLICATION_REGISTRY_IDENTITY_IMMUTABLE');
select test_application_v2.expect_error($q$delete from portal_private.client_application_registry_v2$q$,'APPLICATION_REGISTRY_IS_PERMANENT');
select test_application_v2.expect_error($q$insert into portal_private.client_application_legacy_inventory_v2(application_key,application_id,client_key,contract_key,source_snapshot,source_sha256) values(gen_random_uuid(),'FORGED',gen_random_uuid(),gen_random_uuid(),'{}','FORGED')$q$,'APPLICATION_AUDIT_IS_APPEND_ONLY');
select test_application_v2.expect_error($q$insert into portal_private.client_application_registry_v2(application_key,application_id,client_key,contract_key,source_kind,source_record_id,numbering_origin) values(gen_random_uuid(),test_application_v2.get('client_id1')||'-IN-2026-99999',test_application_v2.get('client1')::uuid,test_application_v2.get('contract1')::uuid,'CLIENT_APPLICATION','FORGED_SOURCE','AUTHORITATIVE_LEGACY')$q$,'APPLICATION_LEGACY_BACKFILL_NOT_AUTHORIZED');
select test_application_v2.expect_error($q$delete from portal_private.client_application_source_disposition_v2$q$,'APPLICATION_SOURCE_DISPOSITION_PERMANENT');
select test_application_v2.expect_error($q$update portal_private.client_application_source_disposition_v2 set disposition='BUSINESS' where disposition='DELETED'$q$,'APPLICATION_SOURCE_DISPOSITION_IMMUTABLE');
select test_application_v2.expect_error($q$update portal_private.client_application_bundle_receipts_v2 set application_id='FORGED'$q$,'APPLICATION_AUDIT_IS_APPEND_ONLY');
rollback;

-- String shape and an ok flag cannot replace canonical persisted relations.
select test_application_v2.expect_error($q$select portal_private.validate_application_submit_receipt_v2(jsonb_build_object('ok',true,'business_contract','RONA_APPLICATION_BUSINESS_V2','bundle_complete',true,'application_id',test_application_v2.get('client_id1')||'-IN-2026-99999','intake_id',gen_random_uuid(),'durable_id',gen_random_uuid(),'source_id','TECHNICAL_ONLY'))$q$,'APPLICATION_CANONICAL_SUCCESS_NOT_COMMITTED');
select test_application_v2.expect_error($q$select test_application_v2.request(1,jsonb_set(test_application_v2.delivered(1,'UNSUPPORTED_SUCCESS',29),'{payload,message_type}','"NON_APPLICATION"'))$q$,'APPLICATION_DELIVERED_SOURCE_CONFLICT');

insert into test_application_v2.fixture values('authority_receipt',test_application_v2.request(1,test_application_v2.delivered(1,'AUTHORITY_REVIEW',29.843))::text);
select test_application_v2.check_true(portal_private.application_common_snapshot_v2(test_application_v2.get('authority_receipt')::jsonb->>'application_id')#>>'{numbering_execution,mode}'='REVIEWED_INTERNAL_DELEGATION','common snapshot declares real delegated execution rather than an AI signature');
select test_application_v2.check_true(portal_private.application_common_snapshot_v2(test_application_v2.get('authority_receipt')::jsonb->>'application_id')#>>'{numbering_execution,approval_source_ref}'='ISOLATED_TEST_APPROVAL_NOT_PRODUCTION','common identity retains exact independent approval reference');
select set_config('request.jwt.claims',jsonb_build_object('sub',test_application_v2.get('auth3'),'session_id',test_application_v2.get('session3'))::text,false);
select test_application_v2.expect_error(
 $$select public.owner_r1_application_business_action_v2(test_application_v2.get('authority_receipt')::jsonb->>'application_id','ACCEPT','{}')$$,
 'APPLICATION_PRICE_AGREEMENT_REQUIRED');

-- Owner correction updates the business projection, never the immutable submitted payload.
create temp table correction_raw_before as select i.intake_id,i.source_payload,e.payload event_payload
 from portal_private.client_intake_v1 i join portal_private.portal_reverse_events e on e.id=i.source_internal_key
 where i.intake_id=(test_application_v2.get('authority_receipt')::jsonb->>'intake_id')::uuid;
select portal_private.append_client_intake_correction_v1(
 (test_application_v2.get('authority_receipt')::jsonb->>'intake_id')::uuid,
 'payload.quantity_tonnes','29.843','28.317','OWNER','ISOLATED_OWNER_CONFIRMED_CLIENT_INPUT_ERROR');
select test_application_v2.check_true((select a.quantity_tonnes=28.317 from portal_private.client_applications a
 where a.application_id=test_application_v2.get('authority_receipt')::jsonb->>'application_id'),'Owner pre-deal correction updates canonical quantity');
select test_application_v2.check_true(not exists(select 1 from correction_raw_before b join portal_private.client_intake_v1 i using(intake_id)
 join portal_private.portal_reverse_events e on e.id=i.source_internal_key where b.source_payload<>i.source_payload or b.event_payload<>e.payload),'Owner correction preserves both immutable source payloads');
select set_config('request.jwt.claims',jsonb_build_object('sub',test_application_v2.get('auth3'),'session_id',test_application_v2.get('session3'))::text,false);
select public.owner_r1_application_business_action_v2(
 test_application_v2.get('authority_receipt')::jsonb->>'application_id','COUNTER_OFFER',
 jsonb_build_object('price',617.43,'currency','USD'));
-- Simulate the authenticated client response path only; the Owner counter was already recorded.
update portal_private.owner_application_workflow set business_status='CLIENT_COUNTER_ACCEPTED',client_counter_response='ACCEPTED',updated_at=now()
 where application_key=(select id from portal_private.client_applications where application_id=test_application_v2.get('authority_receipt')::jsonb->>'application_id');
update portal_private.client_applications set status='ACCEPTED_AWAITING_DEAL_REGISTRATION',decision_reason='CLIENT_ACCEPTED_ADMIN_COUNTER'
 where application_id=test_application_v2.get('authority_receipt')::jsonb->>'application_id';
select test_application_v2.check_true((select a.price_mode::text='CLIENT_PROPOSED_PRICE' and a.proposed_price=617.43 and a.proposed_currency='USD'
 from portal_private.client_applications a where a.application_id=test_application_v2.get('authority_receipt')::jsonb->>'application_id'),'delivered request becomes agreed application only through recorded acceptance');
select test_application_v2.check_true((select count(*)=1 and min(quantity_tonnes)=28.317 from portal_private.application_lines
 where application_key=(select id from portal_private.client_applications where application_id=test_application_v2.get('authority_receipt')::jsonb->>'application_id')),'agreement creates exactly one line with the effective quantity');
select test_application_v2.check_true((portal_private.application_common_snapshot_v2(test_application_v2.get('authority_receipt')::jsonb->>'application_id')->>'price_is_owner_agreed')::boolean,'numeric price carries the accepted-owner colour flag');

-- Owner explicitly authorizes resource and Deal handoff; Operations may then perform the technical registration.
select public.owner_r1_application_business_action_v2(
 test_application_v2.get('authority_receipt')::jsonb->>'application_id','RESOURCE_APPROVED','{}'::jsonb);
select public.owner_r1_application_business_action_v2(
 test_application_v2.get('authority_receipt')::jsonb->>'application_id','DEAL_HANDOFF','{}'::jsonb);
-- Active registered Deal is protected. Even Owner cannot tear active Deal lineage through a refusal action.
do $$ declare a uuid;d uuid;begin
 select id into a from portal_private.client_applications where application_id=test_application_v2.get('authority_receipt')::jsonb->>'application_id';
 insert into portal_private.deals(deal_id,client_key,contract_key,business_status,lifecycle_state)
 values('QA-ACTIVE-DEAL-'||gen_random_uuid(),test_application_v2.get('client1')::uuid,test_application_v2.get('contract1')::uuid,'EXECUTING','ACTIVE') returning id into d;
 update portal_private.client_applications set status='DEAL_REGISTERED',linked_deal_key=d where id=a;
 insert into portal_private.deal_registrations(application_key,deal_key) values(a,d);
end $$;
select test_application_v2.expect_error($q$select portal_private.append_client_intake_correction_v1((test_application_v2.get('authority_receipt')::jsonb->>'intake_id')::uuid,'payload.quantity_tonnes','29.843','26','OWNER','ISOLATED_POST_DEAL')$q$,'APPLICATION_CORRECTION_REQUIRES_POST_DEAL_REVIEW');
select test_application_v2.expect_error(
 $$select public.owner_r1_application_business_action_v2(test_application_v2.get('authority_receipt')::jsonb->>'application_id','RESOURCE_DENIED',jsonb_build_object('reason','ISOLATED_ACTIVE_DEAL_DENIAL'))$$,
 'ACTIVE_DEAL_RESOURCE_DENIAL_FORBIDDEN');
select test_application_v2.check_true((select status::text='DEAL_REGISTERED' from portal_private.client_applications where application_id=test_application_v2.get('authority_receipt')::jsonb->>'application_id'),'blocked active-Deal denial leaves Deal-linked application unchanged');
\echo REVIEW_AUTHORITY_AND_CORRECTION_REGRESSIONS_COMPLETE
