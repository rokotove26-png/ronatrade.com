\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.stage22_assert(p_ok boolean,p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok,false) then raise exception 'PG17_STAGE22_ASSERTION_FAILED: %',p_message; end if;
end $$;

-- Three production-shaped APPLICATION_DETAILS_V5 fixtures on disposable QA identities.
insert into portal_private.clients(id,client_id,legal_name) values
 ('40000000-0000-4000-8000-000000000004','QA-C004','Stage22 C004'),
 ('50000000-0000-4000-8000-000000000005','QA-C005','Stage22 C005');
insert into portal_private.contracts(id,contract_id,client_key) values
 ('44000000-0000-4000-8000-000000000004','QA-C004-CTR-2026-001','40000000-0000-4000-8000-000000000004'),
 ('55000000-0000-4000-8000-000000000005','QA-C005-CTR-2026-001','50000000-0000-4000-8000-000000000005');
insert into portal_private.deals(id,deal_id,client_key,contract_key) values
 ('59000000-0000-4000-8000-000000000009','QA-DEAL-2026-009','50000000-0000-4000-8000-000000000005','55000000-0000-4000-8000-000000000005');

insert into portal_private.client_applications(
  application_id,client_key,contract_key,product,quantity_tonnes,delivery_basis,destination,
  price_mode,proposed_price,proposed_currency,status,linked_deal_key,submitted_at,source_publication_item_id
) values
 ('QA-C004-IN-2026-003','40000000-0000-4000-8000-000000000004','44000000-0000-4000-8000-000000000004','LPG',470,'CPT A','Country / Station A','ACCEPT_PUBLISHED_PRICE',464,'USD','SUBMITTED',null,now(),'a0000000-0000-4000-8000-000000000003'),
 ('QA-C004-IN-2026-004','40000000-0000-4000-8000-000000000004','44000000-0000-4000-8000-000000000004','LPG',250,'CPT B','Country / Station B','ACCEPT_PUBLISHED_PRICE',454,'USD','SUBMITTED',null,now(),'a0000000-0000-4000-8000-000000000004'),
 ('QA-C005-IN-2026-001','50000000-0000-4000-8000-000000000005','55000000-0000-4000-8000-000000000005','LPG',490,'CPT C','Country / Station C','ACCEPT_PUBLISHED_PRICE',740,'USD','DEAL_REGISTERED','59000000-0000-4000-8000-000000000009',now(),'a0000000-0000-4000-8000-000000000005');

insert into portal_private.staff_tasks(
  task_id,title,status,priority,authority_domain,assigned_functional_role,client_key,contract_key,
  application_key,deal_key,source_type,source_object_id,source_version,qa_only
)
select 'TASK-EXISTING-QA-C005-001','Existing terminal application workflow','COMPLETED','NORMAL','APPLICATION','OPERATIONS_DIRECTOR',
       a.client_key,a.contract_key,a.id,a.linked_deal_key,'APPLICATION_WORKFLOW',a.application_id,'PRODUCTION_SHAPE',false
  from portal_private.client_applications a where a.application_id='QA-C005-IN-2026-001';

select pg_temp.stage22_assert(
  (select count(*)=1 from portal_private.client_intake_routing_registry_v1 where source_kind='PORTAL_REVERSE_EVENT' and actionable_type='APPLICATION_DETAILS_V5' and disabled_at is null),
  'APPLICATION_DETAILS_V5 policy missing');

insert into portal_private.portal_reverse_events(
  event_id,idempotency_key,actor_role,client_key,contract_key,event_type,authority_domain,
  authority_target_type,authority_target_id,payload
) values
 ('PORTAL-EVT-PG17-APPDETAIL-A','IDEMP-STAGE22-APPDETAIL-A','CLIENT','40000000-0000-4000-8000-000000000004','44000000-0000-4000-8000-000000000004','CLIENT_MESSAGE_SUBMIT','APPLICATION','APPLICATION','QA-C004-IN-2026-003',
  '{"source":"CLIENT_PRICE_APPLICATION","message_type":"APPLICATION_DETAILS_V5","application_id":"QA-C004-IN-2026-003","client_id":"QA-C004","contract_id":"QA-C004-CTR-2026-001","product":"LPG","quantity_tonnes":470,"commercial":{"price_mode":"ACCEPT_PUBLISHED_PRICE"},"destination":{"country":"Country","station":"Station A"}}'),
 ('PORTAL-EVT-PG17-APPDETAIL-B','IDEMP-STAGE22-APPDETAIL-B','CLIENT','40000000-0000-4000-8000-000000000004','44000000-0000-4000-8000-000000000004','CLIENT_MESSAGE_SUBMIT','APPLICATION','APPLICATION','QA-C004-IN-2026-004',
  '{"source":"CLIENT_PRICE_APPLICATION","message_type":"APPLICATION_DETAILS_V5","application_id":"QA-C004-IN-2026-004","client_id":"QA-C004","contract_id":"QA-C004-CTR-2026-001","product":"LPG","quantity_tonnes":250,"commercial":{"price_mode":"ACCEPT_PUBLISHED_PRICE"},"destination":{"country":"Country","station":"Station B"}}'),
 ('PORTAL-EVT-PG17-APPDETAIL-C','IDEMP-STAGE22-APPDETAIL-C','CLIENT','50000000-0000-4000-8000-000000000005','55000000-0000-4000-8000-000000000005','CLIENT_MESSAGE_SUBMIT','APPLICATION','APPLICATION','QA-C005-IN-2026-001',
  '{"source":"CLIENT_PRICE_APPLICATION","message_type":"APPLICATION_DETAILS_V5","application_id":"QA-C005-IN-2026-001","client_id":"QA-C005","contract_id":"QA-C005-CTR-2026-001","product":"LPG","quantity_tonnes":490,"commercial":{"price_mode":"ACCEPT_PUBLISHED_PRICE"},"destination":{"country":"Country","station":"Station C"}}');

select pg_temp.stage22_assert(
  (select count(*)=3 from portal_private.client_intake_v1 where source_record_id in ('PORTAL-EVT-PG17-APPDETAIL-A','PORTAL-EVT-PG17-APPDETAIL-B','PORTAL-EVT-PG17-APPDETAIL-C') and actionable_type='APPLICATION_DETAILS_V5'),
  'three production-shaped APPLICATION_DETAILS_V5 intakes');
select pg_temp.stage22_assert(
  (select count(*)=3 from portal_private.client_intake_v1 i join portal_private.client_applications a on a.id=i.application_key where i.source_record_id in ('PORTAL-EVT-PG17-APPDETAIL-A','PORTAL-EVT-PG17-APPDETAIL-B','PORTAL-EVT-PG17-APPDETAIL-C') and a.application_id=(i.source_payload->>'application_id')),
  'authoritative application_key linkage');

select pg_temp.stage22_assert(
  (select count(*)=2 from portal_private.portal_reverse_events where event_id in ('PORTAL-EVT-PG17-APPDETAIL-A','PORTAL-EVT-PG17-APPDETAIL-B') and processing_state='QUEUED'),
  'active application-details source state queued');
select pg_temp.stage22_assert(
  (select count(*)=2 from (select a.application_id,count(distinct t.id) task_count from portal_private.client_applications a join portal_private.staff_tasks t on t.application_key=a.id where a.application_id in ('QA-C004-IN-2026-003','QA-C004-IN-2026-004') group by a.application_id having count(distinct t.id)=1) q),
  'active application task exactly once');
select pg_temp.stage22_assert(
  (select count(*)=2 from (select a.application_id,count(distinct l.staff_task_id) linked_tasks from portal_private.client_applications a join portal_private.client_intake_v1 i on i.application_key=a.id join portal_private.client_intake_task_links_v1 l on l.intake_id=i.intake_id where a.application_id in ('QA-C004-IN-2026-003','QA-C004-IN-2026-004') group by a.application_id having count(distinct l.staff_task_id)=1) q),
  'application plus details reuse one staff task');

select pg_temp.stage22_assert(
  (select count(*)=1 from portal_private.staff_tasks t join portal_private.client_applications a on a.id=t.application_key where a.application_id='QA-C005-IN-2026-001'),
  'terminal application duplicate task');
select pg_temp.stage22_assert(
  (select processing_state='APPLIED' and acknowledgement_state='ACKNOWLEDGED' from portal_private.portal_reverse_events where event_id='PORTAL-EVT-PG17-APPDETAIL-C'),
  'terminal application detail did not converge to APPLIED/ACK');

select pg_temp.stage22_assert(
  (select count(*)=1 from portal_private.client_intake_application_projection_for_lk_v1('CLIENT','QA-C004','QA-C004-CTR-2026-001') where application_id='QA-C004-IN-2026-003'),
  'Client duplicate logical application');
select pg_temp.stage22_assert(
  (select count(*)=1 from portal_private.client_intake_application_projection_for_lk_v1('ADMIN',null,null) where application_id='QA-C004-IN-2026-003'),
  'Admin duplicate logical application');
select pg_temp.stage22_assert(
  (select jsonb_array_length(linked_intakes)=2 from portal_private.client_intake_application_projection_for_lk_v1('CLIENT','QA-C004','QA-C004-CTR-2026-001') where application_id='QA-C004-IN-2026-003'),
  'logical application must retain two linked durable intake identities');
select pg_temp.stage22_assert(
  (select c.linked_intakes=a.linked_intakes from portal_private.client_intake_application_projection_for_lk_v1('CLIENT','QA-C004','QA-C004-CTR-2026-001') c join portal_private.client_intake_application_projection_for_lk_v1('ADMIN',null,null) a using(application_id) where c.application_id='QA-C004-IN-2026-003'),
  'Client/Admin linked intake durable identities differ');
select pg_temp.stage22_assert(
  (select count(*)=3 from portal_private.client_applications where application_id in ('QA-C004-IN-2026-003','QA-C004-IN-2026-004','QA-C005-IN-2026-001')),
  'APPLICATION_DETAILS created duplicate client_applications row');

insert into portal_private.portal_reverse_events(event_id,idempotency_key,actor_role,client_key,contract_key,event_type,authority_domain,payload)
values('PORTAL-EVT-PG17-STAGE22-DELIVERED','IDEMP-PG17-STAGE22-DELIVERED','CLIENT','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','CLIENT_MESSAGE_SUBMIT','PRICE_CALCULATION','{"message_type":"DELIVERED_PRICE_CALCULATION_REQUEST_V1","quantity_tonnes":333}');
select pg_temp.stage22_assert((select processing_state='QUEUED' from portal_private.portal_reverse_events where event_id='PORTAL-EVT-PG17-STAGE22-DELIVERED'),'new delivered source state not QUEUED');

update portal_private.portal_reverse_events set processing_state='RECEIVED' where event_id='PORTAL-EVT-PG17-STAGE22-DELIVERED';
select portal_private.reconcile_client_intake_v1();
select portal_private.reconcile_client_intake_v1();
select pg_temp.stage22_assert((select processing_state='QUEUED' from portal_private.portal_reverse_events where event_id='PORTAL-EVT-PG17-STAGE22-DELIVERED'),'historical RECEIVED source not reconciled to QUEUED');
select pg_temp.stage22_assert((select count(*)=1 from portal_private.staff_tasks t join portal_private.portal_reverse_events e on e.id=t.source_reverse_event_key where e.event_id='PORTAL-EVT-PG17-STAGE22-DELIVERED'),'repeated reconciliation duplicated task');

insert into portal_private.portal_reverse_events(event_id,idempotency_key,actor_role,client_key,contract_key,event_type,authority_domain,payload)
values('PORTAL-EVT-PG17-STAGE22-UNKNOWN','IDEMP-PG17-STAGE22-UNKNOWN','CLIENT','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','CLIENT_MESSAGE_SUBMIT','PORTAL','{"message_type":"FUTURE_UNKNOWN_ACTIONABLE_V99","message":"future"}');
select pg_temp.stage22_assert(
  (select routing_state='DEAD_LETTER' and routing_reason='ROUTING_POLICY_MISSING' and client_visible and admin_visible from portal_private.client_intake_v1 where source_record_id='PORTAL-EVT-PG17-STAGE22-UNKNOWN'),
  'unknown actionable did not fail closed visibly');
select pg_temp.stage22_assert(
  (select count(*)=0 from portal_private.staff_tasks t join portal_private.portal_reverse_events e on e.id=t.source_reverse_event_key where e.event_id='PORTAL-EVT-PG17-STAGE22-UNKNOWN'),
  'unknown actionable created business task');
select pg_temp.stage22_assert(
  (select count(*)=1 from portal_private.client_intake_projection_for_lk_v1('CLIENT','QA-CLIENT-001','QA-CONTRACT-001') where source_id='PORTAL-EVT-PG17-STAGE22-UNKNOWN'),
  'unknown actionable not visible to Client');
select pg_temp.stage22_assert(
  (select count(*)=1 from portal_private.client_intake_projection_for_lk_v1('ADMIN',null,null) where source_id='PORTAL-EVT-PG17-STAGE22-UNKNOWN'),
  'unknown actionable not visible to Admin');

select 'APPLICATION_DETAILS_V5_COVERAGE=PASS';
select 'APPLICATION_LINKAGE=PASS';
select 'SOURCE_STATE_CONVERGENCE=PASS';
select 'NO_DUPLICATE_LOGICAL_APPLICATION=PASS';
select 'TERMINAL_APPLICATION_DUPLICATE_TASK_COUNT='||((select count(*) from portal_private.staff_tasks t join portal_private.client_applications a on a.id=t.application_key where a.application_id='QA-C005-IN-2026-001')-1);
select 'TASK_EXACTLY_ONCE=PASS';
select 'UNKNOWN_ACTIONABLE_FAIL_CLOSED=PASS';
select 'STAGE22_PG17_GLOBAL_COVERAGE=PASS';
