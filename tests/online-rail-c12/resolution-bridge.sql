\set ON_ERROR_STOP on

-- ONLINE RAIL #644 / C1.2 end-to-end PostgreSQL authority + resolution proof.

create or replace function public.c12_make_event(
  p_label text,
  p_wagon text,
  p_domain text,
  p_row integer,
  p_station text,
  p_station_code text,
  p_operation text,
  p_event_local timestamp without time zone
)
returns uuid
language plpgsql
as $$
declare
  v_batch uuid:=gen_random_uuid();
  v_source uuid:=gen_random_uuid();
  v_checksum text:=encode(extensions.digest(convert_to(p_label,'UTF8'),'sha256'),'hex');
  v_result jsonb;
begin
  insert into portal_private.import_batches(
    id,idempotency_key,source_system,source_version,source_timestamp,
    checksum_sha256,note
  ) values (
    v_batch,'C12_BATCH:'||p_label||':'||v_batch::text,
    'RAIL_AI','RAIL_XLSX_DISLOCATION_V1',now(),v_checksum,'C1.2 QA'
  );

  insert into portal_private.source_objects(
    id,import_batch_id,idempotency_key,source_system,source_object_type,
    source_object_id,source_version,source_timestamp,checksum_sha256,raw_snapshot
  ) values (
    v_source,v_batch,'C12_SOURCE:'||p_label||':'||v_source::text,
    'RAIL_AI','XLSX_WAGON_DISLOCATION','C12:'||p_label,
    'RAIL_XLSX_DISLOCATION_V1',now(),v_checksum,
    jsonb_build_object(
      'sourcePolicy','EXPEDITOR_XLSX_VIA_RAIL_AI',
      'sourceContractVersion','RAIL_XLSX_DISLOCATION_CONTRACT_V1',
      'sourceTimeDomain',p_domain,
      'c12Qa',true
    )
  );

  v_result:=portal_private.rail_xlsx_dislocation_ingest_v1(
    v_batch,
    v_source,
    'arbitrary-sheet-'||p_label,
    p_row,
    jsonb_build_object(
      'schemaVersion','RAIL_XLSX_SOURCE_ROW_V1',
      'sheetName','arbitrary-sheet-'||p_label,
      'rowNumber',p_row,
      'cells',jsonb_build_array(
        jsonb_build_object('columnIndex',1,'header','номер вагона','rawType','STRING','rawValue',p_wagon),
        jsonb_build_object('columnIndex',2,'header','operation code','rawType','STRING','rawValue',p_operation),
        jsonb_build_object('columnIndex',3,'header','operation timestamp','rawType','STRING','rawValue',to_char(p_event_local,'DDMMYYHH24MI')),
        jsonb_build_object('columnIndex',4,'header','station code','rawType','STRING','rawValue',p_station_code),
        jsonb_build_object('columnIndex',5,'header','station','rawType','STRING','rawValue',p_station),
        jsonb_build_object('columnIndex',6,'header','raw zero','rawType','NUMBER','rawValue',0)
      )
    ),
    p_wagon,
    p_event_local,
    to_char(p_event_local,'DDMMYYHH24MI'),
    'UNRESOLVED',
    null,
    null,
    p_station,
    p_station_code,
    p_operation,
    null,
    null,
    'TO_VERIFY',
    jsonb_build_object('c12','NO_AUTHORITATIVE_BINDING'),
    jsonb_build_object(
      'contract','RAIL_XLSX_GENERIC_INTAKE_V1',
      'filenameUsedForMatching',false,
      'contextualSimilarityUsedForMatching',false,
      'operationCodeInterpretation','RAW_ONLY',
      'geoCreated',false
    )
  );

  return (v_result->>'eventId')::uuid;
end
$$;

-- Canonical business scope for owner/Rail authority tests.
insert into portal_private.clients(id)
values ('11000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into portal_private.contracts(id,client_key)
values ('21000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into portal_private.deals(
  id,deal_id,client_key,contract_key,business_status,
  source_system,source_version,source_timestamp,authority_state,lifecycle_state
) values (
  '31000000-0000-0000-0000-000000000001','DEAL-C12-A',
  '11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001',
  'OPEN','C12_QA','C12',now(),'SOURCE_RECEIVED','ACTIVE'
) on conflict (id) do nothing;

insert into portal_private.rail_documents(
  id,rail_document_id,document_type,gu12_number,client_key,deal_key,
  source_system,source_version,source_timestamp,authority_state,lifecycle_state
) values (
  '41000000-0000-0000-0000-000000000001','RAIL-C12-A','GU12','C12-GU12-A',
  '11000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001',
  'C12_QA','C12',now(),'SOURCE_RECEIVED','ACTIVE'
) on conflict (id) do nothing;

-- Second scope for wrong Deal/document negative test.
insert into portal_private.clients(id)
values ('11000000-0000-0000-0000-000000000002')
on conflict do nothing;

insert into portal_private.contracts(id,client_key)
values ('21000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000002')
on conflict do nothing;

insert into portal_private.deals(
  id,deal_id,client_key,contract_key,business_status,
  source_system,source_version,source_timestamp,authority_state,lifecycle_state
) values (
  '31000000-0000-0000-0000-000000000002','DEAL-C12-B',
  '11000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000002',
  'OPEN','C12_QA','C12',now(),'SOURCE_RECEIVED','ACTIVE'
) on conflict (id) do nothing;

insert into portal_private.rail_documents(
  id,rail_document_id,document_type,gu12_number,client_key,deal_key,
  source_system,source_version,source_timestamp,authority_state,lifecycle_state
) values (
  '41000000-0000-0000-0000-000000000002','RAIL-C12-B','GU12','C12-GU12-B',
  '11000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000002',
  'C12_QA','C12',now(),'SOURCE_RECEIVED','ACTIVE'
) on conflict (id) do nothing;

-- Authenticated owner context bound to the Rail Logistics Pilot OAuth token.
insert into portal_private.portal_users(id,auth_user_id,display_name,status,lifecycle_state)
values (
  '71000000-0000-0000-0000-000000000001',
  '72000000-0000-0000-0000-000000000001',
  'C1.2 QA Owner','ACTIVE','ACTIVE'
) on conflict (id) do nothing;

insert into portal_private.portal_user_roles(user_id,role,status)
values ('71000000-0000-0000-0000-000000000001','ADMIN','ACTIVE')
on conflict (user_id,role) do update set status='ACTIVE',revoked_at=null;

insert into portal_private.mcp_oauth_clients(client_id,client_name)
values ('c12-rail-client','RONA Phase 2B2 QA C1.2 Rail')
on conflict (client_id) do update set client_name=excluded.client_name;

insert into portal_private.mcp_oauth_tokens(
  token_id,server_slug,functional_role,identity_id,client_id,
  owner_portal_user_id,scope,access_expires_at,revoked_at
) values (
  '81000000-0000-4000-8000-000000000001',
  'rona-mcp-rail-logistics-pilot','RAIL_LOGISTICS','AI-RAIL-LOGISTICS',
  'c12-rail-client','71000000-0000-0000-0000-000000000001',
  'mcp:read mcp:coordinate',now()+interval '1 day',null
) on conflict (token_id) do nothing;

-- 1. No GU-12 / no existing wagon binding -> immutable TO_VERIFY, no trusted current.
select public.c12_make_event(
  'OWNER','90000001','C12:DOMAIN:OWNER',11,
  'Context Similar Station','990001','P0005','2026-09-19 01:00:00'
) as owner_event_id \gset

create temporary table c12_evidence_hash(event_id uuid primary key, row_hash text not null);
insert into c12_evidence_hash
select id,encode(extensions.digest(convert_to(to_jsonb(e)::text,'UTF8'),'sha256'),'hex')
from portal_private.rail_xlsx_dislocation_events_v1 e
where id=:'owner_event_id'::uuid;

do $$
declare v_event uuid:=(select id from portal_private.rail_xlsx_dislocation_events_v1 where wagon_number='90000001' limit 1);
begin
  if (select resolution_status from portal_private.rail_xlsx_dislocation_events_v1 where id=v_event)<>'TO_VERIFY' then
    raise exception 'C12_EXPECT_INITIAL_TO_VERIFY';
  end if;
  if exists (
    select 1 from portal_private.rail_xlsx_dislocation_current_position_v1
    where wagon_number='90000001'
  ) then
    raise exception 'C12_TRUSTED_CURRENT_MUST_BE_ABSENT_BEFORE_AUTHORITY';
  end if;
end
$$;

-- 2. Explicit owner confirmation -> audit authority -> resolution -> trusted current.
set role service_role;
select portal_private.rail_xlsx_owner_resolution_bridge_v1(
  :'owner_event_id'::uuid,
  '31000000-0000-0000-0000-000000000001'::uuid,
  '41000000-0000-0000-0000-000000000001'::uuid,
  '71000000-0000-0000-0000-000000000001'::uuid,
  '81000000-0000-4000-8000-000000000001'::uuid,
  'c12-rail-client',
  '91000000-0000-4000-8000-000000000001'::uuid,
  '92000000-0000-4000-8000-000000000001'::uuid,
  repeat('a',64),
  'CHAT:C12:OWNER:EXPLICIT:1',
  jsonb_build_object('reason','owner explicitly confirmed DEAL-C12-A / C12-GU12-A'),
  jsonb_build_array('CHAT:C12:OWNER:EXPLICIT:1'),
  jsonb_build_array('RAIL_XLSX_EVIDENCE:'||:'owner_event_id')
);
-- Replay must not create another authority or decision.
select portal_private.rail_xlsx_owner_resolution_bridge_v1(
  :'owner_event_id'::uuid,
  '31000000-0000-0000-0000-000000000001'::uuid,
  '41000000-0000-0000-0000-000000000001'::uuid,
  '71000000-0000-0000-0000-000000000001'::uuid,
  '81000000-0000-4000-8000-000000000001'::uuid,
  'c12-rail-client',
  '91000000-0000-4000-8000-000000000099'::uuid,
  '92000000-0000-4000-8000-000000000099'::uuid,
  repeat('a',64),
  'CHAT:C12:OWNER:EXPLICIT:1',
  jsonb_build_object('reason','owner explicitly confirmed DEAL-C12-A / C12-GU12-A'),
  jsonb_build_array('CHAT:C12:OWNER:EXPLICIT:1'),
  jsonb_build_array('RAIL_XLSX_EVIDENCE:'||:'owner_event_id')
);
reset role;

do $$
declare
  v_event uuid:=(select id from portal_private.rail_xlsx_dislocation_events_v1 where wagon_number='90000001' limit 1);
  v_before text;
  v_after text;
begin
  select row_hash into v_before from c12_evidence_hash where event_id=v_event;
  select encode(extensions.digest(convert_to(to_jsonb(e)::text,'UTF8'),'sha256'),'hex')
    into v_after
  from portal_private.rail_xlsx_dislocation_events_v1 e where id=v_event;
  if v_before<>v_after then raise exception 'C12_EVIDENCE_ROW_MUTATED'; end if;

  if (select resolution_status from portal_private.rail_xlsx_dislocation_events_v1 where id=v_event)<>'TO_VERIFY' then
    raise exception 'C12_SOURCE_EVIDENCE_STATUS_MUTATED';
  end if;
  if (select overlay_resolution_status from portal_private.rail_xlsx_resolution_effective_v1 where id=v_event)<>'MATCHED' then
    raise exception 'C12_OWNER_EFFECTIVE_NOT_MATCHED';
  end if;
  if not exists (
    select 1 from portal_private.rail_xlsx_dislocation_current_position_v1
    where effective_deal_key='31000000-0000-0000-0000-000000000001'::uuid
      and wagon_number='90000001'
      and position_status='TRUSTED'
      and current_event_id=v_event
  ) then
    raise exception 'C12_OWNER_TRUSTED_CURRENT_NOT_MATERIALIZED';
  end if;
  if (select count(*) from portal_private.audit_events
      where action='RAIL_XLSX_OWNER_RESOLUTION_INSTRUCTION'
        and actor_user_id='71000000-0000-0000-0000-000000000001'::uuid
        and entity_id=v_event::text
        and metadata->>'authority_contract'='RAIL_XLSX_OWNER_AUTHORITY_V1')<>1 then
    raise exception 'C12_OWNER_AUTHORITY_RECORD_COUNT_INVALID';
  end if;
  if (select count(*) from portal_private.rail_xlsx_resolution_decisions_v1 where evidence_event_id=v_event)<>1 then
    raise exception 'C12_OWNER_DECISION_NOT_IDEMPOTENT';
  end if;
end
$$;

-- 3. Rail Logistics verified authority -> exact coordination conclusion -> trusted current.
select public.c12_make_event(
  'RAIL_AI','90000002','C12:DOMAIN:RAIL',12,
  'Another Context Station','990002','V0057','2026-09-19 01:05:00'
) as rail_event_id \gset

set role service_role;
select portal_private.rail_xlsx_rail_resolution_bridge_v1(
  :'rail_event_id'::uuid,
  '31000000-0000-0000-0000-000000000001'::uuid,
  '41000000-0000-0000-0000-000000000001'::uuid,
  '81000000-0000-4000-8000-000000000001'::uuid,
  'c12-rail-client',
  '93000000-0000-4000-8000-000000000001'::uuid,
  '94000000-0000-4000-8000-000000000001'::uuid,
  repeat('b',64),
  jsonb_build_object('reason','Rail Logistics verified exact source/evidence scope'),
  jsonb_build_array('SOURCE_OBJECT:C12:RAIL_AI'),
  jsonb_build_array('RAIL_XLSX_EVIDENCE:'||:'rail_event_id')
);
select portal_private.rail_xlsx_rail_resolution_bridge_v1(
  :'rail_event_id'::uuid,
  '31000000-0000-0000-0000-000000000001'::uuid,
  '41000000-0000-0000-0000-000000000001'::uuid,
  '81000000-0000-4000-8000-000000000001'::uuid,
  'c12-rail-client',
  '93000000-0000-4000-8000-000000000099'::uuid,
  '94000000-0000-4000-8000-000000000099'::uuid,
  repeat('b',64),
  jsonb_build_object('reason','Rail Logistics verified exact source/evidence scope'),
  jsonb_build_array('SOURCE_OBJECT:C12:RAIL_AI'),
  jsonb_build_array('RAIL_XLSX_EVIDENCE:'||:'rail_event_id')
);
reset role;

do $$
declare v_event uuid:=(select id from portal_private.rail_xlsx_dislocation_events_v1 where wagon_number='90000002' limit 1);
begin
  if (select resolution_status from portal_private.rail_xlsx_dislocation_events_v1 where id=v_event)<>'TO_VERIFY' then
    raise exception 'C12_RAIL_SOURCE_EVIDENCE_MUTATED';
  end if;
  if (select overlay_resolution_status from portal_private.rail_xlsx_resolution_effective_v1 where id=v_event)<>'MATCHED' then
    raise exception 'C12_RAIL_EFFECTIVE_NOT_MATCHED';
  end if;
  if not exists (
    select 1 from portal_private.rail_xlsx_dislocation_current_position_v1
    where effective_deal_key='31000000-0000-0000-0000-000000000001'::uuid
      and wagon_number='90000002'
      and position_status='TRUSTED'
      and current_event_id=v_event
  ) then raise exception 'C12_RAIL_TRUSTED_CURRENT_NOT_MATERIALIZED'; end if;

  if (select count(*) from portal_private.ai_coordination_records
      where functional_role::text='RAIL_LOGISTICS'
        and identity_id='AI-RAIL-LOGISTICS'
        and record_type='FUNCTIONAL_CONCLUSION'
        and status='APPROVED'
        and tool_name='rail_xlsx_resolution_verify'
        and target_type='RAIL_XLSX_EVIDENCE'
        and target_id=v_event::text
        and payload->>'authorityContract'='RAIL_XLSX_RAIL_LOGISTICS_AUTHORITY_V1'
        and payload->>'evidenceEventId'=v_event::text
        and payload->>'dealKey'='31000000-0000-0000-0000-000000000001'
        and payload->>'railDocumentKey'='41000000-0000-0000-0000-000000000001'
        and jsonb_array_length(source_refs)>0
        and jsonb_array_length(evidence_refs)>0)<>1 then
    raise exception 'C12_RAIL_AUTHORITY_RECORD_INVALID';
  end if;
  if (select count(*) from portal_private.rail_xlsx_resolution_decisions_v1 where evidence_event_id=v_event)<>1 then
    raise exception 'C12_RAIL_DECISION_NOT_IDEMPOTENT';
  end if;
end
$$;

-- 4. Wrong Deal/document pair is rejected before authority materialization.
select public.c12_make_event(
  'WRONG_SCOPE','90000004','C12:DOMAIN:WRONG',14,
  'Wrong Scope Context','990004','P0005','2026-09-19 01:10:00'
) as wrong_event_id \gset

set role service_role;
do $$
begin
  begin
    perform portal_private.rail_xlsx_owner_resolution_bridge_v1(
      (select id from portal_private.rail_xlsx_dislocation_events_v1 where wagon_number='90000004' limit 1),
      '31000000-0000-0000-0000-000000000001'::uuid,
      '41000000-0000-0000-0000-000000000002'::uuid,
      '71000000-0000-0000-0000-000000000001'::uuid,
      '81000000-0000-4000-8000-000000000001'::uuid,
      'c12-rail-client',
      gen_random_uuid(),gen_random_uuid(),repeat('c',64),
      'CHAT:C12:WRONG',
      jsonb_build_object('reason','wrong scope negative'),
      jsonb_build_array('CHAT:C12:WRONG'),
      jsonb_build_array('RAIL_XLSX_EVIDENCE:'||(select id::text from portal_private.rail_xlsx_dislocation_events_v1 where wagon_number='90000004' limit 1))
    );
    raise exception 'C12_WRONG_SCOPE_UNEXPECTEDLY_ACCEPTED';
  exception when check_violation then
    if SQLERRM not like '%RAIL_XLSX_DECISION_DEAL_DOCUMENT_SCOPE_CONFLICT%' then raise; end if;
  end;
end
$$;
reset role;

-- 5. Invalid/fake authority and technical-role authority types are rejected by B1.3.
set role service_role;
do $$
begin
  begin
    perform portal_private.rail_xlsx_resolution_decide_v1(
      (select id from portal_private.rail_xlsx_dislocation_events_v1 where wagon_number='90000004' limit 1),'MATCHED',
      '31000000-0000-0000-0000-000000000001'::uuid,
      '41000000-0000-0000-0000-000000000001'::uuid,
      'OWNER_EXPLICIT_INSTRUCTION',gen_random_uuid(),now(),
      jsonb_build_object('reason','fake authority'),jsonb_build_object('qa',true)
    );
    raise exception 'C12_FAKE_AUTHORITY_UNEXPECTEDLY_ACCEPTED';
  exception when check_violation then
    if SQLERRM not like '%RAIL_XLSX_OWNER_AUTHORITY_INVALID%' then raise; end if;
  end;

  begin
    perform portal_private.rail_xlsx_resolution_decide_v1(
      (select id from portal_private.rail_xlsx_dislocation_events_v1 where wagon_number='90000004' limit 1),'MATCHED',
      '31000000-0000-0000-0000-000000000001'::uuid,
      '41000000-0000-0000-0000-000000000001'::uuid,
      'SYSTEM_ADMIN',gen_random_uuid(),now(),
      jsonb_build_object('reason','technical role negative'),jsonb_build_object('qa',true)
    );
    raise exception 'C12_SYSTEM_ADMIN_UNEXPECTEDLY_ACCEPTED';
  exception when check_violation then
    if SQLERRM not like '%RAIL_XLSX_DECISION_AUTHORITY_INVALID%' then raise; end if;
  end;

  begin
    perform portal_private.rail_xlsx_resolution_decide_v1(
      (select id from portal_private.rail_xlsx_dislocation_events_v1 where wagon_number='90000004' limit 1),'MATCHED',
      '31000000-0000-0000-0000-000000000001'::uuid,
      '41000000-0000-0000-0000-000000000001'::uuid,
      'service_role',gen_random_uuid(),now(),
      jsonb_build_object('reason','technical role negative'),jsonb_build_object('qa',true)
    );
    raise exception 'C12_SERVICE_ROLE_UNEXPECTEDLY_ACCEPTED';
  exception when check_violation then
    if SQLERRM not like '%RAIL_XLSX_DECISION_AUTHORITY_INVALID%' then raise; end if;
  end;
end
$$;
reset role;

-- 6. Missing authenticated owner identity/ADMIN binding is rejected.
insert into portal_private.portal_users(id,auth_user_id,display_name,status,lifecycle_state)
values (
  '71000000-0000-0000-0000-000000000002',
  '72000000-0000-0000-0000-000000000002',
  'C1.2 QA Non Admin','ACTIVE','ACTIVE'
) on conflict (id) do nothing;
insert into portal_private.mcp_oauth_tokens(
  token_id,server_slug,functional_role,identity_id,client_id,
  owner_portal_user_id,scope,access_expires_at,revoked_at
) values (
  '81000000-0000-4000-8000-000000000002',
  'rona-mcp-rail-logistics-pilot','RAIL_LOGISTICS','AI-RAIL-LOGISTICS',
  'c12-rail-client','71000000-0000-0000-0000-000000000002',
  'mcp:read mcp:coordinate',now()+interval '1 day',null
) on conflict (token_id) do nothing;

set role service_role;
do $$
begin
  begin
    perform portal_private.rail_xlsx_owner_resolution_bridge_v1(
      (select id from portal_private.rail_xlsx_dislocation_events_v1 where wagon_number='90000004' limit 1),
      '31000000-0000-0000-0000-000000000001'::uuid,
      '41000000-0000-0000-0000-000000000001'::uuid,
      '71000000-0000-0000-0000-000000000002'::uuid,
      '81000000-0000-4000-8000-000000000002'::uuid,
      'c12-rail-client',gen_random_uuid(),gen_random_uuid(),repeat('d',64),
      'CHAT:C12:NO_ADMIN',
      jsonb_build_object('reason','non-admin owner negative'),
      jsonb_build_array('CHAT:C12:NO_ADMIN'),
      jsonb_build_array('RAIL_XLSX_EVIDENCE:'||(select id::text from portal_private.rail_xlsx_dislocation_events_v1 where wagon_number='90000004' limit 1))
    );
    raise exception 'C12_NON_ADMIN_OWNER_UNEXPECTEDLY_ACCEPTED';
  exception when insufficient_privilege then
    if SQLERRM not like '%RAIL_XLSX_OWNER_AUTHENTICATED_CONTEXT_REQUIRED%' then raise; end if;
  end;
end
$$;
reset role;

-- 7. B1.5 cross-domain fail-closed semantics survive the resolution bridge.
select public.c12_make_event(
  'DOMAIN_A','90000003','C12:DOMAIN:A',21,
  'Same Station','990003','P0005','2026-09-19 01:20:00'
) as domain_a_event_id \gset
select public.c12_make_event(
  'DOMAIN_B','90000003','C12:DOMAIN:B',22,
  'Same Station','990003','P0005','2026-09-19 01:20:00'
) as domain_b_event_id \gset

set role service_role;
select portal_private.rail_xlsx_rail_resolution_bridge_v1(
  :'domain_a_event_id'::uuid,
  '31000000-0000-0000-0000-000000000001'::uuid,
  '41000000-0000-0000-0000-000000000001'::uuid,
  '81000000-0000-4000-8000-000000000001'::uuid,
  'c12-rail-client',gen_random_uuid(),gen_random_uuid(),repeat('e',64),
  jsonb_build_object('reason','domain A verified'),
  jsonb_build_array('SOURCE:C12:DOMAIN:A'),
  jsonb_build_array('RAIL_XLSX_EVIDENCE:'||:'domain_a_event_id')
);
reset role;

do $$
begin
  if not exists (
    select 1 from portal_private.rail_xlsx_dislocation_current_position_v1
    where effective_deal_key='31000000-0000-0000-0000-000000000001'::uuid
      and wagon_number='90000003'
      and position_status='TRUSTED'
      and current_event_id=(select id from portal_private.rail_xlsx_dislocation_events_v1 where wagon_number='90000003' and source_time_domain='C12:DOMAIN:A' limit 1)
  ) then raise exception 'C12_SINGLE_TRUSTED_DOMAIN_NOT_CURRENT'; end if;
end
$$;

set role service_role;
select portal_private.rail_xlsx_rail_resolution_bridge_v1(
  :'domain_b_event_id'::uuid,
  '31000000-0000-0000-0000-000000000001'::uuid,
  '41000000-0000-0000-0000-000000000001'::uuid,
  '81000000-0000-4000-8000-000000000001'::uuid,
  'c12-rail-client',gen_random_uuid(),gen_random_uuid(),repeat('f',64),
  jsonb_build_object('reason','domain B verified'),
  jsonb_build_array('SOURCE:C12:DOMAIN:B'),
  jsonb_build_array('RAIL_XLSX_EVIDENCE:'||:'domain_b_event_id')
);
reset role;

do $$
begin
  if not exists (
    select 1 from portal_private.rail_xlsx_dislocation_current_position_v1
    where effective_deal_key='31000000-0000-0000-0000-000000000001'::uuid
      and wagon_number='90000003'
      and position_status='CROSS_DOMAIN_AMBIGUOUS'
      and current_event_id is null
      and current_station_name is null
      and current_operation is null
      and comparison_domain_count=2
  ) then raise exception 'C12_CROSS_DOMAIN_AMBIGUITY_NOT_PRESERVED'; end if;
end
$$;

-- No bridge action may create rail_wagons or alter business status from raw operation codes.
do $$
begin
  if (select count(*) from portal_private.rail_wagons)<>0 then
    raise exception 'C12_RAIL_WAGON_AUTO_CREATE_FORBIDDEN';
  end if;
  if exists (
    select 1 from portal_private.deals
    where id='31000000-0000-0000-0000-000000000001'::uuid
      and business_status<>'OPEN'
  ) then raise exception 'C12_OPERATION_CODE_CHANGED_BUSINESS_STATUS'; end if;
end
$$;

select 'C12_TO_VERIFY_NO_CURRENT=PASS' as result;
select 'C12_OWNER_AUTHORITY_TO_MATCHED=PASS' as result;
select 'C12_RAIL_AUTHORITY_TO_MATCHED=PASS' as result;
select 'C12_WRONG_SCOPE_REJECT=PASS' as result;
select 'C12_FAKE_AUTHORITY_REJECT=PASS' as result;
select 'C12_TECHNICAL_AUTHORITY_REJECT=PASS' as result;
select 'C12_RESOLUTION_REPLAY_IDEMPOTENT=PASS' as result;
select 'C12_EVIDENCE_IMMUTABLE=PASS' as result;
select 'C12_B15_CROSS_DOMAIN=PASS' as result;
select 'C12_NO_WAGON_STATUS_GEO_SIDE_EFFECTS=PASS' as result;
select 'C12_RESOLUTION_BRIDGE_E2E=PASS' as result;