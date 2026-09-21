-- ONLINE RAIL — stable source-stream comparison domain v1
-- Owner-authorized production repair for repeated trusted XLSX snapshots.
--
-- Invariants:
--   * SHA-256 remains immutable file provenance only.
--   * local wall-clock observations become comparable across files ONLY when
--     their source objects are explicitly bound to the same trusted stream.
--   * unbound / different streams remain fail-closed and incomparable.
--   * event history and owner resolution history remain append-only.
--   * no rail_wagons rows are created or manually rewritten here.

begin;

create table if not exists portal_private.rail_xlsx_source_stream_decisions_v1 (
  id uuid primary key default gen_random_uuid(),
  source_object_id uuid not null
    references portal_private.source_objects(id)
    on delete restrict,
  decision_state text not null,
  stream_key text,
  authority_type text not null,
  authority_ref text not null,
  decided_at timestamptz not null default now(),
  reason_evidence jsonb not null,
  provenance jsonb not null,
  decision_fingerprint text not null,

  constraint rail_xlsx_source_stream_state_allowed
    check (decision_state in ('BOUND','REVOKED','CONFLICT')),
  constraint rail_xlsx_source_stream_bound_key_required
    check (
      (decision_state='BOUND' and stream_key is not null and btrim(stream_key)<>'')
      or
      (decision_state<>'BOUND' and stream_key is null)
    ),
  constraint rail_xlsx_source_stream_key_format
    check (
      stream_key is null
      or stream_key ~ '^EXPEDITOR_STREAM:[0-9a-f-]{36}$'
    ),
  constraint rail_xlsx_source_stream_authority_allowed
    check (authority_type in (
      'OWNER_EXPLICIT_INSTRUCTION',
      'RAIL_LOGISTICS_VERIFIED_DECISION',
      'OWNER_AUTHORIZED_SYSTEM_REPAIR'
    )),
  constraint rail_xlsx_source_stream_authority_ref_required
    check (btrim(authority_ref)<>''),
  constraint rail_xlsx_source_stream_reason_required
    check (jsonb_typeof(reason_evidence)='object' and reason_evidence<>'{}'::jsonb),
  constraint rail_xlsx_source_stream_provenance_required
    check (jsonb_typeof(provenance)='object' and provenance<>'{}'::jsonb),
  constraint rail_xlsx_source_stream_fingerprint_format
    check (decision_fingerprint ~ '^[0-9a-f]{64}$')
);

create unique index if not exists rail_xlsx_source_stream_decision_dedupe_v1
  on portal_private.rail_xlsx_source_stream_decisions_v1
  (source_object_id,decision_fingerprint);

create index if not exists rail_xlsx_source_stream_latest_v1
  on portal_private.rail_xlsx_source_stream_decisions_v1
  (source_object_id,decided_at desc,id desc);

create index if not exists rail_xlsx_source_stream_key_v1
  on portal_private.rail_xlsx_source_stream_decisions_v1
  (stream_key)
  where decision_state='BOUND';

alter table portal_private.rail_xlsx_source_stream_decisions_v1 enable row level security;

drop policy if exists rona_server_bypass_guard
  on portal_private.rail_xlsx_source_stream_decisions_v1;
create policy rona_server_bypass_guard
  on portal_private.rail_xlsx_source_stream_decisions_v1
  for all to authenticated
  using (false) with check (false);

revoke all on table portal_private.rail_xlsx_source_stream_decisions_v1
  from public,anon,authenticated,service_role;
grant select on table portal_private.rail_xlsx_source_stream_decisions_v1
  to service_role;

drop trigger if exists rail_xlsx_source_stream_append_only_v1
  on portal_private.rail_xlsx_source_stream_decisions_v1;
create trigger rail_xlsx_source_stream_append_only_v1
before update or delete on portal_private.rail_xlsx_source_stream_decisions_v1
for each row execute function portal_private.rail_xlsx_append_only_guard_v1();

create or replace view portal_private.rail_xlsx_source_stream_effective_v1
with (security_invoker=false)
as
select distinct on (d.source_object_id)
  d.id,
  d.source_object_id,
  d.decision_state,
  d.stream_key,
  d.authority_type,
  d.authority_ref,
  d.decided_at,
  d.reason_evidence,
  d.provenance,
  d.decision_fingerprint
from portal_private.rail_xlsx_source_stream_decisions_v1 d
order by d.source_object_id,d.decided_at desc,d.id desc;

revoke all on table portal_private.rail_xlsx_source_stream_effective_v1
  from public,anon,authenticated;
grant select on table portal_private.rail_xlsx_source_stream_effective_v1
  to service_role;

comment on table portal_private.rail_xlsx_source_stream_decisions_v1 is
'Append-only authority decisions binding a captured XLSX source object to a stable trusted expeditor stream. SHA-256 is provenance, never stream identity.';

comment on view portal_private.rail_xlsx_source_stream_effective_v1 is
'Latest explicit source-stream decision per XLSX source object. Only BOUND decisions may collapse local-time comparison domains.';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from portal_private.source_objects s
  where s.source_system='RAIL_AI'
    and s.source_object_type='XLSX_WAGON_DISLOCATION'
    and coalesce(s.source_version,'')='RAIL_XLSX_DISLOCATION_V1'
    and lower(s.checksum_sha256) in (
      'bc7429db2fbc411cb43607c54f87b824d4c8ad928353914c6e94c935870d5cc5',
      '42780329ea8df93ca4660a69d2788788dfe73ddaeed95ef624d27b114892e944'
    );

  if v_count<>2 then
    raise exception using
      errcode='23514',
      message='RAIL_XLSX_SOURCE_STREAM_REPAIR_SOURCE_SET_MISMATCH';
  end if;
end
$$;

with target_sources as (
  select
    s.id as source_object_id,
    lower(s.checksum_sha256) as sha256
  from portal_private.source_objects s
  where s.source_system='RAIL_AI'
    and s.source_object_type='XLSX_WAGON_DISLOCATION'
    and coalesce(s.source_version,'')='RAIL_XLSX_DISLOCATION_V1'
    and lower(s.checksum_sha256) in (
      'bc7429db2fbc411cb43607c54f87b824d4c8ad928353914c6e94c935870d5cc5',
      '42780329ea8df93ca4660a69d2788788dfe73ddaeed95ef624d27b114892e944'
    )
),
prepared as (
  select
    t.source_object_id,
    'EXPEDITOR_STREAM:7f4d3b6a-2d63-4f69-9f87-0f4db6704f01'::text as stream_key,
    'OWNER_AUTHORIZED_SYSTEM_REPAIR'::text as authority_type,
    'HANDOFF:b4c07f14-4b36-4c34-9358-fa72e9d57c3b|OWNER_CHAT:2026-09-21:FIX_AUTHORIZED'::text as authority_ref,
    jsonb_build_object(
      'reason','Two owner-resolved XLSX files are sequential snapshots of one trusted expeditor feed; per-file SHA source_time_domain caused false CROSS_DOMAIN_AMBIGUOUS.',
      'oldSha256','bc7429db2fbc411cb43607c54f87b824d4c8ad928353914c6e94c935870d5cc5',
      'newSha256','42780329ea8df93ca4660a69d2788788dfe73ddaeed95ef624d27b114892e944',
      'dealId','DEAL-2026-004',
      'railDocumentId','RONA-S002-IN-2026-002',
      'gu12Number','1308903120',
      'comparisonPolicy','STABLE_SOURCE_STREAM_NOT_FILE_SHA'
    ) as reason_evidence,
    jsonb_build_object(
      'repairContract','RAIL_XLSX_SOURCE_STREAM_DOMAIN_V1',
      'ownerInstruction','CURRENT_CHAT_2026-09-21_FIX',
      'handoffRef','b4c07f14-4b36-4c34-9358-fa72e9d57c3b',
      'canonicalSha256',t.sha256,
      'appendOnlyHistoryPreserved',true,
      'railWagonsManualWrite',false
    ) as provenance
  from target_sources t
)
insert into portal_private.rail_xlsx_source_stream_decisions_v1 (
  source_object_id,decision_state,stream_key,authority_type,authority_ref,
  decided_at,reason_evidence,provenance,decision_fingerprint
)
select
  p.source_object_id,
  'BOUND',
  p.stream_key,
  p.authority_type,
  p.authority_ref,
  now(),
  p.reason_evidence,
  p.provenance,
  encode(
    extensions.digest(
      convert_to(
        concat_ws(
          E'\x1f',
          p.source_object_id::text,
          'BOUND',
          p.stream_key,
          p.authority_type,
          p.authority_ref,
          p.reason_evidence::text
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
from prepared p
where not exists (
  select 1
  from portal_private.rail_xlsx_source_stream_decisions_v1 d
  where d.source_object_id=p.source_object_id
    and d.decision_state='BOUND'
    and d.stream_key=p.stream_key
);

-- Stable comparison domain:
-- * UTC remains globally comparable.
-- * explicitly BOUND local observations compare inside LOCAL_STREAM:<stream_key>.
-- * unbound local observations retain the original file-scoped fail-closed domain.
-- For snapshot streams, source_received_at is the primary cross-file ordering clock.
create or replace view portal_private.rail_xlsx_dislocation_latest_state_v1
with (security_invoker=false)
as
select distinct on (
  e.effective_deal_key,
  e.effective_rail_document_key,
  e.wagon_number,
  case
    when e.parsed_event_at is not null then 'UTC'
    when ss.decision_state='BOUND' and ss.stream_key is not null
      then 'LOCAL_STREAM:'||ss.stream_key
    else 'LOCAL:'||e.source_time_domain
  end
)
  e.*,
  case
    when e.parsed_event_at is not null then 'UTC'
    when ss.decision_state='BOUND' and ss.stream_key is not null
      then 'LOCAL_STREAM:'||ss.stream_key
    else 'LOCAL:'||e.source_time_domain
  end as comparison_domain
from portal_private.rail_xlsx_dislocation_effective_v1 e
left join portal_private.rail_xlsx_source_stream_effective_v1 ss
  on ss.source_object_id=e.source_object_id
where not e.is_superseded
  and e.effective_deal_key is not null
  and e.effective_rail_document_key is not null
  and e.position_status<>'SUPERSEDED'
order by
  e.effective_deal_key,
  e.effective_rail_document_key,
  e.wagon_number,
  case
    when e.parsed_event_at is not null then 'UTC'
    when ss.decision_state='BOUND' and ss.stream_key is not null
      then 'LOCAL_STREAM:'||ss.stream_key
    else 'LOCAL:'||e.source_time_domain
  end,
  case when e.parsed_event_at is not null then e.parsed_event_at end desc nulls last,
  case
    when e.parsed_event_at is null
     and ss.decision_state='BOUND'
     and ss.stream_key is not null
    then e.source_received_at
  end desc nulls last,
  case when e.parsed_event_at is null then e.event_at_local end desc nulls last,
  e.source_received_at desc,
  e.ingested_at desc,
  e.id desc;

revoke all on table portal_private.rail_xlsx_dislocation_latest_state_v1
  from public,anon,authenticated;
grant select on table portal_private.rail_xlsx_dislocation_latest_state_v1
  to service_role;

comment on view portal_private.rail_xlsx_dislocation_latest_state_v1 is
'Latest effective XLSX observation per Deal/document/wagon/comparison domain. Explicit stable source-stream binding replaces per-file SHA as the local comparison domain; unbound sources remain file-scoped fail-closed.';

-- Fail the migration if the targeted repair does not converge exactly.
do $$
declare
  v_deal_key uuid;
  v_rows integer;
  v_trusted integer;
  v_ambiguous integer;
  v_new_current integer;
  v_stream_count integer;
begin
  select d.id into v_deal_key
  from portal_private.deals d
  where d.deal_id='DEAL-2026-004'
    and d.lifecycle_state::text='ACTIVE';

  if v_deal_key is null then
    raise exception using errcode='23503', message='RAIL_XLSX_SOURCE_STREAM_REPAIR_DEAL_NOT_FOUND';
  end if;

  select
    count(*),
    count(*) filter (where cp.position_status='TRUSTED' and cp.comparison_domain_count=1),
    count(*) filter (where cp.position_status='CROSS_DOMAIN_AMBIGUOUS'),
    count(*) filter (
      where cp.position_status='TRUSTED'
        and cp.source_checksum_sha256='42780329ea8df93ca4660a69d2788788dfe73ddaeed95ef624d27b114892e944'
    )
  into v_rows,v_trusted,v_ambiguous,v_new_current
  from portal_private.rail_xlsx_dislocation_current_position_v1 cp
  where cp.effective_deal_key=v_deal_key;

  select count(distinct ss.stream_key) into v_stream_count
  from portal_private.rail_xlsx_source_stream_effective_v1 ss
  join portal_private.source_objects s on s.id=ss.source_object_id
  where ss.decision_state='BOUND'
    and lower(s.checksum_sha256) in (
      'bc7429db2fbc411cb43607c54f87b824d4c8ad928353914c6e94c935870d5cc5',
      '42780329ea8df93ca4660a69d2788788dfe73ddaeed95ef624d27b114892e944'
    );

  if v_rows<>9
     or v_trusted<>9
     or v_ambiguous<>0
     or v_new_current<>9
     or v_stream_count<>1 then
    raise exception using
      errcode='23514',
      message=format(
        'RAIL_XLSX_SOURCE_STREAM_REPAIR_QA_FAILED rows=%s trusted=%s ambiguous=%s new_current=%s stream_count=%s',
        v_rows,v_trusted,v_ambiguous,v_new_current,v_stream_count
      );
  end if;
end
$$;

commit;
