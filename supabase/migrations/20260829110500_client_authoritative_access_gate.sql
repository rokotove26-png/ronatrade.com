-- Client projections are fail-closed at the database boundary. A client binding alone is not
-- enough: the legal entity and contract must be current authoritative objects, and the signed
-- contract must have been confirmed before any client-side functional data is exposed.
create or replace function portal_private.client_user_has_contract_access(
  p_user_id uuid,
  p_contract_key uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path to 'pg_catalog','portal_private'
as $function$
  select exists (
    select 1
    from portal_private.client_user_bindings b
    join portal_private.contracts ct on ct.id=b.contract_key
    join portal_private.clients cl on cl.id=ct.client_key and cl.id=b.client_key
    where b.user_id=p_user_id
      and b.contract_key=p_contract_key
      and b.status='ACTIVE'::portal_private.binding_status_enum
      and b.valid_from<=p_at
      and (b.valid_to is null or b.valid_to>p_at)
      and b.revoked_at is null
      and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and b.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
      and cl.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and cl.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
      and ct.contract_status='ACTIVE'
      and ct.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and ct.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
      and ct.signed_contract_confirmed_at is not null
      and nullif(btrim(ct.current_external_contract_number),'') is not null
      and (ct.effective_from is null or ct.effective_from<=p_at::date)
      and (ct.effective_to is null or ct.effective_to>=p_at::date)
      and exists (
        select 1 from portal_private.portal_user_roles r
        where r.user_id=p_user_id
          and r.role='CLIENT'::portal_private.portal_role_enum
          and r.status='ACTIVE'::portal_private.binding_status_enum
          and r.revoked_at is null
      )
  );
$function$;

create or replace function portal_private.client_user_has_deal_access(
  p_user_id uuid,
  p_deal_key uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path to 'pg_catalog','portal_private'
as $function$
  select exists (
    select 1
    from portal_private.deals d
    join portal_private.client_user_bindings b
      on b.client_key=d.client_key and b.contract_key=d.contract_key and b.user_id=p_user_id
    where d.id=p_deal_key
      and portal_private.client_user_has_contract_access(p_user_id,d.contract_key,p_at)
      and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and d.authority_state not in ('REJECTED'::portal_private.authority_state_enum,'SUPERSEDED'::portal_private.authority_state_enum)
      and b.status='ACTIVE'::portal_private.binding_status_enum
      and b.valid_from<=p_at
      and (b.valid_to is null or b.valid_to>p_at)
      and b.revoked_at is null
      and (
        b.deal_scope_mode='ALL_CONTRACT_DEALS'
        or exists (
          select 1 from portal_private.client_user_deal_grants g
          where g.binding_id=b.id
            and g.user_id=p_user_id
            and g.deal_key=d.id
            and g.status='ACTIVE'::portal_private.binding_status_enum
            and g.valid_from<=p_at
            and (g.valid_to is null or g.valid_to>p_at)
            and g.revoked_at is null
            and g.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
            and g.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
        )
      )
  );
$function$;

insert into portal_private.audit_events(actor_role,action,entity_type,entity_id,severity,result,metadata)
values(
  'SYSTEM_ADMIN','CLIENT_AUTHORITATIVE_ACCESS_GATE_ENABLED','SYSTEM','CLIENT_PORTAL_ACCESS',
  'INFO','SUCCESS',
  jsonb_build_object(
    'contract_requires','ACTIVE + CONFIRMED/VERIFIED + SIGNED_CONFIRMED + EXTERNAL_NUMBER',
    'deal_requires','ACTIVE + NOT_REJECTED_OR_SUPERSEDED + authoritative contract access',
    'frontend_inference_allowed',false
  )
);
