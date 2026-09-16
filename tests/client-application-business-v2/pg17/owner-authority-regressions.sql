\set ON_ERROR_STOP on
-- SYSTEM_ADMIN re-review 5699785446: prove the negative Owner/Admin-vs-AI boundary.
-- Disposable fixture only. Production is not mutated by this test.
do $$ begin
 if to_regclass('test_application_v2.fixture') is null or test_application_v2.get('auth4') is null
 then raise exception 'DISPOSABLE_OWNER_AUTHORITY_FIXTURE_REQUIRED'; end if;
end $$;

select test_application_v2.check_true(
 has_function_privilege('authenticated','public.owner_r1_application_business_action_v2(text,text,jsonb)','EXECUTE'),
 'authenticated portal role can reach the Owner/Admin business-action RPC');
select test_application_v2.check_true(
 not has_function_privilege('anon','public.owner_r1_application_business_action_v2(text,text,jsonb)','EXECUTE'),
 'anonymous role cannot reach Owner/Admin business actions');
select test_application_v2.check_true(
 not has_function_privilege('service_role','public.owner_r1_application_business_action_v2(text,text,jsonb)','EXECUTE'),
 'service role cannot impersonate Owner/Admin business actions through RPC');
select test_application_v2.check_true(
 not has_function_privilege('authenticated','portal_private.application_owner_admin_actor_v2()','EXECUTE'),
 'private Owner/Admin actor resolver is not directly callable by browser/API role');

insert into test_application_v2.fixture values(
 'owner_boundary_receipt',test_application_v2.submit(1,test_application_v2.bundle(1,'OWNER_BOUNDARY',33.25))::text
);
insert into portal_private.owner_application_workflow(application_key)
 select id from portal_private.client_applications
 where application_id=test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id'
 on conflict(application_key) do nothing;

-- AI Operations identity/session: every Owner-only commercial/resource action must fail closed.
select set_config('request.jwt.claims',jsonb_build_object(
 'sub',test_application_v2.get('auth4'),'session_id',test_application_v2.get('session4'),'role','authenticated')::text,false);
select test_application_v2.expect_error(
 $$select public.owner_r1_application_business_action_v2(test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id','ACCEPT','{}')$$,
 'APPLICATION_OWNER_ADMIN_REQUIRED');
select test_application_v2.expect_error(
 $$select public.owner_r1_application_business_action_v2(test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id','REJECT','{}')$$,
 'APPLICATION_OWNER_ADMIN_REQUIRED');
select test_application_v2.expect_error(
 $$select public.owner_r1_application_business_action_v2(test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id','COUNTER_OFFER',jsonb_build_object('price',611.25,'currency','USD'))$$,
 'APPLICATION_OWNER_ADMIN_REQUIRED');
select test_application_v2.expect_error(
 $$select public.owner_r1_application_business_action_v2(test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id','RESOURCE_APPROVED','{}')$$,
 'APPLICATION_OWNER_ADMIN_REQUIRED');
select test_application_v2.expect_error(
 $$select public.owner_r1_application_business_action_v2(test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id','RESOURCE_DENIED','{}')$$,
 'APPLICATION_OWNER_ADMIN_REQUIRED');
select test_application_v2.expect_error(
 $$select public.owner_r1_application_business_action_v2(test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id','DEAL_HANDOFF','{}')$$,
 'APPLICATION_OWNER_ADMIN_REQUIRED');

-- Even a privileged internal caller cannot bypass the lifecycle guard by merely presenting an
-- Operations session. There is no Owner token/provenance, so direct commercial writes fail.
select test_application_v2.expect_error(
 $$update portal_private.owner_application_workflow set business_status='SUPPLIER_APPROVED',supplier_approved_by=test_application_v2.get('user4')::uuid,supplier_approved_at=now() where application_key=(select id from portal_private.client_applications where application_id=test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id')$$,
 'APPLICATION_OWNER_ADMIN_ACTION_REQUIRED');
select test_application_v2.expect_error(
 $$update portal_private.client_applications set status='REJECTED',decision_by=test_application_v2.get('user4')::uuid,decision_reason='OPERATIONS_AI_REJECT_ATTEMPT' where application_id=test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id'$$,
 'APPLICATION_OWNER_ADMIN_ACTION_REQUIRED');
select test_application_v2.expect_error(
 $$update portal_private.client_applications set status='ACCEPTED_AWAITING_DEAL_REGISTRATION',decision_by=test_application_v2.get('user4')::uuid,decision_reason='OPERATIONS_AI_ACCEPT_ATTEMPT' where application_id=test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id'$$,
 'APPLICATION_OWNER_ADMIN_ACTION_REQUIRED');
select test_application_v2.check_true(
 (select count(*)=0 from portal_private.client_application_owner_actions_v2 where application_id=test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id'),
 'denied Operations/AI attempts create no Owner provenance');

-- Authenticated physical Owner/Admin is the only business-action origin.
select set_config('request.jwt.claims',jsonb_build_object(
 'sub',test_application_v2.get('auth3'),'session_id',test_application_v2.get('session3'),'role','authenticated')::text,false);
select test_application_v2.expect_error(
 $$select public.owner_r1_application_business_action_v2(test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id','DEAL_HANDOFF','{}')$$,
 'APPLICATION_DEAL_HANDOFF_RESOURCE_APPROVAL_REQUIRED');
select public.owner_r1_application_business_action_v2(
 test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id','COUNTER_OFFER',
 jsonb_build_object('price',611.25,'currency','USD'));
select test_application_v2.check_true(
 (select count(*)=1 and bool_and(actor_portal_user_id=test_application_v2.get('user3')::uuid)
    and bool_and(actor_role='ADMIN') and bool_and(source_system='OWNER_ADMIN_PORTAL')
  from portal_private.client_application_owner_actions_v2
  where application_id=test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id' and action_code='COUNTER_OFFER'),
 'Owner counter-price has immutable authenticated ADMIN provenance');
select test_application_v2.expect_error(
 $$update portal_private.client_application_owner_actions_v2 set decision_payload='{}'::jsonb where application_id=test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id'$$,
 'APPLICATION_AUDIT_IS_APPEND_ONLY');

-- Client acceptance does not turn Operations into the commercial decision maker.
update portal_private.owner_application_workflow
 set business_status='CLIENT_COUNTER_ACCEPTED',client_counter_response='ACCEPTED',updated_at=now()
 where application_key=(select id from portal_private.client_applications where application_id=test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id');
update portal_private.client_applications
 set status='ACCEPTED_AWAITING_DEAL_REGISTRATION',decision_reason='CLIENT_ACCEPTED_ADMIN_COUNTER',updated_at=now()
 where application_id=test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id';
select public.owner_r1_application_business_action_v2(
 test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id','RESOURCE_APPROVED','{}');
select public.owner_r1_application_business_action_v2(
 test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id','DEAL_HANDOFF','{}');
select test_application_v2.check_true(
 (select count(*)=1 from portal_private.client_application_owner_actions_v2
  where application_id=test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id' and action_code='RESOURCE_APPROVED'),
 'resource approval exists only as Owner/Admin provenance');
select test_application_v2.check_true(
 (select count(*)=1 from portal_private.client_application_owner_actions_v2
  where application_id=test_application_v2.get('owner_boundary_receipt')::jsonb->>'application_id' and action_code='DEAL_HANDOFF'),
 'Deal handoff authorization exists only as Owner/Admin provenance');

-- Deal registration cannot be forged without the prior Owner/Admin handoff authorization.
insert into test_application_v2.fixture values(
 'no_handoff_receipt',test_application_v2.submit(2,test_application_v2.bundle(2,'NO_HANDOFF',18.5))::text
);
select test_application_v2.expect_error(
 $$update portal_private.client_applications set status='DEAL_REGISTERED' where application_id=test_application_v2.get('no_handoff_receipt')::jsonb->>'application_id'$$,
 'APPLICATION_OWNER_DEAL_HANDOFF_REQUIRED');

-- Owner rejection is the business cause; immediate retirement is a consequence, and both the
-- immutable Owner action and tombstone survive the removal of the user-facing business row.
insert into test_application_v2.fixture values(
 'owner_reject_receipt',test_application_v2.submit(2,test_application_v2.bundle(2,'OWNER_REJECT',19.75))::text
);
select public.owner_r1_application_business_action_v2(
 test_application_v2.get('owner_reject_receipt')::jsonb->>'application_id','REJECT',
 jsonb_build_object('reason','ISOLATED_OWNER_REJECT'));
select test_application_v2.check_true(
 not exists(select 1 from portal_private.client_applications where application_id=test_application_v2.get('owner_reject_receipt')::jsonb->>'application_id'),
 'Owner rejection removes the business row at transaction completion');
select test_application_v2.check_true(
 exists(select 1 from portal_private.client_application_owner_actions_v2 where application_id=test_application_v2.get('owner_reject_receipt')::jsonb->>'application_id' and action_code='REJECT' and actor_portal_user_id=test_application_v2.get('user3')::uuid),
 'Owner rejection provenance survives business-row retirement');
select test_application_v2.check_true(
 exists(select 1 from portal_private.client_application_tombstones_v2 where application_id=test_application_v2.get('owner_reject_receipt')::jsonb->>'application_id'),
 'retired Owner-rejected application has permanent tombstone');
select test_application_v2.expect_error(
 $$select test_application_v2.submit(2,test_application_v2.bundle(2,'OWNER_REJECT',19.75))$$,
 'APPLICATION_RETIRED_NO_RESUBMISSION');

select set_config('request.jwt.claims','{}',false);
\echo OWNER_ADMIN_NEGATIVE_AUTHORITY_REGRESSIONS_COMPLETE
