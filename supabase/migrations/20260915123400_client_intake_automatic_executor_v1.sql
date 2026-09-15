-- Stage 2.1 automatic executor correction.
-- Do not process the outbox from an AFTER INSERT trigger on the same outbox row: PostgreSQL
-- can reject self-locking/rewriting that row in the triggering command. Source triggers invoke
-- the processor after durable intake + outbox creation; pg_cron reconciliation remains the
-- periodic self-healing executor for retry/stale/missing states.

drop trigger if exists client_intake_outbox_auto_consumer_v1
  on portal_private.client_intake_routing_outbox_v1;

create or replace function portal_private.client_intake_reverse_event_trigger_v1()
returns trigger
language plpgsql
set search_path='pg_catalog','portal_private'
as $$
begin
  if new.actor_role='CLIENT'::portal_private.portal_role_enum
     and new.event_type like 'CLIENT_%' then
    perform portal_private.ensure_client_intake_from_reverse_event_v1(new.event_id);
    perform portal_private.process_client_intake_outbox_v1(100);
  end if;
  return new;
end
$$;

create or replace function portal_private.client_intake_application_trigger_v1()
returns trigger
language plpgsql
set search_path='pg_catalog','portal_private'
as $$
begin
  perform portal_private.ensure_client_intake_from_application_v1(new.application_id);
  perform portal_private.process_client_intake_outbox_v1(100);
  return new;
end
$$;

-- Existing production reverse-event trigger is also made a safe executor entry point for Client
-- events. The unique intake/outbox/task-stage keys keep multiple trigger invocations exactly-once.
create or replace function portal_private.enqueue_reverse_event_staff_task()
returns trigger
language plpgsql
set search_path='pg_catalog','portal_private'
as $$
declare
  tid text;
  role portal_private.staff_functional_role_enum;
begin
  if new.processing_state in ('REJECTED','FAILED','DEAD_LETTER')
     or lower(coalesce(new.payload->>'qa','false')) in ('true','1','yes')
     or lower(coalesce(new.payload->>'qa_only','false')) in ('true','1','yes')
     or new.authority_domain ilike 'QA%' then
    return new;
  end if;

  if new.actor_role='CLIENT'::portal_private.portal_role_enum
     and new.event_type like 'CLIENT_%' then
    perform portal_private.ensure_client_intake_from_reverse_event_v1(new.event_id);
    perform portal_private.process_client_intake_outbox_v1(100);
    return new;
  end if;

  role:=portal_private.staff_role_for_reverse_event(new.event_type);
  tid:='TASK-EVT-'||replace(new.event_id,'PORTAL-EVT-','');
  insert into portal_private.staff_tasks(
    task_id,title,status,priority,authority_domain,assigned_functional_role,
    client_key,contract_key,deal_key,source_reverse_event_key,source_type,
    source_object_id,source_version,qa_only,created_by
  ) values(
    tid,'Событие портала: '||new.event_type,'NEW','NORMAL',new.authority_domain,role,
    new.client_key,new.contract_key,new.deal_key,new.id,'PORTAL_REVERSE_EVENT',
    new.event_id,new.source_version,false,new.actor_user_id
  ) on conflict(source_reverse_event_key) do nothing;

  update portal_private.portal_reverse_events
     set processing_state='QUEUED',updated_at=now()
   where id=new.id and processing_state in ('RECEIVED','VALIDATED');
  return new;
end
$$;
