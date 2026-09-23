-- Admin Radio Stage 2A corrective: client recipient semantics, canonical chat event,
-- company-scoped delivery, and audit-safe QA retirement.
-- Visual/UI geometry is intentionally out of scope.

create or replace function portal_private.enqueue_reverse_event_staff_task()
returns trigger
language plpgsql
set search_path to 'pg_catalog','portal_private'
as $function$
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

  -- Admin initiated Radio chat is already a delivered communication fact.
  -- It must not create an internal staff task.
  if new.actor_role='ADMIN'::portal_private.portal_role_enum
     and new.event_type='ADMIN_CLIENT_MESSAGE_SUBMIT'
     and new.authority_domain='CLIENT_COMMUNICATION'
     and new.authority_target_type='MESSAGE' then
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
$function$;

create or replace function portal_private.server_admin_submit_radio_message_v1(
  p_actor uuid,
  p_client_id text,
  p_contract_id text,
  p_subject text,
  p_message text,
  p_reply_to_event_id text,
  p_idempotency_key text,
  p_request_id uuid default null,
  p_correlation_id uuid default null
)
returns table(
  event_key uuid,
  event_id text,
  created_at timestamptz,
  reused boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private','auth'
as $function$
declare
  v_actor_auth uuid;
  v_client uuid;
  v_contract uuid;
  v_message text;
  v_subject text;
  v_reply text;
  v_event_id text;
  v_payload jsonb;
  v_existing portal_private.portal_reverse_events%rowtype;
begin
  v_message:=btrim(coalesce(p_message,''));
  v_subject:=nullif(btrim(coalesce(p_subject,'')),'');
  v_reply:=nullif(btrim(coalesce(p_reply_to_event_id,'')),'');
  if p_actor is null
     or coalesce(btrim(p_client_id),'')=''
     or coalesce(btrim(p_contract_id),'')=''
     or v_message=''
     or char_length(v_message)>8000
     or (v_subject is not null and char_length(v_subject)>240)
     or coalesce(btrim(p_idempotency_key),'')='' then
    raise exception 'admin radio message required fields missing';
  end if;

  select pu.auth_user_id
    into v_actor_auth
  from portal_private.portal_users pu
  join portal_private.portal_user_roles r
    on r.user_id=pu.id
   and r.role='ADMIN'::portal_private.portal_role_enum
   and r.status='ACTIVE'::portal_private.binding_status_enum
   and r.revoked_at is null
  where pu.id=p_actor
    and pu.auth_user_id is not null
    and pu.status='ACTIVE'::portal_private.portal_user_status_enum
    and pu.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and pu.authority_state in (
      'CONFIRMED'::portal_private.authority_state_enum,
      'VERIFIED'::portal_private.authority_state_enum
    )
  limit 1;
  if v_actor_auth is null then raise exception 'admin role required'; end if;

  select cl.id,ct.id
    into v_client,v_contract
  from portal_private.clients cl
  join portal_private.contracts ct on ct.client_key=cl.id
  where cl.client_id=p_client_id
    and cl.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and cl.authority_state in (
      'CONFIRMED'::portal_private.authority_state_enum,
      'VERIFIED'::portal_private.authority_state_enum
    )
    and ct.contract_id=p_contract_id
    and ct.contract_status='ACTIVE'
    and ct.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and ct.authority_state in (
      'CONFIRMED'::portal_private.authority_state_enum,
      'VERIFIED'::portal_private.authority_state_enum
    )
    and ct.signed_contract_confirmed_at is not null
    and nullif(btrim(ct.current_external_contract_number),'') is not null
    and (ct.effective_from is null or ct.effective_from<=current_date)
    and (ct.effective_to is null or ct.effective_to>=current_date)
  limit 1;
  if v_client is null then raise exception 'client or contract target not current'; end if;

  if not exists(
    select 1
    from portal_private.client_user_bindings b
    join portal_private.portal_users pu on pu.id=b.user_id
    join portal_private.portal_user_roles pr
      on pr.user_id=pu.id
     and pr.role='CLIENT'::portal_private.portal_role_enum
     and pr.status='ACTIVE'::portal_private.binding_status_enum
     and pr.revoked_at is null
    where b.client_key=v_client
      and b.contract_key=v_contract
      and b.status='ACTIVE'::portal_private.binding_status_enum
      and b.revoked_at is null
      and b.valid_from<=now()
      and (b.valid_to is null or b.valid_to>now())
      and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and b.authority_state in (
        'CONFIRMED'::portal_private.authority_state_enum,
        'VERIFIED'::portal_private.authority_state_enum
      )
      and pu.status='ACTIVE'::portal_private.portal_user_status_enum
      and pu.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and pu.authority_state in (
        'CONFIRMED'::portal_private.authority_state_enum,
        'VERIFIED'::portal_private.authority_state_enum
      )
  ) then
    raise exception 'client target has no active portal recipient';
  end if;

  if v_reply is not null and not exists(
    select 1
    from portal_private.portal_reverse_events e
    where e.event_id=v_reply
      and e.client_key=v_client
      and e.actor_role='CLIENT'::portal_private.portal_role_enum
      and e.event_type='CLIENT_MESSAGE_SUBMIT'
      and e.authority_domain='CLIENT_COMMUNICATION'
      and e.authority_target_type='MESSAGE'
      and e.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  ) then
    raise exception 'reply target is not an active client radio message';
  end if;

  v_payload:=jsonb_strip_nulls(jsonb_build_object(
    'message',v_message,
    'subject',v_subject,
    'channel','RADIO_CHAT',
    'thread_scope','CLIENT_COMPANY',
    'thread_id','RADIO:'||p_client_id,
    'reply_to_event_id',v_reply
  ));

  select * into v_existing
  from portal_private.portal_reverse_events e
  where e.actor_user_id=p_actor and e.idempotency_key=p_idempotency_key;

  if found then
    if v_existing.event_type is distinct from 'ADMIN_CLIENT_MESSAGE_SUBMIT'
       or v_existing.authority_domain is distinct from 'CLIENT_COMMUNICATION'
       or v_existing.authority_target_type is distinct from 'MESSAGE'
       or v_existing.client_key is distinct from v_client
       or v_existing.contract_key is distinct from v_contract
       or v_existing.deal_key is not null
       or v_existing.payload is distinct from v_payload then
      raise exception 'idempotency key reused for different event';
    end if;
    return query select v_existing.id,v_existing.event_id,v_existing.created_at,true;
    return;
  end if;

  v_event_id:='PORTAL-EVT-'||replace(gen_random_uuid()::text,'-','');
  insert into portal_private.portal_reverse_events(
    event_id,idempotency_key,actor_user_id,actor_auth_user_id,actor_role,
    client_key,contract_key,deal_key,event_type,authority_domain,
    authority_target_type,authority_target_id,payload,processing_state,
    acknowledgement_state,acknowledged_at,acknowledged_by,request_id,
    correlation_id,source_version,source_timestamp,authority_state,lifecycle_state
  ) values(
    v_event_id,p_idempotency_key,p_actor,v_actor_auth,'ADMIN',
    v_client,v_contract,null,'ADMIN_CLIENT_MESSAGE_SUBMIT','CLIENT_COMMUNICATION',
    'MESSAGE',p_client_id,v_payload,'APPLIED',
    'ACKNOWLEDGED',now(),p_actor,p_request_id,
    p_correlation_id,'RADIO_CHAT_MESSAGE_V1',now(),'SOURCE_RECEIVED','ACTIVE'
  )
  returning id,portal_reverse_events.event_id,portal_reverse_events.created_at
    into event_key,event_id,created_at;

  insert into portal_private.portal_reverse_event_attempts(
    event_key,attempt_number,processing_state,result,metadata
  ) values(
    event_key,1,'APPLIED','SUCCESS',
    jsonb_build_object(
      'event_type','ADMIN_CLIENT_MESSAGE_SUBMIT',
      'actor_role','ADMIN',
      'channel','RADIO_CHAT',
      'client_id',p_client_id
    )
  );

  insert into portal_private.audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,
    request_id,correlation_id,metadata,severity,result
  ) values(
    p_actor,'ADMIN','ADMIN_RADIO_CLIENT_MESSAGE_SUBMIT','PORTAL_REVERSE_EVENT',event_id,
    p_request_id,p_correlation_id,
    jsonb_build_object('client_id',p_client_id,'contract_id',p_contract_id,'reply_to_event_id',v_reply),
    'INFO','SUCCESS'
  );

  reused:=false;
  return next;
end
$function$;

revoke all on function portal_private.server_admin_submit_radio_message_v1(
  uuid,text,text,text,text,text,text,uuid,uuid
) from public,anon,authenticated;

create or replace function portal_private.server_admin_retire_radio_qa_artifacts_v1(
  p_actor uuid,
  p_event_ids jsonb,
  p_request_id uuid default null,
  p_correlation_id uuid default null
)
returns table(
  retired_events integer,
  retired_tasks integer
)
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $function$
declare
  v_requested integer;
  v_distinct integer;
  v_eligible integer;
begin
  if p_actor is null or jsonb_typeof(p_event_ids)<>'array' then
    raise exception 'qa event ids required';
  end if;
  v_requested:=jsonb_array_length(p_event_ids);
  if v_requested<1 or v_requested>200 then raise exception 'qa event ids required'; end if;

  if not exists(
    select 1 from portal_private.portal_user_roles r
    join portal_private.portal_users pu on pu.id=r.user_id
    where r.user_id=p_actor
      and r.role='ADMIN'::portal_private.portal_role_enum
      and r.status='ACTIVE'::portal_private.binding_status_enum
      and r.revoked_at is null
      and pu.status='ACTIVE'::portal_private.portal_user_status_enum
      and pu.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  ) then raise exception 'admin role required'; end if;

  select count(distinct v)
    into v_distinct
  from jsonb_array_elements_text(p_event_ids) x(v)
  where v ~ '^PORTAL-EVT-[0-9a-f]+$';
  if v_distinct<>v_requested then raise exception 'qa event id set invalid'; end if;

  with requested as (
    select distinct v as event_id from jsonb_array_elements_text(p_event_ids) x(v)
  )
  select count(*)
    into v_eligible
  from requested r
  join portal_private.portal_reverse_events e on e.event_id=r.event_id
  join portal_private.portal_users pu on pu.id=e.actor_user_id
  where pu.source_system='QA_GITHUB_OIDC_RADIO_STAGE2A'
    and e.authority_domain='CLIENT_COMMUNICATION'
    and e.authority_target_type='MESSAGE'
    and e.event_type in ('CLIENT_MESSAGE_SUBMIT','ADMIN_CLIENT_MESSAGE_SUBMIT')
    and e.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum;

  if v_eligible<>v_requested then
    raise exception 'non-qa or non-active artifact in retirement set';
  end if;

  with requested as (
    select distinct v as event_id from jsonb_array_elements_text(p_event_ids) x(v)
  ),
  eligible as (
    select e.id
    from requested r
    join portal_private.portal_reverse_events e on e.event_id=r.event_id
    join portal_private.portal_users pu on pu.id=e.actor_user_id
    where pu.source_system='QA_GITHUB_OIDC_RADIO_STAGE2A'
      and e.authority_domain='CLIENT_COMMUNICATION'
      and e.authority_target_type='MESSAGE'
      and e.event_type in ('CLIENT_MESSAGE_SUBMIT','ADMIN_CLIENT_MESSAGE_SUBMIT')
      and e.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  )
  update portal_private.staff_tasks t
     set status='CLOSED'::portal_private.staff_task_status_enum,
         qa_only=true,
         decision='QA_ARTIFACT_RETIRED',
         decision_at=coalesce(t.decision_at,now()),
         decision_by=coalesce(t.decision_by,p_actor),
         updated_at=now()
   where t.source_reverse_event_key in (select id from eligible)
     and (t.status<>'CLOSED'::portal_private.staff_task_status_enum or t.qa_only=false);
  get diagnostics retired_tasks=row_count;

  with requested as (
    select distinct v as event_id from jsonb_array_elements_text(p_event_ids) x(v)
  )
  update portal_private.portal_reverse_events e
     set lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum,
         updated_at=now()
   from portal_private.portal_users pu,requested r
   where e.event_id=r.event_id
     and pu.id=e.actor_user_id
     and pu.source_system='QA_GITHUB_OIDC_RADIO_STAGE2A'
     and e.authority_domain='CLIENT_COMMUNICATION'
     and e.authority_target_type='MESSAGE'
     and e.event_type in ('CLIENT_MESSAGE_SUBMIT','ADMIN_CLIENT_MESSAGE_SUBMIT')
     and e.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum;
  get diagnostics retired_events=row_count;

  insert into portal_private.audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,
    request_id,correlation_id,metadata,severity,result
  ) values(
    p_actor,'ADMIN','ADMIN_RADIO_QA_ARTIFACTS_RETIRED','PORTAL_REVERSE_EVENT_SET',
    coalesce(p_request_id,gen_random_uuid())::text,
    p_request_id,p_correlation_id,
    jsonb_build_object(
      'requested_events',v_requested,
      'retired_events',retired_events,
      'retired_tasks',retired_tasks,
      'source_system','QA_GITHUB_OIDC_RADIO_STAGE2A'
    ),
    'INFO','SUCCESS'
  );

  return next;
end
$function$;

revoke all on function portal_private.server_admin_retire_radio_qa_artifacts_v1(
  uuid,jsonb,uuid,uuid
) from public,anon,authenticated;
