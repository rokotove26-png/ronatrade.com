begin;

create or replace function portal_private.enqueue_reverse_event_staff_task()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'portal_private'
as $function$
declare
  tid text;
  role portal_private.staff_functional_role_enum;
begin
  if new.processing_state in ('REJECTED','FAILED','DEAD_LETTER')
     or lower(coalesce(new.payload->>'qa','false')) in ('true','1','yes')
     or lower(coalesce(new.payload->>'qa_only','false')) in ('true','1','yes')
     or new.authority_domain ilike 'QA%'
  then
    return new;
  end if;

  -- Client-originated communication is an Admin LK intake first.
  -- No functional staff task is created until an authenticated Admin routes it.
  if new.actor_role = 'CLIENT'::portal_private.portal_role_enum
     and new.event_type like 'CLIENT_%'
  then
    return new;
  end if;

  role := portal_private.staff_role_for_reverse_event(new.event_type);
  tid := 'TASK-EVT-' || replace(new.event_id,'PORTAL-EVT-','');

  insert into portal_private.staff_tasks(
    task_id,title,status,priority,authority_domain,assigned_functional_role,
    client_key,contract_key,deal_key,source_reverse_event_key,
    source_type,source_object_id,source_version,qa_only,created_by
  )
  values(
    tid,'Событие портала: ' || new.event_type,'NEW','NORMAL',new.authority_domain,role,
    new.client_key,new.contract_key,new.deal_key,new.id,
    'PORTAL_REVERSE_EVENT',new.event_id,new.source_version,false,new.actor_user_id
  )
  on conflict(source_reverse_event_key) do nothing;

  update portal_private.portal_reverse_events
     set processing_state='QUEUED',updated_at=now()
   where id=new.id
     and processing_state in ('RECEIVED','VALIDATED');

  return new;
end
$function$;

create or replace function portal_private.server_admin_route_client_intake(
  p_actor uuid,
  p_event_id text,
  p_role portal_private.staff_functional_role_enum,
  p_request_id uuid default null,
  p_correlation_id uuid default null
)
returns table(
  event_id text,
  task_id text,
  assigned_functional_role portal_private.staff_functional_role_enum,
  processing_state text,
  reused boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'portal_private'
as $function$
declare
  ev portal_private.portal_reverse_events%rowtype;
  existing_task portal_private.staff_tasks%rowtype;
  created_task portal_private.staff_tasks%rowtype;
  app_key uuid;
  tid text;
begin
  if p_actor is null or coalesce(btrim(p_event_id),'')='' or p_role is null then
    raise exception 'admin intake routing required fields missing';
  end if;

  if not exists(
    select 1
      from portal_private.portal_user_roles r
     where r.user_id=p_actor
       and r.role='ADMIN'::portal_private.portal_role_enum
       and r.status='ACTIVE'
       and r.revoked_at is null
  ) then
    raise exception 'admin role required';
  end if;

  select e.*
    into ev
    from portal_private.portal_reverse_events e
   where e.event_id=p_event_id
     and e.lifecycle_state='ACTIVE'
   for update;

  if not found then
    raise exception 'client intake event not found';
  end if;

  if ev.actor_role <> 'CLIENT'::portal_private.portal_role_enum
     or ev.event_type not like 'CLIENT_%'
  then
    raise exception 'event is not client intake';
  end if;

  if ev.acknowledgement_state <> 'PENDING' then
    raise exception 'client intake already acknowledged';
  end if;

  select t.*
    into existing_task
    from portal_private.staff_tasks t
   where t.source_reverse_event_key=ev.id
   limit 1;

  if found then
    return query
    select ev.event_id,existing_task.task_id,existing_task.assigned_functional_role,
           ev.processing_state::text,true;
    return;
  end if;

  if ev.processing_state not in ('RECEIVED','VALIDATED') then
    raise exception 'client intake is not routable from current state';
  end if;

  if ev.authority_target_type='APPLICATION' and coalesce(ev.authority_target_id,'')<>'' then
    select a.id
      into app_key
      from portal_private.client_applications a
     where a.application_id=ev.authority_target_id
       and (ev.client_key is null or a.client_key=ev.client_key)
       and (ev.contract_key is null or a.contract_key=ev.contract_key)
     limit 1;
  end if;

  tid := 'TASK-EVT-' || replace(ev.event_id,'PORTAL-EVT-','');

  insert into portal_private.staff_tasks(
    task_id,title,status,priority,authority_domain,assigned_functional_role,
    client_key,contract_key,application_key,deal_key,source_reverse_event_key,
    source_type,source_object_id,source_version,qa_only,created_by
  )
  values(
    tid,'Событие клиента через ЛК Администратора: ' || ev.event_type,
    'NEW','NORMAL',ev.authority_domain,p_role,
    ev.client_key,ev.contract_key,app_key,ev.deal_key,ev.id,
    'PORTAL_REVERSE_EVENT',ev.event_id,ev.source_version,false,p_actor
  )
  returning * into created_task;

  update portal_private.portal_reverse_events
     set processing_state='QUEUED',
         updated_at=now()
   where id=ev.id;

  insert into portal_private.audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,
    request_id,correlation_id,metadata,severity,result
  )
  values(
    p_actor,'ADMIN','ADMIN_ROUTE_CLIENT_INTAKE','PORTAL_REVERSE_EVENT',ev.event_id,
    p_request_id,p_correlation_id,
    jsonb_build_object(
      'event_type',ev.event_type,
      'authority_domain',ev.authority_domain,
      'authority_target_type',ev.authority_target_type,
      'authority_target_id',ev.authority_target_id,
      'assigned_functional_role',p_role::text,
      'task_id',created_task.task_id
    ),
    'INFO','SUCCESS'
  );

  return query
  select ev.event_id,created_task.task_id,created_task.assigned_functional_role,
         'QUEUED'::text,false;
end
$function$;

revoke all on function portal_private.server_admin_route_client_intake(
  uuid,text,portal_private.staff_functional_role_enum,uuid,uuid
) from public;
grant execute on function portal_private.server_admin_route_client_intake(
  uuid,text,portal_private.staff_functional_role_enum,uuid,uuid
) to service_role;

commit;
