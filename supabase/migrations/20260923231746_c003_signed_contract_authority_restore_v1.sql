-- Restore RONA-C003 signed-contract authority after the 2026-09-22
-- source-mismatch revocation compared the signed external contract number
-- (01/РТ-02-1926) to the internal canonical Contract ID.
--
-- Fail-closed: this correction applies only when the confirmed CURRENT external
-- reference, historical signed PDF hash, verified storage evidence and prior
-- BILATERAL_CONTRACT_ATTACH_CONFIRMED audit all agree.

do $$
declare
  v_contract_key uuid;
  v_client_key uuid;
  v_document_key uuid;
  v_version_key uuid;
  v_actor_user_id uuid;
  v_attach_at timestamptz;
  v_external_number text := '01/РТ-02-1926';
  v_sha256 text := '424e75c53da8d8fb72a5418adca69e3923d55e9c5881175b902fd01504a1879b';
begin
  select ct.id, cl.id
    into v_contract_key, v_client_key
    from portal_private.contracts ct
    join portal_private.clients cl on cl.id=ct.client_key
   where ct.contract_id='RONA-C003-CTR-2026-001'
     and cl.client_id='RONA-C003'
     and ct.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
     and ct.authority_state='CONFIRMED'::portal_private.authority_state_enum
     and ct.current_external_contract_number='RONA-C003-CTR-2026-001'
     and ct.contract_status='PENDING_SIGNATURE'
     and ct.current_signed_document_id is null
     and ct.signed_contract_confirmed_at is null
   limit 1;

  if v_contract_key is null then
    raise exception 'C003 contract is not in the expected revoked-source-mismatch state';
  end if;

  select cer.source_document_id
    into v_document_key
    from portal_private.contract_external_references cer
   where cer.contract_key=v_contract_key
     and cer.reference_type='CURRENT'
     and cer.reference_value=v_external_number
     and cer.authority_state='CONFIRMED'::portal_private.authority_state_enum
     and cer.source_document_id is not null
   order by cer.created_at desc
   limit 1;

  if v_document_key is null then
    raise exception 'C003 confirmed CURRENT external contract reference is missing';
  end if;

  select dv.id
    into v_version_key
    from portal_private.documents d
    join portal_private.document_versions dv on dv.document_key=d.id
   where d.id=v_document_key
     and d.client_key=v_client_key
     and d.contract_key=v_contract_key
     and d.document_id='RONA-C003-CTR-2026-001'
     and d.document_type in ('КОНТРАКТ','SIGNED_BILATERAL_CONTRACT')
     and lower(coalesce(dv.sha256,''))=v_sha256
   order by dv.version_number desc
   limit 1;

  if v_version_key is null then
    raise exception 'C003 signed contract PDF/version source evidence is missing';
  end if;

  select ae.actor_user_id, ae.event_at
    into v_actor_user_id, v_attach_at
    from portal_private.audit_events ae
   where ae.action='BILATERAL_CONTRACT_ATTACH_CONFIRMED'
     and ae.entity_type='CONTRACT'
     and ae.entity_id='RONA-C003-CTR-2026-001'
     and ae.actor_user_id is not null
     and ae.metadata->>'document_id'='RONA-C003-CTR-2026-001'
     and lower(coalesce(ae.metadata->>'sha256',''))=v_sha256
     and coalesce((ae.metadata->>'storage_verified')::boolean,false)
   order by ae.event_at desc
   limit 1;

  if v_actor_user_id is null or v_attach_at is null then
    raise exception 'C003 bilateral signed-contract confirmation audit is missing';
  end if;

  if not exists (
    select 1
      from portal_private.storage_objects so
     where so.document_version_key=v_version_key
       and lower(coalesce(so.sha256,''))=v_sha256
       and so.verified_at is not null
  ) then
    raise exception 'C003 verified storage evidence is missing';
  end if;

  if not exists (
    select 1
      from portal_private.audit_events ae
     where ae.action='SIGNED_CONTRACT_AUTHORITY_REVOKED_SOURCE_MISMATCH'
       and ae.entity_type='CONTRACT'
       and ae.entity_id='RONA-C003-CTR-2026-001'
       and ae.metadata->>'previous_external_contract_number'=v_external_number
       and lower(coalesce(ae.metadata->>'sha256',''))=v_sha256
       and coalesce((ae.metadata->>'signed_authority_removed')::boolean,false)
  ) then
    raise exception 'C003 source-mismatch revocation evidence is missing';
  end if;

  if exists (
    select 1
      from portal_private.documents d
      join portal_private.document_versions dv on dv.id=d.current_version_id
     where d.contract_key=v_contract_key
       and d.id<>v_document_key
       and d.document_type in ('КОНТРАКТ','SIGNED_BILATERAL_CONTRACT')
       and d.authority_state='CONFIRMED'::portal_private.authority_state_enum
       and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
       and dv.is_current
       and dv.is_effective
       and dv.authority_state='CONFIRMED'::portal_private.authority_state_enum
       and dv.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  ) then
    raise exception 'C003 has another active signed-contract authority; automatic restore aborted';
  end if;

  update portal_private.document_versions
     set is_current=false,
         is_effective=false
   where document_key=v_document_key
     and id<>v_version_key;

  update portal_private.document_versions
     set is_current=true,
         is_effective=true,
         authority_state='CONFIRMED'::portal_private.authority_state_enum,
         lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum,
         superseded_by=null
   where id=v_version_key;

  update portal_private.storage_objects
     set storage_state='VERIFIED',
         verified_at=coalesce(verified_at,v_attach_at),
         verified_by=coalesce(verified_by,v_actor_user_id),
         updated_at=clock_timestamp()
   where document_version_key=v_version_key
     and lower(coalesce(sha256,''))=v_sha256;

  update portal_private.documents
     set current_version_id=v_version_key,
         authority_state='CONFIRMED'::portal_private.authority_state_enum,
         lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum,
         updated_at=clock_timestamp()
   where id=v_document_key;

  update portal_private.contracts
     set current_external_contract_number=v_external_number,
         contract_status='ACTIVE',
         current_signed_document_id=v_document_key,
         signed_contract_confirmed_at=v_attach_at,
         signed_contract_confirmed_by=v_actor_user_id,
         authority_state='CONFIRMED'::portal_private.authority_state_enum,
         lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum,
         updated_at=clock_timestamp()
   where id=v_contract_key;

  insert into portal_private.audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,
    request_id,correlation_id,metadata
  ) values (
    null,'SYSTEM','SIGNED_CONTRACT_AUTHORITY_RESTORED_EXTERNAL_REFERENCE_RECONCILIATION',
    'CONTRACT','RONA-C003-CTR-2026-001',
    gen_random_uuid(),gen_random_uuid(),
    jsonb_build_object(
      'client_id','RONA-C003',
      'external_contract_number',v_external_number,
      'sha256',v_sha256,
      'document_id','RONA-C003-CTR-2026-001',
      'restored_from_confirmed_current_external_reference',true,
      'restored_from_prior_bilateral_attach_audit',true,
      'reason','The signed PDF number matches the confirmed CURRENT external contract reference. The 2026-09-22 revocation incorrectly compared that external number to the internal canonical Contract ID.',
      'business_bytes_changed',false
    )
  );
end $$;
