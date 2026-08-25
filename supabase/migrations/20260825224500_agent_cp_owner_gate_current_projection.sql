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
    return jsonb_build_object(
      'generatedAt',now(),
      'currentPublicationId',null,
      'commercialProposals','[]'::jsonb,
      'ownerReviewProposals','[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'cpId',c.cp_id,
      'status',c.status,
      'version',c.version,
      'publicationId',p.publication_id,
      'agentId',a.agent_legal_entity_id,
      'agentName',a.legal_name,
      'documentId',d.document_id,
      'fileName',d.authoritative_filename,
      'sha256',dv.sha256,
      'generatedAt',c.generated_at,
      'ownerReviewedAt',c.owner_reviewed_at,
      'sentAt',c.sent_at
    ) order by a.legal_name,c.updated_at desc),'[]'::jsonb)
    into v_cps
  from portal_private.owner_agent_commercial_proposals c
  join portal_private.publications p on p.id=c.publication_key
  join portal_private.agent_legal_entities a on a.id=c.agent_legal_entity_key
  left join portal_private.documents d on d.id=c.document_key
  left join portal_private.document_versions dv
    on dv.id=d.current_version_id and dv.is_current and dv.is_effective
  where c.publication_key=v_publication_key
    and c.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and c.status in ('REQUESTED','GENERATED','OWNER_REVIEWED','SENT','BLOCKED');

  select coalesce(jsonb_agg(jsonb_build_object(
      'recordId',r.record_id,
      'status',r.status,
      'publicationId',r.target_id,
      'reason',r.payload->>'reason',
      'fileName',coalesce(r.payload->'proposed_state'->>'filename','RONA-AGENT-CP-2026-001.pdf'),
      'sha256',r.payload->'proposed_state'->>'pdf_sha256',
      'canonicalMasterId',r.payload->'proposed_state'->>'canonical_master_id',
      'createdAt',r.created_at,
      'sourceRefs',r.source_refs
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
      select 1
      from portal_private.audit_events ae
      where ae.action in ('OWNER_AGENT_CP_PUBLISHED','OWNER_AGENT_CP_RETURNED_FOR_REVISION')
        and ae.metadata->>'coordinationRecordId'=r.record_id::text
    );

  return jsonb_build_object(
    'generatedAt',now(),
    'currentPublicationId',v_publication_id,
    'commercialProposals',v_cps,
    'ownerReviewProposals',v_proposals
  );
end
$function$;

revoke all on function public.owner_agent_cp_owner_gate_bootstrap() from public;
revoke execute on function public.owner_agent_cp_owner_gate_bootstrap() from anon;
grant execute on function public.owner_agent_cp_owner_gate_bootstrap() to authenticated,service_role;

revoke execute on function public.owner_agent_cp_delivery_plan(text) from anon;
revoke execute on function public.owner_agent_cp_materialize_and_send(text,text,bigint,text,jsonb,text,jsonb) from anon;
revoke execute on function public.owner_prices_agent_cp_request(text) from anon;
grant execute on function public.owner_agent_cp_delivery_plan(text) to authenticated,service_role;
grant execute on function public.owner_agent_cp_materialize_and_send(text,text,bigint,text,jsonb,text,jsonb) to authenticated,service_role;
grant execute on function public.owner_prices_agent_cp_request(text) to authenticated,service_role;

commit;
