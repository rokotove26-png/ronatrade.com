begin;

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

  if coalesce(v_state->>'pdf_base64','')='STAGED:OWNER_AGENT_CP_UPLOAD_CHUNKS_ONCE' then
    select string_agg(chunk,'' order by seq)
      into v_b64
    from portal_private.owner_agent_cp_upload_chunks_once;
    if coalesce(v_b64,'')='' then raise exception 'CP_PDF_STAGED_ASSET_MISSING'; end if;
  else
    v_b64:=coalesce(v_state->>'pdf_base64','');
  end if;

  v_b64:=regexp_replace(v_b64,E'\\s','','g');
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
    'coordinationRecordId',p_coordination_record_id,
    'publicationId',v_publication_id,
    'canonicalMasterId',v_standard_master,
    'filename',v_filename,
    'pdfBase64',rtrim(v_b64,'='),
    'sha256',v_sha,
    'byteSize',octet_length(v_pdf),
    'items',coalesce(v_plan->'items','[]'::jsonb),
    'sourceRefs',v_source_refs||v_evidence_refs
  );
end
$function$;

revoke all on function public.owner_agent_cp_owner_gate_material(uuid) from public;
revoke execute on function public.owner_agent_cp_owner_gate_material(uuid) from anon;
grant execute on function public.owner_agent_cp_owner_gate_material(uuid) to authenticated,service_role;

commit;
