-- ONLINE RAIL / #644 — STAGE B1
-- XLSX dislocation history + Deal-owned read model.
-- DESIGN ONLY in this PR. DO NOT APPLY TO PRODUCTION BEFORE SYSTEM ADMIN ACCEPTANCE.
--
-- Preserves:
--   * portal_private.rail_movement_events as MOVIZOR-only history
--   * portal_private.rail_wagons as current projection, never as history
--   * canonical portal_private.deals / rail_documents identities
--   * no provider polling, no client publication, no fabricated coordinates

begin;

create unique index if not exists source_objects_id_import_batch_v1
  on portal_private.source_objects (id, import_batch_id);

create table if not exists portal_private.rail_xlsx_dislocation_events_v1 (
  id uuid primary key default gen_random_uuid(),

  -- source-lock: exact import/file/row
  import_batch_id uuid not null,
  source_object_id uuid not null,
  source_checksum_sha256 text not null,
  source_row_number integer not null,
  source_row_fingerprint text not null,
  source_row jsonb not null,

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
  raw_timestamp text,
  parsed_event_at timestamptz,
  source_timezone text,
  source_timezone_status text not null,

  -- resolution is evidence-scoped; it never creates a Deal or GU-12
  resolution_status text not null,
  resolution_evidence jsonb not null default '{}'::jsonb,

  -- source-independent observation fingerprint + same-wagon/same-moment key
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
  constraint rail_xlsx_event_timezone_status_allowed
    check (source_timezone_status in (
      'EXPLICIT_OFFSET',
      'SOURCE_DECLARED',
      'UNKNOWN',
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
  constraint rail_xlsx_event_parsed_time_requires_resolved_timezone
    check (
      parsed_event_at is null
      or source_timezone_status in ('EXPLICIT_OFFSET', 'SOURCE_DECLARED')
    )
);

comment on table portal_private.rail_xlsx_dislocation_events_v1 is
'Append-only XLSX wagon-dislocation evidence for Online Rail. Separate from MOVIZOR rail_movement_events. Every row is source-locked to import_batch + source_object + checksum + raw row.';

comment on column portal_private.rail_xlsx_dislocation_events_v1.semantic_fingerprint is
'SHA-256 of normalized observation semantics: wagon + station + operation + event-time identity. Excludes source/file identity so repeated evidence can be recognized without losing provenance.';

comment on column portal_private.rail_xlsx_dislocation_events_v1.event_identity_fingerprint is
'SHA-256 same-wagon/same-moment grouping key used for fail-closed conflict detection.';

create unique index if not exists rail_xlsx_event_source_row_unique_v1
  on portal_private.rail_xlsx_dislocation_events_v1
  (source_object_id, source_row_number);

create index if not exists rail_xlsx_event_semantic_idx_v1
  on portal_private.rail_xlsx_dislocation_events_v1
  (semantic_fingerprint);

create index if not exists rail_xlsx_event_identity_idx_v1
  on portal_private.rail_xlsx_dislocation_events_v1
  (event_identity_fingerprint, parsed_event_at desc, ingested_at desc);

create index if not exists rail_xlsx_event_deal_doc_wagon_idx_v1
  on portal_private.rail_xlsx_dislocation_events_v1
  (deal_key, rail_document_key, wagon_number, parsed_event_at desc);

alter table portal_private.rail_xlsx_dislocation_events_v1 enable row level security;

drop policy if exists rona_server_bypass_guard
  on portal_private.rail_xlsx_dislocation_events_v1;
create policy rona_server_bypass_guard
  on portal_private.rail_xlsx_dislocation_events_v1
  for all
  to authenticated
  using (false)
  with check (false);

revoke all on table portal_private.rail_xlsx_dislocation_events_v1
  from public, anon, authenticated;
grant select, insert on table portal_private.rail_xlsx_dislocation_events_v1
  to service_role;

create or replace function portal_private.rail_xlsx_append_only_guard_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, extensions
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'RAIL_XLSX_DISLOCATION_APPEND_ONLY';
end
$$;

revoke all on function portal_private.rail_xlsx_append_only_guard_v1() from public;
grant execute on function portal_private.rail_xlsx_append_only_guard_v1() to service_role;

drop trigger if exists rail_xlsx_dislocation_append_only_v1
  on portal_private.rail_xlsx_dislocation_events_v1;
create trigger rail_xlsx_dislocation_append_only_v1
before update or delete on portal_private.rail_xlsx_dislocation_events_v1
for each row execute function portal_private.rail_xlsx_append_only_guard_v1();

create or replace function portal_private.rail_xlsx_dislocation_ingest_v1(
  p_import_batch_id uuid,
  p_source_object_id uuid,
  p_source_row_number integer,
  p_source_row jsonb,
  p_wagon_number text,
  p_deal_key uuid default null,
  p_rail_document_key uuid default null,
  p_station_name text default null,
  p_station_code text default null,
  p_operation text default null,
  p_raw_timestamp text default null,
  p_parsed_event_at timestamptz default null,
  p_source_timezone text default null,
  p_source_timezone_status text default 'UNKNOWN',
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
  v_source_checksum text;
  v_source_row_fingerprint text;
  v_wagon text;
  v_station_name text;
  v_station_code text;
  v_operation text;
  v_time_key text;
  v_semantic_fingerprint text;
  v_event_identity_fingerprint text;
  v_deal_id text;
  v_doc_deal_key uuid;
  v_rail_document_id text;
  v_gu12_number text;
  v_existing portal_private.rail_xlsx_dislocation_events_v1%rowtype;
  v_inserted portal_private.rail_xlsx_dislocation_events_v1%rowtype;
  v_semantic_variants integer;
  v_effective_resolution text;
begin
  if p_source_row_number is null or p_source_row_number <= 0 then
    raise exception using errcode='22023', message='RAIL_XLSX_SOURCE_ROW_NUMBER_INVALID';
  end if;

  if p_source_row is null then
    raise exception using errcode='22023', message='RAIL_XLSX_SOURCE_ROW_REQUIRED';
  end if;

  select lower(so.checksum_sha256)
    into v_source_checksum
  from portal_private.source_objects so
  where so.id = p_source_object_id
    and so.import_batch_id = p_import_batch_id;

  if not found then
    raise exception using errcode='23503', message='RAIL_XLSX_SOURCE_OBJECT_SCOPE_NOT_FOUND';
  end if;

  if v_source_checksum is null
     or v_source_checksum !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='23514', message='RAIL_XLSX_SOURCE_CHECKSUM_REQUIRED';
  end if;

  v_wagon := regexp_replace(upper(btrim(coalesce(p_wagon_number,''))), '\s+', '', 'g');
  if v_wagon = '' then
    raise exception using errcode='23514', message='RAIL_XLSX_WAGON_REQUIRED';
  end if;

  if p_source_timezone_status not in (
    'EXPLICIT_OFFSET','SOURCE_DECLARED','UNKNOWN','INVALID'
  ) then
    raise exception using errcode='23514', message='RAIL_XLSX_TIMEZONE_STATUS_INVALID';
  end if;

  if p_resolution_status not in (
    'MATCHED','TO_VERIFY','UNRESOLVED','CONFLICT'
  ) then
    raise exception using errcode='23514', message='RAIL_XLSX_RESOLUTION_STATUS_INVALID';
  end if;

  if p_parsed_event_at is not null
     and p_source_timezone_status not in ('EXPLICIT_OFFSET','SOURCE_DECLARED') then
    raise exception using errcode='23514', message='RAIL_XLSX_PARSED_TIME_WITHOUT_SOURCE_TIMEZONE';
  end if;

  if p_rail_document_key is not null then
    select rd.deal_key, rd.rail_document_id, rd.gu12_number
      into v_doc_deal_key, v_rail_document_id, v_gu12_number
    from portal_private.rail_documents rd
    where rd.id = p_rail_document_key;

    if not found then
      raise exception using errcode='23503', message='RAIL_XLSX_RAIL_DOCUMENT_NOT_FOUND';
    end if;

    if v_doc_deal_key is null then
      raise exception using errcode='23514', message='RAIL_XLSX_DOCUMENT_WITHOUT_CANONICAL_DEAL';
    end if;

    if p_deal_key is null then
      p_deal_key := v_doc_deal_key;
    elsif p_deal_key <> v_doc_deal_key then
      raise exception using errcode='23514', message='RAIL_XLSX_DEAL_DOCUMENT_SCOPE_CONFLICT';
    end if;
  end if;

  if p_deal_key is not null then
    select d.deal_id
      into v_deal_id
    from portal_private.deals d
    where d.id = p_deal_key;

    if not found then
      raise exception using errcode='23503', message='RAIL_XLSX_DEAL_NOT_FOUND';
    end if;
  end if;

  if p_resolution_status = 'MATCHED'
     and (p_deal_key is null or p_rail_document_key is null) then
    raise exception using errcode='23514', message='RAIL_XLSX_MATCHED_SCOPE_REQUIRED';
  end if;

  v_station_name := nullif(regexp_replace(btrim(coalesce(p_station_name,'')), '\s+', ' ', 'g'),'');
  v_station_code := nullif(upper(btrim(coalesce(p_station_code,''))),'');
  v_operation := nullif(regexp_replace(btrim(coalesce(p_operation,'')), '\s+', ' ', 'g'),'');

  if p_parsed_event_at is not null then
    v_time_key := 'UTC:' || to_char(
      p_parsed_event_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US'
    );
  else
    v_time_key := 'RAW:' ||
      lower(regexp_replace(btrim(coalesce(p_raw_timestamp,'')), '\s+', ' ', 'g')) ||
      '|TZSTATUS:' || p_source_timezone_status ||
      '|TZ:' || lower(btrim(coalesce(p_source_timezone,'')));
  end if;

  v_source_row_fingerprint := encode(
    extensions.digest(p_source_row::text, 'sha256'),
    'hex'
  );

  v_semantic_fingerprint := encode(
    extensions.digest(
      concat_ws(
        E'\x1f',
        v_wagon,
        coalesce(v_station_code,''),
        lower(coalesce(v_station_name,'')),
        lower(coalesce(v_operation,'')),
        v_time_key
      ),
      'sha256'
    ),
    'hex'
  );

  v_event_identity_fingerprint := encode(
    extensions.digest(
      concat_ws(E'\x1f', v_wagon, v_time_key),
      'sha256'
    ),
    'hex'
  );

  select *
    into v_existing
  from portal_private.rail_xlsx_dislocation_events_v1 e
  where e.source_object_id = p_source_object_id
    and e.source_row_number = p_source_row_number;

  if found then
    if v_existing.source_row_fingerprint = v_source_row_fingerprint
       and v_existing.semantic_fingerprint = v_semantic_fingerprint then
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
    import_batch_id,
    source_object_id,
    source_checksum_sha256,
    source_row_number,
    source_row_fingerprint,
    source_row,
    wagon_number,
    deal_key,
    deal_id_snapshot,
    rail_document_key,
    rail_document_id_snapshot,
    gu12_number_snapshot,
    station_name,
    station_code,
    operation,
    raw_timestamp,
    parsed_event_at,
    source_timezone,
    source_timezone_status,
    resolution_status,
    resolution_evidence,
    semantic_fingerprint,
    event_identity_fingerprint,
    provenance
  )
  values (
    p_import_batch_id,
    p_source_object_id,
    v_source_checksum,
    p_source_row_number,
    v_source_row_fingerprint,
    p_source_row,
    v_wagon,
    p_deal_key,
    v_deal_id,
    p_rail_document_key,
    v_rail_document_id,
    v_gu12_number,
    v_station_name,
    v_station_code,
    v_operation,
    nullif(btrim(coalesce(p_raw_timestamp,'')),''),
    p_parsed_event_at,
    nullif(btrim(coalesce(p_source_timezone,'')),''),
    p_source_timezone_status,
    p_resolution_status,
    coalesce(p_resolution_evidence,'{}'::jsonb),
    v_semantic_fingerprint,
    v_event_identity_fingerprint,
    coalesce(p_provenance,'{}'::jsonb)
  )
  returning * into v_inserted;

  select count(distinct e.semantic_fingerprint)
    into v_semantic_variants
  from portal_private.rail_xlsx_dislocation_events_v1 e
  where e.event_identity_fingerprint = v_inserted.event_identity_fingerprint;

  v_effective_resolution := case
    when v_semantic_variants > 1 then 'CONFLICT'
    else v_inserted.resolution_status
  end;

  return jsonb_build_object(
    'outcome','INSERTED',
    'eventId',v_inserted.id,
    'semanticFingerprint',v_inserted.semantic_fingerprint,
    'eventIdentityFingerprint',v_inserted.event_identity_fingerprint,
    'resolutionStatus',v_inserted.resolution_status,
    'effectiveResolutionStatus',v_effective_resolution
  );
end
$$;

revoke all on function portal_private.rail_xlsx_dislocation_ingest_v1(
  uuid,uuid,integer,jsonb,text,uuid,uuid,text,text,text,text,timestamptz,text,text,text,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function portal_private.rail_xlsx_dislocation_ingest_v1(
  uuid,uuid,integer,jsonb,text,uuid,uuid,text,text,text,text,timestamptz,text,text,text,jsonb,jsonb
) to service_role;

create or replace view portal_private.rail_xlsx_dislocation_effective_v1
with (security_invoker = false)
as
with identity_state as (
  select
    event_identity_fingerprint,
    count(*) as evidence_count,
    count(distinct semantic_fingerprint) as semantic_variant_count
  from portal_private.rail_xlsx_dislocation_events_v1
  group by event_identity_fingerprint
)
select
  e.*,
  s.evidence_count,
  s.semantic_variant_count,
  case
    when s.semantic_variant_count > 1 then 'CONFLICT'
    else e.resolution_status
  end as effective_resolution_status,
  case
    when s.semantic_variant_count > 1 then 'CONFLICT'
    when e.resolution_status = 'UNRESOLVED' then 'UNRESOLVED'
    when e.resolution_status <> 'MATCHED' then 'TO_VERIFY'
    when e.parsed_event_at is null then 'TO_VERIFY'
    when e.source_timezone_status not in ('EXPLICIT_OFFSET','SOURCE_DECLARED') then 'TO_VERIFY'
    when e.station_name is null and e.station_code is null then 'TO_VERIFY'
    else 'TRUSTED'
  end as position_status
from portal_private.rail_xlsx_dislocation_events_v1 e
join identity_state s
  on s.event_identity_fingerprint = e.event_identity_fingerprint;

comment on view portal_private.rail_xlsx_dislocation_effective_v1 is
'Derived conflict/resolution state. Contradictory semantic variants for the same wagon/moment are CONFLICT without mutating prior history.';

revoke all on table portal_private.rail_xlsx_dislocation_effective_v1
  from public, anon, authenticated;
grant select on table portal_private.rail_xlsx_dislocation_effective_v1
  to service_role;

create or replace view portal_private.rail_xlsx_dislocation_latest_state_v1
with (security_invoker = false)
as
with comparable as (
  select e.*
  from portal_private.rail_xlsx_dislocation_effective_v1 e
  where e.deal_key is not null
    and e.rail_document_key is not null
    and e.parsed_event_at is not null
    and e.source_timezone_status in ('EXPLICIT_OFFSET','SOURCE_DECLARED')
),
moment_state as (
  select
    c.deal_key,
    c.rail_document_key,
    c.wagon_number,
    c.parsed_event_at,
    c.event_identity_fingerprint,
    max(c.position_status) filter (where c.position_status = 'CONFLICT') as conflict_marker,
    bool_or(c.position_status = 'TRUSTED') as any_trusted,
    count(distinct c.semantic_fingerprint) as semantic_variant_count
  from comparable c
  group by
    c.deal_key,
    c.rail_document_key,
    c.wagon_number,
    c.parsed_event_at,
    c.event_identity_fingerprint
),
latest_moment as (
  select distinct on (m.deal_key, m.rail_document_key, m.wagon_number)
    m.*
  from moment_state m
  order by
    m.deal_key,
    m.rail_document_key,
    m.wagon_number,
    m.parsed_event_at desc,
    m.event_identity_fingerprint
),
representative as (
  select distinct on (
    e.deal_key,
    e.rail_document_key,
    e.wagon_number,
    e.parsed_event_at,
    e.event_identity_fingerprint
  )
    e.*
  from portal_private.rail_xlsx_dislocation_effective_v1 e
  join latest_moment lm
    on lm.deal_key = e.deal_key
   and lm.rail_document_key = e.rail_document_key
   and lm.wagon_number = e.wagon_number
   and lm.parsed_event_at = e.parsed_event_at
   and lm.event_identity_fingerprint = e.event_identity_fingerprint
  order by
    e.deal_key,
    e.rail_document_key,
    e.wagon_number,
    e.parsed_event_at,
    e.event_identity_fingerprint,
    case e.position_status
      when 'CONFLICT' then 1
      when 'TO_VERIFY' then 2
      when 'UNRESOLVED' then 3
      else 4
    end,
    e.ingested_at,
    e.id
)
select
  r.*,
  case
    when lm.semantic_variant_count > 1 then 'CONFLICT'
    when r.position_status = 'TRUSTED' then 'TRUSTED'
    when r.effective_resolution_status = 'UNRESOLVED' then 'UNRESOLVED'
    else 'TO_VERIFY'
  end as latest_position_status
from representative r
join latest_moment lm
  on lm.deal_key = r.deal_key
 and lm.rail_document_key = r.rail_document_key
 and lm.wagon_number = r.wagon_number
 and lm.parsed_event_at = r.parsed_event_at
 and lm.event_identity_fingerprint = r.event_identity_fingerprint;

comment on view portal_private.rail_xlsx_dislocation_latest_state_v1 is
'One comparable latest XLSX state per Deal + GU-12/document + wagon. Latest conflict/TO_VERIFY remains fail-closed; no fallback to an older trusted position.';

revoke all on table portal_private.rail_xlsx_dislocation_latest_state_v1
  from public, anon, authenticated;
grant select on table portal_private.rail_xlsx_dislocation_latest_state_v1
  to service_role;

-- rail_wagons remains the current projection. Position-source fields are separate
-- from original row provenance so registration source is never overwritten.
alter table portal_private.rail_wagons
  add column if not exists position_source_system text,
  add column if not exists position_source_event_id uuid,
  add column if not exists position_source_object_id uuid,
  add column if not exists position_semantic_fingerprint text,
  add column if not exists position_resolution_status text;

do $$
begin
  if exists (
    select 1
    from portal_private.rail_wagons
    where rail_document_key is not null
    group by wagon_number, rail_document_key
    having count(*) > 1
  ) then
    raise exception using
      errcode='23505',
      message='RAIL_WAGONS_DOCUMENT_SCOPE_DUPLICATE_PRECHECK';
  end if;
end
$$;

create unique index if not exists rail_wagons_one_per_document_v1
  on portal_private.rail_wagons (wagon_number, rail_document_key)
  where rail_document_key is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
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
    select 1
    from pg_constraint
    where conname='rail_wagons_position_source_object_fk'
      and conrelid='portal_private.rail_wagons'::regclass
  ) then
    alter table portal_private.rail_wagons
      add constraint rail_wagons_position_source_object_fk
      foreign key (position_source_object_id)
      references portal_private.source_objects(id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname='rail_wagons_position_resolution_allowed'
      and conrelid='portal_private.rail_wagons'::regclass
  ) then
    alter table portal_private.rail_wagons
      add constraint rail_wagons_position_resolution_allowed
      check (
        position_resolution_status is null
        or position_resolution_status in (
          'MATCHED','TO_VERIFY','UNRESOLVED','CONFLICT'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname='rail_wagons_position_semantic_fingerprint_format'
      and conrelid='portal_private.rail_wagons'::regclass
  ) then
    alter table portal_private.rail_wagons
      add constraint rail_wagons_position_semantic_fingerprint_format
      check (
        position_semantic_fingerprint is null
        or position_semantic_fingerprint ~ '^[0-9a-f]{64}$'
      );
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
  v_inserted integer := 0;
  v_updated integer := 0;
  v_fail_closed integer := 0;
begin
  -- Insert canonical wagon identities only when Deal + rail document are matched.
  insert into portal_private.rail_wagons (
    wagon_number,
    rail_document_key,
    current_station_name,
    current_station_code,
    operation_code,
    operation_at,
    status,
    last_position_at,
    source_system,
    source_version,
    source_timestamp,
    import_batch_id,
    position_source_system,
    position_source_event_id,
    position_source_object_id,
    position_semantic_fingerprint,
    position_resolution_status
  )
  select
    s.wagon_number,
    s.rail_document_key,
    case when s.latest_position_status='TRUSTED' then s.station_name else null end,
    case when s.latest_position_status='TRUSTED' then s.station_code else null end,
    case when s.latest_position_status='TRUSTED' then s.operation else null end,
    case when s.latest_position_status='TRUSTED' then s.parsed_event_at else null end,
    'REGISTERED',
    case when s.latest_position_status='TRUSTED' then s.parsed_event_at else null end,
    'EXPEDITOR_XLSX_VIA_RAIL_AI',
    'RAIL_XLSX_DISLOCATION_V1',
    s.parsed_event_at,
    s.import_batch_id,
    'EXPEDITOR_XLSX_VIA_RAIL_AI',
    s.id,
    s.source_object_id,
    s.semantic_fingerprint,
    case
      when s.latest_position_status='TRUSTED' then 'MATCHED'
      else s.latest_position_status
    end
  from portal_private.rail_xlsx_dislocation_latest_state_v1 s
  where (p_deal_key is null or s.deal_key=p_deal_key)
    and not exists (
      select 1
      from portal_private.rail_wagons rw
      where rw.wagon_number=s.wagon_number
        and rw.rail_document_key=s.rail_document_key
    );

  get diagnostics v_inserted = row_count;

  -- Refresh only XLSX-owned (or position-unowned) projections.
  update portal_private.rail_wagons rw
  set
    current_station_name = case when s.latest_position_status='TRUSTED' then s.station_name else null end,
    current_station_code = case when s.latest_position_status='TRUSTED' then s.station_code else null end,
    operation_code = case when s.latest_position_status='TRUSTED' then s.operation else null end,
    operation_at = case when s.latest_position_status='TRUSTED' then s.parsed_event_at else null end,
    last_position_at = case when s.latest_position_status='TRUSTED' then s.parsed_event_at else null end,
    position_source_system = 'EXPEDITOR_XLSX_VIA_RAIL_AI',
    position_source_event_id = s.id,
    position_source_object_id = s.source_object_id,
    position_semantic_fingerprint = s.semantic_fingerprint,
    position_resolution_status = case
      when s.latest_position_status='TRUSTED' then 'MATCHED'
      else s.latest_position_status
    end,
    updated_at = now()
  from portal_private.rail_xlsx_dislocation_latest_state_v1 s
  where rw.wagon_number=s.wagon_number
    and rw.rail_document_key=s.rail_document_key
    and (p_deal_key is null or s.deal_key=p_deal_key)
    and (
      rw.position_source_system is null
      or rw.position_source_system='EXPEDITOR_XLSX_VIA_RAIL_AI'
    )
    and (
      rw.position_source_event_id is distinct from s.id
      or rw.position_resolution_status is distinct from
        case when s.latest_position_status='TRUSTED' then 'MATCHED' else s.latest_position_status end
    );

  get diagnostics v_updated = row_count;

  select count(*)
    into v_fail_closed
  from portal_private.rail_xlsx_dislocation_latest_state_v1 s
  where (p_deal_key is null or s.deal_key=p_deal_key)
    and s.latest_position_status <> 'TRUSTED';

  return jsonb_build_object(
    'projectionVersion','RAIL_XLSX_WAGON_PROJECTION_V1',
    'inserted',v_inserted,
    'updated',v_updated,
    'failClosedLatestStates',v_fail_closed
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
  v_actor := portal_private.owner_r1_actor('ADMIN');

  with scoped_deals as (
    select d.id as deal_key, d.deal_id
    from portal_private.deals d
    where d.lifecycle_state::text='ACTIVE'
      and (p_deal_id is null or d.deal_id=p_deal_id)
  ),
  deal_docs as (
    select
      sd.deal_key,
      sd.deal_id,
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
  deal_wagons as (
    select
      dd.deal_key,
      dd.deal_id,
      dd.rail_document_key,
      dd.rail_document_id,
      dd.gu12_number,
      rw.id as wagon_key,
      rw.wagon_number,
      rw.current_station_name,
      rw.current_station_code,
      rw.operation_code,
      rw.operation_at,
      rw.last_position_at,
      rw.position_resolution_status,
      rw.position_source_system,
      rw.position_source_event_id,
      rw.position_source_object_id,
      rw.position_semantic_fingerprint,
      ev.source_checksum_sha256,
      ev.source_row_number,
      ev.source_row_fingerprint,
      ev.import_batch_id as position_import_batch_id,
      ev.raw_timestamp,
      ev.source_timezone,
      ev.source_timezone_status,
      ev.resolution_status as source_resolution_status,
      ev.provenance as source_provenance
    from deal_docs dd
    left join portal_private.rail_wagons rw
      on rw.rail_document_key=dd.rail_document_key
     and rw.lifecycle_state::text='ACTIVE'
    left join portal_private.rail_xlsx_dislocation_events_v1 ev
      on ev.id=rw.position_source_event_id
  )
  select jsonb_build_object(
    'modelVersion','RONA_ADMIN_RAIL_DEAL_READ_MODEL_V1',
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
              order by dd.document_date nulls last, dd.rail_document_id
            )
            from deal_docs dd
            where dd.deal_key=sd.deal_key
          ),'[]'::jsonb),

          -- Planned route is deliberately independent from actual XLSX positions.
          -- B1 exposes source route text/document provenance only. It does NOT
          -- infer map points or geometry from route_text.
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
              order by dd.document_date nulls last, dd.rail_document_id
            )
            from deal_docs dd
            where dd.deal_key=sd.deal_key
          ),'[]'::jsonb),

          'wagonPositions',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'wagonNumber',dw.wagon_number,
                'railDocumentKey',dw.rail_document_key,
                'railDocumentId',dw.rail_document_id,
                'gu12Number',dw.gu12_number,
                'station',dw.current_station_name,
                'stationCode',dw.current_station_code,
                'operation',dw.operation_code,
                'eventTimestamp',dw.last_position_at,
                'positionStatus',coalesce(dw.position_resolution_status,'UNRESOLVED'),
                'trustedCoordinates',null,
                'coordinateProvenance',null,
                'provenance',case
                  when dw.position_source_event_id is null then null
                  else jsonb_build_object(
                    'sourcePolicy','EXPEDITOR_XLSX_VIA_RAIL_AI',
                    'sourceSystem',dw.position_source_system,
                    'eventId',dw.position_source_event_id,
                    'sourceObjectId',dw.position_source_object_id,
                    'importBatchId',dw.position_import_batch_id,
                    'sourceChecksumSha256',dw.source_checksum_sha256,
                    'sourceRowNumber',dw.source_row_number,
                    'sourceRowFingerprint',dw.source_row_fingerprint,
                    'semanticFingerprint',dw.position_semantic_fingerprint,
                    'rawTimestamp',dw.raw_timestamp,
                    'sourceTimezone',dw.source_timezone,
                    'sourceTimezoneStatus',dw.source_timezone_status,
                    'sourceResolutionStatus',dw.source_resolution_status,
                    'sourceProvenance',dw.source_provenance
                  )
                end
              )
              order by dw.wagon_number
            )
            from deal_wagons dw
            where dw.deal_key=sd.deal_key
              and dw.wagon_key is not null
          ),'[]'::jsonb),

          -- Grouping contract for one marker/cluster per station.
          -- No coordinates are synthesized in B1.
          'positionGroups',coalesce((
            select jsonb_agg(g.payload order by g.station_code nulls last, g.station_name)
            from (
              select jsonb_build_object(
                'clusterKey',case
                  when dw.current_station_code is not null
                    then 'ESR:'||upper(btrim(dw.current_station_code))
                  else 'STATION:'||lower(regexp_replace(btrim(dw.current_station_name),'\s+',' ','g'))
                end,
                'station',max(dw.current_station_name),
                'stationCode',max(dw.current_station_code),
                'wagonCount',count(*),
                'wagonNumbers',jsonb_agg(dw.wagon_number order by dw.wagon_number),
                'eventTimestamp',max(dw.last_position_at),
                'trustedCoordinates',null,
                'coordinateProvenance',null
              ) as payload,
              max(dw.current_station_code) as station_code,
              max(dw.current_station_name) as station_name
              from deal_wagons dw
              where dw.deal_key=sd.deal_key
                and dw.wagon_key is not null
                and dw.position_resolution_status='MATCHED'
                and dw.current_station_name is not null
              group by
                case
                  when dw.current_station_code is not null
                    then 'ESR:'||upper(btrim(dw.current_station_code))
                  else 'STATION:'||lower(regexp_replace(btrim(dw.current_station_name),'\s+',' ','g'))
                end
            ) g
          ),'[]'::jsonb),

          'unresolvedXlsxEvents',(
            select count(*)
            from portal_private.rail_xlsx_dislocation_effective_v1 e
            where e.deal_key=sd.deal_key
              and e.position_status in ('TO_VERIFY','UNRESOLVED','CONFLICT')
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
'Admin-only Deal -> rail documents/GU-12 -> rail_wagons current projection -> latest XLSX position read model. Planned route and actual position remain independent. Coordinates are null until a separate source-locked station directory is introduced.';

revoke all on function public.rona_admin_rail_deal_read_model_v1(text)
  from public, anon;
grant execute on function public.rona_admin_rail_deal_read_model_v1(text)
  to authenticated, service_role;

commit;
