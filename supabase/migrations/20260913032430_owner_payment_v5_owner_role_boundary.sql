-- Final Owner boundary: existing ADMIN + RONA_OPERATOR authority only.
-- No new role, Deal lifecycle state, payment stage, or upstream workflow is introduced.

create or replace function portal_private.owner_payment_v5_current_admin()
returns uuid
language plpgsql
security definer
stable
set search_path to 'pg_catalog','public','auth','portal_private'
as $$
declare v_auth_user_id uuid; v_portal_user_id uuid;
begin
  v_auth_user_id:=auth.uid();
  if v_auth_user_id is null then raise exception using errcode='42501',message='OWNER_PAYMENT_AUTHENTICATED_USER_REQUIRED'; end if;

  select u.id into v_portal_user_id
  from portal_private.portal_users u
  where u.auth_user_id=v_auth_user_id
    and u.status::text='ACTIVE'
    and u.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and u.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
    and exists(
      select 1 from portal_private.portal_user_roles r
      where r.user_id=u.id and r.role::text='ADMIN' and r.status::text='ACTIVE' and r.revoked_at is null
    )
    and exists(
      select 1 from portal_private.portal_user_roles r
      where r.user_id=u.id and r.role::text='RONA_OPERATOR' and r.status::text='ACTIVE' and r.revoked_at is null
    )
  limit 1;

  if v_portal_user_id is null then raise exception using errcode='42501',message='OWNER_PAYMENT_OWNER_AUTHORITY_REQUIRED'; end if;
  return v_portal_user_id;
end
$$;
revoke all on function portal_private.owner_payment_v5_current_admin() from public,anon,authenticated,service_role;

comment on function portal_private.owner_payment_v5_current_admin() is
'Owner Payments mutation authority: authenticated active portal identity with the existing ADMIN + RONA_OPERATOR authority combination. This does not create a new role or lifecycle mechanism.';
