create or replace function portal_private.ai_runtime_ai_role_for_staff(p_role portal_private.staff_functional_role_enum)
returns portal_private.ai_business_role_enum
language sql
immutable
set search_path to 'pg_catalog','portal_private'
as $function$
select case p_role::text
  when 'OPERATIONS_DIRECTOR' then 'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum
  when 'EXECUTIVE_DIRECTOR' then 'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum
  when 'FINANCE' then 'FINANCE'::portal_private.ai_business_role_enum
  when 'LEGAL' then 'LEGAL'::portal_private.ai_business_role_enum
  when 'MARKET_ANALYST' then 'MARKET_ANALYST'::portal_private.ai_business_role_enum
  when 'RAIL_LOGISTICS' then 'RAIL_LOGISTICS'::portal_private.ai_business_role_enum
  when 'SYSTEM_ADMIN' then 'SYSTEM_ADMIN'::portal_private.ai_business_role_enum
  when 'ACCOUNTING' then 'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum
  else null
end
$function$;

create or replace function portal_private.staff_role_for_reverse_event(p_event_type text)
returns portal_private.staff_functional_role_enum
language sql
immutable
set search_path to 'pg_catalog','portal_private'
as $function$
  select case
    when p_event_type in ('CLIENT_CLAIM_SUBMIT','CLIENT_DOCUMENT_ACK') then 'LEGAL'::portal_private.staff_functional_role_enum
    when p_event_type='CLIENT_PAYMENT_PROOF_SUBMIT' then 'ACCOUNTING'::portal_private.staff_functional_role_enum
    when p_event_type in ('ADMIN_PUBLICATION_REQUEST','ADMIN_UNPUBLISH_REQUEST','ADMIN_PRICE_PUBLICATION_REQUEST') then 'MARKET_ANALYST'::portal_private.staff_functional_role_enum
    when p_event_type='ADMIN_SOURCE_SYNC_REQUEST' then 'SYSTEM_ADMIN'::portal_private.staff_functional_role_enum
    when p_event_type in ('PAYMENT_EXPECTATION_CANCELLED','PAYMENT_EXPECTATION_CANCELLATION_FINANCIAL_HOLD') then 'FINANCE'::portal_private.staff_functional_role_enum
    when p_event_type in ('DEAL_CANCELLED','DEAL_CANCELLATION_FINANCIAL_HOLD','APPLICATION_CANCELLED','APPLICATION_CANCELLED_WITH_DEAL') then 'OPERATIONS_DIRECTOR'::portal_private.staff_functional_role_enum
    else 'OPERATIONS_DIRECTOR'::portal_private.staff_functional_role_enum
  end
$function$;

create or replace function portal_private.normalize_staff_audit_actor_role()
returns trigger
language plpgsql
set search_path to 'pg_catalog','portal_private'
as $function$
begin
  if new.actor_role = any (array[
    'OPERATIONS_DIRECTOR'::text,
    'EXECUTIVE_DIRECTOR'::text,
    'LEGAL'::text,
    'FINANCE'::text,
    'ACCOUNTING'::text,
    'MARKET_ANALYST'::text,
    'RAIL_LOGISTICS'::text,
    'SYSTEM_ADMIN'::text
  ]) then
    new.metadata := coalesce(new.metadata, '{}'::jsonb)
      || jsonb_build_object('functional_role', new.actor_role);
    new.actor_role := 'RONA_OPERATOR';
  end if;
  return new;
end
$function$;
