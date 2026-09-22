begin;

create or replace function portal_private.server_admin_radio_prepare_client_response_v1(
  p_actor uuid,
  p_event_id text,
  p_source_task_id text,
  p_response_text text,
  p_request_id uuid default null,
  p_correlation_id uuid default null
)
returns table(event_id text, source_task_id text, prepared boolean, reused boolean)
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $function$
declare
  ev portal_private.portal_reverse_events%rowtype;
  task portal_private.staff_tasks%rowtype;
  v_response text;
  v_role portal_private.staff_functional_role_enum;
begin
  v_response:=btrim(coalesce(p_response_text,''));
  if p_actor is null
     or coalesce(btrim(p_event_id),'')=''
     or coalesce(btrim(p_source_task_id),'')=''
     or v_response=''
     or char_length(v_response)>8000 then
    raise exception 'admin radio response required fields missing';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_event_id,0));

  if not exists(
    select 1
      from portal_private.portal_user_roles r
     where r.user_id=p_actor
       and r.role='ADMIN'::portal_private.portal_role_enum
       and r.status='ACTIVE'::portal_private.binding_status_enum
       and r.revoked_at is null
  ) then
    raise exception 'admin role required';
  end if;

  select e.* into ev
    from portal_private.portal_reverse_events e
   where e.event_id=p_event_id
     and e.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
   for update;
  if not found then raise exception 'client message not found'; end if;

  if ev.actor_role<>'CLIENT'::portal_private.portal_role_enum
     or ev.event_type<>'CLIENT_MESSAGE_SUBMIT' then
    raise exception 'event is not client message';
  end if;
  if ev.acknowledgement_state='REJECTED' then
    raise exception 'rejected client message cannot receive a published response';
  end if;

  select t.* into task
    from portal_private.staff_tasks t
   where t.task_id=p_source_task_id
     and t.source_reverse_event_key=ev.id
     and t.qa_only=false
   limit 1
   for update;
  if not found then raise exception 'source staff task not found'; end if;

  if task.assigned_functional_role is null then
    raise exception 'source staff task role missing';
  end if;
  v_role:=task.assigned_functional_role;

  if task.assigned_user_id is not null and task.assigned_user_id<>p_actor then
    raise exception 'admin staff user scope denied';
  end if;

  if not exists(
    select 1
      from portal_private.staff_user_roles r
     where r.user_id=p_actor
       and r.functional_role=v_role
       and r.status='ACTIVE'::portal_private.binding_status_enum
  ) then
    raise exception 'admin staff role denied';
  end if;

  event_id:=ev.event_id;
  source_task_id:=task.task_id;

  if ev.client_response_published_at is not null then
    prepared:=false;
    reused:=true;
    return next;
    return;
  end if;

  if exists(
    select 1
      from portal_private.staff_task_messages m
     where m.task_key=task.id
       and m.author_user_id=p_actor
       and m.author_functional_role=v_role
       and m.internal_only=true
       and btrim(m.message_text)=v_response
  ) then
    prepared:=true;
    reused:=true;
    return next;
    return;
  end if;

  insert into portal_private.staff_task_messages(
    task_key,
    author_user_id,
    author_functional_role,
    message_text,
    internal_only
  ) values(
    task.id,
    p_actor,
    v_role,
    v_response,
    true
  );

  insert into portal_private.audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,
    request_id,correlation_id,metadata,severity,result
  ) values(
    p_actor,
    'ADMIN',
    'ADMIN_RADIO_PREPARE_CLIENT_RESPONSE',
    'PORTAL_REVERSE_EVENT',
    ev.event_id,
    p_request_id,
    p_correlation_id,
    jsonb_build_object(
      'event_type',ev.event_type,
      'task_id',task.task_id,
      'functional_role',v_role,
      'client_key',ev.client_key,
      'contract_key',ev.contract_key,
      'deal_key',ev.deal_key
    ),
    'INFO',
    'SUCCESS'
  );

  prepared:=true;
  reused:=false;
  return next;
end
$function$;

revoke all on function portal_private.server_admin_radio_prepare_client_response_v1(uuid,text,text,text,uuid,uuid)
  from public, anon, authenticated;
grant execute on function portal_private.server_admin_radio_prepare_client_response_v1(uuid,text,text,text,uuid,uuid)
  to service_role;

comment on function portal_private.server_admin_radio_prepare_client_response_v1(uuid,text,text,text,uuid,uuid)
is 'Stage 2A MESSAGE-only server gate: binds Admin reply preparation to the exact CLIENT_MESSAGE_SUBMIT event, source task and active assigned staff role. Final client publication remains server_admin_publish_client_response.';

commit;
