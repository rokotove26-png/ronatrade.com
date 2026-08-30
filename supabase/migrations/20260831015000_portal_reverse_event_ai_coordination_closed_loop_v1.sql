create or replace function portal_private.apply_reverse_event_ai_coordination_record_v1(p_record_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_record portal_private.ai_coordination_records%rowtype;
  v_task portal_private.staff_tasks%rowtype;
  v_event portal_private.portal_reverse_events%rowtype;
  v_from_task text;
  v_to_task text;
  v_from_processing text;
  v_to_processing text;
  v_from_ack text;
  v_to_ack text;
  v_progress text;
  v_conclusion text;
  v_terminal boolean := false;
  v_changed boolean := false;
begin
  select * into v_record
  from portal_private.ai_coordination_records
  where record_id=p_record_id;

  if not found
     or v_record.qa_only
     or upper(coalesce(v_record.target_type,''))<>'TASK'
     or v_record.record_type not in ('TASK_ACKNOWLEDGEMENT','TASK_PROGRESS','FUNCTIONAL_CONCLUSION') then
    return false;
  end if;

  select * into v_task
  from portal_private.staff_tasks
  where task_id=v_record.target_id
  for update;

  if not found
     or v_task.source_reverse_event_key is null
     or v_task.assigned_functional_role is null
     or v_task.assigned_functional_role::text<>v_record.functional_role::text then
    return false;
  end if;

  if v_task.status::text in ('DECIDED','COMPLETED','REJECTED','CLOSED') then
    return false;
  end if;

  select * into v_event
  from portal_private.portal_reverse_events
  where id=v_task.source_reverse_event_key
  for update;

  if not found
     or v_event.lifecycle_state<>'ACTIVE'::portal_private.lifecycle_state_enum
     or upper(coalesce(v_event.processing_state,'')) in ('COMPLETED','REJECTED','FAILED','DEAD_LETTER','CLOSED') then
    return false;
  end if;

  v_from_task := v_task.status::text;
  v_from_processing := v_event.processing_state;
  v_from_ack := v_event.acknowledgement_state;
  v_to_task := v_from_task;
  v_to_processing := v_from_processing;
  v_to_ack := v_from_ack;

  if v_record.record_type='TASK_ACKNOWLEDGEMENT' then
    if v_from_task='NEW' then v_to_task:='ACKNOWLEDGED'; end if;
    if upper(coalesce(v_from_processing,'')) in ('RECEIVED','VALIDATED','QUEUED') then
      v_to_processing:='ACKNOWLEDGED';
    end if;
    if upper(coalesce(v_from_ack,''))='PENDING' then v_to_ack:='ACKNOWLEDGED'; end if;

  elsif v_record.record_type='TASK_PROGRESS' then
    v_progress := upper(coalesce(v_record.payload->>'progress_status',v_record.status,''));
    if v_progress='ACKNOWLEDGED' then
      if v_from_task='NEW' then v_to_task:='ACKNOWLEDGED'; end if;
      if upper(coalesce(v_from_processing,'')) in ('RECEIVED','VALIDATED','QUEUED') then v_to_processing:='ACKNOWLEDGED'; end if;
      if upper(coalesce(v_from_ack,''))='PENDING' then v_to_ack:='ACKNOWLEDGED'; end if;
    elsif v_progress='IN_PROGRESS' then
      v_to_task:='IN_PROGRESS';
      v_to_processing:='IN_PROGRESS';
      v_to_ack:='ACKNOWLEDGED';
    elsif v_progress='BLOCKED' then
      v_to_task:='WAITING';
      v_to_processing:='WAITING';
      v_to_ack:='ACKNOWLEDGED';
    elsif v_progress='READY_FOR_REVIEW' then
      v_to_task:='IN_PROGRESS';
      v_to_processing:='READY_FOR_REVIEW';
      v_to_ack:='ACKNOWLEDGED';
    else
      return false;
    end if;

  elsif v_record.record_type='FUNCTIONAL_CONCLUSION' then
    v_conclusion := upper(coalesce(v_record.payload->>'status',v_record.status,''));
    if v_conclusion in ('APPROVED','APPROVED_WITH_CONDITIONS') then
      v_to_task:='COMPLETED';
      v_to_processing:='COMPLETED';
      v_to_ack:='ACKNOWLEDGED';
      v_terminal:=true;
    elsif v_conclusion='HOLD' then
      v_to_task:='WAITING';
      v_to_processing:='WAITING';
      v_to_ack:='ACKNOWLEDGED';
    elsif v_conclusion='REJECTED' then
      v_to_task:='REJECTED';
      v_to_processing:='REJECTED';
      v_to_ack:='REJECTED';
      v_terminal:=true;
    else
      return false;
    end if;
  end if;

  v_changed := v_to_task is distinct from v_from_task
               or v_to_processing is distinct from v_from_processing
               or v_to_ack is distinct from v_from_ack;
  if not v_changed then return false; end if;

  update portal_private.staff_tasks
     set status=v_to_task::portal_private.staff_task_status_enum,
         acknowledged_at=case
           when v_to_ack in ('ACKNOWLEDGED','REJECTED') then coalesce(acknowledged_at,v_record.created_at,now())
           else acknowledged_at
         end,
         decision=case
           when v_record.record_type='FUNCTIONAL_CONCLUSION' and v_terminal then 'AI_FUNCTIONAL_CONCLUSION:'||v_conclusion
           else decision
         end,
         decision_at=case
           when v_record.record_type='FUNCTIONAL_CONCLUSION' and v_terminal then coalesce(decision_at,v_record.created_at,now())
           else decision_at
         end
   where id=v_task.id;

  update portal_private.portal_reverse_events
     set processing_state=v_to_processing,
         acknowledgement_state=v_to_ack,
         acknowledged_at=case
           when v_to_ack in ('ACKNOWLEDGED','REJECTED') then coalesce(acknowledged_at,v_record.created_at,now())
           else acknowledged_at
         end,
         last_error_code=null,
         last_error_text=null,
         next_retry_at=null
   where id=v_event.id;

  insert into portal_private.staff_task_history(
    task_key,event_type,actor_user_id,actor_functional_role,from_status,to_status,note,request_id,correlation_id,metadata
  ) values (
    v_task.id,
    'AI_COORDINATION_SETTLEMENT',
    null,
    v_record.functional_role::text::portal_private.staff_functional_role_enum,
    v_from_task::portal_private.staff_task_status_enum,
    v_to_task::portal_private.staff_task_status_enum,
    case
      when v_record.record_type='FUNCTIONAL_CONCLUSION' then coalesce(v_record.payload->>'summary','Functional conclusion recorded')
      when v_record.record_type='TASK_PROGRESS' then coalesce(v_record.payload->>'note','AI task progress recorded')
      else 'AI task acknowledgement recorded'
    end,
    v_record.mcp_request_id,
    v_record.correlation_id,
    jsonb_build_object(
      'actor_type','AI',
      'identity_id',v_record.identity_id,
      'coordination_record_id',v_record.record_id,
      'record_type',v_record.record_type,
      'record_status',v_record.status,
      'event_id',v_event.event_id,
      'event_processing_from',v_from_processing,
      'event_processing_to',v_to_processing,
      'event_ack_from',v_from_ack,
      'event_ack_to',v_to_ack,
      'business_mutation',false
    )
  );

  insert into portal_private.audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata
  ) values (
    null,
    v_record.functional_role::text,
    'AI_REVERSE_EVENT_LIFECYCLE_SETTLED',
    'PORTAL_REVERSE_EVENT',
    v_event.event_id,
    v_record.mcp_request_id,
    v_record.correlation_id,
    jsonb_build_object(
      'actor_type','AI',
      'identity_id',v_record.identity_id,
      'coordination_record_id',v_record.record_id,
      'task_id',v_task.task_id,
      'task_status_from',v_from_task,
      'task_status_to',v_to_task,
      'processing_state_from',v_from_processing,
      'processing_state_to',v_to_processing,
      'acknowledgement_state_from',v_from_ack,
      'acknowledgement_state_to',v_to_ack,
      'functional_conclusion_status',v_conclusion,
      'business_mutation',false
    )
  );

  return true;
end;
$$;

create or replace function portal_private.settle_reverse_event_from_ai_coordination_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $$
begin
  perform portal_private.apply_reverse_event_ai_coordination_record_v1(new.record_id);
  return new;
end;
$$;

drop trigger if exists trg_ai_coordination_reverse_event_settle_v1 on portal_private.ai_coordination_records;
create trigger trg_ai_coordination_reverse_event_settle_v1
after insert on portal_private.ai_coordination_records
for each row
execute function portal_private.settle_reverse_event_from_ai_coordination_v1();

revoke all on function portal_private.apply_reverse_event_ai_coordination_record_v1(uuid) from public;
revoke all on function portal_private.settle_reverse_event_from_ai_coordination_v1() from public;

comment on function portal_private.apply_reverse_event_ai_coordination_record_v1(uuid) is
'Authority-safe closed-loop settlement of portal reverse-event staff tasks from immutable AI coordination. The coordination role must exactly match the assigned staff role; no business table is changed.';
