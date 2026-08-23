-- RONA Trade AI Staff Communication Runtime V1.3
-- Fail-closed server-side model executor foundation.
-- This migration does NOT enable autonomous model execution by itself.

create table if not exists portal_private.ai_model_executor_control (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  state text not null default 'FOUNDATION_BLOCKED' check (state in ('FOUNDATION_BLOCKED','PROBE_OK','ENABLED','BLOCKED','ERROR')),
  provider text not null default 'OPENAI' check (provider in ('OPENAI')),
  model_id text not null default 'gpt-5.6-terra',
  protocol_version text not null default 'AI_STAFF_COMMUNICATION_PROTOCOL_V1_3',
  worker_version text not null default '1.3.0',
  max_items_per_run integer not null default 1 check (max_items_per_run between 1 and 5),
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  lease_seconds integer not null default 90 check (lease_seconds between 30 and 300),
  max_output_tokens integer not null default 1600 check (max_output_tokens between 256 and 4096),
  execute_after timestamptz not null default now(),
  last_probe_at timestamptz,
  last_probe_model text,
  last_error_code text,
  last_error_at timestamptz,
  activated_at timestamptz,
  updated_at timestamptz not null default now()
);

revoke all on table portal_private.ai_model_executor_control from public, anon, authenticated;

insert into portal_private.ai_model_executor_control(singleton)
values(true)
on conflict(singleton) do nothing;

create table if not exists portal_private.ai_model_executor_runs (
  run_id uuid primary key default gen_random_uuid(),
  queue_id uuid references portal_private.ai_runtime_queue(id) on delete set null,
  target_role portal_private.ai_business_role_enum,
  worker_id text,
  worker_version text not null default '1.3.0',
  provider text not null default 'OPENAI',
  model_id text,
  status text not null check (status in ('CLAIMED','MODEL_COMPLETED','ACTION_COMMITTED','NO_ACTION','RETRY','BLOCKED','DEAD_LETTER','ERROR','PROBE')),
  action_type text,
  response_id text,
  request_hash text,
  output_hash text,
  error_code text,
  usage jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_ai_model_executor_runs_queue on portal_private.ai_model_executor_runs(queue_id,started_at desc);
create index if not exists idx_ai_model_executor_runs_status on portal_private.ai_model_executor_runs(status,started_at desc);
revoke all on table portal_private.ai_model_executor_runs from public, anon, authenticated;

create or replace function portal_private.reject_ai_model_executor_run_mutation()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,portal_private
as $$
begin
  raise exception 'AI_MODEL_EXECUTOR_RUNS_APPEND_ONLY';
end $$;

revoke all on function portal_private.reject_ai_model_executor_run_mutation() from public, anon, authenticated;

drop trigger if exists trg_ai_model_executor_runs_append_only on portal_private.ai_model_executor_runs;
create trigger trg_ai_model_executor_runs_append_only
before update or delete on portal_private.ai_model_executor_runs
for each row execute function portal_private.reject_ai_model_executor_run_mutation();

-- One random scheduler/authentication key is held only in Supabase Vault.
do $$
begin
  if not exists(select 1 from vault.secrets where name='rona_ai_model_executor_key_v1') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32),'hex'),
      'rona_ai_model_executor_key_v1',
      'Internal scheduler authentication for rona-ai-model-executor',
      null
    );
  end if;
end $$;

create or replace function portal_private.ai_executor_role_scope(p_role portal_private.ai_business_role_enum, p_type text)
returns boolean
language sql
immutable
as $$
  select case p_role::text
    when 'OPERATIONS_DIRECTOR' then upper(p_type)=any(array['CLIENT','CONTRACT','APPLICATION','DEAL','DOCUMENT','PAYMENT','SHIPMENT','RAIL_DOCUMENT','PUBLICATION','TASK','SYSTEM'])
    when 'FINANCE' then upper(p_type)=any(array['CONTRACT','APPLICATION','DEAL','PAYMENT','TASK'])
    when 'LEGAL' then upper(p_type)=any(array['CONTRACT','DEAL','DOCUMENT','TASK'])
    when 'MARKET_ANALYST' then upper(p_type)=any(array['DEAL','PUBLICATION','TASK'])
    when 'RAIL_LOGISTICS' then upper(p_type)=any(array['DEAL','SHIPMENT','RAIL_DOCUMENT','TASK'])
    else false
  end
$$;

revoke all on function portal_private.ai_executor_role_scope(portal_private.ai_business_role_enum,text) from public, anon, authenticated;

create or replace function portal_private.ai_executor_entity_exists(p_type text, p_id text)
returns boolean
language plpgsql
stable
security definer
set search_path=pg_catalog,portal_private
as $$
declare v boolean:=false;
begin
  case upper(p_type)
    when 'CLIENT' then select exists(select 1 from portal_private.clients where client_id=p_id) into v;
    when 'CONTRACT' then select exists(select 1 from portal_private.contracts where contract_id=p_id) into v;
    when 'APPLICATION' then select exists(select 1 from portal_private.client_applications where application_id=p_id) into v;
    when 'DEAL' then select exists(select 1 from portal_private.deals where deal_id=p_id) into v;
    when 'DOCUMENT' then select exists(select 1 from portal_private.documents where document_id=p_id) into v;
    when 'PAYMENT' then select exists(select 1 from portal_private.payments where payment_id=p_id) into v;
    when 'SHIPMENT' then select exists(select 1 from portal_private.shipments where shipment_id=p_id) into v;
    when 'RAIL_DOCUMENT' then select exists(select 1 from portal_private.rail_documents where rail_document_id=p_id) into v;
    when 'PUBLICATION' then select exists(select 1 from portal_private.publications where publication_id=p_id) into v;
    when 'TASK' then select exists(select 1 from portal_private.staff_tasks where task_id=p_id and qa_only=false) into v;
    when 'SYSTEM' then v:=p_id=any(array['MCP','PORTAL','SECURITY','AUTH','INFRASTRUCTURE']);
    else v:=false;
  end case;
  return v;
end $$;

revoke all on function portal_private.ai_executor_entity_exists(text,text) from public, anon, authenticated;

create or replace function public.rona_ai_executor_authorize(p_token text)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,portal_private,vault,public
as $$
  select exists(
    select 1 from vault.decrypted_secrets
    where name='rona_ai_model_executor_key_v1'
      and p_token is not null
      and length(p_token)>=32
      and extensions.digest(convert_to(p_token,'UTF8'),'sha256')=extensions.digest(convert_to(decrypted_secret,'UTF8'),'sha256')
  )
$$;

revoke all on function public.rona_ai_executor_authorize(text) from public, anon, authenticated;
grant execute on function public.rona_ai_executor_authorize(text) to service_role;

create or replace function public.rona_ai_executor_health()
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,portal_private,public
as $$
  select jsonb_build_object(
    'enabled',c.enabled,
    'state',c.state,
    'provider',c.provider,
    'model_id',c.model_id,
    'protocol_version',c.protocol_version,
    'worker_version',c.worker_version,
    'max_items_per_run',c.max_items_per_run,
    'max_attempts',c.max_attempts,
    'lease_seconds',c.lease_seconds,
    'max_output_tokens',c.max_output_tokens,
    'execute_after',c.execute_after,
    'last_probe_at',c.last_probe_at,
    'last_probe_model',c.last_probe_model,
    'last_error_code',c.last_error_code,
    'runtime_enabled',r.enabled,
    'scheduler_state',r.scheduler_state,
    'runtime_model_execution_state',r.model_execution_state,
    'runtime_protocol_version',r.protocol_version,
    'eligible_delivered_count',(
      select count(*) from portal_private.ai_runtime_queue q
      where q.state='DELIVERED' and q.qa_only=false and q.target_role::text<>'SYSTEM_ADMIN'
        and q.created_at>=c.execute_after
        and (q.lease_until is null or q.lease_until<now())
    )
  )
  from portal_private.ai_model_executor_control c
  cross join portal_private.ai_runtime_control r
  where c.singleton=true and r.singleton=true
$$;

revoke all on function public.rona_ai_executor_health() from public, anon, authenticated;
grant execute on function public.rona_ai_executor_health() to service_role;

create or replace function public.rona_ai_executor_record_probe(p_ok boolean,p_model text,p_error_code text default null)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,portal_private,public
as $$
declare c portal_private.ai_model_executor_control%rowtype;
begin
  update portal_private.ai_model_executor_control
     set state=case when p_ok then 'PROBE_OK' else 'BLOCKED' end,
         last_probe_at=now(),last_probe_model=left(p_model,160),
         last_error_code=case when p_ok then null else left(coalesce(p_error_code,'MODEL_PROBE_FAILED'),160) end,
         last_error_at=case when p_ok then null else now() end,
         updated_at=now()
   where singleton=true
   returning * into c;
  insert into portal_private.ai_model_executor_runs(status,provider,model_id,error_code,metadata,finished_at)
  values('PROBE',c.provider,c.model_id,case when p_ok then null else c.last_error_code end,jsonb_build_object('probe_ok',p_ok),now());
  return jsonb_build_object('ok',p_ok,'state',c.state,'model_id',c.model_id,'last_probe_at',c.last_probe_at);
end $$;

revoke all on function public.rona_ai_executor_record_probe(boolean,text,text) from public, anon, authenticated;
grant execute on function public.rona_ai_executor_record_probe(boolean,text,text) to service_role;

create or replace function public.rona_ai_executor_arm(p_model text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,portal_private,public
as $$
declare c portal_private.ai_model_executor_control%rowtype;
begin
  select * into c from portal_private.ai_model_executor_control where singleton=true for update;
  if c.state<>'PROBE_OK' or c.last_probe_at is null or c.last_probe_at<now()-interval '10 minutes' then
    raise exception 'AI_EXECUTOR_RECENT_PROBE_REQUIRED';
  end if;
  if p_model is null or btrim(p_model)='' or p_model<>c.last_probe_model then
    raise exception 'AI_EXECUTOR_MODEL_PROBE_MISMATCH';
  end if;
  update portal_private.ai_model_executor_control
     set enabled=true,state='ENABLED',model_id=left(p_model,160),execute_after=now(),activated_at=now(),last_error_code=null,last_error_at=null,updated_at=now()
   where singleton=true
   returning * into c;
  update portal_private.ai_runtime_control
     set protocol_version='AI_STAFF_COMMUNICATION_PROTOCOL_V1_3',model_execution_state='ENABLED',worker_version='1.3.0',updated_at=now()
   where singleton=true;
  return jsonb_build_object('ok',true,'state',c.state,'model_id',c.model_id,'execute_after',c.execute_after,'protocol_version',c.protocol_version);
end $$;

revoke all on function public.rona_ai_executor_arm(text) from public, anon, authenticated;
grant execute on function public.rona_ai_executor_arm(text) to service_role;

create or replace function public.rona_ai_executor_disarm(p_reason text default 'MANUAL_BLOCK')
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,portal_private,public
as $$
begin
  update portal_private.ai_model_executor_control
     set enabled=false,state='BLOCKED',last_error_code=left(coalesce(p_reason,'MANUAL_BLOCK'),160),last_error_at=now(),updated_at=now()
   where singleton=true;
  update portal_private.ai_runtime_control
     set model_execution_state='BLOCKED',worker_version='1.3.0',updated_at=now()
   where singleton=true;
  update portal_private.ai_runtime_queue
     set lease_until=null,claimed_by=null,updated_at=now()
   where state='DELIVERED' and claimed_by like 'model-executor:%';
  return jsonb_build_object('ok',true,'state','BLOCKED','reason',left(coalesce(p_reason,'MANUAL_BLOCK'),160));
end $$;

revoke all on function public.rona_ai_executor_disarm(text) from public, anon, authenticated;
grant execute on function public.rona_ai_executor_disarm(text) to service_role;

create or replace function public.rona_ai_executor_claim(p_worker_id text,p_limit integer default 1)
returns table(
  queue_id uuid,source_type text,source_id text,source_record_id uuid,target_role text,priority text,
  correlation_id uuid,payload jsonb,attempts integer,max_attempts integer,lease_seconds integer,model_id text,max_output_tokens integer
)
language plpgsql
security definer
set search_path=pg_catalog,portal_private,public
as $$
declare c portal_private.ai_model_executor_control%rowtype;
declare lim integer;
begin
  select * into c from portal_private.ai_model_executor_control where singleton=true;
  if not c.enabled or c.state<>'ENABLED' then return; end if;
  if not exists(select 1 from portal_private.ai_runtime_control r where r.singleton=true and r.enabled=true and r.scheduler_state='ENABLED' and r.model_execution_state='ENABLED') then return; end if;
  if p_worker_id is null or length(p_worker_id)<8 or length(p_worker_id)>120 then raise exception 'AI_EXECUTOR_WORKER_ID_INVALID'; end if;
  lim:=greatest(1,least(coalesce(p_limit,1),c.max_items_per_run,5));
  return query
  with picked as (
    select q.id
      from portal_private.ai_runtime_queue q
     where q.state='DELIVERED'
       and q.qa_only=false
       and q.target_role::text<>'SYSTEM_ADMIN'
       and q.created_at>=c.execute_after
       and q.available_at<=now()
       and q.attempts<c.max_attempts
       and (q.lease_until is null or q.lease_until<now())
     order by case q.priority when 'CRITICAL' then 1 when 'HIGH' then 2 when 'NORMAL' then 3 else 4 end,
              q.deadline_at nulls last,q.created_at
     for update skip locked
     limit lim
  ), claimed as (
    update portal_private.ai_runtime_queue q
       set lease_until=now()+make_interval(secs=>c.lease_seconds),
           claimed_by='model-executor:'||p_worker_id,
           attempts=q.attempts+1,
           updated_at=now()
      from picked p
     where q.id=p.id
     returning q.*
  )
  select q.id,q.source_type,q.source_id,q.source_record_id,q.target_role::text,q.priority,q.correlation_id,q.payload,q.attempts,c.max_attempts,c.lease_seconds,c.model_id,c.max_output_tokens
    from claimed q;
end $$;

revoke all on function public.rona_ai_executor_claim(text,integer) from public, anon, authenticated;
grant execute on function public.rona_ai_executor_claim(text,integer) to service_role;

create or replace function public.rona_ai_executor_issue_read_token(p_queue_id uuid,p_worker_id text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,portal_private,vault,public
as $$
declare q record; ident record; secret text; hdr text; pay text; unsigned text; sig text; j uuid:=gen_random_uuid(); n bigint:=extract(epoch from now())::bigint;
declare b64h text; b64p text;
begin
  select id,target_role::text target_role,claimed_by,lease_until into q
    from portal_private.ai_runtime_queue
   where id=p_queue_id and state='DELIVERED' and qa_only=false
     and claimed_by='model-executor:'||p_worker_id and lease_until>now() and target_role::text<>'SYSTEM_ADMIN';
  if not found then raise exception 'AI_EXECUTOR_QUEUE_LEASE_INVALID'; end if;
  select identity_id,business_role::text business_role,status::text status,credential_version,revoked_at,not_before,token_ttl_seconds
    into ident from portal_private.ai_service_identities
   where business_role=q.target_role::portal_private.ai_business_role_enum limit 1;
  if not found or ident.status<>'ACTIVE' or ident.revoked_at is not null or (ident.not_before is not null and ident.not_before>now()) then
    raise exception 'AI_EXECUTOR_ROLE_IDENTITY_UNAVAILABLE';
  end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name='rona_ai_token_signing_key_v1' limit 1;
  if secret is null or length(secret)<32 then raise exception 'AI_SIGNING_KEY_UNAVAILABLE'; end if;
  hdr:='{"alg":"HS256","typ":"JWT","kid":"rona-ai-v1"}';
  pay:=jsonb_build_object('iss','rona-ai-identity-broker','aud','rona-ai-read-only','sub',ident.identity_id,'role',ident.business_role,'ver',ident.credential_version,'iat',n,'nbf',n,'exp',n+least(greatest(coalesce(ident.token_ttl_seconds,300),60),300),'jti',j::text,'actor_type','AI','scope','READ_ONLY')::text;
  b64h:=translate(replace(encode(convert_to(hdr,'UTF8'),'base64'),E'\n',''),'+/','-_'); b64h:=rtrim(b64h,'=');
  b64p:=translate(replace(encode(convert_to(pay,'UTF8'),'base64'),E'\n',''),'+/','-_'); b64p:=rtrim(b64p,'=');
  unsigned:=b64h||'.'||b64p;
  sig:=translate(replace(encode(extensions.hmac(convert_to(unsigned,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'base64'),E'\n',''),'+/','-_'); sig:=rtrim(sig,'=');
  return jsonb_build_object('access_token',unsigned||'.'||sig,'token_type','Bearer','expires_in',least(greatest(coalesce(ident.token_ttl_seconds,300),60),300),'functional_role',ident.business_role,'ai_identity_id',ident.identity_id,'jti',j);
end $$;

revoke all on function public.rona_ai_executor_issue_read_token(uuid,text) from public, anon, authenticated;
grant execute on function public.rona_ai_executor_issue_read_token(uuid,text) to service_role;

create or replace function public.rona_ai_executor_fail(
  p_queue_id uuid,p_worker_id text,p_error_code text,p_error_text text default null,p_retryable boolean default true,
  p_response_id text default null,p_model text default null,p_request_hash text default null,p_output_hash text default null,p_usage jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,portal_private,public
as $$
declare q record; c portal_private.ai_model_executor_control%rowtype; next_state text;
begin
  select * into c from portal_private.ai_model_executor_control where singleton=true;
  select * into q from portal_private.ai_runtime_queue where id=p_queue_id for update;
  if not found or q.claimed_by<>'model-executor:'||p_worker_id then raise exception 'AI_EXECUTOR_QUEUE_LEASE_INVALID'; end if;
  next_state:=case when p_retryable and q.attempts<c.max_attempts then 'DELIVERED' else 'DEAD_LETTER' end;
  update portal_private.ai_runtime_queue
     set state=next_state,available_at=case when next_state='DELIVERED' then now()+make_interval(secs=>least(60,greatest(5,q.attempts*10))) else available_at end,
         lease_until=null,claimed_by=null,last_error_code=left(coalesce(p_error_code,'AI_EXECUTOR_ERROR'),160),last_error_text=left(p_error_text,1000),updated_at=now()
   where id=p_queue_id;
  insert into portal_private.ai_model_executor_runs(queue_id,target_role,worker_id,worker_version,provider,model_id,status,response_id,request_hash,output_hash,error_code,usage,metadata,finished_at)
  values(q.id,q.target_role,p_worker_id,c.worker_version,c.provider,coalesce(p_model,c.model_id),case when next_state='DELIVERED' then 'RETRY' else 'DEAD_LETTER' end,p_response_id,p_request_hash,p_output_hash,left(coalesce(p_error_code,'AI_EXECUTOR_ERROR'),160),coalesce(p_usage,'{}'::jsonb),jsonb_build_object('attempts',q.attempts,'next_state',next_state),now());
  return jsonb_build_object('ok',false,'queue_id',q.id,'next_state',next_state,'attempts',q.attempts,'error_code',left(coalesce(p_error_code,'AI_EXECUTOR_ERROR'),160));
end $$;

revoke all on function public.rona_ai_executor_fail(uuid,text,text,text,boolean,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.rona_ai_executor_fail(uuid,text,text,text,boolean,text,text,text,text,jsonb) to service_role;

create or replace function public.rona_ai_executor_commit_action(
  p_queue_id uuid,p_worker_id text,p_action jsonb,p_response_id text,p_model text,p_request_hash text,p_output_hash text,p_usage jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,portal_private,public
as $$
declare q record; c portal_private.ai_model_executor_control%rowtype; ident record; action text; typ text; eid text; target portal_private.ai_business_role_enum;
declare rec_id uuid; rec_version integer:=1; supersedes uuid; parent_id uuid; status_text text; payload_body jsonb; idem_hash text; payload_hash text; src jsonb; ev jsonb;
declare parent record; assigned text; decision_action text;
begin
  select * into c from portal_private.ai_model_executor_control where singleton=true;
  if not c.enabled or c.state<>'ENABLED' then raise exception 'AI_EXECUTOR_NOT_ENABLED'; end if;
  select * into q from portal_private.ai_runtime_queue where id=p_queue_id for update;
  if not found or q.state<>'DELIVERED' or q.qa_only or q.target_role::text='SYSTEM_ADMIN' or q.claimed_by<>'model-executor:'||p_worker_id or q.lease_until<=now() then
    raise exception 'AI_EXECUTOR_QUEUE_LEASE_INVALID';
  end if;
  select identity_id,business_role into ident from portal_private.ai_service_identities where business_role=q.target_role and status='ACTIVE' and revoked_at is null limit 1;
  if not found then raise exception 'AI_EXECUTOR_ROLE_IDENTITY_UNAVAILABLE'; end if;
  action:=upper(coalesce(p_action->>'action',''));
  if action not in ('NO_ACTION','FUNCTIONAL_CONCLUSION','HANDOFF_REQUEST','TASK_PROGRESS','BUSINESS_CHANGE_PROPOSAL','OPERATIONS_DECISION') then
    raise exception 'AI_EXECUTOR_ACTION_INVALID';
  end if;
  if action='NO_ACTION' then
    update portal_private.ai_runtime_queue set state='PROCESSED',processed_at=coalesce(processed_at,now()),lease_until=null,claimed_by=null,last_error_code=null,last_error_text=null,updated_at=now() where id=q.id;
    insert into portal_private.ai_model_executor_runs(queue_id,target_role,worker_id,worker_version,provider,model_id,status,action_type,response_id,request_hash,output_hash,usage,metadata,finished_at)
    values(q.id,q.target_role,p_worker_id,c.worker_version,c.provider,p_model,'NO_ACTION','NO_ACTION',p_response_id,p_request_hash,p_output_hash,coalesce(p_usage,'{}'::jsonb),jsonb_build_object('reason',left(coalesce(p_action->>'reason','NO_ACTION'),1000)),now());
    return jsonb_build_object('ok',true,'queue_id',q.id,'action','NO_ACTION','state','PROCESSED');
  end if;

  typ:=upper(coalesce(p_action->>'entity_type',''));
  eid:=nullif(btrim(coalesce(p_action->>'entity_id','')),'');
  if eid is null or not portal_private.ai_executor_role_scope(q.target_role,typ) or not portal_private.ai_executor_entity_exists(typ,eid) then
    raise exception 'AI_EXECUTOR_TARGET_OUT_OF_SCOPE';
  end if;
  parent_id:=case when q.source_type='COORDINATION' then q.source_record_id else null end;
  src:=coalesce(p_action->'source_refs','[]'::jsonb);
  if jsonb_typeof(src)<>'array' or jsonb_array_length(src)>20 then raise exception 'AI_EXECUTOR_SOURCE_REFS_INVALID'; end if;
  src:=src || jsonb_build_array('AI_EXECUTOR_QUEUE:'||q.id::text,q.source_type||':'||q.source_id);
  ev:=coalesce(p_action->'evidence_refs','[]'::jsonb);
  if jsonb_typeof(ev)<>'array' or jsonb_array_length(ev)>20 then raise exception 'AI_EXECUTOR_EVIDENCE_REFS_INVALID'; end if;

  if action='FUNCTIONAL_CONCLUSION' then
    status_text:=upper(coalesce(p_action->>'status',''));
    if status_text not in ('APPROVED','APPROVED_WITH_CONDITIONS','HOLD','REJECTED') then raise exception 'AI_EXECUTOR_CONCLUSION_STATUS_INVALID'; end if;
    if coalesce(p_action->>'summary','')='' or coalesce(p_action->>'recommendation','')='' then raise exception 'AI_EXECUTOR_CONCLUSION_TEXT_REQUIRED'; end if;
    perform pg_advisory_xact_lock(hashtextextended('CONCLUSION|'||q.target_role::text||'|'||typ||'|'||eid,0));
    select record_id,version into supersedes,rec_version from portal_private.ai_coordination_records
      where record_type='FUNCTIONAL_CONCLUSION' and functional_role=q.target_role and target_type=typ and target_id=eid order by version desc limit 1;
    rec_version:=coalesce(rec_version,0)+1;
    target:='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum;
    payload_body:=jsonb_build_object('entity_type',typ,'entity_id',eid,'status',status_text,'summary',left(p_action->>'summary',4000),'confirmed',coalesce((p_action->>'confirmed')::boolean,false),'open_issues',coalesce(p_action->'open_issues','[]'::jsonb),'risks',coalesce(p_action->'risks','[]'::jsonb),'mandatory_conditions',coalesce(p_action->'mandatory_conditions','[]'::jsonb),'recommendation',left(p_action->>'recommendation',4000),'source_refs',src);
  elsif action='HANDOFF_REQUEST' then
    if coalesce(p_action->>'target_role','') not in ('OPERATIONS_DIRECTOR','FINANCE','LEGAL','MARKET_ANALYST','RAIL_LOGISTICS','SYSTEM_ADMIN') then raise exception 'AI_EXECUTOR_HANDOFF_ROLE_INVALID'; end if;
    target:=(p_action->>'target_role')::portal_private.ai_business_role_enum;
    if target=q.target_role then raise exception 'AI_EXECUTOR_SELF_HANDOFF_DENIED'; end if;
    if target::text='SYSTEM_ADMIN' and typ not in ('SYSTEM','TASK') then raise exception 'AI_EXECUTOR_SYSTEM_ADMIN_HANDOFF_SCOPE_DENIED'; end if;
    if coalesce(p_action->>'subject','')='' or coalesce(p_action->>'requested_check','')='' or coalesce(p_action->>'reason','')='' then raise exception 'AI_EXECUTOR_HANDOFF_TEXT_REQUIRED'; end if;
    if upper(coalesce(p_action->>'priority','')) not in ('LOW','NORMAL','HIGH','CRITICAL') then raise exception 'AI_EXECUTOR_PRIORITY_INVALID'; end if;
    payload_body:=jsonb_build_object('target_role',target::text,'entity_type',typ,'entity_id',eid,'subject',left(p_action->>'subject',1000),'requested_check',left(p_action->>'requested_check',4000),'reason',left(p_action->>'reason',4000),'priority',upper(p_action->>'priority'),'source_refs',src);
    status_text:='REQUESTED';
  elsif action='TASK_PROGRESS' then
    if typ<>'TASK' or eid<>coalesce(p_action->>'task_id',eid) then raise exception 'AI_EXECUTOR_TASK_MISMATCH'; end if;
    select assigned_functional_role::text into assigned from portal_private.staff_tasks where task_id=eid and qa_only=false and status not in ('COMPLETED','REJECTED','CLOSED') limit 1;
    if not found then raise exception 'AI_EXECUTOR_TASK_NOT_ACTIVE'; end if;
    if assigned<>case q.target_role::text when 'OPERATIONS_DIRECTOR' then 'EXECUTIVE_DIRECTOR' else q.target_role::text end then raise exception 'AI_EXECUTOR_TASK_ROLE_DENIED'; end if;
    status_text:=upper(coalesce(p_action->>'progress_status',''));
    if status_text not in ('ACKNOWLEDGED','IN_PROGRESS','BLOCKED','READY_FOR_REVIEW') or coalesce(p_action->>'note','')='' then raise exception 'AI_EXECUTOR_TASK_PROGRESS_INVALID'; end if;
    target:=q.target_role;
    payload_body:=jsonb_build_object('task_id',eid,'progress_status',status_text,'note',left(p_action->>'note',4000),'evidence_refs',ev);
  elsif action='BUSINESS_CHANGE_PROPOSAL' then
    if coalesce(p_action->>'reason','')='' or coalesce(p_action->>'risk_note','')='' then raise exception 'AI_EXECUTOR_PROPOSAL_TEXT_REQUIRED'; end if;
    if nullif(btrim(coalesce(p_action->>'proposed_field','')),'') is null and nullif(btrim(coalesce(p_action->>'proposed_action','')),'') is null then raise exception 'AI_EXECUTOR_PROPOSAL_CHANGE_REQUIRED'; end if;
    target:='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum;
    status_text:='PROPOSED';
    payload_body:=jsonb_build_object('target_entity_type',typ,'target_entity_id',eid,'proposed_field',nullif(left(p_action->>'proposed_field',160),''),'proposed_action',nullif(left(p_action->>'proposed_action',160),''),'proposed_value',p_action->'proposed_value','proposed_state',p_action->'proposed_state','reason',left(p_action->>'reason',4000),'evidence_refs',ev,'risk_note',left(p_action->>'risk_note',4000));
  else
    if q.target_role::text<>'OPERATIONS_DIRECTOR' then raise exception 'AI_EXECUTOR_OPERATIONS_DECISION_ROLE_REQUIRED'; end if;
    if parent_id is null then parent_id=nullif(p_action->>'parent_record_id','')::uuid; end if;
    if parent_id is null then raise exception 'AI_EXECUTOR_DECISION_PARENT_REQUIRED'; end if;
    select record_id,record_type,functional_role,target_type,target_id into parent from portal_private.ai_coordination_records where record_id=parent_id and record_type in ('FUNCTIONAL_CONCLUSION','HANDOFF_REQUEST','BUSINESS_CHANGE_PROPOSAL') and qa_only=false limit 1;
    if not found or parent.target_type='SYSTEM' then raise exception 'AI_EXECUTOR_DECISION_PARENT_INVALID'; end if;
    decision_action:=upper(coalesce(p_action->>'decision_action',''));
    if decision_action not in ('APPROVE_FOR_NEXT_STAGE','RETURN_FOR_REVISION','REJECT') or coalesce(p_action->>'note','')='' then raise exception 'AI_EXECUTOR_DECISION_INVALID'; end if;
    typ:=parent.target_type; eid:=parent.target_id; target:=parent.functional_role; status_text:=decision_action;
    perform pg_advisory_xact_lock(hashtextextended('DECISION|'||parent_id::text,0));
    select coalesce(max(version),0)+1 into rec_version from portal_private.ai_coordination_records where record_type='OPERATIONS_INTERNAL_DECISION' and parent_record_id=parent_id;
    payload_body:=jsonb_build_object('record_id',parent_id,'action',decision_action,'note',left(p_action->>'note',4000));
  end if;

  idem_hash:=encode(extensions.digest(convert_to('AI_EXECUTOR|'||q.id::text||'|'||action,'UTF8'),'sha256'),'hex');
  payload_hash:=encode(extensions.digest(convert_to(payload_body::text,'UTF8'),'sha256'),'hex');
  select record_id into rec_id from portal_private.ai_coordination_records where identity_id=ident.identity_id and tool_name='ai_model_executor_'||lower(action) and idempotency_key_hash=idem_hash limit 1;
  if rec_id is null then
    insert into portal_private.ai_coordination_records(
      record_type,functional_role,identity_id,token_id,client_id,server_slug,tool_name,target_type,target_id,target_role,parent_record_id,version,supersedes_id,idempotency_key_hash,payload_hash,source_refs,evidence_refs,payload,status,correlation_id,mcp_request_id,qa_only
    ) values(
      case action when 'FUNCTIONAL_CONCLUSION' then 'FUNCTIONAL_CONCLUSION' when 'HANDOFF_REQUEST' then 'HANDOFF_REQUEST' when 'TASK_PROGRESS' then 'TASK_PROGRESS' when 'BUSINESS_CHANGE_PROPOSAL' then 'BUSINESS_CHANGE_PROPOSAL' else 'OPERATIONS_INTERNAL_DECISION' end,
      q.target_role,ident.identity_id,null,'SERVER_AI_EXECUTOR','rona-ai-model-executor','ai_model_executor_'||lower(action),typ,eid,target,parent_id,rec_version,supersedes,idem_hash,payload_hash,src,ev,payload_body,status_text,q.correlation_id,gen_random_uuid(),false
    ) returning record_id into rec_id;
  end if;

  update portal_private.ai_runtime_queue set state='PROCESSED',processed_at=coalesce(processed_at,now()),lease_until=null,claimed_by=null,last_error_code=null,last_error_text=null,updated_at=now() where id=q.id;
  insert into portal_private.ai_model_executor_runs(queue_id,target_role,worker_id,worker_version,provider,model_id,status,action_type,response_id,request_hash,output_hash,usage,metadata,finished_at)
  values(q.id,q.target_role,p_worker_id,c.worker_version,c.provider,p_model,'ACTION_COMMITTED',action,p_response_id,p_request_hash,p_output_hash,coalesce(p_usage,'{}'::jsonb),jsonb_build_object('coordination_record_id',rec_id,'source_type',q.source_type,'source_id',q.source_id),now());
  insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
  values(q.id,q.target_role,c.worker_version,'MODEL_EXECUTOR','PROCESSED','MODEL_ACTION_COMMITTED',jsonb_build_array(q.source_type||':'||q.source_id),jsonb_build_object('action',action,'coordination_record_id',rec_id,'response_id',p_response_id),now());
  return jsonb_build_object('ok',true,'queue_id',q.id,'action',action,'state','PROCESSED','coordination_record_id',rec_id);
end $$;

revoke all on function public.rona_ai_executor_commit_action(uuid,text,jsonb,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.rona_ai_executor_commit_action(uuid,text,jsonb,text,text,text,text,jsonb) to service_role;

-- Internal scheduler helper. The secret never leaves the database except as an HTTPS request header to this project's Edge endpoint.
create or replace function portal_private.invoke_ai_model_executor(p_path text default 'run')
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,portal_private,vault,net
as $$
declare secret text; endpoint text; req bigint;
begin
  if p_path not in ('run','probe') then raise exception 'AI_EXECUTOR_PATH_INVALID'; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name='rona_ai_model_executor_key_v1' limit 1;
  if secret is null then raise exception 'AI_EXECUTOR_SCHEDULER_SECRET_MISSING'; end if;
  endpoint:='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-ai-model-executor/'||p_path;
  select net.http_post(
    url:=endpoint,
    headers:=jsonb_build_object('content-type','application/json','x-rona-ai-executor-key',secret),
    body:=jsonb_build_object('source','PG_CRON','requested_at',now())
  ) into req;
  return req;
end $$;

revoke all on function portal_private.invoke_ai_model_executor(text) from public, anon, authenticated;

-- Install the backend scheduler. It is safe while executor control.enabled=false: /run returns without claiming any queue item.
do $$
declare j bigint;
begin
  select jobid into j from cron.job where jobname='rona-ai-model-executor';
  if j is not null then perform cron.unschedule(j); end if;
  perform cron.schedule('rona-ai-model-executor','* * * * *',$cron$select portal_private.invoke_ai_model_executor('run');$cron$);
end $$;

-- Foundation is deliberately fail-closed until a real provider probe succeeds and arm() is called.
update portal_private.ai_runtime_control
   set model_execution_state='BLOCKED',updated_at=now()
 where singleton=true;
