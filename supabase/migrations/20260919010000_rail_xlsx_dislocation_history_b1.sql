-- ONLINE RAIL / #644 — STAGE B1.3 SEMANTIC CORRECTION
-- REPOSITORY CANDIDATE ONLY. DO NOT APPLY TO PRODUCTION.
--
-- Invariants:
--   * XLSX evidence is immutable and separate from MOVIZOR rail_movement_events.
--   * Deal remains the canonical business owner. No parallel Deal registry.
--   * unresolved local railway time never becomes fabricated UTC.
--   * business resolution/correction authority must reference existing immutable
--     audit/coordination substrate; service_role/SYSTEM_ADMIN are executors only.
--   * current position is one fail-closed result per effective Deal + wagon.
--   * coordinates are never inferred in this migration.

begin;

create unique index if not exists source_objects_id_import_batch_v1
  on portal_private.source_objects (id, import_batch_id);

-- Canonical source_row validator.
-- JSON shape is intentionally narrow and deterministic:
-- {
--   "schemaVersion":"RAIL_XLSX_SOURCE_ROW_V1",
--   "sheetName":"...",
--   "rowNumber":123,
--   "cells":[
--     {"columnIndex":1,"header":"...","rawType":"STRING","rawValue":"..."}
--   ]
-- }
-- Object key order is canonicalized by jsonb. Cell array order MUST be strictly
-- increasing by columnIndex. rawValue=0 is preserved as JSON number 0.
create or replace function portal_private.rail_xlsx_source_row_is_canonical_v1(
  p_row jsonb,
  p_sheet_name text,
  p_row_number integer
)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
declare
  v_cell jsonb;
  v_prev_index integer := 0;
  v_index integer;
  v_count integer := 0;
  v_type text;
begin
  if jsonb_typeof(p_row) <> 'object' then
    return false;
  end if;

  if (select count(*) from jsonb_object_keys(p_row)) <> 4
     or not (p_row ? 'schemaVersion')
     or not (p_row ? 'sheetName')
     or not (p_row ? 'rowNumber')
     or not (p_row ? 'cells') then
    return false;
  end if;

  if p_row->>'schemaVersion' <> 'RAIL_XLSX_SOURCE_ROW_V1'
     or p_row->>'sheetName' <> p_sheet_name
     or jsonb_typeof(p_row->'rowNumber') <> 'number'
     or (p_row->>'rowNumber') !~ '^[0-9]+$'
     or (p_row->>'rowNumber')::integer <> p_row_number
     or jsonb_typeof(p_row->'cells') <> 'array' then
    return false;
  end if;

  for v_cell in
    select value
    from jsonb_array_elements(p_row->'cells')
  loop
    v_count := v_count + 1;

    if jsonb_typeof(v_cell) <> 'object'
       or (select count(*) from jsonb_object_keys(v_cell)) <> 4
       or not (v_cell ? 'columnIndex')
       or not (v_cell ? 'header')
       or not (v_cell ? 'rawType')
       or not (v_cell ? 'rawValue') then
      return false;
    end if;

    if jsonb_typeof(v_cell->'columnIndex') <> 'number'
       or (v_cell->>'columnIndex') !~ '^[1-9][0-9]*$' then
      return false;
    end if;

    v_index := (v_cell->>'columnIndex')::integer;
    if v_index <= v_prev_index then
      return false;
    end if;
    v_prev_index := v_index;

    if jsonb_typeof(v_cell->'header') <> 'string'
       or btrim(v_cell->>'header') = '' then
      return false;
    end if;

    v_type := v_cell->>'rawType';
    if v_type not in (
      'STRING','NUMBER','BOOLEAN','BLANK','DATE_SERIAL','ERROR'
    ) then
      return false;
    end if;

    if v_type='STRING' and jsonb_typeof(v_cell->'rawValue') <> 'string' then
      return false;
    elsif v_type='NUMBER' and jsonb_typeof(v_cell->'rawValue') <> 'number' then
      return false;
    elsif v_type='BOOLEAN' and jsonb_typeof(v_cell->'rawValue') <> 'boolean' then
      return false;
    elsif v_type='BLANK' and jsonb_typeof(v_cell->'rawValue') <> 'null' then
      return false;
    elsif v_type='DATE_SERIAL'
          and jsonb_typeof(v_cell->'rawValue') not in ('number','string') then
      return false;
    elsif v_type='ERROR' and jsonb_typeof(v_cell->'rawValue') <> 'string' then
      return false;
    end if;
  end loop;

  return v_count > 0;
exception
  when others then
    return false;
end
$$;

revoke all on function portal_private.rail_xlsx_source_row_is_canonical_v1(
  jsonb,text,integer
) from public, anon, authenticated;

create table if not exists portal_private.rail_xlsx_dislocation_events_v1 (
  id uuid primary key default gen_random_uuid(),

  -- source lock
  import_batch_id uuid not null,
  source_object_id uuid not null,
  source_checksum_sha256 text not null,
  source_sheet_name text not null,
  source_row_number integer not null,
  source_row_locator text generated always as (
    source_object_id::text || '|' || source_sheet_name || '|' || source_row_number::text
  ) stored,
  source_row_fingerprint text not null,
  source_row jsonb not null,

  -- verified source policy snapshot
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

  -- railway time
  raw_timestamp text not null,
  event_at_local timestamp without time zone not null,
  parsed_event_at timestamptz,
  source_timezone text,
  source_timezone_status text not null,

  -- immutable initial resolution
  resolution_status text not null,
  resolution_evidence jsonb not null default '{}'::jsonb,

  semantic_fingerprint text not null,
  event_identity_fingerprint text not null,

  provenance jsonb not null,
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

  constraint rail_xlsx_event_wagon_exact_format
    check (wagon_number ~ '^[0-9]{8}$'),
  constraint rail_xlsx_event_sheet_nonblank
    check (btrim(source_sheet_name) <> ''),
  constraint rail_xlsx_event_source_row_positive
    check (source_row_number > 0),
  constraint rail_xlsx_event_source_row_canonical
    check (
      portal_private.rail_xlsx_source_row_is_canonical_v1(
        source_row, source_sheet_name, source_row_number
      )
    ),
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
  constraint rail_xlsx_event_provenance_required
    check (jsonb_typeof(provenance)='object' and provenance <> '{}'::jsonb),
  constraint rail_xlsx_event_resolution_evidence_object
    check (jsonb_typeof(resolution_evidence)='object'),
  constraint rail_xlsx_event_timezone_status_allowed
    check (source_timezone_status in (
      'EXPLICIT_OFFSET','SOURCE_DECLARED','UNRESOLVED','INVALID'
    )),
  constraint rail_xlsx_event_resolution_allowed
    check (resolution_status in (
      'MATCHED','TO_VERIFY','UNRESOLVED','CONFLICT'
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
'Immutable source-locked XLSX dislocation evidence. source locator = source object + sheet + row. Separate from MOVIZOR history.';

comment on column portal_private.rail_xlsx_dislocation_events_v1.source_row is
'Canonical RAIL_XLSX_SOURCE_ROW_V1 raw XLSX row. Original raw values, including numeric 0, are preserved. Leading zeros are never reconstructed after loss.';

comment on column portal_private.rail_xlsx_dislocation_events_v1.event_at_local is
'Parsed local railway wall-clock. For unresolved timezone this is comparable only inside exact source_time_domain; parsed_event_at remains NULL.';

create unique index if not exists rail_xlsx_event_source_locator_unique_v1
  on portal_private.rail_xlsx_dislocation_events_v1
  (source_object_id, source_sheet_name, source_row_number);

create index if not exists rail_xlsx_event_semantic_idx_v1
  on portal_private.rail_xlsx_dislocation_events_v1 (semantic_fingerprint);

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
  for all to authenticated
  using (false) with check (false);

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
  raise exception using errcode='55000', message='RAIL_XLSX_APPEND_ONLY';
end
$$;

revoke all on function portal_private.rail_xlsx_append_only_guard_v1() from public;
grant execute on function portal_private.rail_xlsx_append_only_guard_v1() to service_role;

drop trigger if exists rail_xlsx_dislocation_append_only_v1
  on portal_private.rail_xlsx_dislocation_events_v1;
create trigger rail_xlsx_dislocation_append_only_v1
before update or delete on portal_private.rail_xlsx_dislocation_events_v1
for each row execute function portal_private.rail_xlsx_append_only_guard_v1();

-- Append-only resolution overlay.
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
  authority_type text not null,
  actor_ref uuid not null,
  decided_at timestamptz not null default now(),
  reason_evidence jsonb not null,
  provenance jsonb not null,
  decision_fingerprint text not null,

  constraint rail_xlsx_resolution_status_allowed
    check (resulting_status in ('MATCHED','TO_VERIFY','UNRESOLVED','CONFLICT')),
  constraint rail_xlsx_resolution_authority_allowed
    check (authority_type in (
      'OWNER_EXPLICIT_INSTRUCTION',
      'RAIL_LOGISTICS_VERIFIED_DECISION'
    )),
  constraint rail_xlsx_resolution_reason_required
    check (jsonb_typeof(reason_evidence)='object' and reason_evidence <> '{}'::jsonb),
  constraint rail_xlsx_resolution_provenance_required
    check (jsonb_typeof(provenance)='object' and provenance <> '{}'::jsonb),
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
  for all to authenticated
  using (false) with check (false);

revoke all on table portal_private.rail_xlsx_resolution_decisions_v1
  from public, anon, authenticated, service_role;
grant select on table portal_private.rail_xlsx_resolution_decisions_v1
  to service_role;

drop trigger if exists rail_xlsx_resolution_append_only_v1
  on portal_private.rail_xlsx_resolution_decisions_v1;
create trigger rail_xlsx_resolution_append_only_v1
before update or delete on portal_private.rail_xlsx_resolution_decisions_v1
for each row execute function portal_private.rail_xlsx_append_only_guard_v1();

-- Resolution-only effective scope; correction validation uses this view so
-- correction cannot itself rebind Deal/GU-12.
create or replace view portal_private.rail_xlsx_resolution_effective_v1
with (security_invoker=false)
as
with latest_resolution as (
  select distinct on (d.evidence_event_id)
    d.*
  from portal_private.rail_xlsx_resolution_decisions_v1 d
  order by d.evidence_event_id,d.decided_at desc,d.id desc
)
select
  e.*,
  lr.id as resolution_decision_id,
  coalesce(lr.resulting_status,e.resolution_status) as overlay_resolution_status,
  coalesce(lr.deal_key,e.deal_key) as effective_deal_key,
  coalesce(lr.rail_document_key,e.rail_document_key) as effective_rail_document_key,
  lr.authority_type as resolution_authority_type,
  lr.actor_ref as resolution_actor_ref,
  lr.decided_at as resolution_decided_at,
  lr.reason_evidence as resolution_reason_evidence,
  lr.provenance as resolution_provenance
from portal_private.rail_xlsx_dislocation_events_v1 e
left join latest_resolution lr on lr.evidence_event_id=e.id;

revoke all on table portal_private.rail_xlsx_resolution_effective_v1
  from public, anon, authenticated;
grant select on table portal_private.rail_xlsx_resolution_effective_v1
  to service_role;

-- Explicit append-only correction/supersession relation.
create table if not exists portal_private.rail_xlsx_correction_decisions_v1 (
  id uuid primary key default gen_random_uuid(),
  correction_event_id uuid not null
    references portal_private.rail_xlsx_dislocation_events_v1(id)
    on delete restrict,
  correction_of_event_id uuid not null
    references portal_private.rail_xlsx_dislocation_events_v1(id)
    on delete restrict,
  relation_type text not null,
  authority_type text not null,
  actor_ref uuid not null,
  decided_at timestamptz not null default now(),
  reason_evidence jsonb not null,
  provenance jsonb not null,
  decision_fingerprint text not null,

  constraint rail_xlsx_correction_distinct_events
    check (correction_event_id <> correction_of_event_id),
  constraint rail_xlsx_correction_relation_allowed
    check (relation_type in ('CORRECTION_OF','SUPERSEDES')),
  constraint rail_xlsx_correction_authority_allowed
    check (authority_type in (
      'OWNER_EXPLICIT_CORRECTION',
      'RAIL_LOGISTICS_VERIFIED_EXPEDITOR_CORRECTION'
    )),
  constraint rail_xlsx_correction_reason_required
    check (jsonb_typeof(reason_evidence)='object' and reason_evidence <> '{}'::jsonb),
  constraint rail_xlsx_correction_provenance_required
    check (jsonb_typeof(provenance)='object' and provenance <> '{}'::jsonb),
  constraint rail_xlsx_correction_fingerprint_format
    check (decision_fingerprint ~ '^[0-9a-f]{64}$')
);

-- One old evidence row may be explicitly superseded by only one correction.
-- Further corrections form a chain by superseding the new evidence event.
create unique index if not exists rail_xlsx_correction_single_successor_v1
  on portal_private.rail_xlsx_correction_decisions_v1
  (correction_of_event_id);

create unique index if not exists rail_xlsx_correction_decision_dedupe_v1
  on portal_private.rail_xlsx_correction_decisions_v1
  (correction_event_id, correction_of_event_id, relation_type);

alter table portal_private.rail_xlsx_correction_decisions_v1 enable row level security;
drop policy if exists rona_server_bypass_guard
  on portal_private.rail_xlsx_correction_decisions_v1;
create policy rona_server_bypass_guard
  on portal_private.rail_xlsx_correction_decisions_v1
  for all to authenticated
  using (false) with check (false);

revoke all on table portal_private.rail_xlsx_correction_decisions_v1
  from public, anon, authenticated, service_role;
grant select on table portal_private.rail_xlsx_correction_decisions_v1
  to service_role;

drop trigger if exists rail_xlsx_correction_append_only_v1
  on portal_private.rail_xlsx_correction_decisions_v1;
create trigger rail_xlsx_correction_append_only_v1
before update or delete on portal_private.rail_xlsx_correction_decisions_v1
for each row execute function portal_private.rail_xlsx_append_only_guard_v1();

-- Existing immutable authority substrate is reused:
-- owner authority -> portal_private.audit_events (append-only trigger already exists)
-- Rail authority  -> portal_private.ai_coordination_records (immutable trigger already exists)
-- No parallel authority registry is created.
create or replace function portal_private.rail_xlsx_validate_resolution_authority_v1(
  p_authority_type text,
  p_actor_ref uuid,
  p_evidence_event_id uuid,
  p_resulting_status text,
  p_deal_key uuid,
  p_rail_document_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_audit portal_private.audit_events%rowtype;
  v_coord portal_private.ai_coordination_records%rowtype;
begin
  if p_actor_ref is null then
    raise exception using errcode='23514', message='RAIL_XLSX_AUTHORITY_REF_REQUIRED';
  end if;

  if p_authority_type='OWNER_EXPLICIT_INSTRUCTION' then
    select * into v_audit
    from portal_private.audit_events
    where event_id=p_actor_ref;

    if not found
       or v_audit.actor_role <> 'ADMIN'
       or v_audit.actor_user_id is null
       or v_audit.result::text <> 'SUCCESS'
       or v_audit.action <> 'RAIL_XLSX_OWNER_RESOLUTION_INSTRUCTION'
       or v_audit.entity_type <> 'RAIL_XLSX_EVIDENCE'
       or v_audit.entity_id <> p_evidence_event_id::text
       or v_audit.metadata->>'authority_contract' <> 'RAIL_XLSX_OWNER_AUTHORITY_V1'
       or v_audit.metadata->>'evidenceEventId' <> p_evidence_event_id::text
       or v_audit.metadata->>'resultingStatus' <> p_resulting_status
       or coalesce(v_audit.metadata->>'dealKey','') <> coalesce(p_deal_key::text,'')
       or coalesce(v_audit.metadata->>'railDocumentKey','') <> coalesce(p_rail_document_key::text,'') then
      raise exception using errcode='23514', message='RAIL_XLSX_OWNER_AUTHORITY_INVALID';
    end if;

    return jsonb_build_object(
      'substrate','audit_events',
      'authorityRef',v_audit.event_id,
      'authorityAt',v_audit.event_at,
      'businessActorUserId',v_audit.actor_user_id
    );
  elsif p_authority_type='RAIL_LOGISTICS_VERIFIED_DECISION' then
    select * into v_coord
    from portal_private.ai_coordination_records
    where record_id=p_actor_ref;

    if not found
       or v_coord.functional_role::text <> 'RAIL_LOGISTICS'
       or v_coord.identity_id <> 'AI-RAIL-LOGISTICS'
       or v_coord.record_type <> 'FUNCTIONAL_CONCLUSION'
       or v_coord.status <> 'APPROVED'
       or v_coord.target_type <> 'RAIL_XLSX_EVIDENCE'
       or v_coord.target_id <> p_evidence_event_id::text
       or v_coord.payload->>'authorityContract' <> 'RAIL_XLSX_RAIL_LOGISTICS_AUTHORITY_V1'
       or v_coord.payload->>'authorityType' <> 'RAIL_LOGISTICS_VERIFIED_DECISION'
       or v_coord.payload->>'evidenceEventId' <> p_evidence_event_id::text
       or v_coord.payload->>'resultingStatus' <> p_resulting_status
       or coalesce(v_coord.payload->>'dealKey','') <> coalesce(p_deal_key::text,'')
       or coalesce(v_coord.payload->>'railDocumentKey','') <> coalesce(p_rail_document_key::text,'') then
      raise exception using errcode='23514', message='RAIL_XLSX_RAIL_AUTHORITY_INVALID';
    end if;

    return jsonb_build_object(
      'substrate','ai_coordination_records',
      'authorityRef',v_coord.record_id,
      'authorityAt',v_coord.created_at,
      'businessIdentity',v_coord.identity_id
    );
  else
    raise exception using errcode='23514', message='RAIL_XLSX_RESOLUTION_AUTHORITY_TYPE_INVALID';
  end if;
end
$$;

revoke all on function portal_private.rail_xlsx_validate_resolution_authority_v1(
  text,uuid,uuid,text,uuid,uuid
) from public, anon, authenticated;
grant execute on function portal_private.rail_xlsx_validate_resolution_authority_v1(
  text,uuid,uuid,text,uuid,uuid
) to service_role;

create or replace function portal_private.rail_xlsx_validate_correction_authority_v1(
  p_authority_type text,
  p_actor_ref uuid,
  p_correction_of_event_id uuid,
  p_correction_event_id uuid,
  p_relation_type text,
  p_deal_key uuid,
  p_rail_document_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_audit portal_private.audit_events%rowtype;
  v_coord portal_private.ai_coordination_records%rowtype;
begin
  if p_actor_ref is null then
    raise exception using errcode='23514', message='RAIL_XLSX_AUTHORITY_REF_REQUIRED';
  end if;

  if p_authority_type='OWNER_EXPLICIT_CORRECTION' then
    select * into v_audit
    from portal_private.audit_events
    where event_id=p_actor_ref;

    if not found
       or v_audit.actor_role <> 'ADMIN'
       or v_audit.actor_user_id is null
       or v_audit.result::text <> 'SUCCESS'
       or v_audit.action <> 'RAIL_XLSX_OWNER_CORRECTION_INSTRUCTION'
       or v_audit.entity_type <> 'RAIL_XLSX_EVIDENCE'
       or v_audit.entity_id <> p_correction_of_event_id::text
       or v_audit.metadata->>'authority_contract' <> 'RAIL_XLSX_OWNER_AUTHORITY_V1'
       or v_audit.metadata->>'correctionOfEventId' <> p_correction_of_event_id::text
       or v_audit.metadata->>'correctionEventId' <> p_correction_event_id::text
       or v_audit.metadata->>'relationType' <> p_relation_type
       or v_audit.metadata->>'dealKey' <> p_deal_key::text
       or v_audit.metadata->>'railDocumentKey' <> p_rail_document_key::text then
      raise exception using errcode='23514', message='RAIL_XLSX_OWNER_CORRECTION_AUTHORITY_INVALID';
    end if;

    return jsonb_build_object(
      'substrate','audit_events',
      'authorityRef',v_audit.event_id,
      'authorityAt',v_audit.event_at,
      'businessActorUserId',v_audit.actor_user_id
    );
  elsif p_authority_type='RAIL_LOGISTICS_VERIFIED_EXPEDITOR_CORRECTION' then
    select * into v_coord
    from portal_private.ai_coordination_records
    where record_id=p_actor_ref;

    if not found
       or v_coord.functional_role::text <> 'RAIL_LOGISTICS'
       or v_coord.identity_id <> 'AI-RAIL-LOGISTICS'
       or v_coord.record_type <> 'FUNCTIONAL_CONCLUSION'
       or v_coord.status <> 'APPROVED'
       or v_coord.target_type <> 'RAIL_XLSX_EVIDENCE'
       or v_coord.target_id <> p_correction_of_event_id::text
       or v_coord.payload->>'authorityContract' <> 'RAIL_XLSX_RAIL_LOGISTICS_AUTHORITY_V1'
       or v_coord.payload->>'authorityType' <> 'RAIL_LOGISTICS_VERIFIED_EXPEDITOR_CORRECTION'
       or v_coord.payload->>'correctionOfEventId' <> p_correction_of_event_id::text
       or v_coord.payload->>'correctionEventId' <> p_correction_event_id::text
       or v_coord.payload->>'relationType' <> p_relation_type
       or v_coord.payload->>'dealKey' <> p_deal_key::text
       or v_coord.payload->>'railDocumentKey' <> p_rail_document_key::text then
      raise exception using errcode='23514', message='RAIL_XLSX_RAIL_CORRECTION_AUTHORITY_INVALID';
    end if;

    return jsonb_build_object(
      'substrate','ai_coordination_records',
      'authorityRef',v_coord.record_id,
      'authorityAt',v_coord.created_at,
      'businessIdentity',v_coord.identity_id
    );
  else
    raise exception using errcode='23514', message='RAIL_XLSX_CORRECTION_AUTHORITY_TYPE_INVALID';
  end if;
end
$$;

revoke all on function portal_private.rail_xlsx_validate_correction_authority_v1(
  text,uuid,uuid,uuid,text,uuid,uuid
) from public, anon, authenticated;
grant execute on function portal_private.rail_xlsx_validate_correction_authority_v1(
  text,uuid,uuid,uuid,text,uuid,uuid
) to service_role;

-- Guarded evidence ingest.
create or replace function portal_private.rail_xlsx_dislocation_ingest_v1(
  p_import_batch_id uuid,
  p_source_object_id uuid,
  p_source_sheet_name text,
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
  v_raw_wagon text;
  v_raw_wagon_type text;
  v_wagon_cell_count integer;
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
  if nullif(btrim(coalesce(p_source_sheet_name,'')),'') is null then
    raise exception using errcode='22023', message='RAIL_XLSX_SOURCE_SHEET_REQUIRED';
  end if;
  if p_source_row is null
     or not portal_private.rail_xlsx_source_row_is_canonical_v1(
       p_source_row,p_source_sheet_name,p_source_row_number
     ) then
    raise exception using errcode='22023', message='RAIL_XLSX_SOURCE_ROW_CANONICAL_SHAPE_INVALID';
  end if;
  if p_event_at_local is null then
    raise exception using errcode='22023', message='RAIL_XLSX_EVENT_AT_LOCAL_REQUIRED';
  end if;
  if nullif(btrim(coalesce(p_raw_timestamp,'')),'') is null then
    raise exception using errcode='22023', message='RAIL_XLSX_RAW_TIMESTAMP_REQUIRED';
  end if;
  if p_provenance is null
     or jsonb_typeof(p_provenance)<>'object'
     or p_provenance='{}'::jsonb then
    raise exception using errcode='22023', message='RAIL_XLSX_PROVENANCE_REQUIRED';
  end if;

  -- Canonical wagon value must be present exactly once in the raw row.
  select
    count(*),
    max(c.value->>'rawValue'),
    max(c.value->>'rawType')
  into v_wagon_cell_count,v_raw_wagon,v_raw_wagon_type
  from jsonb_array_elements(p_source_row->'cells') c(value)
  where lower(btrim(c.value->>'header'))='номер вагона';

  if v_wagon_cell_count<>1
     or v_raw_wagon_type not in ('STRING','NUMBER') then
    raise exception using errcode='23514', message='RAIL_XLSX_WAGON_RAW_CELL_INVALID';
  end if;

  -- No guessed reconstruction: normalization only removes whitespace.
  v_wagon:=regexp_replace(btrim(coalesce(p_wagon_number,'')),'\s+','','g');
  if v_wagon !~ '^[0-9]{8}$' then
    raise exception using errcode='23514', message='RAIL_XLSX_WAGON_NUMBER_MUST_BE_8_DIGITS';
  end if;

  if regexp_replace(btrim(coalesce(v_raw_wagon,'')),'\s+','','g') <> v_wagon then
    raise exception using errcode='23514', message='RAIL_XLSX_WAGON_NORMALIZED_RAW_MISMATCH';
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

  v_source_policy:=nullif(v_source.raw_snapshot->>'sourcePolicy','');
  v_source_contract_version:=nullif(v_source.raw_snapshot->>'sourceContractVersion','');
  v_source_time_domain:=nullif(v_source.raw_snapshot->>'sourceTimeDomain','');
  v_source_received_at:=coalesce(v_source.source_timestamp,v_batch.source_timestamp);

  if v_source.source_system <> 'RAIL_AI'
     or v_source.source_object_type <> 'XLSX_WAGON_DISLOCATION'
     or coalesce(v_source.source_version,'') <> 'RAIL_XLSX_DISLOCATION_V1'
     or v_source_policy <> 'EXPEDITOR_XLSX_VIA_RAIL_AI'
     or v_source_contract_version <> 'RAIL_XLSX_DISLOCATION_CONTRACT_V1'
     or v_source_time_domain is null then
    raise exception using errcode='23514', message='RAIL_XLSX_SOURCE_POLICY_CONTRACT_MISMATCH';
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

  if p_rail_document_key is not null then
    select rd.deal_key,rd.rail_document_id,rd.gu12_number
      into v_doc_deal_key,v_rail_document_id,v_gu12_number
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

  v_station_name:=nullif(regexp_replace(btrim(coalesce(p_station_name,'')),'\s+',' ','g'),'');
  v_station_code:=nullif(upper(btrim(coalesce(p_station_code,''))),'');
  v_operation:=nullif(regexp_replace(btrim(coalesce(p_operation,'')),'\s+',' ','g'),'');

  if p_parsed_event_at is not null then
    v_time_identity:='UTC:'||to_char(
      p_parsed_event_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US'
    );
  else
    v_time_identity:='LOCAL_DOMAIN:'||v_source_time_domain||':'||
      to_char(p_event_at_local,'YYYY-MM-DD"T"HH24:MI:SS.US');
  end if;

  v_source_row_fingerprint:=encode(
    extensions.digest(p_source_row::text,'sha256'),'hex'
  );

  v_semantic_fingerprint:=encode(
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

  v_event_identity_fingerprint:=encode(
    extensions.digest(
      concat_ws(E'\x1f',v_wagon,v_time_identity),
      'sha256'
    ),
    'hex'
  );

  select * into v_existing
  from portal_private.rail_xlsx_dislocation_events_v1 e
  where e.source_object_id=p_source_object_id
    and e.source_sheet_name=p_source_sheet_name
    and e.source_row_number=p_source_row_number;

  if found then
    if v_existing.source_row_fingerprint=v_source_row_fingerprint
       and v_existing.semantic_fingerprint=v_semantic_fingerprint then
      return jsonb_build_object(
        'outcome','IDEMPOTENT_REPLAY',
        'eventId',v_existing.id,
        'sourceRowLocator',v_existing.source_row_locator,
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
    import_batch_id,source_object_id,source_checksum_sha256,
    source_sheet_name,source_row_number,source_row_fingerprint,source_row,
    source_policy,source_contract_version,source_system_snapshot,
    source_object_type_snapshot,source_version_snapshot,
    source_received_at,source_time_domain,
    wagon_number,deal_key,deal_id_snapshot,
    rail_document_key,rail_document_id_snapshot,gu12_number_snapshot,
    station_name,station_code,operation,
    raw_timestamp,event_at_local,parsed_event_at,
    source_timezone,source_timezone_status,
    resolution_status,resolution_evidence,
    semantic_fingerprint,event_identity_fingerprint,
    provenance
  )
  values (
    p_import_batch_id,p_source_object_id,lower(v_source.checksum_sha256),
    p_source_sheet_name,p_source_row_number,v_source_row_fingerprint,p_source_row,
    v_source_policy,v_source_contract_version,v_source.source_system,
    v_source.source_object_type,v_source.source_version,
    v_source_received_at,v_source_time_domain,
    v_wagon,p_deal_key,v_deal_id,
    p_rail_document_key,v_rail_document_id,v_gu12_number,
    v_station_name,v_station_code,v_operation,
    btrim(p_raw_timestamp),p_event_at_local,p_parsed_event_at,
    nullif(btrim(coalesce(p_source_timezone,'')),''),p_source_timezone_status,
    p_resolution_status,coalesce(p_resolution_evidence,'{}'::jsonb),
    v_semantic_fingerprint,v_event_identity_fingerprint,
    p_provenance
  )
  returning * into v_inserted;

  return jsonb_build_object(
    'outcome','INSERTED',
    'eventId',v_inserted.id,
    'sourceRowLocator',v_inserted.source_row_locator,
    'sourcePolicy',v_inserted.source_policy,
    'sourceTimeDomain',v_inserted.source_time_domain,
    'semanticFingerprint',v_inserted.semantic_fingerprint,
    'eventIdentityFingerprint',v_inserted.event_identity_fingerprint,
    'resolutionStatus',v_inserted.resolution_status
  );
end
$$;

revoke all on function portal_private.rail_xlsx_dislocation_ingest_v1(
  uuid,uuid,text,integer,jsonb,text,timestamp without time zone,text,text,
  uuid,uuid,text,text,text,timestamptz,text,text,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function portal_private.rail_xlsx_dislocation_ingest_v1(
  uuid,uuid,text,integer,jsonb,text,timestamp without time zone,text,text,
  uuid,uuid,text,text,text,timestamptz,text,text,jsonb,jsonb
) to service_role;

create or replace function portal_private.rail_xlsx_resolution_decide_v1(
  p_evidence_event_id uuid,
  p_resulting_status text,
  p_deal_key uuid,
  p_rail_document_key uuid,
  p_authority_type text,
  p_actor_ref uuid,
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
  v_authority jsonb;
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

  if p_authority_type not in (
    'OWNER_EXPLICIT_INSTRUCTION',
    'RAIL_LOGISTICS_VERIFIED_DECISION'
  ) then
    raise exception using errcode='23514', message='RAIL_XLSX_DECISION_AUTHORITY_INVALID';
  end if;

  if p_actor_ref is null then
    raise exception using errcode='23514', message='RAIL_XLSX_AUTHORITY_REF_REQUIRED';
  end if;

  if p_reason_evidence is null
     or jsonb_typeof(p_reason_evidence)<>'object'
     or p_reason_evidence='{}'::jsonb then
    raise exception using errcode='23514', message='RAIL_XLSX_DECISION_REASON_REQUIRED';
  end if;

  if p_provenance is null
     or jsonb_typeof(p_provenance)<>'object'
     or p_provenance='{}'::jsonb then
    raise exception using errcode='23514', message='RAIL_XLSX_DECISION_PROVENANCE_REQUIRED';
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

  v_authority:=portal_private.rail_xlsx_validate_resolution_authority_v1(
    p_authority_type,p_actor_ref,p_evidence_event_id,p_resulting_status,
    p_deal_key,p_rail_document_key
  );

  v_fp:=encode(
    extensions.digest(
      concat_ws(
        E'\x1f',
        p_evidence_event_id::text,
        p_resulting_status,
        coalesce(p_deal_key::text,''),
        coalesce(p_rail_document_key::text,''),
        p_authority_type,
        p_actor_ref::text,
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
    return jsonb_build_object(
      'outcome','IDEMPOTENT_REPLAY',
      'decisionId',v_existing,
      'authority',v_authority
    );
  end if;

  insert into portal_private.rail_xlsx_resolution_decisions_v1 (
    evidence_event_id,resulting_status,deal_key,rail_document_key,
    authority_type,actor_ref,decided_at,reason_evidence,provenance,decision_fingerprint
  )
  values (
    p_evidence_event_id,p_resulting_status,p_deal_key,p_rail_document_key,
    p_authority_type,p_actor_ref,coalesce(p_decided_at,now()),
    p_reason_evidence,p_provenance,v_fp
  )
  returning id into v_existing;

  return jsonb_build_object(
    'outcome','INSERTED',
    'decisionId',v_existing,
    'authority',v_authority
  );
end
$$;

revoke all on function portal_private.rail_xlsx_resolution_decide_v1(
  uuid,text,uuid,uuid,text,uuid,timestamptz,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function portal_private.rail_xlsx_resolution_decide_v1(
  uuid,text,uuid,uuid,text,uuid,timestamptz,jsonb,jsonb
) to service_role;

-- Guarded correction with effective-scope validation.
create or replace function portal_private.rail_xlsx_correction_decide_v1(
  p_correction_event_id uuid,
  p_correction_of_event_id uuid,
  p_relation_type text,
  p_authority_type text,
  p_actor_ref uuid,
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
  v_new portal_private.rail_xlsx_resolution_effective_v1%rowtype;
  v_old portal_private.rail_xlsx_resolution_effective_v1%rowtype;
  v_existing portal_private.rail_xlsx_correction_decisions_v1%rowtype;
  v_fp text;
  v_authority jsonb;
begin
  if p_correction_event_id=p_correction_of_event_id then
    raise exception using errcode='23514', message='RAIL_XLSX_CORRECTION_SELF_REFERENCE';
  end if;

  if p_relation_type not in ('CORRECTION_OF','SUPERSEDES') then
    raise exception using errcode='23514', message='RAIL_XLSX_CORRECTION_RELATION_INVALID';
  end if;

  if p_authority_type not in (
    'OWNER_EXPLICIT_CORRECTION',
    'RAIL_LOGISTICS_VERIFIED_EXPEDITOR_CORRECTION'
  ) then
    raise exception using errcode='23514', message='RAIL_XLSX_CORRECTION_AUTHORITY_INVALID';
  end if;

  if p_actor_ref is null then
    raise exception using errcode='23514', message='RAIL_XLSX_AUTHORITY_REF_REQUIRED';
  end if;

  if p_reason_evidence is null
     or jsonb_typeof(p_reason_evidence)<>'object'
     or p_reason_evidence='{}'::jsonb then
    raise exception using errcode='23514', message='RAIL_XLSX_CORRECTION_REASON_REQUIRED';
  end if;

  if p_provenance is null
     or jsonb_typeof(p_provenance)<>'object'
     or p_provenance='{}'::jsonb then
    raise exception using errcode='23514', message='RAIL_XLSX_CORRECTION_PROVENANCE_REQUIRED';
  end if;

  select * into v_new
  from portal_private.rail_xlsx_resolution_effective_v1
  where id=p_correction_event_id;
  if not found then
    raise exception using errcode='23503', message='RAIL_XLSX_CORRECTION_EVENT_NOT_FOUND';
  end if;

  select * into v_old
  from portal_private.rail_xlsx_resolution_effective_v1
  where id=p_correction_of_event_id;
  if not found then
    raise exception using errcode='23503', message='RAIL_XLSX_CORRECTION_TARGET_NOT_FOUND';
  end if;

  if v_new.wagon_number<>v_old.wagon_number then
    raise exception using errcode='23514', message='RAIL_XLSX_CORRECTION_WAGON_MISMATCH';
  end if;

  if v_new.effective_deal_key is null
     or v_old.effective_deal_key is null
     or v_new.effective_deal_key<>v_old.effective_deal_key then
    raise exception using errcode='23514', message='RAIL_XLSX_CORRECTION_DEAL_SCOPE_MISMATCH';
  end if;

  if v_new.effective_rail_document_key is null
     or v_old.effective_rail_document_key is null
     or v_new.effective_rail_document_key<>v_old.effective_rail_document_key then
    raise exception using errcode='23514', message='RAIL_XLSX_CORRECTION_DOCUMENT_SCOPE_MISMATCH';
  end if;

  if v_new.provenance is null
     or jsonb_typeof(v_new.provenance)<>'object'
     or v_new.provenance='{}'::jsonb
     or v_new.source_object_id is null
     or nullif(v_new.source_row_locator,'') is null then
    raise exception using errcode='23514', message='RAIL_XLSX_CORRECTION_NEW_EVIDENCE_PROVENANCE_REQUIRED';
  end if;

  -- If old evidence already has an explicit successor, only exact replay is legal.
  select * into v_existing
  from portal_private.rail_xlsx_correction_decisions_v1
  where correction_of_event_id=p_correction_of_event_id
  order by decided_at desc,id desc
  limit 1;

  if found then
    if v_existing.correction_event_id=p_correction_event_id
       and v_existing.relation_type=p_relation_type
       and v_existing.authority_type=p_authority_type
       and v_existing.actor_ref=p_actor_ref then
      return jsonb_build_object(
        'outcome','IDEMPOTENT_REPLAY',
        'decisionId',v_existing.id
      );
    end if;

    raise exception using
      errcode='23514',
      message='RAIL_XLSX_CORRECTION_TARGET_ALREADY_SUPERSEDED_INCOMPATIBLY';
  end if;

  -- No equality requirement for event_identity_fingerprint or source_time_domain:
  -- the correction itself may be correcting time/domain.
  v_authority:=portal_private.rail_xlsx_validate_correction_authority_v1(
    p_authority_type,p_actor_ref,
    p_correction_of_event_id,p_correction_event_id,p_relation_type,
    v_old.effective_deal_key,v_old.effective_rail_document_key
  );

  v_fp:=encode(
    extensions.digest(
      concat_ws(
        E'\x1f',
        p_correction_event_id::text,
        p_correction_of_event_id::text,
        p_relation_type,
        p_authority_type,
        p_actor_ref::text,
        p_reason_evidence::text
      ),
      'sha256'
    ),
    'hex'
  );

  insert into portal_private.rail_xlsx_correction_decisions_v1 (
    correction_event_id,correction_of_event_id,relation_type,
    authority_type,actor_ref,decided_at,
    reason_evidence,provenance,decision_fingerprint
  )
  values (
    p_correction_event_id,p_correction_of_event_id,p_relation_type,
    p_authority_type,p_actor_ref,coalesce(p_decided_at,now()),
    p_reason_evidence,p_provenance,v_fp
  )
  returning * into v_existing;

  return jsonb_build_object(
    'outcome','INSERTED',
    'decisionId',v_existing.id,
    'authority',v_authority
  );
end
$$;

revoke all on function portal_private.rail_xlsx_correction_decide_v1(
  uuid,uuid,text,text,uuid,timestamptz,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function portal_private.rail_xlsx_correction_decide_v1(
  uuid,uuid,text,text,uuid,timestamptz,jsonb,jsonb
) to service_role;

-- Effective evidence = immutable evidence + latest resolution + explicit supersession.
create or replace view portal_private.rail_xlsx_dislocation_effective_v1
with (security_invoker=false)
as
with superseded as (
  select c.correction_of_event_id as evidence_event_id,
         c.id as correction_decision_id,
         c.correction_event_id,
         c.relation_type as correction_relation_type
  from portal_private.rail_xlsx_correction_decisions_v1 c
),
base as (
  select
    r.*,
    s.correction_decision_id,
    s.correction_event_id,
    s.correction_relation_type,
    (s.evidence_event_id is not null) as is_superseded
  from portal_private.rail_xlsx_resolution_effective_v1 r
  left join superseded s on s.evidence_event_id=r.id
),
identity_state as (
  select
    b.event_identity_fingerprint,
    count(distinct b.semantic_fingerprint)
      filter (where not b.is_superseded) as semantic_variant_count
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

-- Latest comparable observation per Deal + rail document + wagon + comparison domain.
-- This is an audit/candidate layer, NOT the single business-current position.
create or replace view portal_private.rail_xlsx_dislocation_latest_state_v1
with (security_invoker=false)
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
with (security_invoker=false)
as
select *
from portal_private.rail_xlsx_dislocation_latest_state_v1
where position_status='TRUSTED';

revoke all on table portal_private.rail_xlsx_dislocation_latest_trusted_v1
  from public, anon, authenticated;
grant select on table portal_private.rail_xlsx_dislocation_latest_trusted_v1
  to service_role;

-- B1.5 business-current position:
-- EXACTLY ONE business-current result per effective Deal + wagon across ALL ACTIVE
-- rail documents, but current eligibility is TRUSTED-only.
--
-- Pending TO_VERIFY / UNRESOLVED / CONFLICT observations never participate in
-- current selection and therefore cannot nullify a single TRUSTED current.
-- >=2 TRUSTED incomparable domains => CROSS_DOMAIN_AMBIGUOUS.
-- 0 TRUSTED observations => no row in the business-current view.
create or replace view portal_private.rail_xlsx_dislocation_current_position_v1
with (security_invoker=false)
as
with active_trusted_candidates as (
  select l.*
  from portal_private.rail_xlsx_dislocation_latest_trusted_v1 l
  join portal_private.rail_documents rd
    on rd.id=l.effective_rail_document_key
   and rd.lifecycle_state::text='ACTIVE'
),
trusted_stats as (
  select
    c.effective_deal_key,
    c.wagon_number,
    count(*) as candidate_observation_count,
    count(distinct c.comparison_domain) as comparison_domain_count
  from active_trusted_candidates c
  group by c.effective_deal_key,c.wagon_number
),
trusted_ranked as (
  select
    c.*,
    row_number() over (
      partition by c.effective_deal_key,c.wagon_number
      order by
        case when c.parsed_event_at is not null then c.parsed_event_at end desc nulls last,
        case when c.parsed_event_at is null then c.event_at_local end desc nulls last,
        c.source_received_at desc,
        c.ingested_at desc,
        c.id desc
    ) as rn
  from active_trusted_candidates c
)
select
  s.effective_deal_key,
  s.wagon_number,
  s.candidate_observation_count,
  s.comparison_domain_count,
  case
    when s.comparison_domain_count>1 then 'CROSS_DOMAIN_AMBIGUOUS'
    else 'TRUSTED'
  end as position_status,

  case when s.comparison_domain_count=1 then r.id end as current_event_id,
  case when s.comparison_domain_count=1 then r.effective_rail_document_key end
    as current_rail_document_key,
  case when s.comparison_domain_count=1 then r.rail_document_id_snapshot end
    as current_rail_document_id,
  case when s.comparison_domain_count=1 then r.gu12_number_snapshot end
    as current_gu12_number,
  case when s.comparison_domain_count=1 then r.comparison_domain end
    as current_comparison_domain,

  case when s.comparison_domain_count=1 then r.station_name end
    as current_station_name,
  case when s.comparison_domain_count=1 then r.station_code end
    as current_station_code,
  case when s.comparison_domain_count=1 then r.operation end
    as current_operation,
  case when s.comparison_domain_count=1 then r.parsed_event_at end
    as current_event_at,
  case when s.comparison_domain_count=1 then r.event_at_local end
    as current_event_at_local,
  case when s.comparison_domain_count=1 then r.raw_timestamp end
    as current_raw_timestamp,
  case when s.comparison_domain_count=1 then r.source_timezone end
    as current_source_timezone,
  case when s.comparison_domain_count=1 then r.source_timezone_status end
    as current_source_timezone_status,
  case when s.comparison_domain_count=1 then r.source_time_domain end
    as current_source_time_domain,

  case when s.comparison_domain_count=1 then r.source_policy end as source_policy,
  case when s.comparison_domain_count=1 then r.source_contract_version end as source_contract_version,
  case when s.comparison_domain_count=1 then r.source_system_snapshot end as source_system_snapshot,
  case when s.comparison_domain_count=1 then r.source_object_type_snapshot end as source_object_type_snapshot,
  case when s.comparison_domain_count=1 then r.source_version_snapshot end as source_version_snapshot,
  case when s.comparison_domain_count=1 then r.source_received_at end as source_received_at,
  case when s.comparison_domain_count=1 then r.source_object_id end as source_object_id,
  case when s.comparison_domain_count=1 then r.import_batch_id end as import_batch_id,
  case when s.comparison_domain_count=1 then r.source_checksum_sha256 end as source_checksum_sha256,
  case when s.comparison_domain_count=1 then r.source_sheet_name end as source_sheet_name,
  case when s.comparison_domain_count=1 then r.source_row_number end as source_row_number,
  case when s.comparison_domain_count=1 then r.source_row_locator end as source_row_locator,
  case when s.comparison_domain_count=1 then r.source_row_fingerprint end as source_row_fingerprint,
  case when s.comparison_domain_count=1 then r.semantic_fingerprint end as semantic_fingerprint,
  case when s.comparison_domain_count=1 then r.effective_resolution_status end as effective_resolution_status,
  case when s.comparison_domain_count=1 then r.resolution_decision_id end as resolution_decision_id,
  case when s.comparison_domain_count=1 then r.resolution_authority_type end as resolution_authority_type,
  case when s.comparison_domain_count=1 then r.resolution_actor_ref end as resolution_actor_ref,
  case when s.comparison_domain_count=1 then r.provenance end as source_provenance
from trusted_stats s
join trusted_ranked r
  on r.effective_deal_key=s.effective_deal_key
 and r.wagon_number=s.wagon_number
 and r.rn=1;

comment on view portal_private.rail_xlsx_dislocation_current_position_v1 is
'B1.5 TRUSTED-only business-current result per effective Deal + wagon. Pending observations never nullify a single trusted current. More than one incomparable TRUSTED domain fails closed as CROSS_DOMAIN_AMBIGUOUS. Zero TRUSTED observations produce no business-current row.';

revoke all on table portal_private.rail_xlsx_dislocation_current_position_v1
  from public, anon, authenticated;
grant select on table portal_private.rail_xlsx_dislocation_current_position_v1
  to service_role;

-- Audit/details retains every active latest observation that is NOT the selected
-- single current event. This includes:
--   * all observations for CROSS_DOMAIN_AMBIGUOUS wagons;
--   * pending TO_VERIFY / UNRESOLVED / CONFLICT observations alongside a TRUSTED current;
--   * all observations when there is no TRUSTED current;
--   * non-selected TRUSTED candidates inside the one comparable trusted domain.
create or replace view portal_private.rail_xlsx_dislocation_current_audit_v1
with (security_invoker=false)
as
with active_latest as (
  select l.*
  from portal_private.rail_xlsx_dislocation_latest_state_v1 l
  join portal_private.rail_documents rd
    on rd.id=l.effective_rail_document_key
   and rd.lifecycle_state::text='ACTIVE'
)
select
  l.effective_deal_key,
  l.wagon_number,
  coalesce(cp.position_status,'NO_TRUSTED_CURRENT') as current_position_status,
  coalesce(cp.comparison_domain_count,0) as comparison_domain_count,
  coalesce(cp.candidate_observation_count,0) as candidate_observation_count,
  l.id as candidate_event_id,
  l.effective_rail_document_key,
  l.rail_document_id_snapshot,
  l.gu12_number_snapshot,
  l.comparison_domain,
  l.position_status as candidate_position_status,
  l.station_name,
  l.station_code,
  l.operation,
  l.parsed_event_at,
  l.event_at_local,
  l.raw_timestamp,
  l.source_timezone_status,
  l.source_time_domain,
  l.source_object_id,
  l.source_sheet_name,
  l.source_row_number,
  l.source_row_locator,
  l.source_checksum_sha256,
  l.semantic_fingerprint
from active_latest l
left join portal_private.rail_xlsx_dislocation_current_position_v1 cp
  on cp.effective_deal_key=l.effective_deal_key
 and cp.wagon_number=l.wagon_number
where cp.current_event_id is null
   or l.id<>cp.current_event_id;

revoke all on table portal_private.rail_xlsx_dislocation_current_audit_v1
  from public, anon, authenticated;
grant select on table portal_private.rail_xlsx_dislocation_current_audit_v1
  to service_role;

-- Existing rail_wagons stays a current projection. No auto-create while status
-- lifecycle vs operational semantics are not separated.
alter table portal_private.rail_wagons
  add column if not exists position_source_system text,
  add column if not exists position_source_policy text,
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
  v_cross_domain_ambiguous integer:=0;
begin
  -- Exactly one current-position row per Deal+wagon is consumed.
  -- CROSS_DOMAIN_AMBIGUOUS / TO_VERIFY / CONFLICT / UNRESOLVED never update projection.
  update portal_private.rail_wagons rw
  set
    current_station_name=cp.current_station_name,
    current_station_code=cp.current_station_code,
    operation_code=cp.current_operation,
    operation_at=cp.current_event_at,
    last_position_at=cp.current_event_at,
    source_timestamp=cp.source_received_at,
    position_source_system=cp.source_system_snapshot,
    position_source_policy=cp.source_policy,
    position_source_event_id=cp.current_event_id,
    position_source_object_id=cp.source_object_id,
    position_semantic_fingerprint=cp.semantic_fingerprint,
    position_resolution_status='MATCHED',
    position_event_at_local=cp.current_event_at_local,
    position_source_time_domain=cp.current_source_time_domain,
    position_source_timezone_status=cp.current_source_timezone_status,
    updated_at=now()
  from portal_private.rail_xlsx_dislocation_current_position_v1 cp
  where cp.position_status='TRUSTED'
    and cp.comparison_domain_count=1
    and cp.current_event_id is not null
    and rw.wagon_number=cp.wagon_number
    and rw.rail_document_key=cp.current_rail_document_key
    and (p_deal_key is null or cp.effective_deal_key=p_deal_key)
    and (
      rw.position_source_system is null
      or rw.position_source_system='RAIL_AI'
    )
    and (
      rw.position_source_event_id is distinct from cp.current_event_id
      or rw.position_resolution_status is distinct from 'MATCHED'
    );

  get diagnostics v_updated=row_count;

  select count(*) into v_missing_wagon_rows
  from portal_private.rail_xlsx_dislocation_current_position_v1 cp
  where cp.position_status='TRUSTED'
    and cp.comparison_domain_count=1
    and (p_deal_key is null or cp.effective_deal_key=p_deal_key)
    and not exists (
      select 1
      from portal_private.rail_wagons rw
      where rw.wagon_number=cp.wagon_number
        and rw.rail_document_key=cp.current_rail_document_key
    );

  select count(*) into v_cross_domain_ambiguous
  from portal_private.rail_xlsx_dislocation_current_position_v1 cp
  where cp.position_status='CROSS_DOMAIN_AMBIGUOUS'
    and (p_deal_key is null or cp.effective_deal_key=p_deal_key);

  return jsonb_build_object(
    'projectionVersion','RAIL_XLSX_WAGON_PROJECTION_V1_5',
    'updatedExistingRows',v_updated,
    'missingWagonRowsNotCreated',v_missing_wagon_rows,
    'crossDomainAmbiguousBlocked',v_cross_domain_ambiguous,
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
  current_positions as (
    select cp.*
    from portal_private.rail_xlsx_dislocation_current_position_v1 cp
    join scoped_deals sd on sd.deal_key=cp.effective_deal_key
  ),
  current_audit as (
    select a.*
    from portal_private.rail_xlsx_dislocation_current_audit_v1 a
    join scoped_deals sd on sd.deal_key=a.effective_deal_key
  )
  select jsonb_build_object(
    'modelVersion','RONA_ADMIN_RAIL_DEAL_READ_MODEL_V1_5',
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

          -- Exactly one row per Deal+wagon.
          'wagonPositions',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'wagonNumber',cp.wagon_number,
                'railDocumentKey',cp.current_rail_document_key,
                'railDocumentId',cp.current_rail_document_id,
                'gu12Number',cp.current_gu12_number,
                'station',cp.current_station_name,
                'stationCode',cp.current_station_code,
                'operation',cp.current_operation,
                'eventTimestamp',cp.current_event_at,
                'eventAtLocal',cp.current_event_at_local,
                'rawTimestamp',cp.current_raw_timestamp,
                'sourceTimezone',cp.current_source_timezone,
                'sourceTimezoneStatus',cp.current_source_timezone_status,
                'sourceTimeDomain',cp.current_source_time_domain,
                'comparisonDomain',cp.current_comparison_domain,
                'positionStatus',cp.position_status,
                'comparisonDomainCount',cp.comparison_domain_count,
                'candidateObservationCount',cp.candidate_observation_count,
                'effectiveResolutionStatus',cp.effective_resolution_status,
                'resolutionDecisionId',cp.resolution_decision_id,
                'trustedCoordinates',null,
                'coordinateProvenance',null,
                'provenance',case
                  when cp.current_event_id is null then null
                  else jsonb_build_object(
                    'sourcePolicy',cp.source_policy,
                    'sourceContractVersion',cp.source_contract_version,
                    'sourceSystem',cp.source_system_snapshot,
                    'sourceObjectType',cp.source_object_type_snapshot,
                    'sourceVersion',cp.source_version_snapshot,
                    'eventId',cp.current_event_id,
                    'sourceObjectId',cp.source_object_id,
                    'importBatchId',cp.import_batch_id,
                    'sourceChecksumSha256',cp.source_checksum_sha256,
                    'sourceSheetName',cp.source_sheet_name,
                    'sourceRowNumber',cp.source_row_number,
                    'sourceRowLocator',cp.source_row_locator,
                    'sourceRowFingerprint',cp.source_row_fingerprint,
                    'semanticFingerprint',cp.semantic_fingerprint,
                    'sourceReceivedAt',cp.source_received_at,
                    'resolutionAuthorityType',cp.resolution_authority_type,
                    'resolutionActorRef',cp.resolution_actor_ref,
                    'sourceProvenance',cp.source_provenance
                  )
                end
              )
              order by cp.wagon_number
            )
            from current_positions cp
            where cp.effective_deal_key=sd.deal_key
          ),'[]'::jsonb),

          -- Candidate observations are exposed only in audit/details.
          'positionAuditDetails',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'wagonNumber',a.wagon_number,
                'currentPositionStatus',a.current_position_status,
                'comparisonDomainCount',a.comparison_domain_count,
                'candidateObservationCount',a.candidate_observation_count,
                'candidateEventId',a.candidate_event_id,
                'railDocumentKey',a.effective_rail_document_key,
                'railDocumentId',a.rail_document_id_snapshot,
                'gu12Number',a.gu12_number_snapshot,
                'comparisonDomain',a.comparison_domain,
                'candidatePositionStatus',a.candidate_position_status,
                'station',a.station_name,
                'stationCode',a.station_code,
                'operation',a.operation,
                'eventTimestamp',a.parsed_event_at,
                'eventAtLocal',a.event_at_local,
                'rawTimestamp',a.raw_timestamp,
                'sourceTimezoneStatus',a.source_timezone_status,
                'sourceTimeDomain',a.source_time_domain,
                'sourceObjectId',a.source_object_id,
                'sourceSheetName',a.source_sheet_name,
                'sourceRowNumber',a.source_row_number,
                'sourceRowLocator',a.source_row_locator,
                'sourceChecksumSha256',a.source_checksum_sha256,
                'semanticFingerprint',a.semantic_fingerprint
              )
              order by a.wagon_number,a.comparison_domain,a.candidate_event_id
            )
            from current_audit a
            where a.effective_deal_key=sd.deal_key
          ),'[]'::jsonb),

          -- Ambiguous/untrusted rows never enter map groups.
          'positionGroups',coalesce((
            select jsonb_agg(g.payload order by g.station_code nulls last,g.station_name)
            from (
              select
                jsonb_build_object(
                  'clusterKey',case
                    when cp.current_station_code is not null
                      then 'ESR:'||upper(btrim(cp.current_station_code))
                    else 'STATION:'||lower(regexp_replace(btrim(cp.current_station_name),'\s+',' ','g'))
                  end,
                  'station',max(cp.current_station_name),
                  'stationCode',max(cp.current_station_code),
                  'wagonCount',count(*),
                  'wagonNumbers',jsonb_agg(cp.wagon_number order by cp.wagon_number),
                  'eventTimestamp',max(cp.current_event_at),
                  'eventAtLocal',max(cp.current_event_at_local),
                  'trustedCoordinates',null,
                  'coordinateProvenance',null
                ) as payload,
                max(cp.current_station_code) as station_code,
                max(cp.current_station_name) as station_name
              from current_positions cp
              where cp.effective_deal_key=sd.deal_key
                and cp.position_status='TRUSTED'
                and cp.current_station_name is not null
              group by case
                when cp.current_station_code is not null
                  then 'ESR:'||upper(btrim(cp.current_station_code))
                else 'STATION:'||lower(regexp_replace(btrim(cp.current_station_name),'\s+',' ','g'))
              end
            ) g
          ),'[]'::jsonb),

          'unresolvedOrConflictCount',(
            select count(distinct q.wagon_number)
            from (
              select cp.wagon_number
              from current_positions cp
              where cp.effective_deal_key=sd.deal_key
                and cp.position_status='CROSS_DOMAIN_AMBIGUOUS'
              union all
              select a.wagon_number
              from current_audit a
              where a.effective_deal_key=sd.deal_key
                and a.candidate_position_status in ('TO_VERIFY','UNRESOLVED','CONFLICT')
            ) q
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
'Admin-only Deal rail read model B1.5. Business-current selection is TRUSTED-only. Pending observations remain in positionAuditDetails and cannot nullify a single trusted current; multiple incomparable TRUSTED domains fail closed as CROSS_DOMAIN_AMBIGUOUS.';

revoke all on function public.rona_admin_rail_deal_read_model_v1(text)
  from public, anon;
grant execute on function public.rona_admin_rail_deal_read_model_v1(text)
  to authenticated, service_role;

commit;
