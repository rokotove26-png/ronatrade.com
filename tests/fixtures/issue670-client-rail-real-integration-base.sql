-- #670 isolated real-integration substrate.
-- Used only inside the ephemeral local Supabase instance started by CI.
create schema if not exists portal_private;
revoke all on schema portal_private from public,anon,authenticated;
grant usage on schema portal_private to service_role;

create table portal_private.portal_users(
  id uuid primary key,
  auth_user_id uuid not null unique,
  display_name text not null
);

create table portal_private.portal_user_roles(
  user_id uuid not null,
  role text not null,
  status text not null,
  revoked_at timestamptz
);

create table portal_private.clients(
  id uuid primary key,
  client_id text not null unique,
  lifecycle_state text not null default 'ACTIVE',
  authority_state text not null default 'CONFIRMED'
);

create table portal_private.contracts(
  id uuid primary key,
  contract_id text not null unique,
  client_key uuid not null references portal_private.clients(id),
  contract_status text not null default 'ACTIVE',
  lifecycle_state text not null default 'ACTIVE',
  authority_state text not null default 'CONFIRMED',
  signed_contract_confirmed_at timestamptz,
  current_external_contract_number text,
  effective_from date,
  effective_to date
);

create table portal_private.deals(
  id uuid primary key,
  deal_id text not null unique,
  client_key uuid not null references portal_private.clients(id),
  contract_key uuid not null references portal_private.contracts(id),
  business_status text,
  lifecycle_state text not null default 'ACTIVE',
  authority_state text not null default 'CONFIRMED'
);

create table portal_private.client_user_bindings(
  id uuid primary key,
  user_id uuid not null references portal_private.portal_users(id),
  client_key uuid not null references portal_private.clients(id),
  contract_key uuid not null references portal_private.contracts(id),
  status text not null default 'ACTIVE',
  revoked_at timestamptz,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  lifecycle_state text not null default 'ACTIVE',
  authority_state text not null default 'CONFIRMED',
  deal_scope_mode text not null default 'ALL_CONTRACT_DEALS'
);

create table portal_private.rail_documents(
  id uuid primary key,
  deal_key uuid not null references portal_private.deals(id),
  rail_document_id text not null,
  gu12_number text,
  document_number text,
  document_date date,
  route_text text,
  source_system text,
  source_version text,
  source_timestamp timestamptz,
  import_batch_id uuid,
  lifecycle_state text not null default 'ACTIVE'
);

create table portal_private.rail_station_geo_directory_v1(
  id uuid primary key,
  esr_code text not null unique,
  canonical_station_name text not null,
  latitude numeric,
  longitude numeric,
  authority_state text not null default 'CONFIRMED',
  source_system text,
  source_url text,
  corroboration_refs jsonb not null default '[]'::jsonb
);

create table portal_private.rail_xlsx_dislocation_current_position_v1(
  effective_deal_key uuid not null,
  wagon_number text not null,
  current_rail_document_key uuid,
  current_station_name text,
  current_station_code text,
  current_operation text,
  current_event_at timestamptz,
  current_event_at_local timestamp,
  current_raw_timestamp text,
  current_source_timezone text,
  current_source_timezone_status text,
  current_source_time_domain text,
  current_comparison_domain text,
  position_status text,
  comparison_domain_count integer,
  candidate_observation_count integer,
  effective_resolution_status text,
  resolution_decision_id uuid,
  current_event_id uuid,
  source_policy text,
  source_contract_version text,
  source_system_snapshot text,
  source_object_type_snapshot text,
  source_version_snapshot text,
  source_object_id text,
  import_batch_id uuid,
  source_checksum_sha256 text,
  source_sheet_name text,
  source_row_number integer,
  source_row_locator text,
  source_row_fingerprint text,
  semantic_fingerprint text,
  source_received_at timestamptz,
  resolution_authority_type text,
  resolution_actor_ref text,
  source_provenance jsonb
);

create table portal_private.rail_xlsx_dislocation_effective_v1(
  effective_deal_key uuid not null,
  station_code text,
  station_name text,
  parsed_event_at timestamptz,
  event_at_local timestamp,
  source_received_at timestamptz,
  position_status text,
  is_superseded boolean not null default false
);

create table portal_private.rail_deal_route_assignments_v1(
  deal_key uuid primary key references portal_private.deals(id),
  origin_esr_code text,
  destination_esr_code text,
  origin_authority text,
  destination_authority text,
  resolution_state text not null,
  route_nodes jsonb not null default '[]'::jsonb,
  route_hop_count integer,
  route_source_refs jsonb not null default '[]'::jsonb,
  resolved_at timestamptz,
  refreshed_at timestamptz not null default now()
);

create or replace function portal_private.resolve_portal_auth(
  p_auth_user_id uuid,
  p_session_id uuid
)
returns table(
  portal_user_id uuid,
  display_name text,
  roles text[],
  session_allowed boolean
)
language sql
stable
security definer
set search_path=pg_catalog,portal_private
as $fn$
  select
    pu.id,
    pu.display_name,
    coalesce(array_agg(distinct r.role) filter (where r.status='ACTIVE' and r.revoked_at is null),array[]::text[]),
    p_session_id is not null
  from portal_private.portal_users pu
  left join portal_private.portal_user_roles r on r.user_id=pu.id
  where pu.auth_user_id=p_auth_user_id
  group by pu.id,pu.display_name,p_session_id
$fn$;

create or replace function portal_private.owner_r1_actor(p_required_role text)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,portal_private,auth
as $fn$
declare v_user uuid;
begin
  select a.portal_user_id into v_user
  from portal_private.resolve_portal_auth(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid) a
  where a.session_allowed and p_required_role=any(a.roles)
  limit 1;
  if v_user is null then
    raise exception using errcode='42501',message='PORTAL_ACCESS_DENIED';
  end if;
  return v_user;
end
$fn$;

create or replace function portal_private.client_user_has_contract_access(
  p_user_id uuid,
  p_contract_key uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path=pg_catalog,portal_private
as $fn$
  select exists(
    select 1
    from portal_private.client_user_bindings b
    join portal_private.contracts ct on ct.id=b.contract_key
    join portal_private.clients cl on cl.id=ct.client_key and cl.id=b.client_key
    where b.user_id=p_user_id
      and b.contract_key=p_contract_key
      and b.status='ACTIVE'
      and b.valid_from<=p_at
      and (b.valid_to is null or b.valid_to>p_at)
      and b.revoked_at is null
      and b.lifecycle_state='ACTIVE'
      and b.authority_state in ('CONFIRMED','VERIFIED')
      and cl.lifecycle_state='ACTIVE'
      and cl.authority_state in ('CONFIRMED','VERIFIED')
      and ct.contract_status='ACTIVE'
      and ct.lifecycle_state='ACTIVE'
      and ct.authority_state in ('CONFIRMED','VERIFIED')
      and ct.signed_contract_confirmed_at is not null
      and nullif(btrim(ct.current_external_contract_number),'') is not null
      and (ct.effective_from is null or ct.effective_from<=p_at::date)
      and (ct.effective_to is null or ct.effective_to>=p_at::date)
      and exists(
        select 1
        from portal_private.portal_user_roles r
        where r.user_id=p_user_id
          and r.role='CLIENT'
          and r.status='ACTIVE'
          and r.revoked_at is null
      )
  )
$fn$;

create or replace function portal_private.client_user_has_deal_access(
  p_user_id uuid,
  p_deal_key uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path=pg_catalog,portal_private
as $fn$
  select exists(
    select 1
    from portal_private.deals d
    join portal_private.client_user_bindings b
      on b.client_key=d.client_key
     and b.contract_key=d.contract_key
     and b.user_id=p_user_id
    where d.id=p_deal_key
      and portal_private.client_user_has_contract_access(p_user_id,d.contract_key,p_at)
      and d.lifecycle_state='ACTIVE'
      and d.authority_state not in ('REJECTED','SUPERSEDED')
      and b.status='ACTIVE'
      and b.valid_from<=p_at
      and (b.valid_to is null or b.valid_to>p_at)
      and b.revoked_at is null
      and b.deal_scope_mode='ALL_CONTRACT_DEALS'
  )
$fn$;

create or replace function portal_private.rail_deal_route_progress_v1(p_deal_key uuid)
returns jsonb
language plpgsql
stable
set search_path=pg_catalog,portal_private
as $fn$
declare
  v_route jsonb;
  v_count int:=0;
  v_furthest int;
  v_observed jsonb:='[]'::jsonb;
  v_actual jsonb:='[]'::jsonb;
  v_remaining jsonb:='[]'::jsonb;
  v_origin jsonb;
begin
  select a.route_nodes into v_route
  from portal_private.rail_deal_route_assignments_v1 a
  where a.deal_key=p_deal_key and a.resolution_state='RESOLVED';

  if v_route is null then
    return jsonb_build_object(
      'state','ROUTE_NOT_RESOLVED',
      'observedStations','[]'::jsonb,
      'actualPoints','[]'::jsonb,
      'remainingPoints','[]'::jsonb
    );
  end if;

  v_count:=jsonb_array_length(v_route);

  with ev as (
    select
      e.station_code,
      max(e.station_name) station_name,
      min(coalesce(e.parsed_event_at,e.event_at_local at time zone 'UTC',e.source_received_at)) first_seen_at,
      max(coalesce(e.parsed_event_at,e.event_at_local at time zone 'UTC',e.source_received_at)) last_seen_at
    from portal_private.rail_xlsx_dislocation_effective_v1 e
    where e.effective_deal_key=p_deal_key
      and e.position_status='TRUSTED'
      and coalesce(e.is_superseded,false)=false
      and e.station_code is not null
    group by e.station_code
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'stationCode',ev.station_code,
    'station',ev.station_name,
    'firstSeenAt',ev.first_seen_at,
    'lastSeenAt',ev.last_seen_at,
    'lat',g.latitude,
    'lng',g.longitude,
    'trusted',g.id is not null,
    'sourceKind','OBSERVED_HISTORY'
  ) order by ev.first_seen_at,ev.station_code),'[]'::jsonb)
  into v_observed
  from ev
  left join portal_private.rail_station_geo_directory_v1 g
    on g.esr_code=ev.station_code and g.authority_state='CONFIRMED';

  select max((p->>'sequence')::int) into v_furthest
  from jsonb_array_elements(v_route) p
  where exists(
    select 1
    from jsonb_array_elements(v_observed) o
    where o->>'stationCode'=p->>'stationCode'
  );

  select p into v_origin
  from jsonb_array_elements(v_route) p
  where (p->>'sequence')::int=1
  limit 1;

  if v_origin is not null and v_origin->>'lat' is not null and v_origin->>'lng' is not null then
    v_actual:=jsonb_build_array(v_origin||jsonb_build_object('sourceKind','SOURCE_ORIGIN'));
  end if;

  v_actual:=v_actual||coalesce((
    select jsonb_agg(o order by (o->>'firstSeenAt')::timestamptz,o->>'stationCode')
    from jsonb_array_elements(v_observed) o
    where o->>'lat' is not null and o->>'lng' is not null
      and not (v_origin is not null and o->>'stationCode'=v_origin->>'stationCode')
  ),'[]'::jsonb);

  select coalesce(jsonb_agg(p order by (p->>'sequence')::int),'[]'::jsonb)
  into v_remaining
  from jsonb_array_elements(v_route) p
  where (p->>'sequence')::int>=coalesce(v_furthest,1)
    and p->>'lat' is not null
    and p->>'lng' is not null;

  return jsonb_build_object(
    'state',case
      when jsonb_array_length(v_observed)=0 then 'NO_OBSERVATIONS'
      when v_furthest is null then 'OBSERVED_OFF_ROUTE'
      else 'OBSERVED_AND_MATCHED'
    end,
    'routeNodeCount',v_count,
    'furthestMatchedSequence',v_furthest,
    'historyStationCount',jsonb_array_length(v_observed),
    'observedStations',v_observed,
    'actualPoints',v_actual,
    'remainingPoints',v_remaining
  );
end
$fn$;

revoke all on all tables in schema portal_private from public,anon,authenticated;
revoke all on all functions in schema portal_private from public,anon,authenticated;
grant execute on function portal_private.resolve_portal_auth(uuid,uuid) to service_role;
grant execute on function portal_private.client_user_has_contract_access(uuid,uuid,timestamptz) to service_role;
grant execute on function portal_private.client_user_has_deal_access(uuid,uuid,timestamptz) to service_role;
grant execute on function portal_private.rail_deal_route_progress_v1(uuid) to service_role;
