begin;

create or replace function public.owner_agent_cp_owner_gate_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
  v_actor uuid;
  v_publication_key uuid;
  v_publication_id text;
  v_cps jsonb := '[]'::jsonb;
  v_proposals jsonb := '[]'::jsonb;
begin
  v_actor := portal_private.owner_r1_actor('ADMIN');

  select p.id,p.publication_id
    into v_publication_key,v_publication_id
  from portal_private.publications p
  where p.publication_type='PRICE'::portal_private.publication_type_enum
    and p.status='PUBLISHED'::portal_private.publication_status_enum
    and p.authority_state='CONFIRMED'::portal_private.authority_state_enum
    and p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  order by coalesce(p.published_at,p.approved_at,p.updated_at) desc
  limit 1;

  if v_publication_key is null then
    return jsonb_build_object('generatedAt',now(),'currentPublicationId',null,'commercialProposals','[]'::jsonb,'ownerReviewProposals','[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'cpId',c.cp_id,'status',c.status,'version',c.version,'publicationId',p.publication_id,
      'agentId',a.agent_legal_entity_id,'agentName',a.legal_name,'generatedAt',c.generated_at,
      'ownerReviewedAt',c.owner_reviewed_at,'sentAt',c.sent_at,'sha256',so.sha256
    ) order by a.legal_name,c.updated_at desc),'[]'::jsonb)
    into v_cps
  from portal_private.owner_agent_commercial_proposals c
  join portal_private.publications p on p.id=c.publication_key
  join portal_private.agent_legal_entities a on a.id=c.agent_legal_entity_key
  left join portal_private.storage_objects so on so.id=c.storage_object_key
  where c.publication_key=v_publication_key
    and c.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and c.status in ('REQUESTED','GENERATED','OWNER_REVIEWED','SENT','BLOCKED');

  select coalesce(jsonb_agg(jsonb_build_object(
      'recordId',r.record_id,'status',r.status,'publicationId',r.target_id,'reason',r.payload->>'reason',
      'fileName',coalesce(r.payload->'proposed_state'->>'filename','RONA-AGENT-CP-2026-001.pdf'),
      'sha256',r.payload->'proposed_state'->>'pdf_sha256','canonicalMasterId',r.payload->'proposed_state'->>'canonical_master_id',
      'createdAt',r.created_at,'sourceRefs',r.source_refs
    ) order by r.created_at desc),'[]'::jsonb)
    into v_proposals
  from portal_private.ai_coordination_records r
  where r.record_type='BUSINESS_CHANGE_PROPOSAL'
    and r.functional_role='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum
    and r.target_type='PUBLICATION'
    and r.target_id=v_publication_id
    and r.status='PROPOSED'
    and coalesce(r.qa_only,false)=false
    and r.payload->>'proposed_action'='PREPARE_AGENT_CP'
    and coalesce(r.payload->'proposed_state'->>'canonical_master_id','')='RONA-AGENT-CP-2026-001'
    and coalesce(r.payload->'proposed_state'->>'pdf_base64','')<>''
    and not exists (
      select 1 from portal_private.audit_events ae
      where (ae.action='OWNER_AGENT_CP_RETURNED_FOR_REVISION' and ae.metadata->>'coordinationRecordId'=r.record_id::text)
         or (ae.action='OWNER_COMMAND_AGENT_CP_PUBLICATION_SENT' and ae.metadata->>'owner_command_id'='CP-GATE:'||r.record_id::text)
    );

  return jsonb_build_object('generatedAt',now(),'currentPublicationId',v_publication_id,'commercialProposals',v_cps,'ownerReviewProposals',v_proposals);
end
$function$;

create or replace function public.owner_agent_cp_owner_gate_material(p_coordination_record_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
  v_actor uuid;
  v_publication_id text;
  v_state jsonb;
  v_source_refs jsonb;
  v_evidence_refs jsonb;
  v_b64 text;
  v_pdf bytea;
  v_sha text;
  v_declared_sha text;
  v_filename text;
  v_plan jsonb;
  v_standard_master text;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');

  select r.target_id,r.payload->'proposed_state',coalesce(r.source_refs,'[]'::jsonb),coalesce(r.evidence_refs,'[]'::jsonb)
    into v_publication_id,v_state,v_source_refs,v_evidence_refs
  from portal_private.ai_coordination_records r
  join portal_private.publications p on p.publication_id=r.target_id
  where r.record_id=p_coordination_record_id
    and r.record_type='BUSINESS_CHANGE_PROPOSAL'
    and r.functional_role='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum
    and r.target_type='PUBLICATION'
    and r.status='PROPOSED'
    and coalesce(r.qa_only,false)=false
    and r.payload->>'proposed_action'='PREPARE_AGENT_CP'
    and p.publication_type='PRICE'::portal_private.publication_type_enum
    and p.status='PUBLISHED'::portal_private.publication_status_enum
    and p.authority_state='CONFIRMED'::portal_private.authority_state_enum
    and p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  limit 1;
  if v_publication_id is null then raise exception 'AGENT_CP_PROPOSAL_NOT_CURRENT'; end if;

  select rules->'commercial_proposal'->>'master_id'
    into v_standard_master
  from portal_private.owner_canonical_document_standards
  where standard_key='RONA-DOC-STANDARD' and status='ACTIVE'
  order by version desc limit 1;
  if coalesce(v_standard_master,'')<>'RONA-AGENT-CP-2026-001' then raise exception 'CANONICAL_STANDARD_NOT_ACTIVE'; end if;
  if coalesce(v_state->>'canonical_master_id','')<>v_standard_master then raise exception 'CANONICAL_MASTER_MISMATCH'; end if;

  v_b64:=regexp_replace(coalesce(v_state->>'pdf_base64',''),E'\\s','','g');
  v_b64:=regexp_replace(v_b64,'=+$','','g');
  if v_b64='' or length(v_b64)%4=1 then raise exception 'CP_PDF_BASE64_INVALID'; end if;
  v_b64:=v_b64||repeat('=',(4-length(v_b64)%4)%4);
  begin
    v_pdf:=decode(v_b64,'base64');
  exception when others then
    raise exception 'CP_PDF_BASE64_INVALID';
  end;
  if octet_length(v_pdf)<5 or octet_length(v_pdf)>524288 then raise exception 'CP_PDF_SIZE_INVALID'; end if;
  if encode(substring(v_pdf from 1 for 5),'escape')<>'%PDF-' then raise exception 'CP_PDF_INVALID'; end if;
  v_sha:=encode(digest(v_pdf,'sha256'),'hex');
  v_declared_sha:=lower(coalesce(v_state->>'pdf_sha256',''));
  if v_declared_sha<>'' and v_declared_sha<>v_sha then raise exception 'CP_PDF_SHA256_MISMATCH'; end if;
  v_filename:=left(coalesce(nullif(btrim(v_state->>'filename'),''),'RONA-AGENT-CP-2026-001.pdf'),180);
  v_plan:=public.owner_agent_cp_delivery_plan(v_publication_id);

  return jsonb_build_object(
    'coordinationRecordId',p_coordination_record_id,'publicationId',v_publication_id,'canonicalMasterId',v_standard_master,
    'filename',v_filename,'pdfBase64',rtrim(v_b64,'='),'sha256',v_sha,'byteSize',octet_length(v_pdf),
    'items',coalesce(v_plan->'items','[]'::jsonb),'sourceRefs',v_source_refs||v_evidence_refs
  );
end
$function$;

create or replace function public.owner_agent_cp_return_for_revision(p_coordination_record_id uuid,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
  v_actor uuid;
  v_publication_id text;
  v_req uuid:=gen_random_uuid();
  v_reason text:=left(coalesce(nullif(btrim(p_reason),''),'Возвращено владельцем на доработку'),2000);
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  select r.target_id into v_publication_id
  from portal_private.ai_coordination_records r
  join portal_private.publications p on p.publication_id=r.target_id
  where r.record_id=p_coordination_record_id
    and r.record_type='BUSINESS_CHANGE_PROPOSAL'
    and r.functional_role='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum
    and r.target_type='PUBLICATION'
    and r.status='PROPOSED'
    and r.payload->>'proposed_action'='PREPARE_AGENT_CP'
    and p.status='PUBLISHED'::portal_private.publication_status_enum
    and p.authority_state='CONFIRMED'::portal_private.authority_state_enum
    and p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  limit 1;
  if v_publication_id is null then raise exception 'AGENT_CP_PROPOSAL_NOT_CURRENT'; end if;
  if not exists(select 1 from portal_private.audit_events ae where ae.action='OWNER_AGENT_CP_RETURNED_FOR_REVISION' and ae.metadata->>'coordinationRecordId'=p_coordination_record_id::text) then
    insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,metadata)
    values(v_actor,'ADMIN','OWNER_AGENT_CP_RETURNED_FOR_REVISION','AGENT_CP_PROPOSAL',p_coordination_record_id::text,v_req,
      jsonb_build_object('coordinationRecordId',p_coordination_record_id,'publicationId',v_publication_id,'reason',v_reason));
  end if;
  return jsonb_build_object('recordId',p_coordination_record_id,'status','RETURNED_FOR_REVISION','reason',v_reason);
end
$function$;

create or replace function public.agent_current_commercial_proposals()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
  v_actor uuid;
  v_publication_key uuid;
  v_publication_id text;
  v_items jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('AGENT');
  select p.id,p.publication_id into v_publication_key,v_publication_id
  from portal_private.publications p
  where p.publication_type='PRICE'::portal_private.publication_type_enum
    and p.status='PUBLISHED'::portal_private.publication_status_enum
    and p.authority_state='CONFIRMED'::portal_private.authority_state_enum
    and p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  order by coalesce(p.published_at,p.approved_at,p.updated_at) desc limit 1;
  if v_publication_key is null then return jsonb_build_object('currentPublicationId',null,'commercialProposals','[]'::jsonb); end if;

  select coalesce(jsonb_agg(jsonb_build_object('cpId',cp.cp_id,'publicationId',v_publication_id,'agentId',ale.agent_legal_entity_id,'agentName',ale.legal_name,'sentAt',cp.sent_at,'sha256',so.sha256) order by cp.sent_at desc),'[]'::jsonb)
    into v_items
  from portal_private.owner_agent_commercial_proposals cp
  join portal_private.agent_legal_entities ale on ale.id=cp.agent_legal_entity_key
  join portal_private.storage_objects so on so.id=cp.storage_object_key
  where cp.publication_key=v_publication_key
    and cp.status='SENT'
    and cp.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and so.storage_state='VERIFIED'
    and portal_private.agent_can_read_cp_storage(auth.uid(),so.object_name);
  return jsonb_build_object('currentPublicationId',v_publication_id,'commercialProposals',v_items);
end
$function$;

create or replace function public.agent_cp_download_plan(p_cp_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
  v_actor uuid;
  v_object_name text;
  v_publication_id text;
begin
  v_actor:=portal_private.owner_r1_actor('AGENT');
  select so.object_name,p.publication_id into v_object_name,v_publication_id
  from portal_private.owner_agent_commercial_proposals cp
  join portal_private.publications p on p.id=cp.publication_key
  join portal_private.storage_objects so on so.id=cp.storage_object_key
  where cp.cp_id=p_cp_id
    and cp.status='SENT'
    and cp.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and p.status='PUBLISHED'::portal_private.publication_status_enum
    and p.authority_state='CONFIRMED'::portal_private.authority_state_enum
    and p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and so.storage_state='VERIFIED'
    and portal_private.agent_can_read_cp_storage(auth.uid(),so.object_name)
  limit 1;
  if v_object_name is null then raise exception 'AGENT_CP_NOT_FOUND'; end if;
  return jsonb_build_object('cpId',p_cp_id,'publicationId',v_publication_id,'bucketId','rona-portal-private','objectName',v_object_name);
end
$function$;

create or replace function portal_private.owner_admin_can_write_agent_cp_storage(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
  select exists(
    select 1
    from portal_private.resolve_portal_auth(auth.uid(),auth.jwt()->>'session_id') a
    join portal_private.publications p on p.publication_id=split_part(p_object_name,'/',2)
    join portal_private.agent_legal_entities ale on ale.agent_legal_entity_id=split_part(p_object_name,'/',3)
    join portal_private.owner_agent_commercial_proposals cp on cp.publication_key=p.id and cp.agent_legal_entity_key=ale.id
    where a.session_allowed and 'ADMIN'=any(a.roles)
      and split_part(p_object_name,'/',1)='agent-commercial-proposals'
      and split_part(p_object_name,'/',4)='current.pdf'
      and split_part(p_object_name,'/',5)=''
      and p.publication_type='PRICE'::portal_private.publication_type_enum
      and p.status='PUBLISHED'::portal_private.publication_status_enum
      and p.authority_state='CONFIRMED'::portal_private.authority_state_enum
      and p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and cp.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and cp.status in ('REQUESTED','GENERATED','OWNER_REVIEWED','SENT')
  );
$function$;

revoke all on function public.owner_agent_cp_owner_gate_bootstrap() from public;
revoke all on function public.owner_agent_cp_owner_gate_material(uuid) from public;
revoke all on function public.owner_agent_cp_return_for_revision(uuid,text) from public;
revoke all on function public.agent_current_commercial_proposals() from public;
revoke all on function public.agent_cp_download_plan(text) from public;
revoke all on function portal_private.owner_admin_can_write_agent_cp_storage(text) from public;
revoke execute on function public.owner_agent_cp_owner_gate_bootstrap() from anon;
revoke execute on function public.owner_agent_cp_owner_gate_material(uuid) from anon;
revoke execute on function public.owner_agent_cp_return_for_revision(uuid,text) from anon;
revoke execute on function public.agent_current_commercial_proposals() from anon;
revoke execute on function public.agent_cp_download_plan(text) from anon;
revoke execute on function portal_private.owner_admin_can_write_agent_cp_storage(text) from anon;
grant execute on function public.owner_agent_cp_owner_gate_bootstrap() to authenticated,service_role;
grant execute on function public.owner_agent_cp_owner_gate_material(uuid) to authenticated,service_role;
grant execute on function public.owner_agent_cp_return_for_revision(uuid,text) to authenticated,service_role;
grant execute on function public.agent_current_commercial_proposals() to authenticated,service_role;
grant execute on function public.agent_cp_download_plan(text) to authenticated,service_role;
grant execute on function portal_private.owner_admin_can_write_agent_cp_storage(text) to authenticated,service_role;

revoke execute on function public.owner_agent_cp_delivery_plan(text) from anon;
revoke execute on function public.owner_agent_cp_materialize_and_send(text,text,bigint,text,jsonb,text,jsonb) from anon;
revoke execute on function public.owner_prices_agent_cp_request(text) from anon;
grant execute on function public.owner_agent_cp_delivery_plan(text) to authenticated,service_role;
grant execute on function public.owner_agent_cp_materialize_and_send(text,text,bigint,text,jsonb,text,jsonb) to authenticated,service_role;
grant execute on function public.owner_prices_agent_cp_request(text) to authenticated,service_role;

drop policy if exists rona_admin_agent_cp_insert on storage.objects;
drop policy if exists rona_admin_agent_cp_update on storage.objects;
drop policy if exists rona_admin_agent_cp_select on storage.objects;
create policy rona_admin_agent_cp_insert on storage.objects for insert to authenticated with check (bucket_id='rona-portal-private' and portal_private.owner_admin_can_write_agent_cp_storage(name));
create policy rona_admin_agent_cp_update on storage.objects for update to authenticated using (bucket_id='rona-portal-private' and portal_private.owner_admin_can_write_agent_cp_storage(name)) with check (bucket_id='rona-portal-private' and portal_private.owner_admin_can_write_agent_cp_storage(name));
create policy rona_admin_agent_cp_select on storage.objects for select to authenticated using (bucket_id='rona-portal-private' and portal_private.owner_admin_can_write_agent_cp_storage(name));

commit;
