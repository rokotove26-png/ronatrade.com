begin;

create or replace function portal_private.client_user_has_archive_contract_access(
  p_user_id uuid,
  p_contract_key uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path to 'pg_catalog','portal_private'
as $function$
  select
    portal_private.client_user_has_contract_access(p_user_id,p_contract_key,p_at)
    or exists(
      select 1
        from portal_private.client_user_bindings b
        join portal_private.contracts ct on ct.id=b.contract_key and ct.client_key=b.client_key
       where b.user_id=p_user_id
         and b.contract_key=p_contract_key
         and b.status='REVOKED'::portal_private.binding_status_enum
         and b.revoked_at is not null
         and b.lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum
         and b.authority_state='SUPERSEDED'::portal_private.authority_state_enum
         and ct.lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum
         and ct.authority_state='SUPERSEDED'::portal_private.authority_state_enum
         and exists(
           select 1 from portal_private.portal_user_roles r
            where r.user_id=p_user_id
              and r.role='CLIENT'::portal_private.portal_role_enum
              and r.status='ACTIVE'::portal_private.binding_status_enum
              and r.revoked_at is null
         )
    );
$function$;

create or replace function portal_private.client_user_has_archive_deal_access(
  p_user_id uuid,
  p_deal_key uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path to 'pg_catalog','portal_private'
as $function$
  select exists(
    select 1
      from portal_private.deals d
      join portal_private.contracts ct on ct.id=d.contract_key and ct.client_key=d.client_key
      join portal_private.client_user_bindings b on b.user_id=p_user_id and b.client_key=d.client_key and b.contract_key=d.contract_key
     where d.id=p_deal_key
       and d.authority_state<>'REJECTED'::portal_private.authority_state_enum
       and portal_private.client_user_has_archive_contract_access(p_user_id,d.contract_key,p_at)
       and (
         (
           b.status='ACTIVE'::portal_private.binding_status_enum
           and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
           and b.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
           and b.valid_from<=p_at
           and (b.valid_to is null or b.valid_to>p_at)
           and b.revoked_at is null
           and portal_private.client_user_has_contract_access(p_user_id,d.contract_key,p_at)
         )
         or
         (
           b.status='REVOKED'::portal_private.binding_status_enum
           and b.revoked_at is not null
           and b.lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum
           and b.authority_state='SUPERSEDED'::portal_private.authority_state_enum
           and ct.lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum
           and ct.authority_state='SUPERSEDED'::portal_private.authority_state_enum
         )
       )
       and (
         b.deal_scope_mode='ALL_CONTRACT_DEALS'
         or exists(
           select 1
             from portal_private.client_user_deal_grants g
            where g.binding_id=b.id
              and g.user_id=p_user_id
              and g.deal_key=d.id
              and (
                (
                  b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
                  and g.status='ACTIVE'::portal_private.binding_status_enum
                  and g.valid_from<=p_at
                  and (g.valid_to is null or g.valid_to>p_at)
                  and g.revoked_at is null
                  and g.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
                  and g.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
                )
                or
                (
                  b.lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum
                  and g.status='REVOKED'::portal_private.binding_status_enum
                  and g.revoked_at is not null
                  and g.lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum
                  and g.authority_state='SUPERSEDED'::portal_private.authority_state_enum
                )
              )
         )
       )
  );
$function$;

create or replace function portal_private.client_user_has_archive_document_access(
  p_user_id uuid,
  p_document_key uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path to 'pg_catalog','portal_private'
as $function$
  select exists(
    select 1
      from portal_private.documents d
     where d.id=p_document_key
       and d.authority_state<>'REJECTED'::portal_private.authority_state_enum
       and (
         (d.deal_key is not null and portal_private.client_user_has_archive_deal_access(p_user_id,d.deal_key,p_at))
         or
         (d.deal_key is null and portal_private.client_user_has_archive_contract_access(p_user_id,d.contract_key,p_at))
       )
  );
$function$;

revoke all on function portal_private.client_user_has_archive_contract_access(uuid,uuid,timestamptz) from public;
revoke all on function portal_private.client_user_has_archive_deal_access(uuid,uuid,timestamptz) from public;
revoke all on function portal_private.client_user_has_archive_document_access(uuid,uuid,timestamptz) from public;
grant execute on function portal_private.client_user_has_archive_contract_access(uuid,uuid,timestamptz) to service_role;
grant execute on function portal_private.client_user_has_archive_deal_access(uuid,uuid,timestamptz) to service_role;
grant execute on function portal_private.client_user_has_archive_document_access(uuid,uuid,timestamptz) to service_role;

alter table portal_private.portal_reverse_events add column if not exists client_response_text text;
alter table portal_private.portal_reverse_events add column if not exists client_response_published_at timestamptz;
alter table portal_private.portal_reverse_events add column if not exists client_response_published_by uuid;
alter table portal_private.portal_reverse_events add column if not exists client_response_source_task_key uuid;

do $block$
begin
  if not exists(select 1 from pg_constraint where conname='portal_reverse_events_client_response_published_by_fkey' and conrelid='portal_private.portal_reverse_events'::regclass) then
    alter table portal_private.portal_reverse_events
      add constraint portal_reverse_events_client_response_published_by_fkey
      foreign key(client_response_published_by) references portal_private.portal_users(id) on delete restrict;
  end if;
  if not exists(select 1 from pg_constraint where conname='portal_reverse_events_client_response_source_task_key_fkey' and conrelid='portal_private.portal_reverse_events'::regclass) then
    alter table portal_private.portal_reverse_events
      add constraint portal_reverse_events_client_response_source_task_key_fkey
      foreign key(client_response_source_task_key) references portal_private.staff_tasks(id) on delete restrict;
  end if;
  if not exists(select 1 from pg_constraint where conname='portal_reverse_events_client_response_state_chk' and conrelid='portal_private.portal_reverse_events'::regclass) then
    alter table portal_private.portal_reverse_events
      add constraint portal_reverse_events_client_response_state_chk
      check (
        (client_response_text is null and client_response_published_at is null and client_response_published_by is null and client_response_source_task_key is null)
        or
        (client_response_text is not null and btrim(client_response_text)<>'' and char_length(client_response_text)<=8000 and client_response_published_at is not null and client_response_published_by is not null and client_response_source_task_key is not null)
      );
  end if;
end
$block$;

create or replace function portal_private.server_admin_publish_client_response(
  p_actor uuid,
  p_event_id text,
  p_response_text text,
  p_source_task_id text,
  p_request_id uuid default null,
  p_correlation_id uuid default null
)
returns table(event_id text,response_published_at timestamptz,response_source_task_id text,reused boolean)
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $function$
declare
  ev portal_private.portal_reverse_events%rowtype;
  task portal_private.staff_tasks%rowtype;
  v_response text;
begin
  v_response:=btrim(coalesce(p_response_text,''));
  if p_actor is null or coalesce(btrim(p_event_id),'')='' or v_response='' or char_length(v_response)>8000 or coalesce(btrim(p_source_task_id),'')='' then
    raise exception 'admin client response required fields missing';
  end if;

  if not exists(
    select 1 from portal_private.portal_user_roles r
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

  if ev.actor_role<>'CLIENT'::portal_private.portal_role_enum or ev.event_type<>'CLIENT_MESSAGE_SUBMIT' then
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
   limit 1;
  if not found then raise exception 'source staff task not found'; end if;

  if not exists(
    select 1 from portal_private.staff_task_messages m
     where m.task_key=task.id
       and m.internal_only=true
       and btrim(m.message_text)<>''
  ) then
    raise exception 'staff response missing';
  end if;

  if ev.client_response_published_at is not null then
    if ev.client_response_text=v_response and ev.client_response_source_task_key=task.id then
      return query select ev.event_id,ev.client_response_published_at,task.task_id,true;
      return;
    end if;
    raise exception 'client response already published';
  end if;

  update portal_private.portal_reverse_events
     set client_response_text=v_response,
         client_response_published_at=now(),
         client_response_published_by=p_actor,
         client_response_source_task_key=task.id,
         processing_state='APPLIED',
         acknowledgement_state='ACKNOWLEDGED',
         acknowledged_at=coalesce(acknowledged_at,now()),
         acknowledged_by=coalesce(acknowledged_by,p_actor),
         updated_at=now()
   where id=ev.id
   returning portal_reverse_events.event_id,portal_reverse_events.client_response_published_at
        into event_id,response_published_at;

  response_source_task_id:=task.task_id;
  reused:=false;

  insert into portal_private.audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata,severity,result
  ) values(
    p_actor,'ADMIN','ADMIN_PUBLISH_CLIENT_RESPONSE','PORTAL_REVERSE_EVENT',ev.event_id,p_request_id,p_correlation_id,
    jsonb_build_object('event_type',ev.event_type,'task_id',task.task_id,'client_key',ev.client_key,'contract_key',ev.contract_key,'deal_key',ev.deal_key),
    'INFO','SUCCESS'
  );
  return next;
end
$function$;

revoke all on function portal_private.server_admin_publish_client_response(uuid,text,text,text,uuid,uuid) from public;
grant execute on function portal_private.server_admin_publish_client_response(uuid,text,text,text,uuid,uuid) to service_role;

commit;
