-- ONLINE RAIL — publish route cohorts through the canonical admin read model
begin;

create or replace function portal_private.rona_rail_deal_map_read_model_core_v2(
  p_deal_key uuid default null,
  p_deal_id text default null
)
returns jsonb
language plpgsql
stable
set search_path=pg_catalog,portal_private
as $fn$
declare
  v_base jsonb;
  v_out jsonb:='[]'::jsonb;
  v_deal jsonb;
  v_key uuid;
begin
  v_base:=portal_private.rona_rail_deal_map_read_model_core_v1(p_deal_key,p_deal_id);

  for v_deal in
    select value from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb))
  loop
    v_key:=nullif(v_deal->>'dealKey','')::uuid;
    v_deal:=jsonb_set(
      v_deal,
      '{routeCohorts}',
      case
        when v_key is null then '[]'::jsonb
        else portal_private.rail_deal_route_cohorts_v1(v_key)
      end,
      true
    );
    v_out:=v_out||jsonb_build_array(v_deal);
  end loop;

  v_base:=jsonb_set(v_base,'{deals}',v_out,true);
  v_base:=jsonb_set(
    v_base,
    '{routeCohortContractVersion}',
    to_jsonb('RAIL_ROUTE_COHORTS_V1'::text),
    true
  );
  return v_base;
end
$fn$;

revoke all on function portal_private.rona_rail_deal_map_read_model_core_v2(uuid,text)
  from public,anon,authenticated;
grant execute on function portal_private.rona_rail_deal_map_read_model_core_v2(uuid,text)
  to service_role;

create or replace function public.rona_admin_rail_deal_map_read_model_v4(
  p_deal_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,portal_private
as $fn$
declare
  v_actor uuid;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  return portal_private.rona_rail_deal_map_read_model_core_v2(null::uuid,p_deal_id);
end
$fn$;

revoke all on function public.rona_admin_rail_deal_map_read_model_v4(text)
  from public,anon;
grant execute on function public.rona_admin_rail_deal_map_read_model_v4(text)
  to authenticated,service_role;

commit;
