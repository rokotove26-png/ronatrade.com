create or replace function portal_private.materialize_admin_pending_company_binding_from_audit()
returns trigger
language plpgsql
security definer
set search_path = portal_private, public
as $$
declare
  v_contract_id text;
  v_contract record;
  v_user_id uuid;
begin
  if new.action <> 'CLIENT_PORTAL_USER_CREATED_BY_ADMIN' or new.entity_type <> 'PORTAL_USER' then
    return new;
  end if;

  begin
    v_user_id := new.entity_id::uuid;
  exception when others then
    return new;
  end;

  for v_contract_id in
    select jsonb_array_elements_text(coalesce(new.metadata->'pending_contract_ids','[]'::jsonb))
  loop
    select ct.id as contract_key, ct.client_key
      into v_contract
      from portal_private.contracts ct
     where ct.contract_id = v_contract_id
     limit 1;

    if found then
      insert into portal_private.client_user_pending_company_bindings(
        user_id, client_key, requested_contract_key, status,
        contact_email, granted_by, reason,
        source_system, source_version, source_timestamp,
        authority_state, lifecycle_state
      ) values (
        v_user_id, v_contract.client_key, v_contract.contract_key, 'PENDING',
        nullif(new.metadata->>'email',''), new.actor_user_id,
        'Administrator selected company and opened Client Portal account without an active confirmed contract; contract upload is pending.',
        'ADMIN_PORTAL', 'ADMIN_EXCLUSIVE_CLIENT_OPEN_WITHOUT_CONTRACT_V1', now(),
        'CONFIRMED', 'ACTIVE'
      )
      on conflict do nothing;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_materialize_admin_pending_company_binding_from_audit on portal_private.audit_events;
create trigger trg_materialize_admin_pending_company_binding_from_audit
after insert on portal_private.audit_events
for each row
when (new.action = 'CLIENT_PORTAL_USER_CREATED_BY_ADMIN')
execute function portal_private.materialize_admin_pending_company_binding_from_audit();

create or replace function portal_private.promote_admin_pending_company_binding_after_contract_attach()
returns trigger
language plpgsql
security definer
set search_path = portal_private, public
as $$
declare
  v_contract record;
  v_pending record;
  v_binding_id uuid;
begin
  if new.action <> 'BILATERAL_CONTRACT_ATTACH_CONFIRMED' or new.entity_type <> 'CONTRACT' then
    return new;
  end if;

  select ct.id as contract_key, ct.client_key, ct.contract_id
    into v_contract
    from portal_private.contracts ct
    join portal_private.documents d on d.id = ct.current_signed_document_id
    join portal_private.document_versions dv on dv.id = d.current_version_id
   where ct.contract_id = new.entity_id
     and ct.contract_status = 'ACTIVE'
     and ct.lifecycle_state = 'ACTIVE'::portal_private.lifecycle_state_enum
     and d.authority_state = 'CONFIRMED'::portal_private.authority_state_enum
     and d.lifecycle_state = 'ACTIVE'::portal_private.lifecycle_state_enum
     and dv.authority_state = 'CONFIRMED'::portal_private.authority_state_enum
     and dv.lifecycle_state = 'ACTIVE'::portal_private.lifecycle_state_enum
     and dv.is_current
     and dv.is_effective
     and ct.signed_contract_confirmed_at is not null
     and ct.signed_contract_confirmed_by is not null
     and exists (
       select 1
         from portal_private.storage_objects so
        where so.document_version_key = dv.id
          and so.storage_state = 'VERIFIED'
     )
   limit 1;

  if not found then
    return new;
  end if;

  for v_pending in
    select p.*
      from portal_private.client_user_pending_company_bindings p
      join portal_private.portal_users u on u.id = p.user_id
     where p.client_key = v_contract.client_key
       and p.status = 'PENDING'::portal_private.binding_status_enum
       and p.revoked_at is null
       and p.lifecycle_state = 'ACTIVE'::portal_private.lifecycle_state_enum
       and u.status = 'ACTIVE'::portal_private.portal_user_status_enum
       and exists (
         select 1
           from portal_private.portal_user_roles r
          where r.user_id = p.user_id
            and r.role = 'CLIENT'::portal_private.portal_role_enum
            and r.status = 'ACTIVE'::portal_private.binding_status_enum
            and r.revoked_at is null
       )
  loop
    v_binding_id := null;
    select b.id
      into v_binding_id
      from portal_private.client_user_bindings b
     where b.user_id = v_pending.user_id
       and b.contract_key = v_contract.contract_key
       and b.status = 'ACTIVE'::portal_private.binding_status_enum
       and b.revoked_at is null
     limit 1;

    if v_binding_id is null then
      insert into portal_private.client_user_bindings(
        user_id, client_key, contract_key, status, valid_from,
        granted_by, granted_at, reason,
        source_system, source_version, source_timestamp,
        authority_state, lifecycle_state, deal_scope_mode
      ) values (
        v_pending.user_id, v_contract.client_key, v_contract.contract_key,
        'ACTIVE', now(), new.actor_user_id, now(),
        'Administrator uploaded/confirmed the signed contract after opening the account without contract.',
        'ADMIN_PORTAL', 'ADMIN_EXCLUSIVE_CLIENT_PENDING_PROMOTION_V1', now(),
        'CONFIRMED', 'ACTIVE', 'ALL_CONTRACT_DEALS'
      ) returning id into v_binding_id;

      insert into portal_private.client_user_binding_profiles(
        binding_id, representation_role, contact_email, contact_phone, created_by
      ) values (
        v_binding_id, v_pending.representation_role,
        v_pending.contact_email, v_pending.contact_phone, new.actor_user_id
      )
      on conflict (binding_id) do update
        set representation_role = excluded.representation_role,
            contact_email = coalesce(excluded.contact_email, portal_private.client_user_binding_profiles.contact_email),
            contact_phone = coalesce(excluded.contact_phone, portal_private.client_user_binding_profiles.contact_phone),
            updated_at = now();
    end if;

    update portal_private.client_user_pending_company_bindings
       set status = 'EXPIRED'::portal_private.binding_status_enum,
           authority_state = 'SUPERSEDED'::portal_private.authority_state_enum,
           lifecycle_state = 'SUPERSEDED'::portal_private.lifecycle_state_enum,
           reason = 'Promoted to active client_user_binding after Administrator confirmed signed contract.',
           updated_at = now()
     where id = v_pending.id;

    insert into portal_private.audit_events(
      actor_user_id, actor_role, action, entity_type, entity_id,
      request_id, correlation_id, metadata
    ) values (
      new.actor_user_id, 'ADMIN',
      'CLIENT_PENDING_COMPANY_BINDING_PROMOTED_AFTER_CONTRACT',
      'PORTAL_USER', v_pending.user_id::text,
      coalesce(new.request_id, gen_random_uuid()), new.correlation_id,
      jsonb_build_object(
        'client_key', v_contract.client_key,
        'contract_id', v_contract.contract_id,
        'active_binding_id', v_binding_id,
        'pending_binding_id', v_pending.id
      )
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_promote_admin_pending_company_binding_after_contract_attach on portal_private.audit_events;
create trigger trg_promote_admin_pending_company_binding_after_contract_attach
after insert on portal_private.audit_events
for each row
when (new.action = 'BILATERAL_CONTRACT_ATTACH_CONFIRMED')
execute function portal_private.promote_admin_pending_company_binding_after_contract_attach();
