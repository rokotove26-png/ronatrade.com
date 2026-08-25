-- RONA Trade Admin Prices: harden Owner-only price update RPCs against anon execution.
-- Canonical flow remains OPERATIONS_DIRECTOR -> Admin LK -> explicit Owner approval.

revoke all on function public.owner_price_updates_bootstrap() from anon;
revoke all on function public.owner_apply_price_change_proposal(uuid) from anon;
revoke all on function public.owner_reject_price_change_proposal(uuid,text) from anon;
revoke all on function public.owner_set_price_publication_audience(boolean,boolean) from anon;

grant execute on function public.owner_price_updates_bootstrap() to authenticated, service_role;
grant execute on function public.owner_apply_price_change_proposal(uuid) to authenticated, service_role;
grant execute on function public.owner_reject_price_change_proposal(uuid,text) to authenticated, service_role;
grant execute on function public.owner_set_price_publication_audience(boolean,boolean) to authenticated, service_role;

do $$
begin
  if has_function_privilege('anon','public.owner_price_updates_bootstrap()','execute')
     or has_function_privilege('anon','public.owner_apply_price_change_proposal(uuid)','execute')
     or has_function_privilege('anon','public.owner_reject_price_change_proposal(uuid,text)','execute')
     or has_function_privilege('anon','public.owner_set_price_publication_audience(boolean,boolean)','execute') then
    raise exception 'OWNER_PRICE_RPC_ANON_EXECUTE_NOT_REVOKED';
  end if;
  if not has_function_privilege('authenticated','public.owner_price_updates_bootstrap()','execute')
     or not has_function_privilege('authenticated','public.owner_apply_price_change_proposal(uuid)','execute')
     or not has_function_privilege('authenticated','public.owner_reject_price_change_proposal(uuid,text)','execute')
     or not has_function_privilege('authenticated','public.owner_set_price_publication_audience(boolean,boolean)','execute') then
    raise exception 'OWNER_PRICE_RPC_AUTHENTICATED_EXECUTE_MISSING';
  end if;
end $$;
