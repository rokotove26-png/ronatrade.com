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

insert into portal_private.ai_model_executor_control(singleton)
values(true)
on conflict(singleton) do nothing;

revoke all on table portal_private.ai_model_executor_control from public, anon, authenticated;

create table if not exists portal_private.ai_model_executor_runs (
  run_id uuid primary key default gen_random_uuid(),
  queue_id uuid references portal_private.ai_runtime_queue(id) on delete set null,
  target_role portal_private.ai_business_role_enum,
  worker_id text,
  worker_version text not null default '1.3.0',
  provider text not null default 'OPENAI',
  model_id text,
  status text not null check (status in ('ACTION_COMMITTED','NO_ACTION','RETRY','BLOCKED','DEAD_LETTER','ERROR','PROBE')),
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
end;
$$;
revoke all on function portal_private.reject_ai_model_executor_run_mutation() from public, anon, authenticated;

drop trigger if exists trg_ai_model_executor_runs_append_only on portal_private.ai_model_executor_runs;
create trigger trg_ai_model_executor_runs_append_only
before update or delete on portal_private.ai_model_executor_runs
for each row execute function portal_private.reject_ai_model_executor_run_mutation();

-- Internal scheduler authentication is random and held only in Supabase Vault.
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
end;
$$;

create or replace function public.rona_ai_executor_authorize(p_token text)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,portal_private,vault,public
as $$
  select exists(
    select 1
    from vault.decrypted_secrets
    where name='rona_ai_model_executor_key_v1'
      and p_token is not null
      and length(p_token)>=32
      and extensions.digest(convert_to(p_token,'UTF8'),'sha256')
          =extensions.digest(convert_to(decrypted_secret,'UTF8'),'sha256')
  );
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
      select count(*)
      from portal_private.ai_runtime_queue q
      where q.state='DELIVERED'
        and q.qa_only=false
        and q.target_role::text<>'SYSTEM_ADMIN'
        and q.created_at>=c.execute_after
        and (q.lease_until is null or q.lease_until<now())
    )
  )
  from portal_private.ai_model_executor_control c
  cross join portal_private.ai_runtime_control r
  where c.singleton=true and r.singleton=true;
$$;
revoke all on function public.rona_ai_executor_health() from public, anon, authenticated;
grant execute on function public.rona_ai_executor_health() to service_role;

create or replace function public.rona_ai_executor_record_probe(p_ok boolean,p_model text,p_error_code text default null)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,portal_private,public
as $$
declare
  c portal_private.ai_model_executor_control%rowtype;
begin
  update portal_private.ai_model_executor_control
  set state=case when p_ok then 'PROBE_OK' else 'BLOCKED' end,
      last_probe_at=now(),
      last_probe_model=left(p_model,160),
      last_error_code=case when p_ok then null else left(coalesce(p_error_code,'MODEL_PROBE_FAILED'),160) end,
      last_error_at=case when p_ok then null else now() end,
      updated_at=now()
  where singleton=true
  returning * into c;

  insert into portal_private.ai_model_executor_runs(status,provider,model_id,error_code,metadata,finished_at)
  values('PROBE',c.provider,c.model_id,case when p_ok then null else c.last_error_code end,jsonb_build_object('probe_ok',p_ok),now());

  return jsonb_build_object('ok',p_ok,'state',c.state,'model_id',c.model_id,'last_probe_at',c.last_probe_at);
end;
$$;
revoke all on function public.rona_ai_executor_record_probe(boolean,text,text) from public, anon, authenticated;
grant execute on function public.rona_ai_executor_record_probe(boolean,text,text) to service_role;

create or replace function public.rona_ai_executor_arm(p_model text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,portal_private,public
as $$
declare
  c portal_private.ai_model_executor_control%rowtype;
begin
  select * into c from portal_private.ai_model_executor_control where singleton=true for update;
  if c.state<>'PROBE_OK' or c.last_probe_at is null or c.last_probe_at<now()-interval '10 minutes' then
    raise exception 'AI_EXECUTOR_RECENT_PROBE_REQUIRED';
  end if;
  if p_model is null or btrim(p_model)='' or p_model<>c.last_probe_model then
    raise exception 'AI_EXECUTOR_MODEL_PROBE_MISMATCH';
  end if;

  update portal_private.ai_model_executor_control
  set enabled=true,
      state='ENABLED',
      model_id=left(p_model,160),
      execute_after=now(),
      activated_at=now(),
      last_error_code=null,
      last_error_at=null,
      updated_at=now()
  where singleton=true
  returning * into c;

  update portal_private.ai_runtime_control
  set protocol_version='AI_STAFF_COMMUNICATION_PROTOCOL_V1_3',
      model_execution_state='ENABLED',
      worker_version='1.3.0',
      updated_at=now()
  where singleton=true;

  return jsonb_build_object('ok',true,'state',c.state,'model_id',c.model_id,'execute_after',c.execute_after,'protocol_version',c.protocol_version);
end;
$$;
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
  set enabled=false,
      state='BLOCKED',
      last_error_code=left(coalesce(p_reason,'MANUAL_BLOCK'),160),
      last_error_at=now(),
      updated_at=now()
  where singleton=true;

  update portal_private.ai_runtime_control
  set model_execution_state='BLOCKED',worker_version='1.3.0',updated_at=now()
  where singleton=true;

  update portal_private.ai_runtime_queue
  set lease_until=null,claimed_by=null,updated_at=now()
  where state='DELIVERED' and claimed_by like 'model-executor:%';

  return jsonb_build_object('ok',true,'state','BLOCKED','reason',left(coalesce(p_reason,'MANUAL_BLOCK'),160));
end;
$$;
revoke all on function public.rona_ai_executor_disarm(text) from public, anon, authenticated;
grant execute on function public.rona_ai_executor_disarm(text) to service_role;

create or replace function public.rona_ai_executor_claim(p_worker_id text,p_limit integer default 1)
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
set search_path=pg_catalog,portal_private,public
as $$
declare
  c portal_private.ai_model_executor_control%rowtype;
  lim integer;
begin
  select * into c from portal_private.ai_model_executor_control where singleton=true;
  if not c.enabled or c.state<>'ENABLED' then
    return;
  end if;
  if not exists(
    select 1 from portal_private.ai_runtime_control r
    where r.singleton=true and r.enabled=true and r.scheduler_state='ENABLED' and r.model_execution_state='ENABLED'
  ) then
    return;
  end if;
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
      and q.target_role::text<>'SYSTEM_ADMIN'
      and q.created_at>=c.execute_after
      and q.available_at<=now()
      and q.attempts<c.max_attempts
      and (q.lease_until is null or q.lease_until<now())
    order by case q.priority when 'CRITICAL' then 1 when 'HIGH' then 2 when 'NORMAL' then 3 else 4 end,
             q.deadline_at nulls last,
             q.created_at
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
end;
$$;
revoke all on function public.rona_ai_executor_claim(text,integer) from public, anon, authenticated;
grant execute on function public.rona_ai_executor_claim(text,integer) to service_role;

create or replace function public.rona_ai_executor_issue_read_token(p_queue_id uuid,p_worker_id text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,portal_private,vault,public
as $$
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
    and lease_until>now()
    and target_role::text<>'SYSTEM_ADMIN';
  if not found then
    raise exception 'AI_EXECUTOR_QUEUE_LEASE_INVALID';
  end if;

  select identity_id,business_role::text as business_role,status::text as status,credential_version,revoked_at,not_before,token_ttl_seconds
  into ident
  from portal_private.ai_service_identities
  where business_role=q.target_role::portal_private.ai_business_role_enum
  limit 1;
  if not found or ident.status<>'ACTIVE' or ident.revoked_at is not null or (ident.not_before is not null and ident.not_before>now()) then
    raise exception 'AI_EXECUTOR_ROLE_IDENTITY_UNAVAILABLE';
  end if;

  select decrypted_secret into secret from vault.decrypted_secrets where name='rona_ai_token_signing_key_v1' limit 1;
  if secret is null or length(secret)<32 then
    raise exception 'AI_SIGNING_KEY_UNAVAILABLE';
  end if;

  hdr:='{"alg":"HS256","typ":"JWT","kid":"rona-ai-v1"}';
  pay:=jsonb_build_object(
    'iss','rona-ai-identity-broker','aud','rona-ai-read-only','sub',ident.identity_id,'role',ident.business_role,
    'ver',ident.credential_version,'iat',n,'nbf',n,'exp',n+least(greatest(coalesce(ident.token_ttl_seconds,300),60),300),
    'jti',j::text,'actor_type','AI','scope','READ_ONLY'
  )::text;
  b64h:=rtrim(translate(replace(encode(convert_to(hdr,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
  b64p:=rtrim(translate(replace(encode(convert_to(pay,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
  unsigned:=b64h||'.'||b64p;
  sig:=rtrim(translate(replace(encode(extensions.hmac(convert_to(unsigned,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'base64'),E'\n',''),'+/','-_'),'=');

  return jsonb_build_object(
    'access_token',unsigned||'.'||sig,
    'token_type','Bearer',
    'expires_in',least(greatest(coalesce(ident.token_ttl_seconds,300),60),300),
    'functional_role',ident.business_role,
    'ai_identity_id',ident.identity_id,
    'jti',j
  );
end;
$$;
revoke all on function public.rona_ai_executor_issue_read_token(uuid,text) from public, anon, authenticated;
grant execute on function public.rona_ai_executor_issue_read_token(uuid,text) to service_role;

create or replace function public.rona_ai_executor_fail(
  p_queue_id uuid,
  p_worker_id text,
  p_error_code text,
  p_error_text text default null,
  p_retryable boolean default true,
  p_response_id text default null,
  p_model text default null,
  p_request_hash text default null,
  p_output_hash text default null,
  p_usage jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,portal_private,public
as $$
declare
  q record;
  c portal_private.ai_model_executor_control%rowtype;
  next_state text;
begin
  select * into c from portal_private.ai_model_executor_control where singleton=true;
  select * into q from portal_private.ai_runtime_queue where id=p_queue_id for update;
  if not found or q.claimed_by<>'model-executor:'||p_worker_id then
    raise exception 'AI_EXECUTOR_QUEUE_LEASE_INVALID';
  end if;

  next_state:=case when p_retryable and q.attempts<c.max_attempts then 'DELIVERED' else 'DEAD_LETTER' end;
  update portal_private.ai_runtime_queue
  set state=next_state,
      available_at=case when next_state='DELIVERED' then now()+make_interval(secs=>least(60,greatest(5,q.attempts*10))) else available_at end,
      lease_until=null,
      claimed_by=null,
      last_error_code=left(coalesce(p_error_code,'AI_EXECUTOR_ERROR'),160),
      last_error_text=left(p_error_text,1000),
      updated_at=now()
  where id=p_queue_id;

  insert into portal_private.ai_model_executor_runs(
    queue_id,target_role,worker_id,worker_version,provider,model_id,status,response_id,request_hash,output_hash,error_code,usage,metadata,finished_at
  ) values(
    q.id,q.target_role,p_worker_id,c.worker_version,c.provider,coalesce(p_model,c.model_id),
    case when next_state='DELIVERED' then 'RETRY' else 'DEAD_LETTER' end,
    p_response_id,p_request_hash,p_output_hash,left(coalesce(p_error_code,'AI_EXECUTOR_ERROR'),160),coalesce(p_usage,'{}'::jsonb),
    jsonb_build_object('attempts',q.attempts,'next_state',next_state),now()
  );

  return jsonb_build_object('ok',false,'queue_id',q.id,'next_state',next_state,'attempts',q.attempts,'error_code',left(coalesce(p_error_code,'AI_EXECUTOR_ERROR'),160));
end;
$$;
revoke all on function public.rona_ai_executor_fail(uuid,text,text,text,boolean,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.rona_ai_executor_fail(uuid,text,text,text,boolean,text,text,text,text,jsonb) to service_role;

-- Internal scheduler helper. The Vault secret is sent only to this project's own Edge endpoint.
create or replace function portal_private.invoke_ai_model_executor(p_path text default 'run')
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,portal_private,vault,net
as $$
declare
  secret text;
  endpoint text;
  req bigint;
begin
  if p_path not in ('run','probe') then
    raise exception 'AI_EXECUTOR_PATH_INVALID';
  end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name='rona_ai_model_executor_key_v1' limit 1;
  if secret is null then
    raise exception 'AI_EXECUTOR_SCHEDULER_SECRET_MISSING';
  end if;
  endpoint:='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-ai-model-executor/'||p_path;
  select net.http_post(
    url:=endpoint,
    headers:=jsonb_build_object('content-type','application/json','x-rona-ai-executor-key',secret),
    body:=jsonb_build_object('source','PG_CRON','requested_at',now())
  ) into req;
  return req;
end;
$$;
revoke all on function portal_private.invoke_ai_model_executor(text) from public, anon, authenticated;

-- Safe while blocked: /run is a no-op until provider probe + explicit arm succeed.
do $$
declare
  j bigint;
begin
  select jobid into j from cron.job where jobname='rona-ai-model-executor';
  if j is not null then
    perform cron.unschedule(j);
  end if;
  perform cron.schedule('rona-ai-model-executor','* * * * *',$cron$select portal_private.invoke_ai_model_executor('run');$cron$);
end;
$$;

update portal_private.ai_runtime_control
set model_execution_state='BLOCKED',updated_at=now()
where singleton=true;
