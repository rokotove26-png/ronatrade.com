-- RONA Trade AI model executor V1.3: bounded coordination commit gate.
-- Model output remains untrusted until this database gate accepts it.

create or replace function portal_private.ai_executor_role_scope(
  p_role portal_private.ai_business_role_enum,
  p_type text
)
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
  end;
$$;
revoke all on function portal_private.ai_executor_role_scope(portal_private.ai_business_role_enum,text) from public, anon, authenticated;

create or replace function portal_private.ai_executor_entity_exists(p_type text,p_id text)
returns boolean
language plpgsql
stable
security definer
set search_path=pg_catalog,portal_private
as $$
declare
  v boolean:=false;
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
end;
$$;
revoke all on function portal_private.ai_executor_entity_exists(text,text) from public, anon, authenticated;

create or replace function public.rona_ai_executor_commit_action(
  p_queue_id uuid,
  p_worker_id text,
  p_action jsonb,
  p_response_id text,
  p_model text,
  p_request_hash text,
  p_output_hash text,
  p_usage jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,portal_private,public
as $$
declare
  q portal_private.ai_runtime_queue%rowtype;
  c portal_private.ai_model_executor_control%rowtype;
  ident record;
  parent_rec record;
  action_name text;
  entity_type text;
  entity_id text;
  expected_type text;
  expected_id text;
  target portal_private.ai_business_role_enum;
  parent_id uuid;
  rec_id uuid;
  supersedes uuid;
  rec_version integer:=1;
  status_text text;
  payload_body jsonb;
  source_refs jsonb;
  evidence_refs jsonb:='[]'::jsonb;
  idem_hash text;
  body_hash text;
  assigned_role text;
  decision_action text;
begin
  select * into c from portal_private.ai_model_executor_control where singleton=true;
  if not found or not c.enabled or c.state<>'ENABLED' then
    raise exception 'AI_EXECUTOR_NOT_ENABLED';
  end if;

  select * into q from portal_private.ai_runtime_queue where id=p_queue_id for update;
  if not found
     or q.state<>'DELIVERED'
     or q.qa_only
     or q.target_role::text='SYSTEM_ADMIN'
     or q.claimed_by<>'model-executor:'||p_worker_id
     or q.lease_until is null
     or q.lease_until<=now() then
    raise exception 'AI_EXECUTOR_QUEUE_LEASE_INVALID';
  end if;

  select identity_id,business_role
  into ident
  from portal_private.ai_service_identities
  where business_role=q.target_role and status='ACTIVE' and revoked_at is null
  limit 1;
  if not found then
    raise exception 'AI_EXECUTOR_ROLE_IDENTITY_UNAVAILABLE';
  end if;

  action_name:=upper(coalesce(p_action->>'action',''));
  if action_name not in ('NO_ACTION','FUNCTIONAL_CONCLUSION','HANDOFF_REQUEST','TASK_PROGRESS','BUSINESS_CHANGE_PROPOSAL','OPERATIONS_DECISION') then
    raise exception 'AI_EXECUTOR_ACTION_INVALID';
  end if;

  if action_name='NO_ACTION' then
    update portal_private.ai_runtime_queue
    set state='PROCESSED',processed_at=coalesce(processed_at,now()),lease_until=null,claimed_by=null,last_error_code=null,last_error_text=null,updated_at=now()
    where id=q.id;

    insert into portal_private.ai_model_executor_runs(
      queue_id,target_role,worker_id,worker_version,provider,model_id,status,action_type,response_id,request_hash,output_hash,usage,metadata,finished_at
    ) values(
      q.id,q.target_role,p_worker_id,c.worker_version,c.provider,p_model,'NO_ACTION','NO_ACTION',p_response_id,p_request_hash,p_output_hash,
      coalesce(p_usage,'{}'::jsonb),jsonb_build_object('reason',left(coalesce(p_action->>'reason','NO_ACTION'),1000)),now()
    );

    insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
    values(q.id,q.target_role,c.worker_version,'MODEL_EXECUTOR','PROCESSED','MODEL_NO_ACTION',jsonb_build_array(q.source_type||':'||q.source_id),jsonb_build_object('response_id',p_response_id),now());

    return jsonb_build_object('ok',true,'queue_id',q.id,'action','NO_ACTION','state','PROCESSED');
  end if;

  -- Bind the model to the server-routed entity; entity hopping is denied.
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
    )), '');
  end if;

  if action_name='OPERATIONS_DECISION' then
    if q.target_role::text<>'OPERATIONS_DIRECTOR' or q.source_type<>'COORDINATION' or q.source_record_id is null then
      raise exception 'AI_EXECUTOR_OPERATIONS_DECISION_SOURCE_INVALID';
    end if;
    parent_id:=q.source_record_id;
    select record_id,record_type,functional_role,target_type,target_id
    into parent_rec
    from portal_private.ai_coordination_records
    where record_id=parent_id
      and record_type in ('FUNCTIONAL_CONCLUSION','HANDOFF_REQUEST','BUSINESS_CHANGE_PROPOSAL')
      and qa_only=false
    limit 1;
    if not found or parent_rec.target_type='SYSTEM' then
      raise exception 'AI_EXECUTOR_OPERATIONS_DECISION_PARENT_INVALID';
    end if;
    entity_type:=parent_rec.target_type;
    entity_id:=parent_rec.target_id;
  else
    entity_type:=upper(coalesce(p_action->>'entity_type',''));
    entity_id:=nullif(btrim(coalesce(p_action->>'entity_id','')),'');
    if expected_type='' or expected_id is null or entity_type<>expected_type or entity_id<>expected_id then
      raise exception 'AI_EXECUTOR_ENTITY_BINDING_MISMATCH';
    end if;
    if not portal_private.ai_executor_role_scope(q.target_role,entity_type)
       or not portal_private.ai_executor_entity_exists(entity_type,entity_id) then
      raise exception 'AI_EXECUTOR_TARGET_OUT_OF_SCOPE';
    end if;
    if q.source_type='COORDINATION' then
      parent_id:=q.source_record_id;
    end if;
  end if;

  source_refs:=coalesce(q.payload->'source_refs','[]'::jsonb);
  if jsonb_typeof(source_refs)<>'array' then
    source_refs:='[]'::jsonb;
  end if;
  source_refs:=source_refs||jsonb_build_array('AI_EXECUTOR_QUEUE:'||q.id::text,q.source_type||':'||q.source_id);

  if action_name='FUNCTIONAL_CONCLUSION' then
    status_text:=upper(coalesce(p_action->>'status',''));
    if status_text not in ('APPROVED','APPROVED_WITH_CONDITIONS','HOLD','REJECTED') then
      raise exception 'AI_EXECUTOR_CONCLUSION_STATUS_INVALID';
    end if;
    if btrim(coalesce(p_action->>'summary',''))='' or btrim(coalesce(p_action->>'recommendation',''))='' then
      raise exception 'AI_EXECUTOR_CONCLUSION_TEXT_REQUIRED';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('CONCLUSION|'||q.target_role::text||'|'||entity_type||'|'||entity_id,0));
    select record_id,version
    into supersedes,rec_version
    from portal_private.ai_coordination_records
    where record_type='FUNCTIONAL_CONCLUSION'
      and functional_role=q.target_role
      and target_type=entity_type
      and target_id=entity_id
    order by version desc
    limit 1;
    rec_version:=coalesce(rec_version,0)+1;
    target:='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum;
    payload_body:=jsonb_build_object(
      'entity_type',entity_type,
      'entity_id',entity_id,
      'status',status_text,
      'summary',left(p_action->>'summary',4000),
      'confirmed',coalesce((p_action->>'confirmed')::boolean,false),
      'open_issues',coalesce(p_action->'open_issues','[]'::jsonb),
      'risks',coalesce(p_action->'risks','[]'::jsonb),
      'mandatory_conditions',coalesce(p_action->'mandatory_conditions','[]'::jsonb),
      'recommendation',left(p_action->>'recommendation',4000),
      'source_refs',source_refs
    );

  elsif action_name='HANDOFF_REQUEST' then
    if coalesce(p_action->>'target_role','') not in ('OPERATIONS_DIRECTOR','FINANCE','LEGAL','MARKET_ANALYST','RAIL_LOGISTICS','SYSTEM_ADMIN') then
      raise exception 'AI_EXECUTOR_HANDOFF_ROLE_INVALID';
    end if;
    target:=(p_action->>'target_role')::portal_private.ai_business_role_enum;
    if target=q.target_role then
      raise exception 'AI_EXECUTOR_SELF_HANDOFF_DENIED';
    end if;
    if target::text='SYSTEM_ADMIN' and entity_type not in ('SYSTEM','TASK') then
      raise exception 'AI_EXECUTOR_SYSTEM_ADMIN_HANDOFF_SCOPE_DENIED';
    end if;
    if btrim(coalesce(p_action->>'subject',''))=''
       or btrim(coalesce(p_action->>'requested_check',''))=''
       or btrim(coalesce(p_action->>'reason',''))='' then
      raise exception 'AI_EXECUTOR_HANDOFF_TEXT_REQUIRED';
    end if;
    if upper(coalesce(p_action->>'priority','')) not in ('LOW','NORMAL','HIGH','CRITICAL') then
      raise exception 'AI_EXECUTOR_PRIORITY_INVALID';
    end if;
    status_text:='REQUESTED';
    payload_body:=jsonb_build_object(
      'target_role',target::text,
      'entity_type',entity_type,
      'entity_id',entity_id,
      'subject',left(p_action->>'subject',1000),
      'requested_check',left(p_action->>'requested_check',4000),
      'reason',left(p_action->>'reason',4000),
      'priority',upper(p_action->>'priority'),
      'source_refs',source_refs
    );

  elsif action_name='TASK_PROGRESS' then
    if entity_type<>'TASK' or q.source_type<>'STAFF_TASK' then
      raise exception 'AI_EXECUTOR_TASK_SOURCE_INVALID';
    end if;
    select assigned_functional_role::text
    into assigned_role
    from portal_private.staff_tasks
    where task_id=entity_id and qa_only=false and status not in ('COMPLETED','REJECTED','CLOSED')
    limit 1;
    if not found then
      raise exception 'AI_EXECUTOR_TASK_NOT_ACTIVE';
    end if;
    if assigned_role<>case q.target_role::text when 'OPERATIONS_DIRECTOR' then 'EXECUTIVE_DIRECTOR' else q.target_role::text end then
      raise exception 'AI_EXECUTOR_TASK_ROLE_DENIED';
    end if;
    status_text:=upper(coalesce(p_action->>'progress_status',''));
    if status_text not in ('ACKNOWLEDGED','IN_PROGRESS','BLOCKED','READY_FOR_REVIEW')
       or btrim(coalesce(p_action->>'note',''))='' then
      raise exception 'AI_EXECUTOR_TASK_PROGRESS_INVALID';
    end if;
    target:=q.target_role;
    payload_body:=jsonb_build_object(
      'task_id',entity_id,
      'progress_status',status_text,
      'note',left(p_action->>'note',4000),
      'evidence_refs',evidence_refs
    );

  elsif action_name='BUSINESS_CHANGE_PROPOSAL' then
    if btrim(coalesce(p_action->>'reason',''))='' or btrim(coalesce(p_action->>'risk_note',''))='' then
      raise exception 'AI_EXECUTOR_PROPOSAL_TEXT_REQUIRED';
    end if;
    if nullif(btrim(coalesce(p_action->>'proposed_field','')),'') is null
       and nullif(btrim(coalesce(p_action->>'proposed_action','')),'') is null then
      raise exception 'AI_EXECUTOR_PROPOSAL_CHANGE_REQUIRED';
    end if;
    target:='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum;
    status_text:='PROPOSED';
    payload_body:=jsonb_build_object(
      'target_entity_type',entity_type,
      'target_entity_id',entity_id,
      'proposed_field',nullif(left(p_action->>'proposed_field',160),''),
      'proposed_action',nullif(left(p_action->>'proposed_action',160),''),
      'proposed_value',p_action->'proposed_value',
      'proposed_state',p_action->'proposed_state',
      'reason',left(p_action->>'reason',4000),
      'evidence_refs',evidence_refs,
      'risk_note',left(p_action->>'risk_note',4000)
    );

  else
    decision_action:=upper(coalesce(p_action->>'decision_action',''));
    if decision_action not in ('APPROVE_FOR_NEXT_STAGE','RETURN_FOR_REVISION','REJECT')
       or btrim(coalesce(p_action->>'note',''))='' then
      raise exception 'AI_EXECUTOR_DECISION_INVALID';
    end if;
    target:=parent_rec.functional_role;
    status_text:=decision_action;
    perform pg_advisory_xact_lock(hashtextextended('DECISION|'||parent_id::text,0));
    select coalesce(max(version),0)+1
    into rec_version
    from portal_private.ai_coordination_records
    where record_type='OPERATIONS_INTERNAL_DECISION' and parent_record_id=parent_id;
    payload_body:=jsonb_build_object(
      'record_id',parent_id,
      'action',decision_action,
      'note',left(p_action->>'note',4000)
    );
  end if;

  idem_hash:=encode(extensions.digest(convert_to('AI_EXECUTOR|'||q.id::text||'|'||action_name,'UTF8'),'sha256'),'hex');
  body_hash:=encode(extensions.digest(convert_to(payload_body::text,'UTF8'),'sha256'),'hex');

  select record_id into rec_id
  from portal_private.ai_coordination_records
  where identity_id=ident.identity_id
    and tool_name='ai_model_executor_'||lower(action_name)
    and idempotency_key_hash=idem_hash
  limit 1;

  if rec_id is null then
    insert into portal_private.ai_coordination_records(
      record_type,functional_role,identity_id,token_id,client_id,server_slug,tool_name,
      target_type,target_id,target_role,parent_record_id,version,supersedes_id,
      idempotency_key_hash,payload_hash,source_refs,evidence_refs,payload,status,
      correlation_id,mcp_request_id,qa_only
    ) values(
      case action_name
        when 'FUNCTIONAL_CONCLUSION' then 'FUNCTIONAL_CONCLUSION'
        when 'HANDOFF_REQUEST' then 'HANDOFF_REQUEST'
        when 'TASK_PROGRESS' then 'TASK_PROGRESS'
        when 'BUSINESS_CHANGE_PROPOSAL' then 'BUSINESS_CHANGE_PROPOSAL'
        else 'OPERATIONS_INTERNAL_DECISION'
      end,
      q.target_role,
      ident.identity_id,
      null,
      'SERVER_AI_EXECUTOR',
      'rona-ai-model-executor',
      'ai_model_executor_'||lower(action_name),
      entity_type,
      entity_id,
      target,
      parent_id,
      rec_version,
      supersedes,
      idem_hash,
      body_hash,
      source_refs,
      evidence_refs,
      payload_body,
      status_text,
      q.correlation_id,
      gen_random_uuid(),
      false
    )
    returning record_id into rec_id;
  end if;

  update portal_private.ai_runtime_queue
  set state='PROCESSED',processed_at=coalesce(processed_at,now()),lease_until=null,claimed_by=null,last_error_code=null,last_error_text=null,updated_at=now()
  where id=q.id;

  insert into portal_private.ai_model_executor_runs(
    queue_id,target_role,worker_id,worker_version,provider,model_id,status,action_type,response_id,request_hash,output_hash,usage,metadata,finished_at
  ) values(
    q.id,q.target_role,p_worker_id,c.worker_version,c.provider,p_model,'ACTION_COMMITTED',action_name,p_response_id,p_request_hash,p_output_hash,
    coalesce(p_usage,'{}'::jsonb),jsonb_build_object('coordination_record_id',rec_id,'source_type',q.source_type,'source_id',q.source_id),now()
  );

  insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
  values(
    q.id,q.target_role,c.worker_version,'MODEL_EXECUTOR','PROCESSED','MODEL_ACTION_COMMITTED',
    jsonb_build_array(q.source_type||':'||q.source_id),
    jsonb_build_object('action',action_name,'coordination_record_id',rec_id,'response_id',p_response_id),
    now()
  );

  return jsonb_build_object('ok',true,'queue_id',q.id,'action',action_name,'state','PROCESSED','coordination_record_id',rec_id);
end;
$$;
revoke all on function public.rona_ai_executor_commit_action(uuid,text,jsonb,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.rona_ai_executor_commit_action(uuid,text,jsonb,text,text,text,text,jsonb) to service_role;

-- Keep queued protocol metadata aligned with the live runtime control version.
create or replace function portal_private.enqueue_ai_runtime_coordination()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,portal_private,private
as $$
declare
  v_priority text;
  v_protocol text;
begin
  if new.qa_only or new.target_role is null then
    return new;
  end if;
  if new.functional_role=new.target_role and new.record_type<>'OPERATIONS_INTERNAL_DECISION' then
    return new;
  end if;

  v_priority:=portal_private.ai_runtime_priority(coalesce(new.payload->>'priority','NORMAL'));
  select protocol_version into v_protocol from portal_private.ai_runtime_control where singleton=true;
  v_protocol:=coalesce(v_protocol,'AI_STAFF_COMMUNICATION_PROTOCOL_V1_2');

  insert into portal_private.ai_runtime_queue(
    source_type,source_id,source_record_id,target_role,priority,deadline_at,payload,qa_only
  ) values(
    'COORDINATION',
    new.record_id::text,
    new.record_id,
    new.target_role,
    v_priority,
    portal_private.ai_runtime_deadline(v_priority,new.created_at),
    jsonb_build_object(
      'record_id',new.record_id,
      'record_type',new.record_type,
      'from_role',new.functional_role::text,
      'target_role',new.target_role::text,
      'target_type',new.target_type,
      'target_id',new.target_id,
      'status',new.status,
      'payload',new.payload,
      'source_refs',new.source_refs,
      'protocol',v_protocol
    ),
    false
  )
  on conflict(source_type,source_id,target_role) do nothing;

  return new;
end;
$$;
