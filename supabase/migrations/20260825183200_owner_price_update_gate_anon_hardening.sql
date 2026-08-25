-- Explicitly block unauthenticated execution of Admin price-update RPCs.
revoke all on function public.owner_price_updates_bootstrap() from public, anon;
revoke all on function public.owner_apply_price_change_proposal(uuid) from public, anon;
grant execute on function public.owner_price_updates_bootstrap() to authenticated;
grant execute on function public.owner_apply_price_change_proposal(uuid) to authenticated;
