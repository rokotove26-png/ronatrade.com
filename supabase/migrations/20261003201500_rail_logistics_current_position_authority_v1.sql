-- Owner instruction 2026-10-03:
-- Admin -> Online Rail is owned by RAIL_LOGISTICS for current wagon dislocation.
-- OPERATIONS_DIRECTOR and other roles are notification/read consumers, not approval gates.
-- This delta preserves historical XLSX evidence and overlays only an explicitly confirmed
-- RAIL_LOGISTICS current-position fact. No physical arrival timestamp is invented.

begin;

create table if not exists portal_private.rail_logistics_current_position_confirmations_v1 (
  id uuid primary key default gen_random_uuid(),
  coordination_record_id uuid not null references portal_private.ai_coordination_records(record_id),
  deal_key uuid not null references portal_private.deals(id),
  deal_id text not null,
  rail_document_key uuid not null references portal_private.rail_documents(id),
  wagon_number text not null,
  wagon_ordinal integer not null check (wagon_ordinal > 0),
  station_name text not null,
  station_code text not null,
  operation text,
  confirmed_at timestamptz not null,
  arrival_timestamp_asserted boolean not null default false check (arrival_timestamp_asserted=false),
  authority_role text not null default 'RAIL_LOGISTICS' check (authority_role='RAIL_LOGISTICS'),
  authority_identity_id text not null default 'AI-RAIL-LOGISTICS' check (authority_identity_id='AI-RAIL-LOGISTICS'),
  authority_basis text not null,
  payload_hash text,
  source_refs jsonb not null default '[]'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  row_fingerprint text not null,
  semantic_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique(coordination_record_id,wagon_number)
);

revoke all on portal_private.rail_logistics_current_position_confirmations_v1 from public,anon,authenticated;

create index if not exists rail_logistics_position_confirmation_current_idx_v1
on portal_private.rail_logistics_current_position_confirmations_v1(deal_key,wagon_number,confirmed_at desc,created_at desc);

create or replace function portal_private.prevent_rail_logistics_position_confirmation_mutation_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,portal_private
as $$
begin
  raise exception 'RAIL_LOGISTICS_POSITION_CONFIRMATION_IMMUTABLE';
end
$$;

drop trigger if exists trg_rail_logistics_position_confirmation_immutable_v1
on portal_private.rail_logistics_current_position_confirmations_v1;
create trigger trg_rail_logistics_position_confirmation_immutable_v1
before update or delete on portal_private.rail_logistics_current_position_confirmations_v1
for each row execute function portal_private.prevent_rail_logistics_position_confirmation_mutation_v1();

create or replace function portal_private.materialize_rail_logistics_current_position_v1(p_record_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,portal_private
as $$
declare
  v_record portal_private.ai_coordination_records%rowtype;
  v_action text;
  v_state jsonb;
  v_rows jsonb;
  v_item jsonb;
  v_deal_key uuid;
  v_wagon text;
  v_station_name text;
  v_station_code text;
  v_operation text;
  v_rail_document_key uuid;
  v_ordinal integer:=0;
  v_inserted integer:=0;
  v_authority_basis text;
begin
  select * into v_record
  from portal_private.ai_coordination_records
  where record_id=p_record_id;

  if not found then
    return jsonb_build_object('materialized',false,'reason','COORDINATION_RECORD_NOT_FOUND');
  end if;

  if v_record.record_type<>'BUSINESS_CHANGE_PROPOSAL'
     or v_record.functional_role::text<>'RAIL_LOGISTICS'
     or coalesce(v_record.identity_id,'')<>'AI-RAIL-LOGISTICS'
     or coalesce(v_record.qa_only,false)
     or v_record.target_type<>'DEAL'
     or v_record.status<>'PROPOSED' then
    return jsonb_build_object('materialized',false,'reason','NOT_RAIL_LOGISTICS_CONFIRMED_POSITION_PROPOSAL');
  end if;

  v_action:=upper(coalesce(v_record.payload->>'proposed_action',''));

  select d.id into v_deal_key
  from portal_private.deals d
  where d.deal_id=v_record.target_id
    and d.lifecycle_state::text='ACTIVE'
  limit 1;

  if v_deal_key is null then
    return jsonb_build_object('materialized',false,'reason','DEAL_NOT_ACTIVE_OR_NOT_FOUND');
  end if;

  if v_action in (
    'OWNER_CONFIRMED_DESTINATION_POSITION',
    'RAIL_LOGISTICS_CONFIRM_CURRENT_POSITION',
    'RAIL_LOGISTICS_CONFIRMED_CURRENT_POSITION'
  ) then
    v_state:=coalesce(v_record.payload->'proposed_state','{}'::jsonb);

    if v_action='OWNER_CONFIRMED_DESTINATION_POSITION'
       and coalesce(v_state->>'fact_semantics','')<>'CURRENT_POSITION_CONFIRMED_BY_OWNER' then
      return jsonb_build_object('materialized',false,'reason','OWNER_CONFIRMATION_SEMANTICS_REQUIRED');
    end if;

    if v_action in ('RAIL_LOGISTICS_CONFIRM_CURRENT_POSITION','RAIL_LOGISTICS_CONFIRMED_CURRENT_POSITION')
       and coalesce(v_state->>'fact_semantics','') not in (
         'CURRENT_POSITION_CONFIRMED_BY_RAIL_LOGISTICS',
         'CURRENT_POSITION_CONFIRMED'
       ) then
      return jsonb_build_object('materialized',false,'reason','RAIL_LOGISTICS_CONFIRMATION_SEMANTICS_REQUIRED');
    end if;

    v_station_name:=nullif(btrim(v_state->>'station_name'),'');
    v_station_code:=nullif(btrim(v_state->>'station_code'),'');
    v_operation:=nullif(btrim(v_state->>'operation'),'');
    v_rows:=v_state->'wagons';
    v_authority_basis:=coalesce(nullif(v_state->>'fact_semantics',''),v_action);

    if v_station_name is null or v_station_code is null
       or jsonb_typeof(v_rows)<>'array' or jsonb_array_length(v_rows)=0 then
      return jsonb_build_object('materialized',false,'reason','CONFIRMED_POSITION_PAYLOAD_INCOMPLETE');
    end if;

    for v_item in select value from jsonb_array_elements(v_rows)
    loop
      v_ordinal:=v_ordinal+1;
      v_wagon:=case
        when jsonb_typeof(v_item)='string' then nullif(btrim(v_item#>>'{}'),'')
        else coalesce(nullif(btrim(v_item->>'wagon'),''),
                      nullif(btrim(v_item->>'wagonNumber'),''))
      end;
      if v_wagon is null then
        continue;
      end if;

      if jsonb_typeof(v_item)='object' then
        v_station_name:=coalesce(nullif(btrim(v_item->>'station'),''),
                                 nullif(btrim(v_item->>'station_name'),''),
                                 nullif(btrim(v_state->>'station_name'),''));
        v_station_code:=coalesce(nullif(btrim(v_item->>'stationCode'),''),
                                 nullif(btrim(v_item->>'station_code'),''),
                                 nullif(btrim(v_state->>'station_code'),''));
        v_operation:=coalesce(nullif(btrim(v_item->>'operation'),''),
                              nullif(btrim(v_state->>'operation'),''));
      else
        v_station_name:=nullif(btrim(v_state->>'station_name'),'');
        v_station_code:=nullif(btrim(v_state->>'station_code'),'');
        v_operation:=nullif(btrim(v_state->>'operation'),'');
      end if;

      select cp.current_rail_document_key
      into v_rail_document_key
      from portal_private.rail_xlsx_dislocation_current_position_v1 cp
      where cp.effective_deal_key=v_deal_key
        and cp.wagon_number=v_wagon
      order by cp.source_received_at desc nulls last
      limit 1;

      if v_rail_document_key is null then
        select rw.rail_document_key
        into v_rail_document_key
        from portal_private.rail_wagons rw
        join portal_private.rail_documents rd on rd.id=rw.rail_document_key
        where rd.deal_key=v_deal_key
          and rw.wagon_number=v_wagon
          and rd.lifecycle_state::text='ACTIVE'
        order by rw.updated_at desc nulls last
        limit 1;
      end if;

      if v_rail_document_key is null then
        return jsonb_build_object(
          'materialized',false,
          'reason','WAGON_NOT_REGISTERED_FOR_DEAL',
          'wagonNumber',v_wagon
        );
      end if;

      insert into portal_private.rail_logistics_current_position_confirmations_v1(
        coordination_record_id,deal_key,deal_id,rail_document_key,wagon_number,wagon_ordinal,
        station_name,station_code,operation,confirmed_at,arrival_timestamp_asserted,
        authority_role,authority_identity_id,authority_basis,payload_hash,
        source_refs,evidence_refs,source_payload,row_fingerprint,semantic_fingerprint
      ) values(
        v_record.record_id,v_deal_key,v_record.target_id,v_rail_document_key,v_wagon,v_ordinal,
        v_station_name,v_station_code,v_operation,v_record.created_at,false,
        'RAIL_LOGISTICS','AI-RAIL-LOGISTICS',v_authority_basis,v_record.payload_hash,
        coalesce(v_record.source_refs,'[]'::jsonb),
        coalesce(v_record.evidence_refs,'[]'::jsonb),
        v_record.payload,
        md5(v_record.record_id::text||'|'||v_wagon||'|'||v_station_code||'|'||v_station_name),
        md5(v_record.target_id||'|'||v_wagon||'|'||v_station_code||'|'||v_station_name)
      )
      on conflict(coordination_record_id,wagon_number) do nothing;

      if found then v_inserted:=v_inserted+1; end if;
    end loop;

  elsif v_action='MATERIALIZE_CONFIRMED_CURRENT_RAIL_MOVEMENT_FROM_OWNER_VALIDATED_SNAPSHOT' then
    v_state:=coalesce(v_record.payload->'proposed_value','{}'::jsonb);
    if coalesce(v_state->>'trusted_source_status','')<>'CONFIRMED_BY_OWNER'
       or coalesce(v_state->>'classification','')<>'CONFIRMED_CURRENT_MOVEMENT_OWNER_VALIDATED'
       or jsonb_typeof(v_state->'rows')<>'array' then
      return jsonb_build_object('materialized',false,'reason','CONFIRMED_MOVEMENT_PAYLOAD_INVALID');
    end if;

    v_authority_basis:='CONFIRMED_CURRENT_MOVEMENT_OWNER_VALIDATED';
    for v_item in select value from jsonb_array_elements(v_state->'rows')
    loop
      v_ordinal:=v_ordinal+1;
      v_wagon:=nullif(btrim(v_item->>'wagon'),'');
      v_station_name:=nullif(btrim(v_item->>'station'),'');
      v_station_code:=nullif(btrim(v_item->>'station_code'),'');
      v_operation:=nullif(btrim(v_item->>'operation_code'),'');

      if v_wagon is null or v_station_name is null or v_station_code is null then
        continue;
      end if;

      select cp.current_rail_document_key into v_rail_document_key
      from portal_private.rail_xlsx_dislocation_current_position_v1 cp
      where cp.effective_deal_key=v_deal_key and cp.wagon_number=v_wagon
      order by cp.source_received_at desc nulls last limit 1;

      if v_rail_document_key is null then
        select rw.rail_document_key into v_rail_document_key
        from portal_private.rail_wagons rw
        join portal_private.rail_documents rd on rd.id=rw.rail_document_key
        where rd.deal_key=v_deal_key and rw.wagon_number=v_wagon
          and rd.lifecycle_state::text='ACTIVE'
        order by rw.updated_at desc nulls last limit 1;
      end if;

      if v_rail_document_key is null then
        return jsonb_build_object('materialized',false,'reason','WAGON_NOT_REGISTERED_FOR_DEAL','wagonNumber',v_wagon);
      end if;

      insert into portal_private.rail_logistics_current_position_confirmations_v1(
        coordination_record_id,deal_key,deal_id,rail_document_key,wagon_number,wagon_ordinal,
        station_name,station_code,operation,confirmed_at,arrival_timestamp_asserted,
        authority_role,authority_identity_id,authority_basis,payload_hash,
        source_refs,evidence_refs,source_payload,row_fingerprint,semantic_fingerprint
      ) values(
        v_record.record_id,v_deal_key,v_record.target_id,v_rail_document_key,v_wagon,v_ordinal,
        v_station_name,v_station_code,v_operation,v_record.created_at,false,
        'RAIL_LOGISTICS','AI-RAIL-LOGISTICS',v_authority_basis,v_record.payload_hash,
        coalesce(v_record.source_refs,'[]'::jsonb),
        coalesce(v_record.evidence_refs,'[]'::jsonb),
        v_record.payload,
        md5(v_record.record_id::text||'|'||v_wagon||'|'||v_station_code||'|'||v_station_name),
        md5(v_record.target_id||'|'||v_wagon||'|'||v_station_code||'|'||v_station_name)
      )
      on conflict(coordination_record_id,wagon_number) do nothing;

      if found then v_inserted:=v_inserted+1; end if;
    end loop;
  else
    return jsonb_build_object('materialized',false,'reason','PROPOSED_ACTION_NOT_AUTHORIZED_FOR_AUTO_MATERIALIZATION');
  end if;

  return jsonb_build_object(
    'materialized',true,
    'coordinationRecordId',v_record.record_id,
    'dealId',v_record.target_id,
    'rowsInserted',v_inserted,
    'authorityRole','RAIL_LOGISTICS',
    'approvalGate','NONE',
    'arrivalTimestampAsserted',false
  );
end
$$;

revoke all on function portal_private.materialize_rail_logistics_current_position_v1(uuid)
from public,anon,authenticated;

create or replace function portal_private.trg_materialize_rail_logistics_current_position_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,portal_private
as $$
declare
  v_result jsonb;
begin
  if new.record_type='BUSINESS_CHANGE_PROPOSAL'
     and new.functional_role::text='RAIL_LOGISTICS'
     and coalesce(new.identity_id,'')='AI-RAIL-LOGISTICS'
     and coalesce(new.qa_only,false)=false
     and new.target_type='DEAL'
     and new.status='PROPOSED' then
    begin
      v_result:=portal_private.materialize_rail_logistics_current_position_v1(new.record_id);
    exception when others then
      raise warning 'Rail Logistics current position materialization isolated failure: %',left(sqlerrm,500);
    end;
  end if;
  return new;
end
$$;

drop trigger if exists trg_materialize_rail_logistics_current_position_v1
on portal_private.ai_coordination_records;
create trigger trg_materialize_rail_logistics_current_position_v1
after insert on portal_private.ai_coordination_records
for each row execute function portal_private.trg_materialize_rail_logistics_current_position_v1();

create or replace view portal_private.rail_operational_current_position_v1
with (security_invoker=true)
as
with latest_confirmation as (
  select distinct on (c.deal_key,c.wagon_number)
    c.*
  from portal_private.rail_logistics_current_position_confirmations_v1 c
  order by c.deal_key,c.wagon_number,c.confirmed_at desc,c.created_at desc,c.id desc
),
keys as (
  select cp.effective_deal_key as deal_key,cp.wagon_number
  from portal_private.rail_xlsx_dislocation_current_position_v1 cp
  union
  select c.deal_key,c.wagon_number from latest_confirmation c
)
select
  k.deal_key as effective_deal_key,
  k.wagon_number,
  coalesce(cp.candidate_observation_count,1::bigint) as candidate_observation_count,
  case when c.id is not null then 1::bigint else coalesce(cp.comparison_domain_count,1::bigint) end as comparison_domain_count,
  case when c.id is not null then 'TRUSTED' else cp.position_status end as position_status,
  coalesce(c.id,cp.current_event_id) as current_event_id,
  coalesce(c.rail_document_key,cp.current_rail_document_key) as current_rail_document_key,
  coalesce(rd.rail_document_id,cp.current_rail_document_id) as current_rail_document_id,
  coalesce(rd.gu12_number,cp.current_gu12_number) as current_gu12_number,
  case when c.id is not null then 'RAIL_LOGISTICS_CONFIRMATION' else cp.current_comparison_domain end as current_comparison_domain,
  coalesce(c.station_name,cp.current_station_name) as current_station_name,
  coalesce(c.station_code,cp.current_station_code) as current_station_code,
  case when c.id is not null then c.operation else cp.current_operation end as current_operation,
  case when c.id is not null then c.confirmed_at else cp.current_event_at end as current_event_at,
  case when c.id is not null then c.confirmed_at at time zone 'UTC' else cp.current_event_at_local end as current_event_at_local,
  case when c.id is not null then 'NOT_ASSERTED' else cp.current_raw_timestamp end as current_raw_timestamp,
  case when c.id is not null then 'UTC' else cp.current_source_timezone end as current_source_timezone,
  case when c.id is not null then 'CONFIRMATION_TIMESTAMP_NOT_MOVEMENT_EVENT' else cp.current_source_timezone_status end as current_source_timezone_status,
  case when c.id is not null then 'RAIL_LOGISTICS_CONFIRMATION' else cp.current_source_time_domain end as current_source_time_domain,
  case when c.id is not null then 'RAIL_LOGISTICS_AUTHORITY_CURRENT_POSITION_V1' else cp.source_policy end as source_policy,
  case when c.id is not null then 'RONA_RAIL_LOGISTICS_POSITION_AUTHORITY_V1' else cp.source_contract_version end as source_contract_version,
  case when c.id is not null then 'RAIL_LOGISTICS' else cp.source_system_snapshot end as source_system_snapshot,
  case when c.id is not null then 'AI_COORDINATION_RECORD' else cp.source_object_type_snapshot end as source_object_type_snapshot,
  case when c.id is not null then '1' else cp.source_version_snapshot end as source_version_snapshot,
  case when c.id is not null then c.confirmed_at else cp.source_received_at end as source_received_at,
  case when c.id is not null then c.coordination_record_id else cp.source_object_id end as source_object_id,
  case when c.id is not null then null::uuid else cp.import_batch_id end as import_batch_id,
  case when c.id is not null then c.payload_hash else cp.source_checksum_sha256 end as source_checksum_sha256,
  case when c.id is not null then 'RAIL_LOGISTICS_CONFIRMATION' else cp.source_sheet_name end as source_sheet_name,
  case when c.id is not null then c.wagon_ordinal else cp.source_row_number end as source_row_number,
  case when c.id is not null then 'coordination:'||c.coordination_record_id::text||':wagon:'||c.wagon_number else cp.source_row_locator end as source_row_locator,
  case when c.id is not null then c.row_fingerprint else cp.source_row_fingerprint end as source_row_fingerprint,
  case when c.id is not null then c.semantic_fingerprint else cp.semantic_fingerprint end as semantic_fingerprint,
  case when c.id is not null then 'MATCHED' else cp.effective_resolution_status end as effective_resolution_status,
  case when c.id is not null then null::uuid else cp.resolution_decision_id end as resolution_decision_id,
  case when c.id is not null then 'RAIL_LOGISTICS' else cp.resolution_authority_type end as resolution_authority_type,
  case when c.id is not null then null::uuid else cp.resolution_actor_ref end as resolution_actor_ref,
  case when c.id is not null then jsonb_build_object(
    'authorityRole','RAIL_LOGISTICS',
    'authorityIdentityId','AI-RAIL-LOGISTICS',
    'coordinationRecordId',c.coordination_record_id,
    'authorityBasis',c.authority_basis,
    'businessFact','CURRENT_POSITION',
    'arrivalTimestampAsserted',false,
    'sourceRefs',c.source_refs,
    'evidenceRefs',c.evidence_refs
  ) else cp.source_provenance end as source_provenance
from keys k
left join portal_private.rail_xlsx_dislocation_current_position_v1 cp
  on cp.effective_deal_key=k.deal_key and cp.wagon_number=k.wagon_number
left join latest_confirmation c
  on c.deal_key=k.deal_key and c.wagon_number=k.wagon_number
left join portal_private.rail_documents rd
  on rd.id=coalesce(c.rail_document_key,cp.current_rail_document_key);

revoke all on portal_private.rail_operational_current_position_v1 from public,anon,authenticated;
grant select on portal_private.rail_operational_current_position_v1 to service_role;

-- Keep all established read contracts and lifecycle APIs, but make their current-position
-- source the RAIL_LOGISTICS-authoritative operational overlay. No Operations approval is added.
do $$
declare
  v_sig text;
  v_oid regprocedure;
  v_def text;
begin
  foreach v_sig in array array[
    'portal_private.rona_rail_deal_map_read_model_core_v1(uuid,text)',
    'public.owner_deals_rail_execution_v4(text)',
    'public.rona_admin_operations_current_v1()',
    'public.rona_admin_operations_current_v2()',
    'public.rona_admin_rail_deal_map_read_model_v2(text)',
    'public.rona_admin_rail_deal_read_model_v1(text)',
    'public.rona_admin_rail_monitoring_lifecycle_v1()',
    'public.rona_admin_rail_monitoring_complete_v1(text)'
  ]
  loop
    v_oid:=to_regprocedure(v_sig);
    if v_oid is null then
      raise exception 'RAIL_POSITION_CONSUMER_FUNCTION_MISSING: %',v_sig;
    end if;
    v_def:=pg_get_functiondef(v_oid);
    if position('portal_private.rail_xlsx_dislocation_current_position_v1' in v_def)=0 then
      raise exception 'RAIL_POSITION_SOURCE_ANCHOR_MISSING: %',v_sig;
    end if;
    v_def:=replace(
      v_def,
      'portal_private.rail_xlsx_dislocation_current_position_v1',
      'portal_private.rail_operational_current_position_v1'
    );
    execute v_def;
  end loop;
end
$$;

comment on table portal_private.rail_logistics_current_position_confirmations_v1 is
'Immutable Rail Logistics authority overlay for current wagon positions. Source confirmations do not overwrite historical XLSX evidence and do not assert physical arrival time unless separately sourced.';

comment on view portal_private.rail_operational_current_position_v1 is
'Canonical operational current position for Rail-owned workflows: latest RAIL_LOGISTICS confirmation overlays retained XLSX history; other roles consume read-only projections/notifications without approval authority.';

commit;
