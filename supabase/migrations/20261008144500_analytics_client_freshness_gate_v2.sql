-- Analytics Client Freshness Gate V2
-- Commercial proposal: 0f5f4cf9-8f56-42a7-b553-53c28abd0616
-- Operations approval: ccc1d077-266a-4261-9de3-daf5968be4ab
-- Projection-only. No raw fact mutation. No visual change.

create or replace function public.owner_analytics_client_feed()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare
  v_actor uuid;
  v_rows jsonb;
begin
  v_actor := portal_private.owner_r1_actor('CLIENT');

  select coalesce(jsonb_agg(jsonb_build_object(
    'publication_id',p.publication_id,
    'title',p.title,
    'published_at',p.published_at,
    'items',coalesce(i.items,'[]'::jsonb)
  ) order by p.published_at desc),'[]'::jsonb)
  into v_rows
  from portal_private.publications p
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'product',pi.product,
      'basis',pi.basis,
      'headline',pi.headline,
      'content_text',pi.content_text,
      'analytics_as_of',pi.analytics_as_of,
      'forecast_scenario',pi.forecast_scenario,
      'actual_value',pi.actual_value,
      'forecast_value',pi.forecast_value,
      'analytics_unit',pi.analytics_unit,
      'public_chart',pi.metadata->'public_chart'
    ) order by pi.item_order) as items
    from portal_private.publication_items pi
    where pi.publication_key=p.id
      and pi.item_type::text='ANALYTICS'
      and pi.lifecycle_state::text='ACTIVE'
      and pi.authority_state::text in ('VERIFIED','CONFIRMED')
      and pi.distribution_allowed=true
      and upper(coalesce(pi.audience,'INTERNAL'))<>'INTERNAL'
      and coalesce(pi.metadata->>'publication_layer','')='DERIVED_ANALYTICS'
      and lower(coalesce(pi.metadata->>'public_chart_ready','false'))='true'
      and pi.metadata ? 'public_chart'
      and (pi.client_active_from is null or pi.client_active_from<=now())
      and (pi.client_active_until is null or pi.client_active_until>now())
      and (
        pi.product not in ('АИ-92','АИ-95','ДТ','НАФТА','СУГ / СПБТ')
        or coalesce(
          pi.metadata->'public_chart'->>'source_freshness_state',
          pi.metadata->>'source_freshness_state',
          ''
        )='CURRENT'
      )
  ) i on true
  where p.publication_type::text='ANALYTICS'
    and p.status::text='PUBLISHED'
    and p.lifecycle_state::text='ACTIVE'
    and p.authority_state::text in ('VERIFIED','CONFIRMED')
    and upper(coalesce(p.audience,'INTERNAL'))<>'INTERNAL'
    and i.items is not null;

  return jsonb_build_object(
    'generatedAt',now(),
    'publications',v_rows,
    'publicationGate','PUBLISHED_DERIVED_DISTRIBUTION_ALLOWED_FRESHNESS_CURRENT_MARKET_ITEMS_ONLY'
  );
end
$function$;

revoke all on function public.owner_analytics_client_feed() from public,anon;
grant execute on function public.owner_analytics_client_feed() to authenticated;

comment on function public.owner_analytics_client_feed() is
'Client Analytics V2 freshness gate. Market items AI92/AI95/DT/NAFTA/LPG require CURRENT freshness; stale/gap/to-verify remain Admin-visible but are excluded from Client projection.';
