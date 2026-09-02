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

  select ct.id into v_contract_key from portal_private.contracts ct where ct.contract_id=v_contract_id and ct.counterparty_code=v_code and ct.authority_state not in ('REJECTED','SUPERSEDED') and ct.lifecycle_state not in ('ARCHIVED','SUPERSEDED') limit 1;
  if v_contract_key is null then raise exception 'COUNTERPARTY_CONTRACT_NOT_FOUND'; end if;
  if exists(select 1 from portal_private.documents d where d.document_id=v_document_id) then raise exception 'DOCUMENT_ID_ALREADY_REGISTERED'; end if;

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
