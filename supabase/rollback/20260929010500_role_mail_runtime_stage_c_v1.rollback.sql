-- RONA Trade / Stage C Role Mail Runtime V1 — non-destructive rollback
-- Restores pre-Stage-C runtime enqueue behavior and disables generic role-mail intake.
-- Mail/source/task records are retained for audit and are never deleted by rollback.

update portal_private.role_mail_intake_control_v1
set enabled=false,updated_at=now()
where enabled=true;

create or replace function portal_private.enqueue_ai_runtime_staff_task()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','portal_private','private'
as $function$
declare
  v_role portal_private.ai_business_role_enum;
  v_priority text;
  v_source_type text;
  v_payload jsonb;
begin
  if new.qa_only or new.assigned_functional_role is null then return new; end if;
  if new.status::text in ('DECIDED','COMPLETED','REJECTED','CLOSED') then return new; end if;
  v_role := portal_private.ai_runtime_ai_role_for_staff(new.assigned_functional_role);
  if v_role is null then return new; end if;
  v_priority := portal_private.ai_runtime_priority(new.priority::text);
  v_source_type := case when new.source_reverse_event_key is not null then 'PORTAL_REVERSE_EVENT' else 'STAFF_TASK' end;
  v_payload := jsonb_build_object(
    'task_id',new.task_id,
    'title',new.title,
    'authority_domain',new.authority_domain,
    'staff_role',new.assigned_functional_role::text,
    'requires_human_accounting_authority',(new.assigned_functional_role::text='ACCOUNTING'),
    'client_key',new.client_key,
    'contract_key',new.contract_key,
    'deal_key',new.deal_key,
    'source_object_id',new.source_object_id,
    'protocol','AI_STAFF_COMMUNICATION_PROTOCOL_V1_2'
  );
  insert into portal_private.ai_runtime_queue(source_type,source_id,source_record_id,target_role,priority,deadline_at,payload,qa_only)
  values(v_source_type,new.task_id,new.source_reverse_event_key,v_role,v_priority,portal_private.ai_runtime_deadline(v_priority,now()),v_payload,false)
  on conflict(source_type,source_id,target_role) do nothing;
  return new;
end
$function$;

create or replace function portal_private.enqueue_ai_runtime_coordination()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','portal_private','private'
as $function$
declare
  v_priority text;
  v_protocol text;
  v_target portal_private.ai_business_role_enum;
  v_from portal_private.ai_business_role_enum;
begin
  if new.qa_only or new.target_role is null then return new; end if;
  v_target := portal_private.ai_runtime_canonical_role(new.target_role);
  v_from := portal_private.ai_runtime_canonical_role(new.functional_role);
  if v_from=v_target and new.record_type<>'OPERATIONS_INTERNAL_DECISION' then return new; end if;
  v_priority:=portal_private.ai_runtime_priority(coalesce(new.payload->>'priority','NORMAL'));
  select protocol_version into v_protocol from portal_private.ai_runtime_control where singleton=true;
  v_protocol:=coalesce(v_protocol,'AI_STAFF_COMMUNICATION_PROTOCOL_V1_3');
  insert into portal_private.ai_runtime_queue(
    source_type,source_id,source_record_id,target_role,priority,deadline_at,payload,qa_only
  ) values(
    'COORDINATION',new.record_id::text,new.record_id,v_target,v_priority,
    portal_private.ai_runtime_deadline(v_priority,new.created_at),
    jsonb_build_object(
      'record_id',new.record_id,
      'record_type',new.record_type,
      'from_role',v_from::text,
      'source_functional_role',new.functional_role::text,
      'target_role',v_target::text,
      'source_target_role',new.target_role::text,
      'target_type',new.target_type,
      'target_id',new.target_id,
      'status',new.status,
      'payload',new.payload,
      'source_refs',new.source_refs,
      'protocol',v_protocol,
      'role_alias_normalized',(new.target_role::text<>v_target::text or new.functional_role::text<>v_from::text)
    ),
    false
  )
  on conflict(source_type,source_id,target_role) do nothing;
  return new;
end
$function$;

comment on table portal_private.role_mail_intake_v1 is
'Generic role-mail intake retained for audit after rollback; controls disabled.';
