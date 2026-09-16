-- RONA Client Applications V2. Candidate: no production backfill is run here.
-- Activation is explicit; immutable intake payloads and financial tables are untouched.

create table portal_private.client_application_policy_v2 (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  authority_role text not null default 'OPERATIONS_DIRECTOR' check(authority_role='OPERATIONS_DIRECTOR'),
  authorization_source text not null,
  activated_at timestamptz
);
insert into portal_private.client_application_policy_v2(singleton,authorization_source)
values(true,'OWNER:CLIENT_APPLICATIONS_LIFECYCLE_SYSTEMIC_FIX:2026-09-16');

alter table portal_private.client_applications add column source_intake_key uuid
  references portal_private.client_intake_v1(intake_id) on delete restrict;
create unique index client_applications_one_source_intake_v2
  on portal_private.client_applications(source_intake_key) where source_intake_key is not null;
alter table portal_private.client_applications drop constraint client_applications_price_mode_fields;
alter table portal_private.client_applications add constraint client_applications_price_mode_fields check(
  (price_mode::text='CLIENT_PROPOSED_PRICE' and proposed_currency is not null
    and (proposed_price is not null or source_price_mode='NEGOTIATED_LINE_LEVEL'))
  or price_mode::text='ACCEPT_PUBLISHED_PRICE'
  or (price_mode::text='REQUEST_DELIVERED_PRICE' and
      ((proposed_price is null and proposed_currency is null) or
       (proposed_price is not null and proposed_currency is not null)))
);

create table portal_private.client_application_number_reservations_v2 (
  application_id text primary key,
  client_key uuid not null references portal_private.clients(id),
  calendar_year integer not null,
  ordinal bigint not null check(ordinal>0),
  operations_identity_key uuid not null references portal_private.ai_service_identities(id),
  issued_at timestamptz not null default clock_timestamp(),
  issued_to_application_key uuid,
  unique(client_key,calendar_year,ordinal)
);
create table portal_private.client_application_registry_v2 (
  application_key uuid primary key,
  application_id text not null unique,
  client_key uuid not null references portal_private.clients(id),
  contract_key uuid not null references portal_private.contracts(id),
  primary_intake_id uuid unique references portal_private.client_intake_v1(intake_id),
  source_kind text not null,
  source_record_id text not null,
  source_submitted_at timestamptz,
  numbering_origin text not null check(numbering_origin in ('OPERATIONS_EXECUTOR','AUTHORITATIVE_LEGACY')),
  numbering_identity_key uuid references portal_private.ai_service_identities(id),
  registered_at timestamptz not null default clock_timestamp(),
  retired_at timestamptz,
  unique(source_kind,source_record_id),
  check(numbering_origin<>'OPERATIONS_EXECUTOR' or numbering_identity_key is not null)
);
-- No FK back to the live application: identity/audit survives physical business deletion.
create table portal_private.client_application_tombstones_v2 (
  application_key uuid primary key references portal_private.client_application_registry_v2(application_key),
  application_id text not null unique,
  primary_intake_id uuid,
  reason_code text not null,
  source_fingerprint text not null,
  application_snapshot jsonb not null,
  lines_snapshot jsonb not null,
  workflow_snapshot jsonb,
  operations_identity_key uuid not null references portal_private.ai_service_identities(id),
  deleted_at timestamptz not null default clock_timestamp()
);
create table portal_private.client_application_source_disposition_v2 (
  intake_id uuid primary key references portal_private.client_intake_v1(intake_id),
  disposition text not null check(disposition in ('BUSINESS','TECHNICAL_ONLY','TERMINAL_REQUEST','DELETED')),
  reason_code text not null,
  application_key uuid references portal_private.client_application_registry_v2(application_key),
  recorded_at timestamptz not null default clock_timestamp()
);
create table portal_private.client_application_jobs_v2 (
  intake_id uuid primary key references portal_private.client_intake_v1(intake_id),
  state text not null default 'PENDING' check(state in ('PENDING','DONE','RETRY','BLOCKED')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  updated_at timestamptz not null default now()
);
create table portal_private.client_application_audit_v2 (
  audit_id uuid primary key default gen_random_uuid(),
  application_id text,
  intake_id uuid,
  event_type text not null,
  operations_identity_key uuid references portal_private.ai_service_identities(id),
  evidence jsonb not null,
  occurred_at timestamptz not null default clock_timestamp()
);
create table portal_private.client_application_inventory_runs_v2 (
  run_id uuid primary key default gen_random_uuid(),
  observed_at timestamptz not null default clock_timestamp(),
  inventory jsonb not null,
  source_fingerprint text not null,
  operations_identity_key uuid not null references portal_private.ai_service_identities(id)
);
create table portal_private.client_application_submit_receipts_v2 (
  client_key uuid not null references portal_private.clients(id),
  contract_key uuid not null references portal_private.contracts(id),
  idempotency_key text not null,
  request_fingerprint text not null,
  application_id text not null,
  created_at timestamptz not null default now(),
  primary key(client_key,contract_key,idempotency_key)
);

create function portal_private.application_operations_authority_v2()
returns uuid language plpgsql stable security definer
set search_path='pg_catalog','portal_private' as $$
declare n integer; k uuid;
begin
  select count(*),(array_agg(id))[1] into n,k
  from portal_private.ai_service_identities
  where business_role::text='OPERATIONS_DIRECTOR' and status::text='ACTIVE'
    and revoked_at is null and (not_before is null or not_before<=now());
  if n<>1 then raise exception 'APPLICATION_OPERATIONS_AUTHORITY_UNAVAILABLE'; end if;
  if not exists(select 1 from portal_private.client_application_policy_v2
                where authority_role='OPERATIONS_DIRECTOR' and authorization_source<>'')
    then raise exception 'APPLICATION_NUMBERING_POLICY_MISSING'; end if;
  return k;
end $$;

create function portal_private.guard_application_append_only_v2()
returns trigger language plpgsql set search_path='pg_catalog' as $$
begin raise exception 'APPLICATION_AUDIT_IS_APPEND_ONLY'; end $$;
create trigger application_tombstone_immutable_v2 before update or delete
on portal_private.client_application_tombstones_v2 for each row
execute function portal_private.guard_application_append_only_v2();
create trigger application_audit_immutable_v2 before update or delete
on portal_private.client_application_audit_v2 for each row
execute function portal_private.guard_application_append_only_v2();
create trigger application_inventory_immutable_v2 before update or delete
on portal_private.client_application_inventory_runs_v2 for each row
execute function portal_private.guard_application_append_only_v2();

-- Row locking on the shared counter serializes distinct applications from one client.
-- Source/submit receipt locks provide idempotency; failed transactions roll back reservations.
create or replace function portal_private.next_application_business_id(p_client_key uuid)
returns text language plpgsql security definer
set search_path='pg_catalog','portal_private' as $$
declare y integer:=extract(year from current_date)::integer; n bigint;
  cid text; business_id text; authority uuid; existing_max bigint;
begin
  authority:=portal_private.application_operations_authority_v2();
  select client_id into cid from portal_private.clients where id=p_client_key;
  if cid is null or btrim(cid)='' then raise exception 'CLIENT_NOT_FOUND'; end if;
  insert into portal_private.application_id_counters(client_key,calendar_year,last_number)
    values(p_client_key,y,0) on conflict(client_key,calendar_year) do nothing;
  perform 1 from portal_private.application_id_counters
    where client_key=p_client_key and calendar_year=y for update;
  select coalesce(max((m.parts)[3]::bigint),0) into existing_max from (
    select regexp_match(application_id,'^(.+)-IN-([0-9]{4})-([0-9]+)$') parts
      from portal_private.client_applications where client_key=p_client_key
    union all
    select regexp_match(application_id,'^(.+)-IN-([0-9]{4})-([0-9]+)$')
      from portal_private.client_application_registry_v2 where client_key=p_client_key
  ) m where (m.parts)[1]=cid and (m.parts)[2]=y::text;
  update portal_private.application_id_counters
    set last_number=greatest(last_number,existing_max)+1,updated_at=now()
    where client_key=p_client_key and calendar_year=y returning last_number into n;
  business_id:=cid||'-IN-'||y::text||'-'||lpad(n::text,greatest(3,length(n::text)),'0');
  insert into portal_private.client_application_number_reservations_v2
    (application_id,client_key,calendar_year,ordinal,operations_identity_key)
    values(business_id,p_client_key,y,n,authority);
  return business_id;
end $$;

create function portal_private.ensure_application_registry_v2(p_application_key uuid)
returns text language plpgsql security definer
set search_path='pg_catalog','portal_private' as $$
declare a portal_private.client_applications; r portal_private.client_application_registry_v2;
  i portal_private.client_intake_v1; reservation portal_private.client_application_number_reservations_v2;
  cid text;
begin
  select * into a from portal_private.client_applications where id=p_application_key for update;
  if not found then
    select * into r from portal_private.client_application_registry_v2 where application_key=p_application_key;
    if found and r.retired_at is not null then return r.application_id; end if;
    raise exception 'CANONICAL_APPLICATION_NOT_FOUND';
  end if;
  select cl.client_id into cid from portal_private.clients cl
    join portal_private.contracts ct on ct.id=a.contract_key and ct.client_key=cl.id
    where cl.id=a.client_key and nullif(btrim(cl.legal_name),'') is not null;
  if cid is null then raise exception 'APPLICATION_CLIENT_CHAIN_MISSING'; end if;
  if a.application_id !~ '^.+-IN-[0-9]{4}-[0-9]{3,}$'
     or split_part(a.application_id,'-IN-',1)<>cid then raise exception 'APPLICATION_BUSINESS_ID_INVALID'; end if;
  select * into r from portal_private.client_application_registry_v2 where application_key=a.id;
  if found then
    if r.retired_at is not null then raise exception 'APPLICATION_RESURRECTION_DENIED'; end if;
    if (r.application_id,r.client_key,r.contract_key) is distinct from
       (a.application_id,a.client_key,a.contract_key) then raise exception 'APPLICATION_IDENTITY_CONFLICT'; end if;
    return r.application_id;
  end if;
  select * into i from portal_private.client_intake_v1
    where intake_id=a.source_intake_key
       or (source_kind='CLIENT_APPLICATION' and source_internal_key=a.id)
    order by case when intake_id=a.source_intake_key then 0 else 1 end limit 1;
  select * into reservation from portal_private.client_application_number_reservations_v2
    where application_id=a.application_id;
  if reservation.application_id is not null and reservation.client_key<>a.client_key
    then raise exception 'APPLICATION_NUMBER_CLIENT_MISMATCH'; end if;
  insert into portal_private.client_application_registry_v2
    (application_key,application_id,client_key,contract_key,primary_intake_id,source_kind,
     source_record_id,source_submitted_at,numbering_origin,numbering_identity_key)
    values(a.id,a.application_id,a.client_key,a.contract_key,i.intake_id,
      coalesce(i.source_kind,'CLIENT_APPLICATION'),coalesce(i.source_record_id,a.application_id),
      case when i.intake_id is not null then i.source_submitted_at else a.submitted_at end,
      case when reservation.application_id is null then 'AUTHORITATIVE_LEGACY' else 'OPERATIONS_EXECUTOR' end,
      reservation.operations_identity_key);
  insert into portal_private.client_application_audit_v2
    (application_id,intake_id,event_type,operations_identity_key,evidence)
    values(a.application_id,i.intake_id,'CANONICAL_APPLICATION_REGISTERED',reservation.operations_identity_key,
      jsonb_build_object('client_key',a.client_key,'contract_key',a.contract_key,
      'source_kind',coalesce(i.source_kind,'CLIENT_APPLICATION'),
      'source_record_id',coalesce(i.source_record_id,a.application_id),
      'legacy_identity_preserved',reservation.application_id is null));
  return a.application_id;
end $$;

create function portal_private.guard_application_business_identity_v2()
returns trigger language plpgsql security definer
set search_path='pg_catalog','portal_private' as $$
declare r portal_private.client_application_number_reservations_v2;
begin
  if tg_op='DELETE' then
    if not exists(select 1 from portal_private.client_application_tombstones_v2 where application_key=old.id)
      then raise exception 'APPLICATION_DELETE_REQUIRES_AUDITED_TOMBSTONE'; end if;
    return old;
  end if;
  if tg_op='UPDATE' then
    if (old.id,old.application_id,old.client_key,old.contract_key,old.source_intake_key)
       is distinct from (new.id,new.application_id,new.client_key,new.contract_key,new.source_intake_key)
      then raise exception 'APPLICATION_IDENTITY_IMMUTABLE'; end if;
    return new;
  end if;
  if not (select enabled from portal_private.client_application_policy_v2 where singleton) then return new; end if;
  if new.application_id is null or btrim(new.application_id)='' then
    new.application_id:=portal_private.next_application_business_id(new.client_key);
  end if;
  if exists(select 1 from portal_private.client_application_tombstones_v2 where application_id=new.application_id)
    then raise exception 'APPLICATION_RESURRECTION_DENIED'; end if;
  select * into r from portal_private.client_application_number_reservations_v2
    where application_id=new.application_id for update;
  if not found or r.client_key<>new.client_key
     or (r.issued_to_application_key is not null and r.issued_to_application_key<>new.id)
    then raise exception 'APPLICATION_NUMBER_NOT_RESERVED_BY_OPERATIONS'; end if;
  update portal_private.client_application_number_reservations_v2
    set issued_to_application_key=new.id where application_id=new.application_id;
  return new;
end $$;
create trigger a_application_identity_v2 before insert or update or delete
on portal_private.client_applications for each row
execute function portal_private.guard_application_business_identity_v2();

-- Internal tables are not readable/writable through arbitrary browser SQL/RPC.
do $$ declare t text; begin
  foreach t in array array['client_application_policy_v2','client_application_number_reservations_v2',
    'client_application_registry_v2','client_application_tombstones_v2','client_application_source_disposition_v2',
    'client_application_jobs_v2','client_application_audit_v2','client_application_inventory_runs_v2',
    'client_application_submit_receipts_v2'] loop
    execute format('alter table portal_private.%I enable row level security',t);
    execute format('revoke all on portal_private.%I from public,anon,authenticated',t);
  end loop;
end $$;
revoke all on function portal_private.application_operations_authority_v2(),
  portal_private.guard_application_append_only_v2(),
  portal_private.ensure_application_registry_v2(uuid),
  portal_private.guard_application_business_identity_v2(),
  portal_private.next_application_business_id(uuid) from public,anon,authenticated;
