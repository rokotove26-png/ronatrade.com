-- ONLINE RAIL / #644 — STAGE C1.1 GENERIC XLSX SOURCE INTAKE
-- REPOSITORY CANDIDATE ONLY. DO NOT APPLY TO PRODUCTION.
--
-- Invariants:
--   * canonical file identity = SHA-256 of original workbook bytes;
--   * filename and worksheet names are provenance/locators only, never file identity;
--   * same bytes under different filenames reuse one canonical source object;
--   * different bytes under the same filename create different canonical source objects;
--   * raw workbook storage is private and content-addressed:
--       rona-portal-private/rail/source/<sha256>/original.xlsx
--   * source capture does not create Deal, shipment, rail_wagon, GEO, or business status;
--   * B1.5 guarded evidence ingest remains the only XLSX event-history write surface.

begin;

create unique index if not exists rail_xlsx_source_sha_identity_unique_v1
  on portal_private.source_objects (lower(checksum_sha256))
  where source_system='RAIL_AI'
    and source_object_type='XLSX_WAGON_DISLOCATION'
    and coalesce(source_version,'')='RAIL_XLSX_DISLOCATION_V1'
    and checksum_sha256 is not null;

create table if not exists portal_private.rail_xlsx_source_receipts_v1 (
  id uuid primary key default gen_random_uuid(),

  import_batch_id uuid not null,
  source_object_id uuid not null,

  canonical_sha256 text not null,
  original_filename text not null,
  byte_size bigint not null,
  reported_mime_type text,
  canonical_mime_type text not null
    default 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  received_at timestamptz not null,
  private_bucket text not null,
  private_key text not null,
  source_chat_ref text not null,

  functional_role portal_private.ai_business_role_enum not null
    default 'RAIL_LOGISTICS',
  identity_id text not null,
  client_id text not null,
  correlation_id uuid not null,
  mcp_request_id uuid not null,
  idempotency_key_hash text not null,
  duplicate_file boolean not null,

  created_at timestamptz not null default now(),

  constraint rail_xlsx_source_receipt_source_scope_fk
    foreign key (source_object_id, import_batch_id)
    references portal_private.source_objects(id, import_batch_id)
    on delete restrict,
  constraint rail_xlsx_source_receipt_batch_fk
    foreign key (import_batch_id)
    references portal_private.import_batches(id)
    on delete restrict,

  constraint rail_xlsx_source_receipt_sha_format
    check (canonical_sha256 ~ '^[0-9a-f]{64}$'),
  constraint rail_xlsx_source_receipt_filename_nonblank
    check (btrim(original_filename) <> ''),
  constraint rail_xlsx_source_receipt_size
    check (byte_size > 0 and byte_size <= 52428800),
  constraint rail_xlsx_source_receipt_canonical_mime
    check (
      canonical_mime_type =
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ),
  constraint rail_xlsx_source_receipt_bucket
    check (private_bucket='rona-portal-private'),
  constraint rail_xlsx_source_receipt_key
    check (
      private_key =
      'rail/source/' || canonical_sha256 || '/original.xlsx'
    ),
  constraint rail_xlsx_source_receipt_chat_ref_nonblank
    check (btrim(source_chat_ref) <> ''),
  constraint rail_xlsx_source_receipt_role
    check (functional_role='RAIL_LOGISTICS'),
  constraint rail_xlsx_source_receipt_identity
    check (identity_id='AI-RAIL-LOGISTICS'),
  constraint rail_xlsx_source_receipt_client_nonblank
    check (btrim(client_id) <> ''),
  constraint rail_xlsx_source_receipt_idem_hash
    check (idempotency_key_hash ~ '^[0-9a-f]{64}$')
);

create unique index if not exists rail_xlsx_source_receipt_idem_unique_v1
  on portal_private.rail_xlsx_source_receipts_v1
  (identity_id, idempotency_key_hash);

create index if not exists rail_xlsx_source_receipt_sha_idx_v1
  on portal_private.rail_xlsx_source_receipts_v1
  (canonical_sha256, received_at desc, id desc);

create index if not exists rail_xlsx_source_receipt_source_idx_v1
  on portal_private.rail_xlsx_source_receipts_v1
  (source_object_id, received_at desc, id desc);

alter table portal_private.rail_xlsx_source_receipts_v1
  enable row level security;

drop policy if exists rona_server_bypass_guard
  on portal_private.rail_xlsx_source_receipts_v1;
create policy rona_server_bypass_guard
  on portal_private.rail_xlsx_source_receipts_v1
  for all to authenticated
  using (false) with check (false);

revoke all on table portal_private.rail_xlsx_source_receipts_v1
  from public, anon, authenticated, service_role;
grant select on table portal_private.rail_xlsx_source_receipts_v1
  to service_role;

drop trigger if exists rail_xlsx_source_receipt_append_only_v1
  on portal_private.rail_xlsx_source_receipts_v1;
create trigger rail_xlsx_source_receipt_append_only_v1
before update or delete on portal_private.rail_xlsx_source_receipts_v1
for each row execute function portal_private.rail_xlsx_append_only_guard_v1();

create or replace function portal_private.rail_xlsx_source_capture_register_v1(
  p_sha256 text,
  p_original_filename text,
  p_byte_size bigint,
  p_reported_mime_type text,
  p_received_at timestamptz,
  p_private_bucket text,
  p_private_key text,
  p_source_chat_ref text,
  p_identity_id text,
  p_client_id text,
  p_correlation_id uuid,
  p_mcp_request_id uuid,
  p_idempotency_key_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, storage
as $$
declare
  v_sha text;
  v_batch_id uuid;
  v_source portal_private.source_objects%rowtype;
  v_receipt portal_private.rail_xlsx_source_receipts_v1%rowtype;
  v_duplicate boolean := false;
  v_batch_existing portal_private.import_batches%rowtype;
  v_bucket_ok boolean := false;
  v_storage_object_exists boolean := false;
  v_source_time_domain text;
begin
  v_sha:=lower(btrim(coalesce(p_sha256,'')));

  if v_sha !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023', message='RAIL_XLSX_CAPTURE_SHA256_INVALID';
  end if;
  if nullif(btrim(coalesce(p_original_filename,'')),'') is null
     or length(p_original_filename)>255 then
    raise exception using errcode='22023', message='RAIL_XLSX_CAPTURE_FILENAME_INVALID';
  end if;
  if p_byte_size is null or p_byte_size<=0 or p_byte_size>52428800 then
    raise exception using errcode='22023', message='RAIL_XLSX_CAPTURE_SIZE_INVALID';
  end if;
  if p_received_at is null then
    raise exception using errcode='22023', message='RAIL_XLSX_CAPTURE_RECEIVED_AT_REQUIRED';
  end if;
  if p_private_bucket<>'rona-portal-private' then
    raise exception using errcode='23514', message='RAIL_XLSX_CAPTURE_BUCKET_INVALID';
  end if;
  if p_private_key<>('rail/source/'||v_sha||'/original.xlsx') then
    raise exception using errcode='23514', message='RAIL_XLSX_CAPTURE_STORAGE_KEY_INVALID';
  end if;
  if nullif(btrim(coalesce(p_source_chat_ref,'')),'') is null then
    raise exception using errcode='22023', message='RAIL_XLSX_CAPTURE_CHAT_REF_REQUIRED';
  end if;
  if p_identity_id<>'AI-RAIL-LOGISTICS' then
    raise exception using errcode='42501', message='RAIL_XLSX_CAPTURE_IDENTITY_DENIED';
  end if;
  if nullif(btrim(coalesce(p_client_id,'')),'') is null then
    raise exception using errcode='22023', message='RAIL_XLSX_CAPTURE_CLIENT_REQUIRED';
  end if;
  if p_correlation_id is null or p_mcp_request_id is null then
    raise exception using errcode='22023', message='RAIL_XLSX_CAPTURE_REQUEST_IDS_REQUIRED';
  end if;
  if lower(coalesce(p_idempotency_key_hash,'')) !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023', message='RAIL_XLSX_CAPTURE_IDEMPOTENCY_HASH_INVALID';
  end if;

  select exists(
    select 1
    from storage.buckets b
    where b.id='rona-portal-private'
      and b.name='rona-portal-private'
      and b.public=false
      and (
        b.allowed_mime_types is null
        or 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
           = any(b.allowed_mime_types)
      )
      and (b.file_size_limit is null or b.file_size_limit>=p_byte_size)
  ) into v_bucket_ok;

  if not v_bucket_ok then
    raise exception using errcode='23514', message='RAIL_XLSX_PRIVATE_BUCKET_POLICY_MISMATCH';
  end if;

  select exists(
    select 1
    from storage.objects o
    where o.bucket_id=p_private_bucket
      and o.name=p_private_key
      and coalesce(o.is_delete_marker,false)=false
  ) into v_storage_object_exists;

  if not v_storage_object_exists then
    raise exception using errcode='23503', message='RAIL_XLSX_CAPTURE_STORAGE_OBJECT_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('RAIL_XLSX_CAPTURE|'||v_sha,0)
  );

  select * into v_receipt
  from portal_private.rail_xlsx_source_receipts_v1
  where identity_id=p_identity_id
    and idempotency_key_hash=lower(p_idempotency_key_hash)
  limit 1;

  if found then
    if v_receipt.canonical_sha256<>v_sha
       or v_receipt.original_filename<>p_original_filename
       or v_receipt.byte_size<>p_byte_size
       or v_receipt.private_bucket<>p_private_bucket
       or v_receipt.private_key<>p_private_key
       or v_receipt.source_chat_ref<>p_source_chat_ref then
      raise exception using
        errcode='23505',
        message='RAIL_XLSX_CAPTURE_IDEMPOTENCY_CONFLICT';
    end if;

    return jsonb_build_object(
      'outcome','IDEMPOTENT_REPLAY',
      'receiptId',v_receipt.id,
      'importBatchId',v_receipt.import_batch_id,
      'sourceObjectId',v_receipt.source_object_id,
      'canonicalSha256',v_receipt.canonical_sha256,
      'duplicateFile',v_receipt.duplicate_file,
      'privateBucket',v_receipt.private_bucket,
      'privateKey',v_receipt.private_key
    );
  end if;

  select * into v_batch_existing
  from portal_private.import_batches
  where idempotency_key='RAIL_XLSX_FILE_SHA256:'||v_sha
  limit 1;

  if found then
    if lower(coalesce(v_batch_existing.checksum_sha256,''))<>v_sha
       or v_batch_existing.source_system<>'RAIL_AI'
       or coalesce(v_batch_existing.source_version,'')<>'RAIL_XLSX_DISLOCATION_V1' then
      raise exception using errcode='23514', message='RAIL_XLSX_CANONICAL_BATCH_CONFLICT';
    end if;
    v_batch_id:=v_batch_existing.id;
  else
    insert into portal_private.import_batches (
      idempotency_key,source_system,source_version,source_timestamp,
      checksum_sha256,note
    )
    values (
      'RAIL_XLSX_FILE_SHA256:'||v_sha,
      'RAIL_AI',
      'RAIL_XLSX_DISLOCATION_V1',
      p_received_at,
      v_sha,
      'RAIL_XLSX_GENERIC_INTAKE_V1'
    )
    returning id into v_batch_id;
  end if;

  select * into v_source
  from portal_private.source_objects
  where source_system='RAIL_AI'
    and source_object_type='XLSX_WAGON_DISLOCATION'
    and coalesce(source_version,'')='RAIL_XLSX_DISLOCATION_V1'
    and lower(checksum_sha256)=v_sha
  limit 1;

  v_source_time_domain:=
    'EXPEDITOR_XLSX_FILE_SHA256:'||v_sha||':LOCAL_WALL_CLOCK_UNRESOLVED_V1';

  if found then
    v_duplicate:=true;

    if v_source.import_batch_id<>v_batch_id
       or v_source.source_object_id<>('RAIL_XLSX_SHA256:'||v_sha)
       or coalesce(v_source.raw_snapshot->'canonicalIdentity'->>'sha256','')<>v_sha
       or coalesce(v_source.raw_snapshot->'storage'->>'bucket','')<>p_private_bucket
       or coalesce(v_source.raw_snapshot->'storage'->>'key','')<>p_private_key
       or coalesce(v_source.raw_snapshot->>'sourceTimeDomain','')<>v_source_time_domain then
      raise exception using errcode='23514', message='RAIL_XLSX_CANONICAL_SOURCE_CONFLICT';
    end if;
  else
    insert into portal_private.source_objects (
      import_batch_id,idempotency_key,source_system,source_object_type,
      source_object_id,source_version,source_timestamp,checksum_sha256,raw_snapshot
    )
    values (
      v_batch_id,
      'RAIL_XLSX_FILE_SHA256:'||v_sha,
      'RAIL_AI',
      'XLSX_WAGON_DISLOCATION',
      'RAIL_XLSX_SHA256:'||v_sha,
      'RAIL_XLSX_DISLOCATION_V1',
      p_received_at,
      v_sha,
      jsonb_build_object(
        'sourcePolicy','EXPEDITOR_XLSX_VIA_RAIL_AI',
        'sourceContractVersion','RAIL_XLSX_DISLOCATION_CONTRACT_V1',
        'sourceTimeDomain',v_source_time_domain,
        'intakeContract','RAIL_XLSX_GENERIC_INTAKE_V1',
        'canonicalIdentity',jsonb_build_object(
          'algorithm','SHA-256',
          'sha256',v_sha
        ),
        'storage',jsonb_build_object(
          'bucket',p_private_bucket,
          'key',p_private_key,
          'visibility','PRIVATE'
        ),
        'initialReceipt',jsonb_build_object(
          'originalFilename',p_original_filename,
          'byteSize',p_byte_size,
          'reportedMimeType',nullif(btrim(coalesce(p_reported_mime_type,'')),''),
          'canonicalMimeType',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'receivedAt',p_received_at,
          'sourceChatRef',p_source_chat_ref
        )
      )
    )
    returning * into v_source;
  end if;

  insert into portal_private.rail_xlsx_source_receipts_v1 (
    import_batch_id,source_object_id,canonical_sha256,
    original_filename,byte_size,reported_mime_type,canonical_mime_type,
    received_at,private_bucket,private_key,source_chat_ref,
    functional_role,identity_id,client_id,
    correlation_id,mcp_request_id,idempotency_key_hash,duplicate_file
  )
  values (
    v_batch_id,v_source.id,v_sha,
    p_original_filename,p_byte_size,
    nullif(btrim(coalesce(p_reported_mime_type,'')),''),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    p_received_at,p_private_bucket,p_private_key,p_source_chat_ref,
    'RAIL_LOGISTICS',p_identity_id,p_client_id,
    p_correlation_id,p_mcp_request_id,lower(p_idempotency_key_hash),v_duplicate
  )
  returning * into v_receipt;

  return jsonb_build_object(
    'outcome',case when v_duplicate then 'DUPLICATE_FILE' else 'CAPTURED_NEW_SOURCE' end,
    'receiptId',v_receipt.id,
    'importBatchId',v_receipt.import_batch_id,
    'sourceObjectId',v_receipt.source_object_id,
    'canonicalSha256',v_receipt.canonical_sha256,
    'duplicateFile',v_receipt.duplicate_file,
    'privateBucket',v_receipt.private_bucket,
    'privateKey',v_receipt.private_key
  );
end
$$;

revoke all on function portal_private.rail_xlsx_source_capture_register_v1(
  text,text,bigint,text,timestamptz,text,text,text,text,text,uuid,uuid,text
) from public, anon, authenticated;
grant execute on function portal_private.rail_xlsx_source_capture_register_v1(
  text,text,bigint,text,timestamptz,text,text,text,text,text,uuid,uuid,text
) to service_role;

comment on table portal_private.rail_xlsx_source_receipts_v1 is
'Append-only receipts for generic Rail AI XLSX source capture. Multiple filenames may reference one SHA-256 canonical source.';

comment on function portal_private.rail_xlsx_source_capture_register_v1(
  text,text,bigint,text,timestamptz,text,text,text,text,text,uuid,uuid,text
) is
'Registers content-addressed private XLSX source capture after storage object verification. Filename is provenance metadata only.';

commit;
