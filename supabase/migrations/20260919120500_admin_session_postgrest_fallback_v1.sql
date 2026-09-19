-- Issue #663: fail-closed session authority fallback through PostgREST.
-- Used only when the primary rona-portal-api /session/me edge probe is unavailable.
create or replace function public.rona_portal_session_me_fallback_v1()
returns table (
  portal_user_id uuid,
  display_name text,
  roles text[],
  session_allowed boolean
)
language plpgsql
security definer
set search_path = portal_private, auth, public
as $$
declare
  v_uid uuid := auth.uid();
  v_claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_session_id uuid;
begin
  if v_uid is null then
    return;
  end if;

  begin
    v_session_id := nullif(v_claims ->> 'session_id', '')::uuid;
  exception when others then
    return;
  end;

  if v_session_id is null then
    return;
  end if;

  return query
  select
    r.portal_user_id,
    r.display_name,
    r.roles,
    r.session_allowed
  from portal_private.resolve_portal_auth(v_uid, v_session_id) r
  join auth.sessions s
    on s.id = v_session_id
   and s.user_id = v_uid
  where r.session_allowed
    and (s.not_after is null or s.not_after > now());
end;
$$;

revoke all on function public.rona_portal_session_me_fallback_v1() from public;
revoke all on function public.rona_portal_session_me_fallback_v1() from anon;
grant execute on function public.rona_portal_session_me_fallback_v1() to authenticated;

comment on function public.rona_portal_session_me_fallback_v1() is
'Fail-closed current-session role projection for portal session convergence. Uses only auth.uid(), the JWT session_id claim, auth.sessions, and canonical portal_private.resolve_portal_auth.';
