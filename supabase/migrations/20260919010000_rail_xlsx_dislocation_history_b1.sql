-- ONLINE RAIL / #644 — STAGE B1.1 ARCHITECTURE CORRECTION
-- DESIGN ONLY. DO NOT APPLY TO PRODUCTION BEFORE SYSTEM ADMIN ACCEPTANCE.
--
-- Preserves:
--   * portal_private.rail_movement_events as MOVIZOR-only history
--   * canonical portal_private.deals / rail_documents identities
--   * portal_private.rail_wagons as an existing current projection, never history
--   * no provider polling, no client publication, no fabricated coordinates
--
-- B1.1 adds:
--   * local wall-clock event time for timezone-unresolved XLSX
--   * append-only resolution decisions
--   * append-only explicit correction/supersession decisions
--   * guarded-only evidence writes
--   * source-policy verification
--   * fail-closed read model that can surface unresolved-timezone reference XLSX

begin;

create unique index if not exists source_objects_id_import_batch_v1
  on portal_private.source_objects (id, import_batch_id);

create table if not exists portal_private.rail_xlsx_dislocation_events_v1 (
  id uuid primary key default gen_random_uuid(),

  -- immutable source-lock
  import_batch_id uuid not null,
  source_object_id uuid not null,
  source_checksum_sha256 text not null,
  source_row_number integer not null,
  source_row_fingerprint text not null,
  source_row jsonb not null,

  -- verified source-policy snapshot
  source_policy text not null,
  source_contract_version text not null,
  source_system_snapshot text not null,
  source_object_type_snapshot text not null,
  source_version_snapshot text not null,
  source_received_at timestamptz not null,
  source_time_domain text not null,

  -- normalized observation
  wagon_number text not null,
  deal_key uuid,
  deal_id_snapshot text,
  rail_document_key uuid,
  rail_document_id_snapshot text,
  gu12_number_snapshot text,
  station_name text,
  station_code text,
  operation text,

  -- timestamp contract
  raw_timestamp text not null,
  event_at_local timestamp without time zone not null,
  parsed_event_at timestamptz,
  source_timezone text,
  source_timezone_status text not null,

  -- immutable initial resolution
  resolution_status text not null,
  resolution_evidence jsonb not null default '{}'::jsonb,

  -- fingerprints
  semantic_fingerprint text not null,
  event_identity_fingerprint text not null,

  provenance jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now(),

  constraint rail_xlsx_event_source_scope_fk
    foreign key (source_object_id, import_batch_id)
    references portal_private.source_objects(id, import_batch_id)
    on delete restrict,
  constraint rail_xlsx_event_import_batch_fk
    foreign key (import_batch_id)
    references portal_private.import_batches(id)
    on delete restrict,
  constraint rail_xlsx_event_deal_fk
    foreign key (deal_key)
    references portal_private.deals(id)
    on delete restrict,
  constraint rail_xlsx_event_document_fk
    foreign key (rail_document_key)
    references portal_private.rail_documents(id)
    on delete restrict,

  constraint rail_xlsx_event_wagon_nonblank
    check (btrim(wagon_number) <> ''),
  constraint rail_xlsx_event_source_row_positive
    check (source_row_number > 0),
  constraint rail_xlsx_event_checksum_format
    check (source_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  constraint rail_xlsx_event_row_fingerprint_format
    check (source_row_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint rail_xlsx_event_semantic_fingerprint_format
    check (semantic_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint rail_xlsx_event_identity_fingerprint_format
    check (event_identity_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint rail_xlsx_event_source_policy_exact
    check (source_policy='EXPEDITOR_XLSX_VIA_RAIL_AI'),
  constraint rail_xlsx_event_source_contract_exact
    check (source_contract_version='RAIL_XLSX_DISLOCATION_CONTRACT_V1'),
  constraint rail_xlsx_event_source_system_exact
    check (source_system_snapshot='RAIL_AI'),
  constraint rail_xlsx_event_source_object_type_exact
    check (source_object_type_snapshot='XLSX_WAGON_DISLOCATION'),
  constraint rail_xlsx_event_source_version_exact
    check (source_version_snapshot='RAIL_XLSX_DISLOCATION_V1'),
  constraint rail_xlsx_event_time_domain_nonblank
    check (btrim(source_time_domain) <> ''),
  constraint rail_xlsx_event_raw_timestamp_nonblank
    check (btrim(raw_timestamp) <> ''),
  constraint rail_xlsx_event_timezone_status_allowed
    check (source_timezone_status in (
      'EXPLICIT_OFFSET',
      'SOURCE_DECLARED',
      'UNRESOLVED',
      'INVALID'
    )),
  constraint rail_xlsx_event_resolution_allowed
    check (resolution_status in (
      'MATCHED',
      'TO_VERIFY',
      'UNRESOLVED',
      'CONFLICT'
    )),
  constraint rail_xlsx_event_matched_scope_required
    check (
      resolution_status <> 'MATCHED'
      or (deal_key is not null and rail_document_key is not null)
    ),
  constraint rail_xlsx_event_document_requires_deal
    check (rail_document_key is null or deal_key is not null),
  constraint rail_xlsx_event_utc_time_contract
    check (
      (
        source_timezone_status in ('EXPLICIT_OFFSET','SOURCE_DECLARED')
        and parsed_event_at is not null
      )
      or
      (
        source_timezone_status in ('UNRESOLVED','INVALID')
        and parsed_event_at is null
      )
    )
);

comment on table portal_private.rail_xlsx_dislocation_events_v1 is
'Immutable XLSX wagon-dislocation evidence. Separate from MOVIZOR rail_movement_events. Timezone-unresolved evidence keeps raw_timestamp + event_at_local and never fabricates UTC.';

comment on column portal_private.rail_xlsx_dislocation_events_v1.event_at_local is
'Parsed local railway wall-clock from XLSX, stored without timezone. Comparable only inside the same explicit source_time_domain while timezone is unresolved.';

comment on column portal_private.rail_xlsx_dislocation_events_v1.parsed_event_at is
'UTC/timestamptz only when source timezone is EXPLICIT_OFFSET or SOURCE_DECLARED. Must be NULL while timezone is unresolved.';

create unique index if not exists rail_xlsx_event_source_row_unique_v1
  on portal_private.rail_xlsx_dislocation_events_v1
  (source_object_id, source_row_number);

create index if not exists rail_xlsx_event_semantic_idx_v1
  on portal_private.rail_xlsx_dislocation_events_v1
  (semantic_fingerprint);

create index if not exists rail_xlsx_event_domain_wagon_local_idx_v1
  on portal_private.rail_xlsx_dislocation_events_v1
  (source_time_domain, wagon_number, event_at_local desc, ingested_at desc);

create index if not exists rail_xlsx_event_deal_doc_wagon_idx_v1
  on portal_private.rail_xlsx_dislocation_events_v1
  (deal_key, rail_document_key, wagon_number, source_time_domain, event_at_local desc);

alter table portal_private.rail_xlsx_dislocation_events_v1 enable row level security;

drop policy if exists rona_server_bypass_guard
  on portal_private.rail_xlsx_dislocation_events_v1;
create policy rona_server_bypass_guard
  on portal_private.rail_xlsx_dislocation_events_v1
  for all
  to authenticated
  using (false)
  with check (false);

-- Direct evidence writes are prohibited even to service_role.
revoke all on table portal_private.rail_xlsx_dislocation_events_v1
  from public, anon, authenticated, service_role;
grant select on table portal_private.rail_xlsx_dislocation_events_v1
  to service_role;

create or replace function portal_private.rail_xlsx_append_only_guard_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'RAIL_XLSX_APPEND_ONLY';
end
$$;

revoke all on function portal_private.rail_xlsx_append_only_guard_v1() from public;
grant execute on function portal_private.rail_xlsx_append_only_guard_v1() to service_role;

drop trigger if exists rail_xlsx_dislocation_append_only_v1
  on portal_private.rail_xlsx_dislocation_events_v1;
create trigger rail_xlsx_dislocation_append_only_v1
before update or delete on portal_private.rail_xlsx_dislocation_events_v1
for each row execute function portal_private.rail_xlsx_append_only_guard_v1();

-- Append-only resolution decisions. Evidence rows never change.
create table if not exists portal_private.rail_xlsx_resolution_decisions_v1 (
  id uuid primary key default gen_random_uuid(),
  evidence_event_id uuid not null
    references portal_private.rail_xlsx_dislocation_events_v1(id)
    on delete restrict,
  resulting_status text not null,
  deal_key uuid
    references portal_private.deals(id)
    on delete restrict,
  rail_document_key uuid
    references portal_private.rail_documents(id)
    on delete restrict,
  actor_source text not null,
  actor_ref text,
  decided_at timestamptz not null default now(),
  reason_evidence jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  decision_fingerprint text not null,

  constraint rail_xlsx_resolution_status_allowed
    check (resulting_status in ('MATCHED','TO_VERIFY','UNRESOLVED','CONFLICT')),
  constraint rail_xlsx_resolution_actor_nonblank
    check (btrim(actor_source) <> ''),
  constraint rail_xlsx_resolution_fingerprint_format
    check (decision_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint rail_xlsx_resolution_match_scope_required
    check (
      resulting_status <> 'MATCHED'
      or (deal_key is not null and rail_document_key is not null)
    )
);

create unique index if not exists rail_xlsx_resolution_decision_dedupe_v1
  on portal_private.rail_xlsx_resolution_decisions_v1
  (evidence_event_id, decision_fingerprint);

create index if not exists rail_xlsx_resolution_decision_latest_v1
  on portal_private.rail_xlsx_resolution_decisions_v1
  (evidence_event_id, decided_at desc, id desc);

alter table portal_private.rail_xlsx_resolution_decisions_v1 enable row level security;

drop policy if exists rona_server_bypass_guard
  on portal_private.rail_xlsx_resolution_decisions_v1;
create policy rona_server_bypass_guard
  on portal_private.rail_xlsx_resolution_decisions_v1
  for all
  to authenticated
  using (false)
  with check (false);

revoke all on table portal_private.rail_xlsx_resolution_decisions_v1
  from public, anon, authenticated, service_role;
grant select on table portal_private.rail_xlsx_resolution_decisions_v1
  to service_role;

drop trigger if exists rail_xlsx_resolution_append_only_v1
  on portal_private.rail_xlsx_resolution_decisions_v1;
create trigger rail_xlsx_resolution_append_only_v1
before update or delete on portal_private.rail_xlsx_resolution_decisions_v1
for each row execute function portal_private.rail_xlsx_append_only_guard_v1();

-- Explicit correction/supersession layer. New evidence never implies correction.
create table if not exists portal_private.rail_xlsx_correction_decisions_v1 (
  id uuid primary key default gen_random_uuid(),
  correction_event_id uuid not null
    references portal_private.rail_xlsx_dislocation_events_v1(id)
    on delete restrict,
  correction_of_event_id uuid not null
    references portal_private.rail_xlsx_dislocation_events_v1(id)
    on delete restrict,
  relation_type text not null,
  actor_source text not null,
  actor_ref text,
  decided_at timestamptz not null default now(),
  reason_evidence jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  decision_fingerprint text not null,

  constraint rail_xlsx_correction_distinct_events
    check (correction_event_id <> correction_of_event_id),
  constraint rail_xlsx_correction_relation_allowed
    check (relation_type in ('CORRECTION_OF','SUPERSEDES')),
  constraint rail_xlsx_correction_actor_nonblank
    check (btrim(actor_source) <> ''),
  constraint rail_xlsx_correction_fingerprint_format
    check (decision_fingerprint ~ '^[0-9a-f]{64}$')
);

create unique index if not exists rail_xlsx_correction_decision_dedupe_v1
  on portal_private.rail_xlsx_correction_decisions_v1
  (correction_event_id, correction_of_event_id, relation_type, decision_fingerprint);

create index if not exists rail_xlsx_correction_superseded_idx_v1
  on portal_private.rail_xlsx_correction_decisions_v1
  (correction_of_event_id, decided_at desc, id desc);

alter table portal_private.rail_xlsx_correction_decisions_v1 enable row level security;

drop policy if exists rona_server_bypass_guard
  on portal_private.rail_xlsx_correction_decisions_v1;
create policy rona_server_bypass_guard
  on portal_private.rail_xlsx_correction_decisions_v1
  for all
  to authenticated
  using (false)
  with check (false);

revoke all on table portal_private.rail_xlsx_correction_decisions_v1
  from public, anon, authenticated, service_role;
grant select on table portal_private.rail_xlsx_correction_decisions_v1
  to service_role;

drop trigger if exists rail_xlsx_correction_append_only_v1
  on portal_private.rail_xlsx_correction_decisions_v1;
create trigger rail_xlsx_correction_append_only_v1
before update or delete on portal_private.rail_xlsx_correction_decisions_v1
for each row execute function portal_private.rail_xlsx_append_only_guard_v1();

-- Guarded evidence ingest: verifies canonical source-policy contract.
create or replace function portal_private.rail_xlsx_dislocation_ingest_v1(
  p_import_batch_id uuid,
  p_source_object_id uuid,
  p_source_row_number integer,
  p_source_row jsonb,
  p_wagon_number text,
  p_event_at_local timestamp without time zone,
  p_raw_timestamp text,
  p_source_timezone_status text,
  p_deal_key uuid default null,
  p_rail_document_key uuid default null,
  p_station_name text default null,
  p_station_code text default null,
  p_operation text default null,
  p_parsed_event_at timestamptz default null,
  p_source_timezone text default null,
  p_resolution_status text default 'UNRESOLVED',
  p_resolution_evidence jsonb default '{}'::jsonb,
  p_provenance jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, extensions
as $$
declare
  v_source portal_private.source_objects%rowtype;
  v_batch portal_private.import_batches%rowtype;
  v_source_policy text;
  v_source_contract_version text;
  v_source_time_domain text;
  v_source_received_at timestamptz;
  v_source_row_fingerprint text;
  v_wagon text;
  v_station_name text;
  v_station_code text;
  v_operation text;
  v_time_identity text;
  v_semantic_fingerprint text;
  v_event_identity_fingerprint text;
  v_deal_id text;
  v_doc_deal_key uuid;
  v_rail_document_id text;
  v_gu12_number text;
  v_existing portal_private.rail_xlsx_dislocation_events_v1%rowtype;
  v_inserted portal_private.rail_xlsx_dislocation_events_v1%rowtype;
begin
  if p_source_row_number is null or p_source_row_number <= 0 then
    raise exception using errcode='22023', message='RAIL_XLSX_SOURCE_ROW_NUMBER_INVALID';
  end if;
  if p_source_row is null then
    raise exception using errcode='22023', message='RAIL_XLSX_SOURCE_ROW_REQUIRED';
  end if;
  if p_event_at_local is null then
    raise exception using errcode='22023', message='RAIL_XLSX_EVENT_AT_LOCAL_REQUIRED';
  end if;
  if nullif(btrim(coalesce(p_raw_timestamp,'')),'') is null then
    raise exception using errcode='22023', message='RAIL_XLSX_RAW_TIMESTAMP_REQUIRED';
  end if;

  select * into v_source
  from portal_private.source_objects
  where id=p_source_object_id
    and import_batch_id=p_import_batch_id;

  if not found then
    raise exception using errcode='23503', message='RAIL_XLSX_SOURCE_OBJECT_SCOPE_NOT_FOUND';
  end if;

  select * into v_batch
  from portal_private.import_batches
  where id=p_import_batch_id;

  if not found then
    raise exception using errcode='23503', message='RAIL_XLSX_IMPORT_BATCH_NOT_FOUND';
  end if;

  v_source_policy := nullif(v_source.raw_snapshot->>'sourcePolicy','');
  v_source_contract_version := nullif(v_source.raw_snapshot->>'sourceContractVersion','');
  v_source_time_domain := nullif(v_source.raw_snapshot->>'sourceTimeDomain','');
  v_source_received_at := coalesce(v_source.source_timestamp, v_batch.source_timestamp);

  if v_source.source_system <> 'RAIL_AI'
     or v_source.source_object_type <> 'XLSX_WAGON_DISLOCATION'
     or coalesce(v_source.source_version,'') <> 'RAIL_XLSX_DISLOCATION_V1'
     or v_source_policy <> 'EXPEDITOR_XLSX_VIA_RAIL_AI'
     or v_source_contract_version <> 'RAIL_XLSX_DISLOCATION_CONTRACT_V1'
     or v_source_time_domain is null then
    raise exception using
      errcode='23514',
      message='RAIL_XLSX_SOURCE_POLICY_CONTRACT_MISMATCH';
  end if;

  if v_source.checksum_sha256 is null
     or lower(v_source.checksum_sha256) !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='23514', message='RAIL_XLSX_SOURCE_CHECKSUM_REQUIRED';
  end if;

  if v_source_received_at is null then
    raise exception using errcode='23514', message='RAIL_XLSX_SOURCE_RECEIPT_TIMESTAMP_REQUIRED';
  end if;

  if p_source_timezone_status not in (
    'EXPLICIT_OFFSET','SOURCE_DECLARED','UNRESOLVED','INVALID'
  ) then
    raise exception using errcode='23514', message='RAIL_XLSX_TIMEZONE_STATUS_INVALID';
  end if;

  if p_source_timezone_status in ('UNRESOLVED','INVALID')
     and p_parsed_event_at is not null then
    raise exception using errcode='23514', message='RAIL_XLSX_UTC_FORBIDDEN_WITH_UNRESOLVED_TIMEZONE';
  end if;

  if p_source_timezone_status in ('EXPLICIT_OFFSET','SOURCE_DECLARED')
     and p_parsed_event_at is null then
    raise exception using errcode='23514', message='RAIL_XLSX_UTC_REQUIRED_WITH_RESOLVED_TIMEZONE';
  end if;

  if p_resolution_status not in ('MATCHED','TO_VERIFY','UNRESOLVED','CONFLICT') then
    raise exception using errcode='23514', message='RAIL_XLSX_RESOLUTION_STATUS_INVALID';
  end if;

  v_wagon := regexp_replace(upper(btrim(coalesce(p_wagon_number,''))), '\s+', '', 'g');
  if v_wagon='' then
    raise exception using errcode='23514', message='RAIL_XLSX_WAGON_REQUIRED';
  end if;

  if p_rail_document_key is not null then
    select rd.deal_key, rd.rail_document_id, rd.gu12_number
      into v_doc_deal_key, v_rail_document_id, v_gu12_number
    from portal_private.rail_documents rd
    where rd.id=p_rail_document_key;

    if not found then
      raise exception using errcode='23503', message='RAIL_XLSX_RAIL_DOCUMENT_NOT_FOUND';
    end if;

    if v_doc_deal_key is null then
      raise exception using errcode='23514', message='RAIL_XLSX_DOCUMENT_WITHOUT_CANONICAL_DEAL';
    end if;

    if p_deal_key is null then
      p_deal_key:=v_doc_deal_key;
    elsif p_deal_key<>v_doc_deal_key then
      raise exception using errcode='23514', message='RAIL_XLSX_DEAL_DOCUMENT_SCOPE_CONFLICT';
    end if;
  end if;

  if p_deal_key is not null then
    select d.deal_id into v_deal_id
    from portal_private.deals d
    where d.id=p_deal_key;

    if not found then
      raise exception using errcode='23503', message='RAIL_XLSX_DEAL_NOT_FOUND';
    end if;
  end if;

  if p_resolution_status='MATCHED'
     and (p_deal_key is null or p_rail_document_key is null) then
    raise exception using errcode='23514', message='RAIL_XLSX_MATCHED_SCOPE_REQUIRED';
  end if;

  v_station_name := nullif(regexp_replace(btrim(coalesce(p_station_name,'')), '\s+', ' ', 'g'),'');
  v_station_code := nullif(upper(btrim(coalesce(p_station_code,''))),'');
  v_operation := nullif(regexp_replace(btrim(coalesce(p_operation,'')), '\s+', ' ', 'g'),'');

  -- Unresolved local times are comparable only inside this verified source time-domain.
  if p_parsed_event_at is not null then
    v_time_identity := 'UTC:'||to_char(
      p_parsed_event_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US'
    );
  else
    v_time_identity := 'LOCAL_DOMAIN:'||v_source_time_domain||':'||
      to_char(p_event_at_local,'YYYY-MM-DD"T"HH24:MI:SS.US');
  end if;

  v_source_row_fingerprint := encode(
    extensions.digest(p_source_row::text,'sha256'),'hex'
  );

  v_semantic_fingerprint := encode(
    extensions.digest(
      concat_ws(
        E'\x1f',
        v_wagon,
        coalesce(v_station_code,''),
        lower(coalesce(v_station_name,'')),
        lower(coalesce(v_operation,'')),
        v_time_identity
      ),
      'sha256'
    ),
    'hex'
  );

  v_event_identity_fingerprint := encode(
    extensions.digest(
      concat_ws(E'\x1f',v_wagon,v_time_identity),
      'sha256'
    ),
    'hex'
  );

  select * into v_existing
  from portal_private.rail_xlsx_dislocation_events_v1 e
  where e.source_object_id=p_source_object_id
    and e.source_row_number=p_source_row_number;

  if found then
    if v_existing.source_row_fingerprint=v_source_row_fingerprint
       and v_existing.semantic_fingerprint=v_semantic_fingerprint then
      return jsonb_build_object(
        'outcome','IDEMPOTENT_REPLAY',
        'eventId',v_existing.id,
        'semanticFingerprint',v_existing.semantic_fingerprint,
        'eventIdentityFingerprint',v_existing.event_identity_fingerprint,
        'resolutionStatus',v_existing.resolution_status
      );
    end if;

    raise exception using
      errcode='23505',
      message='RAIL_XLSX_SOURCE_ROW_REINTERPRETATION_CONFLICT';
  end if;

  insert into portal_private.rail_xlsx_dislocation_events_v1 (
    import_batch_id, source_object_id, source_checksum_sha256,
    source_row_number, source_row_fingerprint, source_row,
    source_policy, source_contract_version, source_system_snapshot,
    source_object_type_snapshot, source_version_snapshot,
    source_received_at, source_time_domain,
    wagon_number, deal_key, deal_id_snapshot,
    rail_document_key, rail_document_id_snapshot, gu12_number_snapshot,
    station_name, station_code, operation,
    raw_timestamp, event_at_local, parsed_event_at,
    source_timezone, source_timezone_status,
    resolution_status, resolution_evidence,
    semantic_fingerprint, event_identity_fingerprint,
    provenance
  )
  values (
    p_import_batch_id, p_source_object_id, lower(v_source.checksum_sha256),
    p_source_row_number, v_source_row_fingerprint, p_source_row,
    v_source_policy, v_source_contract_version, v_source.source_system,
    v_source.source_object_type, v_source.source_version,
    v_source_received_at, v_source_time_domain,
    v_wagon, p_deal_key, v_deal_id,
    p_rail_document_key, v_rail_document_id, v_gu12_number,
    v_station_name, v_station_code, v_operation,
    btrim(p_raw_timestamp), p_event_at_local, p_parsed_event_at,
    nullif(btrim(coalesce(p_source_timezone,'')),''), p_source_timezone_status,
    p_resolution_status, coalesce(p_resolution_evidence,'{}'::jsonb),
    v_semantic_fingerprint, v_event_identity_fingerprint,
    coalesce(p_provenance,'{}'::jsonb)
  )
  returning * into v_inserted;

  return jsonb_build_object(
    'outcome','INSERTED',
    'eventId',v_inserted.id,
    'sourcePolicy',v_inserted.source_policy,
    'sourceTimeDomain',v_inserted.source_time_domain,
    'semanticFingerprint',v_inserted.semantic_fingerprint,
    'eventIdentityFingerprint',v_inserted.event_identity_fingerprint,
    'resolutionStatus',v_inserted.resolution_status
  );
end
$$;

revoke all on function portal_private.rail_xlsx_dislocation_ingest_v1(
  uuid,uuid,integer,jsonb,text,timestamp without time zone,text,text,
  uuid,uuid,text,text,text,timestamptz,text,text,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function portal_private.rail_xlsx_dislocation_ingest_v1(
  uuid,uuid,integer,jsonb,text,timestamp without time zone,text,text,
  uuid,uuid,text,text,text,timestamptz,text,text,jsonb,jsonb
) to service_role;

-- Guarded append-only resolution decision.
create or replace function portal_private.rail_xlsx_resolution_decide_v1(
  p_evidence_event_id uuid,
  p_resulting_status text,
  p_deal_key uuid,
  p_rail_document_key uuid,
  p_actor_source text,
  p_actor_ref text default null,
  p_decided_at timestamptz default now(),
  p_reason_evidence jsonb default '{}'::jsonb,
  p_provenance jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, extensions
as $$
declare
  v_event portal_private.rail_xlsx_dislocation_events_v1%rowtype;
  v_doc_deal uuid;
  v_fp text;
  v_existing uuid;
begin
  select * into v_event
  from portal_private.rail_xlsx_dislocation_events_v1
  where id=p_evidence_event_id;

  if not found then
    raise exception using errcode='23503', message='RAIL_XLSX_EVIDENCE_EVENT_NOT_FOUND';
  end if;

  if p_resulting_status not in ('MATCHED','TO_VERIFY','UNRESOLVED','CONFLICT') then
    raise exception using errcode='23514', message='RAIL_XLSX_DECISION_STATUS_INVALID';
  end if;

  if nullif(btrim(coalesce(p_actor_source,'')),'') is null then
    raise exception using errcode='23514', message='RAIL_XLSX_DECISION_ACTOR_REQUIRED';
  end if;

  if p_resulting_status='MATCHED' then
    if p_deal_key is null or p_rail_document_key is null then
      raise exception using errcode='23514', message='RAIL_XLSX_DECISION_MATCH_SCOPE_REQUIRED';
    end if;

    select deal_key into v_doc_deal
    from portal_private.rail_documents
    where id=p_rail_document_key;

    if not found or v_doc_deal is null or v_doc_deal<>p_deal_key then
      raise exception using errcode='23514', message='RAIL_XLSX_DECISION_DEAL_DOCUMENT_SCOPE_CONFLICT';
    end if;
  end if;

  v_fp:=encode(
    extensions.digest(
      concat_ws(
        E'\x1f',
        p_evidence_event_id::text,
        p_resulting_status,
        coalesce(p_deal_key::text,''),
        coalesce(p_rail_document_key::text,''),
        btrim(p_actor_source),
        coalesce(p_actor_ref,''),
        coalesce(p_reason_evidence,'{}'::jsonb)::text
      ),
      'sha256'
    ),
    'hex'
  );

  select id into v_existing
  from portal_private.rail_xlsx_resolution_decisions_v1
  where evidence_event_id=p_evidence_event_id
    and decision_fingerprint=v_fp
  limit 1;

  if found then
    return jsonb_build_object('outcome','IDEMPOTENT_REPLAY','decisionId',v_existing);
  end if;

  insert into portal_private.rail_xlsx_resolution_decisions_v1 (
    evidence_event_id,resulting_status,deal_key,rail_document_key,
    actor_source,actor_ref,decided_at,reason_evidence,provenance,decision_fingerprint
  )
  values (
    p_evidence_event_id,p_resulting_status,p_deal_key,p_rail_document_key,
    btrim(p_actor_source),nullif(btrim(coalesce(p_actor_ref,'')),''),
    coalesce(p_decided_at,now()),coalesce(p_reason_evidence,'{}'::jsonb),
    coalesce(p_provenance,'{}'::jsonb),v_fp
  )
  returning id into v_existing;

  return jsonb_build_object('outcome','INSERTED','decisionId',v_existing);
end
$$;

revoke all on function portal_private.rail_xlsx_resolution_decide_v1(
  uuid,text,uuid,uuid,text,text,timestamptz,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function portal_private.rail_xlsx_resolution_decide_v1(
  uuid,text,uuid,uuid,text,text,timestamptz,jsonb,jsonb
) to service_role;

-- Guarded explicit correction/supersession decision.
create or replace function portal_private.rail_xlsx_correction_decide_v1(
  p_correction_event_id uuid,
  p_correction_of_event_id uuid,
  p_relation_type text,
  p_actor_source text,
  p_actor_ref text default null,
  p_decided_at timestamptz default now(),
  p_reason_evidence jsonb default '{}'::jsonb,
  p_provenance jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, extensions
as $$
declare
  v_new portal_private.rail_xlsx_dislocation_events_v1%rowtype;
  v_old portal_private.rail_xlsx_dislocation_events_v1%rowtype;
  v_fp text;
  v_existing uuid;
begin
  if p_correction_event_id=p_correction_of_event_id then
    raise exception using errcode='23514', message='RAIL_XLSX_CORRECTION_SELF_REFERENCE';
  end if;

  if p_relation_type not in ('CORRECTION_OF','SUPERSEDES') then
    raise exception using errcode='23514', message='RAIL_XLSX_CORRECTION_RELATION_INVALID';
  end if;

  if nullif(btrim(coalesce(p_actor_source,'')),'') is null then
    raise exception using errcode='23514', message='RAIL_XLSX_CORRECTION_ACTOR_REQUIRED';
  end if;

  select * into v_new
  from portal_private.rail_xlsx_dislocation_events_v1
  where id=p_correction_event_id;
  if not found then
    raise exception using errcode='23503', message='RAIL_XLSX_CORRECTION_EVENT_NOT_FOUND';
  end if;

  select * into v_old
  from portal_private.rail_xlsx_dislocation_events_v1
  where id=p_correction_of_event_id;
  if not found then
    raise exception using errcode='23503', message='RAIL_XLSX_CORRECTION_TARGET_NOT_FOUND';
  end if;

  if v_new.wagon_number<>v_old.wagon_number then
    raise exception using errcode='23514', message='RAIL_XLSX_CORRECTION_WAGON_MISMATCH';
  end if;

  v_fp:=encode(
    extensions.digest(
      concat_ws(
        E'\x1f',
        p_correction_event_id::text,
        p_correction_of_event_id::text,
        p_relation_type,
        btrim(p_actor_source),
        coalesce(p_actor_ref,''),
        coalesce(p_reason_evidence,'{}'::jsonb)::text
      ),
      'sha256'
    ),
    'hex'
  );

  select id into v_existing
  from portal_private.rail_xlsx_correction_decisions_v1
  where correction_event_id=p_correction_event_id
    and correction_of_event_id=p_correction_of_event_id
    and relation_type=p_relation_type
    and decision_fingerprint=v_fp
  limit 1;

  if found then
    return jsonb_build_object('outcome','IDEMPOTENT_REPLAY','decisionId',v_existing);
  end if;

  insert into portal_private.rail_xlsx_correction_decisions_v1 (
    correction_event_id,correction_of_event_id,relation_type,
    actor_source,actor_ref,decided_at,reason_evidence,provenance,decision_fingerprint
  )
  values (
    p_correction_event_id,p_correction_of_event_id,p_relation_type,
    btrim(p_actor_source),nullif(btrim(coalesce(p_actor_ref,'')),''),
    coalesce(p_decided_at,now()),coalesce(p_reason_evidence,'{}'::jsonb),
    coalesce(p_provenance,'{}'::jsonb),v_fp
  )
  returning id into v_existing;

  return jsonb_build_object('outcome','INSERTED','decisionId',v_existing);
end
$$;

revoke all on function portal_private.rail_xlsx_correction_decide_v1(
  uuid,uuid,text,text,text,timestamptz,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function portal_private.rail_xlsx_correction_decide_v1(
  uuid,uuid,text,text,text,timestamptz,jsonb,jsonb
) to service_role;

-- Effective overlay:
--   1) explicit corrections mark older evidence as superseded;
--   2) latest append-only resolution decision overlays immutable evidence;
--   3) remaining same-wagon/same-time semantic conflicts fail closed.
create or replace view portal_private.rail_xlsx_dislocation_effective_v1
with (security_invoker = false)
as
with latest_resolution as (
  select distinct on (d.evidence_event_id)
    d.*
  from portal_private.rail_xlsx_resolution_decisions_v1 d
  order by d.evidence_event_id,d.decided_at desc,d.id desc
),
superseded as (
  select distinct c.correction_of_event_id as evidence_event_id
  from portal_private.rail_xlsx_correction_decisions_v1 c
  where c.relation_type in ('CORRECTION_OF','SUPERSEDES')
),
base as (
  select
    e.*,
    lr.id as resolution_decision_id,
    coalesce(lr.resulting_status,e.resolution_status) as overlay_resolution_status,
    coalesce(lr.deal_key,e.deal_key) as effective_deal_key,
    coalesce(lr.rail_document_key,e.rail_document_key) as effective_rail_document_key,
    lr.actor_source as resolution_actor_source,
    lr.actor_ref as resolution_actor_ref,
    lr.decided_at as resolution_decided_at,
    lr.reason_evidence as resolution_reason_evidence,
    lr.provenance as resolution_provenance,
    (s.evidence_event_id is not null) as is_superseded
  from portal_private.rail_xlsx_dislocation_events_v1 e
  left join latest_resolution lr on lr.evidence_event_id=e.id
  left join superseded s on s.evidence_event_id=e.id
),
identity_state as (
  select
    b.event_identity_fingerprint,
    count(distinct b.semantic_fingerprint) filter (where not b.is_superseded) as semantic_variant_count
  from base b
  group by b.event_identity_fingerprint
)
select
  b.*,
  coalesce(i.semantic_variant_count,0) as semantic_variant_count,
  case
    when b.is_superseded then 'SUPERSEDED'
    when coalesce(i.semantic_variant_count,0)>1 then 'CONFLICT'
    else b.overlay_resolution_status
  end as effective_resolution_status,
  case
    when b.is_superseded then 'SUPERSEDED'
    when coalesce(i.semantic_variant_count,0)>1 then 'CONFLICT'
    when b.overlay_resolution_status='UNRESOLVED' then 'UNRESOLVED'
    when b.overlay_resolution_status='CONFLICT' then 'CONFLICT'
    when b.overlay_resolution_status<>'MATCHED' then 'TO_VERIFY'
    when b.effective_deal_key is null or b.effective_rail_document_key is null then 'TO_VERIFY'
    when b.station_name is null and b.station_code is null then 'TO_VERIFY'
    else 'TRUSTED'
  end as position_status
from base b
join identity_state i on i.event_identity_fingerprint=b.event_identity_fingerprint;

revoke all on table portal_private.rail_xlsx_dislocation_effective_v1
  from public, anon, authenticated;
grant select on table portal_private.rail_xlsx_dislocation_effective_v1
  to service_role;

-- Latest within a comparable time domain:
-- * resolved timezone => UTC domain
-- * unresolved timezone => exact source_time_domain only
-- There is deliberately no cross-domain ordering for unresolved local time.
create or replace view portal_private.rail_xlsx_dislocation_latest_state_v1
with (security_invoker = false)
as
select distinct on (
  e.effective_deal_key,
  e.effective_rail_document_key,
  e.wagon_number,
  case
    when e.parsed_event_at is not null then 'UTC'
    else 'LOCAL:'||e.source_time_domain
  end
)
  e.*,
  case
    when e.parsed_event_at is not null then 'UTC'
    else 'LOCAL:'||e.source_time_domain
  end as comparison_domain,
  case
    when e.parsed_event_at is not null then e.parsed_event_at::text
    else e.event_at_local::text
  end as comparison_value
from portal_private.rail_xlsx_dislocation_effective_v1 e
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
    else 'LOCAL:'||e.source_time_domain
  end,
  case when e.parsed_event_at is not null then e.parsed_event_at end desc nulls last,
  case when e.parsed_event_at is null then e.event_at_local end desc nulls last,
  e.source_received_at desc,
  e.ingested_at desc,
  e.id desc;

revoke all on table portal_private.rail_xlsx_dislocation_latest_state_v1
  from public, anon, authenticated;
grant select on table portal_private.rail_xlsx_dislocation_latest_state_v1
  to service_role;

create or replace view portal_private.rail_xlsx_dislocation_latest_trusted_v1
with (security_invoker = false)
as
select distinct on (
  e.effective_deal_key,
  e.effective_rail_document_key,
  e.wagon_number,
  case
    when e.parsed_event_at is not null then 'UTC'
    else 'LOCAL:'||e.source_time_domain
  end
)
  e.*,
  case
    when e.parsed_event_at is not null then 'UTC'
    else 'LOCAL:'||e.source_time_domain
  end as comparison_domain
from portal_private.rail_xlsx_dislocation_effective_v1 e
where not e.is_superseded
  and e.position_status='TRUSTED'
  and e.effective_deal_key is not null
  and e.effective_rail_document_key is not null
order by
  e.effective_deal_key,
  e.effective_rail_document_key,
  e.wagon_number,
  case
    when e.parsed_event_at is not null then 'UTC'
    else 'LOCAL:'||e.source_time_domain
  end,
  case when e.parsed_event_at is not null then e.parsed_event_at end desc nulls last,
  case when e.parsed_event_at is null then e.event_at_local end desc nulls last,
  e.source_received_at desc,
  e.ingested_at desc,
  e.id desc;

revoke all on table portal_private.rail_xlsx_dislocation_latest_trusted_v1
  from public, anon, authenticated;
grant select on table portal_private.rail_xlsx_dislocation_latest_trusted_v1
  to service_role;

-- rail_wagons remains an existing current projection.
-- B1.1 does NOT create new rail_wagons rows because existing status semantics
-- mix REGISTERED with operational states and no separate registration-lifecycle
-- field is present in the current production model.
alter table portal_private.rail_wagons
  add column if not exists position_source_system text,
  add column if not exists position_source_event_id uuid,
  add column if not exists position_source_object_id uuid,
  add column if not exists position_semantic_fingerprint text,
  add column if not exists position_resolution_status text,
  add column if not exists position_event_at_local timestamp without time zone,
  add column if not exists position_source_time_domain text,
  add column if not exists position_source_timezone_status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='rail_wagons_position_source_event_fk'
      and conrelid='portal_private.rail_wagons'::regclass
  ) then
    alter table portal_private.rail_wagons
      add constraint rail_wagons_position_source_event_fk
      foreign key (position_source_event_id)
      references portal_private.rail_xlsx_dislocation_events_v1(id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='rail_wagons_position_source_object_fk'
      and conrelid='portal_private.rail_wagons'::regclass
  ) then
    alter table portal_private.rail_wagons
      add constraint rail_wagons_position_source_object_fk
      foreign key (position_source_object_id)
      references portal_private.source_objects(id)
      on delete restrict;
  end if;
end
$$;

create or replace function portal_private.rail_xlsx_refresh_wagon_projection_v1(
  p_deal_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_updated integer:=0;
  v_missing_wagon_rows integer:=0;
begin
  -- No INSERT here by design. Existing rail_wagons.status semantics are not
  -- split into registration lifecycle vs operational railway status.
  update portal_private.rail_wagons rw
  set
    current_station_name=s.station_name,
    current_station_code=s.station_code,
    operation_code=s.operation,
    operation_at=s.parsed_event_at,
    last_position_at=s.parsed_event_at,
    source_timestamp=s.source_received_at,
    position_source_system=s.source_policy,
    position_source_event_id=s.id,
    position_source_object_id=s.source_object_id,
    position_semantic_fingerprint=s.semantic_fingerprint,
    position_resolution_status='MATCHED',
    position_event_at_local=s.event_at_local,
    position_source_time_domain=s.source_time_domain,
    position_source_timezone_status=s.source_timezone_status,
    updated_at=now()
  from portal_private.rail_xlsx_dislocation_latest_trusted_v1 s
  where rw.wagon_number=s.wagon_number
    and rw.rail_document_key=s.effective_rail_document_key
    and (p_deal_key is null or s.effective_deal_key=p_deal_key)
    and (
      rw.position_source_system is null
      or rw.position_source_system='EXPEDITOR_XLSX_VIA_RAIL_AI'
    )
    and (
      rw.position_source_event_id is distinct from s.id
      or rw.position_resolution_status is distinct from 'MATCHED'
    );

  get diagnostics v_updated=row_count;

  select count(*)
    into v_missing_wagon_rows
  from portal_private.rail_xlsx_dislocation_latest_trusted_v1 s
  where (p_deal_key is null or s.effective_deal_key=p_deal_key)
    and not exists (
      select 1
      from portal_private.rail_wagons rw
      where rw.wagon_number=s.wagon_number
        and rw.rail_document_key=s.effective_rail_document_key
    );

  return jsonb_build_object(
    'projectionVersion','RAIL_XLSX_WAGON_PROJECTION_V1_1',
    'updatedExistingRows',v_updated,
    'missingWagonRowsNotCreated',v_missing_wagon_rows,
    'statusSemantics','NO_AUTO_CREATE_UNTIL_REGISTRATION_VS_OPERATIONAL_STATUS_IS_SEPARATED'
  );
end
$$;

revoke all on function portal_private.rail_xlsx_refresh_wagon_projection_v1(uuid)
  from public, anon, authenticated;
grant execute on function portal_private.rail_xlsx_refresh_wagon_projection_v1(uuid)
  to service_role;

create or replace function public.rona_admin_rail_deal_read_model_v1(
  p_deal_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_actor uuid;
  v_result jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');

  with scoped_deals as (
    select d.id as deal_key,d.deal_id
    from portal_private.deals d
    where d.lifecycle_state::text='ACTIVE'
      and (p_deal_id is null or d.deal_id=p_deal_id)
  ),
  deal_docs as (
    select
      sd.deal_key,sd.deal_id,
      rd.id as rail_document_key,
      rd.rail_document_id,
      rd.gu12_number,
      rd.document_number,
      rd.document_date,
      rd.route_text,
      rd.source_system,
      rd.source_version,
      rd.source_timestamp,
      rd.import_batch_id
    from scoped_deals sd
    join portal_private.rail_documents rd
      on rd.deal_key=sd.deal_key
     and rd.lifecycle_state::text='ACTIVE'
  ),
  latest_obs as (
    select ls.*
    from portal_private.rail_xlsx_dislocation_latest_state_v1 ls
    join scoped_deals sd on sd.deal_key=ls.effective_deal_key
  ),
  latest_trusted as (
    select lt.*
    from portal_private.rail_xlsx_dislocation_latest_trusted_v1 lt
    join scoped_deals sd on sd.deal_key=lt.effective_deal_key
  )
  select jsonb_build_object(
    'modelVersion','RONA_ADMIN_RAIL_DEAL_READ_MODEL_V1_1',
    'selectionOwner','DEAL',
    'selectionKey','deal_key',
    'sourcePolicy','EXPEDITOR_XLSX_VIA_RAIL_AI',
    'generatedAt',now(),
    'deals',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'dealKey',sd.deal_key,
          'dealId',sd.deal_id,
          'railDocuments',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'railDocumentKey',dd.rail_document_key,
                'railDocumentId',dd.rail_document_id,
                'gu12Number',dd.gu12_number,
                'documentNumber',dd.document_number,
                'documentDate',dd.document_date,
                'routeText',dd.route_text,
                'provenance',jsonb_build_object(
                  'sourceSystem',dd.source_system,
                  'sourceVersion',dd.source_version,
                  'sourceTimestamp',dd.source_timestamp,
                  'importBatchId',dd.import_batch_id
                )
              )
              order by dd.document_date nulls last,dd.rail_document_id
            )
            from deal_docs dd
            where dd.deal_key=sd.deal_key
          ),'[]'::jsonb),

          'plannedRoute',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'railDocumentKey',dd.rail_document_key,
                'railDocumentId',dd.rail_document_id,
                'gu12Number',dd.gu12_number,
                'routeText',dd.route_text,
                'points','[]'::jsonb,
                'geometry',null,
                'status',case
                  when dd.route_text is null then 'SOURCE_NOT_AVAILABLE'
                  else 'TEXT_ONLY_NOT_GEOCODED'
                end,
                'provenance',jsonb_build_object(
                  'sourceSystem',dd.source_system,
                  'sourceVersion',dd.source_version,
                  'sourceTimestamp',dd.source_timestamp,
                  'importBatchId',dd.import_batch_id
                )
              )
              order by dd.document_date nulls last,dd.rail_document_id
            )
            from deal_docs dd
            where dd.deal_key=sd.deal_key
          ),'[]'::jsonb),

          -- Includes timezone-unresolved XLSX because latest_state compares
          -- local wall-clock only inside the exact source_time_domain.
          'wagonPositions',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'wagonNumber',o.wagon_number,
                'railDocumentKey',o.effective_rail_document_key,
                'railDocumentId',o.rail_document_id_snapshot,
                'gu12Number',o.gu12_number_snapshot,
                'station',o.station_name,
                'stationCode',o.station_code,
                'operation',o.operation,
                'eventTimestamp',o.parsed_event_at,
                'eventAtLocal',o.event_at_local,
                'rawTimestamp',o.raw_timestamp,
                'sourceTimezone',o.source_timezone,
                'sourceTimezoneStatus',o.source_timezone_status,
                'sourceTimeDomain',o.source_time_domain,
                'comparisonDomain',o.comparison_domain,
                'positionStatus',o.position_status,
                'effectiveResolutionStatus',o.effective_resolution_status,
                'resolutionDecisionId',o.resolution_decision_id,
                'trustedCoordinates',null,
                'coordinateProvenance',null,
                'provenance',jsonb_build_object(
                  'sourcePolicy',o.source_policy,
                  'sourceContractVersion',o.source_contract_version,
                  'sourceSystem',o.source_system_snapshot,
                  'sourceObjectType',o.source_object_type_snapshot,
                  'sourceVersion',o.source_version_snapshot,
                  'eventId',o.id,
                  'sourceObjectId',o.source_object_id,
                  'importBatchId',o.import_batch_id,
                  'sourceChecksumSha256',o.source_checksum_sha256,
                  'sourceRowNumber',o.source_row_number,
                  'sourceRowFingerprint',o.source_row_fingerprint,
                  'semanticFingerprint',o.semantic_fingerprint,
                  'sourceReceivedAt',o.source_received_at,
                  'resolutionActorSource',o.resolution_actor_source,
                  'resolutionActorRef',o.resolution_actor_ref,
                  'resolutionDecidedAt',o.resolution_decided_at,
                  'sourceProvenance',o.provenance
                )
              )
              order by
                o.wagon_number,
                o.comparison_domain
            )
            from latest_obs o
            where o.effective_deal_key=sd.deal_key
          ),'[]'::jsonb),

          'positionGroups',coalesce((
            select jsonb_agg(g.payload order by g.station_code nulls last,g.station_name)
            from (
              select
                jsonb_build_object(
                  'clusterKey',case
                    when t.station_code is not null
                      then 'ESR:'||upper(btrim(t.station_code))
                    else 'STATION:'||lower(regexp_replace(btrim(t.station_name),'\s+',' ','g'))
                  end,
                  'station',max(t.station_name),
                  'stationCode',max(t.station_code),
                  'wagonCount',count(*),
                  'wagonNumbers',jsonb_agg(t.wagon_number order by t.wagon_number),
                  'eventTimestamp',max(t.parsed_event_at),
                  'eventAtLocal',max(t.event_at_local),
                  'sourceTimeDomains',jsonb_agg(distinct t.source_time_domain),
                  'trustedCoordinates',null,
                  'coordinateProvenance',null
                ) as payload,
                max(t.station_code) as station_code,
                max(t.station_name) as station_name
              from latest_trusted t
              where t.effective_deal_key=sd.deal_key
                and t.station_name is not null
              group by case
                when t.station_code is not null
                  then 'ESR:'||upper(btrim(t.station_code))
                else 'STATION:'||lower(regexp_replace(btrim(t.station_name),'\s+',' ','g'))
              end
            ) g
          ),'[]'::jsonb),

          'unresolvedOrConflictCount',(
            select count(*)
            from latest_obs o
            where o.effective_deal_key=sd.deal_key
              and o.position_status in ('TO_VERIFY','UNRESOLVED','CONFLICT')
          )
        )
        order by sd.deal_id
      )
      from scoped_deals sd
    ),'[]'::jsonb)
  )
  into v_result;

  return v_result;
end
$$;

comment on function public.rona_admin_rail_deal_read_model_v1(text) is
'Admin-only Deal rail read model. Timezone-unresolved XLSX remains visible via eventAtLocal/sourceTimeDomain. No UTC or GEO fabrication. Evidence, resolution decisions, and correction decisions remain append-only.';

revoke all on function public.rona_admin_rail_deal_read_model_v1(text)
  from public, anon;
grant execute on function public.rona_admin_rail_deal_read_model_v1(text)
  to authenticated, service_role;

commit;
