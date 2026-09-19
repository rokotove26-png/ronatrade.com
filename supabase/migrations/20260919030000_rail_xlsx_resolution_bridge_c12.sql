-- ONLINE RAIL / #644 — STAGE C1.2 RESOLUTION BRIDGE
-- REPOSITORY CANDIDATE ONLY. DO NOT APPLY TO PRODUCTION.
--
-- Purpose:
--   close the accepted TO_VERIFY -> MATCHED path without manual SQL;
--   preserve B1.3 authority contracts and B1.5 trusted-current semantics.
--
-- Business authority remains:
--   OWNER_EXPLICIT_INSTRUCTION
--   RAIL_LOGISTICS_VERIFIED_DECISION
--
-- service_role / SYSTEM_ADMIN are technical executors only and are never
-- accepted as a resolution authority type.

begin;

create or replace function portal_private.rail_xlsx_owner_resolution_bridge_v1(
  p_evidence_event_id uuid,
  p_deal_key uuid,
  p_rail_document_key uuid,
  p_owner_portal_user_id uuid,
  p_token_id uuid,
  p_client_id text,
  p_correlation_id uuid,
  p_mcp_request_id uuid,
  p_idempotency_key_hash text,
  p_owner_confirmation_ref text,
  p_reason_evidence jsonb,
  p_source_refs jsonb,
  p_evidence_refs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, extensions
as $$
declare
  v_event portal_private.rail_xlsx_resolution_effective_v1%rowtype;
  v_doc_deal uuid;
  v_authority portal_private.audit_events%rowtype;
  v_existing portal_private.audit_events%rowtype;
  v_metadata jsonb;
  v_decision jsonb;
begin
  if p_evidence_event_id is null
     or p_deal_key is null
     or p_rail_document_key is null
     or p_owner_portal_user_id is null
     or p_token_id is null
     or p_correlation_id is null
     or p_mcp_request_id is null then
    raise exception using errcode='22023', message='RAIL_XLSX_OWNER_BRIDGE_REQUIRED_ID_MISSING';
  end if;

  if nullif(btrim(coalesce(p_client_id,'')),'') is null then
    raise exception using errcode='22023', message='RAIL_XLSX_OWNER_BRIDGE_CLIENT_REQUIRED';
  end if;

  if lower(coalesce(p_idempotency_key_hash,'')) !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023', message='RAIL_XLSX_OWNER_BRIDGE_IDEMPOTENCY_HASH_INVALID';
  end if;

  if nullif(btrim(coalesce(p_owner_confirmation_ref,'')),'') is null
     or length(p_owner_confirmation_ref)>200 then
    raise exception using errcode='22023', message='RAIL_XLSX_OWNER_CONFIRMATION_REF_REQUIRED';
  end if;

  if p_reason_evidence is null
     or jsonb_typeof(p_reason_evidence)<>'object'
     or p_reason_evidence='{}'::jsonb then
    raise exception using errcode='23514', message='RAIL_XLSX_OWNER_BRIDGE_REASON_REQUIRED';
  end if;

  if p_source_refs is null
     or jsonb_typeof(p_source_refs)<>'array'
     or jsonb_array_length(p_source_refs)=0 then
    raise exception using errcode='23514', message='RAIL_XLSX_OWNER_BRIDGE_SOURCE_REFS_REQUIRED';
  end if;

  if p_evidence_refs is null
     or jsonb_typeof(p_evidence_refs)<>'array'
     or jsonb_array_length(p_evidence_refs)=0
     or not (p_evidence_refs ? ('RAIL_XLSX_EVIDENCE:'||p_evidence_event_id::text)) then
    raise exception using errcode='23514', message='RAIL_XLSX_OWNER_BRIDGE_EVIDENCE_REFS_INVALID';
  end if;

  -- The current OAuth token is the authenticated owner context. It must still
  -- be an active Rail Logistics Pilot token bound to an ACTIVE portal ADMIN.
  if not exists (
    select 1
    from portal_private.mcp_oauth_tokens t
    join portal_private.portal_users u
      on u.id=t.owner_portal_user_id
    join portal_private.portal_user_roles ur
      on ur.user_id=u.id
     and ur.role::text='ADMIN'
     and ur.status::text='ACTIVE'
     and ur.revoked_at is null
    where t.token_id=p_token_id
      and t.owner_portal_user_id=p_owner_portal_user_id
      and t.client_id=p_client_id
      and t.server_slug='rona-mcp-rail-logistics-pilot'
      and t.functional_role::text='RAIL_LOGISTICS'
      and t.identity_id='AI-RAIL-LOGISTICS'
      and (' '||t.scope||' ') like '% mcp:coordinate %'
      and t.revoked_at is null
      and t.access_expires_at>now()
      and u.status::text='ACTIVE'
      and u.lifecycle_state::text='ACTIVE'
      and u.auth_user_id is not null
  ) then
    raise exception using errcode='42501', message='RAIL_XLSX_OWNER_AUTHENTICATED_CONTEXT_REQUIRED';
  end if;

  select * into v_event
  from portal_private.rail_xlsx_resolution_effective_v1
  where id=p_evidence_event_id;

  if not found then
    raise exception using errcode='23503', message='RAIL_XLSX_EVIDENCE_EVENT_NOT_FOUND';
  end if;

  select rd.deal_key into v_doc_deal
  from portal_private.rail_documents rd
  join portal_private.deals d on d.id=rd.deal_key
  where rd.id=p_rail_document_key
    and rd.lifecycle_state::text='ACTIVE'
    and d.id=p_deal_key
    and d.lifecycle_state::text='ACTIVE';

  if not found or v_doc_deal is null or v_doc_deal<>p_deal_key then
    raise exception using errcode='23514', message='RAIL_XLSX_DECISION_DEAL_DOCUMENT_SCOPE_CONFLICT';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'RAIL_XLSX_OWNER_RESOLUTION|'||
      p_owner_portal_user_id::text||'|'||
      lower(p_idempotency_key_hash),
      0
    )
  );

  select * into v_existing
  from portal_private.audit_events
  where actor_user_id=p_owner_portal_user_id
    and actor_role='ADMIN'
    and action='RAIL_XLSX_OWNER_RESOLUTION_INSTRUCTION'
    and entity_type='RAIL_XLSX_EVIDENCE'
    and metadata->>'idempotencyKeyHash'=lower(p_idempotency_key_hash)
  order by event_at desc,event_id desc
  limit 1;

  if found then
    if v_existing.entity_id<>p_evidence_event_id::text
       or v_existing.metadata->>'authority_contract'<>'RAIL_XLSX_OWNER_AUTHORITY_V1'
       or v_existing.metadata->>'authorityType'<>'OWNER_EXPLICIT_INSTRUCTION'
       or v_existing.metadata->>'evidenceEventId'<>p_evidence_event_id::text
       or v_existing.metadata->>'resultingStatus'<>'MATCHED'
       or v_existing.metadata->>'dealKey'<>p_deal_key::text
       or v_existing.metadata->>'railDocumentKey'<>p_rail_document_key::text
       or v_existing.metadata->>'ownerConfirmationRef'<>p_owner_confirmation_ref
       or coalesce(v_existing.metadata->'reasonEvidence','{}'::jsonb)<>p_reason_evidence
       or coalesce(v_existing.metadata->'sourceRefs','[]'::jsonb)<>p_source_refs
       or coalesce(v_existing.metadata->'evidenceRefs','[]'::jsonb)<>p_evidence_refs then
      raise exception using errcode='23505', message='RAIL_XLSX_OWNER_BRIDGE_IDEMPOTENCY_CONFLICT';
    end if;

    v_authority:=v_existing;
  else
    if v_event.overlay_resolution_status<>'TO_VERIFY' then
      raise exception using errcode='23514', message='RAIL_XLSX_OWNER_BRIDGE_REQUIRES_TO_VERIFY';
    end if;

    v_metadata:=jsonb_build_object(
      'authority_contract','RAIL_XLSX_OWNER_AUTHORITY_V1',
      'authorityType','OWNER_EXPLICIT_INSTRUCTION',
      'evidenceEventId',p_evidence_event_id::text,
      'resultingStatus','MATCHED',
      'dealKey',p_deal_key::text,
      'railDocumentKey',p_rail_document_key::text,
      'ownerConfirmationRef',p_owner_confirmation_ref,
      'reasonEvidence',p_reason_evidence,
      'sourceRefs',p_source_refs,
      'evidenceRefs',p_evidence_refs,
      'idempotencyKeyHash',lower(p_idempotency_key_hash),
      'oauthTokenId',p_token_id::text,
      'oauthClientId',p_client_id,
      'mcpRequestId',p_mcp_request_id::text,
      'correlationId',p_correlation_id::text,
      'technicalExecutor','service_role',
      'authorityBridge','RAIL_XLSX_RESOLUTION_BRIDGE_V1'
    );

    insert into portal_private.audit_events (
      actor_user_id,actor_role,action,entity_type,entity_id,
      request_id,correlation_id,metadata,severity,result
    )
    values (
      p_owner_portal_user_id,
      'ADMIN',
      'RAIL_XLSX_OWNER_RESOLUTION_INSTRUCTION',
      'RAIL_XLSX_EVIDENCE',
      p_evidence_event_id::text,
      p_mcp_request_id,
      p_correlation_id,
      v_metadata,
      'INFO',
      'SUCCESS'
    )
    returning * into v_authority;
  end if;

  v_decision:=portal_private.rail_xlsx_resolution_decide_v1(
    p_evidence_event_id,
    'MATCHED',
    p_deal_key,
    p_rail_document_key,
    'OWNER_EXPLICIT_INSTRUCTION',
    v_authority.event_id,
    v_authority.event_at,
    p_reason_evidence,
    jsonb_build_object(
      'authorityBridge','RAIL_XLSX_RESOLUTION_BRIDGE_V1',
      'businessAuthority','OWNER_EXPLICIT_INSTRUCTION',
      'authorityRef',v_authority.event_id::text,
      'ownerPortalUserId',p_owner_portal_user_id::text,
      'ownerConfirmationRef',p_owner_confirmation_ref,
      'sourceRefs',p_source_refs,
      'evidenceRefs',p_evidence_refs,
      'technicalExecutor','service_role'
    )
  );

  return jsonb_build_object(
    'outcome',case
      when v_decision->>'outcome'='IDEMPOTENT_REPLAY' then 'IDEMPOTENT_REPLAY'
      else 'MATCHED'
    end,
    'authorityType','OWNER_EXPLICIT_INSTRUCTION',
    'authorityRef',v_authority.event_id,
    'ownerPortalUserId',p_owner_portal_user_id,
    'decision',v_decision
  );
end
$$;

revoke all on function portal_private.rail_xlsx_owner_resolution_bridge_v1(
  uuid,uuid,uuid,uuid,uuid,text,uuid,uuid,text,text,jsonb,jsonb,jsonb
) from public,anon,authenticated;
grant execute on function portal_private.rail_xlsx_owner_resolution_bridge_v1(
  uuid,uuid,uuid,uuid,uuid,text,uuid,uuid,text,text,jsonb,jsonb,jsonb
) to service_role;


create or replace function portal_private.rail_xlsx_rail_resolution_bridge_v1(
  p_evidence_event_id uuid,
  p_deal_key uuid,
  p_rail_document_key uuid,
  p_token_id uuid,
  p_client_id text,
  p_correlation_id uuid,
  p_mcp_request_id uuid,
  p_idempotency_key_hash text,
  p_reason_evidence jsonb,
  p_source_refs jsonb,
  p_evidence_refs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, extensions
as $$
declare
  v_event portal_private.rail_xlsx_resolution_effective_v1%rowtype;
  v_doc_deal uuid;
  v_record portal_private.ai_coordination_records%rowtype;
  v_existing portal_private.ai_coordination_records%rowtype;
  v_payload jsonb;
  v_payload_hash text;
  v_next_version integer;
  v_qa_only boolean := false;
  v_decision jsonb;
begin
  if p_evidence_event_id is null
     or p_deal_key is null
     or p_rail_document_key is null
     or p_token_id is null
     or p_correlation_id is null
     or p_mcp_request_id is null then
    raise exception using errcode='22023', message='RAIL_XLSX_RAIL_BRIDGE_REQUIRED_ID_MISSING';
  end if;

  if nullif(btrim(coalesce(p_client_id,'')),'') is null then
    raise exception using errcode='22023', message='RAIL_XLSX_RAIL_BRIDGE_CLIENT_REQUIRED';
  end if;

  if lower(coalesce(p_idempotency_key_hash,'')) !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023', message='RAIL_XLSX_RAIL_BRIDGE_IDEMPOTENCY_HASH_INVALID';
  end if;

  if p_reason_evidence is null
     or jsonb_typeof(p_reason_evidence)<>'object'
     or p_reason_evidence='{}'::jsonb then
    raise exception using errcode='23514', message='RAIL_XLSX_RAIL_BRIDGE_REASON_REQUIRED';
  end if;

  if p_source_refs is null
     or jsonb_typeof(p_source_refs)<>'array'
     or jsonb_array_length(p_source_refs)=0 then
    raise exception using errcode='23514', message='RAIL_XLSX_RAIL_BRIDGE_SOURCE_REFS_REQUIRED';
  end if;

  if p_evidence_refs is null
     or jsonb_typeof(p_evidence_refs)<>'array'
     or jsonb_array_length(p_evidence_refs)=0
     or not (p_evidence_refs ? ('RAIL_XLSX_EVIDENCE:'||p_evidence_event_id::text)) then
    raise exception using errcode='23514', message='RAIL_XLSX_RAIL_BRIDGE_EVIDENCE_REFS_INVALID';
  end if;

  -- The business authority is the fixed Rail Logistics AI identity.
  -- service_role merely executes this guarded function.
  select coalesce(c.client_name like 'RONA Phase 2B2 QA%',false)
    into v_qa_only
  from portal_private.mcp_oauth_tokens t
  join portal_private.mcp_oauth_clients c on c.client_id=t.client_id
  where t.token_id=p_token_id
    and t.client_id=p_client_id
    and t.server_slug='rona-mcp-rail-logistics-pilot'
    and t.functional_role::text='RAIL_LOGISTICS'
    and t.identity_id='AI-RAIL-LOGISTICS'
    and (' '||t.scope||' ') like '% mcp:coordinate %'
    and t.revoked_at is null
    and t.access_expires_at>now()
  limit 1;

  if not found then
    raise exception using errcode='42501', message='RAIL_XLSX_RAIL_AUTHENTICATED_CONTEXT_REQUIRED';
  end if;

  select * into v_event
  from portal_private.rail_xlsx_resolution_effective_v1
  where id=p_evidence_event_id;

  if not found then
    raise exception using errcode='23503', message='RAIL_XLSX_EVIDENCE_EVENT_NOT_FOUND';
  end if;

  select rd.deal_key into v_doc_deal
  from portal_private.rail_documents rd
  join portal_private.deals d on d.id=rd.deal_key
  where rd.id=p_rail_document_key
    and rd.lifecycle_state::text='ACTIVE'
    and d.id=p_deal_key
    and d.lifecycle_state::text='ACTIVE';

  if not found or v_doc_deal is null or v_doc_deal<>p_deal_key then
    raise exception using errcode='23514', message='RAIL_XLSX_DECISION_DEAL_DOCUMENT_SCOPE_CONFLICT';
  end if;

  v_payload:=jsonb_build_object(
    'authorityContract','RAIL_XLSX_RAIL_LOGISTICS_AUTHORITY_V1',
    'authorityType','RAIL_LOGISTICS_VERIFIED_DECISION',
    'evidenceEventId',p_evidence_event_id::text,
    'resultingStatus','MATCHED',
    'dealKey',p_deal_key::text,
    'railDocumentKey',p_rail_document_key::text,
    'reasonEvidence',p_reason_evidence,
    'sourceRefs',p_source_refs,
    'evidenceRefs',p_evidence_refs
  );

  v_payload_hash:=encode(
    extensions.digest(
      convert_to(v_payload::text,'UTF8'),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'RAIL_XLSX_RAIL_RESOLUTION|'||
      p_evidence_event_id::text,
      0
    )
  );

  select * into v_existing
  from portal_private.ai_coordination_records
  where identity_id='AI-RAIL-LOGISTICS'
    and tool_name='rail_xlsx_resolution_verify'
    and idempotency_key_hash=lower(p_idempotency_key_hash)
  limit 1;

  if found then
    if v_existing.functional_role::text<>'RAIL_LOGISTICS'
       or v_existing.record_type<>'FUNCTIONAL_CONCLUSION'
       or v_existing.status<>'APPROVED'
       or v_existing.target_type<>'RAIL_XLSX_EVIDENCE'
       or v_existing.target_id<>p_evidence_event_id::text
       or v_existing.payload_hash<>v_payload_hash
       or v_existing.source_refs<>p_source_refs
       or v_existing.evidence_refs<>p_evidence_refs
       or v_existing.payload<>v_payload then
      raise exception using errcode='23505', message='RAIL_XLSX_RAIL_BRIDGE_IDEMPOTENCY_CONFLICT';
    end if;

    v_record:=v_existing;
  else
    if v_event.overlay_resolution_status<>'TO_VERIFY' then
      raise exception using errcode='23514', message='RAIL_XLSX_RAIL_BRIDGE_REQUIRES_TO_VERIFY';
    end if;

    select coalesce(max(version),0)+1 into v_next_version
    from portal_private.ai_coordination_records
    where functional_role::text='RAIL_LOGISTICS'
      and record_type='FUNCTIONAL_CONCLUSION'
      and target_type='RAIL_XLSX_EVIDENCE'
      and target_id=p_evidence_event_id::text;

    insert into portal_private.ai_coordination_records (
      record_type,functional_role,identity_id,token_id,client_id,server_slug,
      tool_name,target_type,target_id,target_role,
      version,idempotency_key_hash,payload_hash,
      source_refs,evidence_refs,payload,status,
      correlation_id,mcp_request_id,qa_only
    )
    values (
      'FUNCTIONAL_CONCLUSION',
      'RAIL_LOGISTICS',
      'AI-RAIL-LOGISTICS',
      p_token_id,
      p_client_id,
      'rona-mcp-rail-logistics-pilot',
      'rail_xlsx_resolution_verify',
      'RAIL_XLSX_EVIDENCE',
      p_evidence_event_id::text,
      null,
      v_next_version,
      lower(p_idempotency_key_hash),
      v_payload_hash,
      p_source_refs,
      p_evidence_refs,
      v_payload,
      'APPROVED',
      p_correlation_id,
      p_mcp_request_id,
      v_qa_only
    )
    returning * into v_record;
  end if;

  v_decision:=portal_private.rail_xlsx_resolution_decide_v1(
    p_evidence_event_id,
    'MATCHED',
    p_deal_key,
    p_rail_document_key,
    'RAIL_LOGISTICS_VERIFIED_DECISION',
    v_record.record_id,
    v_record.created_at,
    p_reason_evidence,
    jsonb_build_object(
      'authorityBridge','RAIL_XLSX_RESOLUTION_BRIDGE_V1',
      'businessAuthority','RAIL_LOGISTICS_VERIFIED_DECISION',
      'authorityRef',v_record.record_id::text,
      'sourceRefs',p_source_refs,
      'evidenceRefs',p_evidence_refs,
      'technicalExecutor','service_role'
    )
  );

  return jsonb_build_object(
    'outcome',case
      when v_decision->>'outcome'='IDEMPOTENT_REPLAY' then 'IDEMPOTENT_REPLAY'
      else 'MATCHED'
    end,
    'authorityType','RAIL_LOGISTICS_VERIFIED_DECISION',
    'authorityRef',v_record.record_id,
    'coordinationVersion',v_record.version,
    'decision',v_decision
  );
end
$$;

revoke all on function portal_private.rail_xlsx_rail_resolution_bridge_v1(
  uuid,uuid,uuid,uuid,text,uuid,uuid,text,jsonb,jsonb,jsonb
) from public,anon,authenticated;
grant execute on function portal_private.rail_xlsx_rail_resolution_bridge_v1(
  uuid,uuid,uuid,uuid,text,uuid,uuid,text,jsonb,jsonb,jsonb
) to service_role;

comment on function portal_private.rail_xlsx_owner_resolution_bridge_v1(
  uuid,uuid,uuid,uuid,uuid,text,uuid,uuid,text,text,jsonb,jsonb,jsonb
) is
'C1.2 guarded owner authority bridge. Requires current Rail Pilot OAuth token bound to an active authenticated portal ADMIN, writes immutable audit authority, then invokes B1 resolution_decide. service_role is technical executor only.';

comment on function portal_private.rail_xlsx_rail_resolution_bridge_v1(
  uuid,uuid,uuid,uuid,text,uuid,uuid,text,jsonb,jsonb,jsonb
) is
'C1.2 guarded Rail Logistics authority bridge. Requires active fixed Rail Pilot identity, writes exact immutable FUNCTIONAL_CONCLUSION authority record, then invokes B1 resolution_decide.';

commit;
