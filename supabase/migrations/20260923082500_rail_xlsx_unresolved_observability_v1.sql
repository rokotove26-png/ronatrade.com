-- ONLINE RAIL C1.2 — unresolved XLSX observability without authority bypass
begin;

create or replace function portal_private.rona_rail_deal_map_read_model_core_v2(
  p_deal_key uuid default null,
  p_deal_id text default null
)
returns jsonb
language plpgsql
stable
set search_path=pg_catalog,portal_private
as $fn$
declare
  v_base jsonb;
  v_out jsonb:='[]'::jsonb;
  v_deal jsonb;
  v_key uuid;
  v_unresolved jsonb;
  v_unresolved_count integer;
  v_existing_attention integer;
begin
  v_base:=portal_private.rona_rail_deal_map_read_model_core_v1(p_deal_key,p_deal_id);

  for v_deal in
    select value from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb))
  loop
    v_key:=nullif(v_deal->>'dealKey','')::uuid;

    v_deal:=jsonb_set(
      v_deal,
      '{routeCohorts}',
      case
        when v_key is null then '[]'::jsonb
        else portal_private.rail_deal_route_cohorts_v1(v_key)
      end,
      true
    );

    v_unresolved:='[]'::jsonb;
    v_unresolved_count:=0;

    if v_key is not null then
      with source_scope as (
        select
          e.source_object_id,
          min(e.effective_deal_key::text) filter (
            where e.overlay_resolution_status='MATCHED'
              and e.effective_deal_key is not null
          )::uuid as scope_deal_key,
          min(e.effective_rail_document_key::text) filter (
            where e.overlay_resolution_status='MATCHED'
              and e.effective_rail_document_key is not null
          )::uuid as scope_rail_document_key,
          count(distinct e.effective_deal_key) filter (
            where e.overlay_resolution_status='MATCHED'
              and e.effective_deal_key is not null
          ) as matched_deal_count,
          count(distinct e.effective_rail_document_key) filter (
            where e.overlay_resolution_status='MATCHED'
              and e.effective_rail_document_key is not null
          ) as matched_document_count,
          count(*) filter (where e.overlay_resolution_status='TO_VERIFY') as unresolved_count
        from portal_private.rail_xlsx_resolution_effective_v1 e
        group by e.source_object_id
      ),
      unresolved as (
        select
          e.id as evidence_event_id,
          e.wagon_number,
          e.source_object_id,
          e.import_batch_id,
          e.source_checksum_sha256,
          e.source_sheet_name,
          e.source_row_number,
          e.source_row_locator,
          e.source_row_fingerprint,
          e.source_policy,
          e.source_contract_version,
          e.source_received_at,
          e.overlay_resolution_status,
          s.scope_deal_key,
          s.scope_rail_document_key
        from portal_private.rail_xlsx_resolution_effective_v1 e
        join source_scope s on s.source_object_id=e.source_object_id
        where e.overlay_resolution_status='TO_VERIFY'
          and s.unresolved_count>0
          and s.matched_deal_count=1
          and s.matched_document_count=1
          and s.scope_deal_key=v_key
      )
      select
        coalesce(jsonb_agg(
          jsonb_build_object(
            'evidenceEventId',u.evidence_event_id,
            'wagonNumber',u.wagon_number,
            'sourceObjectId',u.source_object_id,
            'importBatchId',u.import_batch_id,
            'sourceChecksumSha256',u.source_checksum_sha256,
            'sourceSheetName',u.source_sheet_name,
            'sourceRowNumber',u.source_row_number,
            'sourceRowLocator',u.source_row_locator,
            'sourceRowFingerprint',u.source_row_fingerprint,
            'sourcePolicy',u.source_policy,
            'sourceContractVersion',u.source_contract_version,
            'sourceReceivedAt',u.source_received_at,
            'resolutionStatus',u.overlay_resolution_status,
            'observabilityDealKey',u.scope_deal_key,
            'observabilityRailDocumentKey',u.scope_rail_document_key,
            'observabilityScopeReason','SAME_SOURCE_SINGLE_MATCHED_DEAL_DOCUMENT',
            'authorityUsed',false,
            'resolutionApplied',false
          )
          order by u.source_received_at,u.source_row_number,u.evidence_event_id
        ),'[]'::jsonb),
        count(*)::integer
      into v_unresolved,v_unresolved_count
      from unresolved u;
    end if;

    v_existing_attention:=coalesce(nullif(v_deal->>'unresolvedOrConflictCount','')::integer,0);
    v_deal:=jsonb_set(v_deal,'{unresolvedEvidence}',v_unresolved,true);
    v_deal:=jsonb_set(v_deal,'{unresolvedEvidenceCount}',to_jsonb(v_unresolved_count),true);
    v_deal:=jsonb_set(
      v_deal,
      '{unresolvedOrConflictCount}',
      to_jsonb(v_existing_attention+v_unresolved_count),
      true
    );

    v_out:=v_out||jsonb_build_array(v_deal);
  end loop;

  v_base:=jsonb_set(v_base,'{deals}',v_out,true);
  v_base:=jsonb_set(
    v_base,
    '{routeCohortContractVersion}',
    to_jsonb('RAIL_ROUTE_COHORTS_V1'::text),
    true
  );
  v_base:=jsonb_set(
    v_base,
    '{unresolvedObservabilityContractVersion}',
    to_jsonb('RAIL_XLSX_UNRESOLVED_OBSERVABILITY_V1'::text),
    true
  );
  return v_base;
end
$fn$;

revoke all on function portal_private.rona_rail_deal_map_read_model_core_v2(uuid,text)
  from public,anon,authenticated;
grant execute on function portal_private.rona_rail_deal_map_read_model_core_v2(uuid,text)
  to service_role;

commit;
