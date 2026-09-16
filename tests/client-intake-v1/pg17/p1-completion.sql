\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.p1_completion_assert(p_ok boolean,p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok,false) then raise exception 'P1_COMPLETION_ASSERTION_FAILED: %',p_message; end if;
end $$;

-- Simulate historical rows predating the durable-intake trigger. A bounded reconciler must
-- advance past each processed prefix until all sources have an intake.
alter table portal_private.portal_reverse_events disable trigger user;
insert into portal_private.portal_reverse_events(
  event_id,idempotency_key,actor_role,client_key,contract_key,event_type,authority_domain,payload,created_at
)
select
  'PORTAL-EVT-PG17-HISTORY-'||lpad(g::text,2,'0'),
  'IDEMP-PG17-HISTORY-'||lpad(g::text,2,'0'),
  'CLIENT',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'CLIENT_MESSAGE_SUBMIT',
  'PRICE_CALCULATION',
  jsonb_build_object('message_type','DELIVERED_PRICE_CALCULATION_REQUEST_V1','quantity_tonnes',100+g),
  '2026-01-01 00:00:00+00'::timestamptz + g*interval '1 minute'
from generate_series(1,6) g;
alter table portal_private.portal_reverse_events enable trigger user;

select pg_temp.p1_completion_assert(
  (select count(*)=0 from portal_private.client_intake_v1 where source_record_id like 'PORTAL-EVT-PG17-HISTORY-%'),
  'historical fixtures unexpectedly materialized before reconciliation');

select portal_private.reconcile_client_intake_v1(2,interval '5 minutes');
select pg_temp.p1_completion_assert(
  (select count(*)=2 from portal_private.client_intake_v1 where source_record_id like 'PORTAL-EVT-PG17-HISTORY-%'),
  'first bounded pass did not recover two sources');
select portal_private.reconcile_client_intake_v1(2,interval '5 minutes');
select pg_temp.p1_completion_assert(
  (select count(*)=4 from portal_private.client_intake_v1 where source_record_id like 'PORTAL-EVT-PG17-HISTORY-%'),
  'second bounded pass did not advance to next sources');
select portal_private.reconcile_client_intake_v1(2,interval '5 minutes');
select pg_temp.p1_completion_assert(
  (select count(*)=6 from portal_private.client_intake_v1 where source_record_id like 'PORTAL-EVT-PG17-HISTORY-%'),
  'third bounded pass did not complete historical source recovery');
select portal_private.reconcile_client_intake_v1(2,interval '5 minutes');
select pg_temp.p1_completion_assert(
  (select count(*)=6 from portal_private.client_intake_v1 where source_record_id like 'PORTAL-EVT-PG17-HISTORY-%'),
  'idempotent fourth pass changed recovered source count');
select pg_temp.p1_completion_assert(
  (select count(*)=6 from portal_private.staff_tasks t join portal_private.portal_reverse_events e on e.id=t.source_reverse_event_key where e.event_id like 'PORTAL-EVT-PG17-HISTORY-%'),
  'historical sources did not route exactly once');
select pg_temp.p1_completion_assert(
  (select count(distinct t.id)=6 from portal_private.staff_tasks t join portal_private.portal_reverse_events e on e.id=t.source_reverse_event_key where e.event_id like 'PORTAL-EVT-PG17-HISTORY-%'),
  'historical reconciliation created duplicate tasks');

select 'P1_BOUNDED_RECONCILIATION_PROGRESS=PASS';
select 'P1_HISTORICAL_EXACTLY_ONCE=PASS';
