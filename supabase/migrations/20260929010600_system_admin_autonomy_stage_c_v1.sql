-- RONA Trade / AI Office Stage C — System Admin safe autonomous coordination V1
-- OWNER_AUTHORITY=PENDING_SEPARATE_PRODUCTION_WRITE_APPROVAL
-- BUSINESS_DATA_MUTATION=NONE
-- SYSTEM_ADMIN_AUTONOMOUS_BUSINESS_MUTATION=FORBIDDEN
-- SYSTEM_ADMIN_AUTONOMOUS_OUTPUT=NO_ACTION|FUNCTIONAL_CONCLUSION|HANDOFF_REQUEST

create or replace function portal_private.ai_executor_role_scope(
  p_role portal_private.ai_business_role_enum,
  p_type text
)
returns boolean
language sql
immutable
set search_path='pg_catalog','portal_private'
as $function$
  select case portal_private.ai_runtime_canonical_role(p_role)::text
    when 'OPERATIONS_DIRECTOR' then upper(p_type)=any(array['CLIENT','CONTRACT','APPLICATION','DEAL','DOCUMENT','PAYMENT','SHIPMENT','RAIL_DOCUMENT','PUBLICATION','TASK','SYSTEM'])
    when 'FINANCE' then upper(p_type)=any(array['CONTRACT','APPLICATION','DEAL','PAYMENT','TASK'])
    when 'LEGAL' then upper(p_type)=any(array['CONTRACT','DEAL','DOCUMENT','TASK'])
    when 'COMMERCIAL_DIRECTOR' then upper(p_type)=any(array['DEAL','PUBLICATION','TASK'])
    when 'RAIL_LOGISTICS' then upper(p_type)=any(array['DEAL','SHIPMENT','RAIL_DOCUMENT','TASK'])
    when 'SYSTEM_ADMIN' then upper(p_type)=any(array['TASK','SYSTEM'])
    else false
  end
$function$;

create or replace function public.rona_ai_executor_claim_v2(
  p_worker_id text,
  p_limit integer default 1
)
returns table(
  queue_id uuid,
  source_type text,
  source_id text,
  source_record_id uuid,
  target_role text,
  priority text,
  correlation_id uuid,
  payload jsonb,
  attempts integer,
  max_attempts integer,
  lease_seconds integer,
  model_id text,
  max_output_tokens integer
)
language plpgsql
security definer
set search_path='pg_catalog','portal_private','public'
as $function$
declare
  c portal_private.ai_model_executor_control%rowtype;
  lim integer;
begin
  select * into c from portal_private.ai_model_executor_control where singleton=true;
  if not c.enabled or c.state<>'ENABLED' then return; end if;
  if not exists(
    select 1 from portal_private.ai_runtime_control r
    where r.singleton=true
      and r.enabled=true
      and r.scheduler_state='ENABLED'
      and r.model_execution_state='ENABLED'
  ) then return; end if;

  if p_worker_id is null or length(p_worker_id)<8 or length(p_worker_id)>120 then
    raise exception 'AI_EXECUTOR_WORKER_ID_INVALID';
  end if;

  lim:=greatest(1,least(coalesce(p_limit,1),c.max_items_per_run,5));

  return query
  with picked as (
    select q.id
    from portal_private.ai_runtime_queue q
    where q.state='DELIVERED'
      and q.qa_only=false
      and q.created_at>=c.execute_after
      and q.available_at<=now()
      and q.attempts<c.max_attempts
      and (q.lease_until is null or q.lease_until<now())
    order by
      case when q.source_type='STAFF_TASK'
             and q.source_id like 'TASK-FIN-SCHEDULE-V8-%'
             and q.target_role::text='FINANCE'
           then 0 else 1 end,
      case q.priority when 'CRITICAL' then 1 when 'HIGH' then 2 when 'NORMAL' then 3 else 4 end,
      q.deadline_at nulls last,
      q.created_at
    for update skip locked
    limit lim
  ),
  claimed as (
    update portal_private.ai_runtime_queue q
       set lease_until=now()+make_interval(secs=>c.lease_seconds),
           claimed_by='model-executor:'||p_worker_id,
           attempts=q.attempts+1,
           updated_at=now()
    from picked p
    where q.id=p.id
    returning q.*
  )
  select q.id,q.source_type,q.source_id,q.source_record_id,q.target_role::text,q.priority,
         q.correlation_id,q.payload,q.attempts,c.max_attempts,c.lease_seconds,c.model_id,c.max_output_tokens
  from claimed q;
end
$function$;

revoke all on function public.rona_ai_executor_claim_v2(text,integer) from public,anon,authenticated;
grant execute on function public.rona_ai_executor_claim_v2(text,integer) to service_role;

create or replace function public.rona_ai_executor_issue_read_token_v2(
  p_queue_id uuid,
  p_worker_id text
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','portal_private','public'
as $function$
declare
  q record;
  ident record;
  secret text;
  hdr text;
  pay text;
  unsigned text;
  sig text;
  j uuid:=gen_random_uuid();
  n bigint:=extract(epoch from now())::bigint;
  b64h text;
  b64p text;
begin
  select id,target_role::text as target_role,claimed_by,lease_until
    into q
  from portal_private.ai_runtime_queue
  where id=p_queue_id
    and state='DELIVERED'
    and qa_only=false
    and claimed_by='model-executor:'||p_worker_id
    and lease_until>now();

  if not found then raise exception 'AI_EXECUTOR_QUEUE_LEASE_INVALID'; end if;

  select identity_id,business_role::text as business_role,status::text as status,
         credential_version,revoked_at,not_before,token_ttl_seconds
    into ident
  from portal_private.ai_service_identities
  where business_role=q.target_role::portal_private.ai_business_role_enum
  limit 1;

  if not found
     or ident.status<>'ACTIVE'
     or ident.revoked_at is not null
     or (ident.not_before is not null and ident.not_before>now()) then
    raise exception 'AI_EXECUTOR_ROLE_IDENTITY_UNAVAILABLE';
  end if;

  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name='rona_ai_token_signing_key_v1'
  limit 1;

  if secret is null or length(secret)<32 then raise exception 'AI_SIGNING_KEY_UNAVAILABLE'; end if;

  hdr:='{"alg":"HS256","typ":"JWT","kid":"rona-ai-v1"}';
  pay:=jsonb_build_object(
    'iss','rona-ai-identity-broker',
    'aud','rona-ai-read-only',
    'sub',ident.identity_id,
    'role',ident.business_role,
    'ver',ident.credential_version,
    'iat',n-5,
    'nbf',n-5,
    'exp',n+least(greatest(coalesce(ident.token_ttl_seconds,300),60),300),
    'jti',j::text,
    'actor_type','AI',
    'scope','READ_ONLY'
  )::text;

  b64h:=rtrim(translate(replace(replace(encode(convert_to(hdr,'UTF8'),'base64'),chr(10),''),chr(13),''),'+/','-_'),'=');
  b64p:=rtrim(translate(replace(replace(encode(convert_to(pay,'UTF8'),'base64'),chr(10),''),chr(13),''),'+/','-_'),'=');
  unsigned:=b64h||'.'||b64p;
  sig:=rtrim(translate(replace(replace(encode(extensions.hmac(convert_to(unsigned,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'base64'),chr(10),''),chr(13),''),'+/','-_'),'=');

  return jsonb_build_object(
    'access_token',unsigned||'.'||sig,
    'token_type','Bearer',
    'expires_in',least(greatest(coalesce(ident.token_ttl_seconds,300),60),300),
    'functional_role',ident.business_role,
    'ai_identity_id',ident.identity_id,
    'jti',j
  );
end
$function$;

revoke all on function public.rona_ai_executor_issue_read_token_v2(uuid,text) from public,anon,authenticated;
grant execute on function public.rona_ai_executor_issue_read_token_v2(uuid,text) to service_role;

create or replace function public.rona_ai_executor_commit_system_action_v1(
  p_queue_id uuid,
  p_worker_id text,
  p_action jsonb,
  p_response_id text,
  p_model text,
  p_request_hash text,
  p_output_hash text,
  p_usage jsonb
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','portal_private','public'
as $function$
declare
  q portal_private.ai_runtime_queue%rowtype;
  c portal_private.ai_model_executor_control%rowtype;
  ident record;
  action_name text;
  entity_type text;
  entity_id text;
  expected_type text;
  expected_id text;
  out_target portal_private.ai_business_role_enum;
  record_type text;
  status_text text;
  payload_body jsonb;
  source_refs jsonb;
  idem_hash text;
  body_hash text;
  rec_id uuid;
begin
  select * into c from portal_private.ai_model_executor_control where singleton=true;
  if not found or not c.enabled or c.state<>'ENABLED' then
    raise exception 'AI_EXECUTOR_NOT_ENABLED';
  end if;

  select * into q
  from portal_private.ai_runtime_queue
  where id=p_queue_id
  for update;

  if not found
     or q.state<>'DELIVERED'
     or q.qa_only
     or q.target_role::text<>'SYSTEM_ADMIN'
     or q.claimed_by<>'model-executor:'||p_worker_id
     or q.lease_until is null
     or q.lease_until<=now() then
    raise exception 'AI_EXECUTOR_QUEUE_LEASE_INVALID';
  end if;

  select identity_id,business_role
    into ident
  from portal_private.ai_service_identities
  where business_role='SYSTEM_ADMIN'::portal_private.ai_business_role_enum
    and status='ACTIVE'
    and revoked_at is null
  limit 1;

  if not found then raise exception 'AI_EXECUTOR_ROLE_IDENTITY_UNAVAILABLE'; end if;

  action_name:=upper(coalesce(p_action->>'action',''));

  if action_name='NO_ACTION' then
    update portal_private.ai_runtime_queue
       set state='PROCESSED',
           processed_at=coalesce(processed_at,now()),
           lease_until=null,
           claimed_by=null,
           last_error_code=null,
           last_error_text=null,
           updated_at=now()
     where id=q.id;

    insert into portal_private.ai_model_executor_runs(
      queue_id,target_role,worker_id,worker_version,provider,model_id,status,action_type,
      response_id,request_hash,output_hash,usage,metadata,finished_at
    )
    values(
      q.id,q.target_role,p_worker_id,c.worker_version,c.provider,p_model,
      'NO_ACTION','NO_ACTION',p_response_id,p_request_hash,p_output_hash,
      coalesce(p_usage,'{}'::jsonb),
      jsonb_build_object('reason',left(coalesce(p_action->>'reason','NO_ACTION'),1000),'system_admin_safe_mode',true),
      now()
    );

    return jsonb_build_object('ok',true,'queue_id',q.id,'action','NO_ACTION','state','PROCESSED');
  end if;

  if action_name not in ('FUNCTIONAL_CONCLUSION','HANDOFF_REQUEST') then
    raise exception 'SYSTEM_ADMIN_AUTONOMOUS_ACTION_UNSUPPORTED';
  end if;

  if q.source_type='STAFF_TASK' then
    expected_type:='TASK';
    expected_id:=q.source_id;
  elsif q.source_type in ('HEARTBEAT','SYSTEM_CHECK') then
    expected_type:='SYSTEM';
    expected_id:='MCP';
  else
    expected_type:=upper(coalesce(
      q.payload->>'target_type',
      q.payload->'payload'->>'entity_type',
      q.payload->'payload'->>'target_entity_type',
      ''
    ));
    expected_id:=nullif(btrim(coalesce(
      q.payload->>'target_id',
      q.payload->'payload'->>'entity_id',
      q.payload->'payload'->>'target_entity_id',
      ''
    )),'');
  end if;

  entity_type:=upper(coalesce(p_action->>'entity_type',''));
  entity_id:=nullif(btrim(coalesce(p_action->>'entity_id','')),'');

  if expected_type='' or expected_id is null
     or entity_type<>expected_type
     or entity_id<>expected_id then
    raise exception 'AI_EXECUTOR_ENTITY_BINDING_MISMATCH';
  end if;

  if not portal_private.ai_executor_role_scope(q.target_role,entity_type) then
    raise exception 'AI_EXECUTOR_ROLE_SCOPE_DENIED';
  end if;
  if not portal_private.ai_executor_entity_exists(entity_type,entity_id) then
    raise exception 'AI_EXECUTOR_ENTITY_NOT_FOUND';
  end if;

  source_refs:=coalesce(q.payload->'source_refs','[]'::jsonb);
  if jsonb_typeof(source_refs)<>'array' then source_refs:='[]'::jsonb; end if;
  source_refs:=source_refs||jsonb_build_array(
    'AI_EXECUTOR_QUEUE:'||q.id::text,
    q.source_type||':'||q.source_id
  );

  if action_name='FUNCTIONAL_CONCLUSION' then
    status_text:=upper(coalesce(p_action->>'status',''));
    if status_text not in ('APPROVED','APPROVED_WITH_CONDITIONS','HOLD','REJECTED') then
      raise exception 'AI_EXECUTOR_CONCLUSION_STATUS_INVALID';
    end if;
    if btrim(coalesce(nullif(p_action->>'summary',''),p_action->>'reason',''))='' then
      raise exception 'AI_EXECUTOR_CONCLUSION_TEXT_REQUIRED';
    end if;

    record_type:='FUNCTIONAL_CONCLUSION';
    out_target:='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum;
    payload_body:=jsonb_build_object(
      'entity_type',entity_type,
      'entity_id',entity_id,
      'status',status_text,
      'summary',left(coalesce(nullif(btrim(p_action->>'summary'),''),p_action->>'reason'),4000),
      'confirmed',coalesce((p_action->>'confirmed')::boolean,false),
      'open_issues',coalesce(p_action->'open_issues','[]'::jsonb),
      'risks',coalesce(p_action->'risks','[]'::jsonb),
      'mandatory_conditions',coalesce(p_action->'mandatory_conditions','[]'::jsonb),
      'recommendation',left(coalesce(nullif(btrim(p_action->>'recommendation'),''),p_action->>'reason'),4000),
      'source_refs',source_refs,
      'system_admin_safe_mode',true
    );
  else
    if coalesce(p_action->>'target_role','') not in (
      'OPERATIONS_DIRECTOR','FINANCE','LEGAL','COMMERCIAL_DIRECTOR','RAIL_LOGISTICS'
    ) then
      raise exception 'SYSTEM_ADMIN_HANDOFF_TARGET_INVALID';
    end if;

    out_target:=portal_private.ai_runtime_canonical_role(
      (p_action->>'target_role')::portal_private.ai_business_role_enum
    );

    if not portal_private.ai_executor_role_scope(out_target,entity_type) then
      raise exception 'AI_EXECUTOR_HANDOFF_TARGET_SCOPE_DENIED';
    end if;
    if btrim(coalesce(p_action->>'subject',''))=''
       or btrim(coalesce(p_action->>'requested_check',''))=''
       or btrim(coalesce(p_action->>'reason',''))='' then
      raise exception 'AI_EXECUTOR_HANDOFF_TEXT_REQUIRED';
    end if;
    if upper(coalesce(p_action->>'priority','')) not in ('LOW','NORMAL','HIGH','CRITICAL') then
      raise exception 'AI_EXECUTOR_PRIORITY_INVALID';
    end if;

    record_type:='HANDOFF_REQUEST';
    status_text:='REQUESTED';
    payload_body:=jsonb_build_object(
      'target_role',out_target::text,
      'entity_type',entity_type,
      'entity_id',entity_id,
      'subject',left(p_action->>'subject',1000),
      'requested_check',left(p_action->>'requested_check',4000),
      'reason',left(p_action->>'reason',4000),
      'priority',upper(p_action->>'priority'),
      'source_refs',source_refs,
      'system_admin_safe_mode',true
    );
  end if;

  idem_hash:=encode(
    extensions.digest(convert_to('AI_EXECUTOR_SYSTEM|'||q.id::text||'|'||action_name,'UTF8'),'sha256'),
    'hex'
  );
  body_hash:=encode(
    extensions.digest(convert_to(payload_body::text,'UTF8'),'sha256'),
    'hex'
  );

  select record_id into rec_id
  from portal_private.ai_coordination_records
  where identity_id=ident.identity_id
    and tool_name='ai_model_executor_system_'||lower(action_name)
    and idempotency_key_hash=idem_hash
  limit 1;

  if rec_id is null then
    insert into portal_private.ai_coordination_records(
      record_type,functional_role,identity_id,token_id,client_id,server_slug,tool_name,
      target_type,target_id,target_role,parent_record_id,version,supersedes_id,
      idempotency_key_hash,payload_hash,source_refs,evidence_refs,payload,status,
      correlation_id,mcp_request_id,qa_only
    )
    values(
      record_type,'SYSTEM_ADMIN'::portal_private.ai_business_role_enum,ident.identity_id,
      null,'SERVER_AI_EXECUTOR','rona-ai-model-executor',
      'ai_model_executor_system_'||lower(action_name),
      entity_type,entity_id,out_target,
      case when q.source_type='COORDINATION' then q.source_record_id else null end,
      1,null,idem_hash,body_hash,source_refs,'[]'::jsonb,payload_body,status_text,
      q.correlation_id,gen_random_uuid(),false
    )
    returning record_id into rec_id;
  end if;

  update portal_private.ai_runtime_queue
     set state='PROCESSED',
         processed_at=coalesce(processed_at,now()),
         lease_until=null,
         claimed_by=null,
         last_error_code=null,
         last_error_text=null,
         updated_at=now()
   where id=q.id;

  insert into portal_private.ai_model_executor_runs(
    queue_id,target_role,worker_id,worker_version,provider,model_id,status,action_type,
    response_id,request_hash,output_hash,usage,metadata,finished_at
  )
  values(
    q.id,q.target_role,p_worker_id,c.worker_version,c.provider,p_model,
    'ACTION_COMMITTED',action_name,p_response_id,p_request_hash,p_output_hash,
    coalesce(p_usage,'{}'::jsonb),
    jsonb_build_object(
      'coordination_record_id',rec_id,
      'source_type',q.source_type,
      'source_id',q.source_id,
      'system_admin_safe_mode',true,
      'autonomous_system_write',false
    ),
    now()
  );

  return jsonb_build_object(
    'ok',true,
    'queue_id',q.id,
    'action',action_name,
    'state','PROCESSED',
    'coordination_record_id',rec_id,
    'system_admin_safe_mode',true,
    'autonomous_system_write',false
  );
end
$function$;

revoke all on function public.rona_ai_executor_commit_system_action_v1(uuid,text,jsonb,text,text,text,text,jsonb)
from public,anon,authenticated;
grant execute on function public.rona_ai_executor_commit_system_action_v1(uuid,text,jsonb,text,text,text,text,jsonb)
to service_role;

create or replace function portal_private.run_core_runtime_minute_v6()
returns jsonb
language plpgsql
set search_path='pg_catalog','portal_private'
as $function$
declare
  v_result jsonb:='{}'::jsonb;
  v_errors jsonb:='[]'::jsonb;
  v_error_count integer:=0;
begin
  begin
    v_result:=portal_private.run_core_runtime_minute_v5();
  exception when others then
    v_error_count:=v_error_count+1;
    v_errors:=v_errors||jsonb_build_array(jsonb_build_object(
      'step','core_v5','error',left(sqlerrm,500)
    ));
    v_result:=jsonb_build_object('ok',false);
  end;

  begin
    if exists(
      select 1
      from portal_private.ai_runtime_queue q
      cross join portal_private.ai_model_executor_control c
      cross join portal_private.ai_runtime_control r
      where c.singleton=true
        and r.singleton=true
        and c.enabled=true
        and c.state='ENABLED'
        and r.enabled=true
        and r.scheduler_state='ENABLED'
        and r.model_execution_state='ENABLED'
        and q.state='DELIVERED'
        and q.qa_only=false
        and q.target_role::text='SYSTEM_ADMIN'
        and q.created_at>=c.execute_after
        and q.available_at<=now()
        and q.attempts<c.max_attempts
        and (q.lease_until is null or q.lease_until<now())
      limit 1
    ) then
      v_result:=v_result||jsonb_build_object(
        'system_admin_executor_request_id',portal_private.invoke_ai_model_executor('run'),
        'system_admin_executor_skipped',false
      );
    else
      v_result:=v_result||jsonb_build_object(
        'system_admin_executor_request_id',null,
        'system_admin_executor_skipped',true,
        'system_admin_executor_skip_reason','NO_ELIGIBLE_SYSTEM_ADMIN_WORK'
      );
    end if;
  exception when others then
    v_error_count:=v_error_count+1;
    v_errors:=v_errors||jsonb_build_array(jsonb_build_object(
      'step','system_admin_model_executor','error',left(sqlerrm,500)
    ));
  end;

  return v_result||jsonb_build_object(
    'v6_wrapper_ok',v_error_count=0,
    'v6_wrapper_error_count',v_error_count,
    'v6_wrapper_errors',v_errors,
    'worker_wrapper_version','CORE_RUNTIME_MINUTE_V6'
  );
end
$function$;

do $do$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='rona-core-runtime-minute-v1'
  limit 1;

  if v_jobid is null then
    raise exception 'RONA_CORE_RUNTIME_CRON_NOT_FOUND';
  end if;

  perform cron.alter_job(
    v_jobid,
    schedule=>'* * * * *',
    command=>'select portal_private.run_core_runtime_minute_v6();',
    active=>true
  );
end
$do$;
