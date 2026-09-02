alter table portal_private.contracts add column if not exists counterparty_code text;
alter table portal_private.contracts alter column client_key drop not null;
alter table portal_private.documents add column if not exists counterparty_code text;
alter table portal_private.documents alter column client_key drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='contracts_party_scope_check' and conrelid='portal_private.contracts'::regclass) then
    alter table portal_private.contracts add constraint contracts_party_scope_check check (client_key is not null or nullif(btrim(counterparty_code),'') is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname='contracts_counterparty_code_nonblank' and conrelid='portal_private.contracts'::regclass) then
    alter table portal_private.contracts add constraint contracts_counterparty_code_nonblank check (counterparty_code is null or btrim(counterparty_code) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname='contracts_id_counterparty_unique' and conrelid='portal_private.contracts'::regclass) then
    alter table portal_private.contracts add constraint contracts_id_counterparty_unique unique(id,counterparty_code);
  end if;
  if not exists (select 1 from pg_constraint where conname='documents_party_scope_check' and conrelid='portal_private.documents'::regclass) then
    alter table portal_private.documents add constraint documents_party_scope_check check (client_key is not null or nullif(btrim(counterparty_code),'') is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname='documents_counterparty_code_nonblank' and conrelid='portal_private.documents'::regclass) then
    alter table portal_private.documents add constraint documents_counterparty_code_nonblank check (counterparty_code is null or btrim(counterparty_code) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname='documents_contract_key_fkey' and conrelid='portal_private.documents'::regclass) then
    alter table portal_private.documents add constraint documents_contract_key_fkey foreign key(contract_key) references portal_private.contracts(id);
  end if;
  if not exists (select 1 from pg_constraint where conname='documents_contract_counterparty_fk' and conrelid='portal_private.documents'::regclass) then
    alter table portal_private.documents add constraint documents_contract_counterparty_fk foreign key(contract_key,counterparty_code) references portal_private.contracts(id,counterparty_code);
  end if;
end $$;

create index if not exists contracts_counterparty_code_idx on portal_private.contracts(counterparty_code) where counterparty_code is not null;
create index if not exists documents_counterparty_code_idx on portal_private.documents(counterparty_code) where counterparty_code is not null;

create table if not exists portal_private.counterparty_document_sequences(
  counterparty_code text not null,
  document_year integer not null,
  direction text not null,
  last_sequence integer not null default 0,
  source_system text not null default 'AUTHORITATIVE_ALLOCATOR',
  updated_at timestamptz not null default now(),
  primary key(counterparty_code,document_year,direction),
  constraint counterparty_document_sequences_code_nonblank check (btrim(counterparty_code)<>''),
  constraint counterparty_document_sequences_year_check check (document_year between 2000 and 2100),
  constraint counterparty_document_sequences_direction_check check (direction in ('IN','OUT')),
  constraint counterparty_document_sequences_value_check check (last_sequence>=0)
);
alter table portal_private.counterparty_document_sequences enable row level security;
drop policy if exists rona_server_bypass_guard on portal_private.counterparty_document_sequences;
create policy rona_server_bypass_guard on portal_private.counterparty_document_sequences as restrictive for all using(false) with check(false);

create or replace function portal_private.allocate_counterparty_document_id_v1(
  p_counterparty_code text,
  p_document_year integer,
  p_direction text,
  p_source_floor integer default 0
) returns text
language plpgsql
security definer
set search_path=portal_private,public,pg_temp
as $$
declare
  v_code text:=upper(btrim(p_counterparty_code));
  v_dir text:=upper(btrim(p_direction));
  v_prefix text;
  v_existing integer:=0;
  v_stored integer:=0;
  v_next integer;
begin
  if v_code !~ '^S-[0-9]{3,}$' then raise exception 'COUNTERPARTY_CODE_INVALID'; end if;
  if p_document_year<2000 or p_document_year>2100 then raise exception 'DOCUMENT_YEAR_INVALID'; end if;
  if v_dir not in ('IN','OUT') then raise exception 'DOCUMENT_DIRECTION_INVALID'; end if;
  if coalesce(p_source_floor,0)<0 then raise exception 'SOURCE_FLOOR_INVALID'; end if;
  v_prefix:='RONA-'||replace(v_code,'-','')||'-'||v_dir||'-'||p_document_year::text||'-';
  perform pg_advisory_xact_lock(hashtext('RONA_COUNTERPARTY_DOCUMENT_ALLOCATOR:'||v_code||':'||p_document_year::text||':'||v_dir));
  select coalesce(max((regexp_match(document_id,'([0-9]{3})$'))[1]::integer),0) into v_existing
  from portal_private.documents where document_id like v_prefix||'%';
  select coalesce(last_sequence,0) into v_stored from portal_private.counterparty_document_sequences where counterparty_code=v_code and document_year=p_document_year and direction=v_dir;
  v_next:=greatest(v_existing,v_stored,coalesce(p_source_floor,0))+1;
  insert into portal_private.counterparty_document_sequences(counterparty_code,document_year,direction,last_sequence,source_system,updated_at)
  values(v_code,p_document_year,v_dir,v_next,'AUTHORITATIVE_ALLOCATOR',now())
  on conflict(counterparty_code,document_year,direction) do update set last_sequence=excluded.last_sequence,updated_at=now();
  return v_prefix||lpad(v_next::text,3,'0');
end;
$$;

create or replace function portal_private.materialize_existing_counterparty_contract_source_v1(
  p_idempotency_key text,
  p_source_system text,
  p_source_object_id text,
  p_source_version text,
  p_source_timestamp timestamptz,
  p_counterparty_code text,
  p_contract_id text,
  p_external_contract_number text,
  p_contract_date date,
  p_source_file_ref text default null,
  p_source_filename text default null,
  p_source_checksum_sha256 text default null,
  p_source_size_bytes bigint default null,
  p_actor_user_id uuid default null,
  p_request_id uuid default null,
  p_correlation_id uuid default null
) returns table(contract_id text,import_batch_id uuid,source_object_key uuid,created boolean)
language plpgsql
security definer
set search_path=portal_private,public,pg_temp
as $$
declare
  v_existing portal_private.source_objects%rowtype;
  v_contract portal_private.contracts%rowtype;
  v_batch uuid;
  v_source uuid;
  v_contract_key uuid;
  v_code text:=upper(btrim(p_counterparty_code));
  v_contract_id text:=btrim(p_contract_id);
  v_ext text:=btrim(p_external_contract_number);
  v_snapshot jsonb;
begin
  if nullif(btrim(p_idempotency_key),'') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if nullif(btrim(p_source_system),'') is null then raise exception 'SOURCE_SYSTEM_REQUIRED'; end if;
  if nullif(btrim(p_source_object_id),'') is null then raise exception 'SOURCE_OBJECT_ID_REQUIRED'; end if;
  if p_source_timestamp is null then raise exception 'SOURCE_TIMESTAMP_REQUIRED'; end if;
  if v_code !~ '^S-[0-9]{3,}$' then raise exception 'COUNTERPARTY_CODE_INVALID'; end if;
  if v_contract_id !~ '^RONA-S[0-9]{3,}-CTR-[0-9]{4}-[0-9]{3}$' then raise exception 'COUNTERPARTY_CONTRACT_ID_INVALID'; end if;
  if nullif(v_ext,'') is null then raise exception 'EXTERNAL_CONTRACT_NUMBER_REQUIRED'; end if;
  if p_contract_date is null then raise exception 'CONTRACT_DATE_REQUIRED'; end if;
  if p_source_checksum_sha256 is not null and p_source_checksum_sha256 !~ '^[0-9a-fA-F]{64}$' then raise exception 'INVALID_SOURCE_CHECKSUM'; end if;
  if p_source_size_bytes is not null and p_source_size_bytes<=0 then raise exception 'INVALID_SOURCE_SIZE'; end if;

  select so.* into v_existing from portal_private.source_objects so where so.idempotency_key=p_idempotency_key limit 1;
  if found then
    return query select coalesce(v_existing.raw_snapshot->>'assigned_contract_id',v_contract_id),v_existing.import_batch_id,v_existing.id,false;
    return;
  end if;

  select * into v_contract from portal_private.contracts where portal_private.contracts.contract_id=v_contract_id limit 1;
  if found then
    if coalesce(v_contract.counterparty_code,'')<>v_code or coalesce(v_contract.current_external_contract_number,'')<>v_ext then raise exception 'CONTRACT_IDENTITY_CONFLICT'; end if;
    return query select v_contract_id,v_contract.import_batch_id,null::uuid,false;
    return;
  end if;

  if exists(select 1 from portal_private.contracts ct where ct.current_external_contract_number=v_ext and ct.authority_state not in ('REJECTED','SUPERSEDED') and ct.lifecycle_state not in ('ARCHIVED','SUPERSEDED')) then raise exception 'EXTERNAL_CONTRACT_ALREADY_REGISTERED'; end if;

  insert into portal_private.import_batches(idempotency_key,source_system,source_version,source_timestamp,checksum_sha256,result,record_count,imported_count,skipped_count,error_count,initiated_by,note)
  values('COUNTERPARTY_CONTRACT_BATCH:'||p_idempotency_key,p_source_system,p_source_version,p_source_timestamp,lower(p_source_checksum_sha256),'STARTED',1,0,0,0,p_actor_user_id,'Existing canonical counterparty contract materialization; no client entity created') returning id into v_batch;

  insert into portal_private.contracts(contract_id,client_key,counterparty_code,current_external_contract_number,contract_status,effective_from,source_system,source_version,source_timestamp,import_batch_id,authority_state,lifecycle_state)
  values(v_contract_id,null,v_code,v_ext,'ACTIVE',p_contract_date,p_source_system,p_source_version,p_source_timestamp,v_batch,'CONFIRMED','ACTIVE') returning id into v_contract_key;

  insert into portal_private.contract_external_references(contract_key,reference_value,reference_type,effective_from,source_note,authority_state,created_by)
  values(v_contract_key,v_ext,'CURRENT',p_contract_date,'Existing canonical counterparty contract materialized from documentary source authority','CONFIRMED',p_actor_user_id);

  v_snapshot:=jsonb_build_object('assigned_contract_id',v_contract_id,'counterparty_code',v_code,'external_contract_number',v_ext,'contract_date',p_contract_date,'source_file_ref',p_source_file_ref,'source_filename',p_source_filename,'source_checksum_sha256',lower(p_source_checksum_sha256),'source_size_bytes',p_source_size_bytes,'materialization_state','AUTHORITATIVE_CONTRACT_MATERIALIZED','client_entity_created',false);
  insert into portal_private.source_objects(import_batch_id,idempotency_key,source_system,source_object_type,source_object_id,source_version,source_timestamp,checksum_sha256,raw_snapshot)
  values(v_batch,p_idempotency_key,p_source_system,'COUNTERPARTY_CONTRACT',p_source_object_id,p_source_version,p_source_timestamp,lower(p_source_checksum_sha256),v_snapshot) returning id into v_source;

  insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata)
  values(p_actor_user_id,'SYSTEM','SOURCE_EXISTING_COUNTERPARTY_CONTRACT_MATERIALIZED','CONTRACT',v_contract_id,p_request_id,p_correlation_id,jsonb_build_object('counterparty_code',v_code,'external_contract_number',v_ext,'import_batch_id',v_batch,'source_object_key',v_source,'source_system',p_source_system,'client_entity_created',false));

  update portal_private.import_batches set finished_at=now(),result='SUCCEEDED',imported_count=1,updated_at=now() where id=v_batch;
  return query select v_contract_id,v_batch,v_source,true;
end;
$$;

create or replace function portal_private.materialize_counterparty_document_source_v1(
  p_idempotency_key text,
  p_source_system text,
  p_source_object_id text,
  p_source_version text,
  p_source_timestamp timestamptz,
  p_counterparty_code text,
  p_contract_id text,
  p_document_id text,
  p_document_type text,
  p_authoritative_filename text,
  p_source_file_ref text,
  p_source_checksum_sha256 text default null,
  p_source_size_bytes bigint default null,
  p_actor_user_id uuid default null,
  p_request_id uuid default null,
  p_correlation_id uuid default null
) returns table(document_id text,import_batch_id uuid,source_object_key uuid,created boolean)
language plpgsql
security definer
set search_path=portal_private,public,pg_temp
as $$
declare
  v_existing portal_private.source_objects%rowtype;
  v_contract_key uuid;
  v_document_key uuid;
  v_batch uuid;
  v_source uuid;
  v_code text:=upper(btrim(p_counterparty_code));
  v_contract_id text:=btrim(p_contract_id);
  v_document_id text:=btrim(p_document_id);
  v_type text:=btrim(p_document_type);
  v_filename text:=btrim(p_authoritative_filename);
  v_snapshot jsonb;
begin
  if nullif(btrim(p_idempotency_key),'') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if nullif(btrim(p_source_system),'') is null then raise exception 'SOURCE_SYSTEM_REQUIRED'; end if;
  if nullif(btrim(p_source_object_id),'') is null then raise exception 'SOURCE_OBJECT_ID_REQUIRED'; end if;
  if p_source_timestamp is null then raise exception 'SOURCE_TIMESTAMP_REQUIRED'; end if;
  if v_code !~ '^S-[0-9]{3,}$' then raise exception 'COUNTERPARTY_CODE_INVALID'; end if;
  if v_contract_id !~ '^RONA-S[0-9]{3,}-CTR-[0-9]{4}-[0-9]{3}$' then raise exception 'COUNTERPARTY_CONTRACT_ID_INVALID'; end if;
  if v_document_id !~ ('^RONA-'||replace(v_code,'-','')||'-(IN|OUT)-[0-9]{4}-[0-9]{3}$') then raise exception 'COUNTERPARTY_DOCUMENT_ID_INVALID'; end if;
  if nullif(v_type,'') is null then raise exception 'DOCUMENT_TYPE_REQUIRED'; end if;
  if nullif(v_filename,'') is null then raise exception 'AUTHORITATIVE_FILENAME_REQUIRED'; end if;
  if nullif(btrim(p_source_file_ref),'') is null then raise exception 'SOURCE_FILE_REF_REQUIRED'; end if;
  if p_source_checksum_sha256 is not null and p_source_checksum_sha256 !~ '^[0-9a-fA-F]{64}$' then raise exception 'INVALID_SOURCE_CHECKSUM'; end if;
  if p_source_size_bytes is not null and p_source_size_bytes<=0 then raise exception 'INVALID_SOURCE_SIZE'; end if;

  select so.* into v_existing from portal_private.source_objects so where so.idempotency_key=p_idempotency_key limit 1;
  if found then return query select coalesce(v_existing.raw_snapshot->>'assigned_document_id',v_document_id),v_existing.import_batch_id,v_existing.id,false; return; end if;

  select id into v_contract_key from portal_private.contracts where contract_id=v_contract_id and counterparty_code=v_code and authority_state not in ('REJECTED','SUPERSEDED') and lifecycle_state not in ('ARCHIVED','SUPERSEDED') limit 1;
  if v_contract_key is null then raise exception 'COUNTERPARTY_CONTRACT_NOT_FOUND'; end if;
  if exists(select 1 from portal_private.documents where document_id=v_document_id) then raise exception 'DOCUMENT_ID_ALREADY_REGISTERED'; end if;

  insert into portal_private.import_batches(idempotency_key,source_system,source_version,source_timestamp,checksum_sha256,result,record_count,imported_count,skipped_count,error_count,initiated_by,note)
  values('COUNTERPARTY_DOCUMENT_BATCH:'||p_idempotency_key,p_source_system,p_source_version,p_source_timestamp,lower(p_source_checksum_sha256),'STARTED',1,0,0,0,p_actor_user_id,'Counterparty document source registration; source reference pinned; storage version may follow') returning id into v_batch;

  insert into portal_private.documents(document_id,document_type,client_key,counterparty_code,contract_key,deal_key,authoritative_filename,current_version_id,source_system,source_version,source_timestamp,import_batch_id,authority_state,lifecycle_state)
  values(v_document_id,v_type,null,v_code,v_contract_key,null,v_filename,null,p_source_system,p_source_version,p_source_timestamp,v_batch,'SOURCE_RECEIVED','ACTIVE') returning id into v_document_key;

  v_snapshot:=jsonb_build_object('assigned_document_id',v_document_id,'counterparty_code',v_code,'contract_id',v_contract_id,'document_type',v_type,'authoritative_filename',v_filename,'source_file_ref',p_source_file_ref,'source_checksum_sha256',lower(p_source_checksum_sha256),'source_size_bytes',p_source_size_bytes,'materialization_state','SOURCE_REGISTERED_STORAGE_PENDING');
  insert into portal_private.source_objects(import_batch_id,idempotency_key,source_system,source_object_type,source_object_id,source_version,source_timestamp,checksum_sha256,raw_snapshot)
  values(v_batch,p_idempotency_key,p_source_system,'COUNTERPARTY_DOCUMENT',p_source_object_id,p_source_version,p_source_timestamp,lower(p_source_checksum_sha256),v_snapshot) returning id into v_source;

  insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata)
  values(p_actor_user_id,'SYSTEM','SOURCE_COUNTERPARTY_DOCUMENT_REGISTERED','DOCUMENT',v_document_id,p_request_id,p_correlation_id,jsonb_build_object('counterparty_code',v_code,'contract_id',v_contract_id,'document_key',v_document_key,'import_batch_id',v_batch,'source_object_key',v_source,'storage_state','PENDING'));

  update portal_private.import_batches set finished_at=now(),result='SUCCEEDED',imported_count=1,updated_at=now() where id=v_batch;
  return query select v_document_id,v_batch,v_source,true;
end;
$$;

revoke all on portal_private.counterparty_document_sequences from public,anon,authenticated;
revoke all on function portal_private.allocate_counterparty_document_id_v1(text,integer,text,integer) from public,anon,authenticated;
revoke all on function portal_private.materialize_existing_counterparty_contract_source_v1(text,text,text,text,timestamptz,text,text,text,date,text,text,text,bigint,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function portal_private.materialize_counterparty_document_source_v1(text,text,text,text,timestamptz,text,text,text,text,text,text,text,bigint,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function portal_private.allocate_counterparty_document_id_v1(text,integer,text,integer) to service_role;
grant execute on function portal_private.materialize_existing_counterparty_contract_source_v1(text,text,text,text,timestamptz,text,text,text,date,text,text,text,bigint,uuid,uuid,uuid) to service_role;
grant execute on function portal_private.materialize_counterparty_document_source_v1(text,text,text,text,timestamptz,text,text,text,text,text,text,text,bigint,uuid,uuid,uuid) to service_role;
