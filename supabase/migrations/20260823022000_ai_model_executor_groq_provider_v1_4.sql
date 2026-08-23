begin;

alter table portal_private.ai_model_executor_control
  drop constraint if exists ai_model_executor_control_provider_check;

alter table portal_private.ai_model_executor_control
  add constraint ai_model_executor_control_provider_check
  check (provider in ('OPENAI','GROQ'));

update portal_private.ai_model_executor_control
set enabled = false,
    state = 'BLOCKED',
    provider = 'GROQ',
    model_id = 'openai/gpt-oss-120b',
    worker_version = '1.4.0',
    max_output_tokens = 900,
    last_probe_at = null,
    last_probe_model = null,
    last_error_code = 'GROQ_API_KEY_MISSING',
    last_error_at = now(),
    updated_at = now()
where singleton = true;

update portal_private.ai_runtime_control
set model_execution_state = 'BLOCKED',
    worker_version = '1.4.0',
    updated_at = now()
where singleton = true;

create or replace function public.rona_ai_executor_arm(p_model text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'portal_private', 'public'
as $function$
declare c portal_private.ai_model_executor_control%rowtype;
begin
  select * into c from portal_private.ai_model_executor_control where singleton=true for update;
  if c.provider <> 'GROQ' then raise exception 'AI_EXECUTOR_PROVIDER_MISMATCH'; end if;
  if c.state<>'PROBE_OK' or c.last_probe_at is null or c.last_probe_at<now()-interval '10 minutes' then raise exception 'AI_EXECUTOR_RECENT_PROBE_REQUIRED'; end if;
  if p_model is null or btrim(p_model)='' or p_model<>c.last_probe_model or p_model<>c.model_id then raise exception 'AI_EXECUTOR_MODEL_PROBE_MISMATCH'; end if;
  update portal_private.ai_model_executor_control
     set enabled=true,
         state='ENABLED',
         execute_after=now(),
         activated_at=now(),
         last_error_code=null,
         last_error_at=null,
         worker_version='1.4.0',
         updated_at=now()
   where singleton=true
   returning * into c;
  update portal_private.ai_runtime_control
     set protocol_version='AI_STAFF_COMMUNICATION_PROTOCOL_V1_3',
         model_execution_state='ENABLED',
         worker_version='1.4.0',
         updated_at=now()
   where singleton=true;
  return jsonb_build_object('ok',true,'state',c.state,'provider',c.provider,'model_id',c.model_id,'execute_after',c.execute_after,'protocol_version',c.protocol_version,'worker_version',c.worker_version);
end;
$function$;

create or replace function public.rona_ai_executor_disarm(p_reason text default 'MANUAL_BLOCK'::text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'portal_private', 'public'
as $function$
begin
  update portal_private.ai_model_executor_control
     set enabled=false,
         state='BLOCKED',
         last_error_code=left(coalesce(p_reason,'MANUAL_BLOCK'),160),
         last_error_at=now(),
         worker_version='1.4.0',
         updated_at=now()
   where singleton=true;
  update portal_private.ai_runtime_control
     set model_execution_state='BLOCKED',
         worker_version='1.4.0',
         updated_at=now()
   where singleton=true;
  update portal_private.ai_runtime_queue
     set lease_until=null,
         claimed_by=null,
         updated_at=now()
   where state='DELIVERED' and claimed_by like 'model-executor:%';
  return jsonb_build_object('ok',true,'state','BLOCKED','provider','GROQ','reason',left(coalesce(p_reason,'MANUAL_BLOCK'),160));
end;
$function$;

commit;
