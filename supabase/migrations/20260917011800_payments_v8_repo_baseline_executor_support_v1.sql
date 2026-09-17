-- Payments V8 executor support: prioritize signed-document Finance tasks and issue skew-tolerant read tokens.

create or replace function public.rona_ai_executor_claim(p_worker_id text,p_limit integer default 1)
returns table(queue_id uuid,source_type text,source_id text,source_record_id uuid,target_role text,priority text,correlation_id uuid,payload jsonb,attempts integer,max_attempts integer,lease_seconds integer,model_id text,max_output_tokens integer)
language plpgsql security definer set search_path to 'pg_catalog','portal_private','public' as $function$
declare c portal_private.ai_model_executor_control%rowtype; lim integer;
begin
  select * into c from portal_private.ai_model_executor_control where singleton=true;
  if not c.enabled or c.state<>'ENABLED' then return; end if;
  if not exists(select 1 from portal_private.ai_runtime_control r where r.singleton=true and r.enabled=true and r.scheduler_state='ENABLED' and r.model_execution_state='ENABLED') then return; end if;
  if p_worker_id is null or length(p_worker_id)<8 or length(p_worker_id)>120 then raise exception 'AI_EXECUTOR_WORKER_ID_INVALID'; end if;
  lim:=greatest(1,least(coalesce(p_limit,1),c.max_items_per_run,5));
  return query with picked as (
    select q.id from portal_private.ai_runtime_queue q
     where q.state='DELIVERED' and q.qa_only=false and q.target_role::text<>'SYSTEM_ADMIN'
       and q.created_at>=c.execute_after and q.available_at<=now() and q.attempts<c.max_attempts
       and (q.lease_until is null or q.lease_until<now())
     order by case when q.source_type='STAFF_TASK' and q.source_id like 'TASK-FIN-SCHEDULE-V8-%' and q.target_role::text='FINANCE' then 0 else 1 end,
              case q.priority when 'CRITICAL' then 1 when 'HIGH' then 2 when 'NORMAL' then 3 else 4 end,
              q.deadline_at nulls last,q.created_at
     for update skip locked limit lim
  ), claimed as (
    update portal_private.ai_runtime_queue q set lease_until=now()+make_interval(secs=>c.lease_seconds),claimed_by='model-executor:'||p_worker_id,attempts=q.attempts+1,updated_at=now()
    from picked p where q.id=p.id returning q.*
  )
  select q.id,q.source_type,q.source_id,q.source_record_id,q.target_role::text,q.priority,q.correlation_id,q.payload,q.attempts,c.max_attempts,c.lease_seconds,c.model_id,c.max_output_tokens from claimed q;
end;$function$;

create or replace function public.rona_ai_executor_issue_read_token(p_queue_id uuid,p_worker_id text)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','portal_private','vault','public' as $function$
declare q record; ident record; secret text; hdr text; pay text; unsigned text; sig text; j uuid:=gen_random_uuid(); n bigint:=extract(epoch from now())::bigint; b64h text; b64p text;
begin
  select id,target_role::text as target_role,claimed_by,lease_until into q from portal_private.ai_runtime_queue where id=p_queue_id and state='DELIVERED' and qa_only=false and claimed_by='model-executor:'||p_worker_id and lease_until>now() and target_role::text<>'SYSTEM_ADMIN'; if not found then raise exception 'AI_EXECUTOR_QUEUE_LEASE_INVALID'; end if;
  select identity_id,business_role::text as business_role,status::text as status,credential_version,revoked_at,not_before,token_ttl_seconds into ident from portal_private.ai_service_identities where business_role=q.target_role::portal_private.ai_business_role_enum limit 1; if not found or ident.status<>'ACTIVE' or ident.revoked_at is not null or (ident.not_before is not null and ident.not_before>now()) then raise exception 'AI_EXECUTOR_ROLE_IDENTITY_UNAVAILABLE'; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name='rona_ai_token_signing_key_v1' limit 1; if secret is null or length(secret)<32 then raise exception 'AI_SIGNING_KEY_UNAVAILABLE'; end if;
  hdr:='{"alg":"HS256","typ":"JWT","kid":"rona-ai-v1"}';
  pay:=jsonb_build_object('iss','rona-ai-identity-broker','aud','rona-ai-read-only','sub',ident.identity_id,'role',ident.business_role,'ver',ident.credential_version,'iat',n-5,'nbf',n-5,'exp',n+least(greatest(coalesce(ident.token_ttl_seconds,300),60),300),'jti',j::text,'actor_type','AI','scope','READ_ONLY')::text;
  b64h:=rtrim(translate(replace(replace(encode(convert_to(hdr,'UTF8'),'base64'),chr(10),''),chr(13),''),'+/','-_'),'=');
  b64p:=rtrim(translate(replace(replace(encode(convert_to(pay,'UTF8'),'base64'),chr(10),''),chr(13),''),'+/','-_'),'=');
  unsigned:=b64h||'.'||b64p;
  sig:=rtrim(translate(replace(replace(encode(extensions.hmac(convert_to(unsigned,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'base64'),chr(10),''),chr(13),''),'+/','-_'),'=');
  return jsonb_build_object('access_token',unsigned||'.'||sig,'token_type','Bearer','expires_in',least(greatest(coalesce(ident.token_ttl_seconds,300),60),300),'functional_role',ident.business_role,'ai_identity_id',ident.identity_id,'jti',j);
end;$function$;
