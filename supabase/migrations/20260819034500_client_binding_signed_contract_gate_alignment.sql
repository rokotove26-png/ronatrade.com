create or replace function portal_private.enforce_active_client_binding_signed_contract()
returns trigger
language plpgsql
set search_path = pg_catalog, portal_private
as $function$
declare
  v_ok boolean;
begin
  if new.status = 'ACTIVE'::portal_private.binding_status_enum then
    select exists (
      select 1
      from portal_private.contracts c
      join portal_private.documents d on d.id = c.current_signed_document_id
      join portal_private.document_versions dv on dv.id = d.current_version_id and dv.document_key = d.id
      where c.id = new.contract_key
        and c.client_key = new.client_key
        and d.document_type in ('SIGNED_BILATERAL_CONTRACT', 'КОНТРАКТ')
        and d.authority_state = 'CONFIRMED'::portal_private.authority_state_enum
        and d.lifecycle_state = 'ACTIVE'::portal_private.lifecycle_state_enum
        and dv.is_current
        and dv.is_effective
        and dv.authority_state = 'CONFIRMED'::portal_private.authority_state_enum
        and dv.lifecycle_state = 'ACTIVE'::portal_private.lifecycle_state_enum
        and c.signed_contract_confirmed_at is not null
        and c.signed_contract_confirmed_by is not null
        and exists (
          select 1
          from portal_private.audit_events ae
          where ae.action = 'BILATERAL_CONTRACT_ATTACH_CONFIRMED'
            and ae.entity_type = 'CONTRACT'
            and ae.entity_id = c.contract_id
            and ae.actor_user_id = c.signed_contract_confirmed_by
            and ae.metadata ->> 'document_id' = d.document_id
            and lower(coalesce(ae.metadata ->> 'sha256','')) = lower(coalesce(dv.sha256,''))
            and coalesce((ae.metadata ->> 'storage_verified')::boolean,false)
        )
    ) into v_ok;
    if not coalesce(v_ok,false) then
      raise exception 'ACTIVE client binding requires server-confirmed current bilateral signed contract PDF metadata';
    end if;
  end if;
  return new;
end;
$function$;

comment on function portal_private.enforce_active_client_binding_signed_contract() is
  'Fail-closed ACTIVE client binding gate. Accepts the canonical contract document taxonomy used by the portal only after server-side bilateral confirmation is tied to a CONFIRMED current/effective version, verified storage evidence and matching audit event.';
