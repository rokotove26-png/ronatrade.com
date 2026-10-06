-- Admin Agent Rewards P&L V4 scope filter
-- Owner UAT 2026-10-06: cancelled deals must not appear in the active rewards workspace.
-- This wrapper is read-only and does not mutate Finance or deal business facts.

create or replace function public.rona_admin_agent_rewards_workspace_v3()
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, portal_private, auth
as $$
declare
  v_actor uuid;
  v_base jsonb;
  v_deals jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  v_base:=public.rona_admin_agent_rewards_workspace_v2();

  select coalesce(
    jsonb_agg(x.item order by x.item->>'dealId'),
    '[]'::jsonb
  )
  into v_deals
  from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb)) as x(item)
  join portal_private.deals d
    on d.deal_id=x.item->>'dealId'
  where d.business_status::text <> 'CANCELLED'
    and d.lifecycle_state::text not in ('ARCHIVED','SUPERSEDED');

  return v_base || jsonb_build_object(
    'contract','ADMIN_AGENT_REWARDS_PNL_V4',
    'dealScope','NON_CANCELLED_CURRENT',
    'deals',v_deals
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_workspace_v3() from public,anon;
grant execute on function public.rona_admin_agent_rewards_workspace_v3() to authenticated;

comment on function public.rona_admin_agent_rewards_workspace_v3() is
'Admin Agent Rewards P&L V4. Filters CANCELLED deals from the active rewards workspace while preserving completed/closed non-cancelled deals when still relevant for settlement.';
