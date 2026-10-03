
-- RONA Trade generic task progress settlement v1.
-- Makes task_acknowledge/task_progress_submit authoritative for assigned non-reverse-event tasks.
-- Reverse-event tasks remain owned by their existing specialized settlement trigger.

create or replace function portal_private.apply_generic_task_coordination_v1(
  p_record_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, portal_private
as $function$
declare
  v_record portal_private.ai_coordination_records%rowtype;
  v_task portal_private.staff_tasks%rowtype;
  v_from portal_private.staff_task_status_enum;
  v_to portal_private.staff_task_status_enum;
  v_progress text;
  v_note text;
begin
  select * into v_record
  from portal_private.ai_coordination_records
  where record_id=p_record_id;

  if not found
     or v_record.qa_only
     or upper(coalesce(v_record.target_type,''))<>'TASK'
     or v_record.record_type not in ('TASK_ACKNOWLEDGEMENT','TASK_PROGRESS')
  then
    return false;
  end if;

  select * into v_task
  from portal_private.staff_tasks
  where task_id=v_record.target_id
  for update;

  if not found
     or v_task.qa_only
     or v_task.source_reverse_event_key is not null
     or v_task.assigned_functional_role is null
     or v_task.assigned_functional_role::text<>v_record.functional_role::text
  then
    return false;
  end if;

  if v_task.status::text in ('DECIDED','COMPLETED','REJECTED','CLOSED') then
    return false;
  end if;

  v_from := v_task.status;
  v_to := v_from;

  if v_record.record_type='TASK_ACKNOWLEDGEMENT' then
    if v_from::text='NEW' then
      v_to := 'ACKNOWLEDGED'::portal_private.staff_task_status_enum;
    end if;
    v_note := 'AI task acknowledgement';
  else
    v_progress := upper(coalesce(v_record.payload->>'progress_status',v_record.status,''));
    v_note := coalesce(nullif(btrim(v_record.payload->>'note'),''),'AI task progress');

    if v_progress='ACKNOWLEDGED' then
      if v_from::text='NEW' then
        v_to := 'ACKNOWLEDGED'::portal_private.staff_task_status_enum;
      end if;
    elsif v_progress='IN_PROGRESS' then
      v_to := 'IN_PROGRESS'::portal_private.staff_task_status_enum;
    elsif v_progress='BLOCKED' then
      v_to := 'WAITING'::portal_private.staff_task_status_enum;
    elsif v_progress='READY_FOR_REVIEW' then
      v_to := 'IN_PROGRESS'::portal_private.staff_task_status_enum;
    else
      return false;
    end if;
  end if;

  if v_to is not distinct from v_from and v_task.acknowledged_at is not null then
    return false;
  end if;

  update portal_private.staff_tasks
     set status=v_to,
         acknowledged_at=case
           when v_record.record_type='TASK_ACKNOWLEDGEMENT'
             or upper(coalesce(v_record.payload->>'progress_status','')) in ('ACKNOWLEDGED','IN_PROGRESS','BLOCKED','READY_FOR_REVIEW')
           then coalesce(acknowledged_at,v_record.created_at,clock_timestamp())
           else acknowledged_at
         end,
         updated_at=clock_timestamp()
   where id=v_task.id;

  insert into portal_private.staff_task_history(
    task_key,event_type,actor_user_id,actor_functional_role,
    from_status,to_status,note,request_id,correlation_id,metadata
  )
  values(
    v_task.id,
    case when v_record.record_type='TASK_ACKNOWLEDGEMENT'
      then 'AI_TASK_ACKNOWLEDGEMENT'
      else 'AI_TASK_PROGRESS'
    end,
    null,
    v_record.functional_role::text::portal_private.staff_functional_role_enum,
    v_from,
    v_to,
    v_note,
    v_record.mcp_request_id,
    v_record.correlation_id,
    jsonb_build_object(
      'actor_type','AI',
      'coordination_record_id',v_record.record_id,
      'progress_status',v_progress,
      'business_mutation',false
    )
  );

  insert into portal_private.audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,
    request_id,correlation_id,metadata
  )
  values(
    null,
    v_record.functional_role::text,
    'AI_TASK_PROGRESS_SETTLED',
    'TASK',
    v_task.task_id,
    v_record.mcp_request_id,
    v_record.correlation_id,
    jsonb_build_object(
      'coordination_record_id',v_record.record_id,
      'from_status',v_from::text,
      'to_status',v_to::text,
      'business_mutation',false
    )
  );

  return true;
end
$function$;

revoke all on function portal_private.apply_generic_task_coordination_v1(uuid)
from public, anon, authenticated, service_role;

create or replace function portal_private.settle_generic_task_from_ai_coordination_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, portal_private
as $function$
begin
  if new.record_type in ('TASK_ACKNOWLEDGEMENT','TASK_PROGRESS') then
    perform portal_private.apply_generic_task_coordination_v1(new.record_id);
  end if;
  return new;
end
$function$;

drop trigger if exists trg_ai_coordination_generic_task_settle_v1
on portal_private.ai_coordination_records;

create trigger trg_ai_coordination_generic_task_settle_v1
after insert on portal_private.ai_coordination_records
for each row
execute function portal_private.settle_generic_task_from_ai_coordination_v1();

do $qa$
begin
  if not exists(
    select 1
    from pg_catalog.pg_trigger
    where tgrelid='portal_private.ai_coordination_records'::regclass
      and tgname='trg_ai_coordination_generic_task_settle_v1'
      and not tgisinternal
  ) then
    raise exception 'GENERIC_TASK_SETTLEMENT_QA_TRIGGER_MISSING';
  end if;
end
$qa$;
