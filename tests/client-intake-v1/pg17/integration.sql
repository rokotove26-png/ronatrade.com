\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.qa_assert(p_ok boolean,p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok,false) then raise exception 'PG17_QA_ASSERTION_FAILED: %',p_message; end if;
end $$;

insert into portal_private.clients(id,client_id,legal_name)
values('11111111-1111-4111-8111-111111111111','QA-CLIENT-001','PG17 QA Client');
insert into portal_private.contracts(id,contract_id,client_key)
values('22222222-2222-4222-8222-222222222222','QA-CONTRACT-001','11111111-1111-4111-8111-111111111111');

-- Production enum semantics: both application modes must route distinctly.
select pg_temp.qa_assert(
  portal_private.client_intake_actionable_type_v1('CLIENT_APPLICATION','CLIENT_APPLICATION_SUBMIT','{"price_mode":"ACCEPT_PUBLISHED_PRICE"}'::jsonb)='PUBLISHED_PRICE_APPLICATION',
  'ACCEPT_PUBLISHED_PRICE mapping');
select pg_temp.qa_assert(
  portal_private.client_intake_actionable_type_v1('CLIENT_APPLICATION','CLIENT_APPLICATION_SUBMIT','{"price_mode":"CLIENT_PROPOSED_PRICE"}'::jsonb)='CLIENT_PROPOSED_PRICE_APPLICATION',
  'CLIENT_PROPOSED_PRICE mapping');

insert into portal_private.client_applications(
  application_id,client_key,contract_key,product,quantity_tonnes,price_mode,submitted_at,source_publication_item_id
) values
  ('APP-PG17-PUBLISHED','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','LPG',25,'ACCEPT_PUBLISHED_PRICE',now(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('APP-PG17-PROPOSED','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','LPG',30,'CLIENT_PROPOSED_PRICE',now(),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

select pg_temp.qa_assert((select actionable_type='PUBLISHED_PRICE_APPLICATION' and routing_state='APPLIED' from portal_private.client_intake_v1 where source_record_id='APP-PG17-PUBLISHED'),'published application routing');
select pg_temp.qa_assert((select actionable_type='CLIENT_PROPOSED_PRICE_APPLICATION' and routing_state='APPLIED' from portal_private.client_intake_v1 where source_record_id='APP-PG17-PROPOSED'),'proposed application routing');

-- Delivered price, generic message, claim, payment proof, and document acknowledgement.
insert into portal_private.portal_reverse_events(event_id,idempotency_key,actor_role,client_key,contract_key,event_type,authority_domain,payload)
values
 ('PORTAL-EVT-PG17-DELIVERED','IDEMP-PG17-DELIVERED','CLIENT','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','CLIENT_MESSAGE_SUBMIT','PRICE_CALCULATION','{"message_type":"DELIVERED_PRICE_CALCULATION_REQUEST_V1","product":"LPG","quantity_tonnes":40,"destination":{"station":"QA Station"}}'),
 ('PORTAL-EVT-PG17-MESSAGE','IDEMP-PG17-MESSAGE','CLIENT','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','CLIENT_MESSAGE_SUBMIT','PORTAL','{"message":"QA"}'),
 ('PORTAL-EVT-PG17-CLAIM','IDEMP-PG17-CLAIM','CLIENT','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','CLIENT_CLAIM_SUBMIT','CLAIMS','{"message":"QA claim"}'),
 ('PORTAL-EVT-PG17-PAYMENT','IDEMP-PG17-PAYMENT','CLIENT','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','CLIENT_PAYMENT_PROOF_SUBMIT','PAYMENTS','{"document":"QA proof"}'),
 ('PORTAL-EVT-PG17-DOCACK','IDEMP-PG17-DOCACK','CLIENT','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','CLIENT_DOCUMENT_ACK','DOCUMENTS','{"document":"QA acknowledgement"}');

select pg_temp.qa_assert((select count(*)=5 from portal_private.client_intake_v1 where source_record_id like 'PORTAL-EVT-PG17-%'),'five reverse-event intakes');
select pg_temp.qa_assert((select count(*)=5 from portal_private.client_intake_v1 where source_record_id like 'PORTAL-EVT-PG17-%' and routing_state='APPLIED'),'reverse events automatic routing');

-- Two sequential requests are distinct.
insert into portal_private.portal_reverse_events(event_id,idempotency_key,actor_role,client_key,contract_key,event_type,authority_domain,payload)
values
 ('PORTAL-EVT-PG17-SEQUENTIAL-A','IDEMP-PG17-SEQUENTIAL-A','CLIENT','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','CLIENT_MESSAGE_SUBMIT','PRICE_CALCULATION','{"message_type":"DELIVERED_PRICE_CALCULATION_REQUEST_V1","quantity_tonnes":101}'),
 ('PORTAL-EVT-PG17-SEQUENTIAL-B','IDEMP-PG17-SEQUENTIAL-B','CLIENT','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','CLIENT_MESSAGE_SUBMIT','PRICE_CALCULATION','{"message_type":"DELIVERED_PRICE_CALCULATION_REQUEST_V1","quantity_tonnes":102}');
select pg_temp.qa_assert((select count(distinct durable_id)=2 from portal_private.client_intake_v1 where source_record_id in ('PORTAL-EVT-PG17-SEQUENTIAL-A','PORTAL-EVT-PG17-SEQUENTIAL-B')),'sequential durable IDs distinct');

-- Idempotent retry of the durable-ingest RPC returns the same intake/durable identity.
do $$
declare a uuid;b uuid;da uuid;db uuid;
begin
  a:=portal_private.ensure_client_intake_from_reverse_event_v1('PORTAL-EVT-PG17-DELIVERED');
  b:=portal_private.ensure_client_intake_from_reverse_event_v1('PORTAL-EVT-PG17-DELIVERED');
  select durable_id into da from portal_private.client_intake_v1 where intake_id=a;
  select durable_id into db from portal_private.client_intake_v1 where intake_id=b;
  if a is distinct from b or da is distinct from db then raise exception 'idempotent retry changed durable identity'; end if;
end $$;

-- Submit-response DB contract is complete for application and event sources.
select pg_temp.qa_assert((select intake_id is not null and durable_id is not null and source_id='APP-PG17-PROPOSED' and submitted_at is not null and status='APPLIED' from portal_private.client_intake_submit_contract_v1('CLIENT_APPLICATION','APP-PG17-PROPOSED')),'application submit contract');
select pg_temp.qa_assert((select intake_id is not null and durable_id is not null and source_id='PORTAL-EVT-PG17-DELIVERED' and submitted_at is not null and status='APPLIED' from portal_private.client_intake_submit_contract_v1('PORTAL_REVERSE_EVENT','PORTAL-EVT-PG17-DELIVERED')),'event submit contract');

-- Real LK projection function: same durable ID is visible to Client and Admin.
do $$
declare c uuid;a uuid;
begin
  select durable_id into c from portal_private.client_intake_projection_for_lk_v1('CLIENT','QA-CLIENT-001','QA-CONTRACT-001') where source_id='PORTAL-EVT-PG17-DELIVERED';
  select durable_id into a from portal_private.client_intake_projection_for_lk_v1('ADMIN',null,null) where source_id='PORTAL-EVT-PG17-DELIVERED';
  if c is null or a is null or c<>a then raise exception 'Client/Admin durable projection mismatch'; end if;
end $$;

-- Worker failure -> FAILED_RETRYABLE -> reconciliation -> APPLIED without duplicate task.
insert into portal_private.portal_reverse_events(event_id,idempotency_key,actor_role,client_key,contract_key,event_type,authority_domain,payload)
values('PORTAL-EVT-PG17-WORKER-FAIL','IDEMP-PG17-WORKER-FAIL','CLIENT','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','CLIENT_MESSAGE_SUBMIT','PORTAL','{"message":"retry"}');
update portal_private.client_intake_routing_registry_v1 set disabled_at=now()-interval '1 second' where policy_key='CLIENT_MESSAGE_SUBMIT_V1';
update portal_private.client_intake_routing_outbox_v1 q set state='PENDING',next_attempt_at=null
from portal_private.client_intake_v1 i where i.intake_id=q.intake_id and i.source_record_id='PORTAL-EVT-PG17-WORKER-FAIL';
update portal_private.client_intake_v1 set routing_state='PENDING' where source_record_id='PORTAL-EVT-PG17-WORKER-FAIL';
select portal_private.process_client_intake_outbox_v1(10);
select pg_temp.qa_assert((select routing_state='FAILED_RETRYABLE' from portal_private.client_intake_v1 where source_record_id='PORTAL-EVT-PG17-WORKER-FAIL'),'worker failure retryable');
update portal_private.client_intake_routing_registry_v1 set disabled_at=null where policy_key='CLIENT_MESSAGE_SUBMIT_V1';
select portal_private.reconcile_client_intake_v1();
select pg_temp.qa_assert((select routing_state='APPLIED' from portal_private.client_intake_v1 where source_record_id='PORTAL-EVT-PG17-WORKER-FAIL'),'worker retry applied');
select pg_temp.qa_assert((select count(*)=1 from portal_private.staff_tasks t join portal_private.portal_reverse_events e on e.id=t.source_reverse_event_key where e.event_id='PORTAL-EVT-PG17-WORKER-FAIL'),'worker task exactly once');

-- Self-healing: stuck PROCESSING, missing task, missing outbox, missing projection visibility.
update portal_private.client_intake_routing_outbox_v1 q set state='PROCESSING',processing_started_at=now()-interval '10 minutes'
from portal_private.client_intake_v1 i where i.intake_id=q.intake_id and i.source_record_id='PORTAL-EVT-PG17-SEQUENTIAL-A';
update portal_private.client_intake_v1 set routing_state='PROCESSING' where source_record_id='PORTAL-EVT-PG17-SEQUENTIAL-A';

with target as (select intake_id from portal_private.client_intake_v1 where source_record_id='PORTAL-EVT-PG17-SEQUENTIAL-B')
delete from portal_private.client_intake_task_links_v1 where intake_id=(select intake_id from target);
delete from portal_private.staff_tasks where source_reverse_event_key=(select id from portal_private.portal_reverse_events where event_id='PORTAL-EVT-PG17-SEQUENTIAL-B');

with target as (select intake_id from portal_private.client_intake_v1 where source_record_id='PORTAL-EVT-PG17-MESSAGE')
delete from portal_private.client_intake_routing_outbox_v1 where intake_id=(select intake_id from target);
update portal_private.client_intake_v1 set client_visible=false,admin_visible=false where source_record_id='PORTAL-EVT-PG17-MESSAGE';
select portal_private.reconcile_client_intake_v1();
select pg_temp.qa_assert((select routing_state='APPLIED' from portal_private.client_intake_v1 where source_record_id='PORTAL-EVT-PG17-SEQUENTIAL-A'),'stuck processing healed');
select pg_temp.qa_assert((select count(*)=1 from portal_private.staff_tasks t join portal_private.portal_reverse_events e on e.id=t.source_reverse_event_key where e.event_id='PORTAL-EVT-PG17-SEQUENTIAL-B'),'missing task healed exactly once');
select pg_temp.qa_assert((select count(*)=1 from portal_private.client_intake_routing_outbox_v1 q join portal_private.client_intake_v1 i on i.intake_id=q.intake_id where i.source_record_id='PORTAL-EVT-PG17-MESSAGE' and q.state='APPLIED'),'missing outbox healed');
select pg_temp.qa_assert((select client_visible and admin_visible from portal_private.client_intake_v1 where source_record_id='PORTAL-EVT-PG17-MESSAGE'),'missing projection visibility healed');

-- SQL incident recovery rehearsal. IDs are QA/operator input only; no runtime branch references them.
insert into portal_private.portal_reverse_events(event_id,idempotency_key,actor_role,client_key,contract_key,event_type,authority_domain,payload)
values
 ('PORTAL-EVT-2d8981c549484ec7a4b91dc22da78d96','PRICE-CALC-d1ead6b2-9bcc-4a53-aa4f-e35507d78291','CLIENT','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','CLIENT_MESSAGE_SUBMIT','PRICE_CALCULATION','{"source":"CLIENT_PRICE_CALCULATION_REQUEST","message_type":"DELIVERED_PRICE_CALCULATION_REQUEST_V1","quantity_tonnes":10000}'),
 ('PORTAL-EVT-d5cee7b90c1e4ce689f114b76814d208','PRICE-CALC-c462bf1b-320a-4910-81a1-1ae44ff8b3cc','CLIENT','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','CLIENT_MESSAGE_SUBMIT','PRICE_CALCULATION','{"source":"CLIENT_PRICE_CALCULATION_REQUEST","message_type":"DELIVERED_PRICE_CALCULATION_REQUEST_V1","quantity_tonnes":175}');

select portal_private.append_client_intake_correction_v1(
  (select intake_id from portal_private.client_intake_v1 where source_record_id='PORTAL-EVT-2d8981c549484ec7a4b91dc22da78d96'),
  'payload.quantity_tonnes','10000'::jsonb,'1000'::jsonb,'OWNER','CLIENT_SUBMISSION_DATA_INTEGRITY_INCIDENT'
);
select portal_private.reconcile_client_intake_v1();

select pg_temp.qa_assert((select (effective_payload->>'quantity_tonnes')::numeric=1000 from portal_private.client_intake_projection_for_lk_v1('CLIENT','QA-CLIENT-001','QA-CONTRACT-001') where source_id='PORTAL-EVT-2d8981c549484ec7a4b91dc22da78d96'),'incident 1 Client correction overlay');
select pg_temp.qa_assert((select (effective_payload->>'quantity_tonnes')::numeric=1000 from portal_private.client_intake_projection_for_lk_v1('ADMIN',null,null) where source_id='PORTAL-EVT-2d8981c549484ec7a4b91dc22da78d96'),'incident 1 Admin correction overlay');
select pg_temp.qa_assert((select (effective_payload->>'quantity_tonnes')::numeric=175 from portal_private.client_intake_projection_for_lk_v1('ADMIN',null,null) where source_id='PORTAL-EVT-d5cee7b90c1e4ce689f114b76814d208'),'incident 2 effective quantity');
select pg_temp.qa_assert((select (payload->>'quantity_tonnes')::numeric=10000 from portal_private.portal_reverse_events where event_id='PORTAL-EVT-2d8981c549484ec7a4b91dc22da78d96'),'incident 1 raw source unchanged');
select pg_temp.qa_assert((select count(*)=1 from portal_private.staff_tasks t join portal_private.portal_reverse_events e on e.id=t.source_reverse_event_key where e.event_id='PORTAL-EVT-2d8981c549484ec7a4b91dc22da78d96'),'incident 1 task exactly once');
select pg_temp.qa_assert((select count(*)=1 from portal_private.staff_tasks t join portal_private.portal_reverse_events e on e.id=t.source_reverse_event_key where e.event_id='PORTAL-EVT-d5cee7b90c1e4ce689f114b76814d208'),'incident 2 task exactly once');

do $$
declare c1 uuid;a1 uuid;c2 uuid;a2 uuid;
begin
  select durable_id into c1 from portal_private.client_intake_projection_for_lk_v1('CLIENT','QA-CLIENT-001','QA-CONTRACT-001') where source_id='PORTAL-EVT-2d8981c549484ec7a4b91dc22da78d96';
  select durable_id into a1 from portal_private.client_intake_projection_for_lk_v1('ADMIN',null,null) where source_id='PORTAL-EVT-2d8981c549484ec7a4b91dc22da78d96';
  select durable_id into c2 from portal_private.client_intake_projection_for_lk_v1('CLIENT','QA-CLIENT-001','QA-CONTRACT-001') where source_id='PORTAL-EVT-d5cee7b90c1e4ce689f114b76814d208';
  select durable_id into a2 from portal_private.client_intake_projection_for_lk_v1('ADMIN',null,null) where source_id='PORTAL-EVT-d5cee7b90c1e4ce689f114b76814d208';
  if c1 is null or c1<>a1 or c2 is null or c2<>a2 then raise exception 'incident durable ID mismatch across projections'; end if;
end $$;

select pg_temp.qa_assert((select unrouted_client_intake_count=0 and dual_invisible_actionable_intake_count=0 and stuck_intake_count=0 from portal_private.client_intake_metrics_v1),'final rehearsal metrics');

select 'PRICE_MODE_PRODUCTION_ENUM=PASS';
select 'REAL_POSTGRES_MIGRATION_APPLY=PASS';
select 'CLIENT_REAL_PROJECTION=PASS';
select 'ADMIN_REAL_PROJECTION=PASS';
select 'SAME_DURABLE_ID_BOTH_SIDES=PASS';
select 'SUBMIT_RETURNS_DURABLE_ID=PASS';
select 'AUTOMATIC_OUTBOX_CONSUMER=PASS';
select 'RECONCILIATION_EXECUTOR=PASS';
select 'TASK_EXACTLY_ONCE=PASS';
select 'INCIDENT_1_SQL_REHEARSAL_EFFECTIVE_QUANTITY='||(select effective_payload->>'quantity_tonnes' from portal_private.client_intake_admin_projection_v1 where source_id='PORTAL-EVT-2d8981c549484ec7a4b91dc22da78d96');
select 'INCIDENT_2_SQL_REHEARSAL_EFFECTIVE_QUANTITY='||(select effective_payload->>'quantity_tonnes' from portal_private.client_intake_admin_projection_v1 where source_id='PORTAL-EVT-d5cee7b90c1e4ce689f114b76814d208');
select 'UNROUTED_ACTIONABLE_INTAKES_REHEARSAL='||unrouted_client_intake_count from portal_private.client_intake_metrics_v1;
select 'DUAL_INVISIBLE_ACTIONABLE_INTAKES_REHEARSAL='||dual_invisible_actionable_intake_count from portal_private.client_intake_metrics_v1;
select 'STUCK_INTAKES_REHEARSAL='||stuck_intake_count from portal_private.client_intake_metrics_v1;
select 'RAW_SOURCE_MUTATION=NONE';
