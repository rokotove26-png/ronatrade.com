-- Canonical runtime reconciliation after the Commercial Director cutover.
-- MARKET_ANALYST remains a historical/compatibility role label only; all live runtime work
-- must execute through AI-COMMERCIAL-DIRECTOR / COMMERCIAL_DIRECTOR.

create or replace function portal_private.ai_runtime_canonical_role(
  p_role portal_private.ai_business_role_enum
)
returns portal_private.ai_business_role_enum
language sql
immutable
set search_path to 'pg_catalog','portal_private'
as $function$
  select case p_role::text
    when 'MARKET_ANALYST' then 'COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum
    else p_role
  end
$function$;

create or replace function portal_private.enqueue_ai_runtime_coordination()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private','private'
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

-- Preserve the original coordination records as immutable provenance, but repair their
-- live delivery projection so pending handoffs are no longer sent to the suspended identity.
update portal_private.ai_runtime_queue q
set target_role='COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum,
    state='QUEUED',
    available_at=now(),
    lease_until=null,
    claimed_by=null,
    last_error_code=null,
    last_error_text=null,
    payload=coalesce(q.payload,'{}'::jsonb)
      || jsonb_build_object(
           'target_role','COMMERCIAL_DIRECTOR',
           'source_target_role','MARKET_ANALYST',
           'role_alias_normalized',true,
           'role_alias_normalized_at',now()
         ),
    updated_at=now()
where q.target_role='MARKET_ANALYST'::portal_private.ai_business_role_enum
  and q.state in ('QUEUED','BLOCKED')
  and not exists (
    select 1
    from portal_private.ai_runtime_queue x
    where x.id<>q.id
      and x.source_type=q.source_type
      and x.source_id=q.source_id
      and x.target_role='COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum
  );

-- Normalize future model-originated compatibility handoffs before the coordination record
-- is written, so the active technical role is canonical end to end.
do $migration$
declare
  v_def text;
  v_old text := $old$out_target:=(p_action->>'target_role')::portal_private.ai_business_role_enum;$old$;
  v_new text := $new$out_target:=portal_private.ai_runtime_canonical_role((p_action->>'target_role')::portal_private.ai_business_role_enum);$new$;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where p.prokind='f'
    and n.nspname='public'
    and p.proname='rona_ai_executor_commit_action'
    and pg_get_function_identity_arguments(p.oid)='p_queue_id uuid, p_worker_id text, p_action jsonb, p_response_id text, p_model text, p_request_hash text, p_output_hash text, p_usage jsonb';
  if v_def is null then raise exception 'rona_ai_executor_commit_action overload not found'; end if;
  if position(v_old in v_def)>0 then
    execute replace(v_def,v_old,v_new);
  elsif position(v_new in v_def)=0 then
    raise exception 'expected executor handoff target clause not found';
  end if;
end
$migration$;

insert into portal_private.ai_coordination_audit_events(
  functional_role,identity_id,client_id,server_slug,tool_name,target_type,target_id,
  correlation_id,mcp_request_id,result,qa_only,metadata
)
values(
  'SYSTEM_ADMIN','AI-SYSTEM-ADMIN',null,'rona-system-admin',
  'ai_commercial_director_runtime_alias_reconciliation','SYSTEM','AI_RUNTIME_ROUTING',
  gen_random_uuid(),gen_random_uuid(),'SUCCESS',false,
  jsonb_build_object(
    'canonical_live_role','COMMERCIAL_DIRECTOR',
    'canonical_live_identity','AI-COMMERCIAL-DIRECTOR',
    'historical_alias','MARKET_ANALYST',
    'historical_identity','AI-MARKET-ANALYST',
    'historical_coordination_records_rewritten',false,
    'live_queue_projection_repaired',true,
    'future_coordination_queue_normalized',true,
    'future_executor_handoffs_normalized',true
  )
);
