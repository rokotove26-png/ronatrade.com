begin;

create or replace function public.owner_price_updates_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
 v_actor uuid;
 v_current text;
 v_rows jsonb;
 v_history jsonb;
 v_cp jsonb;
 v_client boolean:=false;
 v_agent boolean:=false;
begin
 v_actor:=portal_private.owner_r1_actor('ADMIN');

 select s.source_reference,
        coalesce(bool_or(s.publish_client),false),
        coalesce(bool_or(s.publish_agent),false)
 into v_current,v_client,v_agent
 from portal_private.owner_price_snapshots s
 where s.business_status<>'SUPERSEDED'
 group by s.source_reference
 order by max(s.agreed_at) desc
 limit 1;

 select coalesce(
   jsonb_agg(
     jsonb_build_object(
       'proposalId',p.id,
       'coordinationRecordId',p.coordination_record_id,
       'basePublicationId',p.base_publication_id,
       'status',p.proposal_status,
       'reason',p.reason,
       'changes',p.changes,
       'sourceRefs',p.source_refs,
       'receivedFromRole',p.received_from_role,
       'receivedFromIdentity',p.received_from_identity,
       'receivedAt',p.received_at,
       'blocker',nullif(p.internal_context->>'error',''),
       'newPublicationId',np.publication_id,
       'appliedAt',p.applied_at,
       'rejectedAt',p.rejected_at,
       'rejectionReason',p.rejection_reason
     ) order by p.received_at desc
   ),
   '[]'::jsonb
 )
 into v_rows
 from portal_private.owner_price_change_proposals p
 left join portal_private.publications np on np.id=p.new_publication_key
 where p.proposal_status in ('UPDATE_AVAILABLE','BLOCKED');

 select coalesce(
   jsonb_agg(
     jsonb_build_object(
       'proposalId',p.id,
       'basePublicationId',p.base_publication_id,
       'status',p.proposal_status,
       'reason',p.reason,
       'receivedAt',p.received_at,
       'appliedAt',p.applied_at,
       'rejectedAt',p.rejected_at,
       'rejectionReason',p.rejection_reason,
       'newPublicationId',np.publication_id
     ) order by coalesce(p.applied_at,p.rejected_at,p.updated_at) desc
   ),
   '[]'::jsonb
 )
 into v_history
 from (
   select *
   from portal_private.owner_price_change_proposals
   where proposal_status in ('APPLIED','REJECTED','SUPERSEDED')
   order by updated_at desc
   limit 20
 ) p
 left join portal_private.publications np on np.id=p.new_publication_key;

 select coalesce(
   jsonb_agg(
     jsonb_build_object(
       'cpId',q.cp_id,
       'status',q.status,
       'version',q.version,
       'publicationId',q.publication_id,
       'agentId',q.agent_legal_entity_id,
       'agentName',q.legal_name,
       'documentId',q.document_id,
       'fileName',q.authoritative_filename,
       'sha256',q.sha256,
       'generatedAt',q.generated_at,
       'ownerReviewedAt',q.owner_reviewed_at,
       'sentAt',q.sent_at
     ) order by q.updated_at desc
   ),
   '[]'::jsonb
 )
 into v_cp
 from (
   select c.cp_id,
          c.status,
          c.version,
          p.publication_id,
          a.agent_legal_entity_id,
          a.legal_name,
          d.document_id,
          d.authoritative_filename,
          dv.sha256,
          c.generated_at,
          c.owner_reviewed_at,
          c.sent_at,
          c.updated_at
   from portal_private.owner_agent_commercial_proposals c
   join portal_private.publications p on p.id=c.publication_key
   join portal_private.agent_legal_entities a on a.id=c.agent_legal_entity_key
   left join portal_private.documents d on d.id=c.document_key
   left join portal_private.document_versions dv
     on dv.id=d.current_version_id
    and dv.is_current
    and dv.is_effective
   where c.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
     and p.publication_id=v_current
   order by c.updated_at desc
   limit 50
 ) q;

 return jsonb_build_object(
   'generatedAt',now(),
   'currentPublicationId',v_current,
   'clientEnabled',v_client,
   'agentEnabled',v_agent,
   'updateAvailableCount',(
      select count(*)
      from portal_private.owner_price_change_proposals
      where proposal_status='UPDATE_AVAILABLE'
   ),
   'proposals',v_rows,
   'history',v_history,
   'agentCommercialProposals',v_cp
 );
end
$function$;

commit;
