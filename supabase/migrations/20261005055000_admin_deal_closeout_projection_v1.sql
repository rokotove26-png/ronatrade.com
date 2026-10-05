-- Admin Deals CLOSEOUT projection V1.
-- Applies only to post-execution ATTENTION deals.
-- ACTIVE deal projection and authoritative business records are not mutated.
-- Actual shipped quantity is a derived read-only value:
-- trusted Rail Logistics wagon membership + one stable positive cargo weight per wagon
-- observed across the captured Rail source history.
-- Deal price is accepted only when source_proposed_price * source_quantity_tonnes
-- reconciles exactly (within 0.01) to the authoritative Finance obligation.

create or replace function public.owner_deals_current_v4()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, auth
as $function$
declare
  v_base jsonb;
  v_rail jsonb;
  v_deals jsonb;
begin
  v_base := public.owner_deals_current_v3();
  v_rail := public.owner_deals_rail_execution_v4(null);

  with
  source_rows as (
    select e.value as deal_json, e.ordinality as ord
    from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb))
      with ordinality e(value, ordinality)
  ),
  gated as (
    select
      s.ord,
      s.deal_json,
      d.id as deal_key,
      c.monitoring_state,
      c.completed_at as rail_monitoring_completed_at,
      (
        upper(coalesce(s.deal_json->>'finance_projection_version',''))='FINANCE_V8'
        and upper(coalesce(s.deal_json->>'finance_status',''))='PAID'
        and upper(coalesce(s.deal_json->>'finance_authority_state',''))='AUTHORITATIVE'
        and upper(coalesce(s.deal_json->>'finance_lifecycle_state',''))='CURRENT'
        and coalesce(nullif(s.deal_json->>'finance_source_locked','')::boolean,false)=true
        and coalesce(nullif(s.deal_json->>'finance_is_terminal','')::boolean,false)=true
        and coalesce(nullif(s.deal_json->>'obligation_amount','')::numeric,0)>0
        and abs(coalesce(nullif(s.deal_json->>'client_remaining_amount','')::numeric,999999999999::numeric))<=0.01
        and coalesce(nullif(s.deal_json->>'received_amount','')::numeric,0)+0.01
            >= coalesce(nullif(s.deal_json->>'obligation_amount','')::numeric,0)
      ) as payment_complete_100
    from source_rows s
    left join portal_private.deals d
      on d.deal_id=s.deal_json->>'deal_id'
    left join portal_private.rail_deal_monitoring_control_v1 c
      on c.deal_key=d.id
  ),
  closeout_candidates as materialized (
    select g.deal_key
    from gated g
    where g.deal_key is not null
      and upper(coalesce(g.monitoring_state,''))='COMPLETED'
      and g.payment_complete_100
  ),
  trusted_wagons as materialized (
    select distinct
      cp.effective_deal_key as deal_key,
      cp.wagon_number
    from portal_private.rail_operational_current_position_v1 cp
    join closeout_candidates cc
      on cc.deal_key=cp.effective_deal_key
    where cp.position_status='TRUSTED'
      and cp.wagon_number is not null
  ),
  weight_observations as materialized (
    select
      r.effective_deal_key as deal_key,
      r.wagon_number,
      r.source_object_id,
      r.source_received_at,
      cell.cargo_weight_tonnes
    from portal_private.rail_xlsx_resolution_effective_v1 r
    join trusted_wagons tw
      on tw.deal_key=r.effective_deal_key
     and tw.wagon_number=r.wagon_number
    cross join lateral (
      select
        case
          when jsonb_typeof(c->'rawValue')='number'
            then (c->>'rawValue')::numeric
          when coalesce(c->>'rawValue','') ~ '^[0-9]+([.,][0-9]+)?$'
            then replace(c->>'rawValue',',','.')::numeric
          else null::numeric
        end as cargo_weight_tonnes
      from jsonb_array_elements(coalesce(r.source_row->'cells','[]'::jsonb)) c
      where lower(btrim(coalesce(c->>'header','')))='вес груза'
      limit 1
    ) cell
    where cell.cargo_weight_tonnes>0
  ),
  per_wagon as (
    select
      tw.deal_key,
      tw.wagon_number,
      count(distinct wo.cargo_weight_tonnes)::int as weight_variant_count,
      min(wo.cargo_weight_tonnes) as stable_weight_tonnes,
      count(distinct wo.source_object_id)::int as weight_source_count,
      max(wo.source_received_at) as latest_weight_source_at
    from trusted_wagons tw
    left join weight_observations wo
      on wo.deal_key=tw.deal_key
     and wo.wagon_number=tw.wagon_number
    group by tw.deal_key,tw.wagon_number
  ),
  closeout_quantity as (
    select
      cc.deal_key,
      count(pw.wagon_number)::int as trusted_wagon_count,
      count(pw.wagon_number) filter (
        where pw.weight_variant_count=1
          and pw.stable_weight_tonnes>0
          and pw.weight_source_count>0
      )::int as stable_weight_wagon_count,
      case
        when count(pw.wagon_number)>0
         and count(pw.wagon_number)=count(pw.wagon_number) filter (
           where pw.weight_variant_count=1
             and pw.stable_weight_tonnes>0
             and pw.weight_source_count>0
         )
        then sum(pw.stable_weight_tonnes) filter (
          where pw.weight_variant_count=1
            and pw.stable_weight_tonnes>0
            and pw.weight_source_count>0
        )
        else null::numeric
      end as actual_shipped_quantity_tonnes,
      max(pw.latest_weight_source_at) as quantity_source_at
    from closeout_candidates cc
    left join per_wagon pw on pw.deal_key=cc.deal_key
    group by cc.deal_key
  ),
  calculated as (
    select
      g.*,
      cq.trusted_wagon_count,
      cq.stable_weight_wagon_count,
      cq.actual_shipped_quantity_tonnes,
      cq.quantity_source_at,
      case
        when coalesce(nullif(g.deal_json->>'source_proposed_price','')::numeric,0)>0
         and coalesce(nullif(g.deal_json->>'source_quantity_tonnes','')::numeric,0)>0
         and upper(btrim(coalesce(g.deal_json->>'source_proposed_currency','')))
             = upper(btrim(coalesce(g.deal_json->>'finance_currency','')))
         and coalesce(nullif(g.deal_json->>'obligation_amount','')::numeric,0)>0
         and abs(
           (g.deal_json->>'source_proposed_price')::numeric
           * (g.deal_json->>'source_quantity_tonnes')::numeric
           - (g.deal_json->>'obligation_amount')::numeric
         )<=0.01
        then (g.deal_json->>'source_proposed_price')::numeric
        else null::numeric
      end as source_locked_unit_price
    from gated g
    left join closeout_quantity cq on cq.deal_key=g.deal_key
  ),
  enriched as (
    select
      c.*,
      (upper(coalesce(c.monitoring_state,''))='COMPLETED' and c.payment_complete_100) as is_closeout,
      case
        when upper(coalesce(c.monitoring_state,''))<>'COMPLETED' or not c.payment_complete_100
          then null::text
        when c.actual_shipped_quantity_tonnes is null
          then 'QUANTITY_SOURCE_INCOMPLETE'
        when c.source_locked_unit_price is null
          then 'PRICE_SOURCE_MISMATCH'
        when nullif(c.deal_json->>'received_amount','') is null
          then 'PAYMENT_SOURCE_MISSING'
        else 'READY'
      end as closeout_projection_state,
      case
        when c.actual_shipped_quantity_tonnes is not null
         and c.source_locked_unit_price is not null
        then round(c.actual_shipped_quantity_tonnes*c.source_locked_unit_price,2)
        else null::numeric
      end as closeout_actual_amount
    from calculated c
  )
  select coalesce(
    jsonb_agg(
      deal_json
      || jsonb_build_object(
        'rail_monitoring_state',coalesce(monitoring_state,'ACTIVE'),
        'rail_monitoring_completed_at',rail_monitoring_completed_at,
        'payment_complete_100',payment_complete_100,
        'post_rail_completion_attention',is_closeout,
        'attention_reason',
          case when is_closeout then 'RAIL_COMPLETED_AND_100_PERCENT_PAID' else null end,
        'closeout_stage',
          case when is_closeout then 'CLOSEOUT' else null end,
        'closeout_projection_state',
          case when is_closeout then closeout_projection_state else null end,
        'closeout_actual_quantity_tonnes',
          case when is_closeout then actual_shipped_quantity_tonnes else null end,
        'closeout_quantity_source',
          case when is_closeout and actual_shipped_quantity_tonnes is not null
            then 'RAIL_LOGISTICS_TRUSTED_WAGONS_STABLE_WEIGHT_HISTORY_V1'
            else null end,
        'closeout_quantity_source_at',
          case when is_closeout then quantity_source_at else null end,
        'closeout_trusted_wagon_count',
          case when is_closeout then trusted_wagon_count else null end,
        'closeout_stable_weight_wagon_count',
          case when is_closeout then stable_weight_wagon_count else null end,
        'closeout_deal_unit_price',
          case when is_closeout then source_locked_unit_price else null end,
        'closeout_currency',
          case when is_closeout then deal_json->>'finance_currency' else null end,
        'closeout_paid_amount',
          case when is_closeout then nullif(deal_json->>'received_amount','')::numeric else null end,
        'closeout_actual_amount',
          case when is_closeout then closeout_actual_amount else null end,
        'closeout_balance_amount',
          case
            when is_closeout
             and closeout_actual_amount is not null
             and nullif(deal_json->>'received_amount','') is not null
            then round(closeout_actual_amount-(deal_json->>'received_amount')::numeric,2)
            else null
          end,
        'closeout_balance_direction',
          case
            when not is_closeout
              or closeout_actual_amount is null
              or nullif(deal_json->>'received_amount','') is null
              then null
            when round(closeout_actual_amount-(deal_json->>'received_amount')::numeric,2)>0.01
              then 'CLIENT_OWES_RONA'
            when round(closeout_actual_amount-(deal_json->>'received_amount')::numeric,2)<-0.01
              then 'RONA_OWES_CLIENT'
            else 'SETTLED'
          end
      )
      order by ord
    ),
    '[]'::jsonb
  )
  into v_deals
  from enriched;

  return
    (v_base - 'rail' - 'deals' - 'readModelVersion' - 'generatedAt')
    || jsonb_build_object(
      'readModelVersion','ADMIN_DEALS_CURRENT_V4',
      'lifecycleStage','ADMIN_RAIL_COMPLETED_AND_100_PERCENT_PAID_ATTENTION_V1',
      'closeoutProjectionVersion','ADMIN_DEAL_CLOSEOUT_PROJECTION_V1',
      'generatedAt',now(),
      'deals',v_deals,
      'railExecutionVersion',v_rail->>'readModelVersion',
      'rail',coalesce(v_rail->'rail','[]'::jsonb)
    );
end
$function$;

revoke all on function public.owner_deals_current_v4() from public, anon;
grant execute on function public.owner_deals_current_v4() to authenticated, service_role;

comment on function public.owner_deals_current_v4()
is 'Admin Deals current projection with CLOSEOUT V1. CLOSEOUT is read-only and applies only after manual Rail monitoring completion plus authoritative 100% Finance completion. Actual shipped quantity is derived fail-closed from trusted Rail Logistics wagon membership and stable captured cargo weights; price is source-locked by reconciliation to Finance obligation. No business record is mutated.';
