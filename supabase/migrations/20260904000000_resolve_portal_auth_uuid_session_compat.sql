create or replace function portal_private.resolve_portal_auth(
  p_auth_user_id uuid,
  p_session_id uuid
)
returns table(
  portal_user_id uuid,
  display_name text,
  portal_status portal_private.portal_user_status_enum,
  roles text[],
  session_allowed boolean
)
language sql
stable
set search_path to 'pg_catalog', 'portal_private', 'auth'
as $function$
  select *
  from portal_private.resolve_portal_auth(p_auth_user_id, p_session_id::text);
$function$;

revoke all on function portal_private.resolve_portal_auth(uuid, uuid) from public;
grant execute on function portal_private.resolve_portal_auth(uuid, uuid) to postgres, service_role;
