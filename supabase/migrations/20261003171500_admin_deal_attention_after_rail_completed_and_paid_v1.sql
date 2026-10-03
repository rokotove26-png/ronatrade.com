-- Admin Deals lifecycle stage 1:
-- manual Rail monitoring completion + authoritative 100% payment => Deals "Требует внимания".
-- Projection-only signal. No Client portal or closing-document lifecycle changes.

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

  with source_rows as (
    select e.value as deal_json, e.ordinality as ord
    from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb)) with ordinality e(value, ordinality)
  ),
  enriched as (
    select
      s.ord,
      s.deal_json,
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
      on d.deal_id = s.deal_json->>'deal_id'
    left join portal_private.rail_deal_monitoring_control_v1 c
      on c.deal_key = d.id
  )
  select coalesce(
    jsonb_agg(
      deal_json
      || jsonb_build_object(
        'rail_monitoring_state', coalesce(monitoring_state,'ACTIVE'),
        'rail_monitoring_completed_at', rail_monitoring_completed_at,
        'payment_complete_100', payment_complete_100,
        'post_rail_completion_attention',
          (upper(coalesce(monitoring_state,''))='COMPLETED' and payment_complete_100),
        'attention_reason',
          case
            when upper(coalesce(monitoring_state,''))='COMPLETED' and payment_complete_100
              then 'RAIL_COMPLETED_AND_100_PERCENT_PAID'
            else null
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
is 'Admin Deals current projection. Owner-defined lifecycle stage: a deal requires attention when Rail monitoring was manually COMPLETED and authoritative Finance V8 confirms 100% receipts. Projection-only; Client and closing documents unchanged.';
