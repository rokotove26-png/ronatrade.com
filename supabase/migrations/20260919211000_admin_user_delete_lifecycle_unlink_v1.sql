create or replace function portal_private.enforce_portal_user_auth_lifecycle()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'portal_private'
as $function$
begin
  if tg_op = 'UPDATE'
     and old.auth_user_id is not null
     and new.auth_user_id is distinct from old.auth_user_id then
    if not (
      new.auth_user_id is null
      and new.status in (
        'REVOKED'::portal_private.portal_user_status_enum,
        'ARCHIVED'::portal_private.portal_user_status_enum
      )
      and new.lifecycle_state = 'ARCHIVED'::portal_private.lifecycle_state_enum
      and new.revoked_at is not null
    ) then
      raise exception 'auth_user_id is immutable once linked; create a new controlled identity record instead';
    end if;
  end if;

  if new.auth_user_id is not null and new.auth_linked_at is null then
    new.auth_linked_at := now();
  end if;

  if new.status = 'ACTIVE'::portal_private.portal_user_status_enum then
    if new.auth_user_id is null or new.activated_at is null then
      raise exception 'ACTIVE Portal user requires linked Supabase Auth user and activated_at';
    end if;
    if new.authority_state <> 'CONFIRMED'::portal_private.authority_state_enum
       or new.lifecycle_state <> 'ACTIVE'::portal_private.lifecycle_state_enum then
      raise exception 'ACTIVE Portal user requires CONFIRMED authority and ACTIVE lifecycle';
    end if;
  elsif new.status = 'SUSPENDED'::portal_private.portal_user_status_enum then
    if new.suspended_at is null or new.lifecycle_state <> 'SUSPENDED'::portal_private.lifecycle_state_enum then
      raise exception 'SUSPENDED Portal user requires suspended_at and SUSPENDED lifecycle';
    end if;
  elsif new.status = 'REVOKED'::portal_private.portal_user_status_enum then
    if new.revoked_at is null
       or new.lifecycle_state not in (
         'CLOSED'::portal_private.lifecycle_state_enum,
         'ARCHIVED'::portal_private.lifecycle_state_enum
       ) then
      raise exception 'REVOKED Portal user requires revoked_at and CLOSED/ARCHIVED lifecycle';
    end if;
  elsif new.status = 'ARCHIVED'::portal_private.portal_user_status_enum then
    if new.lifecycle_state <> 'ARCHIVED'::portal_private.lifecycle_state_enum then
      raise exception 'ARCHIVED Portal user requires ARCHIVED lifecycle';
    end if;
  end if;

  return new;
end;
$function$;

comment on function portal_private.enforce_portal_user_auth_lifecycle()
is 'Portal user auth lifecycle invariant. auth_user_id may be cleared only for a revoked/archived tombstone with revoked_at set, enabling controlled Admin deletion while preserving normal immutability.';
