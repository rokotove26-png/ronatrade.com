-- ONLINE RAIL — automatic stable source-stream inheritance for future XLSX snapshots
-- Systemic follow-up to 20260921124500_rail_xlsx_stable_source_stream_domain_v1.
--
-- Problem fixed here:
--   the prior repair created a stable stream but bound only the two then-known source objects.
--   Every newly captured XLSX remained file-scoped until another manual source-stream decision,
--   so the next fully trusted snapshot could recreate CROSS_DOMAIN_AMBIGUOUS.
--
-- Safety / authority:
--   * no filename, station, route or cargo similarity is used;
--   * a source becomes eligible only after ALL effective rows are MATCHED;
--   * all rows must resolve to exactly one ACTIVE Deal + one ACTIVE rail document;
--   * inheritance is allowed only when exactly one prior BOUND stream exists for that exact
--     Deal/document and the same canonical source policy/contract;
--   * zero or multiple prior streams remain fail-closed;
--   * source events and authority decisions remain append-only;
--   * the existing projection writer is invoked only after an unambiguous stream bind.

begin;

create or replace function portal_private.rail_xlsx_source_stream_autobind_v1(
  p_source_object_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,portal_private,extensions
as $fn$
declare
  v_source portal_private.source_objects%rowtype;
  v_existing portal_private.rail_xlsx_source_stream_effective_v1%rowtype;
  v_event_count integer:=0;
  v_matched_count integer:=0;
  v_deal_count integer:=0;
  v_doc_count integer:=0;
  v_deal_key uuid;
  v_rail_document_key uuid;
  v_stream_count integer:=0;
  v_stream_key text;
  v_prior_source_count integer:=0;
  v_reason jsonb;
  v_provenance jsonb;
  v_fp text;
  v_decision_id uuid;
  v_projection jsonb;
begin
  if p_source_object_id is null then
    raise exception using errcode='22023', message='RAIL_XLSX_STREAM_AUTOBIND_SOURCE_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('RAIL_XLSX_STREAM_AUTOBIND|'||p_source_object_id::text,0)
  );

  select * into v_source
  from portal_private.source_objects
  where id=p_source_object_id;

  if not found then
    raise exception using errcode='23503', message='RAIL_XLSX_STREAM_AUTOBIND_SOURCE_NOT_FOUND';
  end if;

  if v_source.source_system<>'RAIL_AI'
     or v_source.source_object_type<>'XLSX_WAGON_DISLOCATION'
     or coalesce(v_source.source_version,'')<>'RAIL_XLSX_DISLOCATION_V1'
     or coalesce(v_source.raw_snapshot->>'sourcePolicy','')<>'EXPEDITOR_XLSX_VIA_RAIL_AI'
     or coalesce(v_source.raw_snapshot->>'sourceContractVersion','')<>'RAIL_XLSX_DISLOCATION_CONTRACT_V1' then
    return jsonb_build_object(
      'outcome','NOT_ELIGIBLE_SOURCE_CONTRACT',
      'sourceObjectId',p_source_object_id
    );
  end if;

  select * into v_existing
  from portal_private.rail_xlsx_source_stream_effective_v1
  where source_object_id=p_source_object_id;

  if found then
    if v_existing.decision_state='BOUND' and v_existing.stream_key is not null then
      return jsonb_build_object(
        'outcome','ALREADY_BOUND',
        'sourceObjectId',p_source_object_id,
        'streamKey',v_existing.stream_key,
        'decisionId',v_existing.id
      );
    end if;

    return jsonb_build_object(
      'outcome','BLOCKED_BY_EXISTING_STREAM_DECISION',
      'sourceObjectId',p_source_object_id,
      'decisionState',v_existing.decision_state,
      'decisionId',v_existing.id
    );
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where e.overlay_resolution_status='MATCHED'
        and e.effective_deal_key is not null
        and e.effective_rail_document_key is not null
    )::integer,
    count(distinct e.effective_deal_key) filter (
      where e.effective_deal_key is not null
    )::integer,
    count(distinct e.effective_rail_document_key) filter (
      where e.effective_rail_document_key is not null
    )::integer
  into v_event_count,v_matched_count,v_deal_count,v_doc_count
  from portal_private.rail_xlsx_resolution_effective_v1 e
  where e.source_object_id=p_source_object_id;

  if v_event_count=0 then
    return jsonb_build_object(
      'outcome','WAITING_FOR_SOURCE_EVENTS',
      'sourceObjectId',p_source_object_id
    );
  end if;

  if v_matched_count<>v_event_count or v_deal_count<>1 or v_doc_count<>1 then
    return jsonb_build_object(
      'outcome','WAITING_FOR_UNAMBIGUOUS_FULL_MATCH',
      'sourceObjectId',p_source_object_id,
      'eventCount',v_event_count,
      'matchedCount',v_matched_count,
      'dealCount',v_deal_count,
      'railDocumentCount',v_doc_count
    );
  end if;

  select e.effective_deal_key,e.effective_rail_document_key
    into v_deal_key,v_rail_document_key
  from portal_private.rail_xlsx_resolution_effective_v1 e
  where e.source_object_id=p_source_object_id
  limit 1;

  if not exists (
    select 1
    from portal_private.rail_documents rd
    join portal_private.deals d on d.id=rd.deal_key
    where rd.id=v_rail_document_key
      and rd.deal_key=v_deal_key
      and rd.lifecycle_state::text='ACTIVE'
      and d.lifecycle_state::text='ACTIVE'
  ) then
    return jsonb_build_object(
      'outcome','BLOCKED_INACTIVE_DEAL_OR_DOCUMENT',
      'sourceObjectId',p_source_object_id,
      'dealKey',v_deal_key,
      'railDocumentKey',v_rail_document_key
    );
  end if;

  with prior_fully_matched_same_scope as (
    select e.source_object_id
    from portal_private.rail_xlsx_resolution_effective_v1 e
    where e.source_object_id<>p_source_object_id
    group by e.source_object_id
    having count(*)>0
       and count(*)=count(*) filter (
         where e.overlay_resolution_status='MATCHED'
           and e.effective_deal_key=v_deal_key
           and e.effective_rail_document_key=v_rail_document_key
       )
  )
  select
    count(distinct ss.stream_key)::integer,
    min(ss.stream_key),
    count(distinct ss.source_object_id)::integer
  into v_stream_count,v_stream_key,v_prior_source_count
  from prior_fully_matched_same_scope p
  join portal_private.rail_xlsx_source_stream_effective_v1 ss
    on ss.source_object_id=p.source_object_id
   and ss.decision_state='BOUND'
   and ss.stream_key is not null
  join portal_private.source_objects ps
    on ps.id=p.source_object_id
  where ps.source_system=v_source.source_system
    and ps.source_object_type=v_source.source_object_type
    and coalesce(ps.source_version,'')=coalesce(v_source.source_version,'')
    and coalesce(ps.raw_snapshot->>'sourcePolicy','')=
        coalesce(v_source.raw_snapshot->>'sourcePolicy','')
    and coalesce(ps.raw_snapshot->>'sourceContractVersion','')=
        coalesce(v_source.raw_snapshot->>'sourceContractVersion','');

  if v_stream_count=0 then
    return jsonb_build_object(
      'outcome','NO_PRIOR_BOUND_STREAM',
      'sourceObjectId',p_source_object_id,
      'dealKey',v_deal_key,
      'railDocumentKey',v_rail_document_key
    );
  end if;

  if v_stream_count<>1 or v_stream_key is null then
    return jsonb_build_object(
      'outcome','AMBIGUOUS_PRIOR_STREAMS',
      'sourceObjectId',p_source_object_id,
      'dealKey',v_deal_key,
      'railDocumentKey',v_rail_document_key,
      'streamCount',v_stream_count
    );
  end if;

  v_reason:=jsonb_build_object(
    'reason','Fully matched source inherits the single existing trusted stream for the exact active Deal/document scope.',
    'derivation','FULL_SOURCE_MATCHED_SINGLE_DEAL_DOCUMENT_SINGLE_PRIOR_BOUND_STREAM',
    'sourceObjectId',p_source_object_id,
    'sourceChecksumSha256',lower(v_source.checksum_sha256),
    'dealKey',v_deal_key,
    'railDocumentKey',v_rail_document_key,
    'eventCount',v_event_count,
    'priorBoundSourceCount',v_prior_source_count,
    'inheritedStreamKey',v_stream_key,
    'sourcePolicy',v_source.raw_snapshot->>'sourcePolicy',
    'sourceContractVersion',v_source.raw_snapshot->>'sourceContractVersion',
    'filenameUsed',false,
    'stationSimilarityUsed',false,
    'routeSimilarityUsed',false,
    'cargoSimilarityUsed',false
  );

  v_provenance:=jsonb_build_object(
    'automationContract','RAIL_XLSX_STREAM_AUTOBIND_V1',
    'comparisonPolicy','STABLE_SOURCE_STREAM_NOT_FILE_SHA',
    'technicalAuthority','RAIL_LOGISTICS_VERIFIED_DECISION',
    'appendOnlyHistoryPreserved',true,
    'railWagonsManualWrite',false,
    'projectionRefresh','RAIL_XLSX_WAGON_PROJECTION_V1'
  );

  v_fp:=encode(
    extensions.digest(
      convert_to(
        concat_ws(
          E'\x1f',
          p_source_object_id::text,
          'BOUND',
          v_stream_key,
          'RAIL_LOGISTICS_VERIFIED_DECISION',
          'AUTO:RAIL_XLSX_STREAM_AUTOBIND_V1',
          v_reason::text
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into portal_private.rail_xlsx_source_stream_decisions_v1 (
    source_object_id,decision_state,stream_key,authority_type,authority_ref,
    decided_at,reason_evidence,provenance,decision_fingerprint
  )
  values (
    p_source_object_id,
    'BOUND',
    v_stream_key,
    'RAIL_LOGISTICS_VERIFIED_DECISION',
    'AUTO:RAIL_XLSX_STREAM_AUTOBIND_V1',
    now(),
    v_reason,
    v_provenance,
    v_fp
  )
  returning id into v_decision_id;

  v_projection:=portal_private.rail_xlsx_refresh_wagon_projection_v1(v_deal_key);

  return jsonb_build_object(
    'outcome','BOUND_INHERITED_STREAM',
    'sourceObjectId',p_source_object_id,
    'streamKey',v_stream_key,
    'decisionId',v_decision_id,
    'dealKey',v_deal_key,
    'railDocumentKey',v_rail_document_key,
    'eventCount',v_event_count,
    'projection',v_projection
  );
end
$fn$;

revoke all on function portal_private.rail_xlsx_source_stream_autobind_v1(uuid)
  from public,anon,authenticated;
grant execute on function portal_private.rail_xlsx_source_stream_autobind_v1(uuid)
  to service_role;

comment on function portal_private.rail_xlsx_source_stream_autobind_v1(uuid) is
'Fail-closed automatic inheritance of a stable Rail XLSX comparison stream. Requires every source event MATCHED to one active Deal/document and exactly one prior bound stream for that exact scope; filename/station/route/cargo similarity are forbidden authority.';

create or replace function portal_private.rail_xlsx_resolution_stream_autobind_trigger_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,portal_private
as $fn$
declare
  v_source_object_id uuid;
begin
  select e.source_object_id
    into v_source_object_id
  from portal_private.rail_xlsx_dislocation_events_v1 e
  where e.id=new.evidence_event_id;

  if v_source_object_id is not null then
    perform portal_private.rail_xlsx_source_stream_autobind_v1(v_source_object_id);
  end if;

  return new;
end
$fn$;

revoke all on function portal_private.rail_xlsx_resolution_stream_autobind_trigger_v1()
  from public,anon,authenticated,service_role;

drop trigger if exists rail_xlsx_resolution_stream_autobind_v1
  on portal_private.rail_xlsx_resolution_decisions_v1;

create trigger rail_xlsx_resolution_stream_autobind_v1
after insert on portal_private.rail_xlsx_resolution_decisions_v1
for each row execute function portal_private.rail_xlsx_resolution_stream_autobind_trigger_v1();

-- Backfill every existing canonical source through the same generic fail-closed rule.
-- Already-bound sources are idempotent; ineligible/ambiguous sources remain untouched.
do $$
declare
  r record;
begin
  for r in
    select s.id
    from portal_private.source_objects s
    where s.source_system='RAIL_AI'
      and s.source_object_type='XLSX_WAGON_DISLOCATION'
      and coalesce(s.source_version,'')='RAIL_XLSX_DISLOCATION_V1'
    order by s.source_timestamp,s.id
  loop
    perform portal_private.rail_xlsx_source_stream_autobind_v1(r.id);
  end loop;
end
$$;

commit;
